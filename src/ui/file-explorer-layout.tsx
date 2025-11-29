/**
 * S3ExplorerLayout - Presentational layout component
 *
 * Renders the main layout structure with header, panes, status bar, and dialogs.
 * This is a pure presentational component that receives all state via props.
 */

import { MultiPaneLayout } from '../hooks/useMultiPaneLayout.js';
import { UseBufferStateReturn } from '../hooks/useBufferState.js';
import { UseTerminalSizeReturn, LayoutDimensions } from '../hooks/useTerminalSize.js';

import { Pane } from './pane.js';
import { StatusBar } from './status-bar.js';
import { Header } from './header.js';
import { PreviewPane } from './preview-pane.js';
import { S3ExplorerDialogs, DialogsState } from './file-explorer-dialogs.js';
import { CatppuccinMocha } from './theme.js';

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
  enabled: boolean;
  content: string | null;
  filename: string;
}

/**
 * Props for S3ExplorerLayout
 */
export interface S3ExplorerLayoutProps {
  /** Current bucket name or undefined for root view */
  bucket: string | undefined;

  /** Whether the component is initialized */
  isInitialized: boolean;

  /** Main buffer state for single pane mode */
  bufferState: UseBufferStateReturn;

  /** Active buffer state (from multi-pane or main) */
  activeBufferState: UseBufferStateReturn;

  /** Multi-pane layout state */
  multiPaneLayout: MultiPaneLayout;

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
}

/**
 * S3ExplorerLayout - Main layout component
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
  activeBufferState,
  multiPaneLayout,
  terminalSize,
  layout,
  statusBar,
  preview,
  dialogs,
  showErrorDialog,
}: S3ExplorerLayoutProps) {
  // Loading state
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
      <Header />

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
              flexGrow={preview.enabled ? 1 : 1}
              flexShrink={1}
              flexBasis={preview.enabled ? 0 : 0}
            />

            {/* Preview Pane - only in single pane mode when enabled */}
            {preview.enabled && preview.content !== null && (
              <PreviewPane content={preview.content} filename={preview.filename} visible={true} />
            )}
          </>
        )}
      </box>

      {/* Status Bar */}
      <box height={layout.footerHeight} flexShrink={0}>
        <StatusBar
          path={activeBufferState.currentPath}
          mode={activeBufferState.mode}
          message={statusBar.message && !showErrorDialog ? statusBar.message : undefined}
          messageColor={statusBar.messageColor}
          searchQuery={activeBufferState.searchQuery}
          commandBuffer={activeBufferState.editBuffer}
          bucket={bucket}
        />
      </box>

      {/* Dialog overlays */}
      <S3ExplorerDialogs dialogs={dialogs} />
    </box>
  );
}
