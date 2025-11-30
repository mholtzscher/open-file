/**
 * FileExplorerLayout - Presentational layout component
 *
 * Renders the main layout structure with header, panes, status bar, and dialogs.
 * This is a pure presentational component that receives all state via props.
 */

import { UseBufferStateReturn } from '../hooks/useBufferState.js';
import { UseTerminalSizeReturn, LayoutDimensions } from '../hooks/useTerminalSize.js';

import { BufferPane } from './pane.js';
import { StatusBar } from './status-bar.js';
import { Header } from './header.js';
import { PreviewPane } from './preview-pane.js';
import { FileExplorerDialogs, DialogsState } from './file-explorer-dialogs.js';
import { Theme } from './theme.js';
import type { UsePendingOperationsReturn } from '../hooks/usePendingOperations.js';

/**
 * Props for the status bar display
 */
export interface StatusBarState {
  message: string;
  messageColor: string;
}

/**
 * Props for the preview pane
 */
export interface PreviewState {
  /** Preview content (text), if any */
  content: string | null;
  /** Filename associated with the preview */
  filename: string;
}

/**
 * Props for FileExplorerLayout
 */
export interface FileExplorerLayoutProps {
  /** Current bucket name or undefined for root view */
  bucket: string | undefined;

  /** Whether the component is initialized */
  isInitialized: boolean;

  /** Main buffer state */
  bufferState: UseBufferStateReturn;

  /** Terminal size information */
  terminalSize: UseTerminalSizeReturn;

  /** Layout dimensions */
  layout: LayoutDimensions;

  /** Status bar state */
  statusBar: StatusBarState;

  /** Preview pane state */
  preview: PreviewState;

  /** Dialog states */
  dialogs: DialogsState;

  /** Whether error dialog should be shown */
  showErrorDialog: boolean;

  /** Pending operations hook for global state management */
  pendingOps: UsePendingOperationsReturn;
}

/**
 * FileExplorerLayout - Main layout component
 *
 * Renders the entire UI layout including:
 * - Header with bucket info
 * - Main content panes (single or multi-pane mode)
 * - Preview pane (when enabled)
 * - Status bar
 * - All dialog overlays
 */
export function FileExplorerLayout({
  bucket,
  isInitialized,
  bufferState,
  terminalSize,
  layout,
  statusBar,
  preview,
  dialogs,
  showErrorDialog,
  pendingOps,
}: FileExplorerLayoutProps) {
  const showPreview = isInitialized && preview.content !== null;

  const title = bucket
    ? `${bucket}${bufferState.currentPath ? ':' + bufferState.currentPath : ''}`
    : 'Buckets';

  return (
    <box flexDirection="column" width="100%" height="100%">
      {/* Header */}
      <Header />

      {/* Main content area with buffer + optional preview */}
      <box flexGrow={1} flexDirection="row" gap={1}>
        {!isInitialized && (
          <box
            flexGrow={1}
            justifyContent="center"
            alignItems="center"
            borderStyle="rounded"
            borderColor={Theme.getInfoColor()}
          >
            <text fg={Theme.getInfoColor()}>Loading...</text>
          </box>
        )}

        {isInitialized && (
          <BufferPane
            bufferState={bufferState}
            title={title}
            showHeader={false}
            showIcons={!terminalSize.isSmall}
            showSizes={!terminalSize.isSmall}
            showDates={!terminalSize.isMedium}
            flexGrow={showPreview ? 3 : 1}
            flexShrink={1}
            flexBasis={0}
            pendingOps={pendingOps}
          />
        )}

        {showPreview && (
          <PreviewPane
            content={preview.content || undefined}
            filename={preview.filename}
            visible={true}
            flexGrow={2}
            flexShrink={1}
            flexBasis={0}
          />
        )}
      </box>

      {/* Status Bar */}
      <box height={layout.footerHeight} flexShrink={0}>
        <StatusBar
          path={bufferState.currentPath}
          mode={bufferState.mode}
          message={statusBar.message && !showErrorDialog ? statusBar.message : undefined}
          messageColor={statusBar.messageColor}
          searchQuery={bufferState.searchQuery}
          commandBuffer={bufferState.editBuffer}
          commandBufferCursor={bufferState.getEditBufferCursor()}
          bucket={bucket}
        />
      </box>

      {/* Dialog overlays */}
      <FileExplorerDialogs dialogs={dialogs} />
    </box>
  );
}
