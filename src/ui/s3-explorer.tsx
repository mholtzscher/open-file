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

import { Pane } from './pane-react.js';
import { StatusBar } from './status-bar-react.js';
import { ConfirmationDialog } from './confirmation-dialog-react.js';
import { HelpDialog } from './help-dialog-react.js';
import { PreviewPane } from './preview-pane-react.js';
import { ProgressWindow } from './progress-window-react.js';
import { UploadDialog } from './upload-dialog-react.js';
import { Header } from './header-react.js';
import { SortMenu } from './sort-menu-react.js';
import { CatppuccinMocha } from './theme.js';
import { ErrorDialog } from './error-dialog-react.js';
import { parseAwsError, formatErrorForDisplay } from '../utils/errors.js';
import { setGlobalKeyboardDispatcher } from '../index.tsx';
import { detectChanges, buildOperationPlan } from '../utils/change-detection.js';
import { EntryIdMap } from '../utils/entry-id.js';
import { DownloadOperation, UploadOperation } from '../types/operations.js';
import { Entry, EntryType } from '../types/entry.js';
import { SortField, SortOrder, formatSortField } from '../utils/sorting.js';
import { UploadQueue } from '../utils/upload-queue.js';
import { getDialogHandler } from '../hooks/useDialogKeyboard.js';

interface S3ExplorerProps {
  bucket?: string;
  adapter: Adapter;
  configManager: ConfigManager;
}

/**
 * Helper to determine if a file should be previewed
 */
function isPreviewableFile(entry: any): boolean {
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
export function S3Explorer({ bucket: initialBucket, adapter, configManager }: S3ExplorerProps) {
  const [bucket, setBucket] = useState<string | undefined>(initialBucket);
  const [isInitialized, setIsInitialized] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [statusMessageColor, setStatusMessageColor] = useState<string>(CatppuccinMocha.text);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [pendingOperations, setPendingOperations] = useState<any[]>([]);
  const [originalEntries, setOriginalEntries] = useState<any[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewFilename, setPreviewFilename] = useState<string>('');
  const [previewEnabled, setPreviewEnabled] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [progressTitle, setProgressTitle] = useState('Operation in Progress');
  const [progressDescription, setProgressDescription] = useState('Processing...');
  const [progressValue, setProgressValue] = useState(0);
  const [progressCurrentFile, setProgressCurrentFile] = useState('');
  const [progressCurrentNum, setProgressCurrentNum] = useState(0);
  const [progressTotalNum, setProgressTotalNum] = useState(0);
  const [progressCancellable, setProgressCancellable] = useState(true);
  const [showUploadDialog, setShowUploadDialog] = useState(false);

  // Track abort controller for cancelling operations
  const operationAbortControllerRef = useRef<AbortController | null>(null);

  // Track upload dialog visibility for keyboard dispatcher
  const showUploadDialogRef = useRef(showUploadDialog);

  // Track terminal size for responsive layout
  const terminalSize = useTerminalSize();
  const layout = useLayoutDimensions(terminalSize.size);

  // For S3, the path should be the prefix within the bucket, not the bucket name
  // Start at root of bucket (empty prefix)
  const initialPath = '';

  // Initialize buffer state
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

  // Setup navigation handlers config - memoized to prevent recreation
  const navigationConfig = useMemo(
    () => ({
      onLoadBuffer: async (path: string) => {
        const activeBufferState = multiPaneLayout.getActiveBufferState() || bufferState;
        try {
          const result = await adapter.list(path);

          // Update buffer state with new entries and current path
          // Create a new array to ensure React detects the change
          activeBufferState.setEntries([...result.entries]);
          activeBufferState.setCurrentPath(path);

          // Save original entries for change detection
          setOriginalEntries([...result.entries]);

          // Reset cursor to top of new directory
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

  // Setup navigation handlers - use active buffer state
  const activeBufferState = multiPaneLayout.getActiveBufferState() || bufferState;
  const navigationHandlers = useNavigationHandlers(activeBufferState, navigationConfig);

  // Setup keyboard event handlers - memoized to prevent stale closure
  // Note: j/k/v navigation is handled directly by useKeyboardEvents
  const keyboardHandlers = useMemo(
    () => ({
      onNavigateInto: async () => {
        const currentBufferState = multiPaneLayout.getActiveBufferState() || bufferState;
        const currentEntry = currentBufferState.entries[currentBufferState.selection.cursorIndex];

        if (!currentEntry) return;

        // Check if we're navigating into a bucket from root view
        if (!bucket && currentEntry.type === 'bucket') {
          // Navigate into this bucket
          const bucketName = currentEntry.name;
          const bucketRegion = currentEntry.metadata?.region || 'us-east-1';

          // Update adapter bucket and region context before changing UI state
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

        // If it's a file, enable preview mode instead of showing error
        if (currentEntry.type === 'file') {
          if (!previewEnabled) {
            setPreviewEnabled(true);
            setStatusMessage('Preview enabled');
            setStatusMessageColor(CatppuccinMocha.blue);
          }
          return;
        }

        // Otherwise, normal directory navigation
        await navigationHandlers.navigateInto();
      },
      onNavigateUp: async () => {
        // If preview is enabled, close it first
        if (previewEnabled) {
          setPreviewEnabled(false);
          setPreviewContent(null);
          setStatusMessage('Preview closed');
          setStatusMessageColor(CatppuccinMocha.text);
          return;
        }

        const currentBufferState = multiPaneLayout.getActiveBufferState() || bufferState;
        // If we're in root view mode (no bucket set), can't navigate up
        if (!bucket) {
          setStatusMessage('Already at root');
          setStatusMessageColor(CatppuccinMocha.text);
          return;
        }

        const currentPath = currentBufferState.currentPath;
        const parts = currentPath.split('/').filter(p => p);

        if (parts.length > 0) {
          // Remove last part to go up one level
          parts.pop();
          // If no parts left, we're going to root (empty path)
          const parentPath = parts.length > 0 ? parts.join('/') + '/' : '';
          await navigationHandlers.navigateToPath(parentPath);
          setStatusMessage(`Navigated to ${parentPath || 'bucket root'}`);
          setStatusMessageColor(CatppuccinMocha.green);
        } else {
          // At bucket root, go back to bucket list (root view)
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

        // Build full S3 path
        const s3Path = currentBufferState.currentPath
          ? `${currentBufferState.currentPath}${currentEntry.name}`
          : currentEntry.name;

        // Download to current working directory with same filename
        const localPath = currentEntry.name;

        // Create download operation
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
        // For now, show help message about how to upload
        // In the future, this could open a file picker or command prompt
        setStatusMessage(
          'Upload: To upload, use Vim-style command mode to specify local file path (e.g., :upload ./path/to/file)'
        );
        setStatusMessageColor(CatppuccinMocha.blue);

        // TODO: Implement interactive file selection
        // For now, users must manually specify paths via a command dialog
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
        // Detect changes between original and edited entries
        const changes = detectChanges(
          originalEntries,
          currentBufferState.entries,
          {} as EntryIdMap
        );

        // Build operation plan from changes
        const plan = buildOperationPlan(changes);

        // Check if there are any operations to execute
        if (plan.operations.length === 0) {
          setStatusMessage('No changes to save');
          setStatusMessageColor(CatppuccinMocha.text);
          return;
        }

        // Show confirmation dialog with operations
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
        // :buckets command - return to root view
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
        // :bucket <name> command - switch to bucket
        const s3Adapter = adapter as any;
        if (s3Adapter.setBucket) {
          s3Adapter.setBucket(bucketName);
        }
        setBucket(bucketName);
        setStatusMessage(`Switched to bucket: ${bucketName}`);
        setStatusMessageColor(CatppuccinMocha.blue);
      },
      onCommand: (command: string) => {
        // Generic command handler for unrecognized commands
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

  // Setup keyboard events - use active buffer state
  const { handleKeyDown } = useKeyboardEvents(activeBufferState, keyboardHandlers);

  // Show error dialog if there's an error message
  const showErrorDialog = statusMessage && statusMessageColor === CatppuccinMocha.red;

  // Create a ref to store the confirm handler so it can be called from keyboard dispatcher
  const confirmHandlerRef = useRef<() => Promise<void>>(async () => {});

  // Create the confirm handler
  const createConfirmHandler = useCallback(async () => {
    setIsExecuting(true);
    try {
      // Create abort controller for this operation batch
      const abortController = new AbortController();
      operationAbortControllerRef.current = abortController;
      setProgressCancellable(true);

      // Execute each operation in order
      let successCount = 0;
      setShowProgress(true);
      setProgressTitle(`Executing ${pendingOperations[0]?.type || 'operation'}...`);

      for (let opIndex = 0; opIndex < pendingOperations.length; opIndex++) {
        const op = pendingOperations[opIndex];

        // Check if operation was cancelled
        if (abortController.signal.aborted) {
          setStatusMessage('Operation cancelled by user');
          setStatusMessageColor(CatppuccinMocha.yellow);
          break;
        }

        try {
          // Create progress callback for this operation
          const onProgress = (event: ProgressEvent) => {
            // Calculate overall progress considering current operation index
            const baseProgress = (opIndex / pendingOperations.length) * 100;
            const opProgress = event.percentage / pendingOperations.length;
            const totalProgress = Math.round(baseProgress + opProgress);

            setProgressValue(totalProgress);
            if (event.currentFile) {
              setProgressCurrentFile(event.currentFile);
            }
            setProgressDescription(event.operation);
          };

          // Update progress for operation start
          const progress = Math.round((opIndex / pendingOperations.length) * 100);
          setProgressValue(progress);
          setProgressDescription(`${op.type}: ${op.path || op.source || 'processing'}`);
          setProgressCurrentFile(op.path || op.source || '');
          setProgressCurrentNum(opIndex + 1);
          setProgressTotalNum(pendingOperations.length);

          switch (op.type) {
            case 'create': {
              await adapter.create(op.path, op.entryType || 'file', undefined, { onProgress });
              successCount++;
              break;
            }
            case 'delete': {
              await adapter.delete(op.path, true, { onProgress });
              successCount++;
              break;
            }
            case 'move': {
              await adapter.move(op.source, op.destination, { onProgress });
              successCount++;
              break;
            }
            case 'copy': {
              await adapter.copy(op.source, op.destination, { onProgress });
              successCount++;
              break;
            }
            case 'download': {
              if (adapter.downloadToLocal) {
                await adapter.downloadToLocal(op.source, op.destination, op.recursive || false, {
                  onProgress,
                });
                successCount++;
              }
              break;
            }
            case 'upload': {
              if (adapter.uploadFromLocal) {
                await adapter.uploadFromLocal(op.source, op.destination, op.recursive || false, {
                  onProgress,
                });
                successCount++;
              }
              break;
            }
          }
        } catch (opError) {
          // Check if error is due to cancellation
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

      // Reload buffer after operations complete
      if (successCount > 0) {
        try {
          // Reload the current directory to reflect changes
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
    } finally {
      setIsExecuting(false);
    }
  }, [pendingOperations, adapter, multiPaneLayout, bufferState]);

  // Update the ref whenever the handler changes
  useEffect(() => {
    confirmHandlerRef.current = createConfirmHandler;
  }, [createConfirmHandler]);

  // Create the cancel handler for operations
  const handleCancelOperation = useCallback(() => {
    if (operationAbortControllerRef.current) {
      operationAbortControllerRef.current.abort();
      setProgressCancellable(false);
    }
  }, []);

  // Create refs to handle dialog callbacks in keyboard dispatcher
  const showConfirmDialogRef = useRef(showConfirmDialog);

  useEffect(() => {
    showConfirmDialogRef.current = showConfirmDialog;
  }, [showConfirmDialog]);

  useEffect(() => {
    showUploadDialogRef.current = showUploadDialog;
  }, [showUploadDialog]);

  // Register global keyboard dispatcher on mount
  useEffect(() => {
    setGlobalKeyboardDispatcher((key: any) => {
      // Upload dialog - delegate to dialog handler
      if (showUploadDialogRef.current) {
        const handler = getDialogHandler('upload-dialog');
        if (handler) {
          handler(key.name);
        }
        return; // Block other keys when upload dialog is shown
      }

      // Confirmation dialog - handle y/n keys
      if (showConfirmDialogRef.current) {
        if (key.name === 'y') {
          // Call the confirm handler
          confirmHandlerRef.current();
          return;
        }
        if (key.name === 'n' || key.name === 'escape') {
          setShowConfirmDialog(false);
          setPendingOperations([]);
          return;
        }
        return; // Block other keys when confirmation dialog is shown
      }

      // Error dialog - block all input except escape
      if (showErrorDialog) {
        if (key.name === 'escape') {
          setStatusMessage('');
          setStatusMessageColor(CatppuccinMocha.text);
        }
        return; // Block all other keys when error is shown
      }

      // Sort menu shortcuts
      if (showSortMenu) {
        const currentBufferState = multiPaneLayout.getActiveBufferState() || bufferState;
        const currentSortConfig = currentBufferState.sortConfig;

        if (key.name === 'escape' || key.name === 'q') {
          setShowSortMenu(false);
          return;
        }

        // Number keys: 1=Name, 2=Size, 3=Modified, 4=Type
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

        // Space or Enter to toggle order
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

        return; // Block other keys when sort menu is shown
      }

      // Help dialog shortcuts
      if (showHelpDialog) {
        if (key.name === '?' || key.name === 'escape' || key.name === 'q') {
          setShowHelpDialog(false);
          return;
        }
        return; // Block other keys when help is shown
      }

      if (key.name === '?') {
        setShowHelpDialog(true);
        return;
      }

      // Upload dialog shortcut (press 'u' to upload)
      if (key.name === 'u') {
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

      // Redo (press 'Ctrl+r' or 'R' to redo)
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
  ]);

  // Initialize data from adapter
  useEffect(() => {
    const initializeData = async () => {
      try {
        console.error(`[S3Explorer] Initializing data...`);

        const currentBufferState = multiPaneLayout.getActiveBufferState() || bufferState;
        // Check if we're in root view mode (no bucket specified)
        if (!bucket) {
          console.error(`[S3Explorer] Root view mode detected, loading buckets...`);
          // Load buckets for root view
          const s3Adapter = adapter as any; // Cast to access S3-specific method
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
          // Load entries from specific bucket
          const path = currentBufferState.currentPath;
          console.error(`[S3Explorer] Loading bucket: ${bucket}, path: "${path}"`);
          const result = await adapter.list(path);
          console.error(`[S3Explorer] Received ${result.entries.length} entries`);
          console.error(
            `[S3Explorer] Entries:`,
            result.entries.map(e => e.name)
          );

          // Load entries into buffer state
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
        setIsInitialized(true); // Set initialized even on error so we show the error
        console.error('[S3Explorer] Initialized set to true after error');
      }
    };

    console.error(`[S3Explorer] useEffect triggered`);
    initializeData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bucket, adapter]);

  // Preview content when selection changes (only if preview is enabled)
  useEffect(() => {
    const fetchPreview = async () => {
      const currentBufferState = multiPaneLayout.getActiveBufferState() || bufferState;

      // Early exit if preview is disabled
      if (!previewEnabled) {
        setPreviewContent(null);
        return;
      }

      // Early exit if not in bucket view or not initialized
      if (!bucket || !isInitialized) {
        setPreviewContent(null);
        return;
      }

      // Early exit if multi-pane mode
      if (multiPaneLayout.isMultiPaneMode) {
        setPreviewContent(null);
        return;
      }

      const selectedEntry = currentBufferState.entries[currentBufferState.selection.cursorIndex];

      // Only preview files
      if (!selectedEntry || !isPreviewableFile(selectedEntry)) {
        setPreviewContent(null);
        setPreviewFilename('');
        return;
      }

      try {
        // Limit preview size to 100KB to avoid performance issues
        const maxPreviewSize = 100 * 1024;
        if (selectedEntry.size && selectedEntry.size > maxPreviewSize) {
          setPreviewContent(`File too large to preview (${formatBytes(selectedEntry.size)})`);
          setPreviewFilename('');
          return;
        }

        // Build full path for the selected file
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

  if (!isInitialized) {
    return (
      <text fg={CatppuccinMocha.blue} position="absolute" left={2} top={2}>
        Loading...
      </text>
    );
  }

  return (
    <box flexDirection="column" width="100%" height="100%">
      {/* Header */}
      <Header bucket={bucket} />

      {/* Main content area with panes - flex layout */}
      <box flexGrow={1} flexDirection="row" gap={1}>
        {multiPaneLayout.isMultiPaneMode && multiPaneLayout.panes.length > 1 ? (
          // Multi-pane mode
          multiPaneLayout.panes.map(pane => {
            const paneTitle = bucket
              ? `${bucket}${pane.bufferState.currentPath ? ':' + pane.bufferState.currentPath : ''}`
              : `Buckets`;

            return (
              <Pane
                key={pane.id}
                id={pane.id}
                bufferState={pane.bufferState}
                isActive={pane.isActive}
                title={paneTitle}
                showIcons={!terminalSize.isSmall}
                showSizes={!terminalSize.isSmall}
                showDates={!terminalSize.isMedium}
                flexGrow={1}
                flexShrink={1}
                flexBasis={0}
              />
            );
          })
        ) : (
          // Single pane mode - use main buffer state directly
          <>
            <Pane
              id="main-pane"
              bufferState={bufferState}
              isActive={true}
              title={
                bucket
                  ? `${bucket}${bufferState.currentPath ? ':' + bufferState.currentPath : ''}`
                  : `Buckets`
              }
              showHeader={false}
              showIcons={!terminalSize.isSmall}
              showSizes={!terminalSize.isSmall}
              showDates={!terminalSize.isMedium}
              flexGrow={previewEnabled ? 1 : 1}
              flexShrink={1}
              flexBasis={previewEnabled ? 0 : 0}
            />

            {/* Preview Pane - only in single pane mode when enabled */}
            {previewEnabled && previewContent !== null && (
              <PreviewPane content={previewContent} filename={previewFilename} visible={true} />
            )}
          </>
        )}
      </box>

      {/* Status Bar */}
      <box height={layout.footerHeight} flexShrink={0}>
        <StatusBar
          path={activeBufferState.currentPath}
          mode={activeBufferState.mode}
          message={statusMessage && !showErrorDialog ? statusMessage : undefined}
          messageColor={statusMessageColor}
          searchQuery={activeBufferState.searchQuery}
          commandBuffer={activeBufferState.editBuffer}
          bucket={bucket}
        />
      </box>

      {/* Overlays - positioned absolutely */}
      {/* Error Dialog - shows when there's an error */}
      {showErrorDialog && <ErrorDialog visible={true} message={statusMessage} />}

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <ConfirmationDialog
          title="Confirm Operations"
          operations={pendingOperations}
          visible={showConfirmDialog}
          onConfirm={createConfirmHandler}
          onCancel={() => {
            setShowConfirmDialog(false);
            setPendingOperations([]);
          }}
        />
      )}

      {/* Sort Menu Dialog */}
      {showSortMenu && (
        <SortMenu
          visible={showSortMenu}
          currentField={bufferState.sortConfig.field}
          currentOrder={bufferState.sortConfig.order}
          onFieldSelect={(field: SortField) => {
            const newConfig = {
              ...bufferState.sortConfig,
              field,
            };
            bufferState.setSortConfig(newConfig);
            const fieldName = field.charAt(0).toUpperCase() + field.slice(1);
            setStatusMessage(`Sorted by ${fieldName}`);
            setStatusMessageColor(CatppuccinMocha.green);
          }}
          onOrderToggle={() => {
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
          }}
          onClose={() => setShowSortMenu(false)}
        />
      )}

      {/* Help Dialog */}
      <HelpDialog visible={showHelpDialog} />

      {/* Upload Dialog */}
      <UploadDialog
        visible={showUploadDialog}
        destinationPath={activeBufferState.currentPath}
        onConfirm={selectedFiles => {
          setShowUploadDialog(false);
          // Create upload operations from selected files
          const currentPath = activeBufferState.currentPath;
          const newOperations = selectedFiles.map((filePath, index) => {
            // Extract filename from full path
            const filename = filePath.split('/').pop() || filePath;

            // Build S3 destination path (bucket + prefix + filename)
            const s3Destination = currentPath ? `${currentPath}${filename}` : filename;

            // Create entry object for display
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
        }}
        onCancel={() => setShowUploadDialog(false)}
      />

      {/* Progress Window */}
      <ProgressWindow
        visible={showProgress}
        title={progressTitle}
        description={progressDescription}
        progress={progressValue}
        currentFile={progressCurrentFile}
        currentFileNumber={progressCurrentNum}
        totalFiles={progressTotalNum}
        onCancel={handleCancelOperation}
        canCancel={progressCancellable}
      />
    </box>
  );
}
