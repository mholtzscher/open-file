/**
 * FileExplorer React component
 *
 * Main application component that manages the file exploration interface.
 * Declarative React component that uses hooks for state management and rendering.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useBufferState } from '../hooks/useBufferState.js';
import { useNavigationHandlers } from '../hooks/useNavigationHandlers.js';
import { useTerminalSize, useLayoutDimensions } from '../hooks/useTerminalSize.js';
import { useDialogState } from '../hooks/useDialogState.js';
import { useStatusMessage } from '../hooks/useStatusMessage.js';
import { usePreview } from '../hooks/usePreview.js';
import { useDataLoader } from '../hooks/useDataLoader.js';
import { useOperationExecutor } from '../hooks/useOperationExecutor.js';
import { useS3Actions } from '../hooks/useS3Actions.js';
import { useDialogHandlers } from '../hooks/useDialogHandlers.js';
import { useFileExplorerKeyboard } from '../hooks/useFileExplorerKeyboard.js';
import { usePendingOperations } from '../hooks/usePendingOperations.js';
import { providerNameToScheme } from '../utils/storage-uri.js';

import { FileExplorerLayout, StatusBarState, PreviewState } from './file-explorer-layout.js';
import { CatppuccinMocha } from './theme.js';
import { useStorage } from '../contexts/StorageContextProvider.js';

/**
 * Main FileExplorer component - declarative React implementation
 */
export function FileExplorer() {
  // ============================================
  // Storage Context
  // ============================================
  const storage = useStorage();

  // ============================================
  // Core State
  // ============================================
  const [bucket, setBucket] = useState<string>();

  // ============================================
  // Pending Operations Store (global state for file operations)
  // ============================================
  // Derive the storage scheme from the provider ID
  const scheme = providerNameToScheme(storage.state.providerId || 'mock');
  // Note: We don't pass a provider here yet - operations will be executed
  // through the existing executeOperationsWithProgress flow for now.
  // Full integration with the provider will come in Phase 4.
  const pendingOps = usePendingOperations(scheme, bucket);

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
    isQuitOpen: showQuitDialog,
    isProfileSelectorOpen: showProfileSelectorDialog,
    showConfirm,
    toggleHelp,
    toggleSort,
    showUpload,
    showQuit,
    showProfileSelector,
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
  // Hooks
  // ============================================
  const terminalSize = useTerminalSize();
  const layout = useLayoutDimensions(terminalSize.size);

  // Initialize buffer state
  const initialPath = '';
  const bufferState = useBufferState([], initialPath);
  const bufferStateRef = useRef(bufferState);
  bufferStateRef.current = bufferState;

  // Update viewport height when layout changes
  useEffect(() => {
    bufferState.setViewportHeight(layout.contentHeight);
  }, [layout.contentHeight, bufferState.setViewportHeight]);

  // ============================================
  // Navigation Handlers
  // ============================================
  const navigationHandlers = useNavigationHandlers(bufferState, {
    storage,
    setStatusMessage,
    setStatusMessageColor,
    successColor: CatppuccinMocha.green,
    errorColor: CatppuccinMocha.red,
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
      setStatusMessageColor(CatppuccinMocha.green);
    },
    onError: msg => {
      setStatusMessage(msg);
      setStatusMessageColor(CatppuccinMocha.red);
    },
  });

  // ============================================
  // Preview Hook
  // ============================================
  const selectedEntry = bufferState.entries[bufferState.selection.cursorIndex];
  const previewHookEnabled = isPreviewMode && !!bucket && isInitialized;
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
    showQuitDialog ||
    showProfileSelectorDialog;

  // ============================================
  // Action Handlers (via Custom Hook)
  // ============================================
  const actionHandlers = useS3Actions({
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
    showQuit,
    showProfileSelector,
    toggleHelp,
    toggleSort,
    closeDialog,
    pendingOps,
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
    bufferStateRef,
    storage,
    dialogState,
    pendingOperations,
    progressState,
    showConfirmDialog,
    showHelpDialog,
    showSortMenu,
    showUploadDialog,
    showQuitDialog,
    showProfileSelectorDialog,
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
    pendingOps,
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
    <FileExplorerLayout
      bucket={bucket}
      isInitialized={isInitialized}
      bufferState={bufferState}
      terminalSize={terminalSize}
      layout={layout}
      statusBar={statusBarState}
      preview={previewState}
      dialogs={dialogsState}
      showErrorDialog={showErrorDialog}
      pendingOps={pendingOps}
    />
  );
}
