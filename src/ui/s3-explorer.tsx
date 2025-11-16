/**
 * S3Explorer React component
 * 
 * Main application component that manages the S3 bucket exploration interface.
 * Declarative React component that uses hooks for state management and rendering.
 */

import { useEffect, useState, useRef, useMemo } from 'react';
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
import { parseAwsError } from '../utils/errors.js';
import { setGlobalKeyboardDispatcher } from '../index.tsx';

interface S3ExplorerProps {
  bucket: string;
  adapter: Adapter;
  configManager: ConfigManager;
}

/**
 * Main S3Explorer component - declarative React implementation
 */
export function S3Explorer({ bucket, adapter, configManager }: S3ExplorerProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [statusMessageColor, setStatusMessageColor] = useState<string>(CatppuccinMocha.text);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const [pendingOperations, setPendingOperations] = useState<any[]>([]);
  const keyboardHandlersRef = useRef<any>(null);

  // Track terminal size for responsive layout
  const terminalSize = useTerminalSize();
  const layout = useLayoutDimensions(terminalSize.size);

  const currentPath = bucket.endsWith('/') ? bucket : bucket + '/';

  // Initialize buffer state
  const bufferState = useBufferState([], currentPath);

   // Setup navigation handlers
   const navigationHandlers = useNavigationHandlers(bufferState, {
     onLoadBuffer: async (path: string) => {
       try {
         const result = await adapter.list(path);
         
         // Update buffer state with new entries and current path
         const currentEntries = bufferState.entries;
         currentEntries.length = 0;
         currentEntries.push(...result.entries);
         
         // Update current path in buffer state
         bufferState.currentPath = path;
         
         // Reset cursor to top of new directory
         bufferState.cursorToTop();
         
         setStatusMessage(`Navigated to ${path}`);
         setStatusMessageColor(CatppuccinMocha.green);
       } catch (err) {
         const parsedError = parseAwsError(err, 'Navigation failed');
         setStatusMessage(parsedError.message);
         setStatusMessageColor(CatppuccinMocha.red);
       }
     },
     onErrorOccurred: (error: string) => {
       setStatusMessage(error);
       setStatusMessageColor(CatppuccinMocha.red);
     },
   });

  // Setup keyboard event handlers - memoized to prevent stale closure
  // Note: j/k/v navigation is handled directly by useKeyboardEvents
  const keyboardHandlers = useMemo(
    () => ({
      onNavigateInto: () => navigationHandlers.navigateInto(),
      onDelete: () => {
        const selected = bufferState.getSelectedEntries();
        if (selected.length > 0) {
          setPendingOperations(selected);
          setShowConfirmDialog(true);
        }
      },
      onPageDown: () => bufferState.moveCursorDown(10),
      onPageUp: () => bufferState.moveCursorUp(10),
      onQuit: () => process.exit(0),
      onShowHelp: () => setShowHelpDialog(!showHelpDialog),
    }),
    [navigationHandlers, bufferState]
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
         const result = await adapter.list(currentPath);
         
         // Load entries into buffer state
         // Clear existing entries and add new ones
         const currentEntries = bufferState.entries;
         currentEntries.length = 0;
         currentEntries.push(...result.entries);
         
         setStatusMessage(`Loaded ${result.entries.length} items`);
         setStatusMessageColor(CatppuccinMocha.green);
         setIsInitialized(true);
       } catch (err) {
         const parsedError = parseAwsError(err, 'Failed to load bucket');
         setStatusMessage(parsedError.message);
         setStatusMessageColor(CatppuccinMocha.red);
       }
     };

     initializeData();
   }, [bucket, adapter, currentPath, bufferState]);

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
      <text
        position="absolute"
        left={2}
        top={0}
        fg={CatppuccinMocha.blue}
      >
        open-s3: {bucket} ({terminalSize.width}x{terminalSize.height})
      </text>

      {/* Buffer View - responsive to terminal size */}
      <BufferView
        bufferState={bufferState}
        left={2}
        top={layout.headerHeight}
        height={layout.contentHeight}
        showIcons={!terminalSize.isSmall}
        showSizes={!terminalSize.isSmall}
        showDates={!terminalSize.isMedium}
      />

      {/* Status Bar */}
      <StatusBar
        path={bufferState.currentPath}
        mode={bufferState.mode}
        message={statusMessage}
        messageColor={statusMessageColor}
        searchQuery={bufferState.searchQuery}
      />

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <ConfirmationDialog
          title="Confirm Delete"
          operations={pendingOperations.map((entry: any) => ({
            id: entry.id,
            type: 'delete' as const,
            path: entry.path,
          }))}
          visible={showConfirmDialog}
          onConfirm={() => {
            setStatusMessage('Operations completed');
            setStatusMessageColor(CatppuccinMocha.green);
            setShowConfirmDialog(false);
            setPendingOperations([]);
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
          <text
            position="absolute"
            left={2}
            top={1}
            fg={CatppuccinMocha.text}
          >
            j/k - navigate  |  v - select  |  dd - delete  |  w - save  |  q - quit
          </text>
        </box>
      )}
    </>
  );
}
