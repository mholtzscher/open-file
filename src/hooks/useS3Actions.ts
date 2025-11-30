import { useMemo, useRef } from 'react';
import { Theme } from '../ui/theme.js';
import { parseAwsError, formatErrorForDisplay } from '../utils/errors.js';
import { calculateParentPath } from '../utils/path-utils.js';
import { Capability } from '../providers/types/capabilities.js';
import { Entry, EntryType } from '../types/entry.js';
import { EditMode } from '../types/edit-mode.js';
import { KeyAction, KeyboardKey } from '../types/keyboard.js';
import type { PendingOperation } from '../types/dialog.js';
import type { UseBufferStateReturn } from './useBufferState.js';
import type { UseNavigationHandlersReturn as NavigationHandlers } from './useNavigationHandlers.js';
import type { StorageContextValue } from '../contexts/StorageContext.js';
import type { UsePendingOperationsReturn } from './usePendingOperations.js';

interface UseS3ActionsProps {
  storage: StorageContextValue;
  bufferState: UseBufferStateReturn;
  bucket: string | undefined;
  setBucket: (bucket: string | undefined) => void;
  previewMode: boolean;
  setPreviewMode: (enabled: boolean) => void;
  setStatusMessage: (msg: string) => void;
  setStatusMessageColor: (color: string) => void;
  navigationHandlers: NavigationHandlers;
  showConfirm: (ops: PendingOperation[]) => void;
  showUpload: () => void;
  showQuit: (pendingChanges: number) => void;
  showProfileSelector: () => void;
  toggleHelp: () => void;
  toggleSort: () => void;
  closeDialog: () => void;
  /** Pending operations hook for global state management */
  pendingOps: UsePendingOperationsReturn;
}

export function useS3Actions({
  storage,
  bufferState,
  bucket,
  setBucket,
  previewMode,
  setPreviewMode,
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
}: UseS3ActionsProps) {
  // Use ref to always access the latest pendingOps without requiring re-memoization
  // This ensures handlers always use the current pendingOps even if called before
  // React's effect cleanup/setup cycle completes after a state change
  const pendingOpsRef = useRef(pendingOps);
  pendingOpsRef.current = pendingOps;

  return useMemo(() => {
    const getActiveBuffer = () => bufferState;
    // Access pendingOps through ref to always get the latest value
    const getPendingOps = () => pendingOpsRef.current;

    const actionHandlers: Partial<Record<KeyAction, (key?: KeyboardKey) => void | Promise<void>>> =
      {
        // Navigation
        'cursor:up': () => getActiveBuffer().moveCursorUp(1),
        'cursor:down': () => getActiveBuffer().moveCursorDown(1),
        'cursor:top': () => getActiveBuffer().cursorToTop(),
        'cursor:bottom': () => getActiveBuffer().cursorToBottom(),
        'cursor:pageUp': () => getActiveBuffer().moveCursorUp(10),
        'cursor:pageDown': () => getActiveBuffer().moveCursorDown(10),

        // Entry operations
        'entry:open': async () => {
          const currentBufferState = getActiveBuffer();
          const currentEntry = currentBufferState.entries[currentBufferState.selection.cursorIndex];

          if (!currentEntry) return;

          // Check if we're navigating into a bucket from root view
          if (!bucket && currentEntry.type === 'bucket') {
            const bucketName = currentEntry.name;
            const bucketRegion = currentEntry.metadata?.region || 'us-east-1';
            // Use path for providers that need full path (SFTP), name for others (S3)
            const containerIdentifier = currentEntry.path || bucketName;

            await storage.setContainer(containerIdentifier, bucketRegion);
            setBucket(bucketName);
            return;
          }

          // If it's a file, enable preview mode
          if (currentEntry.type === 'file') {
            if (!previewMode) {
              setPreviewMode(true);
              setStatusMessage('Preview enabled');
              setStatusMessageColor(Theme.getInfoColor());
            }
            return;
          }

          await navigationHandlers.navigateInto();
        },

        'entry:back': async () => {
          if (previewMode) {
            setPreviewMode(false);
            // Preview content will be cleared automatically by the hook when previewMode is false
            setStatusMessage('Preview closed');
            setStatusMessageColor(Theme.getTextColor());
            return;
          }

          const currentBufferState = getActiveBuffer();
          const currentPath = currentBufferState.currentPath;
          const { parentPath, atContainerRoot } = calculateParentPath(currentPath);

          // For container-based providers (S3, GCS), bucket must be set to navigate
          // For non-container providers (Local, SFTP), we navigate directly
          const hasContainers = storage.hasCapability(Capability.Containers);

          if (atContainerRoot) {
            if (hasContainers) {
              // Container-based provider at container root - go back to container listing
              setBucket(undefined);
              setStatusMessage('Back to bucket listing');
              setStatusMessageColor(Theme.getInfoColor());
            } else {
              // Non-container provider at root - can't go further up
              setStatusMessage('Already at root');
              setStatusMessageColor(Theme.getTextColor());
            }
          } else {
            await navigationHandlers.navigateToPath(parentPath);
            setStatusMessage(`Navigated to ${parentPath || 'root'}`);
            setStatusMessageColor(Theme.getSuccessColor());
          }
        },

        'entry:delete': () => {
          if (!storage.hasCapability(Capability.Delete)) {
            setStatusMessage('Delete not supported by this storage provider');
            setStatusMessageColor(Theme.getErrorColor());
            return;
          }

          const currentBufferState = getActiveBuffer();
          const selected = currentBufferState.getSelectedEntries();
          if (selected.length > 0) {
            for (const entry of selected) {
              getPendingOps().toggleDeletion(entry);
            }

            if (currentBufferState.selection.isActive) {
              currentBufferState.exitVisualSelection();
            }

            // getMarkedForDeletion reads directly from store, so it returns immediate state
            const markedCount = getPendingOps().getMarkedForDeletion().length;
            if (markedCount > 0) {
              setStatusMessage(
                `${markedCount} item(s) marked for deletion. Press 'w' to save or 'u' to undo.`
              );
              setStatusMessageColor(Theme.getWarningColor());
            } else {
              setStatusMessage('No items marked for deletion');
              setStatusMessageColor(Theme.getTextColor());
            }
          }
        },

        'entry:cut': () => {
          if (!storage.hasCapability(Capability.Move)) {
            setStatusMessage('Move not supported by this storage provider');
            setStatusMessageColor(Theme.getErrorColor());
            return;
          }

          const currentBufferState = getActiveBuffer();
          const selected = currentBufferState.getSelectedEntries();

          if (selected.length === 0) {
            setStatusMessage('No entries selected');
            setStatusMessageColor(Theme.getWarningColor());
            return;
          }

          if (pendingOps) {
            getPendingOps().cut(selected);
            // Always exit visual mode and return to normal after cut
            currentBufferState.exitVisualSelection();
            currentBufferState.setMode(EditMode.Normal);
            setStatusMessage(`Cut ${selected.length} item(s) - navigate and press 'p' to move`);
            setStatusMessageColor(Theme.getInfoColor());
          } else {
            setStatusMessage('Cut not available (pending ops not initialized)');
            setStatusMessageColor(Theme.getWarningColor());
          }
        },

        'entry:copy': () => {
          if (!storage.hasCapability(Capability.Copy)) {
            setStatusMessage('Copy not supported by this storage provider');
            setStatusMessageColor(Theme.getErrorColor());
            return;
          }

          const currentBufferState = getActiveBuffer();
          const selected = currentBufferState.getSelectedEntries();

          if (selected.length === 0) {
            setStatusMessage('No entries selected');
            setStatusMessageColor(Theme.getWarningColor());
            return;
          }

          if (pendingOps) {
            getPendingOps().copy(selected);
            // Always exit visual mode and return to normal after copy
            currentBufferState.exitVisualSelection();
            currentBufferState.setMode(EditMode.Normal);
            setStatusMessage(`Copied ${selected.length} item(s) - navigate and press 'p' to paste`);
            setStatusMessageColor(Theme.getInfoColor());
          } else {
            // Fallback to old behavior
            currentBufferState.copySelection();
            // Also exit visual mode in fallback
            currentBufferState.exitVisualSelection();
            currentBufferState.setMode(EditMode.Normal);
            setStatusMessage('Copied');
            setStatusMessageColor(Theme.getSuccessColor());
          }
        },

        'entry:paste': () => {
          const currentBufferState = getActiveBuffer();

          if (pendingOps) {
            if (!getPendingOps().hasClipboardContent) {
              setStatusMessage('Nothing to paste - cut or copy first');
              setStatusMessageColor(Theme.getWarningColor());
              return;
            }

            const isCut = getPendingOps().isClipboardCut;
            if (isCut && !storage.hasCapability(Capability.Move)) {
              setStatusMessage('Move not supported by this storage provider');
              setStatusMessageColor(Theme.getErrorColor());
              return;
            }
            if (!isCut && !storage.hasCapability(Capability.Copy)) {
              setStatusMessage('Copy not supported by this storage provider');
              setStatusMessageColor(Theme.getErrorColor());
              return;
            }

            getPendingOps().paste(currentBufferState.currentPath);
            const opType = isCut ? 'move' : 'copy';
            setStatusMessage(`Pending ${opType} operation(s) added. Press 'w' to save.`);
            setStatusMessageColor(Theme.getWarningColor());
          } else {
            setStatusMessage('Paste not yet implemented');
            setStatusMessageColor(Theme.getWarningColor());
          }
        },

        'entry:download': () => {
          const currentBufferState = getActiveBuffer();
          const currentEntry = currentBufferState.entries[currentBufferState.selection.cursorIndex];

          if (!currentEntry) {
            setStatusMessage('No entry selected');
            setStatusMessageColor(Theme.getErrorColor());
            return;
          }

          if (!storage.hasCapability(Capability.Download)) {
            setStatusMessage('Download not supported by this storage provider');
            setStatusMessageColor(Theme.getErrorColor());
            return;
          }

          const s3Path = currentBufferState.currentPath
            ? `${currentBufferState.currentPath}${currentEntry.name}`
            : currentEntry.name;
          const localPath = currentEntry.name;

          const operation: PendingOperation = {
            id: Math.random().toString(36),
            type: 'download',
            source: s3Path,
            destination: localPath,
            entry: currentEntry,
            recursive: currentEntry.type === 'directory',
          };

          showConfirm([operation]);
        },

        'entry:upload': () => {
          if (!storage.hasCapability(Capability.Upload)) {
            setStatusMessage('Upload not supported by this storage provider');
            setStatusMessageColor(Theme.getErrorColor());
            return;
          }

          showUpload();
        },

        // Mode changes
        'mode:insert': () => {
          if (!storage.hasCapability(Capability.Write)) {
            setStatusMessage('Create not supported by this storage provider');
            setStatusMessageColor(Theme.getErrorColor());
            return;
          }

          getActiveBuffer().enterInsertMode();
          setStatusMessage('-- INSERT -- (type name, Enter to create, Esc to cancel)');
          setStatusMessageColor(Theme.getInfoColor());
        },

        'mode:edit': () => {
          if (!storage.hasCapability(Capability.Move)) {
            setStatusMessage('Rename not supported by this storage provider');
            setStatusMessageColor(Theme.getErrorColor());
            return;
          }

          getActiveBuffer().enterEditMode();
          setStatusMessage('-- EDIT -- (type to rename, Enter to confirm, Esc to cancel)');
          setStatusMessageColor(Theme.getInfoColor());
        },

        'mode:search': () => {
          getActiveBuffer().enterSearchMode();
          setStatusMessage('Search mode: type pattern, n/N to navigate, ESC to clear');
          setStatusMessageColor(Theme.getInfoColor());
        },

        'mode:command': () => {
          getActiveBuffer().enterCommandMode();
          setStatusMessage(':');
          setStatusMessageColor(Theme.getTextColor());
        },

        'mode:visual': () => {
          getActiveBuffer().startVisualSelection();
          setStatusMessage('-- VISUAL --');
          setStatusMessageColor(Theme.getInfoColor());
        },

        'mode:normal': () => {
          const buf = getActiveBuffer();
          buf.exitVisualSelection();
          buf.exitSearchMode();
          buf.exitCommandMode();
          buf.exitInsertMode();
          buf.exitEditMode();
          setStatusMessage('');
          setStatusMessageColor(Theme.getTextColor());
        },

        // Dialogs
        'dialog:help': () => toggleHelp(),
        'dialog:sort': () => toggleSort(),
        'dialog:upload': () => {
          if (!storage.hasCapability(Capability.Upload)) {
            setStatusMessage('Upload not supported by this storage provider');
            setStatusMessageColor(Theme.getErrorColor());
            return;
          }

          showUpload();
        },
        'dialog:profileSelector': () => {
          const profileManager = storage.getProfileManager();
          if (profileManager) {
            showProfileSelector();
          } else {
            setStatusMessage('Profile selector not available (multi-provider system not enabled)');
            setStatusMessageColor(Theme.getWarningColor());
          }
        },

        // Buffer operations
        'buffer:save': () => {
          if (!getPendingOps().hasPendingChanges) {
            setStatusMessage('No changes to save');
            setStatusMessageColor(Theme.getTextColor());
            return;
          }

          // Convert store operations to dialog PendingOperation format
          const storeOps = getPendingOps().operations;
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
                  destination: op.destUri.split('/').slice(3).join('/'), // Extract path from URI
                  entry: op.entry,
                  recursive: op.entry.type === EntryType.Directory,
                };
              case 'copy':
                return {
                  id: op.id,
                  type: 'copy' as const,
                  source: op.entry.path,
                  destination: op.destUri.split('/').slice(3).join('/'), // Extract path from URI
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
                  path: op.uri.split('/').slice(3).join('/'), // Extract path from URI
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

          showConfirm(dialogOps);
        },

        'buffer:refresh': () => {
          const currentBufferState = getActiveBuffer();

          if (!bucket) {
            if (storage.hasCapability(Capability.Containers)) {
              storage
                .listContainers()
                .then((entries: Entry[]) => {
                  currentBufferState.setEntries([...entries]);
                  setStatusMessage(`Refreshed: ${entries.length} bucket(s)`);
                  setStatusMessageColor(Theme.getSuccessColor());
                })
                .catch((err: unknown) => {
                  const parsedError = parseAwsError(err, 'Refresh failed');
                  setStatusMessage(formatErrorForDisplay(parsedError, 70));
                  setStatusMessageColor(Theme.getErrorColor());
                });
            } else {
              // Non-container providers - refresh root directory
              const currentPath = currentBufferState.currentPath;
              storage
                .list(currentPath)
                .then(entries => {
                  currentBufferState.setEntries([...entries]);
                  setStatusMessage(`Refreshed: ${entries.length} items`);
                  setStatusMessageColor(Theme.getSuccessColor());
                })
                .catch((err: unknown) => {
                  const parsedError = parseAwsError(err, 'Refresh failed');
                  setStatusMessage(formatErrorForDisplay(parsedError, 70));
                  setStatusMessageColor(Theme.getErrorColor());
                });
            }
          } else {
            const currentPath = currentBufferState.currentPath;
            storage
              .list(currentPath)
              .then(entries => {
                currentBufferState.setEntries([...entries]);
                // setOriginalEntries removed from here
                setStatusMessage('Refreshed');
                setStatusMessageColor(Theme.getSuccessColor());
              })
              .catch((err: unknown) => {
                const parsedError = parseAwsError(err, 'Refresh failed');
                setStatusMessage(formatErrorForDisplay(parsedError, 70));
                setStatusMessageColor(Theme.getErrorColor());
              });
          }
        },

        'buffer:undo': () => {
          if (getPendingOps().undo()) {
            setStatusMessage('Undo');
            setStatusMessageColor(Theme.getSuccessColor());
          } else {
            setStatusMessage('Nothing to undo');
            setStatusMessageColor(Theme.getWarningColor());
          }
        },

        'buffer:redo': () => {
          if (getPendingOps().redo()) {
            setStatusMessage('Redo');
            setStatusMessageColor(Theme.getSuccessColor());
          } else {
            setStatusMessage('Nothing to redo');
            setStatusMessageColor(Theme.getWarningColor());
          }
        },

        // Selection (visual mode)
        'select:extend:up': () => getActiveBuffer().extendVisualSelection('up'),
        'select:extend:down': () => getActiveBuffer().extendVisualSelection('down'),

        // Application
        'app:quit': () => {
          if (getPendingOps().pendingCount > 0) {
            // Show quit confirmation dialog
            showQuit(getPendingOps().pendingCount);
            return;
          }

          // No pending changes - quit immediately
          process.exit(0);
        },

        'app:toggleHidden': () => {
          const currentBufferState = getActiveBuffer();
          currentBufferState.toggleHiddenFiles();
          const state = currentBufferState.showHiddenFiles;
          setStatusMessage(state ? 'Showing hidden files' : 'Hiding hidden files');
          setStatusMessageColor(Theme.getSuccessColor());
        },

        // Connection operations
        'connection:reconnect': async () => {
          // Only for connection-oriented providers
          if (!storage.hasCapability(Capability.Connection)) {
            setStatusMessage('Reconnect not supported for this storage provider');
            setStatusMessageColor(Theme.getWarningColor());
            return;
          }

          setStatusMessage('Reconnecting...');
          setStatusMessageColor(Theme.getInfoColor());

          try {
            await storage.connect();
            setStatusMessage('Reconnected successfully');
            setStatusMessageColor(Theme.getSuccessColor());

            // Refresh the current view after reconnecting
            const currentBufferState = getActiveBuffer();
            if (bucket) {
              const entries = await storage.list(currentBufferState.currentPath);
              currentBufferState.setEntries([...entries]);
              // setOriginalEntries removed from here
            } else if (storage.hasCapability(Capability.Containers)) {
              const entries = await storage.listContainers();
              currentBufferState.setEntries([...entries]);
            } else {
              // Non-container providers - list root directory
              const entries = await storage.list(currentBufferState.currentPath);
              currentBufferState.setEntries([...entries]);
            }
          } catch (err) {
            const parsedError = parseAwsError(err, 'Reconnect failed');
            setStatusMessage(formatErrorForDisplay(parsedError, 70));
            setStatusMessageColor(Theme.getErrorColor());
          }
        },

        // Text input handlers
        'input:char': (key?: KeyboardKey) => {
          const buf = getActiveBuffer();
          if (key?.char && key.char.length === 1) {
            if (buf.mode === EditMode.Search) {
              const currentQuery = buf.searchQuery || '';
              buf.updateSearchQuery(currentQuery + key.char);
              setStatusMessage(`Searching: ${currentQuery + key.char}`);
              setStatusMessageColor(Theme.getInfoColor());
            } else if (buf.mode === EditMode.Command) {
              buf.appendToEditBuffer(key.char);
            } else if (buf.mode === EditMode.Insert || buf.mode === EditMode.Edit) {
              if (key.char.match(/[a-zA-Z0-9._\-\s/]/)) {
                buf.appendToEditBuffer(key.char);
              }
            }
          }
        },

        'input:backspace': () => {
          const buf = getActiveBuffer();
          if (buf.mode === EditMode.Search) {
            const currentQuery = buf.searchQuery || '';
            buf.updateSearchQuery(currentQuery.slice(0, -1));
            setStatusMessage(`Searching: ${currentQuery.slice(0, -1)}`);
            setStatusMessageColor(Theme.getInfoColor());
          } else {
            buf.backspaceEditBuffer();
          }
        },

        'input:confirm': () => {
          const buf = getActiveBuffer();
          if (buf.mode === EditMode.Command) {
            const command = buf.getEditBuffer().trim();
            if (command === ':w') {
              actionHandlers['buffer:save']?.();
            } else if (command === ':q') {
              actionHandlers['app:quit']?.();
            } else if (command === ':buckets') {
              if (!bucket) {
                setStatusMessage('Already viewing buckets');
                setStatusMessageColor(Theme.getTextColor());
              } else {
                setBucket(undefined);
                setStatusMessage('Switched to bucket listing');
                setStatusMessageColor(Theme.getInfoColor());
              }
            } else if (command.startsWith(':bucket ')) {
              const bucketName = command.substring(':bucket '.length).trim();
              if (bucketName) {
                storage.setContainer(bucketName).catch(err => {
                  console.error('Failed to set bucket:', err);
                });
                setBucket(bucketName);
                setStatusMessage(`Switched to bucket: ${bucketName}`);
                setStatusMessageColor(Theme.getInfoColor());
              }
            } else {
              setStatusMessage(`Unknown command: ${command}`);
              setStatusMessageColor(Theme.getErrorColor());
            }
            buf.exitCommandMode();
          } else if (buf.mode === EditMode.Insert) {
            const entryName = buf.getEditBuffer().trim();
            if (entryName) {
              const currentPath = buf.currentPath;
              const isDirectory = entryName.endsWith('/');
              const cleanName = entryName.replace(/\/$/, '');

              if (pendingOps) {
                // Add to pending operations store
                getPendingOps().create(
                  currentPath,
                  cleanName,
                  isDirectory ? EntryType.Directory : EntryType.File
                );
                buf.clearEditBuffer();
                buf.exitInsertMode();
                setStatusMessage(`Pending create: ${cleanName}. Press 'w' to save.`);
                setStatusMessageColor(Theme.getWarningColor());
              } else {
                // Fallback: add to buffer directly (won't persist)
                buf.saveSnapshot();
                const entryPath = currentPath ? `${currentPath}${entryName}` : entryName;

                const newEntry = {
                  id: Math.random().toString(36),
                  name: cleanName,
                  type: isDirectory ? EntryType.Directory : EntryType.File,
                  path: entryPath,
                  modified: new Date(),
                };

                const insertIndex = buf.selection.cursorIndex + 1;
                const currentEntries = [...buf.entries];
                currentEntries.splice(insertIndex, 0, newEntry);
                buf.setEntries(currentEntries);

                buf.clearEditBuffer();
                buf.exitInsertMode();
                setStatusMessage(
                  `Created ${isDirectory ? 'directory' : 'file'}: ${entryName} (local only)`
                );
                setStatusMessageColor(Theme.getSuccessColor());
              }
            }
          } else if (buf.mode === EditMode.Edit) {
            const newName = buf.getEditBuffer().trim();
            if (newName && newName.length > 0) {
              const currentEntry = buf.getSelectedEntry();
              if (currentEntry) {
                const cleanName = newName.replace(/\/$/, '');

                if (pendingOps) {
                  // Add rename to pending operations store
                  getPendingOps().rename(currentEntry, cleanName);
                  buf.clearEditBuffer();
                  buf.exitEditMode();
                  setStatusMessage(
                    `Pending rename: ${currentEntry.name} → ${cleanName}. Press 'w' to save.`
                  );
                  setStatusMessageColor(Theme.getWarningColor());
                } else {
                  // Fallback: modify buffer directly (won't persist)
                  const currentEntries = buf.entries;
                  const isDirectory = newName.endsWith('/');
                  const currentPath = buf.currentPath;
                  const newPath = currentPath ? `${currentPath}${cleanName}` : cleanName;

                  const updatedEntries = currentEntries.map(entry => {
                    if (entry.id === currentEntry.id) {
                      return {
                        ...entry,
                        name: cleanName,
                        path: newPath,
                        type: isDirectory ? EntryType.Directory : EntryType.File,
                      };
                    }
                    return entry;
                  });
                  buf.setEntries(updatedEntries);
                  buf.clearEditBuffer();
                  buf.exitEditMode();
                  setStatusMessage(`Renamed to: ${newName} (local only)`);
                  setStatusMessageColor(Theme.getSuccessColor());
                }
              }
            } else {
              buf.clearEditBuffer();
              buf.exitEditMode();
            }
          }
        },

        'input:cancel': () => {
          const buf = getActiveBuffer();
          buf.clearEditBuffer();
          if (buf.mode === EditMode.Search) {
            buf.exitSearchMode();
            buf.cursorToTop();
          } else if (buf.mode === EditMode.Command) {
            buf.exitCommandMode();
          } else if (buf.mode === EditMode.Insert) {
            buf.exitInsertMode();
          } else if (buf.mode === EditMode.Edit) {
            buf.exitEditMode();
          }
          setStatusMessage('');
          setStatusMessageColor(Theme.getTextColor());
        },

        'input:tab': () => {
          const buf = getActiveBuffer();
          if (buf.mode === EditMode.Insert) {
            const currentInput = buf.getEditBuffer().trim().toLowerCase();
            if (currentInput) {
              const matching = buf.entries
                .filter(e => e.name.toLowerCase().startsWith(currentInput))
                .map(e => e.name);

              if (matching.length > 0) {
                buf.setEditBuffer(matching[0]);
              }
            }
          }
        },
      };

    return actionHandlers;
    // Note: pendingOps is accessed via pendingOpsRef, so it's not in the dependency array.
    // This ensures handlers always use the latest pendingOps value without needing to
    // re-create the entire actionHandlers object when pendingOps changes.
  }, [
    storage,
    bufferState,
    bucket,
    setBucket,
    previewMode,
    setPreviewMode,
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
  ]);
}
