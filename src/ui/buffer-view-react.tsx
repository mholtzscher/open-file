/**
 * BufferView React component
 *
 * Renders the entry list as a buffer that can be edited.
 * Similar to oil.nvim's approach - the buffer itself is the interface.
 */

import { Entry, EntryType } from '../types/entry.js';
import { UseBufferStateReturn } from '../hooks/useBufferState.js';
import { Theme, CatppuccinMocha } from './theme.js';
import { EditMode } from '../types/edit-mode.js';
import { formatBytes } from '../utils/file-browser.js';

export interface BufferViewProps {
  bufferState: UseBufferStateReturn;
  showIcons?: boolean;
  showSizes?: boolean;
  showDates?: boolean;
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
function formatEntry(
  entry: Entry,
  _isSelected: boolean,
  showIcons: boolean,
  showSizes: boolean,
  showDates: boolean
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
    nameWithSuffix.length > 30 ? nameWithSuffix.slice(0, 27) + '...' : nameWithSuffix;
  parts.push(truncatedName.padEnd(30));

  // For bucket entries, show region instead of size
  if (entry.type === EntryType.Bucket) {
    const region = entry.metadata?.region || '-';
    parts.push(region.padEnd(12));
  } else if (showSizes) {
    // Size for regular entries
    parts.push(formatBytes(entry.size).padEnd(12));
  }

  // Date
  if (showDates) {
    if (entry.type === EntryType.Bucket) {
      // For buckets, show creation date
      parts.push(formatDate(entry.metadata?.createdAt || entry.modified).padEnd(12));
    } else {
      parts.push(formatDate(entry.modified).padEnd(12));
    }
  }

  return parts.join('');
}

/**
 * Get entry color
 */
function getEntryColor(entry: Entry, isSelected: boolean, isMarkedForDeletion: boolean): string {
  // Deleted entries shown in red/muted color
  if (isMarkedForDeletion) {
    return CatppuccinMocha.red;
  }
  if (entry.type === EntryType.Directory) {
    return Theme.getDirectoryColor(isSelected);
  } else if (entry.type === EntryType.Bucket) {
    // Buckets get directory color (highlight color)
    return Theme.getDirectoryColor(isSelected);
  }
  return Theme.getFileColor(isSelected);
}

/**
 * Apply strikethrough effect to text (using Unicode combining characters)
 */
function applyStrikethrough(text: string): string {
  // Unicode strikethrough combining character
  return text
    .split('')
    .map(char => char + '\u0336')
    .join('');
}

/**
 * BufferView React component
 */
export function BufferView({
  bufferState,
  showIcons = true,
  showSizes = true,
  showDates = false,
}: BufferViewProps) {
  // Use filtered entries when searching
  const filteredEntries = bufferState.getFilteredEntries();
  const entries =
    filteredEntries.length < bufferState.entries.length && bufferState.searchQuery
      ? filteredEntries
      : bufferState.entries;
  const cursorIndex = bufferState.selection.cursorIndex;

  // Get visible entries (with scroll offset)
  const viewportHeight = bufferState.viewportHeight;
  const visibleEntries = entries.slice(
    bufferState.scrollOffset,
    bufferState.scrollOffset + viewportHeight
  );

  // If no entries, show empty indicator
  if (entries.length === 0) {
    return (
      <box flexDirection="column" width="100%" height="100%">
        <text fg={Theme.getEmptyStateColor()}>&lt;empty&gt;</text>
      </box>
    );
  }

  // Check if in insert mode
  const isInsertMode = bufferState.mode === EditMode.Insert;
  const editBuffer = bufferState.editBuffer || '';

  return (
    <box flexDirection="column" width="100%" height="100%">
      {visibleEntries.map((entry, idx) => {
        const realIndex = bufferState.scrollOffset + idx;
        const isSelected = realIndex === cursorIndex;
        const isInVisualSelection =
          bufferState.selection.isActive &&
          bufferState.selection.selectionStart !== undefined &&
          realIndex >=
            Math.min(
              bufferState.selection.selectionStart,
              bufferState.selection.selectionEnd ?? bufferState.selection.selectionStart
            ) &&
          realIndex <=
            Math.max(
              bufferState.selection.selectionStart,
              bufferState.selection.selectionEnd ?? bufferState.selection.selectionStart
            );

        // Check if entry is marked for deletion
        const isMarkedForDeletion = bufferState.isMarkedForDeletion(entry.id);

        const cursor = isSelected ? '> ' : '  ';
        // Add deletion marker prefix if marked for deletion
        const deleteMarker = isMarkedForDeletion ? '✗ ' : '';
        let content =
          cursor + deleteMarker + formatEntry(entry, isSelected, showIcons, showSizes, showDates);

        // Apply strikethrough to deleted entries
        if (isMarkedForDeletion) {
          content = applyStrikethrough(content);
        }

        const color = getEntryColor(entry, isSelected, isMarkedForDeletion);

        return (
          <text
            key={entry.id}
            fg={color}
            bg={isInVisualSelection ? CatppuccinMocha.surface0 : undefined}
          >
            {content}
          </text>
        );
      })}
      {/* Show insert mode input line */}
      {isInsertMode && (
        <text fg={CatppuccinMocha.peach} bg={CatppuccinMocha.surface0}>
          {'> + 📄  '}
          {editBuffer}
          {'_'}
        </text>
      )}
    </box>
  );
}
