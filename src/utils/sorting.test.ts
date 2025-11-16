/**
 * Tests for sorting utilities
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { 
  SortField, 
  SortOrder, 
  sortEntries, 
  toggleSortOrder,
  formatSortField,
  formatSortOrder,
  DEFAULT_SORT_CONFIG
} from './sorting.js';
import { Entry, EntryType } from '../types/entry.js';
import { generateEntryId } from './entry-id.js';

describe('Sorting Utilities', () => {
  let entries: Entry[];

  beforeEach(() => {
    entries = [
      {
        id: generateEntryId(),
        name: 'zebra.txt',
        type: EntryType.File,
        path: 'zebra.txt',
        size: 100,
        modified: new Date('2025-01-10'),
      },
      {
        id: generateEntryId(),
        name: 'apple',
        type: EntryType.Directory,
        path: 'apple/',
      },
      {
        id: generateEntryId(),
        name: 'file.txt',
        type: EntryType.File,
        path: 'file.txt',
        size: 5000,
        modified: new Date('2025-01-05'),
      },
      {
        id: generateEntryId(),
        name: 'banana',
        type: EntryType.Directory,
        path: 'banana/',
      },
    ];
  });

  describe('Sort by Name', () => {
    it('should sort by name ascending (directories first)', () => {
      const sorted = sortEntries(entries, {
        field: SortField.Name,
        order: SortOrder.Ascending,
      });

      expect(sorted[0].name).toBe('apple');
      expect(sorted[1].name).toBe('banana');
      expect(sorted[2].name).toBe('file.txt');
      expect(sorted[3].name).toBe('zebra.txt');
    });

    it('should sort by name descending (directories first, then files)', () => {
      const sorted = sortEntries(entries, {
        field: SortField.Name,
        order: SortOrder.Descending,
      });

      // Directories first (sorted descending)
      expect(sorted[0].name).toBe('banana');
      expect(sorted[1].name).toBe('apple');
      // Then files (sorted descending)
      expect(sorted[2].name).toBe('zebra.txt');
      expect(sorted[3].name).toBe('file.txt');
    });
  });

  describe('Sort by Size', () => {
    it('should sort by size ascending (directories first)', () => {
      const sorted = sortEntries(entries, {
        field: SortField.Size,
        order: SortOrder.Ascending,
      });

      // Directories first
      expect(sorted[0].type).toBe(EntryType.Directory);
      expect(sorted[1].type).toBe(EntryType.Directory);
      // Then files by size
      expect(sorted[2].size).toBe(100);
      expect(sorted[3].size).toBe(5000);
    });

    it('should sort by size descending', () => {
      const sorted = sortEntries(entries, {
        field: SortField.Size,
        order: SortOrder.Descending,
      });

      expect(sorted[0].type).toBe(EntryType.Directory);
      expect(sorted[1].type).toBe(EntryType.Directory);
      expect(sorted[2].size).toBe(5000);
      expect(sorted[3].size).toBe(100);
    });
  });

  describe('Sort by Type', () => {
    it('should sort by type (directories first, then by name)', () => {
      const sorted = sortEntries(entries, {
        field: SortField.Type,
        order: SortOrder.Ascending,
      });

      expect(sorted[0].type).toBe(EntryType.Directory);
      expect(sorted[1].type).toBe(EntryType.Directory);
      expect(sorted[2].type).toBe(EntryType.File);
      expect(sorted[3].type).toBe(EntryType.File);
    });
  });

  describe('Sort by Modified Date', () => {
    it('should sort by modified date ascending', () => {
      const sorted = sortEntries(entries, {
        field: SortField.Modified,
        order: SortOrder.Ascending,
      });

      // Directories first
      expect(sorted[0].type).toBe(EntryType.Directory);
      expect(sorted[1].type).toBe(EntryType.Directory);
      // Then files by date
      expect(sorted[2].modified).toEqual(new Date('2025-01-05'));
      expect(sorted[3].modified).toEqual(new Date('2025-01-10'));
    });

    it('should sort by modified date descending', () => {
      const sorted = sortEntries(entries, {
        field: SortField.Modified,
        order: SortOrder.Descending,
      });

      expect(sorted[0].type).toBe(EntryType.Directory);
      expect(sorted[1].type).toBe(EntryType.Directory);
      expect(sorted[2].modified).toEqual(new Date('2025-01-10'));
      expect(sorted[3].modified).toEqual(new Date('2025-01-05'));
    });
  });

  describe('Toggle Sort Order', () => {
    it('should toggle from ascending to descending', () => {
      const order = toggleSortOrder(SortOrder.Ascending);
      expect(order).toBe(SortOrder.Descending);
    });

    it('should toggle from descending to ascending', () => {
      const order = toggleSortOrder(SortOrder.Descending);
      expect(order).toBe(SortOrder.Ascending);
    });
  });

  describe('Format Utilities', () => {
    it('should format sort field names', () => {
      expect(formatSortField(SortField.Name)).toBe('Name');
      expect(formatSortField(SortField.Size)).toBe('Size');
      expect(formatSortField(SortField.Type)).toBe('Type');
      expect(formatSortField(SortField.Modified)).toBe('Modified Date');
    });

    it('should format sort order with arrows', () => {
      expect(formatSortOrder(SortOrder.Ascending)).toBe('↑ Ascending');
      expect(formatSortOrder(SortOrder.Descending)).toBe('↓ Descending');
    });
  });

  describe('Default Configuration', () => {
    it('should have correct default sort config', () => {
      expect(DEFAULT_SORT_CONFIG.field).toBe(SortField.Name);
      expect(DEFAULT_SORT_CONFIG.order).toBe(SortOrder.Ascending);
    });
  });

  describe('Preserving Original Array', () => {
    it('should not modify the original array', () => {
      const original = [...entries];
      sortEntries(entries, {
        field: SortField.Name,
        order: SortOrder.Ascending,
      });

      expect(entries).toEqual(original);
    });
  });
});
