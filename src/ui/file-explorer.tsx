/**
 * FileExplorer React component
 *
 * Main application component that manages the file exploration interface.
 * Declarative React component that uses hooks for state management and rendering.
 */

import { useState, useCallback } from 'react';
import { useBufferState } from '../hooks/useBufferState.js';
import { useNavigationHandlers } from '../hooks/useNavigationHandlers.js';
import { useTerminalSize, useLayoutDimensions } from '../hooks/useTerminalSize.js';
import { useDialogState } from '../hooks/useDialogState.js';
import { useStatusMessage } from '../hooks/useStatusMessage.js';
import { usePreview } from '../hooks/usePreview.js';
import { useDataLoader } from '../hooks/useDataLoader.js';
import { useOperationExecutor } from '../hooks/useOperationExecutor.js';
import { useExplorerActions } from '../hooks/useExplorerActions.js';
import { useDialogHandlers } from '../hooks/useDialogHandlers.js';
import { useFileExplorerKeyboard } from '../hooks/useFileExplorerKeyboard.js';
import { useClipboard } from '../hooks/useClipboard.js';
import { useImmediateExecution } from '../hooks/useImmediateExecution.js';
import { BufferProvider } from '../contexts/BufferContext.js';

import { FileExplorerLayout, StatusBarState, PreviewState } from './file-explorer-layout.js';
import { Theme } from './theme.js';
import { useTheme } from '../contexts/ThemeContext.js';
import { useStorage } from '../contexts/StorageContextProvider.js';
import { Capability } from '../providers/types/capabilities.js';
import { parseAwsError, formatErrorForDisplay } from '../utils/errors.js';

/**
 * Main FileExplorer component - declarative React implementation
 */
export function FileExplorer() {
  // Subscribe to theme changes so the whole app re-renders when the theme changes
  useTheme();

  // ============================================
  // Storage Context
  // ============================================
  const storage = useStorage();

  // ============================================
  // Core State
  // ============================================
  const [bucket, setBucket] = useState<string>();

  // ============================================
  // Clipboard (simple state for copy/paste)
  // ============================================
  const clipboard = useClipboard();

  // ============================================
  // Status Bar State
  // ============================================
  const {
    message: statusMessage,
    messageColor: statusMessageColor,
    setMessage: setStatusMessage,
    setMessageColor: setStatusMessageColor,
    isError: statusIsError,
  } = useStatusMessage();

  // ============================================
  // Dialog Visibility State (consolidated hook)
  // ============================================
  const {
    dialog: dialogState,
    isConfirmOpen: showConfirmDialog,
    isHelpOpen: showHelpDialog,
    isSortOpen: showSortMenu,
    isUploadOpen: showUploadDialog,
    isProfileSelectorOpen: showProfileSelectorDialog,
    isThemeSelectorOpen: showThemeSelectorDialog,
    showConfirm,
    toggleHelp,
    toggleSort,
    showUpload,
    showProfileSelector,
    showThemeSelector,
    closeDialog,
    closeAndClearOperations,
  } = useDialogState();
  const pendingOperations = dialogState.pendingOperations;

  // ============================================
  // Preview Mode (controls whether preview hook is active)
  // ============================================
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  // ============================================
  // Operation Executor Hook (combines progress + async operations)
  // ============================================
  const {
    execute: executeOperationsWithProgress,
    cancel: cancelOperation,
    progress: progressState,
  } = useOperationExecutor();

  // ============================================
  // Immediate Execution Hook
  // ============================================
  const immediateExecution = useImmediateExecution();

  // ============================================
  // Hooks
  // ============================================
  const terminalSize = useTerminalSize();
  const layout = useLayoutDimensions(terminalSize.size);

  // Initialize buffer state
  const initialPath = '';
  const bufferState = useBufferState([], initialPath);

  // ============================================
  // Navigation Handlers
  // ============================================
  const navigationHandlers = useNavigationHandlers(bufferState, {
    storage,
    setStatusMessage,
    setStatusMessageColor,
    successColor: Theme.getSuccessColor(),
    errorColor: Theme.getErrorColor(),
  });

  // ============================================
  // Data Loader Hook
  // ============================================
  const { isInitialized } = useDataLoader({
    bucket,
    currentPath: bufferState.currentPath,
    setEntries: entries => {
      bufferState.setEntries([...entries]);
    },
    setCurrentPath: bufferState.setCurrentPath,
    onSuccess: msg => {
      setStatusMessage(msg);
      setStatusMessageColor(Theme.getSuccessColor());
    },
    onError: msg => {
      setStatusMessage(msg);
      setStatusMessageColor(Theme.getErrorColor());
    },
  });

  // ============================================
  // Preview Hook
  // ============================================
  const selectedEntry = bufferState.entries[bufferState.selection.cursorIndex];
  // For container-based providers (S3, GCS), require bucket to be selected
  // For non-container providers (Local, SFTP, FTP), just need to be initialized
  const hasContainers = storage.hasCapability(Capability.Containers);
  const previewHookEnabled = isPreviewMode && isInitialized && (hasContainers ? !!bucket : true);
  const preview = usePreview(bufferState.currentPath, selectedEntry, {
    enabled: previewHookEnabled,
    maxSize: 100 * 1024, // 100KB
  });
  const previewContent = preview.content;
  const previewFilename = preview.filename;

  // ============================================
  // Keyboard State
  // ============================================
  const isAnyDialogOpen =
    showConfirmDialog ||
    showHelpDialog ||
    showSortMenu ||
    showUploadDialog ||
    showProfileSelectorDialog ||
    showThemeSelectorDialog;

  // ============================================
  // Refresh Listing Helper
  // ============================================
  const refreshListing = useCallback(async () => {
    try {
      if (!bucket && storage.hasCapability(Capability.Containers)) {
        const entries = await storage.listContainers();
        bufferState.setEntries([...entries]);
      } else {
        const entries = await storage.list(bufferState.currentPath);
        bufferState.setEntries([...entries]);
      }
    } catch (err) {
      const parsedError = parseAwsError(err, 'Refresh failed');
      setStatusMessage(formatErrorForDisplay(parsedError, 70));
      setStatusMessageColor(Theme.getErrorColor());
    }
  }, [bucket, storage, bufferState, setStatusMessage, setStatusMessageColor]);

  // ============================================
  // Action Handlers (via Custom Hook)
  // ============================================
  const actionHandlers = useExplorerActions({
    storage,
    bufferState,
    bucket,
    setBucket,
    previewMode: isPreviewMode,
    setPreviewMode: setIsPreviewMode,
    setStatusMessage,
    setStatusMessageColor,
    navigationHandlers,
    showConfirm,
    showUpload,
    showProfileSelector,
    showThemeSelector,
    toggleHelp,
    toggleSort,
    closeDialog,
    clipboard,
    immediateExecution,
    refreshListing,
  });

  // ============================================
  // Computed State
  // ============================================
  const showErrorDialog = statusIsError;

  // ============================================
  // Cancel Operation Handler
  // ============================================
  const handleCancelOperation = useCallback(() => {
    cancelOperation();
  }, [cancelOperation]);

  // ============================================
  // Dialog Handlers (extracted to separate hook)
  // ============================================
  const dialogsState = useDialogHandlers({
    bufferState,
    storage,
    dialogState,
    pendingOperations,
    progressState,
    showConfirmDialog,
    showHelpDialog,
    showSortMenu,
    showUploadDialog,
    showProfileSelectorDialog,
    showThemeSelectorDialog,
    showErrorDialog,
    statusMessage,
    showConfirm,
    closeDialog,
    closeAndClearOperations,
    setStatusMessage,
    setStatusMessageColor,
    setBucket,
    executeOperationsWithProgress,
    handleCancelOperation,
    refreshListing,
  });

  // ============================================
  // Keyboard Handler (extracted to separate hook)
  // ============================================
  useFileExplorerKeyboard({
    mode: bufferState.mode,
    actionHandlers,
    isAnyDialogOpen,
  });

  // ============================================
  // Build Props for Layout Component
  // ============================================
  const statusBarState: StatusBarState = {
    message: statusMessage,
    messageColor: statusMessageColor,
  };

  const previewState: PreviewState = {
    content: previewContent,
    filename: previewFilename,
  };

  // ============================================
  // Render
  // ============================================
  return (
    <BufferProvider value={bufferState}>
      <FileExplorerLayout
        bucket={bucket}
        isInitialized={isInitialized}
        terminalSize={terminalSize}
        layout={layout}
        statusBar={statusBarState}
        preview={previewState}
        dialogs={dialogsState}
        showErrorDialog={showErrorDialog}
      />
    </BufferProvider>
  );
}
