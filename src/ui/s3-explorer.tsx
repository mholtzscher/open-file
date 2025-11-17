/**
 * S3Explorer React component
 *
 * Main application component that manages the S3 bucket exploration interface.
 * Declarative React component that uses hooks for state management and rendering.
 */

import { useEffect, useState, useMemo, useRef } from 'react';
import { Adapter } from '../adapters/adapter.js';
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
import { CatppuccinMocha } from './theme.js';
import { ErrorDialog } from './error-dialog-react.js';
import { parseAwsError, formatErrorForDisplay } from '../utils/errors.js';
import { setGlobalKeyboardDispatcher } from '../index.tsx';
import { detectChanges, buildOperationPlan } from '../utils/change-detection.js';
import { EntryIdMap } from '../utils/entry-id.js';

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
  const [pendingOperations, setPendingOperations] = useState<any[]>([]);
  const [originalEntries, setOriginalEntries] = useState<any[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [previewContent, setPreviewContent] = useState<string>('');
  const [previewEnabled, setPreviewEnabled] = useState(false);

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
  const multiPaneLayout = useMultiPaneLayout(terminalSize.size, layout);

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
      onTogglePreview: () => {
        // Manual toggle - enable/disable preview mode
        if (previewEnabled) {
          setPreviewEnabled(false);
          setPreviewContent('');
          setStatusMessage('Preview disabled');
          setStatusMessageColor(CatppuccinMocha.text);
        } else {
          // Enable preview mode - content will be fetched by effect
          setPreviewEnabled(true);
          setStatusMessage('Preview enabled');
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

  // Register global keyboard dispatcher on mount
  useEffect(() => {
    setGlobalKeyboardDispatcher((key: any) => {
      // Error dialog - block all input except escape
      if (showErrorDialog) {
        if (key.name === 'escape') {
          setStatusMessage('');
          setStatusMessageColor(CatppuccinMocha.text);
        }
        return; // Block all other keys when error is shown
      }

      // Help dialog shortcuts
      if (showHelpDialog) {
        if (key.name === '?' || key.name === 'escape') {
          setShowHelpDialog(false);
          return;
        }
        return; // Block other keys when help is shown
      }

      if (key.name === '?') {
        setShowHelpDialog(true);
        return;
      }

      // Pass to normal keyboard handler
      handleKeyDown(key);
    });

    return () => {
      setGlobalKeyboardDispatcher(null);
    };
  }, [handleKeyDown, showHelpDialog, showErrorDialog, statusMessage, statusMessageColor]);

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
        setPreviewContent('');
        return;
      }

      // Early exit if not in bucket view or not initialized
      if (!bucket || !isInitialized) {
        setPreviewContent('');
        return;
      }

      // Early exit if multi-pane mode
      if (multiPaneLayout.isMultiPaneMode) {
        setPreviewContent('');
        return;
      }

      const selectedEntry = currentBufferState.entries[currentBufferState.selection.cursorIndex];

      // Only preview files
      if (!selectedEntry || !isPreviewableFile(selectedEntry)) {
        setPreviewContent('');
        return;
      }

      try {
        // Limit preview size to 100KB to avoid performance issues
        const maxPreviewSize = 100 * 1024;
        if (selectedEntry.size && selectedEntry.size > maxPreviewSize) {
          setPreviewContent(`File too large to preview (${formatBytes(selectedEntry.size)})`);
          return;
        }

        // Build full path for the selected file
        const fullPath = currentBufferState.currentPath
          ? `${currentBufferState.currentPath}${selectedEntry.name}`
          : selectedEntry.name;

        const buffer = await adapter.read(fullPath);
        const content = buffer.toString('utf-8');
        setPreviewContent(content);
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
    <>
      {/* Header */}
      <text position="absolute" left={2} top={0} fg={CatppuccinMocha.blue}>
        open-s3: {bucket}
      </text>

      {/* Error Dialog - shows when there's an error */}
      {showErrorDialog && <ErrorDialog visible={true} message={statusMessage} />}

      {/* Multi-pane layout or single pane */}
      {multiPaneLayout.isMultiPaneMode && multiPaneLayout.panes.length > 1 ? (
        // Multi-pane mode
        multiPaneLayout.panes.map((pane, index) => {
          const dimensions =
            multiPaneLayout.paneDimensions[index] || multiPaneLayout.paneDimensions[0];
          const paneTitle = bucket
            ? `${bucket}${pane.bufferState.currentPath ? ':' + pane.bufferState.currentPath : ''}`
            : `Buckets`;

          return (
            <Pane
              key={pane.id}
              id={pane.id}
              bufferState={pane.bufferState}
              left={dimensions.left}
              top={dimensions.top}
              width={dimensions.width}
              height={dimensions.height}
              isActive={pane.isActive}
              title={paneTitle}
              showIcons={!terminalSize.isSmall}
              showSizes={!terminalSize.isSmall}
              showDates={!terminalSize.isMedium}
            />
          );
        })
      ) : (
        // Single pane mode - use main buffer state directly
        <Pane
          id="main-pane"
          bufferState={bufferState}
          left={2}
          top={layout.headerHeight}
          width={
            previewEnabled
              ? Math.floor(terminalSize.size.width * 0.5)
              : Math.max(terminalSize.size.width - 4, 40)
          }
          height={layout.contentHeight}
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
        />
      )}

      {/* Status Bar */}
      <StatusBar
        path={activeBufferState.currentPath}
        mode={activeBufferState.mode}
        message={statusMessage && !showErrorDialog ? statusMessage : undefined}
        messageColor={statusMessageColor}
        searchQuery={activeBufferState.searchQuery}
        commandBuffer={activeBufferState.editBuffer}
        bucket={bucket}
      />

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <ConfirmationDialog
          title="Confirm Operations"
          operations={pendingOperations}
          visible={showConfirmDialog}
          onConfirm={async () => {
            setIsExecuting(true);
            try {
              // Execute each operation in order
              let successCount = 0;
              for (const op of pendingOperations) {
                try {
                  switch (op.type) {
                    case 'create': {
                      await adapter.create(op.path, op.entryType || 'file');
                      successCount++;
                      break;
                    }
                    case 'delete': {
                      await adapter.delete(op.path, true);
                      successCount++;
                      break;
                    }
                    case 'move': {
                      await adapter.move(op.source, op.destination);
                      successCount++;
                      break;
                    }
                    case 'copy': {
                      await adapter.copy(op.source, op.destination);
                      successCount++;
                      break;
                    }
                  }
                } catch (opError) {
                  console.error(`Failed to execute ${op.type} operation:`, opError);
                  const parsedError = parseAwsError(opError, `Failed to ${op.type}`);
                  setStatusMessage(`Operation failed: ${formatErrorForDisplay(parsedError, 70)}`);
                  setStatusMessageColor(CatppuccinMocha.red);
                }
              }

              // Reload buffer after operations complete
              if (successCount > 0) {
                try {
                  const currentBufferState = multiPaneLayout.getActiveBufferState() || bufferState;
                  const result = await adapter.list(currentBufferState.currentPath);
                  currentBufferState.setEntries([...result.entries]);
                  setOriginalEntries([...result.entries]);
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
          }}
          onCancel={() => {
            setShowConfirmDialog(false);
            setPendingOperations([]);
          }}
        />
      )}

      {/* Preview Pane - only in single pane mode when enabled */}
      {previewEnabled && !multiPaneLayout.isMultiPaneMode && previewContent && (
        <PreviewPane
          content={previewContent}
          left={Math.floor(terminalSize.size.width * 0.5) + 4}
          top={layout.headerHeight}
          width={Math.floor(terminalSize.size.width * 0.5) - 6}
          height={layout.contentHeight}
          visible={true}
        />
      )}

      {/* Help Dialog */}
      <HelpDialog visible={showHelpDialog} />
    </>
  );
}
