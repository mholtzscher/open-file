/**
 * Integration tests for operation execution pipeline
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { MockAdapter } from '../adapters/mock-adapter.js';
import { detectChanges, buildOperationPlan } from '../utils/change-detection.js';
import { Entry, EntryType } from '../types/entry.js';
import { EntryIdMap } from '../utils/entry-id.js';

describe('Operation Execution Pipeline', () => {
  let adapter: MockAdapter;

  beforeEach(() => {
    adapter = new MockAdapter();
  });

  describe('Change Detection', () => {
    it('should detect new entries', () => {
      const original: Entry[] = [
        {
          id: '1',
          name: 'file1.txt',
          type: EntryType.File,
          path: 'file1.txt',
          modified: new Date(),
        },
      ];

      const edited: Entry[] = [
        {
          id: '1',
          name: 'file1.txt',
          type: EntryType.File,
          path: 'file1.txt',
          modified: new Date(),
        },
        {
          id: '2',
          name: 'file2.txt',
          type: EntryType.File,
          path: 'file2.txt',
          modified: new Date(),
        },
      ];

      const changes = detectChanges(original, edited, new EntryIdMap());

      expect(changes.creates).toHaveLength(1);
      expect(changes.creates[0].name).toBe('file2.txt');
      expect(changes.deletes).toHaveLength(0);
      expect(changes.moves.size).toBe(0);
    });

    it('should detect deleted entries', () => {
      const original: Entry[] = [
        {
          id: '1',
          name: 'file1.txt',
          type: EntryType.File,
          path: 'file1.txt',
          modified: new Date(),
        },
        {
          id: '2',
          name: 'file2.txt',
          type: EntryType.File,
          path: 'file2.txt',
          modified: new Date(),
        },
      ];

      const edited: Entry[] = [
        {
          id: '1',
          name: 'file1.txt',
          type: EntryType.File,
          path: 'file1.txt',
          modified: new Date(),
        },
      ];

      const changes = detectChanges(original, edited, new EntryIdMap());

      expect(changes.creates).toHaveLength(0);
      expect(changes.deletes).toHaveLength(1);
      expect(changes.deletes[0].name).toBe('file2.txt');
      expect(changes.moves.size).toBe(0);
    });

    it('should detect renamed entries', () => {
      const original: Entry[] = [
        {
          id: '1',
          name: 'old-name.txt',
          type: EntryType.File,
          path: 'old-name.txt',
          modified: new Date(),
        },
      ];

      const edited: Entry[] = [
        {
          id: '1',
          name: 'new-name.txt',
          type: EntryType.File,
          path: 'new-name.txt',
          modified: new Date(),
        },
      ];

      const changes = detectChanges(original, edited, new EntryIdMap());

      expect(changes.creates).toHaveLength(0);
      expect(changes.deletes).toHaveLength(0);
      expect(changes.moves.size).toBe(1);
      expect(changes.moves.get(original[0])).toBe('new-name.txt');
    });
  });

  describe('Operation Planning', () => {
    it('should build correct operation plan for multiple changes', () => {
      const original: Entry[] = [
        {
          id: '1',
          name: 'file1.txt',
          type: EntryType.File,
          path: 'file1.txt',
          modified: new Date(),
        },
      ];

      const edited: Entry[] = [
        {
          id: '1',
          name: 'renamed-file.txt',
          type: EntryType.File,
          path: 'renamed-file.txt',
          modified: new Date(),
        },
        {
          id: '2',
          name: 'new-file.txt',
          type: EntryType.File,
          path: 'new-file.txt',
          modified: new Date(),
        },
      ];

      const changes = detectChanges(original, edited, new EntryIdMap());
      const plan = buildOperationPlan(changes);

      // Should have 2 operations: 1 create, 1 move
      expect(plan.operations).toHaveLength(2);
      expect(plan.operations[0].type).toBe('create');
      expect(plan.operations[1].type).toBe('move');
      expect(plan.summary.creates).toBe(1);
      expect(plan.summary.moves).toBe(1);
    });

    it('should order operations correctly (creates, then moves, then deletes)', () => {
      const original: Entry[] = [
        {
          id: '1',
          name: 'file1.txt',
          type: EntryType.File,
          path: 'file1.txt',
          modified: new Date(),
        },
        {
          id: '2',
          name: 'file2.txt',
          type: EntryType.File,
          path: 'file2.txt',
          modified: new Date(),
        },
      ];

      const edited: Entry[] = [
        {
          id: '1',
          name: 'renamed.txt',
          type: EntryType.File,
          path: 'renamed.txt',
          modified: new Date(),
        },
        {
          id: '3',
          name: 'new-file.txt',
          type: EntryType.File,
          path: 'new-file.txt',
          modified: new Date(),
        },
      ];

      const changes = detectChanges(original, edited, new EntryIdMap());
      const plan = buildOperationPlan(changes);

      // Should have 3 operations: 1 create, 1 move, 1 delete
      expect(plan.operations).toHaveLength(3);

      // Order: creates first
      let createIndex = -1;
      let moveIndex = -1;
      let deleteIndex = -1;

      for (let i = 0; i < plan.operations.length; i++) {
        if (plan.operations[i].type === 'create') createIndex = i;
        if (plan.operations[i].type === 'move') moveIndex = i;
        if (plan.operations[i].type === 'delete') deleteIndex = i;
      }

      expect(createIndex).toBeLessThan(moveIndex);
      expect(moveIndex).toBeLessThan(deleteIndex);
    });
  });

  describe('Operation Execution', () => {
    it('should execute create operations', async () => {
      const path = 'test/file.txt';
      const type = EntryType.File;

      await adapter.create(path, type, 'Hello World');

      const result = await adapter.list('test/');
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].name).toBe('file.txt');
    });

    it('should execute delete operations', async () => {
      // Create a file first
      await adapter.create('test/file.txt', EntryType.File, 'content');

      // Verify it exists
      let result = await adapter.list('test/');
      expect(result.entries).toHaveLength(1);

      // Delete it
      await adapter.delete('test/file.txt');

      // Verify it's gone
      result = await adapter.list('test/');
      expect(result.entries).toHaveLength(0);
    });

    it('should execute move operations', async () => {
      // Create a file
      await adapter.create('test/old-name.txt', EntryType.File, 'content');

      // Move it
      await adapter.move('test/old-name.txt', 'test/new-name.txt');

      // Verify the move
      const result = await adapter.list('test/');
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].name).toBe('new-name.txt');
      expect(result.entries[0].path).toBe('test/new-name.txt');
    });

    it('should execute multiple operations in sequence', async () => {
      // Create initial files
      await adapter.create('test/file1.txt', EntryType.File, 'content1');
      await adapter.create('test/file2.txt', EntryType.File, 'content2');

      // Simulate a full workflow: create, move, delete
      const original = (await adapter.list('test/')).entries;

      // Now simulate edits: create new, rename file1, delete file2
      const edited: Entry[] = [
        {
          id: '1',
          name: 'file1-renamed.txt',
          type: EntryType.File,
          path: 'test/file1-renamed.txt',
          modified: new Date(),
        },
        {
          id: '3',
          name: 'file3.txt',
          type: EntryType.File,
          path: 'test/file3.txt',
          modified: new Date(),
        },
      ];

      const changes = detectChanges(original, edited, new EntryIdMap());
      const plan = buildOperationPlan(changes);

      // Execute all operations
      for (const op of plan.operations) {
        switch (op.type) {
          case 'create':
            await adapter.create((op as any).path, (op as any).entryType, 'new content');
            break;
          case 'move':
            await adapter.move((op as any).source, (op as any).destination);
            break;
          case 'delete':
            await adapter.delete((op as any).path);
            break;
        }
      }

      // Verify final state
      const result = await adapter.list('test/');
      expect(result.entries).toHaveLength(2);
      expect(result.entries.map(e => e.name).sort()).toEqual(['file1-renamed.txt', 'file3.txt']);
    });
  });
});
