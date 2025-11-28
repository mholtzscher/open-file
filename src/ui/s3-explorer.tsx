/**
 * S3Explorer React component
 *
 * Main application component that manages the S3 bucket exploration interface.
 * Declarative React component that uses hooks for state management and rendering.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useBufferState } from '../hooks/useBufferState.js';
import { useKeyboardDispatcher } from '../hooks/useKeyboardDispatcher.js';
import { useNavigationHandlers } from '../hooks/useNavigationHandlers.js';
import { useTerminalSize, useLayoutDimensions } from '../hooks/useTerminalSize.js';
import { useMultiPaneLayout } from '../hooks/useMultiPaneLayout.js';
import { useDialogState } from '../hooks/useDialogState.js';
import { useStatusMessage } from '../hooks/useStatusMessage.js';
import { usePreview } from '../hooks/usePreview.js';
import { useDataLoader } from '../hooks/useDataLoader.js';
import { useOperationExecutor } from '../hooks/useOperationExecutor.js';
import { useS3Actions } from '../hooks/useS3Actions.js';

import { S3ExplorerLayout, StatusBarState, PreviewState } from './s3-explorer-layout.js';
import { DialogsState } from './s3-explorer-dialogs.js';
import { CatppuccinMocha } from './theme.js';
import { useKeyboardHandler, KeyboardPriority } from '../contexts/KeyboardContext.js';
import { useStorage } from '../contexts/StorageContextProvider.js';
import { Entry, EntryType } from '../types/entry.js';
import { SortField, SortOrder, formatSortField } from '../utils/sorting.js';

import { getDialogHandler } from '../hooks/useDialogKeyboard.js';
import type { PendingOperation } from '../types/dialog.js';
import type { KeyboardKey } from '../types/keyboard.js';

interface S3ExplorerProps {
  bucket?: string;
}

/**
 * Main S3Explorer component - declarative React implementation
 */
export function S3Explorer({ bucket: initialBucket }: S3ExplorerProps) {
  // ============================================
  // Storage Context
  // ============================================
  const storage = useStorage();

  // ============================================
  // Core State
  // ============================================
  const [bucket, setBucket] = useState<string | undefined>(initialBucket);

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
  // Preview State
  // ============================================
  const [previewEnabled, setPreviewEnabled] = useState(false);

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
  const showUploadDialogRef = useRef(showUploadDialog);
  const showConfirmDialogRef = useRef(showConfirmDialog);
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

  // Initialize multi-pane layout
  const multiPaneLayout = useMultiPaneLayout();

  // Add initial pane if none exist - only run once on mount
  useEffect(() => {
    if (multiPaneLayout.panes.length === 0) {
      multiPaneLayout.addPane(bufferStateRef);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      const activeBufferState = multiPaneLayout.getActiveBufferState() || bufferState;
      try {
        const entries = await storage.list(path);
        activeBufferState.setEntries([...entries]);
        activeBufferState.setCurrentPath(path);
        activeBufferState.cursorToTop();
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

  const activeBufferState = multiPaneLayout.getActiveBufferState() || bufferState;
  const navigationHandlers = useNavigationHandlers(activeBufferState, navigationConfig);

  // ============================================
  // Data Loader Hook
  // ============================================
  const { isInitialized } = useDataLoader({
    bucket,
    currentPath: activeBufferState.currentPath,
    setEntries: entries => {
      activeBufferState.setEntries([...entries]);
    },
    setCurrentPath: activeBufferState.setCurrentPath,
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
  const selectedEntry = activeBufferState.entries[activeBufferState.selection.cursorIndex];
  const previewHookEnabled =
    previewEnabled && !!bucket && isInitialized && !multiPaneLayout.isMultiPaneMode;
  const preview = usePreview(activeBufferState.currentPath, selectedEntry, {
    enabled: previewHookEnabled,
    maxSize: 100 * 1024, // 100KB
  });
  const previewContent = preview.content;
  const previewFilename = preview.filename;

  // ============================================
  // Keyboard Dispatcher
  // ============================================
  // Check if any dialog is open (blocks normal keybindings)
  const isAnyDialogOpen =
    showConfirmDialog ||
    showHelpDialog ||
    showSortMenu ||
    showUploadDialog ||
    showQuitDialog ||
    showProfileSelectorDialog;

  // Initialize the keyboard dispatcher
  const { dispatch: dispatchKey, registerActions } = useKeyboardDispatcher({
    mode: activeBufferState.mode,
    isDialogOpen: isAnyDialogOpen,
  });

  // ============================================
  // Action Handlers (via Custom Hook)
  // ============================================
  const actionHandlers = useS3Actions({
    storage,
    multiPaneLayout,
    bufferState,
    bucket,
    setBucket,
    previewEnabled,
    setPreviewEnabled,
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

  // Register action handlers with the dispatcher
  useEffect(() => {
    return registerActions(actionHandlers);
  }, [registerActions, actionHandlers]);

  // ============================================
  // Computed State
  // ============================================
  const showErrorDialog = statusIsError;

  // ============================================
  // Confirm Handler
  // ============================================
  const confirmHandlerRef = useRef<() => Promise<void>>(async () => {});

  const createConfirmHandler = useCallback(async () => {
    // Use the unified operation executor hook
    await executeOperationsWithProgress(pendingOperations, {
      onSuccess: async (_result, message) => {
        try {
          const currentBufferState = multiPaneLayout.getActiveBufferState() || bufferState;
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
  }, [
    pendingOperations,
    storage,
    multiPaneLayout,
    bufferState,
    closeAndClearOperations,
    executeOperationsWithProgress,
  ]);

  useEffect(() => {
    confirmHandlerRef.current = createConfirmHandler;
  }, [createConfirmHandler]);

  const handleCancelOperation = useCallback(() => {
    cancelOperation();
  }, [cancelOperation]);

  // ============================================
  // Ref Sync Effects
  // ============================================
  useEffect(() => {
    showConfirmDialogRef.current = showConfirmDialog;
  }, [showConfirmDialog]);

  useEffect(() => {
    showUploadDialogRef.current = showUploadDialog;
  }, [showUploadDialog]);

  // ============================================
  // Keyboard Handler (via Context)
  // ============================================
  // Create stable callback for keyboard handling
  // This handler deals with dialog-specific keys and delegates to the dispatcher
  const keyboardHandlerCallback = useCallback(
    (key: KeyboardKey): boolean => {
      // Upload dialog - delegate to dialog handler
      if (showUploadDialogRef.current) {
        const handler = getDialogHandler('upload-dialog');
        if (handler) {
          handler(key.name);
        }
        return true; // Consumed by dialog
      }

      // Confirmation dialog - handle y/n keys
      if (showConfirmDialogRef.current) {
        if (key.name === 'y') {
          confirmHandlerRef.current();
          return true;
        }
        if (key.name === 'n' || key.name === 'escape') {
          closeAndClearOperations();
          return true;
        }
        return true; // Block all other keys when dialog is open
      }

      // Error dialog - block all input except escape
      if (showErrorDialog) {
        if (key.name === 'escape') {
          setStatusMessage('');
          setStatusMessageColor(CatppuccinMocha.text);
        }
        return true; // Block all keys when error dialog is open
      }

      // Sort menu shortcuts
      if (showSortMenu) {
        const currentBufferState = multiPaneLayout.getActiveBufferState() || bufferState;
        const currentSortConfig = currentBufferState.sortConfig;

        if (key.name === 'escape' || key.name === 'q') {
          closeDialog();
          return true;
        }

        const fieldMap: { [key: string]: SortField } = {
          '1': SortField.Name,
          '2': SortField.Size,
          '3': SortField.Modified,
          '4': SortField.Type,
        };

        if (fieldMap[key.name]) {
          const newConfig = {
            ...currentSortConfig,
            field: fieldMap[key.name],
          };
          currentBufferState.setSortConfig(newConfig);
          setStatusMessage(`Sorted by ${formatSortField(fieldMap[key.name])}`);
          setStatusMessageColor(CatppuccinMocha.green);
          return true;
        }

        if (key.name === 'space' || key.name === 'return') {
          const newOrder =
            currentSortConfig.order === SortOrder.Ascending
              ? SortOrder.Descending
              : SortOrder.Ascending;
          const newConfig = {
            ...currentSortConfig,
            order: newOrder,
          };
          currentBufferState.setSortConfig(newConfig);
          const orderStr = newOrder === SortOrder.Ascending ? 'ascending' : 'descending';
          setStatusMessage(`Sort order: ${orderStr}`);
          setStatusMessageColor(CatppuccinMocha.green);
          return true;
        }

        return true; // Block all other keys when sort menu is open
      }

      // Help dialog shortcuts
      if (showHelpDialog) {
        if (key.name === '?' || key.name === 'escape' || key.name === 'q') {
          closeDialog();
          return true;
        }
        return true; // Block all other keys when help dialog is open
      }

      // Profile selector dialog - delegate to dialog handler
      if (showProfileSelectorDialog) {
        const handler = getDialogHandler('profile-selector-dialog');
        if (handler) {
          handler(key.name);
        }
        return true; // Consumed by dialog
      }

      // Quit confirmation dialog
      if (showQuitDialog) {
        if (key.name === 'q') {
          // User confirmed quit without saving
          process.exit(0);
        } else if (key.name === 'escape' || key.name === 'n') {
          // User cancelled quit
          closeDialog();
          setStatusMessage('Quit cancelled');
          setStatusMessageColor(CatppuccinMocha.text);
          return true;
        } else if (key.name === 'w') {
          // User wants to save first, then quit
          const currentBufferState = multiPaneLayout.getActiveBufferState() || bufferState;
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
            // No changes to save, just quit
            process.exit(0);
          }
          return true;
        }
        return true; // Block all other keys when quit dialog is open
      }

      // Dispatch to the action-based keyboard handler
      // This handles all normal mode, visual mode, search mode, etc. keybindings
      return dispatchKey(key);
    },
    [
      dispatchKey,
      showHelpDialog,
      showErrorDialog,
      showSortMenu,
      showQuitDialog,
      showProfileSelectorDialog,
      closeDialog,
      closeAndClearOperations,
      bufferState,
      multiPaneLayout,
    ]
  );

  // Register keyboard handler with context at normal priority
  useKeyboardHandler(keyboardHandlerCallback, [keyboardHandlerCallback], KeyboardPriority.Normal);

  // ============================================
  // Build Props for Layout Component
  // ============================================
  const statusBarState: StatusBarState = {
    message: statusMessage,
    messageColor: statusMessageColor,
  };

  const previewState: PreviewState = {
    enabled: previewEnabled,
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
    },
    help: {
      visible: showHelpDialog,
    },
    upload: {
      visible: showUploadDialog,
      destinationPath: activeBufferState.currentPath,
      onConfirm: selectedFiles => {
        closeDialog();
        const currentPath = activeBufferState.currentPath;
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
    },
    profileSelector: {
      visible: showProfileSelectorDialog,
      profileManager: storage.getProfileManager(),
      currentProfileId: storage.state.providerId,
      onProfileSelect: async profile => {
        try {
          console.error(`[S3Explorer] Starting profile switch to: ${profile.displayName}`);
          setStatusMessage(`Switching to profile: ${profile.displayName}...`);
          setStatusMessageColor(CatppuccinMocha.blue);
          closeDialog();

          // Switch to the new profile
          await storage.switchProfile(profile.id);
          console.error(`[S3Explorer] Profile switched successfully`);

          // Get the new state from storage
          const newState = storage.state;
          console.error(`[S3Explorer] New state:`, {
            providerId: newState.providerId,
            currentPath: newState.currentPath,
            currentContainer: newState.currentContainer,
            entriesCount: newState.entries.length,
          });

          // Get current buffer state
          const currentBufferState = multiPaneLayout.getActiveBufferState() || bufferState;

          // Update bucket state based on new storage state
          if (newState.currentContainer) {
            console.error(`[S3Explorer] Setting bucket to: ${newState.currentContainer}`);
            setBucket(newState.currentContainer);
          } else {
            console.error(`[S3Explorer] Clearing bucket`);
            setBucket(undefined);
          }

          // Update buffer with new entries and path
          console.error(
            `[S3Explorer] Updating buffer state with ${newState.entries.length} entries`
          );
          currentBufferState.setEntries([...newState.entries]);
          currentBufferState.setCurrentPath(newState.currentPath);

          // Note: isInitialized is managed by useDataLoader hook
          // and will be set automatically when data loads

          console.error(`[S3Explorer] Profile switch UI update complete`);
          setStatusMessage(`Switched to profile: ${profile.displayName}`);
          setStatusMessageColor(CatppuccinMocha.green);
        } catch (err) {
          console.error('Failed to switch profile:', err);
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
    <S3ExplorerLayout
      bucket={bucket}
      isInitialized={isInitialized}
      bufferState={bufferState}
      activeBufferState={activeBufferState}
      multiPaneLayout={multiPaneLayout}
      terminalSize={terminalSize}
      layout={layout}
      statusBar={statusBarState}
      preview={previewState}
      dialogs={dialogsState}
      showErrorDialog={showErrorDialog}
    />
  );
}
