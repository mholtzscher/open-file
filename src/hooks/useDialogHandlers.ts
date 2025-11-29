/**
 * useDialogHandlers Hook
 *
 * Builds the DialogsState object for FileExplorerDialogs component.
 * Extracts dialog handler logic from FileExplorer to reduce component size.
 */

import { useCallback, useRef } from 'react';
import { DialogsState } from '../ui/file-explorer-dialogs.js';
import { CatppuccinMocha } from '../ui/theme.js';
import { Entry, EntryType } from '../types/entry.js';
import { SortField, SortOrder } from '../utils/sorting.js';
import type { PendingOperation, DialogState } from '../types/dialog.js';
import type { UseBufferStateReturn } from './useBufferState.js';
import type { StorageContextValue } from '../contexts/StorageContext.js';

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
            currentBufferState.clearDeletionMarks();
            setStatusMessage(message);
            setStatusMessageColor(CatppuccinMocha.green);

            if (quitAfterSaveRef.current) {
              quitAfterSaveRef.current = false;
              process.exit(0);
            }
          } catch {
            setStatusMessage('Operations completed but failed to reload buffer');
            setStatusMessageColor(CatppuccinMocha.yellow);
          }
        })();
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
    bufferStateRef,
    closeAndClearOperations,
    executeOperationsWithProgress,
    setStatusMessage,
    setStatusMessageColor,
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
        const markedForDeletion = bufferState.getMarkedForDeletion();

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

  return dialogsState;
}
