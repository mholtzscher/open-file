import { useMemo } from 'react';
import { CatppuccinMocha } from '../ui/theme.js';
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
}: UseS3ActionsProps) {
  return useMemo(() => {
    const getActiveBuffer = () => bufferState;

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
              setStatusMessageColor(CatppuccinMocha.blue);
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
            setStatusMessageColor(CatppuccinMocha.text);
            return;
          }

          const currentBufferState = getActiveBuffer();
          if (!bucket) {
            setStatusMessage('Already at root');
            setStatusMessageColor(CatppuccinMocha.text);
            return;
          }

          const currentPath = currentBufferState.currentPath;
          const { parentPath, atContainerRoot } = calculateParentPath(currentPath);

          if (atContainerRoot) {
            // Already at container root - go back to container listing
            setBucket(undefined);
            setStatusMessage('Back to bucket listing');
            setStatusMessageColor(CatppuccinMocha.blue);
          } else {
            await navigationHandlers.navigateToPath(parentPath);
            setStatusMessage(`Navigated to ${parentPath || 'bucket root'}`);
            setStatusMessageColor(CatppuccinMocha.green);
          }
        },

        'entry:delete': () => {
          if (!storage.hasCapability(Capability.Delete)) {
            setStatusMessage('Delete not supported by this storage provider');
            setStatusMessageColor(CatppuccinMocha.red);
            return;
          }

          const currentBufferState = getActiveBuffer();
          const selected = currentBufferState.getSelectedEntries();
          if (selected.length > 0) {
            currentBufferState.saveSnapshot();

            for (const entry of selected) {
              if (currentBufferState.isMarkedForDeletion(entry.id)) {
                currentBufferState.unmarkForDeletion(entry.id);
              } else {
                currentBufferState.markForDeletion(entry.id);
              }
            }

            if (currentBufferState.selection.isActive) {
              currentBufferState.exitVisualSelection();
            }

            const markedCount = currentBufferState.getMarkedForDeletion().length;
            if (markedCount > 0) {
              setStatusMessage(
                `${markedCount} item(s) marked for deletion. Press 'w' to save or 'u' to undo.`
              );
              setStatusMessageColor(CatppuccinMocha.yellow);
            } else {
              setStatusMessage('No items marked for deletion');
              setStatusMessageColor(CatppuccinMocha.text);
            }
          }
        },

        'entry:copy': () => {
          if (!storage.hasCapability(Capability.Copy)) {
            setStatusMessage('Copy not supported by this storage provider');
            setStatusMessageColor(CatppuccinMocha.red);
            return;
          }

          getActiveBuffer().copySelection();
          setStatusMessage('Copied');
          setStatusMessageColor(CatppuccinMocha.green);
        },

        'entry:paste': () => {
          if (!storage.hasCapability(Capability.Copy)) {
            setStatusMessage('Paste not supported by this storage provider');
            setStatusMessageColor(CatppuccinMocha.red);
            return;
          }

          // Paste is handled by buffer state
          setStatusMessage('Paste not yet implemented');
          setStatusMessageColor(CatppuccinMocha.yellow);
        },

        'entry:download': () => {
          const currentBufferState = getActiveBuffer();
          const currentEntry = currentBufferState.entries[currentBufferState.selection.cursorIndex];

          if (!currentEntry) {
            setStatusMessage('No entry selected');
            setStatusMessageColor(CatppuccinMocha.red);
            return;
          }

          if (!storage.hasCapability(Capability.Download)) {
            setStatusMessage('Download not supported by this storage provider');
            setStatusMessageColor(CatppuccinMocha.red);
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
            setStatusMessageColor(CatppuccinMocha.red);
            return;
          }

          showUpload();
        },

        // Mode changes
        'mode:insert': () => {
          if (!storage.hasCapability(Capability.Write)) {
            setStatusMessage('Create not supported by this storage provider');
            setStatusMessageColor(CatppuccinMocha.red);
            return;
          }

          getActiveBuffer().enterInsertMode();
          setStatusMessage('-- INSERT -- (type name, Enter to create, Esc to cancel)');
          setStatusMessageColor(CatppuccinMocha.blue);
        },

        'mode:edit': () => {
          if (!storage.hasCapability(Capability.Move)) {
            setStatusMessage('Rename not supported by this storage provider');
            setStatusMessageColor(CatppuccinMocha.red);
            return;
          }

          getActiveBuffer().enterEditMode();
          setStatusMessage('-- EDIT -- (type to rename, Enter to confirm, Esc to cancel)');
          setStatusMessageColor(CatppuccinMocha.blue);
        },

        'mode:search': () => {
          getActiveBuffer().enterSearchMode();
          setStatusMessage('Search mode: type pattern, n/N to navigate, ESC to clear');
          setStatusMessageColor(CatppuccinMocha.blue);
        },

        'mode:command': () => {
          getActiveBuffer().enterCommandMode();
          setStatusMessage(':');
          setStatusMessageColor(CatppuccinMocha.text);
        },

        'mode:visual': () => {
          getActiveBuffer().startVisualSelection();
          setStatusMessage('-- VISUAL --');
          setStatusMessageColor(CatppuccinMocha.blue);
        },

        'mode:normal': () => {
          const buf = getActiveBuffer();
          buf.exitVisualSelection();
          buf.exitSearchMode();
          buf.exitCommandMode();
          buf.exitInsertMode();
          buf.exitEditMode();
          setStatusMessage('');
          setStatusMessageColor(CatppuccinMocha.text);
        },

        // Dialogs
        'dialog:help': () => toggleHelp(),
        'dialog:sort': () => toggleSort(),
        'dialog:upload': () => {
          if (!storage.hasCapability(Capability.Upload)) {
            setStatusMessage('Upload not supported by this storage provider');
            setStatusMessageColor(CatppuccinMocha.red);
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
            setStatusMessageColor(CatppuccinMocha.yellow);
          }
        },

        // Buffer operations
        'buffer:save': () => {
          const currentBufferState = getActiveBuffer();
          const markedForDeletion = currentBufferState.getMarkedForDeletion();

          const deleteOperations: PendingOperation[] = markedForDeletion.map(entry => ({
            id: entry.id,
            type: 'delete',
            path: entry.path,
            entry,
          }));

          if (deleteOperations.length === 0) {
            setStatusMessage('No changes to save');
            setStatusMessageColor(CatppuccinMocha.text);
            return;
          }

          showConfirm(deleteOperations);
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
                  setStatusMessageColor(CatppuccinMocha.green);
                })
                .catch((err: unknown) => {
                  const parsedError = parseAwsError(err, 'Refresh failed');
                  setStatusMessage(formatErrorForDisplay(parsedError, 70));
                  setStatusMessageColor(CatppuccinMocha.red);
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
                setStatusMessageColor(CatppuccinMocha.green);
              })
              .catch((err: unknown) => {
                const parsedError = parseAwsError(err, 'Refresh failed');
                setStatusMessage(formatErrorForDisplay(parsedError, 70));
                setStatusMessageColor(CatppuccinMocha.red);
              });
          }
        },

        'buffer:undo': () => {
          const currentBufferState = getActiveBuffer();
          if (currentBufferState.undo()) {
            setStatusMessage('Undo');
            setStatusMessageColor(CatppuccinMocha.green);
          } else {
            setStatusMessage('Nothing to undo');
            setStatusMessageColor(CatppuccinMocha.yellow);
          }
        },

        'buffer:redo': () => {
          const currentBufferState = getActiveBuffer();
          if (currentBufferState.redo()) {
            setStatusMessage('Redo');
            setStatusMessageColor(CatppuccinMocha.green);
          } else {
            setStatusMessage('Nothing to redo');
            setStatusMessageColor(CatppuccinMocha.yellow);
          }
        },

        // Selection (visual mode)
        'select:extend:up': () => getActiveBuffer().extendVisualSelection('up'),
        'select:extend:down': () => getActiveBuffer().extendVisualSelection('down'),

        // Application
        'app:quit': () => {
          const currentBufferState = getActiveBuffer();
          const pendingChanges = currentBufferState.getMarkedForDeletion().length;

          if (pendingChanges > 0) {
            // Show quit confirmation dialog
            showQuit(pendingChanges);
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
          setStatusMessageColor(CatppuccinMocha.green);
        },

        // Connection operations
        'connection:reconnect': async () => {
          // Only for connection-oriented providers
          if (!storage.hasCapability(Capability.Connection)) {
            setStatusMessage('Reconnect not supported for this storage provider');
            setStatusMessageColor(CatppuccinMocha.yellow);
            return;
          }

          setStatusMessage('Reconnecting...');
          setStatusMessageColor(CatppuccinMocha.blue);

          try {
            await storage.connect();
            setStatusMessage('Reconnected successfully');
            setStatusMessageColor(CatppuccinMocha.green);

            // Refresh the current view after reconnecting
            const currentBufferState = getActiveBuffer();
            if (bucket) {
              const entries = await storage.list(currentBufferState.currentPath);
              currentBufferState.setEntries([...entries]);
              // setOriginalEntries removed from here
            } else if (storage.hasCapability(Capability.Containers)) {
              const entries = await storage.listContainers();
              currentBufferState.setEntries([...entries]);
            }
          } catch (err) {
            const parsedError = parseAwsError(err, 'Reconnect failed');
            setStatusMessage(formatErrorForDisplay(parsedError, 70));
            setStatusMessageColor(CatppuccinMocha.red);
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
              setStatusMessageColor(CatppuccinMocha.blue);
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
            setStatusMessageColor(CatppuccinMocha.blue);
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
                setStatusMessageColor(CatppuccinMocha.text);
              } else {
                setBucket(undefined);
                setStatusMessage('Switched to bucket listing');
                setStatusMessageColor(CatppuccinMocha.blue);
              }
            } else if (command.startsWith(':bucket ')) {
              const bucketName = command.substring(':bucket '.length).trim();
              if (bucketName) {
                storage.setContainer(bucketName).catch(err => {
                  console.error('Failed to set bucket:', err);
                });
                setBucket(bucketName);
                setStatusMessage(`Switched to bucket: ${bucketName}`);
                setStatusMessageColor(CatppuccinMocha.blue);
              }
            } else {
              setStatusMessage(`Unknown command: ${command}`);
              setStatusMessageColor(CatppuccinMocha.red);
            }
            buf.exitCommandMode();
          } else if (buf.mode === EditMode.Insert) {
            const entryName = buf.getEditBuffer().trim();
            if (entryName) {
              buf.saveSnapshot();
              const currentPath = buf.currentPath;
              const entryPath = currentPath ? `${currentPath}${entryName}` : entryName;
              const isDirectory = entryName.endsWith('/');

              const newEntry = {
                id: Math.random().toString(36),
                name: entryName.replace(/\/$/, ''),
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
              setStatusMessage(`Created ${isDirectory ? 'directory' : 'file'}: ${entryName}`);
              setStatusMessageColor(CatppuccinMocha.green);
            }
          } else if (buf.mode === EditMode.Edit) {
            const newName = buf.getEditBuffer().trim();
            if (newName && newName.length > 0) {
              const currentEntry = buf.getSelectedEntry();
              if (currentEntry) {
                const currentEntries = buf.entries;
                const updatedEntries = currentEntries.map(entry => {
                  if (entry.id === currentEntry.id) {
                    const isDirectory = newName.endsWith('/');
                    const cleanName = newName.replace(/\/$/, '');
                    const currentPath = buf.currentPath;
                    const newPath = currentPath ? `${currentPath}${cleanName}` : cleanName;

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
                setStatusMessage(`Renamed to: ${newName}`);
                setStatusMessageColor(CatppuccinMocha.green);
              }
            }
            buf.clearEditBuffer();
            buf.exitEditMode();
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
          setStatusMessageColor(CatppuccinMocha.text);
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
  }, [
    storage,
    bufferState,
    bucket,
    setBucket,
    previewMode,
    setPreviewMode,
    setStatusMessage,
    setStatusMessageColor,
    // setOriginalEntries removed
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
