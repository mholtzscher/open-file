/**
 * BufferView React component
 * 
 * Renders the entry list as a buffer that can be edited.
 * Similar to oil.nvim's approach - the buffer itself is the interface.
 */

import { Entry, EntryType } from '../types/entry.js';
import { UseBufferStateReturn } from '../hooks/useBufferState.js';
import { Theme } from './theme.js';
import { Column, getDefaultColumns, renderRow } from './columns.js';

export interface BufferViewProps {
  bufferState: UseBufferStateReturn;
  left?: number;
  top?: number;
  height?: number;
  columns?: Column[];
  // Deprecated - use columns config instead
  showIcons?: boolean;
  showSizes?: boolean;
  showDates?: boolean;
}

/**
 * Legacy format functions for backward compatibility
 */
function formatSize(size: number | undefined): string {
  if (!size) return '-';
  if (size > 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)}MB`;
  }
  if (size > 1024) {
    return `${(size / 1024).toFixed(1)}KB`;
  }
  return `${size}B`;
}

function formatDate(date: Date | undefined): string {
  if (!date) return '-';
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: '2-digit',
  });
}

/**
 * Format an entry for display (legacy - use columns instead)
 */
function formatEntry(entry: Entry, _isSelected: boolean, showIcons: boolean, showSizes: boolean, showDates: boolean): string {
  const parts: string[] = [];

  // Icon
  if (showIcons) {
    parts.push(entry.type === EntryType.Directory ? '📁  ' : '📄  ');
  }

  // Name with directory suffix
  const suffix = entry.type === EntryType.Directory ? '/' : '';
  parts.push((entry.name + suffix).padEnd(30));

  // Size
  if (showSizes) {
    parts.push(formatSize(entry.size).padEnd(12));
  }

  // Date
  if (showDates) {
    parts.push(formatDate(entry.modified).padEnd(12));
  }

  return parts.join('');
}

/**
 * Get entry color
 */
function getEntryColor(entry: Entry, isSelected: boolean): string {
  if (entry.type === EntryType.Directory) {
    return Theme.getDirectoryColor(isSelected);
  }
  return Theme.getFileColor(isSelected);
}

/**
 * Apply text styling using ANSI escape codes
 */
function applyTextStyle(text: string, bold?: boolean): string {
  if (!bold) return text;
  // ANSI escape code for bold: \x1b[1m ... \x1b[0m
  return `\x1b[1m${text}\x1b[0m`;
}

/**
 * BufferView React component
 */
export function BufferView({
  bufferState,
  left = 2,
  top = 3,
  height = 20,
  columns,
  // Legacy props for backward compatibility
  showIcons = true,
  showSizes = true,
  showDates = false,
}: BufferViewProps) {
  const entries = bufferState.entries;
  const cursorIndex = bufferState.selection.cursorIndex;

  // Use provided columns or create default based on legacy props
  const activeColumns = columns ?? (() => {
    const defaultCols = getDefaultColumns();
    return defaultCols.map(col => {
      if (col.id === 'icon') col.visible = showIcons;
      if (col.id === 'size') col.visible = showSizes;
      if (col.id === 'modified') col.visible = showDates;
      return col;
    });
  })();

  // Get visible entries (with scroll offset)
  const visibleEntries = entries.slice(bufferState.scrollOffset, bufferState.scrollOffset + height);

  return (
    <>
      {visibleEntries.map((entry, idx) => {
        const realIndex = bufferState.scrollOffset + idx;
        const isSelected = realIndex === cursorIndex;
        const isInVisualSelection =
          bufferState.selection.isActive &&
          bufferState.selection.selectionStart !== undefined &&
          realIndex >= Math.min(bufferState.selection.selectionStart, bufferState.selection.selectionEnd ?? bufferState.selection.selectionStart) &&
          realIndex <= Math.max(bufferState.selection.selectionStart, bufferState.selection.selectionEnd ?? bufferState.selection.selectionStart);

        const cursor = isSelected ? '> ' : '  ';
        // Use column system for rendering
        const rowContent = renderRow(entry, activeColumns);
        
        // Get style for entry
        const style = Theme.getEntryStyle(
          entry.type === EntryType.Directory ? 'directory' : 'file',
          isSelected,
          isInVisualSelection
        );

        // Apply text styling
        const styledContent = applyTextStyle(cursor + rowContent, style.bold);

        return (
          <text
            key={entry.id}
            position="absolute"
            left={left}
            top={top + idx}
            fg={style.fg}
            bg={style.bg}
          >
            {styledContent}
          </text>
        );
      })}
    </>
  );
}
