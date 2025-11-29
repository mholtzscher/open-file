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

import { FileExplorerLayout, StatusBarState, PreviewState } from './file-explorer-layout.js';
import { CatppuccinMocha } from './theme.js';
import { useKeyboardHandler } from '../contexts/KeyboardContext.js';
import { useStorage } from '../contexts/StorageContextProvider.js';
import { EditMode } from '../types/edit-mode.js';
import { keyToString, type KeyboardKey, type KeyAction } from '../types/keyboard.js';
import { defaultKeybindings } from '../hooks/keybindingDefaults.js';
import { useKeySequence } from '../hooks/useKeySequence.js';

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
  // Navigation Config and Handlers
  // ============================================
  const navigationConfig = {
    onLoadBuffer: async (path: string) => {
      try {
        const entries = await storage.list(path);
        bufferState.setEntries([...entries]);
        bufferState.setCurrentPath(path);
        bufferState.cursorToTop();
        setStatusMessage(`Navigated to ${path}`);
        setStatusMessageColor(CatppuccinMocha.green);
      } catch (err) {
        setStatusMessage(`Navigation failed: ${err instanceof Error ? err.message : String(err)}`);
        setStatusMessageColor(CatppuccinMocha.red);
      }
    },
    onErrorOccurred: (error: string) => {
      setStatusMessage(error);
      setStatusMessageColor(CatppuccinMocha.red);
    },
  };

  const navigationHandlers = useNavigationHandlers(bufferState, navigationConfig);

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

  // Multi-key sequence handling (gg, dd, yy, g?)
  const { handleSequence } = useKeySequence({
    timeout: 500,
    sequenceStarters: ['g', 'd', 'y'],
    sequences: {
      gg: 'cursor:top',
      dd: 'entry:delete',
      yy: 'entry:copy',
      'g?': 'dialog:help',
    },
    bottomAction: 'cursor:bottom',
  });

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
  });

  // ============================================
  // Keyboard Handler (via Context)
  // ============================================
  const keyboardHandlerCallback = useCallback(
    (key: KeyboardKey): boolean => {
      if (isAnyDialogOpen) {
        return false;
      }

      const mode = bufferState.mode;

      const executeAction = (action: KeyAction, event?: KeyboardKey): boolean => {
        const handler = actionHandlers[action];
        if (handler) {
          handler(event);
          return true;
        }
        return false;
      };

      // Text input modes: Search, Command, Insert, Edit
      const isTextInputMode =
        mode === EditMode.Search ||
        mode === EditMode.Command ||
        mode === EditMode.Insert ||
        mode === EditMode.Edit;

      if (isTextInputMode) {
        if (key.name === 'escape') {
          return executeAction('input:cancel', key);
        }
        if (key.name === 'return' || key.name === 'enter') {
          return executeAction('input:confirm', key);
        }
        if (key.name === 'backspace') {
          return executeAction('input:backspace', key);
        }
        if (key.name === 'tab') {
          return executeAction('input:tab', key);
        }
        if (key.char && key.char.length === 1) {
          return executeAction('input:char', key);
        }
        if (mode === EditMode.Search) {
          if (key.name === 'n') {
            return executeAction('cursor:down', key);
          }
          if (key.name === 'N' || (key.shift && key.name === 'n')) {
            return executeAction('cursor:up', key);
          }
        }
        return false;
      }

      // Normal mode: handle multi-key sequences (gg, dd, yy, g?)
      if (mode === EditMode.Normal) {
        const seqResult = handleSequence(key);
        if (seqResult.handled && seqResult.action) {
          return executeAction(seqResult.action, key);
        }
        if (seqResult.waitingForMore) {
          return true;
        }
      }

      // Keybinding lookup: mode-specific first
      const keyStr = keyToString(key);
      const modeBindings = defaultKeybindings.get(mode);
      const action = modeBindings?.get(keyStr);

      if (action) {
        return executeAction(action, key);
      }

      // Global bindings
      const globalBindings = defaultKeybindings.get('global');
      const globalAction = globalBindings?.get(keyStr);

      if (globalAction) {
        return executeAction(globalAction, key);
      }

      return false;
    },
    [isAnyDialogOpen, bufferState.mode, actionHandlers, handleSequence]
  );

  // Register keyboard handler with context at normal priority
  useKeyboardHandler(keyboardHandlerCallback);

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
    />
  );
}
