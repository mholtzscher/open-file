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

import { FileExplorerLayout, StatusBarState, PreviewState } from './file-explorer-layout.js';
import { DialogsState } from './file-explorer-dialogs.js';
import { CatppuccinMocha } from './theme.js';
import { useKeyboardHandler } from '../contexts/KeyboardContext.js';
import { useStorage } from '../contexts/StorageContextProvider.js';
import { Entry, EntryType } from '../types/entry.js';
import { SortField, SortOrder } from '../utils/sorting.js';
import { EditMode } from '../types/edit-mode.js';
import { keyToString, type KeyboardKey, type KeyAction } from '../types/keyboard.js';
import { defaultKeybindings, type KeybindingMap } from '../hooks/keybindingDefaults.js';
import { useKeySequence } from '../hooks/useKeySequence.js';

import type { PendingOperation } from '../types/dialog.js';

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
  // Refs
  // ============================================
  const quitAfterSaveRef = useRef(false);

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
  // Currently passed to useNavigationHandlers, which is passed to useS3Actions
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
        // Simple error handling, detailed parsing in useS3Actions
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
  // Check if any dialog is open (blocks normal keybindings)
  const isAnyDialogOpen =
    showConfirmDialog ||
    showHelpDialog ||
    showSortMenu ||
    showUploadDialog ||
    showQuitDialog ||
    showProfileSelectorDialog;

  // Use the shared default keybindings map
  const keybindings: KeybindingMap = defaultKeybindings;

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
  // Confirm Handler
  // ============================================
  const createConfirmHandler = useCallback(async () => {
    // Use the unified operation executor hook
    await executeOperationsWithProgress(pendingOperations, {
      onSuccess: async (_result, message) => {
        try {
          const currentBufferState = bufferStateRef.current;

          const entries = await storage.list(currentBufferState.currentPath);
          currentBufferState.setEntries([...entries]);
          // Clear deletion marks after successful save
          currentBufferState.clearDeletionMarks();
          setStatusMessage(message);
          setStatusMessageColor(CatppuccinMocha.green);

          // If quit was requested after save, exit now
          if (quitAfterSaveRef.current) {
            quitAfterSaveRef.current = false;
            process.exit(0);
          }
        } catch (reloadError) {
          console.error('Failed to reload buffer:', reloadError);
          setStatusMessage('Operations completed but failed to reload buffer');
          setStatusMessageColor(CatppuccinMocha.yellow);
        }
      },
      onError: message => {
        setStatusMessage(message);
        setStatusMessageColor(CatppuccinMocha.red);
      },
      onCancelled: message => {
        setStatusMessage(message);
        setStatusMessageColor(CatppuccinMocha.yellow);
      },
      onComplete: () => {
        closeAndClearOperations();
      },
    });
  }, [pendingOperations, storage, closeAndClearOperations, executeOperationsWithProgress]);

  const handleCancelOperation = useCallback(() => {
    cancelOperation();
  }, [cancelOperation]);

  // ============================================
  // Keyboard Handler (via Context)
  // ============================================
  // Main keyboard handler implements mode-aware keybindings directly.
  const keyboardHandlerCallback = useCallback(
    (key: KeyboardKey): boolean => {
      // If a dialog is open, let dialog handlers process the key
      if (isAnyDialogOpen) {
        return false;
      }

      const mode = bufferState.mode;

      // Helper to execute an action via useS3Actions map
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
          return true; // waiting for more keys in sequence
        }
      }

      // Keybinding lookup: mode-specific first
      const keyStr = keyToString(key);
      const modeBindings = keybindings.get(mode);
      const action = modeBindings?.get(keyStr);

      if (action) {
        return executeAction(action, key);
      }

      // Global bindings
      const globalBindings = keybindings.get('global');
      const globalAction = globalBindings?.get(keyStr);

      if (globalAction) {
        return executeAction(globalAction, key);
      }

      return false;
    },
    [isAnyDialogOpen, bufferState.mode, actionHandlers, keybindings, handleSequence]
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

  const dialogsState: DialogsState = {
    confirm: {
      visible: showConfirmDialog,
      operations: pendingOperations,
      onConfirm: createConfirmHandler,
      onCancel: () => {
        closeAndClearOperations();
      },
    },
    error: {
      visible: showErrorDialog,
      message: statusMessage,
      onDismiss: () => {
        setStatusMessage('');
        setStatusMessageColor(CatppuccinMocha.text);
      },
    },
    help: {
      visible: showHelpDialog,
      onClose: () => {
        closeDialog();
      },
    },
    upload: {
      visible: showUploadDialog,
      destinationPath: bufferState.currentPath,
      onConfirm: selectedFiles => {
        closeDialog();
        const currentPath = bufferState.currentPath;
        const newOperations = selectedFiles.map((filePath, index) => {
          const filename = filePath.split('/').pop() || filePath;
          const s3Destination = currentPath ? `${currentPath}${filename}` : filename;

          const entry: Entry = {
            id: `local-${index}`,
            name: filename,
            path: filePath,
            type: EntryType.File,
            size: undefined,
            modified: undefined,
            metadata: undefined,
          };

          return {
            id: `upload-${index}`,
            type: 'upload' as const,
            source: filePath,
            destination: s3Destination,
            entry,
            recursive: false,
          };
        });
        showConfirm(newOperations);
      },
      onCancel: () => closeDialog(),
    },
    sortMenu: {
      visible: showSortMenu,
      currentField: bufferState.sortConfig.field,
      currentOrder: bufferState.sortConfig.order,
      onFieldSelect: (field: SortField) => {
        const newConfig = {
          ...bufferState.sortConfig,
          field,
        };
        bufferState.setSortConfig(newConfig);
        const fieldName = field.charAt(0).toUpperCase() + field.slice(1);
        setStatusMessage(`Sorted by ${fieldName}`);
        setStatusMessageColor(CatppuccinMocha.green);
      },
      onOrderToggle: () => {
        const newOrder =
          bufferState.sortConfig.order === SortOrder.Ascending
            ? SortOrder.Descending
            : SortOrder.Ascending;
        const newConfig = {
          ...bufferState.sortConfig,
          order: newOrder,
        };
        bufferState.setSortConfig(newConfig);
        const orderStr = newOrder === SortOrder.Ascending ? 'ascending' : 'descending';
        setStatusMessage(`Sort order: ${orderStr}`);
        setStatusMessageColor(CatppuccinMocha.green);
      },
      onClose: () => closeDialog(),
    },
    progress: {
      visible: progressState.visible,
      title: progressState.title,
      description: progressState.description,
      progress: progressState.value,
      currentFile: progressState.currentFile,
      currentFileNumber: progressState.currentNum,
      totalFiles: progressState.totalNum,
      canCancel: progressState.cancellable,
      onCancel: handleCancelOperation,
    },
    quit: {
      visible: showQuitDialog,
      pendingChanges: dialogState.quitPendingChanges,
      onQuitWithoutSave: () => {
        process.exit(0);
      },
      onSaveAndQuit: () => {
        const currentBufferState = bufferState;
        const markedForDeletion = currentBufferState.getMarkedForDeletion();

        if (markedForDeletion.length > 0) {
          const deleteOperations: PendingOperation[] = markedForDeletion.map(entry => ({
            id: entry.id,
            type: 'delete' as const,
            path: entry.path,
            entry,
          }));

          quitAfterSaveRef.current = true;
          closeDialog();
          showConfirm(deleteOperations);
        } else {
          process.exit(0);
        }
      },
      onCancel: () => {
        closeDialog();
        setStatusMessage('Quit cancelled');
        setStatusMessageColor(CatppuccinMocha.text);
      },
    },
    profileSelector: {
      visible: showProfileSelectorDialog,
      profileManager: storage.getProfileManager(),
      currentProfileId: storage.state.profileId,
      onProfileSelect: async profile => {
        try {
          setStatusMessage(`Switching to profile: ${profile.displayName}...`);
          setStatusMessageColor(CatppuccinMocha.blue);
          closeDialog();

          // Switch to the new profile
          await storage.switchProfile(profile.id);

          // Get the new state from storage
          const newState = storage.state;

          // Update bucket state based on new storage state
          if (newState.currentContainer) {
            setBucket(newState.currentContainer);
          } else {
            setBucket(undefined);
          }

          // Update buffer with new entries and path
          bufferState.setEntries([...newState.entries]);
          bufferState.setCurrentPath(newState.currentPath);

          setStatusMessage(`Switched to profile: ${profile.displayName}`);
          setStatusMessageColor(CatppuccinMocha.green);
        } catch (err) {
          setStatusMessage(
            `Failed to switch profile: ${err instanceof Error ? err.message : 'Unknown error'}`
          );
          setStatusMessageColor(CatppuccinMocha.red);
        }
      },
      onCancel: () => closeDialog(),
    },
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
