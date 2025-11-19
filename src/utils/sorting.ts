/**
 * Sorting utilities for entries
 */

import { Entry, EntryType } from '../types/entry.js';

/**
 * Sort field options
 */
export enum SortField {
  Name = 'name',
  Size = 'size',
  Type = 'type',
  Modified = 'modified',
}

/**
 * Sort order
 */
export enum SortOrder {
  Ascending = 'ascending',
  Descending = 'descending',
}

/**
 * Sort configuration
 */
export interface SortConfig {
  field: SortField;
  order: SortOrder;
}

/**
 * Default sort configuration
 */
export const DEFAULT_SORT_CONFIG: SortConfig = {
  field: SortField.Name,
  order: SortOrder.Ascending,
};

/**
 * Sort entries according to configuration
 */
export function sortEntries(entries: Entry[], config: SortConfig): Entry[] {
  const sorted = [...entries];

  sorted.sort((a, b) => {
    // Check if one is a directory and one is a file - directories always come first
    if (a.type !== b.type) {
      return a.type === EntryType.Directory ? -1 : 1;
    }

    // Both are same type, apply sorting based on field
    let comparison = 0;
    switch (config.field) {
      case SortField.Name:
        comparison = a.name.localeCompare(b.name);
        break;
      case SortField.Size: {
        const sizeA = a.size ?? 0;
        const sizeB = b.size ?? 0;
        comparison = sizeA - sizeB;
        break;
      }
      case SortField.Type:
        // Already sorted by type above
        comparison = a.name.localeCompare(b.name);
        break;
      case SortField.Modified: {
        const dateA = a.modified?.getTime() ?? 0;
        const dateB = b.modified?.getTime() ?? 0;
        comparison = dateA - dateB;
        break;
      }
    }

    return config.order === SortOrder.Ascending ? comparison : -comparison;
  });

  return sorted;
}

/**
 * Toggle sort order
 */
export function toggleSortOrder(order: SortOrder): SortOrder {
  return order === SortOrder.Ascending ? SortOrder.Descending : SortOrder.Ascending;
}

/**
 * Format sort field for display
 */
export function formatSortField(field: SortField): string {
  switch (field) {
    case SortField.Name:
      return 'Name';
    case SortField.Size:
      return 'Size';
    case SortField.Type:
      return 'Type';
    case SortField.Modified:
      return 'Modified Date';
  }
}

/**
 * Format sort order for display
 */
export function formatSortOrder(order: SortOrder): string {
  return order === SortOrder.Ascending ? '↑ Ascending' : '↓ Descending';
}
