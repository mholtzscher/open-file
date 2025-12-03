/**
 * BufferView React component
 *
 * Renders the entry list as a buffer that can be edited.
 * Similar to oil.nvim's approach - the buffer itself is the interface.
 * Uses BufferContext to access buffer state.
 * Uses OpenTUI's ScrollBox for viewport management and scrolling.
 */

import { useRef, useEffect } from 'react';
import type { ScrollBoxRenderable } from '@opentui/core';
import { Entry, EntryType } from '../types/entry.js';
import { useBuffer } from '../contexts/BufferContext.js';
import { Theme } from './theme.js';
import { EditMode } from '../types/edit-mode.js';
import { formatBytes } from '../utils/file-browser.js';

export interface BufferViewProps {
  showIcons?: boolean;
  showSizes?: boolean;
  showDates?: boolean;
  /** Terminal width for dynamic column sizing */
  terminalWidth?: number;
}

/**
 * Column widths for buffer display
 */
const DEFAULT_NAME_COLUMN_WIDTH = 30;
const MIN_NAME_COLUMN_WIDTH = 20;
const MAX_NAME_COLUMN_WIDTH = 80;
const META_COLUMN_WIDTH = 12;

/**
 * Calculate dynamic name column width based on terminal width
 * Targets roughly 30% of terminal width, clamped to reasonable bounds
 */
function calculateNameColumnWidth(terminalWidth: number | undefined): number {
  if (!terminalWidth) {
    return DEFAULT_NAME_COLUMN_WIDTH;
  }
  const dynamicWidth = Math.floor(terminalWidth * 0.3);
  return Math.max(MIN_NAME_COLUMN_WIDTH, Math.min(dynamicWidth, MAX_NAME_COLUMN_WIDTH));
}

/**
 * Format date for display
 */
function formatDate(date: Date | string | number | undefined): string {
  if (!date) return '-';
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: '2-digit',
  });
}

/**
 * Format the header row
 */
function formatHeader(
  showIcons: boolean,
  showSizes: boolean,
  showDates: boolean,
  nameColumnWidth: number
): string {
  const parts: string[] = [];

  // Icon placeholder
  if (showIcons) {
    parts.push('    '); // Same width as icon
  }

  // Name column
  parts.push('Name'.padEnd(nameColumnWidth));

  // Size column
  if (showSizes) {
    parts.push('Size'.padEnd(META_COLUMN_WIDTH));
  }

  // Date column
  if (showDates) {
    parts.push('Modified'.padEnd(META_COLUMN_WIDTH));
  }

  return '  ' + parts.join(''); // '  ' aligns with cursor space
}

/**
 * Format an entry for display
 */
function formatEntry(
  entry: Entry,
  showIcons: boolean,
  showSizes: boolean,
  showDates: boolean,
  nameColumnWidth: number
): string {
  const parts: string[] = [];

  // Icon
  if (showIcons) {
    let icon = '📄  ';
    if (entry.type === EntryType.Directory) {
      icon = '📁  ';
    } else if (entry.type === EntryType.Bucket) {
      icon = '🪣  ';
    }
    parts.push(icon);
  }

  // Name with directory suffix
  let suffix = '';
  if (entry.type === EntryType.Directory) {
    suffix = '/';
  }
  const nameWithSuffix = entry.name + suffix;
  // Truncate if too long, then pad to fixed width
  const truncatedName =
    nameWithSuffix.length > nameColumnWidth
      ? nameWithSuffix.slice(0, nameColumnWidth - 3) + '...'
      : nameWithSuffix;
  parts.push(truncatedName.padEnd(nameColumnWidth));

  // Size column
  if (showSizes) {
    parts.push(formatBytes(entry.size).padEnd(META_COLUMN_WIDTH));
  }

  // Date column
  if (showDates) {
    parts.push(formatDate(entry.modified).padEnd(META_COLUMN_WIDTH));
  }

  return parts.join('');
}

/**
 * Get entry color based on type and selection state
 */
function getEntryColor(entry: Entry, isSelected: boolean): string {
  if (entry.type === EntryType.Directory || entry.type === EntryType.Bucket) {
    return Theme.getDirectoryColor(isSelected);
  }

  return Theme.getFileColor(isSelected);
}

/**
 * BufferView header component
 */
interface BufferViewHeaderProps {
  showIcons: boolean;
  showSizes: boolean;
  showDates: boolean;
  nameColumnWidth: number;
}

function BufferViewHeader({
  showIcons,
  showSizes,
  showDates,
  nameColumnWidth,
}: BufferViewHeaderProps) {
  return (
    <text fg={Theme.getMutedColor()}>
      {formatHeader(showIcons, showSizes, showDates, nameColumnWidth)}
    </text>
  );
}

/**
 * BufferView React component
 */
export function BufferView({
  showIcons = true,
  showSizes = true,
  showDates = false,
  terminalWidth,
}: BufferViewProps) {
  // Get buffer state from context
  const bufferState = useBuffer();

  // Ref for programmatic scrolling
  const scrollBoxRef = useRef<ScrollBoxRenderable>(null);

  // Calculate dynamic name column width based on terminal size
  const nameColumnWidth = calculateNameColumnWidth(terminalWidth);
  // Use filtered entries when searching
  const filteredEntries = bufferState.getFilteredEntries();
  const entries =
    filteredEntries.length < bufferState.entries.length && bufferState.searchQuery
      ? filteredEntries
      : bufferState.entries;

  const cursorIndex = bufferState.selection.cursorIndex;

  // Check if in insert mode
  const isInsertMode = bufferState.mode === EditMode.Insert;
  const editBuffer = bufferState.editBuffer || '';

  // Scroll to keep cursor visible when it changes
  useEffect(() => {
    if (scrollBoxRef.current && entries.length > 0) {
      scrollBoxRef.current.scrollTo({ x: 0, y: cursorIndex });
    }
  }, [cursorIndex, entries.length]);

  // If no entries, show empty indicator (but still allow insert mode)
  if (entries.length === 0 && !isInsertMode) {
    return (
      <box flexDirection="column" width="100%" height="100%">
        <text fg={Theme.getEmptyStateColor()}>&lt;empty&gt;</text>
      </box>
    );
  }

  return (
    <box flexDirection="column" width="100%" height="100%">
      <BufferViewHeader
        showIcons={showIcons}
        showSizes={showSizes}
        showDates={showDates}
        nameColumnWidth={nameColumnWidth}
      />
      <scrollbox ref={scrollBoxRef} flexGrow={1} scrollY={true} viewportCulling={true}>
        {entries.map((entry, idx) => {
          const isSelected = idx === cursorIndex;
          const isInVisualSelection =
            bufferState.selection.isActive &&
            bufferState.selection.selectionStart !== undefined &&
            idx >=
              Math.min(
                bufferState.selection.selectionStart,
                bufferState.selection.selectionEnd ?? bufferState.selection.selectionStart
              ) &&
            idx <=
              Math.max(
                bufferState.selection.selectionStart,
                bufferState.selection.selectionEnd ?? bufferState.selection.selectionStart
              );

          const cursor = isSelected ? '> ' : '  ';
          const content =
            cursor + formatEntry(entry, showIcons, showSizes, showDates, nameColumnWidth);
          const color = getEntryColor(entry, isSelected);

          return (
            <text
              key={entry.id}
              fg={color}
              bg={isInVisualSelection ? Theme.getBgSurface() : undefined}
            >
              {content}
            </text>
          );
        })}
      </scrollbox>
      {/* Show insert mode input line */}
      {isInsertMode && (
        <text fg={Theme.getInsertModeColor()} bg={Theme.getBgSurface()}>
          {'> + 📄  '}
          {editBuffer}
          {'_'}
        </text>
      )}
    </box>
  );
}
