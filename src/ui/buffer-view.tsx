/**
 * BufferView SolidJS component
 *
 * Renders the entry list as a buffer that can be edited.
 * Similar to oil.nvim's approach - the buffer itself is the interface.
 */

import { For, Show } from 'solid-js';
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
 * BufferView SolidJS component
 */
export function BufferView(props: BufferViewProps) {
  const showIcons = () => props.showIcons ?? true;
  const showSizes = () => props.showSizes ?? true;
  const showDates = () => props.showDates ?? false;

  // Use filtered entries when searching
  const filteredEntries = () => props.bufferState.getFilteredEntries();
  const entries = () => {
    const filtered = filteredEntries();
    return filtered.length < props.bufferState.entries.length && props.bufferState.searchQuery
      ? filtered
      : props.bufferState.entries;
  };

  // Get virtual entries (pending moves/copies to this directory)
  // These are displayed separately and are not navigable
  const virtualEntries = () =>
    props.pendingOps?.getVirtualEntries(props.bufferState.currentPath) ?? [];

  const cursorIndex = () => props.bufferState.selection.cursorIndex;

  // Get visible entries (with scroll offset)
  const viewportHeight = () => props.bufferState.viewportHeight;
  // Reserve space for virtual entries if any
  const virtualSpace = () => {
    const ve = virtualEntries();
    return ve.length > 0 ? Math.min(ve.length + 1, 5) : 0;
  };
  const adjustedViewportHeight = () => viewportHeight() - virtualSpace();
  const visibleEntries = () =>
    entries().slice(
      props.bufferState.scrollOffset,
      props.bufferState.scrollOffset + adjustedViewportHeight()
    );

  // Check if in insert mode
  const isInsertMode = () => props.bufferState.mode === EditMode.Insert;
  const editBuffer = () => props.bufferState.editBuffer || '';

  // If no entries, show empty indicator (but still allow insert mode)
  return (
    <Show
      when={entries().length > 0 || isInsertMode()}
      fallback={
        <box flexDirection="column" width="100%" height="100%">
          <text fg={Theme.getEmptyStateColor()}>&lt;empty&gt;</text>
        </box>
      }
    >
      <box flexDirection="column" width="100%" height="100%">
        <For each={visibleEntries()}>
          {(entry, idx) => {
            const realIndex = () => props.bufferState.scrollOffset + idx();
            const isSelected = () => realIndex() === cursorIndex();
            const isInVisualSelection = () =>
              props.bufferState.selection.isActive &&
              props.bufferState.selection.selectionStart !== undefined &&
              realIndex() >=
                Math.min(
                  props.bufferState.selection.selectionStart,
                  props.bufferState.selection.selectionEnd ??
                    props.bufferState.selection.selectionStart
                ) &&
              realIndex() <=
                Math.max(
                  props.bufferState.selection.selectionStart,
                  props.bufferState.selection.selectionEnd ??
                    props.bufferState.selection.selectionStart
                );

            // Check entry visual state from pending operations store
            const entryState = () => props.pendingOps.getEntryState(entry);
            const isMarkedForDeletion = () => entryState().isDeleted;
            const isCut = () => entryState().isMovedAway;
            const isRenamed = () => entryState().isRenamed;
            const newName = () => entryState().newName;

            const cursor = () => (isSelected() ? '> ' : '  ');
            // Add marker prefix based on state
            const marker = () => {
              if (isMarkedForDeletion()) return '✗ ';
              if (isCut()) return '✂ ';
              if (isRenamed()) return '✎ ';
              return '';
            };

            // For renamed entries, display with the new name
            const displayEntry = () =>
              isRenamed() && newName() ? { ...entry, name: newName()! } : entry;
            const content = () => {
              let c =
                cursor() +
                marker() +
                formatEntry(displayEntry(), showIcons(), showSizes(), showDates());
              // Apply strikethrough to deleted entries
              if (isMarkedForDeletion()) {
                c = applyStrikethrough(c);
              }
              return c;
            };

            // Determine color based on state
            const color = () => {
              if (isMarkedForDeletion()) return Theme.getErrorColor();
              if (isCut()) return Theme.getDimColor(); // Dimmed for cut items
              if (isRenamed()) return Theme.getWarningColor(); // Orange for pending rename
              return getEntryColor(entry, isSelected(), false);
            };

            return (
              <text fg={color()} bg={isInVisualSelection() ? Theme.getBgSurface() : undefined}>
                {content()}
              </text>
            );
          }}
        </For>
        {/* Show insert mode input line */}
        <Show when={isInsertMode()}>
          <text fg={Theme.getInsertModeColor()} bg={Theme.getBgSurface()}>
            {'> + 📄  '}
            {editBuffer()}
            {'_'}
          </text>
        </Show>
        {/* Show pending virtual entries (moves/copies to this directory) */}
        <Show when={virtualEntries().length > 0}>
          <text fg={Theme.getDimColor()}>{'── pending ──'}</text>
          <For each={virtualEntries().slice(0, 4)}>
            {entry => {
              const content = '  + ' + formatEntry(entry, showIcons(), showSizes(), showDates());
              return <text fg={Theme.getSuccessColor()}>{content}</text>;
            }}
          </For>
          <Show when={virtualEntries().length > 4}>
            <text fg={Theme.getDimColor()}>{`  ... and ${virtualEntries().length - 4} more`}</text>
          </Show>
        </Show>
      </box>
    </Show>
  );
}
