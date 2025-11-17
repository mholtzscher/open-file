/**
 * Tests for buffer state management including copy/paste
 */

import { describe, it, expect } from 'bun:test';
import { BufferState, EditMode } from './buffer-state.js';
import { Entry, EntryType } from '../types/entry.js';
import { generateEntryId } from '../utils/entry-id.js';

describe('BufferState', () => {
  describe('Copy/Paste Operations', () => {
    it('should copy selected entry to clipboard', () => {
      const id1 = generateEntryId();
      const entries: Entry[] = [
        {
          id: id1,
          name: 'file1.txt',
          type: EntryType.File,
          path: 'file1.txt',
        },
      ];

      const buffer = new BufferState(entries);
      buffer.copySelection();

      expect(buffer.copyRegister.length).toBe(1);
      expect(buffer.copyRegister[0].name).toBe('file1.txt');
    });

    it('should paste entries after cursor', () => {
      const id1 = generateEntryId();
      const id2 = generateEntryId();

      const entries: Entry[] = [
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

      const buffer = new BufferState(entries);
      buffer.copySelection();

      // Move cursor to second position
      buffer.moveCursorDown();

      // Paste after cursor
      const pastedEntries = buffer.pasteAfterCursor();

      expect(pastedEntries.length).toBe(1);
      expect(buffer.entries.length).toBe(3);
      expect(buffer.isDirty).toBe(true);
    });

    it('should paste entries before cursor', () => {
      const id1 = generateEntryId();
      const id2 = generateEntryId();

      const entries: Entry[] = [
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

      const buffer = new BufferState(entries);
      buffer.copySelection();

      // Move cursor to second position
      buffer.moveCursorDown();

      // Paste before cursor
      const pastedEntries = buffer.pasteBeforeCursor();

      expect(pastedEntries.length).toBe(1);
      expect(buffer.entries.length).toBe(3);
      expect(buffer.isDirty).toBe(true);
    });

    it('should not paste when clipboard is empty', () => {
      const id1 = generateEntryId();
      const entries: Entry[] = [
        {
          id: id1,
          name: 'file1.txt',
          type: EntryType.File,
          path: 'file1.txt',
        },
      ];

      const buffer = new BufferState(entries);

      // Try to paste without copying
      const pastedEntries = buffer.pasteAfterCursor();

      expect(pastedEntries.length).toBe(0);
      expect(buffer.entries.length).toBe(1);
    });

    it('should check if clipboard has content', () => {
      const id1 = generateEntryId();
      const entries: Entry[] = [
        {
          id: id1,
          name: 'file1.txt',
          type: EntryType.File,
          path: 'file1.txt',
        },
      ];

      const buffer = new BufferState(entries);

      expect(buffer.hasClipboardContent()).toBe(false);

      buffer.copySelection();

      expect(buffer.hasClipboardContent()).toBe(true);

      buffer.clearClipboard();

      expect(buffer.hasClipboardContent()).toBe(false);
    });

    it('should create new IDs for pasted entries', () => {
      const id1 = generateEntryId();
      const entries: Entry[] = [
        {
          id: id1,
          name: 'file1.txt',
          type: EntryType.File,
          path: 'file1.txt',
        },
      ];

      const buffer = new BufferState(entries);
      const originalId = buffer.entries[0].id;

      buffer.copySelection();
      const pastedEntries = buffer.pasteAfterCursor();

      expect(pastedEntries[0].id).not.toBe(originalId);
      expect(pastedEntries[0].name).toBe('file1.txt');
    });

    it('should clear clipboard', () => {
      const id1 = generateEntryId();
      const entries: Entry[] = [
        {
          id: id1,
          name: 'file1.txt',
          type: EntryType.File,
          path: 'file1.txt',
        },
      ];

      const buffer = new BufferState(entries);
      buffer.copySelection();

      expect(buffer.copyRegister.length).toBe(1);

      buffer.clearClipboard();

      expect(buffer.copyRegister.length).toBe(0);
    });
  });

  describe('Page Scrolling', () => {
    it('should page down through entries', () => {
      // Create 30 entries
      const entries: Entry[] = Array.from({ length: 30 }, (_, i) => ({
        id: generateEntryId(),
        name: `file${i + 1}.txt`,
        type: EntryType.File,
        path: `file${i + 1}.txt`,
      }));

      const buffer = new BufferState(entries);
      const pageSize = 10;

      expect(buffer.scrollOffset).toBe(0);

      buffer.pageDown(pageSize);
      expect(buffer.scrollOffset).toBe(10);

      buffer.pageDown(pageSize);
      expect(buffer.scrollOffset).toBe(20);

      // Should not scroll past end
      buffer.pageDown(pageSize);
      expect(buffer.scrollOffset).toBe(20);
    });

    it('should page up through entries', () => {
      const entries: Entry[] = Array.from({ length: 30 }, (_, i) => ({
        id: generateEntryId(),
        name: `file${i + 1}.txt`,
        type: EntryType.File,
        path: `file${i + 1}.txt`,
      }));

      const buffer = new BufferState(entries);
      const pageSize = 10;

      buffer.scrollOffset = 20;

      buffer.pageUp(pageSize);
      expect(buffer.scrollOffset).toBe(10);

      buffer.pageUp(pageSize);
      expect(buffer.scrollOffset).toBe(0);

      // Should not scroll past beginning
      buffer.pageUp(pageSize);
      expect(buffer.scrollOffset).toBe(0);
    });

    it('should get visible entries', () => {
      const entries: Entry[] = Array.from({ length: 30 }, (_, i) => ({
        id: generateEntryId(),
        name: `file${i + 1}.txt`,
        type: EntryType.File,
        path: `file${i + 1}.txt`,
      }));

      const buffer = new BufferState(entries);
      const pageSize = 10;

      const visibleEntries = buffer.getVisibleEntries(pageSize);
      expect(visibleEntries.length).toBe(10);
      expect(visibleEntries[0].name).toBe('file1.txt');

      buffer.scrollOffset = 10;
      const visibleEntries2 = buffer.getVisibleEntries(pageSize);
      expect(visibleEntries2[0].name).toBe('file11.txt');
    });

    it('should get visible cursor index', () => {
      const entries: Entry[] = Array.from({ length: 30 }, (_, i) => ({
        id: generateEntryId(),
        name: `file${i + 1}.txt`,
        type: EntryType.File,
        path: `file${i + 1}.txt`,
      }));

      const buffer = new BufferState(entries);
      const pageSize = 10;

      buffer.selection.cursorIndex = 0;
      expect(buffer.getVisibleCursorIndex(pageSize)).toBe(0);

      buffer.selection.cursorIndex = 5;
      expect(buffer.getVisibleCursorIndex(pageSize)).toBe(5);

      buffer.scrollOffset = 10;
      expect(buffer.getVisibleCursorIndex(pageSize)).toBe(0);

      buffer.selection.cursorIndex = 15;
      expect(buffer.getVisibleCursorIndex(pageSize)).toBe(5);
    });

    it('should keep cursor in visible area when paging', () => {
      const entries: Entry[] = Array.from({ length: 30 }, (_, i) => ({
        id: generateEntryId(),
        name: `file${i + 1}.txt`,
        type: EntryType.File,
        path: `file${i + 1}.txt`,
      }));

      const buffer = new BufferState(entries);
      const pageSize = 10;

      buffer.selection.cursorIndex = 5;
      buffer.pageDown(pageSize);

      // Cursor should be in visible range [10, 20)
      expect(buffer.selection.cursorIndex).toBeGreaterThanOrEqual(10);
      expect(buffer.selection.cursorIndex).toBeLessThan(20);
    });
  });

  describe('Search and Filter', () => {
    it('should filter entries by search query', () => {
      const entries: Entry[] = [
        {
          id: generateEntryId(),
          name: 'document.txt',
          type: EntryType.File,
          path: 'document.txt',
        },
        {
          id: generateEntryId(),
          name: 'readme.md',
          type: EntryType.File,
          path: 'readme.md',
        },
        {
          id: generateEntryId(),
          name: 'document.pdf',
          type: EntryType.File,
          path: 'document.pdf',
        },
      ];

      const buffer = new BufferState(entries);
      buffer.updateSearchQuery('document');

      const filtered = buffer.getFilteredEntries();
      expect(filtered.length).toBe(2);
      expect(filtered[0].name).toBe('document.txt');
      expect(filtered[1].name).toBe('document.pdf');
    });

    it('should be case-insensitive in search', () => {
      const entries: Entry[] = [
        {
          id: generateEntryId(),
          name: 'Document.txt',
          type: EntryType.File,
          path: 'Document.txt',
        },
        {
          id: generateEntryId(),
          name: 'readme.md',
          type: EntryType.File,
          path: 'readme.md',
        },
      ];

      const buffer = new BufferState(entries);
      buffer.updateSearchQuery('DOCUMENT');

      const filtered = buffer.getFilteredEntries();
      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe('Document.txt');
    });

    it('should get display entries respecting search and scroll', () => {
      const entries: Entry[] = Array.from({ length: 20 }, (_, i) => ({
        id: generateEntryId(),
        name: i < 10 ? `file${i + 1}.txt` : `doc${i - 9}.pdf`,
        type: EntryType.File,
        path: `file${i + 1}`,
      }));

      const buffer = new BufferState(entries);
      buffer.updateSearchQuery('file');

      const displayEntries = buffer.getDisplayEntries(10);
      expect(displayEntries.length).toBe(10);
      expect(displayEntries[0].name).toBe('file1.txt');
    });

    it('should enter and exit search mode', () => {
      const entries: Entry[] = [
        {
          id: generateEntryId(),
          name: 'file.txt',
          type: EntryType.File,
          path: 'file.txt',
        },
      ];

      const buffer = new BufferState(entries);
      expect(buffer.isSearching).toBe(false);

      buffer.enterSearchMode();
      expect(buffer.isSearching).toBe(true);
      expect(buffer.searchQuery).toBe('');

      buffer.updateSearchQuery('file');
      expect(buffer.searchQuery).toBe('file');

      buffer.exitSearchMode();
      expect(buffer.isSearching).toBe(false);
      expect(buffer.searchQuery).toBe('');
    });

    it('should check if entry matches search query', () => {
      const entries: Entry[] = [
        {
          id: generateEntryId(),
          name: 'document.txt',
          type: EntryType.File,
          path: 'document.txt',
        },
      ];

      const buffer = new BufferState(entries);
      const entry = entries[0];

      expect(buffer.isEntryMatching(entry)).toBe(true);

      buffer.updateSearchQuery('file');
      expect(buffer.isEntryMatching(entry)).toBe(false);

      buffer.updateSearchQuery('document');
      expect(buffer.isEntryMatching(entry)).toBe(true);
    });

    it('should return all entries when no search query', () => {
      const entries: Entry[] = [
        {
          id: generateEntryId(),
          name: 'file1.txt',
          type: EntryType.File,
          path: 'file1.txt',
        },
        {
          id: generateEntryId(),
          name: 'file2.txt',
          type: EntryType.File,
          path: 'file2.txt',
        },
      ];

      const buffer = new BufferState(entries);
      const filtered = buffer.getFilteredEntries();

      expect(filtered.length).toBe(2);
      expect(filtered).toEqual(entries);
    });
  });

  describe('Basic Operations', () => {
    it('should move cursor down', () => {
      const id1 = generateEntryId();
      const id2 = generateEntryId();

      const entries: Entry[] = [
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

      const buffer = new BufferState(entries);
      expect(buffer.selection.cursorIndex).toBe(0);

      buffer.moveCursorDown();
      expect(buffer.selection.cursorIndex).toBe(1);
    });

    it('should get selected entry', () => {
      const id1 = generateEntryId();
      const entries: Entry[] = [
        {
          id: id1,
          name: 'file1.txt',
          type: EntryType.File,
          path: 'file1.txt',
        },
      ];

      const buffer = new BufferState(entries);
      const selected = buffer.getSelectedEntry();

      expect(selected?.name).toBe('file1.txt');
    });
  });

  describe('Undo/Redo Operations', () => {
    it('should save state to undo history', () => {
      const id1 = generateEntryId();
      const entries: Entry[] = [
        {
          id: id1,
          name: 'file1.txt',
          type: EntryType.File,
          path: 'file1.txt',
        },
      ];

      const buffer = new BufferState(entries);
      expect(buffer.canUndo()).toBe(false);

      buffer.saveToHistory();
      expect(buffer.canUndo()).toBe(true);
    });

    it('should undo and restore previous state', () => {
      const id1 = generateEntryId();
      const id2 = generateEntryId();

      const entries: Entry[] = [
        {
          id: id1,
          name: 'file1.txt',
          type: EntryType.File,
          path: 'file1.txt',
        },
      ];

      const buffer = new BufferState(entries);
      buffer.saveToHistory();

      // Add an entry
      buffer.addEntry({
        id: id2,
        name: 'file2.txt',
        type: EntryType.File,
        path: 'file2.txt',
      });

      expect(buffer.entries.length).toBe(2);

      // Undo
      const didUndo = buffer.undo();
      expect(didUndo).toBe(true);
      expect(buffer.entries.length).toBe(1);
    });

    it('should redo and restore next state', () => {
      const id1 = generateEntryId();
      const id2 = generateEntryId();

      const entries: Entry[] = [
        {
          id: id1,
          name: 'file1.txt',
          type: EntryType.File,
          path: 'file1.txt',
        },
      ];

      const buffer = new BufferState(entries);
      buffer.saveToHistory();

      buffer.addEntry({
        id: id2,
        name: 'file2.txt',
        type: EntryType.File,
        path: 'file2.txt',
      });

      // Undo and then redo
      buffer.undo();
      expect(buffer.entries.length).toBe(1);

      const didRedo = buffer.redo();
      expect(didRedo).toBe(true);
      expect(buffer.entries.length).toBe(2);
    });

    it('should return false when no undo available', () => {
      const buffer = new BufferState([]);
      expect(buffer.undo()).toBe(false);
    });

    it('should return false when no redo available', () => {
      const buffer = new BufferState([]);
      expect(buffer.redo()).toBe(false);
    });

    it('should clear redo history on new change after undo', () => {
      const id1 = generateEntryId();
      const id2 = generateEntryId();
      const id3 = generateEntryId();

      const entries: Entry[] = [
        {
          id: id1,
          name: 'file1.txt',
          type: EntryType.File,
          path: 'file1.txt',
        },
      ];

      const buffer = new BufferState(entries);
      buffer.saveToHistory();

      buffer.addEntry({
        id: id2,
        name: 'file2.txt',
        type: EntryType.File,
        path: 'file2.txt',
      });

      buffer.undo();
      expect(buffer.canRedo()).toBe(true);

      // Make a new change
      buffer.addEntry({
        id: id3,
        name: 'file3.txt',
        type: EntryType.File,
        path: 'file3.txt',
      });

      expect(buffer.canRedo()).toBe(false);
    });
  });
});
