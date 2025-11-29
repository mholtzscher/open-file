/**
 * Pending Operations Store Tests
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import {
  createPendingOperationsStore,
  resetPendingOperationsStore,
  getPendingOperationsStore,
  PendingOperationsStore,
} from './pending-operations-store.js';
import { Entry, EntryType } from '../types/entry.js';
import { StorageProvider } from '../providers/provider.js';
import { OperationStatus } from '../providers/types/result.js';

// Test fixtures
function createTestEntry(name: string, type: EntryType = EntryType.File): Entry {
  return {
    id: `entry-${name}`,
    name,
    type,
    path: `test/${name}`,
  };
}

describe('PendingOperationsStore', () => {
  let store: PendingOperationsStore;

  beforeEach(() => {
    resetPendingOperationsStore();
    store = createPendingOperationsStore();
  });

  // ============================================
  // Initial State
  // ============================================
  describe('initial state', () => {
    it('starts with empty operations', () => {
      expect(store.getOperations()).toEqual([]);
      expect(store.hasPendingChanges()).toBe(false);
      expect(store.getPendingCount()).toBe(0);
    });

    it('starts with empty clipboard', () => {
      expect(store.getClipboard()).toBeNull();
      expect(store.hasClipboardContent()).toBe(false);
    });

    it('starts with no undo/redo available', () => {
      expect(store.canUndo()).toBe(false);
      expect(store.canRedo()).toBe(false);
    });
  });

  // ============================================
  // Deletion Marking
  // ============================================
  describe('deletion marking', () => {
    it('marks entry for deletion', () => {
      const entry = createTestEntry('file.txt');
      const uri = 's3://bucket/test/file.txt';

      store.markForDeletion(uri, entry);

      expect(store.hasPendingChanges()).toBe(true);
      expect(store.getPendingCount()).toBe(1);
      expect(store.isMarkedForDeletion(uri)).toBe(true);
    });

    it('does not duplicate deletion marks', () => {
      const entry = createTestEntry('file.txt');
      const uri = 's3://bucket/test/file.txt';

      store.markForDeletion(uri, entry);
      store.markForDeletion(uri, entry);

      expect(store.getPendingCount()).toBe(1);
    });

    it('unmarks entry for deletion', () => {
      const entry = createTestEntry('file.txt');
      const uri = 's3://bucket/test/file.txt';

      store.markForDeletion(uri, entry);
      store.unmarkForDeletion(uri);

      expect(store.hasPendingChanges()).toBe(false);
      expect(store.isMarkedForDeletion(uri)).toBe(false);
    });

    it('toggles deletion mark', () => {
      const entry = createTestEntry('file.txt');
      const uri = 's3://bucket/test/file.txt';

      // Toggle on
      store.toggleDeletion(uri, entry);
      expect(store.isMarkedForDeletion(uri)).toBe(true);

      // Toggle off
      store.toggleDeletion(uri, entry);
      expect(store.isMarkedForDeletion(uri)).toBe(false);
    });
  });

  // ============================================
  // Visual State
  // ============================================
  describe('getEntryState', () => {
    it('returns default state for unmarked entry', () => {
      const state = store.getEntryState('s3://bucket/test/file.txt');

      expect(state.isDeleted).toBe(false);
      expect(state.isMovedAway).toBe(false);
      expect(state.isRenamed).toBe(false);
      expect(state.isCreated).toBe(false);
    });

    it('returns deleted state for marked entry', () => {
      const entry = createTestEntry('file.txt');
      const uri = 's3://bucket/test/file.txt';

      store.markForDeletion(uri, entry);
      const state = store.getEntryState(uri);

      expect(state.isDeleted).toBe(true);
    });

    it('returns renamed state with new name', () => {
      const entry = createTestEntry('old.txt');
      const uri = 's3://bucket/test/old.txt';

      store.rename(uri, entry, 'new.txt');
      const state = store.getEntryState(uri);

      expect(state.isRenamed).toBe(true);
      expect(state.newName).toBe('new.txt');
    });

    it('returns movedAway state with destination', () => {
      const entry = createTestEntry('file.txt');
      const entries = [entry];
      const uris = ['s3://bucket/source/file.txt'];

      store.cut(entries, uris);
      store.paste('dest/', 's3', 'bucket');

      const state = store.getEntryState('s3://bucket/source/file.txt');
      expect(state.isMovedAway).toBe(true);
      expect(state.moveDestination).toBe('dest/file.txt');
    });
  });

  // ============================================
  // shouldFilterEntry
  // ============================================
  describe('shouldFilterEntry', () => {
    it('returns true for deleted entries', () => {
      const entry = createTestEntry('file.txt');
      const uri = 's3://bucket/test/file.txt';

      store.markForDeletion(uri, entry);
      expect(store.shouldFilterEntry(uri)).toBe(true);
    });

    it('returns true for moved-away entries', () => {
      const entry = createTestEntry('file.txt');
      const sourceUri = 's3://bucket/source/file.txt';

      store.cut([entry], [sourceUri]);
      store.paste('dest/', 's3', 'bucket');

      expect(store.shouldFilterEntry(sourceUri)).toBe(true);
    });

    it('returns false for normal entries', () => {
      expect(store.shouldFilterEntry('s3://bucket/test/file.txt')).toBe(false);
    });
  });

  // ============================================
  // Rename
  // ============================================
  describe('rename', () => {
    it('creates rename operation', () => {
      const entry = createTestEntry('old.txt');
      const uri = 's3://bucket/test/old.txt';

      store.rename(uri, entry, 'new.txt');

      expect(store.getPendingCount()).toBe(1);
      const ops = store.getOperations();
      expect(ops[0].type).toBe('rename');
    });

    it('replaces existing rename for same URI', () => {
      const entry = createTestEntry('old.txt');
      const uri = 's3://bucket/test/old.txt';

      store.rename(uri, entry, 'first.txt');
      store.rename(uri, entry, 'second.txt');

      expect(store.getPendingCount()).toBe(1);
      const state = store.getEntryState(uri);
      expect(state.newName).toBe('second.txt');
    });
  });

  // ============================================
  // Create
  // ============================================
  describe('create', () => {
    it('creates create operation', () => {
      store.create('s3://bucket/test/newfile.txt', 'newfile.txt', EntryType.File);

      expect(store.getPendingCount()).toBe(1);
      const ops = store.getOperations();
      expect(ops[0].type).toBe('create');
    });

    it('returns created state', () => {
      const uri = 's3://bucket/test/newfile.txt';
      store.create(uri, 'newfile.txt', EntryType.File);

      const state = store.getEntryState(uri);
      expect(state.isCreated).toBe(true);
    });
  });

  // ============================================
  // Clipboard Operations
  // ============================================
  describe('clipboard', () => {
    it('cuts entries to clipboard', () => {
      const entry = createTestEntry('file.txt');
      const uris = ['s3://bucket/test/file.txt'];

      store.cut([entry], uris);

      expect(store.hasClipboardContent()).toBe(true);
      expect(store.isClipboardCut()).toBe(true);
      const clipboard = store.getClipboard();
      expect(clipboard?.entries.length).toBe(1);
      expect(clipboard?.operation).toBe('cut');
    });

    it('copies entries to clipboard', () => {
      const entry = createTestEntry('file.txt');
      const uris = ['s3://bucket/test/file.txt'];

      store.copy([entry], uris);

      expect(store.hasClipboardContent()).toBe(true);
      expect(store.isClipboardCut()).toBe(false);
      const clipboard = store.getClipboard();
      expect(clipboard?.operation).toBe('copy');
    });

    it('paste cut creates move operations', () => {
      const entry = createTestEntry('file.txt');
      const sourceUri = 's3://bucket/source/file.txt';

      store.cut([entry], [sourceUri]);
      store.paste('dest/', 's3', 'bucket');

      const ops = store.getOperations();
      expect(ops.length).toBe(1);
      expect(ops[0].type).toBe('move');
    });

    it('paste copy creates copy operations', () => {
      const entry = createTestEntry('file.txt');
      const sourceUri = 's3://bucket/source/file.txt';

      store.copy([entry], [sourceUri]);
      store.paste('dest/', 's3', 'bucket');

      const ops = store.getOperations();
      expect(ops.length).toBe(1);
      expect(ops[0].type).toBe('copy');
    });

    it('clears clipboard after cut paste', () => {
      const entry = createTestEntry('file.txt');
      store.cut([entry], ['s3://bucket/test/file.txt']);
      store.paste('dest/', 's3', 'bucket');

      expect(store.hasClipboardContent()).toBe(false);
    });

    it('keeps clipboard after copy paste', () => {
      const entry = createTestEntry('file.txt');
      store.copy([entry], ['s3://bucket/test/file.txt']);
      store.paste('dest/', 's3', 'bucket');

      expect(store.hasClipboardContent()).toBe(true);
    });

    it('clearClipboard empties clipboard', () => {
      const entry = createTestEntry('file.txt');
      store.copy([entry], ['s3://bucket/test/file.txt']);
      store.clearClipboard();

      expect(store.hasClipboardContent()).toBe(false);
    });
  });

  // ============================================
  // Virtual Entries
  // ============================================
  describe('getVirtualEntries', () => {
    it('returns moved entries in destination directory', () => {
      const entry = createTestEntry('file.txt');
      store.cut([entry], ['s3://bucket/source/file.txt']);
      store.paste('dest/', 's3', 'bucket');

      const virtualEntries = store.getVirtualEntries('dest/', 's3', 'bucket');
      expect(virtualEntries.length).toBe(1);
      expect(virtualEntries[0].name).toBe('file.txt');
    });

    it('returns copied entries in destination directory', () => {
      const entry = createTestEntry('file.txt');
      store.copy([entry], ['s3://bucket/source/file.txt']);
      store.paste('dest/', 's3', 'bucket');

      const virtualEntries = store.getVirtualEntries('dest/', 's3', 'bucket');
      expect(virtualEntries.length).toBe(1);
    });

    it('returns created entries in directory', () => {
      store.create('s3://bucket/dest/newfile.txt', 'newfile.txt', EntryType.File);

      const virtualEntries = store.getVirtualEntries('dest/', 's3', 'bucket');
      expect(virtualEntries.length).toBe(1);
      expect(virtualEntries[0].name).toBe('newfile.txt');
    });

    it('returns empty array for unrelated directory', () => {
      store.create('s3://bucket/other/newfile.txt', 'newfile.txt', EntryType.File);

      const virtualEntries = store.getVirtualEntries('dest/', 's3', 'bucket');
      expect(virtualEntries.length).toBe(0);
    });
  });

  // ============================================
  // Undo/Redo
  // ============================================
  describe('undo/redo', () => {
    it('undoes last operation', () => {
      const entry = createTestEntry('file.txt');
      const uri = 's3://bucket/test/file.txt';

      store.markForDeletion(uri, entry);
      expect(store.canUndo()).toBe(true);

      store.undo();
      expect(store.hasPendingChanges()).toBe(false);
      expect(store.canUndo()).toBe(false);
    });

    it('redoes undone operation', () => {
      const entry = createTestEntry('file.txt');
      const uri = 's3://bucket/test/file.txt';

      store.markForDeletion(uri, entry);
      store.undo();
      expect(store.canRedo()).toBe(true);

      store.redo();
      expect(store.hasPendingChanges()).toBe(true);
      expect(store.isMarkedForDeletion(uri)).toBe(true);
    });

    it('clears redo stack on new operation', () => {
      const entry1 = createTestEntry('file1.txt');
      const entry2 = createTestEntry('file2.txt');

      store.markForDeletion('s3://bucket/test/file1.txt', entry1);
      store.undo();
      expect(store.canRedo()).toBe(true);

      store.markForDeletion('s3://bucket/test/file2.txt', entry2);
      expect(store.canRedo()).toBe(false);
    });

    it('returns false when nothing to undo', () => {
      expect(store.undo()).toBe(false);
    });

    it('returns false when nothing to redo', () => {
      expect(store.redo()).toBe(false);
    });
  });

  // ============================================
  // Discard and Remove
  // ============================================
  describe('discard and remove', () => {
    it('discard clears all state', () => {
      const entry = createTestEntry('file.txt');
      store.markForDeletion('s3://bucket/test/file.txt', entry);
      store.copy([entry], ['s3://bucket/test/file.txt']);

      store.discard();

      expect(store.hasPendingChanges()).toBe(false);
      expect(store.hasClipboardContent()).toBe(false);
      expect(store.canUndo()).toBe(false);
    });

    it('removeOperation removes specific operation', () => {
      const entry1 = createTestEntry('file1.txt');
      const entry2 = createTestEntry('file2.txt');

      store.markForDeletion('s3://bucket/test/file1.txt', entry1);
      store.markForDeletion('s3://bucket/test/file2.txt', entry2);

      const ops = store.getOperations();
      store.removeOperation(ops[0].id);

      expect(store.getPendingCount()).toBe(1);
    });
  });

  // ============================================
  // Subscriptions
  // ============================================
  describe('subscriptions', () => {
    it('notifies subscribers on changes', () => {
      const listener = mock(() => {});
      store.subscribe(listener);

      const entry = createTestEntry('file.txt');
      store.markForDeletion('s3://bucket/test/file.txt', entry);

      expect(listener).toHaveBeenCalled();
    });

    it('unsubscribe stops notifications', () => {
      const listener = mock(() => {});
      const unsubscribe = store.subscribe(listener);

      unsubscribe();

      const entry = createTestEntry('file.txt');
      store.markForDeletion('s3://bucket/test/file.txt', entry);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // Snapshot
  // ============================================
  describe('getSnapshot', () => {
    it('returns current state snapshot', () => {
      const entry = createTestEntry('file.txt');
      store.markForDeletion('s3://bucket/test/file.txt', entry);

      const snapshot = store.getSnapshot();

      expect(snapshot.operations.length).toBe(1);
      expect(snapshot.clipboard).toBeNull();
      expect(snapshot.canUndo).toBe(true);
      expect(snapshot.canRedo).toBe(false);
    });
  });

  // ============================================
  // Execute
  // ============================================
  describe('execute', () => {
    it('executes delete operations', async () => {
      const mockProvider = {
        delete: mock(() => Promise.resolve({ status: OperationStatus.Success })),
      } as unknown as StorageProvider;

      const entry = createTestEntry('file.txt');
      store.markForDeletion('s3://bucket/test/file.txt', entry);

      const failed = await store.execute(mockProvider);

      expect(failed.length).toBe(0);
      expect(mockProvider.delete).toHaveBeenCalled();
      expect(store.hasPendingChanges()).toBe(false);
    });

    it('executes move operations', async () => {
      const mockProvider = {
        move: mock(() => Promise.resolve({ status: OperationStatus.Success })),
      } as unknown as StorageProvider;

      const entry = createTestEntry('file.txt');
      store.cut([entry], ['s3://bucket/source/file.txt']);
      store.paste('dest/', 's3', 'bucket');

      const failed = await store.execute(mockProvider);

      expect(failed.length).toBe(0);
      expect(mockProvider.move).toHaveBeenCalled();
    });

    it('executes copy operations', async () => {
      const mockProvider = {
        copy: mock(() => Promise.resolve({ status: OperationStatus.Success })),
      } as unknown as StorageProvider;

      const entry = createTestEntry('file.txt');
      store.copy([entry], ['s3://bucket/source/file.txt']);
      store.paste('dest/', 's3', 'bucket');

      const failed = await store.execute(mockProvider);

      expect(failed.length).toBe(0);
      expect(mockProvider.copy).toHaveBeenCalled();
    });

    it('executes rename operations as move', async () => {
      const mockProvider = {
        move: mock(() => Promise.resolve({ status: OperationStatus.Success })),
      } as unknown as StorageProvider;

      const entry = createTestEntry('old.txt');
      store.rename('s3://bucket/test/old.txt', entry, 'new.txt');

      const failed = await store.execute(mockProvider);

      expect(failed.length).toBe(0);
      expect(mockProvider.move).toHaveBeenCalledWith('test/old.txt', 'test/new.txt');
    });

    it('executes create operations', async () => {
      const mockProvider = {
        mkdir: mock(() => Promise.resolve({ status: OperationStatus.Success })),
      } as unknown as StorageProvider;

      store.create('s3://bucket/test/newdir/', 'newdir', EntryType.Directory);

      const failed = await store.execute(mockProvider);

      expect(failed.length).toBe(0);
      expect(mockProvider.mkdir).toHaveBeenCalled();
    });

    it('returns failed operations', async () => {
      const mockProvider = {
        delete: mock(() =>
          Promise.resolve({
            status: OperationStatus.Error,
            error: { code: 'ERROR', message: 'Delete failed', retryable: false },
          })
        ),
      } as unknown as StorageProvider;

      const entry = createTestEntry('file.txt');
      store.markForDeletion('s3://bucket/test/file.txt', entry);

      const failed = await store.execute(mockProvider);

      expect(failed.length).toBe(1);
      expect(store.hasPendingChanges()).toBe(true);
    });

    it('calls progress callback', async () => {
      const mockProvider = {
        delete: mock(() => Promise.resolve({ status: OperationStatus.Success })),
      } as unknown as StorageProvider;

      const onProgress = mock(() => {});
      const entry = createTestEntry('file.txt');
      store.markForDeletion('s3://bucket/test/file.txt', entry);

      await store.execute(mockProvider, onProgress);

      expect(onProgress).toHaveBeenCalledWith(expect.any(Object), 0, 1);
    });

    it('executes operations in correct order', async () => {
      const executionOrder: string[] = [];

      const mockProvider = {
        mkdir: mock(() => {
          executionOrder.push('create');
          return Promise.resolve({ status: OperationStatus.Success });
        }),
        copy: mock(() => {
          executionOrder.push('copy');
          return Promise.resolve({ status: OperationStatus.Success });
        }),
        move: mock(() => {
          executionOrder.push('move');
          return Promise.resolve({ status: OperationStatus.Success });
        }),
        delete: mock(() => {
          executionOrder.push('delete');
          return Promise.resolve({ status: OperationStatus.Success });
        }),
      } as unknown as StorageProvider;

      // Add operations in reverse order
      const entry = createTestEntry('file.txt');
      store.markForDeletion('s3://bucket/test/file.txt', entry);
      store.cut([entry], ['s3://bucket/src/file.txt']);
      store.paste('dst/', 's3', 'bucket');
      store.copy([entry], ['s3://bucket/src2/file.txt']);
      store.paste('dst2/', 's3', 'bucket');
      store.create('s3://bucket/test/newdir/', 'newdir', EntryType.Directory);

      await store.execute(mockProvider);

      // Order: create, copy, move, delete
      expect(executionOrder[0]).toBe('create');
      expect(executionOrder[1]).toBe('copy');
      expect(executionOrder[2]).toBe('move');
      expect(executionOrder[3]).toBe('delete');
    });
  });

  // ============================================
  // Global Store
  // ============================================
  describe('global store', () => {
    it('returns same instance', () => {
      const store1 = getPendingOperationsStore();
      const store2 = getPendingOperationsStore();

      expect(store1).toBe(store2);
    });

    it('reset creates new instance', () => {
      const store1 = getPendingOperationsStore();
      const entry = createTestEntry('file.txt');
      store1.markForDeletion('s3://bucket/test/file.txt', entry);

      resetPendingOperationsStore();
      const store2 = getPendingOperationsStore();

      expect(store2.hasPendingChanges()).toBe(false);
    });
  });

  // ============================================
  // getOperationsForPath
  // ============================================
  describe('getOperationsForPath', () => {
    it('returns operations affecting a path', () => {
      const entry1 = createTestEntry('file1.txt');
      const entry2 = createTestEntry('file2.txt');

      store.markForDeletion('s3://bucket/foo/file1.txt', entry1);
      store.markForDeletion('s3://bucket/bar/file2.txt', entry2);

      const fooOps = store.getOperationsForPath('foo/', 's3', 'bucket');
      expect(fooOps.length).toBe(1);

      const barOps = store.getOperationsForPath('bar/', 's3', 'bucket');
      expect(barOps.length).toBe(1);
    });

    it('returns move operations for source and dest paths', () => {
      const entry = createTestEntry('file.txt');
      store.cut([entry], ['s3://bucket/source/file.txt']);
      store.paste('dest/', 's3', 'bucket');

      const sourceOps = store.getOperationsForPath('source/', 's3', 'bucket');
      expect(sourceOps.length).toBe(1);

      const destOps = store.getOperationsForPath('dest/', 's3', 'bucket');
      expect(destOps.length).toBe(1);
    });
  });
});
