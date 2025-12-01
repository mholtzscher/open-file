/**
 * Tests for useProgressState hook and progressReducer
 */

import { describe, it, expect } from 'bun:test';
import { progressReducer, initialProgressState } from './useProgressState.js';
import type { ProgressState, ProgressAction } from '../types/progress.js';

describe('progressReducer', () => {
  describe('SHOW action', () => {
    it('should show progress with title', () => {
      const action: ProgressAction = {
        type: 'SHOW',
        payload: { title: 'Uploading' },
      };

      const result = progressReducer(initialProgressState, action);

      expect(result.visible).toBe(true);
      expect(result.title).toBe('Uploading');
      expect(result.cancelled).toBe(false);
    });

    it('should show progress with all options', () => {
      const action: ProgressAction = {
        type: 'SHOW',
        payload: {
          title: 'Downloading Files',
          description: 'Starting download...',
          totalNum: 10,
          cancellable: false,
        },
      };

      const result = progressReducer(initialProgressState, action);

      expect(result.visible).toBe(true);
      expect(result.title).toBe('Downloading Files');
      expect(result.description).toBe('Starting download...');
      expect(result.totalNum).toBe(10);
      expect(result.cancellable).toBe(false);
    });

    it('should use defaults for missing options', () => {
      const action: ProgressAction = {
        type: 'SHOW',
        payload: { title: 'Test' },
      };

      const result = progressReducer(initialProgressState, action);

      expect(result.description).toBe('Processing...');
      expect(result.totalNum).toBe(0);
      expect(result.cancellable).toBe(true);
    });

    it('should reset cancelled state when showing', () => {
      const cancelledState: ProgressState = {
        ...initialProgressState,
        cancelled: true,
      };

      const action: ProgressAction = {
        type: 'SHOW',
        payload: { title: 'New Operation' },
      };

      const result = progressReducer(cancelledState, action);

      expect(result.cancelled).toBe(false);
    });
  });

  describe('UPDATE action', () => {
    it('should update partial state', () => {
      const state: ProgressState = {
        ...initialProgressState,
        visible: true,
        title: 'Original',
      };

      const action: ProgressAction = {
        type: 'UPDATE',
        payload: { value: 50, description: 'Half done' },
      };

      const result = progressReducer(state, action);

      expect(result.value).toBe(50);
      expect(result.description).toBe('Half done');
      expect(result.title).toBe('Original'); // unchanged
      expect(result.visible).toBe(true); // unchanged
    });
  });

  describe('SET_FILE action', () => {
    it('should set file and calculate progress', () => {
      const state: ProgressState = {
        ...initialProgressState,
        visible: true,
        totalNum: 10,
      };

      const action: ProgressAction = {
        type: 'SET_FILE',
        payload: { file: 'test.txt', num: 5 },
      };

      const result = progressReducer(state, action);

      expect(result.currentFile).toBe('test.txt');
      expect(result.currentNum).toBe(5);
      expect(result.value).toBe(50); // 5/10 * 100
    });

    it('should handle zero totalNum', () => {
      const state: ProgressState = {
        ...initialProgressState,
        visible: true,
        totalNum: 0,
      };

      const action: ProgressAction = {
        type: 'SET_FILE',
        payload: { file: 'test.txt', num: 3 },
      };

      const result = progressReducer(state, action);

      expect(result.value).toBe(0);
    });

    it('should calculate 100% when at totalNum', () => {
      const state: ProgressState = {
        ...initialProgressState,
        visible: true,
        totalNum: 5,
      };

      const action: ProgressAction = {
        type: 'SET_FILE',
        payload: { file: 'last.txt', num: 5 },
      };

      const result = progressReducer(state, action);

      expect(result.value).toBe(100);
    });
  });

  describe('INCREMENT action', () => {
    it('should increment currentNum and recalculate progress', () => {
      const state: ProgressState = {
        ...initialProgressState,
        visible: true,
        totalNum: 4,
        currentNum: 1,
      };

      const action: ProgressAction = { type: 'INCREMENT' };

      const result = progressReducer(state, action);

      expect(result.currentNum).toBe(2);
      expect(result.value).toBe(50); // 2/4 * 100
    });

    it('should handle zero totalNum on increment', () => {
      const state: ProgressState = {
        ...initialProgressState,
        visible: true,
        totalNum: 0,
        currentNum: 1,
      };

      const action: ProgressAction = { type: 'INCREMENT' };

      const result = progressReducer(state, action);

      expect(result.currentNum).toBe(2);
      expect(result.value).toBe(0);
    });
  });

  describe('CANCEL action', () => {
    it('should set cancelled to true', () => {
      const state: ProgressState = {
        ...initialProgressState,
        visible: true,
        cancelled: false,
      };

      const action: ProgressAction = { type: 'CANCEL' };

      const result = progressReducer(state, action);

      expect(result.cancelled).toBe(true);
      expect(result.visible).toBe(true); // should still be visible
    });
  });

  describe('HIDE action', () => {
    it('should set visible to false', () => {
      const state: ProgressState = {
        ...initialProgressState,
        visible: true,
        title: 'Some Operation',
        value: 75,
      };

      const action: ProgressAction = { type: 'HIDE' };

      const result = progressReducer(state, action);

      expect(result.visible).toBe(false);
      expect(result.title).toBe('Some Operation'); // preserved
      expect(result.value).toBe(75); // preserved
    });
  });

  describe('RESET action', () => {
    it('should reset to initial state', () => {
      const state: ProgressState = {
        visible: true,
        title: 'Custom Title',
        description: 'Custom Description',
        value: 75,
        currentFile: 'file.txt',
        currentNum: 3,
        totalNum: 4,
        cancellable: false,
        cancelled: true,
      };

      const action: ProgressAction = { type: 'RESET' };

      const result = progressReducer(state, action);

      expect(result).toEqual(initialProgressState);
    });
  });

  describe('unknown action', () => {
    it('should return current state for unknown actions', () => {
      const state: ProgressState = {
        ...initialProgressState,
        visible: true,
        title: 'Test',
      };

      const action = { type: 'UNKNOWN' } as unknown as ProgressAction;

      const result = progressReducer(state, action);

      expect(result).toEqual(state);
    });
  });
});

describe('initialProgressState', () => {
  it('should have sensible defaults', () => {
    expect(initialProgressState.visible).toBe(false);
    expect(initialProgressState.title).toBe('Operation in Progress');
    expect(initialProgressState.description).toBe('Processing...');
    expect(initialProgressState.value).toBe(0);
    expect(initialProgressState.currentFile).toBe('');
    expect(initialProgressState.currentNum).toBe(0);
    expect(initialProgressState.totalNum).toBe(0);
    expect(initialProgressState.cancellable).toBe(true);
    expect(initialProgressState.cancelled).toBe(false);
  });
});

describe('progress calculation scenarios', () => {
  it('should handle progress through full workflow', () => {
    let state = initialProgressState;

    // Start operation
    state = progressReducer(state, {
      type: 'SHOW',
      payload: {
        title: 'Processing 3 files',
        totalNum: 3,
      },
    });
    expect(state.visible).toBe(true);
    expect(state.value).toBe(0);

    // Process first file
    state = progressReducer(state, {
      type: 'SET_FILE',
      payload: { file: 'file1.txt', num: 1 },
    });
    expect(state.currentFile).toBe('file1.txt');
    expect(state.currentNum).toBe(1);
    expect(state.value).toBeCloseTo(33.33, 1);

    // Process second file
    state = progressReducer(state, {
      type: 'SET_FILE',
      payload: { file: 'file2.txt', num: 2 },
    });
    expect(state.currentFile).toBe('file2.txt');
    expect(state.value).toBeCloseTo(66.67, 1);

    // Process third file
    state = progressReducer(state, {
      type: 'SET_FILE',
      payload: { file: 'file3.txt', num: 3 },
    });
    expect(state.value).toBe(100);

    // Hide when done
    state = progressReducer(state, { type: 'HIDE' });
    expect(state.visible).toBe(false);
  });

  it('should handle cancellation mid-operation', () => {
    let state = initialProgressState;

    // Start operation
    state = progressReducer(state, {
      type: 'SHOW',
      payload: { title: 'Long operation', totalNum: 100 },
    });

    // Process some files
    state = progressReducer(state, {
      type: 'SET_FILE',
      payload: { file: 'file25.txt', num: 25 },
    });
    expect(state.value).toBe(25);

    // Cancel
    state = progressReducer(state, { type: 'CANCEL' });
    expect(state.cancelled).toBe(true);
    expect(state.visible).toBe(true); // Still visible to show cancellation

    // Hide after acknowledging
    state = progressReducer(state, { type: 'HIDE' });
    expect(state.visible).toBe(false);
  });

  it('should handle using INCREMENT for simple counting', () => {
    let state = initialProgressState;

    state = progressReducer(state, {
      type: 'SHOW',
      payload: { title: 'Counting', totalNum: 5 },
    });

    for (let i = 0; i < 5; i++) {
      state = progressReducer(state, { type: 'INCREMENT' });
    }

    expect(state.currentNum).toBe(5);
    expect(state.value).toBe(100);
  });
});
