/**
 * FileExplorer Solid component (Provider-based)
 *
 * Main application component using the new provider pattern.
 * Uses SyncProvider for storage state, LocalProvider for UI state,
 * KeybindProvider for keyboard handling, and DialogProvider for dialogs.
 */

import { createEffect, on, createMemo } from 'solid-js';
import { useSync } from '../contexts/sync.js';
import { useLocal } from '../contexts/local.js';
import { useKeybind } from '../contexts/keybind.js';
import { useDialog } from '../contexts/DialogContext.js';
import { useStorage } from '../contexts/StorageContextProvider.js';
import { useTheme } from '../contexts/ThemeContext.js';
import { useTerminalSize, useLayoutDimensions } from '../hooks/useTerminalSize.js';
import { usePendingOperations } from '../hooks/usePendingOperations.js';
import { useOperationExecutor } from '../hooks/useOperationExecutor.js';
import { usePreview } from '../hooks/usePreview.js';
import { providerNameToScheme } from '../utils/storage-uri.js';
import { parseAwsError, formatErrorForDisplay } from '../utils/errors.js';
import { calculateParentPath } from '../utils/path-utils.js';
import { Theme } from './theme.js';
import { Capability } from '../providers/types/capabilities.js';
import { EditMode } from '../types/edit-mode.js';
import { EntryType } from '../types/entry.js';
import { SortField, SortOrder } from '../utils/sorting.js';

// Dialogs
import { ConfirmationDialog } from './dialog/confirmation.js';
import { HelpDialog } from './dialog/help.js';
import { UploadDialog } from './dialog/upload.js';
import { SortMenu } from './dialog/sort.js';
import { QuitDialog } from './dialog/quit.js';
import { ProfileSelectorDialog } from './dialog/profile-selector.js';
import { ThemeSelectorDialog } from './dialog/theme-selector.js';
import { ProgressWindow } from './progress-window.js';

import { FileExplorerLayoutSimple } from './file-explorer-layout-simple.js';
import type { KeyAction, KeyboardKey } from '../types/keyboard.js';
import type { Entry } from '../types/entry.js';
import type { PendingOperation } from '../types/dialog.js';

// Track if we should quit after save completes
let quitAfterSave = false;

/**
 * FileExplorer using the new provider-based architecture
 */
export function FileExplorerNew() {
  // Subscribe to theme changes
  useTheme();

  // Get contexts
  const storage = useStorage();
  const sync = useSync();
  const local = useLocal();
  const keybind = useKeybind();
  const dialog = useDialog();

  // Terminal and layout
  const terminalSize = useTerminalSize();
  const layout = useLayoutDimensions(terminalSize.size);

  // Pending operations (still using the hook for now)
  const scheme = providerNameToScheme(storage.state.providerId || 'mock');
  const pendingOps = usePendingOperations(scheme, sync.data.bucket);

  // Operation executor for progress tracking
  const {
    execute: executeOperationsWithProgress,
    cancel: cancelOperation,
    progress: progressState,
  } = useOperationExecutor();

  // Preview state
  const selectedEntry = createMemo(() => sync.data.entries[local.data.selection.cursorIndex]);
  const hasContainers = storage.hasCapability(Capability.Containers);
  const previewHookEnabled = createMemo(
    () =>
      local.data.previewEnabled &&
      sync.data.isInitialized &&
      (hasContainers ? !!sync.data.bucket : true)
  );
  const preview = usePreview(() => sync.data.currentPath, selectedEntry, {
    enabled: previewHookEnabled(),
    maxSize: 100 * 1024, // 100KB
  });

  // Update viewport height when layout changes
  createEffect(
    on(
      () => layout.contentHeight,
      height => {
        local.buffer.setViewportHeight(height);
      }
    )
  );

  // Helper to convert store operations to dialog format
  const convertStoreToPendingOps = (): PendingOperation[] => {
    return pendingOps.operations.map(op => {
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
  };

  // ============================================================================
  // Dialog Helpers
  // ============================================================================

  const showConfirmDialog = (operations: PendingOperation[]) => {
    dialog.push(
      <ConfirmationDialog
        title="Confirm Operations"
        operations={operations}
        visible={true}
        onConfirm={async () => {
          dialog.clear();
          await executeOperationsWithProgress(operations, {
            onSuccess: async (_result, message) => {
              try {
                await sync.reload();
                pendingOps.discard();
                local.status.setSuccess(message, Theme.getSuccessColor());

                if (quitAfterSave) {
                  quitAfterSave = false;
                  process.exit(0);
                }
              } catch {
                local.status.setMessage(
                  'Operations completed but failed to reload buffer',
                  Theme.getWarningColor()
                );
              }
            },
            onError: message => {
              local.status.setError(message, Theme.getErrorColor());
            },
            onCancelled: message => {
              local.status.setMessage(message, Theme.getWarningColor());
            },
          });
        }}
        onCancel={() => dialog.clear()}
      />
    );
  };

  const showHelpDialog = () => {
    dialog.push(<HelpDialog visible={true} onClose={() => dialog.clear()} />);
  };

  const showSortDialog = () => {
    dialog.push(
      <SortMenu
        visible={true}
        currentField={local.data.sortConfig.field}
        currentOrder={local.data.sortConfig.order}
        onFieldSelect={(field: SortField) => {
          local.buffer.setSortField(field);
          const fieldName = field.charAt(0).toUpperCase() + field.slice(1);
          local.status.setSuccess(`Sorted by ${fieldName}`, Theme.getSuccessColor());
          dialog.clear();
        }}
        onOrderToggle={() => {
          local.buffer.toggleSortOrder();
          const orderStr =
            local.data.sortConfig.order === SortOrder.Ascending ? 'descending' : 'ascending';
          local.status.setSuccess(`Sort order: ${orderStr}`, Theme.getSuccessColor());
        }}
        onClose={() => dialog.clear()}
      />
    );
  };

  const showUploadDialog = () => {
    dialog.push(
      <UploadDialog
        visible={true}
        destinationPath={sync.data.currentPath}
        onConfirm={(files: string[]) => {
          dialog.clear();
          const currentPath = sync.data.currentPath;
          const newOperations = files.map((filePath, index) => {
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
          showConfirmDialog(newOperations);
        }}
        onCancel={() => dialog.clear()}
      />
    );
  };

  const showQuitDialog = (pendingChanges: number) => {
    dialog.push(
      <QuitDialog
        visible={true}
        pendingChangesCount={pendingChanges}
        onQuitWithoutSave={() => {
          pendingOps.discard();
          process.exit(0);
        }}
        onSaveAndQuit={() => {
          if (pendingOps.operations.length > 0) {
            quitAfterSave = true;
            dialog.clear();
            showConfirmDialog(convertStoreToPendingOps());
          } else {
            process.exit(0);
          }
        }}
        onCancel={() => {
          dialog.clear();
          local.status.setMessage('Quit cancelled', Theme.getTextColor());
        }}
      />
    );
  };

  const showProfileSelectorDialog = () => {
    dialog.push(
      <ProfileSelectorDialog
        visible={true}
        profileManager={storage.getProfileManager()}
        currentProfileId={storage.state.profileId}
        onProfileSelect={async profile => {
          try {
            process.stderr.write(`[DEBUG] 1. Starting profile select: ${profile.displayName}\n`);
            local.status.setMessage(
              `Switching to profile: ${profile.displayName}...`,
              Theme.getInfoColor()
            );

            process.stderr.write('[DEBUG] 2. Calling storage.switchProfile\n');
            await storage.switchProfile(profile.id);
            process.stderr.write('[DEBUG] 3. switchProfile completed\n');

            const newState = storage.state;
            process.stderr.write(
              `[DEBUG] 4. Got new state, currentContainer: ${newState.currentContainer}\n`
            );

            if (newState.currentContainer) {
              process.stderr.write(`[DEBUG] 5a. Setting bucket to: ${newState.currentContainer}\n`);
              await sync.setBucket(newState.currentContainer);
              process.stderr.write('[DEBUG] 5a. setBucket completed\n');
            } else {
              process.stderr.write('[DEBUG] 5b. Setting bucket to undefined\n');
              await sync.setBucket(undefined);
              process.stderr.write('[DEBUG] 5b. setBucket completed\n');
            }

            process.stderr.write('[DEBUG] 6. Profile switch complete\n');
            local.status.setSuccess(
              `Switched to profile: ${profile.displayName}`,
              Theme.getSuccessColor()
            );

            // Return success - dialog will close itself
          } catch (err) {
            process.stderr.write(`[DEBUG] ERROR in profile select: ${err}\n`);
            local.status.setError(
              `Failed to switch profile: ${err instanceof Error ? err.message : 'Unknown error'}`,
              Theme.getErrorColor()
            );
            // Re-throw so dialog can handle it
            throw err;
          }
        }}
        onCancel={() => dialog.clear()}
      />
    );
  };

  const showThemeSelectorDialog = () => {
    dialog.push(<ThemeSelectorDialog visible={true} onClose={() => dialog.clear()} />);
  };

  // Register action handlers with keybind context
  createEffect(() => {
    const handlers: Partial<Record<KeyAction, (key?: KeyboardKey) => void | Promise<void>>> = {
      // Navigation
      'cursor:up': () => local.buffer.moveCursorUp(1),
      'cursor:down': () => local.buffer.moveCursorDown(1),
      'cursor:top': () => local.buffer.cursorToTop(),
      'cursor:bottom': () => local.buffer.cursorToBottom(),
      'cursor:pageUp': () => local.buffer.moveCursorUp(10),
      'cursor:pageDown': () => local.buffer.moveCursorDown(10),

      // Entry operations
      'entry:open': async () => {
        const entry = selectedEntry();
        if (!entry) return;

        if (!sync.data.bucket && entry.type === 'bucket') {
          await sync.navigateInto(entry);
          return;
        }

        if (entry.type === 'file') {
          if (!local.data.previewEnabled) {
            local.preview.setEnabled(true);
            local.status.setMessage('Preview enabled', Theme.getInfoColor());
          }
          return;
        }

        await sync.navigateInto(entry);
      },

      'entry:back': async () => {
        if (local.data.previewEnabled) {
          local.preview.setEnabled(false);
          local.status.setMessage('Preview closed', Theme.getTextColor());
          return;
        }

        const currentPath = sync.data.currentPath;
        const { parentPath, atContainerRoot } = calculateParentPath(currentPath);

        if (atContainerRoot) {
          if (hasContainers) {
            await sync.setBucket(undefined);
            local.status.setMessage('Back to bucket listing', Theme.getInfoColor());
          } else {
            local.status.setMessage('Already at root', Theme.getTextColor());
          }
        } else {
          await sync.navigateTo(parentPath);
          local.status.setMessage(`Navigated to ${parentPath || 'root'}`, Theme.getSuccessColor());
        }
      },

      'entry:delete': () => {
        if (!storage.hasCapability(Capability.Delete)) {
          local.status.setError(
            'Delete not supported by this storage provider',
            Theme.getErrorColor()
          );
          return;
        }

        const selected = local.buffer.getSelectedEntries();
        if (selected.length > 0) {
          for (const entry of selected) {
            pendingOps.toggleDeletion(entry);
          }

          if (local.data.selection.isActive) {
            local.buffer.exitVisualSelection();
          }

          const markedCount = pendingOps.getMarkedForDeletion().length;
          if (markedCount > 0) {
            local.status.setMessage(
              `${markedCount} item(s) marked for deletion. Use :w to save or 'u' to undo.`,
              Theme.getWarningColor()
            );
          } else {
            local.status.setMessage('No items marked for deletion', Theme.getTextColor());
          }
        }
      },

      'entry:cut': () => {
        if (!storage.hasCapability(Capability.Move)) {
          local.status.setError(
            'Move not supported by this storage provider',
            Theme.getErrorColor()
          );
          return;
        }

        const selected = local.buffer.getSelectedEntries();
        if (selected.length === 0) {
          local.status.setMessage('No entries selected', Theme.getWarningColor());
          return;
        }

        pendingOps.cut(selected);
        local.buffer.exitVisualSelection();
        local.buffer.setMode(EditMode.Normal);
        local.status.setMessage(
          `Cut ${selected.length} item(s) - navigate and press 'p' to move`,
          Theme.getInfoColor()
        );
      },

      'entry:copy': () => {
        if (!storage.hasCapability(Capability.Copy)) {
          local.status.setError(
            'Copy not supported by this storage provider',
            Theme.getErrorColor()
          );
          return;
        }

        const selected = local.buffer.getSelectedEntries();
        if (selected.length === 0) {
          local.status.setMessage('No entries selected', Theme.getWarningColor());
          return;
        }

        pendingOps.copy(selected);
        local.buffer.exitVisualSelection();
        local.buffer.setMode(EditMode.Normal);
        local.status.setMessage(
          `Copied ${selected.length} item(s) - navigate and press 'p' to paste`,
          Theme.getInfoColor()
        );
      },

      'entry:paste': () => {
        if (!pendingOps.hasClipboardContent) {
          local.status.setMessage('Nothing to paste - cut or copy first', Theme.getWarningColor());
          return;
        }

        const isCut = pendingOps.isClipboardCut;
        if (isCut && !storage.hasCapability(Capability.Move)) {
          local.status.setError(
            'Move not supported by this storage provider',
            Theme.getErrorColor()
          );
          return;
        }
        if (!isCut && !storage.hasCapability(Capability.Copy)) {
          local.status.setError(
            'Copy not supported by this storage provider',
            Theme.getErrorColor()
          );
          return;
        }

        pendingOps.paste(sync.data.currentPath);
        const opType = isCut ? 'move' : 'copy';
        local.status.setMessage(
          `Pending ${opType} operation(s) added. Use :w to save.`,
          Theme.getWarningColor()
        );
      },

      'entry:download': () => {
        const entry = selectedEntry();
        if (!entry) {
          local.status.setError('No entry selected', Theme.getErrorColor());
          return;
        }

        if (!storage.hasCapability(Capability.Download)) {
          local.status.setError(
            'Download not supported by this storage provider',
            Theme.getErrorColor()
          );
          return;
        }

        const s3Path = sync.data.currentPath ? `${sync.data.currentPath}${entry.name}` : entry.name;
        const localPath = entry.name;

        const operation: PendingOperation = {
          id: Math.random().toString(36),
          type: 'download',
          source: s3Path,
          destination: localPath,
          entry: entry,
          recursive: entry.type === 'directory',
        };

        showConfirmDialog([operation]);
      },

      'entry:upload': () => {
        if (!storage.hasCapability(Capability.Upload)) {
          local.status.setError(
            'Upload not supported by this storage provider',
            Theme.getErrorColor()
          );
          return;
        }
        showUploadDialog();
      },

      // Mode changes
      'mode:insert': () => {
        if (!storage.hasCapability(Capability.Write)) {
          local.status.setError(
            'Create not supported by this storage provider',
            Theme.getErrorColor()
          );
          return;
        }
        local.buffer.enterInsertMode();
        local.status.setMessage(
          '-- INSERT -- (type name, Enter to create, Esc to cancel)',
          Theme.getInfoColor()
        );
      },

      'mode:edit': () => {
        const entry = selectedEntry();
        if (entry) {
          const entryState = pendingOps.getEntryState(entry);
          const nameToEdit =
            entryState.isRenamed && entryState.newName ? entryState.newName : entry.name;
          local.buffer.enterEditMode(nameToEdit);
        } else {
          local.buffer.enterEditMode('');
        }
        local.status.clear();
      },

      'mode:search': () => {
        local.buffer.enterSearchMode();
        local.status.clear();
      },

      'mode:command': () => {
        local.buffer.enterCommandMode();
        local.status.setMessage(':', Theme.getTextColor());
      },

      'mode:visual': () => {
        local.buffer.startVisualSelection();
        local.status.setMessage('-- VISUAL --', Theme.getInfoColor());
      },

      'mode:normal': () => {
        local.buffer.exitVisualSelection();
        local.buffer.exitSearchMode();
        local.buffer.exitCommandMode();
        local.buffer.exitInsertMode();
        local.buffer.exitEditMode();
        local.status.clear();
      },

      // Dialogs
      'dialog:help': () => {
        if (dialog.hasDialog) {
          dialog.clear();
        } else {
          showHelpDialog();
        }
      },
      'dialog:sort': () => {
        if (dialog.hasDialog) {
          dialog.clear();
        } else {
          showSortDialog();
        }
      },
      'dialog:upload': () => {
        if (!storage.hasCapability(Capability.Upload)) {
          local.status.setError(
            'Upload not supported by this storage provider',
            Theme.getErrorColor()
          );
          return;
        }
        showUploadDialog();
      },
      'dialog:profileSelector': () => {
        const profileManager = storage.getProfileManager();
        if (profileManager) {
          showProfileSelectorDialog();
        } else {
          local.status.setMessage('Profile selector not available', Theme.getWarningColor());
        }
      },

      // Buffer operations
      'buffer:save': () => {
        if (!pendingOps.hasPendingChanges) {
          local.status.setMessage('No changes to save', Theme.getTextColor());
          return;
        }
        showConfirmDialog(convertStoreToPendingOps());
      },

      'buffer:refresh': async () => {
        try {
          await sync.reload();
          local.status.setSuccess('Refreshed', Theme.getSuccessColor());
        } catch (err) {
          const parsedError = parseAwsError(err, 'Refresh failed');
          local.status.setError(formatErrorForDisplay(parsedError, 70), Theme.getErrorColor());
        }
      },

      'buffer:undo': () => {
        if (pendingOps.undo()) {
          local.status.setSuccess('Undo', Theme.getSuccessColor());
        } else {
          local.status.setMessage('Nothing to undo', Theme.getWarningColor());
        }
      },

      'buffer:redo': () => {
        if (pendingOps.redo()) {
          local.status.setSuccess('Redo', Theme.getSuccessColor());
        } else {
          local.status.setMessage('Nothing to redo', Theme.getWarningColor());
        }
      },

      // Selection (visual mode)
      'select:extend:up': () => local.buffer.extendVisualSelection('up'),
      'select:extend:down': () => local.buffer.extendVisualSelection('down'),

      // Application
      'app:quit': () => {
        if (pendingOps.pendingCount > 0) {
          showQuitDialog(pendingOps.pendingCount);
          return;
        }
        process.exit(0);
      },

      'app:toggleHidden': () => {
        local.buffer.toggleHiddenFiles();
        const state = local.data.showHiddenFiles;
        local.status.setSuccess(
          state ? 'Showing hidden files' : 'Hiding hidden files',
          Theme.getSuccessColor()
        );
      },

      // Connection operations
      'connection:reconnect': async () => {
        if (!storage.hasCapability(Capability.Connection)) {
          local.status.setMessage(
            'Reconnect not supported for this storage provider',
            Theme.getWarningColor()
          );
          return;
        }

        local.status.setMessage('Reconnecting...', Theme.getInfoColor());

        try {
          await storage.connect();
          local.status.setSuccess('Reconnected successfully', Theme.getSuccessColor());
          await sync.reload();
        } catch (err) {
          const parsedError = parseAwsError(err, 'Reconnect failed');
          local.status.setError(formatErrorForDisplay(parsedError, 70), Theme.getErrorColor());
        }
      },

      // Text input handlers
      'input:char': (key?: KeyboardKey) => {
        if (key?.char && key.char.length === 1) {
          if (local.data.mode === EditMode.Search) {
            const currentQuery = local.data.searchQuery || '';
            local.buffer.updateSearchQuery(currentQuery + key.char);
            local.status.setMessage(`Searching: ${currentQuery + key.char}`, Theme.getInfoColor());
          } else if (local.data.mode === EditMode.Command) {
            local.buffer.insertAtEditCursor(key.char);
          } else if (local.data.mode === EditMode.Insert || local.data.mode === EditMode.Edit) {
            if (key.char.match(/[a-zA-Z0-9._\-\s/]/)) {
              local.buffer.insertAtEditCursor(key.char);
            }
          }
        }
      },

      'input:backspace': () => {
        if (local.data.mode === EditMode.Search) {
          const currentQuery = local.data.searchQuery || '';
          local.buffer.updateSearchQuery(currentQuery.slice(0, -1));
          local.status.setMessage(`Searching: ${currentQuery.slice(0, -1)}`, Theme.getInfoColor());
        } else {
          local.buffer.backspaceEditBuffer();
        }
      },

      'input:delete': () => {
        if (local.data.mode !== EditMode.Search) {
          local.buffer.deleteAtEditCursor();
        }
      },

      'input:cursorLeft': () => local.buffer.moveEditCursor('left'),
      'input:cursorRight': () => local.buffer.moveEditCursor('right'),
      'input:cursorStart': () => local.buffer.moveEditCursorToStart(),
      'input:cursorEnd': () => local.buffer.moveEditCursorToEnd(),

      'input:confirm': () => {
        if (local.data.mode === EditMode.Search) {
          local.buffer.setMode(EditMode.Normal);
          const filterCount = local.buffer.getFilteredEntries().length;
          local.status.setMessage(
            local.data.searchQuery
              ? `Filter active: ${filterCount} ${filterCount === 1 ? 'entry' : 'entries'}`
              : '',
            Theme.getInfoColor()
          );
        } else if (local.data.mode === EditMode.Command) {
          const command = local.data.editBuffer.trim();
          handleCommand(command);
          local.buffer.exitCommandMode();
        } else if (local.data.mode === EditMode.Insert) {
          handleInsertConfirm();
        } else if (local.data.mode === EditMode.Edit) {
          handleEditConfirm();
        }
      },

      'input:cancel': () => {
        local.buffer.clearEditBuffer();
        if (local.data.mode === EditMode.Search) {
          local.buffer.exitSearchMode();
          local.buffer.cursorToTop();
        } else if (local.data.mode === EditMode.Command) {
          local.buffer.exitCommandMode();
        } else if (local.data.mode === EditMode.Insert) {
          local.buffer.exitInsertMode();
        } else if (local.data.mode === EditMode.Edit) {
          local.buffer.exitEditMode();
        }
        local.status.clear();
      },

      'input:tab': () => {
        if (local.data.mode === EditMode.Insert) {
          const currentInput = local.data.editBuffer.trim().toLowerCase();
          if (currentInput) {
            const matching = sync.data.entries
              .filter(e => e.name.toLowerCase().startsWith(currentInput))
              .map(e => e.name);

            if (matching.length > 0) {
              local.buffer.setEditBuffer(matching[0]);
            }
          }
        }
      },
    };

    keybind.setActionHandlers(handlers);
  });

  // Helper: Handle command mode commands
  const handleCommand = (command: string) => {
    if (command === ':w') {
      keybind.triggerAction('buffer:save');
    } else if (command === ':q') {
      keybind.triggerAction('app:quit');
    } else if (command === ':wq') {
      if (pendingOps.hasPendingChanges) {
        quitAfterSave = true;
        keybind.triggerAction('buffer:save');
      } else {
        keybind.triggerAction('app:quit');
      }
    } else if (command === ':q!') {
      if (pendingOps.hasPendingChanges) {
        pendingOps.discard();
      }
      process.exit(0);
    } else if (command === ':buckets') {
      if (!sync.data.bucket) {
        local.status.setMessage('Already viewing buckets', Theme.getTextColor());
      } else {
        sync.setBucket(undefined);
        local.status.setMessage('Switched to bucket listing', Theme.getInfoColor());
      }
    } else if (command.startsWith(':bucket ')) {
      const bucketName = command.substring(':bucket '.length).trim();
      if (bucketName) {
        sync.setBucket(bucketName);
        local.status.setMessage(`Switched to bucket: ${bucketName}`, Theme.getInfoColor());
      }
    } else if (command === ':theme') {
      showThemeSelectorDialog();
    } else {
      local.status.setError(`Unknown command: ${command}`, Theme.getErrorColor());
    }
  };

  // Helper: Handle insert mode confirm (create new entry)
  const handleInsertConfirm = () => {
    const entryName = local.data.editBuffer.trim();
    if (entryName) {
      const currentPath = sync.data.currentPath;
      const isDirectory = entryName.endsWith('/');
      const cleanName = entryName.replace(/\/$/, '');

      pendingOps.create(currentPath, cleanName, isDirectory ? EntryType.Directory : EntryType.File);
      local.buffer.clearEditBuffer();
      local.buffer.exitInsertMode();
      local.status.setMessage(
        `Pending create: ${cleanName}. Use :w to save.`,
        Theme.getWarningColor()
      );
    }
  };

  // Helper: Handle edit mode confirm (rename entry)
  const handleEditConfirm = () => {
    const newName = local.data.editBuffer.trim();
    const entry = selectedEntry();

    if (newName && newName.length > 0 && entry) {
      const cleanName = newName.replace(/\/$/, '');
      const entryState = pendingOps.getEntryState(entry);

      if (cleanName === entry.name) {
        if (entryState.isRenamed) {
          const renameOp = pendingOps.operations.find(
            op => op.type === 'rename' && op.entry.id === entry.id
          );
          if (renameOp) {
            pendingOps.removeOperation(renameOp.id);
            local.status.setMessage('Rename cancelled', Theme.getInfoColor());
          }
        }
        local.buffer.clearEditBuffer();
        local.buffer.exitEditMode();
        return;
      }

      pendingOps.rename(entry, cleanName);
      local.buffer.clearEditBuffer();
      local.buffer.exitEditMode();
      local.status.setMessage(
        `Pending rename: ${entry.name} -> ${cleanName}. Use :w to save.`,
        Theme.getWarningColor()
      );
    } else {
      local.buffer.clearEditBuffer();
      local.buffer.exitEditMode();
    }
  };

  // Build buffer state object
  const bufferState = createMemo(() => ({
    entries: sync.data.entries,
    currentPath: sync.data.currentPath,
    mode: local.data.mode,
    selection: local.data.selection,
    sortConfig: local.data.sortConfig,
    searchQuery: local.data.searchQuery,
    editBuffer: local.data.editBuffer,
    getEditBufferCursor: () => local.data.editBufferCursor,
    showHiddenFiles: local.data.showHiddenFiles,
    getFilteredEntries: local.buffer.getFilteredEntries,
    getSelectedEntry: local.buffer.getSelectedEntry,
    getSelectedEntries: local.buffer.getSelectedEntries,
    setSortConfig: local.buffer.setSortConfig,
  }));

  return (
    <>
      <FileExplorerLayoutSimple
        bucket={sync.data.bucket}
        isInitialized={sync.data.isInitialized}
        bufferState={bufferState() as any}
        terminalSize={terminalSize}
        layout={layout}
        statusMessage={local.data.statusMessage}
        statusMessageColor={local.data.statusMessageColor}
        showErrorDialog={local.data.statusIsError}
        preview={{
          content: preview().content,
          filename: preview().filename,
        }}
        pendingOps={pendingOps}
      />
      {/* Progress window - not managed by DialogProvider as it's different */}
      <ProgressWindow
        visible={progressState.visible()}
        title={progressState.title()}
        description={progressState.description()}
        progress={progressState.value()}
        currentFile={progressState.currentFile()}
        currentFileNumber={progressState.currentNum()}
        totalFiles={progressState.totalNum()}
        onCancel={cancelOperation}
        canCancel={progressState.cancellable()}
      />
    </>
  );
}
