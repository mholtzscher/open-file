/**
 * S3Explorer React component
 *
 * Main application component that manages the S3 bucket exploration interface.
 * Declarative React component that uses hooks for state management and rendering.
 */

import { useEffect, useState, useMemo } from 'react';
import { Adapter } from '../adapters/adapter.js';
import { ConfigManager } from '../utils/config.js';
import { useBufferState } from '../hooks/useBufferState.js';
import { useKeyboardEvents } from '../hooks/useKeyboardEvents.js';
import { useNavigationHandlers } from '../hooks/useNavigationHandlers.js';
import { useTerminalSize, useLayoutDimensions } from '../hooks/useTerminalSize.js';
import { BufferView } from './buffer-view-react.js';
import { StatusBar } from './status-bar-react.js';
import { ConfirmationDialog } from './confirmation-dialog-react.js';
import { CatppuccinMocha } from './theme.js';
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

  // Track terminal size for responsive layout
  const terminalSize = useTerminalSize();
  const layout = useLayoutDimensions(terminalSize.size);

  // For S3, the path should be the prefix within the bucket, not the bucket name
  // Start at root of bucket (empty prefix)
  const initialPath = '';

  // Initialize buffer state
  const bufferState = useBufferState([], initialPath);

  // Update viewport height when layout changes
  useEffect(() => {
    bufferState.setViewportHeight(layout.contentHeight);
  }, [layout.contentHeight, bufferState.setViewportHeight]);

  // Setup navigation handlers config - memoized to prevent recreation
  const navigationConfig = useMemo(
    () => ({
      onLoadBuffer: async (path: string) => {
        try {
          const result = await adapter.list(path);

          // Update buffer state with new entries and current path
          // Create a new array to ensure React detects the change
          bufferState.setEntries([...result.entries]);
          bufferState.setCurrentPath(path);

          // Save original entries for change detection
          setOriginalEntries([...result.entries]);

          // Reset cursor to top of new directory
          bufferState.cursorToTop();

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
    [adapter, bufferState.setEntries, bufferState.setCurrentPath, bufferState.cursorToTop]
  );

  // Setup navigation handlers
  const navigationHandlers = useNavigationHandlers(bufferState, navigationConfig);

  // Setup keyboard event handlers - memoized to prevent stale closure
  // Note: j/k/v navigation is handled directly by useKeyboardEvents
  const keyboardHandlers = useMemo(
    () => ({
      onNavigateInto: async () => {
        // Check if we're navigating into a bucket from root view
        if (!bucket && bufferState.entries.length > 0) {
          const currentEntry = bufferState.entries[bufferState.selection.cursorIndex];
          if (currentEntry && currentEntry.type === 'bucket') {
            // EntryType.Bucket
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
        }
        // Otherwise, normal directory navigation
        await navigationHandlers.navigateInto();
      },
      onNavigateUp: async () => {
        // If we're in root view mode (no bucket set), can't navigate up
        if (!bucket) {
          setStatusMessage('Already at root');
          setStatusMessageColor(CatppuccinMocha.text);
          return;
        }

        const currentPath = bufferState.currentPath;
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
        const selected = bufferState.getSelectedEntries();
        if (selected.length > 0) {
          setPendingOperations(selected);
          setShowConfirmDialog(true);
        }
      },
      onPageDown: () => bufferState.moveCursorDown(10),
      onPageUp: () => bufferState.moveCursorUp(10),
      onSave: () => {
        // Detect changes between original and edited entries
        const changes = detectChanges(originalEntries, bufferState.entries, {} as EntryIdMap);

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
        bufferState.updateSearchQuery(query);
        if (query) {
          setStatusMessage(`Searching: ${query}`);
          setStatusMessageColor(CatppuccinMocha.blue);
        } else {
          setStatusMessage('Search cleared');
          setStatusMessageColor(CatppuccinMocha.text);
        }
      },
    }),
    [navigationHandlers, bufferState, bucket, showHelpDialog, setBucket, originalEntries, adapter]
  );

  // Setup keyboard events
  const { handleKeyDown } = useKeyboardEvents(bufferState, keyboardHandlers);

  // Register global keyboard dispatcher on mount
  useEffect(() => {
    setGlobalKeyboardDispatcher((key: any) => {
      handleKeyDown(key);
    });

    return () => {
      setGlobalKeyboardDispatcher(null);
    };
  }, [handleKeyDown]);

  // Initialize data from adapter
  useEffect(() => {
    const initializeData = async () => {
      try {
        console.error(`[S3Explorer] Initializing data...`);

        // Check if we're in root view mode (no bucket specified)
        if (!bucket) {
          console.error(`[S3Explorer] Root view mode detected, loading buckets...`);
          // Load buckets for root view
          const s3Adapter = adapter as any; // Cast to access S3-specific method
          if (s3Adapter.getBucketEntries) {
            const entries = await s3Adapter.getBucketEntries();
            console.error(`[S3Explorer] Received ${entries.length} buckets`);
            bufferState.setEntries([...entries]);
            bufferState.setCurrentPath('');
            setStatusMessage(`Found ${entries.length} bucket(s)`);
            setStatusMessageColor(CatppuccinMocha.green);
          } else {
            throw new Error('Adapter does not support bucket listing');
          }
        } else {
          // Load entries from specific bucket
          const path = bufferState.currentPath;
          console.error(`[S3Explorer] Loading bucket: ${bucket}, path: "${path}"`);
          const result = await adapter.list(path);
          console.error(`[S3Explorer] Received ${result.entries.length} entries`);
          console.error(
            `[S3Explorer] Entries:`,
            result.entries.map(e => e.name)
          );

          // Load entries into buffer state
          bufferState.setEntries([...result.entries]);
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
  }, [bucket, adapter, bufferState.setEntries]);

  if (!isInitialized) {
    return (
      <text fg={CatppuccinMocha.blue} position="absolute" left={2} top={2}>
        Loading...
      </text>
    );
  }

  // Show error panel if there's an error message
  const showErrorPanel = statusMessage && statusMessageColor === CatppuccinMocha.red;
  const errorPanelHeight = showErrorPanel ? 6 : 0;
  const adjustedContentHeight = showErrorPanel
    ? layout.contentHeight - errorPanelHeight
    : layout.contentHeight;

  return (
    <>
      {/* Header */}
      <text position="absolute" left={2} top={0} fg={CatppuccinMocha.blue}>
        open-s3: {bucket} ({terminalSize.width}x{terminalSize.height})
      </text>

      {/* Error Panel - shows when there's an error */}
      {showErrorPanel && (
        <box
          position="absolute"
          left={2}
          top={layout.headerHeight}
          width={terminalSize.width - 4}
          height={errorPanelHeight}
          borderStyle="rounded"
          borderColor={CatppuccinMocha.red}
          backgroundColor={CatppuccinMocha.base}
          title="ERROR"
        >
          <text position="absolute" left={2} top={1} right={2} fg={CatppuccinMocha.red}>
            {statusMessage}
          </text>
        </box>
      )}

      {/* Buffer View - responsive to terminal size */}
      <BufferView
        bufferState={bufferState}
        left={2}
        top={layout.headerHeight + errorPanelHeight}
        height={adjustedContentHeight}
        showIcons={!terminalSize.isSmall}
        showSizes={!terminalSize.isSmall}
        showDates={!terminalSize.isMedium}
      />

      {/* Status Bar */}
      <StatusBar
        path={bufferState.currentPath}
        mode={bufferState.mode}
        message={statusMessage && !showErrorPanel ? statusMessage : undefined}
        messageColor={statusMessageColor}
        searchQuery={bufferState.searchQuery}
        commandBuffer={bufferState.editBuffer}
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
                  const result = await adapter.list(bufferState.currentPath);
                  bufferState.setEntries([...result.entries]);
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

      {/* Help Dialog */}
      {showHelpDialog && (
        <box
          position="absolute"
          left={5}
          top={5}
          width={70}
          height={15}
          borderStyle="rounded"
          borderColor={CatppuccinMocha.yellow}
          backgroundColor={CatppuccinMocha.base}
          title="Help"
        >
          <text position="absolute" left={2} top={1} fg={CatppuccinMocha.text}>
            j/k - navigate | v - select | dd - delete | w - save | q - quit
          </text>
        </box>
      )}
    </>
  );
}
