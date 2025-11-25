/**
 * S3Explorer React component
 *
 * Main application component that manages the S3 bucket exploration interface.
 * Declarative React component that uses hooks for state management and rendering.
 */

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Adapter, ProgressEvent } from '../adapters/adapter.js';
import { ConfigManager } from '../utils/config.js';
import { useBufferState } from '../hooks/useBufferState.js';
import { useKeyboardDispatcher } from '../hooks/useKeyboardDispatcher.js';
import { useNavigationHandlers } from '../hooks/useNavigationHandlers.js';
import { useTerminalSize, useLayoutDimensions } from '../hooks/useTerminalSize.js';
import { useMultiPaneLayout } from '../hooks/useMultiPaneLayout.js';
import { useProgressState } from '../hooks/useProgressState.js';
import { useDialogState } from '../hooks/useDialogState.js';

import { S3ExplorerLayout, StatusBarState, PreviewState } from './s3-explorer-layout.js';
import { DialogsState } from './s3-explorer-dialogs.js';
import { CatppuccinMocha } from './theme.js';
import { parseAwsError, formatErrorForDisplay } from '../utils/errors.js';
import { useKeyboardHandler, KeyboardPriority } from '../contexts/KeyboardContext.js';
import { Entry, EntryType } from '../types/entry.js';
import { EditMode } from '../types/edit-mode.js';
import { SortField, SortOrder, formatSortField } from '../utils/sorting.js';
import { getDialogHandler } from '../hooks/useDialogKeyboard.js';
import type { PendingOperation } from '../types/dialog.js';
import type { KeyboardKey, KeyAction } from '../types/keyboard.js';

interface S3ExplorerProps {
  bucket?: string;
  adapter: Adapter;
  configManager: ConfigManager;
}

/**
 * Helper to determine if a file should be previewed
 */
function isPreviewableFile(entry: Entry | undefined): boolean {
  if (!entry || entry.type !== 'file') return false;

  const name = entry.name.toLowerCase();
  const textExtensions = [
    '.txt',
    '.md',
    '.json',
    '.yaml',
    '.yml',
    '.toml',
    '.xml',
    '.csv',
    '.log',
    '.js',
    '.ts',
    '.tsx',
    '.jsx',
    '.py',
    '.rb',
    '.go',
    '.rs',
    '.c',
    '.cpp',
    '.h',
    '.java',
    '.sh',
    '.bash',
    '.zsh',
  ];

  return textExtensions.some(ext => name.endsWith(ext));
}

/**
 * Format bytes for display
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + 'B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + 'GB';
}

/**
 * Main S3Explorer component - declarative React implementation
 */
export function S3Explorer({ bucket: initialBucket, adapter }: S3ExplorerProps) {
  // ============================================
  // Core State
  // ============================================
  const [bucket, setBucket] = useState<string | undefined>(initialBucket);
  const [isInitialized, setIsInitialized] = useState(false);
  const [originalEntries, setOriginalEntries] = useState<Entry[]>([]);

  // ============================================
  // Status Bar State
  // ============================================
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [statusMessageColor, setStatusMessageColor] = useState<string>(CatppuccinMocha.text);

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
    showConfirm,
    showHelp,
    toggleHelp,
    showSort,
    toggleSort,
    showUpload,
    showQuit,
    closeDialog,
    closeAndClearOperations,
  } = useDialogState();
  const pendingOperations = dialogState.pendingOperations;

  // ============================================
  // Preview State
  // ============================================
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewFilename, setPreviewFilename] = useState<string>('');
  const [previewEnabled, setPreviewEnabled] = useState(false);

  // ============================================
  // Progress Window State (consolidated hook)
  // ============================================
  const {
    progress: progressState,
    showProgress,
    updateFile: updateProgressFile,
    updateProgress,
    updateDescription: updateProgressDescription,
    hideProgress,
    cancelOperation: cancelProgressOperation,
    dispatch: dispatchProgress,
  } = useProgressState();

  // ============================================
  // Refs
  // ============================================
  const operationAbortControllerRef = useRef<AbortController | null>(null);
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
  const navigationConfig = useMemo(
    () => ({
      onLoadBuffer: async (path: string) => {
        const activeBufferState = multiPaneLayout.getActiveBufferState() || bufferState;
        try {
          const result = await adapter.list(path);
          activeBufferState.setEntries([...result.entries]);
          activeBufferState.setCurrentPath(path);
          setOriginalEntries([...result.entries]);
          activeBufferState.cursorToTop();
          setStatusMessage(`Navigated to ${path}`);
          setStatusMessageColor(CatppuccinMocha.green);
        } catch (err) {
          const parsedError = parseAwsError(err, 'Navigation failed');
          setStatusMessage(formatErrorForDisplay(parsedError, 70));
          setStatusMessageColor(CatppuccinMocha.red);
        }
      },
      onErrorOccurred: (error: string) => {
        setStatusMessage(error);
        setStatusMessageColor(CatppuccinMocha.red);
      },
    }),
    [adapter, bufferState, multiPaneLayout]
  );

  const activeBufferState = multiPaneLayout.getActiveBufferState() || bufferState;
  const navigationHandlers = useNavigationHandlers(activeBufferState, navigationConfig);

  // ============================================
  // Keyboard Dispatcher
  // ============================================
  // Check if any dialog is open (blocks normal keybindings)
  const isAnyDialogOpen =
    showConfirmDialog || showHelpDialog || showSortMenu || showUploadDialog || showQuitDialog;

  // Initialize the keyboard dispatcher
  const {
    dispatch: dispatchKey,
    registerActions,
    clearKeySequence,
  } = useKeyboardDispatcher({
    mode: activeBufferState.mode,
    isDialogOpen: isAnyDialogOpen,
  });

  // ============================================
  // Action Handlers
  // ============================================
  // Register action handlers with the dispatcher
  useEffect(() => {
    const getActiveBuffer = () => multiPaneLayout.getActiveBufferState() || bufferState;

    const actionHandlers: Partial<Record<KeyAction, () => void>> = {
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

          if (adapter.setBucket) {
            adapter.setBucket(bucketName);
          }
          if (adapter.setRegion) {
            adapter.setRegion(bucketRegion);
          }
          setBucket(bucketName);
          return;
        }

        // If it's a file, enable preview mode
        if (currentEntry.type === 'file') {
          if (!previewEnabled) {
            setPreviewEnabled(true);
            setStatusMessage('Preview enabled');
            setStatusMessageColor(CatppuccinMocha.blue);
          }
          return;
        }

        await navigationHandlers.navigateInto();
      },

      'entry:back': async () => {
        if (previewEnabled) {
          setPreviewEnabled(false);
          setPreviewContent(null);
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
        const parts = currentPath.split('/').filter(p => p);

        if (parts.length > 0) {
          parts.pop();
          const parentPath = parts.length > 0 ? parts.join('/') + '/' : '';
          await navigationHandlers.navigateToPath(parentPath);
          setStatusMessage(`Navigated to ${parentPath || 'bucket root'}`);
          setStatusMessageColor(CatppuccinMocha.green);
        } else {
          setBucket(undefined);
          setStatusMessage('Back to bucket listing');
          setStatusMessageColor(CatppuccinMocha.blue);
        }
      },

      'entry:delete': () => {
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
        getActiveBuffer().copySelection();
        setStatusMessage('Copied');
        setStatusMessageColor(CatppuccinMocha.green);
      },

      'entry:paste': () => {
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

        if (!adapter.downloadToLocal) {
          setStatusMessage('Download not supported by this adapter');
          setStatusMessageColor(CatppuccinMocha.red);
          return;
        }

        const s3Path = currentBufferState.currentPath
          ? `${currentBufferState.currentPath}${currentEntry.name}`
          : currentEntry.name;
        const localPath = currentEntry.name;

        const operation = {
          id: Math.random().toString(36),
          type: 'download' as const,
          source: s3Path,
          destination: localPath,
          entry: currentEntry,
          recursive: currentEntry.type === 'directory',
        };

        showConfirm([operation]);
      },

      'entry:upload': () => {
        showUpload();
      },

      // Mode changes
      'mode:insert': () => {
        getActiveBuffer().enterInsertMode();
        setStatusMessage('-- INSERT -- (type name, Enter to create, Esc to cancel)');
        setStatusMessageColor(CatppuccinMocha.blue);
      },

      'mode:edit': () => {
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
      'dialog:upload': () => showUpload(),

      // Buffer operations
      'buffer:save': () => {
        const currentBufferState = getActiveBuffer();
        const markedForDeletion = currentBufferState.getMarkedForDeletion();

        const deleteOperations: PendingOperation[] = markedForDeletion.map(entry => ({
          id: entry.id,
          type: 'delete' as const,
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
          if (adapter.getBucketEntries) {
            adapter
              .getBucketEntries()
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
          adapter
            .list(currentPath)
            .then(result => {
              currentBufferState.setEntries([...result.entries]);
              setOriginalEntries([...result.entries]);
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
              if (adapter.setBucket) {
                adapter.setBucket(bucketName);
              }
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

    return registerActions(actionHandlers);
  }, [
    registerActions,
    bufferState,
    multiPaneLayout,
    bucket,
    adapter,
    previewEnabled,
    navigationHandlers,
    showConfirm,
    showUpload,
    toggleHelp,
    toggleSort,
  ]);

  // ============================================
  // Computed State
  // ============================================
  const showErrorDialog = statusMessage !== '' && statusMessageColor === CatppuccinMocha.red;

  // ============================================
  // Confirm Handler
  // ============================================
  const confirmHandlerRef = useRef<() => Promise<void>>(async () => {});

  const createConfirmHandler = useCallback(async () => {
    try {
      const abortController = new AbortController();
      operationAbortControllerRef.current = abortController;

      let successCount = 0;
      showProgress({
        title: `Executing ${pendingOperations[0]?.type || 'operation'}...`,
        totalNum: pendingOperations.length,
        cancellable: true,
      });

      for (let opIndex = 0; opIndex < pendingOperations.length; opIndex++) {
        const op = pendingOperations[opIndex];

        if (abortController.signal.aborted) {
          setStatusMessage('Operation cancelled by user');
          setStatusMessageColor(CatppuccinMocha.yellow);
          break;
        }

        try {
          const onProgress = (event: ProgressEvent) => {
            const baseProgress = (opIndex / pendingOperations.length) * 100;
            const opProgress = event.percentage / pendingOperations.length;
            const totalProgress = Math.round(baseProgress + opProgress);

            updateProgress(totalProgress);
            if (event.currentFile) {
              dispatchProgress({ type: 'UPDATE', payload: { currentFile: event.currentFile } });
            }
            updateProgressDescription(event.operation);
          };

          const progress = Math.round((opIndex / pendingOperations.length) * 100);
          dispatchProgress({
            type: 'UPDATE',
            payload: {
              value: progress,
              description: `${op.type}: ${op.path || op.source || 'processing'}`,
              currentFile: op.path || op.source || '',
              currentNum: opIndex + 1,
            },
          });

          switch (op.type) {
            case 'create':
              if (op.path) {
                const createType =
                  op.entryType === 'directory' ? EntryType.Directory : EntryType.File;
                await adapter.create(op.path, createType, undefined, { onProgress });
                successCount++;
              }
              break;
            case 'delete':
              if (op.path) {
                // Only use recursive delete for directories
                const isDirectory = op.entry?.type === 'directory';
                await adapter.delete(op.path, isDirectory, { onProgress });
                successCount++;
              }
              break;
            case 'move':
              if (op.source && op.destination) {
                await adapter.move(op.source, op.destination, { onProgress });
                successCount++;
              }
              break;
            case 'copy':
              if (op.source && op.destination) {
                await adapter.copy(op.source, op.destination, { onProgress });
                successCount++;
              }
              break;
            case 'download':
              if (adapter.downloadToLocal && op.source && op.destination) {
                await adapter.downloadToLocal(op.source, op.destination, op.recursive || false, {
                  onProgress,
                });
                successCount++;
              }
              break;
            case 'upload':
              if (adapter.uploadFromLocal && op.source && op.destination) {
                await adapter.uploadFromLocal(op.source, op.destination, op.recursive || false, {
                  onProgress,
                });
                successCount++;
              }
              break;
          }
        } catch (opError) {
          if (opError instanceof Error && opError.name === 'AbortError') {
            setStatusMessage('Operation cancelled by user');
            setStatusMessageColor(CatppuccinMocha.yellow);
            break;
          }
          console.error(`Failed to execute ${op.type} operation:`, opError);
          const parsedError = parseAwsError(opError, `Failed to ${op.type}`);
          setStatusMessage(`Operation failed: ${formatErrorForDisplay(parsedError, 70)}`);
          setStatusMessageColor(CatppuccinMocha.red);
        }
      }

      hideProgress();

      if (successCount > 0) {
        try {
          const currentBufferState = multiPaneLayout.getActiveBufferState() || bufferState;
          const result = await adapter.list(currentBufferState.currentPath);
          currentBufferState.setEntries([...result.entries]);
          // Clear deletion marks after successful save
          currentBufferState.clearDeletionMarks();
          // Update original entries reference
          setOriginalEntries([...result.entries]);
          setStatusMessage(`${successCount} operation(s) completed successfully`);
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
      }

      closeAndClearOperations();
    } catch {
      // Error handling is done within the loop
    }
  }, [pendingOperations, adapter, multiPaneLayout, bufferState, closeAndClearOperations]);

  useEffect(() => {
    confirmHandlerRef.current = createConfirmHandler;
  }, [createConfirmHandler]);

  const handleCancelOperation = useCallback(() => {
    if (operationAbortControllerRef.current) {
      operationAbortControllerRef.current.abort();
      dispatchProgress({ type: 'UPDATE', payload: { cancellable: false } });
    }
  }, [dispatchProgress]);

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
      closeDialog,
      closeAndClearOperations,
      bufferState,
      multiPaneLayout,
    ]
  );

  // Register keyboard handler with context at normal priority
  useKeyboardHandler(keyboardHandlerCallback, [keyboardHandlerCallback], KeyboardPriority.Normal);

  // ============================================
  // Initialize Data
  // ============================================
  useEffect(() => {
    const initializeData = async () => {
      try {
        console.error(`[S3Explorer] Initializing data...`);

        const currentBufferState = multiPaneLayout.getActiveBufferState() || bufferState;
        if (!bucket) {
          console.error(`[S3Explorer] Root view mode detected, loading buckets...`);
          if (adapter.getBucketEntries) {
            const entries = await adapter.getBucketEntries();
            console.error(`[S3Explorer] Received ${entries.length} buckets`);
            currentBufferState.setEntries([...entries]);
            currentBufferState.setCurrentPath('');
            setStatusMessage(`Found ${entries.length} bucket(s)`);
            setStatusMessageColor(CatppuccinMocha.green);
          } else {
            throw new Error('Adapter does not support bucket listing');
          }
        } else {
          const path = currentBufferState.currentPath;
          console.error(`[S3Explorer] Loading bucket: ${bucket}, path: "${path}"`);
          const result = await adapter.list(path);
          console.error(`[S3Explorer] Received ${result.entries.length} entries`);

          currentBufferState.setEntries([...result.entries]);
          console.error(`[S3Explorer] Entries loaded into buffer state`);

          setStatusMessage(`Loaded ${result.entries.length} items`);
          setStatusMessageColor(CatppuccinMocha.green);
        }

        console.error(`[S3Explorer] Status message set, about to set initialized`);
        setIsInitialized(true);
        console.error(`[S3Explorer] Initialized set to true`);
      } catch (err) {
        console.error('[S3Explorer] Error loading data:', err);
        const parsedError = parseAwsError(
          err,
          bucket ? 'Failed to load bucket' : 'Failed to list buckets'
        );
        const errorDisplay = formatErrorForDisplay(parsedError, 70);
        console.error('[S3Explorer] Setting error message:', errorDisplay);
        setStatusMessage(errorDisplay);
        setStatusMessageColor(CatppuccinMocha.red);
        setIsInitialized(true);
        console.error('[S3Explorer] Initialized set to true after error');
      }
    };

    console.error(`[S3Explorer] useEffect triggered`);
    initializeData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bucket, adapter]);

  // ============================================
  // Preview Effect
  // ============================================
  useEffect(() => {
    const fetchPreview = async () => {
      const currentBufferState = multiPaneLayout.getActiveBufferState() || bufferState;

      if (!previewEnabled) {
        setPreviewContent(null);
        return;
      }

      if (!bucket || !isInitialized) {
        setPreviewContent(null);
        return;
      }

      if (multiPaneLayout.isMultiPaneMode) {
        setPreviewContent(null);
        return;
      }

      const selectedEntry = currentBufferState.entries[currentBufferState.selection.cursorIndex];

      if (!selectedEntry || !isPreviewableFile(selectedEntry)) {
        setPreviewContent(null);
        setPreviewFilename('');
        return;
      }

      try {
        const maxPreviewSize = 100 * 1024;
        if (selectedEntry.size && selectedEntry.size > maxPreviewSize) {
          setPreviewContent(`File too large to preview (${formatBytes(selectedEntry.size)})`);
          setPreviewFilename('');
          return;
        }

        const fullPath = currentBufferState.currentPath
          ? `${currentBufferState.currentPath}${selectedEntry.name}`
          : selectedEntry.name;

        const buffer = await adapter.read(fullPath);
        const content = buffer.toString('utf-8');
        setPreviewContent(content);
        setPreviewFilename(selectedEntry.name);
      } catch (err) {
        console.error('Failed to load preview:', err);
        setPreviewContent('Failed to load preview');
      }
    };

    fetchPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    previewEnabled,
    activeBufferState.selection.cursorIndex,
    activeBufferState.currentPath,
    bucket,
    isInitialized,
    multiPaneLayout.isMultiPaneMode,
  ]);

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
