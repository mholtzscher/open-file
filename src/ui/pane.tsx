/**
 * Pane React component
 *
 * Encapsulates a single pane in a multi-pane layout.
 * Renders a buffer view with optional header and visual indicators.
 * Uses BufferContext to access buffer state.
 */

import { BufferView } from './buffer-view.js';
import { Theme } from './theme.js';

export interface PaneProps {
  title?: string;
  showHeader?: boolean;
  showIcons?: boolean;
  showSizes?: boolean;
  showDates?: boolean;
  /** Terminal width for dynamic column sizing */
  terminalWidth?: number;
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
export function BufferPane({
  title,
  showHeader = true,
  showIcons = true,
  showSizes = true,
  showDates = false,
  terminalWidth,
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
      borderStyle={'rounded'}
      borderColor={Theme.getInfoColor()}
      paddingLeft={1}
      paddingRight={1}
      overflow="hidden"
    >
      {/* Pane header */}
      {showHeader && title && (
        <box height={1} flexShrink={0}>
          <text fg={Theme.getInfoColor()} bg={Theme.getBgSurface()}>
            {title}
          </text>
        </box>
      )}

      {/* Buffer View */}
      <box flexGrow={1} overflow="hidden">
        <BufferView
          showIcons={showIcons}
          showSizes={showSizes}
          showDates={showDates}
          terminalWidth={terminalWidth}
        />
      </box>
    </box>
  );
}
