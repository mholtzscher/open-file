/**
 * Performance tests for buffer state management
 *
 * Tests efficiency of operations and rendering with large datasets.
 * Uses the BufferState class directly for testing since it shares
 * the same algorithmic complexity as the useBufferState hook.
 */

import { describe, it, expect } from 'bun:test';
import { BufferState } from '../ui/buffer-state.js';
import { Entry, EntryType } from '../types/entry.js';
import { SortField, SortOrder } from '../utils/sorting.js';

/**
 * Create a large list of test entries
 */
function createLargeEntryList(count: number): Entry[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `entry-${i}`,
    name: `file-${i}.txt`,
    type: EntryType.File,
    path: `/bucket/folder/file-${i}.txt`,
    size: 1024 + i,
    modified: new Date(),
  }));
}

/**
 * Measure average time for an operation over multiple iterations
 */
function measureOperation(
  operation: () => void,
  iterations: number
): { avgMs: number; totalMs: number } {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    operation();
  }
  const totalMs = performance.now() - start;
  return { avgMs: totalMs / iterations, totalMs };
}

describe('Performance - Buffer State Operations', () => {
  const LARGE_ENTRY_COUNT = 10000;
  const ITERATIONS = 1000;

  describe('Cursor movement performance', () => {
    it('handles cursor movement in O(1) time with large lists', () => {
      const entries = createLargeEntryList(LARGE_ENTRY_COUNT);
      const buffer = new BufferState(entries);

      // Move cursor up and down many times
      const { avgMs: avgDownMs } = measureOperation(() => {
        buffer.moveCursorDown();
      }, ITERATIONS);

      // Reset to middle
      buffer.selection.cursorIndex = Math.floor(LARGE_ENTRY_COUNT / 2);

      const { avgMs: avgUpMs } = measureOperation(() => {
        buffer.moveCursorUp();
      }, ITERATIONS);

      // Cursor movement should be very fast (< 0.1ms per operation)
      expect(avgDownMs).toBeLessThan(0.1);
      expect(avgUpMs).toBeLessThan(0.1);
    });

    it('cursor to top/bottom is O(1)', () => {
      const entries = createLargeEntryList(LARGE_ENTRY_COUNT);
      const buffer = new BufferState(entries);

      const { avgMs: toBottomMs } = measureOperation(() => {
        buffer.moveCursorToBottom();
      }, ITERATIONS);

      const { avgMs: toTopMs } = measureOperation(() => {
        buffer.moveCursorToTop();
      }, ITERATIONS);

      // Jump operations should be constant time
      expect(toBottomMs).toBeLessThan(0.1);
      expect(toTopMs).toBeLessThan(0.1);
    });
  });

  describe('Selection operations performance', () => {
    it('visual selection start/extend is O(1)', () => {
      const entries = createLargeEntryList(LARGE_ENTRY_COUNT);
      const buffer = new BufferState(entries);

      const { avgMs: startMs } = measureOperation(() => {
        buffer.startVisualSelection();
      }, ITERATIONS);

      const { avgMs: extendMs } = measureOperation(() => {
        buffer.extendVisualSelection('down');
      }, ITERATIONS);

      expect(startMs).toBeLessThan(0.1);
      expect(extendMs).toBeLessThan(0.1);
    });

    it('getSelectedEntries is O(range) not O(n)', () => {
      const entries = createLargeEntryList(LARGE_ENTRY_COUNT);
      const buffer = new BufferState(entries);

      // Select a small range at the end
      buffer.selection.cursorIndex = LARGE_ENTRY_COUNT - 100;
      buffer.startVisualSelection();
      for (let i = 0; i < 99; i++) {
        buffer.extendVisualSelection('down');
      }

      // Getting 100 selected entries from a 10000 list
      const { avgMs } = measureOperation(() => {
        buffer.getSelectedEntries();
      }, ITERATIONS);

      // Should be proportional to selection size (100), not total entries (10000)
      expect(avgMs).toBeLessThan(0.1);
    });
  });

  describe('Copy/paste performance', () => {
    it('copy operation is O(selection size)', () => {
      const entries = createLargeEntryList(LARGE_ENTRY_COUNT);
      const buffer = new BufferState(entries);

      // Select 100 entries
      buffer.selection.cursorIndex = 0;
      buffer.startVisualSelection();
      for (let i = 0; i < 99; i++) {
        buffer.extendVisualSelection('down');
      }

      const { avgMs } = measureOperation(() => {
        buffer.copySelection();
      }, 100); // Fewer iterations since copy involves JSON

      // Copy 100 entries should be fast
      expect(avgMs).toBeLessThan(1);
    });

    it('clipboard check is O(1)', () => {
      const entries = createLargeEntryList(LARGE_ENTRY_COUNT);
      const buffer = new BufferState(entries);
      buffer.copySelection();

      const { avgMs } = measureOperation(() => {
        buffer.hasClipboardContent();
      }, ITERATIONS);

      expect(avgMs).toBeLessThan(0.01);
    });
  });

  describe('Search filtering performance', () => {
    it('search filtering completes in reasonable time for large lists', () => {
      const entries = createLargeEntryList(LARGE_ENTRY_COUNT);
      const buffer = new BufferState(entries);

      // Activate search with a filter
      buffer.searchQuery = 'file-999'; // Matches ~11 entries (file-999, file-9990-9999)

      const { totalMs } = measureOperation(() => {
        buffer.getFilteredEntries();
      }, 100);

      // Filtering 10000 entries 100 times should complete in under 500ms total
      expect(totalMs).toBeLessThan(500);
    });

    it('updateSearchQuery handles live typing efficiently', () => {
      const entries = createLargeEntryList(LARGE_ENTRY_COUNT);
      const buffer = new BufferState(entries);

      // Simulate typing a search query character by character
      const query = 'file-123';
      const start = performance.now();

      for (const char of query) {
        buffer.updateSearchQuery(buffer.searchQuery + char);
      }

      const elapsed = performance.now() - start;

      // Typing 8 characters with live filtering should be responsive
      expect(elapsed).toBeLessThan(100);
    });
  });

  describe('Mode transitions performance', () => {
    it('mode transitions are O(1)', () => {
      const entries = createLargeEntryList(LARGE_ENTRY_COUNT);
      const buffer = new BufferState(entries);

      const modes = [
        () => buffer.enterEditMode(),
        () => buffer.exitEditMode(),
        () => buffer.enterInsertMode(),
        () => buffer.exitInsertMode(),
        () => buffer.enterSearchMode(),
        () => buffer.exitSearchMode(),
        () => buffer.startVisualSelection(),
        () => buffer.exitVisualSelection(),
      ];

      for (const modeTransition of modes) {
        const { avgMs } = measureOperation(modeTransition, ITERATIONS);
        expect(avgMs).toBeLessThan(0.1);
      }
    });
  });

  describe('Key sequence handling performance', () => {
    it('handleKeyPress executes in constant time', () => {
      const entries = createLargeEntryList(LARGE_ENTRY_COUNT);
      const buffer = new BufferState(entries);

      const keys = ['j', 'k', 'g', 'g', 'G', 'd', 'd', 'y', 'y', 'p'];

      const { totalMs } = measureOperation(() => {
        for (const key of keys) {
          buffer.handleKeyPress(key);
        }
      }, 100);

      // 1000 key presses should be very fast
      expect(totalMs).toBeLessThan(50);
    });
  });

  describe('Undo/redo performance', () => {
    it('saveToHistory operates efficiently', () => {
      const entries = createLargeEntryList(1000); // Smaller set for undo tests
      const buffer = new BufferState(entries);

      const { avgMs } = measureOperation(() => {
        buffer.saveToHistory();
      }, 50);

      // Cloning state involves JSON, but should still be reasonable
      expect(avgMs).toBeLessThan(20);
    });

    it('undo/redo operations are efficient', () => {
      const entries = createLargeEntryList(1000);
      const buffer = new BufferState(entries);

      // Create some history
      for (let i = 0; i < 10; i++) {
        buffer.saveToHistory();
        buffer.moveCursorDown();
      }

      const { avgMs: undoMs } = measureOperation(() => {
        if (buffer.canUndo()) {
          buffer.undo();
        }
      }, 10);

      const { avgMs: redoMs } = measureOperation(() => {
        if (buffer.canRedo()) {
          buffer.redo();
        }
      }, 10);

      // Undo/redo should be fast
      expect(undoMs).toBeLessThan(20);
      expect(redoMs).toBeLessThan(20);
    });
  });

  describe('Pagination performance', () => {
    it('pageUp/pageDown are O(1)', () => {
      const entries = createLargeEntryList(LARGE_ENTRY_COUNT);
      const buffer = new BufferState(entries);

      const { avgMs: pageDownMs } = measureOperation(() => {
        buffer.pageDown();
      }, ITERATIONS);

      const { avgMs: pageUpMs } = measureOperation(() => {
        buffer.pageUp();
      }, ITERATIONS);

      expect(pageDownMs).toBeLessThan(0.1);
      expect(pageUpMs).toBeLessThan(0.1);
    });

    it('getVisibleEntries is O(page size) not O(n)', () => {
      const entries = createLargeEntryList(LARGE_ENTRY_COUNT);
      const buffer = new BufferState(entries);
      const pageSize = 20;

      const { avgMs } = measureOperation(() => {
        buffer.getVisibleEntries(pageSize);
      }, ITERATIONS);

      // Getting 20 entries from 10000 should be very fast
      expect(avgMs).toBeLessThan(0.1);
    });
  });

  describe('Sorting performance', () => {
    it('setSortConfig sorts in O(n log n) time', () => {
      const entries = createLargeEntryList(LARGE_ENTRY_COUNT);
      const buffer = new BufferState(entries);

      const configs = [
        { field: SortField.Name, order: SortOrder.Ascending },
        { field: SortField.Name, order: SortOrder.Descending },
        { field: SortField.Size, order: SortOrder.Ascending },
        { field: SortField.Modified, order: SortOrder.Descending },
      ];

      for (const config of configs) {
        const start = performance.now();
        buffer.setSortConfig(config);
        const elapsed = performance.now() - start;

        // Sorting 10000 entries should complete in under 100ms
        expect(elapsed).toBeLessThan(100);
      }
    });
  });

  describe('Memory efficiency', () => {
    it('entry deletion marking is O(1)', () => {
      const entries = createLargeEntryList(LARGE_ENTRY_COUNT);
      const buffer = new BufferState(entries);

      const { avgMs: deleteMs } = measureOperation(() => {
        buffer.deleteEntry(Math.floor(Math.random() * LARGE_ENTRY_COUNT));
      }, ITERATIONS);

      expect(deleteMs).toBeLessThan(0.1);
    });

    it('isEntryDeleted check is O(1) due to Set lookup', () => {
      const entries = createLargeEntryList(LARGE_ENTRY_COUNT);
      const buffer = new BufferState(entries);

      // Mark half the entries as deleted
      for (let i = 0; i < LARGE_ENTRY_COUNT / 2; i++) {
        buffer.deleteEntry(i);
      }

      const { avgMs } = measureOperation(() => {
        buffer.isEntryDeleted(Math.floor(Math.random() * LARGE_ENTRY_COUNT));
      }, ITERATIONS);

      expect(avgMs).toBeLessThan(0.1);
    });
  });

  describe('Initial load performance', () => {
    it('BufferState construction scales linearly with entry count', () => {
      const sizes = [100, 1000, 5000, 10000];
      const times: number[] = [];

      for (const size of sizes) {
        const entries = createLargeEntryList(size);
        const start = performance.now();
        new BufferState(entries);
        times.push(performance.now() - start);
      }

      // Verify roughly linear scaling
      // 100x entries should be roughly 100x time (with some overhead)
      const ratio = times[3] / times[0];
      // Allow significant variance due to JSON.parse overhead and GC
      expect(ratio).toBeLessThan(500);
    });
  });

  describe('Hidden files toggle performance', () => {
    it('toggleHiddenFiles operates efficiently', () => {
      // Create entries with some hidden files
      const entries: Entry[] = [];
      for (let i = 0; i < LARGE_ENTRY_COUNT; i++) {
        const name = i % 10 === 0 ? `.hidden-${i}` : `file-${i}.txt`;
        entries.push({
          id: `entry-${i}`,
          name,
          type: EntryType.File,
          path: `/bucket/${name}`,
        });
      }

      const buffer = new BufferState(entries);

      const { avgMs } = measureOperation(() => {
        buffer.toggleHiddenFiles();
      }, 100);

      // Toggle should be O(1) for the toggle itself, filtering is separate
      expect(avgMs).toBeLessThan(1);
    });
  });
});
