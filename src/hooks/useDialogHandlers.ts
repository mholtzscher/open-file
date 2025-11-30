/**
 * useDialogHandlers Hook
 *
 * Builds the DialogsState object for FileExplorerDialogs component.
 * Extracts dialog handler logic from FileExplorer to reduce component size.
 */

import { useCallback, useRef } from 'react';
import { DialogsState } from '../ui/file-explorer-dialogs.js';
import { Theme } from '../ui/theme.js';
import { Entry, EntryType } from '../types/entry.js';
import { SortField, SortOrder } from '../utils/sorting.js';
import type { PendingOperation, DialogState } from '../types/dialog.js';
import type { UseBufferStateReturn } from './useBufferState.js';
import type { StorageContextValue } from '../contexts/StorageContext.js';
import type { UsePendingOperationsReturn } from './usePendingOperations.js';

/**
 * Progress state from useOperationExecutor
 */
export interface ProgressState {
  visible: boolean;
  title: string;
  description: string;
  value: number;
  currentFile: string;
  currentNum: number;
  totalNum: number;
  cancellable: boolean;
}

/**
 * Props for the useDialogHandlers hook
 */
export interface UseDialogHandlersProps {
  // State
  bufferState: UseBufferStateReturn;
  bufferStateRef: React.RefObject<UseBufferStateReturn>;
  storage: StorageContextValue;
  dialogState: DialogState;
  pendingOperations: PendingOperation[];
  progressState: ProgressState;

  // Dialog visibility
  showConfirmDialog: boolean;
  showHelpDialog: boolean;
  showSortMenu: boolean;
  showUploadDialog: boolean;
  showQuitDialog: boolean;
  showProfileSelectorDialog: boolean;
  showThemeSelectorDialog: boolean;
  showErrorDialog: boolean;
  statusMessage: string;

  // Dialog actions
  showConfirm: (operations: PendingOperation[]) => void;
  closeDialog: () => void;
  closeAndClearOperations: () => void;

  // Status message
  setStatusMessage: (message: string) => void;
  setStatusMessageColor: (color: string) => void;

  // Bucket state
  setBucket: (bucket: string | undefined) => void;

  // Operation handlers
  executeOperationsWithProgress: (
    operations: PendingOperation[],
    callbacks?: {
      onSuccess?: (result: unknown, message: string) => void;
      onError?: (message: string) => void;
      onCancelled?: (message: string) => void;
      onComplete?: () => void;
    }
  ) => Promise<unknown>;
  handleCancelOperation: () => void;

  /** Pending operations hook for global state management */
  pendingOps: UsePendingOperationsReturn;
}

let onNextSaveComplete: (() => void) | null = null;

export function setOnNextSaveComplete(callback: (() => void) | null) {
  onNextSaveComplete = callback;
}

/**
 * Hook that builds DialogsState for the FileExplorerDialogs component
 */
export function useDialogHandlers({
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
  pendingOps,
}: UseDialogHandlersProps): DialogsState {
  // Ref to track if we should quit after saving
  const quitAfterSaveRef = useRef(false);

  // ============================================
  // Confirm Handler
  // ============================================
  const createConfirmHandler = useCallback(async () => {
    await executeOperationsWithProgress(pendingOperations, {
      onSuccess: (_result, message) => {
        // Handle success asynchronously but don't block
        (async () => {
          try {
            const currentBufferState = bufferStateRef.current;

            const entries = await storage.list(currentBufferState.currentPath);
            currentBufferState.setEntries([...entries]);

            // Clear pending operations after successful save
            pendingOps.discard();

            setStatusMessage(message);
            setStatusMessageColor(Theme.getSuccessColor());

            if (quitAfterSaveRef.current) {
              quitAfterSaveRef.current = false;
              process.exit(0);
            }

            if (onNextSaveComplete) {
              const callback = onNextSaveComplete;
              onNextSaveComplete = null;
              callback();
            }
          } catch {
            setStatusMessage('Operations completed but failed to reload buffer');
            setStatusMessageColor(Theme.getWarningColor());
          }
        })();
      },
      onError: message => {
        setStatusMessage(message);
        setStatusMessageColor(Theme.getErrorColor());
        onNextSaveComplete = null;
      },
      onCancelled: message => {
        setStatusMessage(message);
        setStatusMessageColor(Theme.getWarningColor());
        onNextSaveComplete = null;
      },
      onComplete: () => {
        closeAndClearOperations();
      },
    });
  }, [
    pendingOperations,
    storage,
    bufferStateRef,
    closeAndClearOperations,
    executeOperationsWithProgress,
    setStatusMessage,
    setStatusMessageColor,
    pendingOps,
  ]);

  // ============================================
  // Build DialogsState
  // ============================================
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
        setStatusMessageColor(Theme.getTextColor());
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
        setStatusMessageColor(Theme.getSuccessColor());
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
        setStatusMessageColor(Theme.getSuccessColor());
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
        pendingOps.discard();
        process.exit(0);
      },
      onSaveAndQuit: () => {
        // Get all pending operations
        const storeOps = pendingOps.operations;

        if (storeOps.length > 0) {
          // Convert store operations to dialog PendingOperation format
          const dialogOps: PendingOperation[] = storeOps.map(op => {
            switch (op.type) {
              case 'delete':
                return {
                  id: op.id,
                  type: 'delete' as const,
                  path: op.entry.path,
                  entry: op.entry,
                };
              case 'move':
                return {
                  id: op.id,
                  type: 'move' as const,
                  source: op.entry.path,
                  destination: op.destUri.split('/').slice(3).join('/'),
                  entry: op.entry,
                  recursive: op.entry.type === EntryType.Directory,
                };
              case 'copy':
                return {
                  id: op.id,
                  type: 'copy' as const,
                  source: op.entry.path,
                  destination: op.destUri.split('/').slice(3).join('/'),
                  entry: op.entry,
                  recursive: op.entry.type === EntryType.Directory,
                };
              case 'rename':
                return {
                  id: op.id,
                  type: 'rename' as const,
                  path: op.entry.path,
                  newName: op.newName,
                  entry: op.entry,
                };
              case 'create':
                return {
                  id: op.id,
                  type: 'create' as const,
                  path: op.uri.split('/').slice(3).join('/'),
                  entryType: op.entryType === EntryType.Directory ? 'directory' : 'file',
                  entry: {
                    id: op.id,
                    name: op.name,
                    type: op.entryType,
                    path: op.uri.split('/').slice(3).join('/'),
                  },
                };
            }
          });

          quitAfterSaveRef.current = true;
          closeDialog();
          showConfirm(dialogOps);
        } else {
          process.exit(0);
        }
      },
      onCancel: () => {
        closeDialog();
        setStatusMessage('Quit cancelled');
        setStatusMessageColor(Theme.getTextColor());
      },
    },
    profileSelector: {
      visible: showProfileSelectorDialog,
      profileManager: storage.getProfileManager(),
      currentProfileId: storage.state.profileId,
      onProfileSelect: async profile => {
        try {
          setStatusMessage(`Switching to profile: ${profile.displayName}...`);
          setStatusMessageColor(Theme.getInfoColor());
          closeDialog();

          await storage.switchProfile(profile.id);

          const newState = storage.state;

          if (newState.currentContainer) {
            setBucket(newState.currentContainer);
          } else {
            setBucket(undefined);
          }

          bufferState.setEntries([...newState.entries]);
          bufferState.setCurrentPath(newState.currentPath);

          setStatusMessage(`Switched to profile: ${profile.displayName}`);
          setStatusMessageColor(Theme.getSuccessColor());
        } catch (err) {
          setStatusMessage(
            `Failed to switch profile: ${err instanceof Error ? err.message : 'Unknown error'}`
          );
          setStatusMessageColor(Theme.getErrorColor());
        }
      },
      onCancel: () => closeDialog(),
    },
    themeSelector: {
      visible: showThemeSelectorDialog,
      onClose: () => closeDialog(),
    },
  };

  return dialogsState;
}
