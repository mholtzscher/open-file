/**
 * Tests for gg/G motions
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { BufferState } from './buffer-state.js';
import { Entry, EntryType } from '../types/entry.js';

describe('gg/G Motions', () => {
  let bufferState: BufferState;
  let entries: Entry[];

  beforeEach(() => {
    entries = [
      {
        id: '1',
        name: 'file1.txt',
        type: EntryType.File,
        path: 'file1.txt',
        size: 100,
      },
      {
        id: '2',
        name: 'file2.txt',
        type: EntryType.File,
        path: 'file2.txt',
        size: 200,
      },
      {
        id: '3',
        name: 'file3.txt',
        type: EntryType.File,
        path: 'file3.txt',
        size: 300,
      },
      {
        id: '4',
        name: 'file4.txt',
        type: EntryType.File,
        path: 'file4.txt',
        size: 400,
      },
      {
        id: '5',
        name: 'file5.txt',
        type: EntryType.File,
        path: 'file5.txt',
        size: 500,
      },
    ];

    bufferState = new BufferState(entries);
    // Start cursor in middle
    bufferState.selection.cursorIndex = 2;
  });

  describe('key sequence detection', () => {
    it('should detect single g key', () => {
      const result = bufferState.handleKeyPress('g');

      expect(result.handled).toBe(false);
      expect(result.sequence).toEqual(['g']);
    });

    it('should detect gg sequence', () => {
      // First g
      bufferState.handleKeyPress('g');
      // Second g
      const result = bufferState.handleKeyPress('g');

      expect(result.handled).toBe(true);
      expect(result.sequence).toEqual(['g', 'g']);
      expect(result.action).toBe('moveToTop');
    });

    it('should detect G key', () => {
      const result = bufferState.handleKeyPress('G');

      expect(result.handled).toBe(true);
      expect(result.sequence).toEqual(['G']);
      expect(result.action).toBe('moveToBottom');
    });

    it('should clear sequence after timeout', done => {
      bufferState.handleKeyPress('g');

      // Wait for timeout (500ms + small buffer)
      setTimeout(() => {
        const result = bufferState.handleKeyPress('j');
        expect(result.handled).toBe(false);
        expect(result.sequence).toEqual(['j']);
        done();
      }, 600);
    });

    it('should clear sequence on non-g key', () => {
      bufferState.handleKeyPress('g');
      const result = bufferState.handleKeyPress('j');

      expect(result.handled).toBe(false);
      // When a non-g key follows a single g, it should return the sequence that was there
      expect(result.sequence).toEqual(['g', 'j']);
    });
  });

  describe('cursor movement', () => {
    it('should move to top on gg', () => {
      // Simulate gg sequence
      bufferState.handleKeyPress('g');
      bufferState.handleKeyPress('g');

      expect(bufferState.selection.cursorIndex).toBe(0);
    });

    it('should move to bottom on G', () => {
      bufferState.handleKeyPress('G');

      expect(bufferState.selection.cursorIndex).toBe(4); // Last index
    });

    it('should work from any cursor position', () => {
      // Move to bottom first
      bufferState.selection.cursorIndex = 4;

      // Then gg to top
      bufferState.handleKeyPress('g');
      bufferState.handleKeyPress('g');

      expect(bufferState.selection.cursorIndex).toBe(0);
    });

    it('should work when already at top', () => {
      // Already at top
      bufferState.selection.cursorIndex = 0;

      bufferState.handleKeyPress('g');
      bufferState.handleKeyPress('g');

      expect(bufferState.selection.cursorIndex).toBe(0);
    });

    it('should work when already at bottom', () => {
      // Already at bottom
      bufferState.selection.cursorIndex = 4;

      bufferState.handleKeyPress('G');

      expect(bufferState.selection.cursorIndex).toBe(4);
    });
  });

  describe('edge cases', () => {
    it('should handle empty buffer', () => {
      const emptyBuffer = new BufferState([]);

      // Test that moveCursorToBottom works on empty buffer
      emptyBuffer.moveCursorToBottom();
      expect(emptyBuffer.selection.cursorIndex).toBe(0);

      // Create fresh buffer for G test
      const freshBuffer = new BufferState([]);
      const resultG = freshBuffer.handleKeyPress('G');
      expect(resultG.handled).toBe(true);
      expect(resultG.sequence).toEqual(['G']);
      expect(resultG.action).toBe('moveToBottom');
    });

    it('should handle single entry buffer', () => {
      const singleBuffer = new BufferState([entries[0]]);
      singleBuffer.selection.cursorIndex = 0;

      // gg should keep at 0
      singleBuffer.handleKeyPress('g');
      singleBuffer.handleKeyPress('g');
      expect(singleBuffer.selection.cursorIndex).toBe(0);

      // G should keep at 0
      singleBuffer.handleKeyPress('G');
      expect(singleBuffer.selection.cursorIndex).toBe(0);
    });

    it('should ignore extra g keys after gg', () => {
      bufferState.handleKeyPress('g');
      bufferState.handleKeyPress('g');

      // Third g should be treated as new sequence start
      const result = bufferState.handleKeyPress('g');
      expect(result.handled).toBe(false);
      expect(result.sequence).toEqual(['g']);
    });
  });
});
