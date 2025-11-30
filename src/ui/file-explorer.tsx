/**
 * FileExplorer Solid component
 *
 * Main application component that manages the file exploration interface.
 * Declarative Solid component that uses hooks for state management and rendering.
 */

import { createSignal, createEffect, on, createMemo } from 'solid-js';
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
import { Theme } from './theme.js';
import { useTheme } from '../contexts/ThemeContext.js';
import { useStorage } from '../contexts/StorageContextProvider.js';
import { Capability } from '../providers/types/capabilities.js';

/**
 * Main FileExplorer component - declarative Solid implementation
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
  const [bucket, setBucket] = createSignal<string | undefined>();

  // ============================================
  // Pending Operations Store (global state for file operations)
  // ============================================
  // Derive the storage scheme from the provider ID
  const scheme = providerNameToScheme(storage.state.providerId || 'mock');
  // Note: We don't pass a provider here yet - operations will be executed
  // through the existing executeOperationsWithProgress flow for now.
  // Full integration with the provider will come in Phase 4.
  const pendingOps = usePendingOperations(scheme, bucket());

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
    isThemeSelectorOpen: showThemeSelectorDialog,
    showConfirm,
    toggleHelp,
    toggleSort,
    showUpload,
    showQuit,
    showProfileSelector,
    showThemeSelector,
    closeDialog,
    closeAndClearOperations,
  } = useDialogState();

  // ============================================
  // Preview Mode (controls whether preview hook is active)
  // ============================================
  const [isPreviewMode, setIsPreviewMode] = createSignal(false);

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

  // In Solid, we can just use a regular variable that persists
  // since the component function only runs once
  let bufferStateRef = { current: bufferState };

  // Update viewport height when layout changes
  createEffect(
    on(
      () => layout.contentHeight,
      contentHeight => {
        bufferState.setViewportHeight(contentHeight);
      }
    )
  );

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
    currentPath: () => bufferState.currentPath,
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
  const selectedEntry = createMemo(() => bufferState.entries[bufferState.selection.cursorIndex]);
  // For container-based providers (S3, GCS), require bucket to be selected
  // For non-container providers (Local, SFTP, FTP), just need to be initialized
  const hasContainers = storage.hasCapability(Capability.Containers);
  const previewHookEnabled = createMemo(
    () => isPreviewMode() && isInitialized() && (hasContainers ? !!bucket() : true)
  );
  const preview = usePreview(() => bufferState.currentPath, selectedEntry, {
    enabled: previewHookEnabled(),
    maxSize: 100 * 1024, // 100KB
  });

  // ============================================
  // Keyboard State
  // ============================================
  const isAnyDialogOpen = createMemo(
    () =>
      showConfirmDialog() ||
      showHelpDialog() ||
      showSortMenu() ||
      showUploadDialog() ||
      showQuitDialog() ||
      showProfileSelectorDialog() ||
      showThemeSelectorDialog()
  );

  // ============================================
  // Action Handlers (via Custom Hook)
  // ============================================
  const actionHandlers = useS3Actions({
    storage,
    bufferState,
    bucket: bucket(),
    setBucket: (b: string | undefined) => setBucket(b),
    previewMode: isPreviewMode(),
    setPreviewMode: (enabled: boolean) => setIsPreviewMode(enabled),
    setStatusMessage,
    setStatusMessageColor,
    navigationHandlers,
    showConfirm,
    showUpload,
    showQuit,
    showProfileSelector,
    showThemeSelector,
    toggleHelp,
    toggleSort,
    closeDialog,
    pendingOps,
  });

  // ============================================
  // Computed State
  // ============================================
  const showErrorDialog = createMemo(() => statusIsError());

  // ============================================
  // Cancel Operation Handler
  // ============================================
  const handleCancelOperation = () => {
    cancelOperation();
  };

  // ============================================
  // Dialog Handlers (extracted to separate hook)
  // ============================================
  // Convert accessor functions to values for useDialogHandlers which expects values
  const dialogsState = useDialogHandlers({
    bufferState,
    bufferStateRef,
    storage,
    dialogState: dialogState(),
    pendingOperations: dialogState().pendingOperations,
    progressState: {
      visible: progressState.visible(),
      title: progressState.title(),
      description: progressState.description(),
      value: progressState.value(),
      currentFile: progressState.currentFile(),
      currentNum: progressState.currentNum(),
      totalNum: progressState.totalNum(),
      cancellable: progressState.cancellable(),
    },
    showConfirmDialog: showConfirmDialog(),
    showHelpDialog: showHelpDialog(),
    showSortMenu: showSortMenu(),
    showUploadDialog: showUploadDialog(),
    showQuitDialog: showQuitDialog(),
    showProfileSelectorDialog: showProfileSelectorDialog(),
    showThemeSelectorDialog: showThemeSelectorDialog(),
    showErrorDialog: showErrorDialog(),
    statusMessage: statusMessage(),
    showConfirm,
    closeDialog,
    closeAndClearOperations,
    setStatusMessage,
    setStatusMessageColor,
    setBucket: (b: string | undefined) => setBucket(b),
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
    isAnyDialogOpen: isAnyDialogOpen(),
  });

  // Note: We need to call accessor functions when building props for child components
  // that are still using React and expecting values, not accessor functions.

  // ============================================
  // Build Props for Layout Component
  // ============================================
  const statusBarState: StatusBarState = {
    message: statusMessage(),
    messageColor: statusMessageColor(),
  };

  const previewState: PreviewState = {
    content: preview().content,
    filename: preview().filename,
  };

  // ============================================
  // Render
  // ============================================
  return (
    <FileExplorerLayout
      bucket={bucket()}
      isInitialized={isInitialized()}
      bufferState={bufferState}
      terminalSize={terminalSize}
      layout={layout}
      statusBar={statusBarState}
      preview={previewState}
      dialogs={dialogsState}
      showErrorDialog={showErrorDialog()}
      pendingOps={pendingOps}
    />
  );
}
