/**
 * useExplorerActions Hook
 *
 * Action handlers for file explorer operations.
 * Uses immediate execution model - operations execute right away with confirmation
 * dialogs for destructive actions.
 */

import { useMemo, useRef } from 'react';
import { Theme } from '../ui/theme.js';
import { parseAwsError, formatErrorForDisplay } from '../utils/errors.js';
import { calculateParentPath } from '../utils/path-utils.js';
import { Capability } from '../providers/types/capabilities.js';
import { Entry } from '../types/entry.js';
import { EditMode } from '../types/edit-mode.js';
import { KeyAction, KeyboardKey } from '../types/keyboard.js';
import type { PendingOperation } from '../types/dialog.js';
import type { UseBufferStateReturn } from './useBufferState.js';
import type { UseNavigationHandlersReturn as NavigationHandlers } from './useNavigationHandlers.js';
import type { StorageContextValue } from '../contexts/StorageContext.js';
import type { UseClipboardReturn } from './useClipboard.js';
import type { UseImmediateExecutionReturn } from './useImmediateExecution.js';

export interface UseExplorerActionsProps {
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
  showProfileSelector: () => void;
  showThemeSelector: () => void;
  toggleHelp: () => void;
  toggleSort: () => void;
  closeDialog: () => void;
  /** Clipboard hook for copy/paste operations */
  clipboard: UseClipboardReturn;
  /** Immediate execution hook for operations */
  immediateExecution: UseImmediateExecutionReturn;
  /** Refresh the current directory listing */
  refreshListing: () => Promise<void>;
}

export function useExplorerActions({
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
  showProfileSelector,
  showThemeSelector,
  toggleHelp,
  toggleSort,
  closeDialog,
  clipboard,
  immediateExecution,
  refreshListing,
}: UseExplorerActionsProps) {
  // Use refs to always access latest values without requiring re-memoization
  const clipboardRef = useRef(clipboard);
  clipboardRef.current = clipboard;

  const immediateExecutionRef = useRef(immediateExecution);
  immediateExecutionRef.current = immediateExecution;

  return useMemo(() => {
    const getActiveBuffer = () => bufferState;
    const getClipboard = () => clipboardRef.current;
    const getExecution = () => immediateExecutionRef.current;

    /**
     * Generate a unique operation ID
     */
    const generateOpId = (): string => {
      return `op-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    };

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
            // Use path for providers that need full path (SFTP), name for others (S3)
            const containerIdentifier = currentEntry.path || bucketName;

            await storage.setContainer(containerIdentifier);
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
            setStatusMessage('Preview closed');
            setStatusMessageColor(Theme.getTextColor());
            return;
          }

          const currentBufferState = getActiveBuffer();
          const currentPath = currentBufferState.currentPath;
          const { parentPath, atContainerRoot } = calculateParentPath(currentPath);

          const hasContainers = storage.hasCapability(Capability.Containers);

          if (atContainerRoot) {
            if (hasContainers) {
              setBucket(undefined);
              setStatusMessage('Back to bucket listing');
              setStatusMessageColor(Theme.getInfoColor());
            } else {
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

          if (selected.length === 0) {
            setStatusMessage('No entries selected');
            setStatusMessageColor(Theme.getWarningColor());
            return;
          }

          // Exit visual mode if active
          if (currentBufferState.selection.isActive) {
            currentBufferState.exitVisualSelection();
          }

          // Build operations for confirmation dialog
          const operations: PendingOperation[] = selected.map(entry => ({
            id: generateOpId(),
            type: 'delete' as const,
            path: entry.path,
            entry,
            recursive: entry.type === 'directory',
          }));

          // Show confirmation dialog
          showConfirm(operations);
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

          // Copy to clipboard
          getClipboard().copy(selected);

          // Exit visual mode and return to normal
          currentBufferState.exitVisualSelection();
          currentBufferState.setMode(EditMode.Normal);

          setStatusMessage(`Copied ${selected.length} item(s) - navigate and press 'p' to paste`);
          setStatusMessageColor(Theme.getInfoColor());
        },

        'entry:paste': async () => {
          const currentBufferState = getActiveBuffer();
          const clipboardState = getClipboard();

          if (!clipboardState.hasContent || !clipboardState.clipboard) {
            setStatusMessage('Nothing to paste - copy first with yy');
            setStatusMessageColor(Theme.getWarningColor());
            return;
          }

          if (!storage.hasCapability(Capability.Copy)) {
            setStatusMessage('Copy not supported by this storage provider');
            setStatusMessageColor(Theme.getErrorColor());
            return;
          }

          const { entries, sourcePaths } = clipboardState.clipboard;
          const destinationPath = currentBufferState.currentPath;

          setStatusMessage('Copying...');
          setStatusMessageColor(Theme.getInfoColor());

          await getExecution().executeCopies(entries, sourcePaths, destinationPath, {
            onSuccess: msg => {
              setStatusMessage(msg);
              setStatusMessageColor(Theme.getSuccessColor());
              refreshListing();
            },
            onError: msg => {
              setStatusMessage(msg);
              setStatusMessageColor(Theme.getErrorColor());
              refreshListing(); // Still refresh to show actual state
            },
            onCancelled: msg => {
              setStatusMessage(msg);
              setStatusMessageColor(Theme.getWarningColor());
              refreshListing();
            },
          });
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
            id: generateOpId(),
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
          const buf = getActiveBuffer();
          const currentEntry = buf.getSelectedEntry();
          if (currentEntry) {
            buf.enterEditMode(currentEntry.name);
          } else {
            buf.enterEditMode('');
          }
          setStatusMessage('');
        },

        'mode:search': () => {
          getActiveBuffer().enterSearchMode();
          setStatusMessage('');
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

        // Selection (visual mode)
        'select:extend:up': () => getActiveBuffer().extendVisualSelection('up'),
        'select:extend:down': () => getActiveBuffer().extendVisualSelection('down'),

        // Application
        'app:quit': () => {
          // No pending operations to check - just quit
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

            const currentBufferState = getActiveBuffer();
            if (bucket) {
              const entries = await storage.list(currentBufferState.currentPath);
              currentBufferState.setEntries([...entries]);
            } else if (storage.hasCapability(Capability.Containers)) {
              const entries = await storage.listContainers();
              currentBufferState.setEntries([...entries]);
            } else {
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
              buf.insertAtEditCursor(key.char);
            } else if (buf.mode === EditMode.Insert || buf.mode === EditMode.Edit) {
              if (key.char.match(/[a-zA-Z0-9._\-\s/]/)) {
                buf.insertAtEditCursor(key.char);
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

        'input:delete': () => {
          const buf = getActiveBuffer();
          if (buf.mode !== EditMode.Search) {
            buf.deleteAtEditCursor();
          }
        },

        'input:cursorLeft': () => {
          const buf = getActiveBuffer();
          buf.moveEditCursor('left');
        },

        'input:cursorRight': () => {
          const buf = getActiveBuffer();
          buf.moveEditCursor('right');
        },

        'input:cursorStart': () => {
          const buf = getActiveBuffer();
          buf.moveEditCursorToStart();
        },

        'input:cursorEnd': () => {
          const buf = getActiveBuffer();
          buf.moveEditCursorToEnd();
        },

        'input:confirm': async () => {
          const buf = getActiveBuffer();

          if (buf.mode === EditMode.Search) {
            // Confirm search: keep filter, exit to normal mode
            buf.confirmSearchMode();
            const filterCount = buf.getFilteredEntries().length;
            setStatusMessage(
              buf.searchQuery
                ? `Filter active: ${filterCount} ${filterCount === 1 ? 'entry' : 'entries'}`
                : ''
            );
            setStatusMessageColor(Theme.getInfoColor());
          } else if (buf.mode === EditMode.Command) {
            const command = buf.getEditBuffer().trim();

            if (command === ':w') {
              // No-op in immediate execution model
              setStatusMessage('No pending changes (operations execute immediately)');
              setStatusMessageColor(Theme.getTextColor());
            } else if (command === ':q') {
              process.exit(0);
            } else if (command === ':wq') {
              process.exit(0);
            } else if (command === ':q!') {
              process.exit(0);
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
            } else if (command === ':theme') {
              showThemeSelector();
            } else if (command === ':profiles') {
              const profileManager = storage.getProfileManager();
              if (profileManager) {
                showProfileSelector();
              } else {
                setStatusMessage('Profiles not available');
                setStatusMessageColor(Theme.getWarningColor());
              }
            } else {
              setStatusMessage(`Unknown command: ${command}`);
              setStatusMessageColor(Theme.getErrorColor());
            }
            buf.exitCommandMode();
          } else if (buf.mode === EditMode.Insert) {
            // Create new file/directory immediately
            const entryName = buf.getEditBuffer().trim();
            if (entryName) {
              const currentPath = buf.currentPath;
              const isDirectory = entryName.endsWith('/');
              const cleanName = entryName.replace(/\/$/, '');
              const fullPath = currentPath ? `${currentPath}${cleanName}` : cleanName;

              buf.clearEditBuffer();
              buf.exitInsertMode();

              setStatusMessage(`Creating ${isDirectory ? 'directory' : 'file'}...`);
              setStatusMessageColor(Theme.getInfoColor());

              await getExecution().executeCreate(fullPath, isDirectory, {
                onSuccess: msg => {
                  setStatusMessage(msg);
                  setStatusMessageColor(Theme.getSuccessColor());
                  refreshListing();
                },
                onError: msg => {
                  setStatusMessage(msg);
                  setStatusMessageColor(Theme.getErrorColor());
                },
              });
            } else {
              buf.clearEditBuffer();
              buf.exitInsertMode();
            }
          } else if (buf.mode === EditMode.Edit) {
            // Rename immediately
            const newName = buf.getEditBuffer().trim();
            const currentEntry = buf.getSelectedEntry();

            if (newName && newName.length > 0 && currentEntry) {
              const cleanName = newName.replace(/\/$/, '');

              // If name unchanged, just exit
              if (cleanName === currentEntry.name) {
                buf.clearEditBuffer();
                buf.exitEditMode();
                return;
              }

              const currentPath = buf.currentPath;
              const oldPath = currentEntry.path;
              const newPath = currentPath ? `${currentPath}${cleanName}` : cleanName;

              buf.clearEditBuffer();
              buf.exitEditMode();

              setStatusMessage('Renaming...');
              setStatusMessageColor(Theme.getInfoColor());

              await getExecution().executeRename(oldPath, newPath, {
                onSuccess: () => {
                  setStatusMessage(`Renamed to: ${cleanName}`);
                  setStatusMessageColor(Theme.getSuccessColor());
                  refreshListing();
                },
                onError: msg => {
                  setStatusMessage(msg);
                  setStatusMessageColor(Theme.getErrorColor());
                  refreshListing(); // Refresh to show actual state
                },
              });
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
    showProfileSelector,
    showThemeSelector,
    toggleHelp,
    toggleSort,
    closeDialog,
    refreshListing,
  ]);
}
