/**
 * Tests for yy copy motion
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { BufferState, EditMode } from './buffer-state.js';
import { Entry, EntryType } from '../types/entry.js';

describe('yy Copy Motion', () => {
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
    ];

    bufferState = new BufferState(entries);
  });

  describe('key sequence detection', () => {
    it('should detect single y key', () => {
      const result = bufferState.handleKeyPress('y');
      
      expect(result.handled).toBe(false);
      expect(result.sequence).toEqual(['y']);
    });

    it('should detect yy sequence', () => {
      // First y
      bufferState.handleKeyPress('y');
      // Second y
      const result = bufferState.handleKeyPress('y');
      
      expect(result.handled).toBe(true);
      expect(result.sequence).toEqual(['y', 'y']);
      expect(result.action).toBe('copy');
    });

    it('should clear sequence on non-y key after y', () => {
      bufferState.handleKeyPress('y');
      const result = bufferState.handleKeyPress('j');
      
      expect(result.handled).toBe(false);
      expect(result.sequence).toEqual(['y', 'j']);
    });
  });

  describe('copy register', () => {
    it('should copy current entry to clipboard on yy', () => {
      bufferState.selection.cursorIndex = 1;
      
      // Simulate yy sequence
      bufferState.handleKeyPress('y');
      bufferState.handleKeyPress('y');
      
      // Copy should have been registered
      bufferState.copySelection();
      
      expect(bufferState.copyRegister.length).toBe(1);
      expect(bufferState.copyRegister[0].name).toBe('file2.txt');
    });

    it('should work from any cursor position', () => {
      // Start at different position
      bufferState.selection.cursorIndex = 0;
      bufferState.handleKeyPress('y');
      bufferState.handleKeyPress('y');
      
      bufferState.copySelection();
      expect(bufferState.copyRegister[0].name).toBe('file1.txt');
    });
  });

  describe('edge cases', () => {
    it('should handle empty buffer', () => {
      const emptyBuffer = new BufferState([]);
      
      const result = emptyBuffer.handleKeyPress('y');
      expect(result.handled).toBe(false);
      
      const result2 = emptyBuffer.handleKeyPress('y');
      expect(result2.handled).toBe(true);
      expect(result2.action).toBe('copy');
    });

    it('should handle single entry buffer', () => {
      const singleBuffer = new BufferState([entries[0]]);
      
      singleBuffer.handleKeyPress('y');
      const result = singleBuffer.handleKeyPress('y');
      
      expect(result.handled).toBe(true);
      expect(result.action).toBe('copy');
    });
  });
});
