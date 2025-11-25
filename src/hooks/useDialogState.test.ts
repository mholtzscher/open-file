/**
 * Tests for useDialogState hook and dialogReducer
 */

import { describe, it, expect } from 'bun:test';
import { dialogReducer, initialDialogState } from './useDialogState';
import type { DialogState, DialogAction, PendingOperation } from '../types/dialog';
import { EntryType } from '../types/entry';

const createTestOperation = (
  id: string,
  type: PendingOperation['type'] = 'delete'
): PendingOperation => ({
  id,
  type,
  path: `/test/${id}`,
});

describe('dialogReducer', () => {
  describe('SHOW_CONFIRM action', () => {
    it('should show confirm dialog with operations', () => {
      const operations = [createTestOperation('op1'), createTestOperation('op2')];
      const action: DialogAction = {
        type: 'SHOW_CONFIRM',
        payload: { operations },
      };

      const result = dialogReducer(initialDialogState, action);

      expect(result.activeDialog).toBe('confirm');
      expect(result.pendingOperations).toEqual(operations);
    });

    it('should replace existing dialog when showing confirm', () => {
      const state: DialogState = {
        activeDialog: 'help',
        pendingOperations: [],
      };
      const operations = [createTestOperation('op1')];
      const action: DialogAction = {
        type: 'SHOW_CONFIRM',
        payload: { operations },
      };

      const result = dialogReducer(state, action);

      expect(result.activeDialog).toBe('confirm');
      expect(result.pendingOperations).toEqual(operations);
    });
  });

  describe('SHOW_HELP action', () => {
    it('should show help dialog', () => {
      const action: DialogAction = { type: 'SHOW_HELP' };

      const result = dialogReducer(initialDialogState, action);

      expect(result.activeDialog).toBe('help');
    });

    it('should preserve pending operations when showing help', () => {
      const state: DialogState = {
        activeDialog: null,
        pendingOperations: [createTestOperation('op1')],
      };
      const action: DialogAction = { type: 'SHOW_HELP' };

      const result = dialogReducer(state, action);

      expect(result.activeDialog).toBe('help');
      expect(result.pendingOperations).toEqual(state.pendingOperations);
    });
  });

  describe('SHOW_SORT action', () => {
    it('should show sort menu', () => {
      const action: DialogAction = { type: 'SHOW_SORT' };

      const result = dialogReducer(initialDialogState, action);

      expect(result.activeDialog).toBe('sort');
    });
  });

  describe('SHOW_UPLOAD action', () => {
    it('should show upload dialog', () => {
      const action: DialogAction = { type: 'SHOW_UPLOAD' };

      const result = dialogReducer(initialDialogState, action);

      expect(result.activeDialog).toBe('upload');
    });
  });

  describe('CLOSE action', () => {
    it('should close any active dialog', () => {
      const state: DialogState = {
        activeDialog: 'help',
        pendingOperations: [],
      };
      const action: DialogAction = { type: 'CLOSE' };

      const result = dialogReducer(state, action);

      expect(result.activeDialog).toBe(null);
    });

    it('should preserve pending operations when closing', () => {
      const operations = [createTestOperation('op1')];
      const state: DialogState = {
        activeDialog: 'confirm',
        pendingOperations: operations,
      };
      const action: DialogAction = { type: 'CLOSE' };

      const result = dialogReducer(state, action);

      expect(result.activeDialog).toBe(null);
      expect(result.pendingOperations).toEqual(operations);
    });
  });

  describe('CLEAR_OPERATIONS action', () => {
    it('should clear pending operations', () => {
      const state: DialogState = {
        activeDialog: null,
        pendingOperations: [createTestOperation('op1'), createTestOperation('op2')],
      };
      const action: DialogAction = { type: 'CLEAR_OPERATIONS' };

      const result = dialogReducer(state, action);

      expect(result.pendingOperations).toEqual([]);
    });

    it('should preserve active dialog when clearing operations', () => {
      const state: DialogState = {
        activeDialog: 'sort',
        pendingOperations: [createTestOperation('op1')],
      };
      const action: DialogAction = { type: 'CLEAR_OPERATIONS' };

      const result = dialogReducer(state, action);

      expect(result.activeDialog).toBe('sort');
      expect(result.pendingOperations).toEqual([]);
    });
  });

  describe('unknown action', () => {
    it('should return current state for unknown actions', () => {
      const state: DialogState = {
        activeDialog: 'help',
        pendingOperations: [],
      };
      const action = { type: 'UNKNOWN' } as unknown as DialogAction;

      const result = dialogReducer(state, action);

      expect(result).toEqual(state);
    });
  });
});

describe('initialDialogState', () => {
  it('should have sensible defaults', () => {
    expect(initialDialogState.activeDialog).toBe(null);
    expect(initialDialogState.pendingOperations).toEqual([]);
  });
});

describe('dialog state scenarios', () => {
  it('should handle typical confirm flow', () => {
    let state = initialDialogState;

    // Show confirm with operations
    const operations = [createTestOperation('op1', 'delete'), createTestOperation('op2', 'delete')];
    state = dialogReducer(state, {
      type: 'SHOW_CONFIRM',
      payload: { operations },
    });
    expect(state.activeDialog).toBe('confirm');
    expect(state.pendingOperations).toHaveLength(2);

    // Close after confirmation
    state = dialogReducer(state, { type: 'CLOSE' });
    expect(state.activeDialog).toBe(null);

    // Clear operations
    state = dialogReducer(state, { type: 'CLEAR_OPERATIONS' });
    expect(state.pendingOperations).toEqual([]);
  });

  it('should handle help dialog toggle pattern', () => {
    let state = initialDialogState;

    // Open help
    state = dialogReducer(state, { type: 'SHOW_HELP' });
    expect(state.activeDialog).toBe('help');

    // Close help
    state = dialogReducer(state, { type: 'CLOSE' });
    expect(state.activeDialog).toBe(null);

    // Re-open help
    state = dialogReducer(state, { type: 'SHOW_HELP' });
    expect(state.activeDialog).toBe('help');
  });

  it('should allow switching between dialogs', () => {
    let state = initialDialogState;

    // Open help
    state = dialogReducer(state, { type: 'SHOW_HELP' });
    expect(state.activeDialog).toBe('help');

    // Switch to sort (replaces help)
    state = dialogReducer(state, { type: 'SHOW_SORT' });
    expect(state.activeDialog).toBe('sort');

    // Switch to upload
    state = dialogReducer(state, { type: 'SHOW_UPLOAD' });
    expect(state.activeDialog).toBe('upload');
  });

  it('should handle upload dialog flow', () => {
    let state = initialDialogState;

    // Open upload
    state = dialogReducer(state, { type: 'SHOW_UPLOAD' });
    expect(state.activeDialog).toBe('upload');

    // Close and show confirm with upload operations
    state = dialogReducer(state, { type: 'CLOSE' });
    const uploadOps = [
      createTestOperation('upload1', 'upload'),
      createTestOperation('upload2', 'upload'),
    ];
    state = dialogReducer(state, {
      type: 'SHOW_CONFIRM',
      payload: { operations: uploadOps },
    });

    expect(state.activeDialog).toBe('confirm');
    expect(state.pendingOperations[0].type).toBe('upload');
  });

  it('should handle cancel from confirm dialog', () => {
    let state = initialDialogState;

    // Show confirm with operations
    const operations = [createTestOperation('op1', 'delete')];
    state = dialogReducer(state, {
      type: 'SHOW_CONFIRM',
      payload: { operations },
    });

    // Cancel (close and clear)
    state = dialogReducer(state, { type: 'CLOSE' });
    state = dialogReducer(state, { type: 'CLEAR_OPERATIONS' });

    expect(state.activeDialog).toBe(null);
    expect(state.pendingOperations).toEqual([]);
  });
});

describe('PendingOperation types', () => {
  it('should support all operation types', () => {
    const operationTypes: PendingOperation['type'][] = [
      'create',
      'delete',
      'move',
      'copy',
      'download',
      'upload',
    ];

    for (const type of operationTypes) {
      const operation = createTestOperation(`test-${type}`, type);
      expect(operation.type).toBe(type);
    }
  });

  it('should support optional fields', () => {
    const minimalOp: PendingOperation = {
      id: 'minimal',
      type: 'delete',
    };
    expect(minimalOp.path).toBeUndefined();
    expect(minimalOp.source).toBeUndefined();
    expect(minimalOp.destination).toBeUndefined();
    expect(minimalOp.entry).toBeUndefined();
    expect(minimalOp.recursive).toBeUndefined();
  });

  it('should support full operation details', () => {
    const fullOp: PendingOperation = {
      id: 'full',
      type: 'move',
      path: '/current/path',
      source: '/source/path',
      destination: '/dest/path',
      entry: {
        id: 'entry1',
        name: 'file.txt',
        path: '/current/file.txt',
        type: EntryType.File,
        size: 1024,
        modified: new Date('2024-01-01'),
        metadata: { custom: { key: 'value' } },
      },
      recursive: true,
    };

    expect(fullOp.entry?.name).toBe('file.txt');
    expect(fullOp.recursive).toBe(true);
  });
});
