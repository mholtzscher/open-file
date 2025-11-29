/**
 * Pane React component
 *
 * Encapsulates a single pane in a multi-pane layout.
 * Renders a buffer view with optional header and visual indicators.
 */

import { UseBufferStateReturn } from '../hooks/useBufferState.js';
import { BufferView } from './buffer-view.js';
import { CatppuccinMocha } from './theme.js';
import type { UsePendingOperationsReturn } from '../hooks/usePendingOperations.js';

export interface PaneProps {
  bufferState: UseBufferStateReturn;
  title?: string;
  showHeader?: boolean;
  showIcons?: boolean;
  showSizes?: boolean;
  showDates?: boolean;
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: number;
  /** Optional: New pending operations hook for global state management */
  pendingOps?: UsePendingOperationsReturn;
}

/**
 * Pane React component
 *
 * Renders a single pane with its buffer view, optional header,
 * and visual indicators for active state using flexbox layout.
 */
export function BufferPane({
  bufferState,
  title,
  showHeader = true,
  showIcons = true,
  showSizes = true,
  showDates = false,
  flexGrow = 1,
  flexShrink = 1,
  flexBasis = 0,
  pendingOps,
}: PaneProps) {
  return (
    <box
      flexGrow={flexGrow}
      flexShrink={flexShrink}
      flexBasis={flexBasis}
      flexDirection="column"
      borderStyle={'rounded'}
      borderColor={CatppuccinMocha.blue}
      paddingLeft={1}
      paddingRight={1}
      overflow="hidden"
    >
      {/* Pane header */}
      {showHeader && title && (
        <box height={1} flexShrink={0}>
          <text fg={CatppuccinMocha.blue} bg={CatppuccinMocha.surface0}>
            {title}
          </text>
        </box>
      )}

      {/* Buffer View */}
      <box flexGrow={1} overflow="hidden">
        <BufferView
          bufferState={bufferState}
          showIcons={showIcons}
          showSizes={showSizes}
          showDates={showDates}
          pendingOps={pendingOps}
        />
      </box>
    </box>
  );
}
