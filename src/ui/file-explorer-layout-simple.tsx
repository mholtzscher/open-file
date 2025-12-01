/**
 * FileExplorerLayoutSimple - Presentational layout component (without dialogs)
 *
 * Renders the main layout structure with header, panes, and status bar.
 * Dialogs are managed separately by DialogProvider.
 */

import { UseBufferStateReturn } from '../hooks/useBufferState.js';
import { UseTerminalSizeReturn, LayoutDimensions } from '../hooks/useTerminalSize.js';

import { BufferPane } from './pane.js';
import { StatusBar } from './status-bar.js';
import { Header } from './header.js';
import { PreviewPane } from './preview-pane.js';
import { Theme } from './theme.js';
import type { UsePendingOperationsReturn } from '../hooks/usePendingOperations.js';

export interface PreviewState {
  content: string | null;
  filename: string;
}

export interface FileExplorerLayoutSimpleProps {
  bucket: string | undefined;
  isInitialized: boolean;
  bufferState: UseBufferStateReturn;
  terminalSize: UseTerminalSizeReturn;
  layout: LayoutDimensions;
  statusMessage: string;
  statusMessageColor: string;
  showErrorDialog: boolean;
  preview: PreviewState;
  pendingOps: UsePendingOperationsReturn;
}

export function FileExplorerLayoutSimple({
  bucket,
  isInitialized,
  bufferState,
  terminalSize,
  layout,
  statusMessage,
  statusMessageColor,
  showErrorDialog,
  preview,
  pendingOps,
}: FileExplorerLayoutSimpleProps) {
  const showPreview = isInitialized && preview.content !== null;

  const title = bucket
    ? `${bucket}${bufferState.currentPath ? ':' + bufferState.currentPath : ''}`
    : 'Buckets';

  return (
    <box flexDirection="column" width="100%" height="100%">
      <Header />

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

      <box height={layout.footerHeight} flexShrink={0}>
        <StatusBar
          path={bufferState.currentPath}
          mode={bufferState.mode}
          message={statusMessage && !showErrorDialog ? statusMessage : undefined}
          messageColor={statusMessageColor}
          searchQuery={bufferState.searchQuery}
          commandBuffer={bufferState.editBuffer}
          commandBufferCursor={bufferState.getEditBufferCursor()}
          bucket={bucket}
        />
      </box>
    </box>
  );
}
