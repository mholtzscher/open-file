/**
 * Pane React component
 *
 * Encapsulates a single pane in a multi-pane layout.
 * Renders a buffer view with optional header and visual indicators.
 */

import { UseBufferStateReturn } from '../hooks/useBufferState.js';
import { BufferView } from './buffer-view.js';
import { CatppuccinMocha } from './theme.js';

export interface PaneProps {
  id: string;
  bufferState: UseBufferStateReturn;
  isActive: boolean;
  title?: string;
  showHeader?: boolean;
  showIcons?: boolean;
  showSizes?: boolean;
  showDates?: boolean;
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: number;
}

/**
 * Pane React component
 *
 * Renders a single pane with its buffer view, optional header,
 * and visual indicators for active state using flexbox layout.
 */
export function Pane({
  id: _paneId,
  bufferState,
  isActive,
  title,
  showHeader = true,
  showIcons = true,
  showSizes = true,
  showDates = false,
  flexGrow = 1,
  flexShrink = 1,
  flexBasis = 0,
}: PaneProps) {
  return (
    <box
      flexGrow={flexGrow}
      flexShrink={flexShrink}
      flexBasis={flexBasis}
      flexDirection="column"
      borderStyle={isActive ? 'rounded' : undefined}
      borderColor={isActive ? CatppuccinMocha.blue : undefined}
      paddingLeft={1}
      paddingRight={1}
      overflow="hidden"
    >
      {/* Pane header */}
      {showHeader && title && (
        <box height={1} flexShrink={0}>
          <text
            fg={isActive ? CatppuccinMocha.blue : CatppuccinMocha.subtext1}
            bg={isActive ? CatppuccinMocha.surface0 : undefined}
          >
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
        />
      </box>
    </box>
  );
}
