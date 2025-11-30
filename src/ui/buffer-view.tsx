/**
 * BufferView React component
 *
 * Renders the entry list as a buffer that can be edited.
 * Similar to oil.nvim's approach - the buffer itself is the interface.
 */

import { Entry, EntryType } from '../types/entry.js';
import { UseBufferStateReturn } from '../hooks/useBufferState.js';
import { Theme } from './theme.js';
import { EditMode } from '../types/edit-mode.js';
import { formatBytes } from '../utils/file-browser.js';
import type { UsePendingOperationsReturn } from '../hooks/usePendingOperations.js';

export interface BufferViewProps {
  bufferState: UseBufferStateReturn;
  showIcons?: boolean;
  showSizes?: boolean;
  showDates?: boolean;
  /** Pending operations hook for global state management */
  pendingOps: UsePendingOperationsReturn;
}

/**
 * Column widths for buffer display
 */
const NAME_COLUMN_WIDTH = 30;
const META_COLUMN_WIDTH = 12;

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
 * Format an entry for display
 */
function formatEntry(
  entry: Entry,
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
    nameWithSuffix.length > NAME_COLUMN_WIDTH
      ? nameWithSuffix.slice(0, NAME_COLUMN_WIDTH - 3) + '...'
      : nameWithSuffix;
  parts.push(truncatedName.padEnd(NAME_COLUMN_WIDTH));

  // For bucket entries, show region instead of size
  if (entry.type === EntryType.Bucket) {
    const region = entry.metadata?.region || '-';
    parts.push(region.padEnd(META_COLUMN_WIDTH));
  } else if (showSizes) {
    // Size for regular entries
    parts.push(formatBytes(entry.size).padEnd(META_COLUMN_WIDTH));
  }

  // Date
  if (showDates) {
    if (entry.type === EntryType.Bucket) {
      // For buckets, show creation date
      parts.push(formatDate(entry.metadata?.createdAt || entry.modified).padEnd(META_COLUMN_WIDTH));
    } else {
      parts.push(formatDate(entry.modified).padEnd(META_COLUMN_WIDTH));
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
    return Theme.getErrorColor();
  }

  if (entry.type === EntryType.Directory || entry.type === EntryType.Bucket) {
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
  pendingOps,
}: BufferViewProps) {
  // Use filtered entries when searching
  const filteredEntries = bufferState.getFilteredEntries();
  const entries =
    filteredEntries.length < bufferState.entries.length && bufferState.searchQuery
      ? filteredEntries
      : bufferState.entries;

  // Get virtual entries (pending moves/copies to this directory)
  // These are displayed separately and are not navigable
  const virtualEntries = pendingOps?.getVirtualEntries(bufferState.currentPath) ?? [];

  const cursorIndex = bufferState.selection.cursorIndex;

  // Get visible entries (with scroll offset)
  const viewportHeight = bufferState.viewportHeight;
  // Reserve space for virtual entries if any
  const virtualSpace = virtualEntries.length > 0 ? Math.min(virtualEntries.length + 1, 5) : 0;
  const adjustedViewportHeight = viewportHeight - virtualSpace;
  const visibleEntries = entries.slice(
    bufferState.scrollOffset,
    bufferState.scrollOffset + adjustedViewportHeight
  );

  // Check if in insert mode
  const isInsertMode = bufferState.mode === EditMode.Insert;
  const editBuffer = bufferState.editBuffer || '';

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

        // Check entry visual state from pending operations store
        const entryState = pendingOps.getEntryState(entry);
        const isMarkedForDeletion = entryState.isDeleted;
        const isCut = entryState.isMovedAway;
        const isRenamed = entryState.isRenamed;
        const newName = entryState.newName;

        const cursor = isSelected ? '> ' : '  ';
        // Add marker prefix based on state
        let marker = '';
        if (isMarkedForDeletion) {
          marker = '✗ ';
        } else if (isCut) {
          marker = '✂ ';
        } else if (isRenamed) {
          marker = '✎ ';
        }

        // For renamed entries, display with the new name
        const displayEntry = isRenamed && newName ? { ...entry, name: newName } : entry;
        let content = cursor + marker + formatEntry(displayEntry, showIcons, showSizes, showDates);

        // Apply strikethrough to deleted entries
        if (isMarkedForDeletion) {
          content = applyStrikethrough(content);
        }

        // Determine color based on state
        let color: string;
        if (isMarkedForDeletion) {
          color = Theme.getErrorColor();
        } else if (isCut) {
          color = Theme.getDimColor(); // Dimmed for cut items
        } else if (isRenamed) {
          color = Theme.getWarningColor(); // Orange for pending rename
        } else {
          color = getEntryColor(entry, isSelected, false);
        }

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
      {/* Show insert mode input line */}
      {isInsertMode && (
        <text fg={Theme.getInsertModeColor()} bg={Theme.getBgSurface()}>
          {'> + 📄  '}
          {editBuffer}
          {'_'}
        </text>
      )}
      {/* Show pending virtual entries (moves/copies to this directory) */}
      {virtualEntries.length > 0 && (
        <>
          <text fg={Theme.getDimColor()}>{'── pending ──'}</text>
          {virtualEntries.slice(0, 4).map(entry => {
            const content = '  + ' + formatEntry(entry, showIcons, showSizes, showDates);
            return (
              <text key={entry.id} fg={Theme.getSuccessColor()}>
                {content}
              </text>
            );
          })}
          {virtualEntries.length > 4 && (
            <text fg={Theme.getDimColor()}>{`  ... and ${virtualEntries.length - 4} more`}</text>
          )}
        </>
      )}
    </box>
  );
}
