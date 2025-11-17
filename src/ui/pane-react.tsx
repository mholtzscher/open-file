/**
 * Pane React component
 *
 * Encapsulates a single pane in a multi-pane layout.
 * Renders a buffer view with optional header and visual indicators.
 */

import { UseBufferStateReturn } from '../hooks/useBufferState.js';
import { BufferView } from './buffer-view-react.js';
import { CatppuccinMocha } from './theme.js';

export interface PaneProps {
  id: string;
  bufferState: UseBufferStateReturn;
  left: number;
  top: number;
  width: number;
  height: number;
  isActive: boolean;
  title?: string;
  showHeader?: boolean;
  showIcons?: boolean;
  showSizes?: boolean;
  showDates?: boolean;
}

/**
 * Pane React component
 *
 * Renders a single pane with its buffer view, optional header,
 * and visual indicators for active state.
 */
export function Pane({
  id: _paneId,
  bufferState,
  left,
  top,
  width,
  height,
  isActive,
  title,
  showHeader = true,
  showIcons = true,
  showSizes = true,
  showDates = false,
}: PaneProps) {
  const headerHeight = showHeader ? 1 : 0;
  const contentHeight = height - headerHeight;
  const contentTop = top + headerHeight;

  // Truncate title to fit pane width
  const truncatedTitle = title
    ? title.length > width - 4
      ? title.substring(0, width - 7) + '...'
      : title
    : '';

  return (
    <>
      {/* Pane border - show for active pane */}
      {isActive && (
        <>
          {/* Top border */}
          <text position="absolute" left={left - 1} top={top - 1} fg={CatppuccinMocha.blue}>
            {'┌' + '─'.repeat(width + 1) + '┐'}
          </text>

          {/* Bottom border */}
          <text position="absolute" left={left - 1} top={top + height} fg={CatppuccinMocha.blue}>
            {'└' + '─'.repeat(width + 1) + '┘'}
          </text>

          {/* Left border */}
          <text position="absolute" left={left - 1} top={top} fg={CatppuccinMocha.blue}>
            {Array.from({ length: height }, () => '│').join('\n')}
          </text>

          {/* Right border */}
          <text position="absolute" left={left + width} top={top} fg={CatppuccinMocha.blue}>
            {Array.from({ length: height }, () => '│').join('\n')}
          </text>
        </>
      )}

      {/* Pane header */}
      {showHeader && (
        <text
          position="absolute"
          left={left}
          top={top}
          fg={isActive ? CatppuccinMocha.blue : CatppuccinMocha.subtext1}
          bg={isActive ? CatppuccinMocha.surface0 : undefined}
        >
          {truncatedTitle.padEnd(width)}
        </text>
      )}

      {/* Buffer View */}
      <BufferView
        bufferState={bufferState}
        left={left}
        top={contentTop}
        height={contentHeight}
        showIcons={showIcons}
        showSizes={showSizes}
        showDates={showDates}
      />
    </>
  );
}
