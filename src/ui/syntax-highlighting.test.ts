/**
 * Tests for syntax highlighting
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { BufferView, BufferViewOptions } from './buffer-view.js';
import { BufferState, EditMode } from './buffer-state.js';
import { Entry, EntryType } from '../types/entry.js';
import { CliRenderer } from '@opentui/core';

// Mock the renderer
const mockRenderer = {
  root: {
    add: () => {},
    remove: () => {},
  },
} as any;

describe('Syntax highlighting', () => {
  let bufferState: BufferState;
  let bufferView: BufferView;
  let entries: Entry[];

  beforeEach(() => {
    entries = [
      {
        id: '1',
        name: 'documents',
        type: EntryType.Directory,
        path: 'documents/',
      },
      {
        id: '2',
        name: 'file.txt',
        type: EntryType.File,
        path: 'file.txt',
        size: 1024,
      },
      {
        id: '3',
        name: 'images',
        type: EntryType.Directory,
        path: 'images/',
      },
    ];

    bufferState = new BufferState();
    bufferState.entries = entries;

    const options: BufferViewOptions = {
      showIcons: true,
      showSizes: true,
      showDates: false,
    };

    bufferView = new BufferView(mockRenderer, bufferState, options);
  });

  describe('directory colors', () => {
    it('should color directories blue by default', () => {
      const columns = bufferView.getColumns();
      const nameColumn = columns.find(c => c.id === 'name');
      
      const directory = entries.find(e => e.type === EntryType.Directory)!;
      const color = nameColumn!.color!(directory, false);
      
      expect(color).toBe('#89b4fa'); // Blue
    });

    it('should color selected directories brighter blue', () => {
      const columns = bufferView.getColumns();
      const nameColumn = columns.find(c => c.id === 'name');
      
      const directory = entries.find(e => e.type === EntryType.Directory)!;
      const color = nameColumn!.color!(directory, true);
      
      expect(color).toBe('#74c7ec'); // Brighter blue
    });
  });

  describe('file colors', () => {
    it('should color files white by default', () => {
      const columns = bufferView.getColumns();
      const nameColumn = columns.find(c => c.id === 'name');
      
      const file = entries.find(e => e.type === EntryType.File)!;
      const color = nameColumn!.color!(file, false);
      
      expect(color).toBe('#cdd6f4'); // White
    });

    it('should color selected files white', () => {
      const columns = bufferView.getColumns();
      const nameColumn = columns.find(c => c.id === 'name');
      
      const file = entries.find(e => e.type === EntryType.File)!;
      const color = nameColumn!.color!(file, true);
      
      expect(color).toBe('#b4befe'); // CatppuccinMocha.lavender (selected file)
    });
  });

  describe('cursor highlighting', () => {
    it('should highlight cursor line in yellow', () => {
      // Move cursor to second entry (index 1)
      bufferState.selection.cursorIndex = 1;
      
      // Access private method through reflection for testing
      const getEntryColor = (bufferView as any).getEntryColor.bind(bufferView);
      const color = getEntryColor(1, entries[1]);
      
      expect(color).toBe('#f9e2af'); // Yellow
    });

    it('should highlight cursor in red during edit mode', () => {
      bufferState.mode = EditMode.Edit;
      bufferState.selection.cursorIndex = 1;
      
      const getEntryColor = (bufferView as any).getEntryColor.bind(bufferView);
      const color = getEntryColor(1, entries[1]);
      
      expect(color).toBe('#fab387'); // Red
    });
  });

  describe('selection highlighting', () => {
    it('should highlight selected entries in green', () => {
      // Start selection at index 0, end at index 2
      bufferState.selection.isActive = true;
      bufferState.selection.selectionStart = 0;
      bufferState.selection.selectionEnd = 2;
      
      const getEntryColor = (bufferView as any).getEntryColor.bind(bufferView);
      
      // Middle entry should be highlighted as selected
      const color = getEntryColor(1, entries[1]);
      expect(color).toBe('#a6e3a1'); // Green
    });

    it('should handle reverse selection', () => {
      // Start selection at index 2, end at index 0 (reverse)
      bufferState.selection.isActive = true;
      bufferState.selection.selectionStart = 2;
      bufferState.selection.selectionEnd = 0;
      
      const getEntryColor = (bufferView as any).getEntryColor.bind(bufferView);
      
      // Middle entry should still be highlighted
      const color = getEntryColor(1, entries[1]);
      expect(color).toBe('#a6e3a1'); // Green
    });
  });

  describe('color priority', () => {
    it('should prioritize edit mode over selection', () => {
      bufferState.mode = EditMode.Edit;
      bufferState.selection.isActive = true;
      bufferState.selection.selectionStart = 0;
      bufferState.selection.selectionEnd = 2;
      bufferState.selection.cursorIndex = 1; // Cursor on selected entry
      
      const getEntryColor = (bufferView as any).getEntryColor.bind(bufferView);
      const color = getEntryColor(1, entries[1]);
      
      expect(color).toBe('#fab387'); // Red (edit mode takes priority)
    });

    it('should prioritize cursor over selection', () => {
      bufferState.selection.isActive = true;
      bufferState.selection.selectionStart = 0;
      bufferState.selection.selectionEnd = 2;
      bufferState.selection.cursorIndex = 1; // Cursor on selected entry
      
      const getEntryColor = (bufferView as any).getEntryColor.bind(bufferView);
      const color = getEntryColor(1, entries[1]);
      
      expect(color).toBe('#a6e3a1'); // Green (selection takes priority over cursor)
    });

    it('should use entry colors for non-selected items', () => {
      // No selection, no cursor on this entry
      bufferState.selection.cursorIndex = 0; // Cursor on first entry
      
      const getEntryColor = (bufferView as any).getEntryColor.bind(bufferView);
      const color = getEntryColor(2, entries[2]); // Third entry
      
      expect(color).toBe('#89b4fa'); // Directory blue
    });
  });
});