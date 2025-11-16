/**
 * BufferView React component
 * 
 * Renders the entry list as a buffer that can be edited.
 * Similar to oil.nvim's approach - the buffer itself is the interface.
 */

import { Entry, EntryType } from '../types/entry.js';
import { BufferState } from './buffer-state.js';
import { Theme, CatppuccinMocha } from './theme.js';

export interface BufferViewProps {
  bufferState: BufferState;
  left?: number;
  top?: number;
  height?: number;
  showIcons?: boolean;
  showSizes?: boolean;
  showDates?: boolean;
}

/**
 * Format size for display
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

/**
 * Format date for display
 */
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
 * Format an entry for display
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
 * BufferView React component
 */
export function BufferView({
  bufferState,
  left = 2,
  top = 3,
  height = 20,
  showIcons = true,
  showSizes = true,
  showDates = false,
}: BufferViewProps) {
  const entries = bufferState.entries;
  const cursorIndex = bufferState.selection.cursorIndex;

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
        const content = cursor + formatEntry(entry, isSelected, showIcons, showSizes, showDates);
        const color = getEntryColor(entry, isSelected);

        return (
          <text
            key={entry.id}
            position="absolute"
            left={left}
            top={top + idx}
            fg={color}
            bg={isInVisualSelection ? CatppuccinMocha.surface0 : undefined}
          >
            {content}
          </text>
        );
      })}
    </>
  );
}
