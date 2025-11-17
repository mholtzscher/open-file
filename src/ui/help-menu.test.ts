/**
 * Tests for g? help menu sequence
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { BufferState, EditMode } from './buffer-state.js';
import { Entry, EntryType } from '../types/entry.js';

describe('g? Help Menu Sequence', () => {
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
    ];

    bufferState = new BufferState(entries);
  });

  describe('key sequence detection', () => {
    it('should detect single g key', () => {
      const result = bufferState.handleKeyPress('g');

      expect(result.handled).toBe(false);
      expect(result.sequence).toEqual(['g']);
    });

    it('should detect g? sequence', () => {
      // First g
      bufferState.handleKeyPress('g');
      // Then ?
      const result = bufferState.handleKeyPress('?');

      expect(result.handled).toBe(true);
      expect(result.sequence).toEqual(['g', '?']);
      expect(result.action).toBe('help');
    });

    it('should clear sequence after g?', () => {
      // First g
      bufferState.handleKeyPress('g');
      // Then ?
      bufferState.handleKeyPress('?');

      // Next key should start fresh
      const result = bufferState.handleKeyPress('j');
      expect(result.handled).toBe(false);
      expect(result.sequence).toEqual(['j']);
    });

    it('should distinguish between gg and g?', () => {
      // First test gg
      bufferState.handleKeyPress('g');
      const gg_result = bufferState.handleKeyPress('g');
      expect(gg_result.action).toBe('moveToTop');

      // Now test g?
      bufferState.handleKeyPress('g');
      const gq_result = bufferState.handleKeyPress('?');
      expect(gq_result.action).toBe('help');
    });
  });

  describe('help menu action', () => {
    it('should trigger help action on g?', () => {
      bufferState.handleKeyPress('g');
      const result = bufferState.handleKeyPress('?');

      expect(result.action).toBe('help');
    });

    it('should reset key sequence after help', () => {
      // Trigger help
      bufferState.handleKeyPress('g');
      bufferState.handleKeyPress('?');

      // Try to trigger another sequence
      bufferState.handleKeyPress('d');
      const result = bufferState.handleKeyPress('d');

      expect(result.action).toBe('delete');
    });
  });

  describe('edge cases', () => {
    it('should handle timeout correctly', done => {
      bufferState.handleKeyPress('g');

      // Wait for timeout
      setTimeout(() => {
        const result = bufferState.handleKeyPress('?');
        // After timeout, ? is treated as a single key, not part of g?
        expect(result.handled).toBe(false);
        done();
      }, 600);
    });

    it('should handle g followed by non-? key', () => {
      bufferState.handleKeyPress('g');
      const result = bufferState.handleKeyPress('j');

      expect(result.handled).toBe(false);
      expect(result.sequence).toEqual(['g', 'j']);
    });
  });
});
