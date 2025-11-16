/**
 * Tests for change detection and operation planning
 */

import { describe, it, expect } from 'bun:test';
import { detectChanges, buildOperationPlan } from './change-detection.js';
import { EntryIdMap, generateEntryId } from './entry-id.js';
import { Entry, EntryType } from '../types/entry.js';

describe('Change Detection', () => {
  describe('detectChanges', () => {
    it('should detect created entries', () => {
      const id1 = generateEntryId();
      const id2 = generateEntryId();

      const original: Entry[] = [
        {
          id: id1,
          name: 'file1.txt',
          type: EntryType.File,
          path: 'file1.txt',
        },
      ];

      const edited: Entry[] = [
        {
          id: id1,
          name: 'file1.txt',
          type: EntryType.File,
          path: 'file1.txt',
        },
        {
          id: id2,
          name: 'file2.txt',
          type: EntryType.File,
          path: 'file2.txt',
        },
      ];

      const idMap = new EntryIdMap();
      const changes = detectChanges(original, edited, idMap);

      expect(changes.creates.length).toBe(1);
      expect(changes.creates[0].name).toBe('file2.txt');
    });

    it('should detect deleted entries', () => {
      const id1 = generateEntryId();
      const id2 = generateEntryId();

      const original: Entry[] = [
        {
          id: id1,
          name: 'file1.txt',
          type: EntryType.File,
          path: 'file1.txt',
        },
        {
          id: id2,
          name: 'file2.txt',
          type: EntryType.File,
          path: 'file2.txt',
        },
      ];

      const edited: Entry[] = [
        {
          id: id1,
          name: 'file1.txt',
          type: EntryType.File,
          path: 'file1.txt',
        },
      ];

      const idMap = new EntryIdMap();
      const changes = detectChanges(original, edited, idMap);

      expect(changes.deletes.length).toBe(1);
      expect(changes.deletes[0].name).toBe('file2.txt');
    });

    it('should detect moved entries', () => {
      const id1 = generateEntryId();

      const original: Entry[] = [
        {
          id: id1,
          name: 'file1.txt',
          type: EntryType.File,
          path: 'old/file1.txt',
        },
      ];

      const edited: Entry[] = [
        {
          id: id1,
          name: 'file1.txt',
          type: EntryType.File,
          path: 'new/file1.txt',
        },
      ];

      const idMap = new EntryIdMap();
      const changes = detectChanges(original, edited, idMap);

      expect(changes.moves.size).toBe(1);
      const move = Array.from(changes.moves.entries())[0];
      expect(move[1]).toBe('new/file1.txt');
    });

    it('should detect renamed entries as moves', () => {
      const id1 = generateEntryId();

      const original: Entry[] = [
        {
          id: id1,
          name: 'old.txt',
          type: EntryType.File,
          path: 'old.txt',
        },
      ];

      const edited: Entry[] = [
        {
          id: id1,
          name: 'new.txt',
          type: EntryType.File,
          path: 'new.txt',
        },
      ];

      const idMap = new EntryIdMap();
      const changes = detectChanges(original, edited, idMap);

      expect(changes.moves.size).toBe(1);
    });

    it('should handle no changes', () => {
      const id1 = generateEntryId();

      const entries: Entry[] = [
        {
          id: id1,
          name: 'file1.txt',
          type: EntryType.File,
          path: 'file1.txt',
        },
      ];

      const idMap = new EntryIdMap();
      const changes = detectChanges(entries, entries, idMap);

      expect(changes.creates.length).toBe(0);
      expect(changes.deletes.length).toBe(0);
      expect(changes.moves.size).toBe(0);
      expect(changes.copies.size).toBe(0);
    });

    it('should detect copied entries (duplicate with same path)', () => {
      const id1 = generateEntryId();
      const id2 = generateEntryId(); // New ID for the copy

      const original: Entry[] = [
        {
          id: id1,
          name: 'file1.txt',
          type: EntryType.File,
          path: 'file1.txt',
        },
      ];

      const edited: Entry[] = [
        {
          id: id1,
          name: 'file1.txt',
          type: EntryType.File,
          path: 'file1.txt',
        },
        {
          id: id2,
          name: 'file1.txt',
          type: EntryType.File,
          path: 'file1.txt', // Same path indicates a copy
        },
      ];

      const idMap = new EntryIdMap();
      const changes = detectChanges(original, edited, idMap);

      // Should detect as a copy, not a create
      expect(changes.creates.length).toBe(0);
      expect(changes.copies.size).toBe(1);
      
      const copy = Array.from(changes.copies.entries())[0];
      expect(copy[0].path).toBe('file1.txt');
      expect(copy[1]).toBe('file1.txt');
    });
  });

  describe('buildOperationPlan', () => {
    it('should generate create operations', () => {
      const id1 = generateEntryId();
      const id2 = generateEntryId();

      const original: Entry[] = [
        {
          id: id1,
          name: 'file1.txt',
          type: EntryType.File,
          path: 'file1.txt',
        },
      ];

      const edited: Entry[] = [
        {
          id: id1,
          name: 'file1.txt',
          type: EntryType.File,
          path: 'file1.txt',
        },
        {
          id: id2,
          name: 'file2.txt',
          type: EntryType.File,
          path: 'file2.txt',
        },
      ];

      const idMap = new EntryIdMap();
      const changes = detectChanges(original, edited, idMap);
      const plan = buildOperationPlan(changes);

      expect(plan.operations.length).toBe(1);
      expect(plan.operations[0].type).toBe('create');
      expect(plan.summary.creates).toBe(1);
      expect(plan.summary.total).toBe(1);
    });

    it('should order operations correctly (creates before deletes)', () => {
      const id1 = generateEntryId();
      const id2 = generateEntryId();

      const original: Entry[] = [
        {
          id: id1,
          name: 'file1.txt',
          type: EntryType.File,
          path: 'file1.txt',
        },
        {
          id: id2,
          name: 'file2.txt',
          type: EntryType.File,
          path: 'file2.txt',
        },
      ];

      const edited: Entry[] = [
        {
          id: id1,
          name: 'file1.txt',
          type: EntryType.File,
          path: 'file1.txt',
        },
        {
          id: generateEntryId(),
          name: 'file3.txt',
          type: EntryType.File,
          path: 'file3.txt',
        },
      ];

      const idMap = new EntryIdMap();
      const changes = detectChanges(original, edited, idMap);
      const plan = buildOperationPlan(changes);

      // Should have create and delete
      expect(plan.operations.length).toBe(2);
      
      // Create should come first
      const createIndex = plan.operations.findIndex(op => op.type === 'create');
      const deleteIndex = plan.operations.findIndex(op => op.type === 'delete');
      expect(createIndex).toBeLessThan(deleteIndex);
    });

    it('should generate correct summaries', () => {
      const id1 = generateEntryId();
      const id2 = generateEntryId();

      const original: Entry[] = [
        {
          id: id1,
          name: 'file1.txt',
          type: EntryType.File,
          path: 'file1.txt',
        },
      ];

      const edited: Entry[] = [
        {
          id: generateEntryId(),
          name: 'file2.txt',
          type: EntryType.File,
          path: 'file2.txt',
        },
      ];

      const idMap = new EntryIdMap();
      const changes = detectChanges(original, edited, idMap);
      const plan = buildOperationPlan(changes);

      expect(plan.summary.creates).toBe(1);
      expect(plan.summary.deletes).toBe(1);
      expect(plan.summary.moves).toBe(0);
      expect(plan.summary.copies).toBe(0);
      expect(plan.summary.total).toBe(2);
    });
  });
});
