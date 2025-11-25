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
import { useKeyboardEvents } from '../hooks/useKeyboardEvents.js';
import { useNavigationHandlers } from '../hooks/useNavigationHandlers.js';
import { useTerminalSize, useLayoutDimensions } from '../hooks/useTerminalSize.js';
import { useMultiPaneLayout } from '../hooks/useMultiPaneLayout.js';

import { S3ExplorerLayout, StatusBarState, PreviewState } from './s3-explorer-layout.js';
import { DialogsState } from './s3-explorer-dialogs.js';
import { CatppuccinMocha } from './theme.js';
import { parseAwsError, formatErrorForDisplay } from '../utils/errors.js';
import { setGlobalKeyboardDispatcher } from '../index.tsx';
import { detectChanges, buildOperationPlan } from '../utils/change-detection.js';
import { EntryIdMap } from '../utils/entry-id.js';
import { Entry, EntryType } from '../types/entry.js';
import { SortField, SortOrder, formatSortField } from '../utils/sorting.js';
import { getDialogHandler } from '../hooks/useDialogKeyboard.js';

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
  // Dialog Visibility State
  // ============================================
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [pendingOperations, setPendingOperations] = useState<any[]>([]);

  // ============================================
  // Preview State
  // ============================================
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewFilename, setPreviewFilename] = useState<string>('');
  const [previewEnabled, setPreviewEnabled] = useState(false);

  // ============================================
  // Progress Window State
  // ============================================
  const [showProgress, setShowProgress] = useState(false);
  const [progressTitle, setProgressTitle] = useState('Operation in Progress');
  const [progressDescription, setProgressDescription] = useState('Processing...');
  const [progressValue, setProgressValue] = useState(0);
  const [progressCurrentFile, setProgressCurrentFile] = useState('');
  const [progressCurrentNum, setProgressCurrentNum] = useState(0);
  const [progressTotalNum, setProgressTotalNum] = useState(0);
  const [progressCancellable, setProgressCancellable] = useState(true);

  // ============================================
  // Refs
  // ============================================
  const operationAbortControllerRef = useRef<AbortController | null>(null);
  const showUploadDialogRef = useRef(showUploadDialog);
  const showConfirmDialogRef = useRef(showConfirmDialog);

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
  // Keyboard Handlers
  // ============================================
  const keyboardHandlers = useMemo(
    () => ({
      onNavigateInto: async () => {
        const currentBufferState = multiPaneLayout.getActiveBufferState() || bufferState;
        const currentEntry = currentBufferState.entries[currentBufferState.selection.cursorIndex];

        if (!currentEntry) return;

        // Check if we're navigating into a bucket from root view
        if (!bucket && currentEntry.type === 'bucket') {
          const bucketName = currentEntry.name;
          const bucketRegion = currentEntry.metadata?.region || 'us-east-1';

          const s3Adapter = adapter as any;
          if (s3Adapter.setBucket) {
            s3Adapter.setBucket(bucketName);
          }
          if (s3Adapter.setRegion) {
            s3Adapter.setRegion(bucketRegion);
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
      onNavigateUp: async () => {
        if (previewEnabled) {
          setPreviewEnabled(false);
          setPreviewContent(null);
          setStatusMessage('Preview closed');
          setStatusMessageColor(CatppuccinMocha.text);
          return;
        }

        const currentBufferState = multiPaneLayout.getActiveBufferState() || bufferState;
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
      onDelete: () => {
        const currentBufferState = multiPaneLayout.getActiveBufferState() || bufferState;
        const selected = currentBufferState.getSelectedEntries();
        if (selected.length > 0) {
          setPendingOperations(selected);
          setShowConfirmDialog(true);
        }
      },
      onDownload: () => {
        const currentBufferState = multiPaneLayout.getActiveBufferState() || bufferState;
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

        setPendingOperations([operation]);
        setShowConfirmDialog(true);
      },
      onUpload: async () => {
        setStatusMessage(
          'Upload: To upload, use Vim-style command mode to specify local file path (e.g., :upload ./path/to/file)'
        );
        setStatusMessageColor(CatppuccinMocha.blue);
      },
      onPageDown: () => {
        const currentBufferState = multiPaneLayout.getActiveBufferState() || bufferState;
        currentBufferState.moveCursorDown(10);
      },
      onPageUp: () => {
        const currentBufferState = multiPaneLayout.getActiveBufferState() || bufferState;
        currentBufferState.moveCursorUp(10);
      },
      onSave: () => {
        const currentBufferState = multiPaneLayout.getActiveBufferState() || bufferState;
        const changes = detectChanges(
          originalEntries,
          currentBufferState.entries,
          {} as EntryIdMap
        );
        const plan = buildOperationPlan(changes);

        if (plan.operations.length === 0) {
          setStatusMessage('No changes to save');
          setStatusMessageColor(CatppuccinMocha.text);
          return;
        }

        setPendingOperations(
          plan.operations.map(op => ({
            id: op.id,
            type: op.type,
            path: (op as any).path || (op as any).destination,
            source: (op as any).source,
            destination: (op as any).destination,
          }))
        );
        setShowConfirmDialog(true);
      },
      onQuit: () => process.exit(0),
      onShowHelp: () => setShowHelpDialog(!showHelpDialog),
      onBucketsCommand: () => {
        if (!bucket) {
          setStatusMessage('Already viewing buckets');
          setStatusMessageColor(CatppuccinMocha.text);
        } else {
          setBucket(undefined);
          setStatusMessage('Switched to bucket listing');
          setStatusMessageColor(CatppuccinMocha.blue);
        }
      },
      onBucketCommand: (bucketName: string) => {
        const s3Adapter = adapter as any;
        if (s3Adapter.setBucket) {
          s3Adapter.setBucket(bucketName);
        }
        setBucket(bucketName);
        setStatusMessage(`Switched to bucket: ${bucketName}`);
        setStatusMessageColor(CatppuccinMocha.blue);
      },
      onCommand: (command: string) => {
        setStatusMessage(`Unknown command: ${command}`);
        setStatusMessageColor(CatppuccinMocha.red);
      },
      onEnterSearchMode: () => {
        setStatusMessage('Search mode: type pattern, n/N to navigate, ESC to clear');
        setStatusMessageColor(CatppuccinMocha.blue);
      },
      onSearch: (query: string) => {
        const currentBufferState = multiPaneLayout.getActiveBufferState() || bufferState;
        currentBufferState.updateSearchQuery(query);
        if (query) {
          setStatusMessage(`Searching: ${query}`);
          setStatusMessageColor(CatppuccinMocha.blue);
        } else {
          setStatusMessage('Search cleared');
          setStatusMessageColor(CatppuccinMocha.text);
        }
      },
      onToggleMultiPane: () => {
        multiPaneLayout.toggleMultiPaneMode();
        setStatusMessage(
          multiPaneLayout.isMultiPaneMode ? 'Multi-pane mode enabled' : 'Single pane mode'
        );
        setStatusMessageColor(CatppuccinMocha.blue);
      },
      onSwitchPane: () => {
        if (multiPaneLayout.panes.length > 1) {
          const currentIndex = multiPaneLayout.panes.findIndex(
            pane => pane.id === multiPaneLayout.activePaneId
          );
          const nextIndex = (currentIndex + 1) % multiPaneLayout.panes.length;
          const nextPaneId = multiPaneLayout.panes[nextIndex].id;
          multiPaneLayout.activatePane(nextPaneId);
          setStatusMessage(`Switched to pane ${nextIndex + 1}`);
          setStatusMessageColor(CatppuccinMocha.blue);
        }
      },
    }),
    [
      navigationHandlers,
      bufferState,
      bucket,
      showHelpDialog,
      previewEnabled,
      setBucket,
      originalEntries,
      adapter,
      multiPaneLayout,
    ]
  );

  const { handleKeyDown } = useKeyboardEvents(activeBufferState, keyboardHandlers);

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
      setProgressCancellable(true);

      let successCount = 0;
      setShowProgress(true);
      setProgressTitle(`Executing ${pendingOperations[0]?.type || 'operation'}...`);

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

            setProgressValue(totalProgress);
            if (event.currentFile) {
              setProgressCurrentFile(event.currentFile);
            }
            setProgressDescription(event.operation);
          };

          const progress = Math.round((opIndex / pendingOperations.length) * 100);
          setProgressValue(progress);
          setProgressDescription(`${op.type}: ${op.path || op.source || 'processing'}`);
          setProgressCurrentFile(op.path || op.source || '');
          setProgressCurrentNum(opIndex + 1);
          setProgressTotalNum(pendingOperations.length);

          switch (op.type) {
            case 'create':
              await adapter.create(op.path, op.entryType || 'file', undefined, { onProgress });
              successCount++;
              break;
            case 'delete':
              await adapter.delete(op.path, true, { onProgress });
              successCount++;
              break;
            case 'move':
              await adapter.move(op.source, op.destination, { onProgress });
              successCount++;
              break;
            case 'copy':
              await adapter.copy(op.source, op.destination, { onProgress });
              successCount++;
              break;
            case 'download':
              if (adapter.downloadToLocal) {
                await adapter.downloadToLocal(op.source, op.destination, op.recursive || false, {
                  onProgress,
                });
                successCount++;
              }
              break;
            case 'upload':
              if (adapter.uploadFromLocal) {
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

      setShowProgress(false);

      if (successCount > 0) {
        try {
          const currentBufferState = multiPaneLayout.getActiveBufferState() || bufferState;
          const result = await adapter.list(currentBufferState.currentPath);
          currentBufferState.setEntries([...result.entries]);
          setStatusMessage(`${successCount} operation(s) completed successfully`);
          setStatusMessageColor(CatppuccinMocha.green);
        } catch (reloadError) {
          console.error('Failed to reload buffer:', reloadError);
          setStatusMessage('Operations completed but failed to reload buffer');
          setStatusMessageColor(CatppuccinMocha.yellow);
        }
      }

      setShowConfirmDialog(false);
      setPendingOperations([]);
    } catch {
      // Error handling is done within the loop
    }
  }, [pendingOperations, adapter, multiPaneLayout, bufferState]);

  useEffect(() => {
    confirmHandlerRef.current = createConfirmHandler;
  }, [createConfirmHandler]);

  const handleCancelOperation = useCallback(() => {
    if (operationAbortControllerRef.current) {
      operationAbortControllerRef.current.abort();
      setProgressCancellable(false);
    }
  }, []);

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
  // Global Keyboard Dispatcher
  // ============================================
  useEffect(() => {
    setGlobalKeyboardDispatcher((key: any) => {
      // Upload dialog - delegate to dialog handler
      if (showUploadDialogRef.current) {
        const handler = getDialogHandler('upload-dialog');
        if (handler) {
          handler(key.name);
        }
        return;
      }

      // Confirmation dialog - handle y/n keys
      if (showConfirmDialogRef.current) {
        if (key.name === 'y') {
          confirmHandlerRef.current();
          return;
        }
        if (key.name === 'n' || key.name === 'escape') {
          setShowConfirmDialog(false);
          setPendingOperations([]);
          return;
        }
        return;
      }

      // Error dialog - block all input except escape
      if (showErrorDialog) {
        if (key.name === 'escape') {
          setStatusMessage('');
          setStatusMessageColor(CatppuccinMocha.text);
        }
        return;
      }

      // Sort menu shortcuts
      if (showSortMenu) {
        const currentBufferState = multiPaneLayout.getActiveBufferState() || bufferState;
        const currentSortConfig = currentBufferState.sortConfig;

        if (key.name === 'escape' || key.name === 'q') {
          setShowSortMenu(false);
          return;
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
          return;
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
          return;
        }

        return;
      }

      // Help dialog shortcuts
      if (showHelpDialog) {
        if (key.name === '?' || key.name === 'escape' || key.name === 'q') {
          setShowHelpDialog(false);
          return;
        }
        return;
      }

      if (key.name === '?') {
        setShowHelpDialog(true);
        return;
      }

      // Upload dialog shortcut (press 'U' to upload - shift+u only)
      if ((key.name === 'u' && key.shift) || key.name === 'U') {
        setShowUploadDialog(true);
        return;
      }

      // Sort menu shortcut (press 'o' to open)
      if (key.name === 'o') {
        setShowSortMenu(!showSortMenu);
        return;
      }

      // Hidden files toggle (press 'H' to toggle)
      if (key.name === 'H' || key.name === 'shift+h') {
        const currentBufferState = multiPaneLayout.getActiveBufferState() || bufferState;
        currentBufferState.toggleHiddenFiles();
        const state = currentBufferState.showHiddenFiles;
        setStatusMessage(state ? 'Showing hidden files' : 'Hiding hidden files');
        setStatusMessageColor(CatppuccinMocha.green);
        return;
      }

      // Undo (press 'u' to undo)
      if (key.name === 'u') {
        const currentBufferState = multiPaneLayout.getActiveBufferState() || bufferState;
        if (currentBufferState.undo()) {
          setStatusMessage('Undo');
          setStatusMessageColor(CatppuccinMocha.green);
        } else {
          setStatusMessage('Nothing to undo');
          setStatusMessageColor(CatppuccinMocha.yellow);
        }
        return;
      }

      // Refresh (press 'r' to reload current bucket/folder)
      if (key.name === 'r') {
        const currentBufferState = multiPaneLayout.getActiveBufferState() || bufferState;

        if (!bucket) {
          try {
            const s3Adapter = adapter as any;
            if (s3Adapter.getBucketEntries) {
              s3Adapter
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
          } catch (err) {
            const parsedError = parseAwsError(err, 'Refresh failed');
            setStatusMessage(formatErrorForDisplay(parsedError, 70));
            setStatusMessageColor(CatppuccinMocha.red);
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
        return;
      }

      // Redo (press 'Ctrl+r' to redo)
      if (key.name === 'r' && key.ctrl) {
        const currentBufferState = multiPaneLayout.getActiveBufferState() || bufferState;
        if (currentBufferState.redo()) {
          setStatusMessage('Redo');
          setStatusMessageColor(CatppuccinMocha.green);
        } else {
          setStatusMessage('Nothing to redo');
          setStatusMessageColor(CatppuccinMocha.yellow);
        }
        return;
      }

      // Pass to normal keyboard handler
      handleKeyDown(key);
    });

    return () => {
      setGlobalKeyboardDispatcher(null);
    };
  }, [
    handleKeyDown,
    showHelpDialog,
    showErrorDialog,
    showSortMenu,
    statusMessage,
    statusMessageColor,
    bucket,
    adapter,
    bufferState,
    multiPaneLayout,
  ]);

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
          const s3Adapter = adapter as any;
          if (s3Adapter.getBucketEntries) {
            const entries = await s3Adapter.getBucketEntries();
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
        setShowConfirmDialog(false);
        setPendingOperations([]);
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
        setShowUploadDialog(false);
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
        setPendingOperations(newOperations);
        setShowConfirmDialog(true);
      },
      onCancel: () => setShowUploadDialog(false),
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
      onClose: () => setShowSortMenu(false),
    },
    progress: {
      visible: showProgress,
      title: progressTitle,
      description: progressDescription,
      progress: progressValue,
      currentFile: progressCurrentFile,
      currentFileNumber: progressCurrentNum,
      totalFiles: progressTotalNum,
      canCancel: progressCancellable,
      onCancel: handleCancelOperation,
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
