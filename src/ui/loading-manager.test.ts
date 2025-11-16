/**
 * Tests for loading manager
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { LoadingManager, LoadingState, LoadingOperation } from './loading-manager.js';
import { CliRenderer } from '@opentui/core';

// Mock renderer
const mockRenderer = {
  root: {
    add: () => {},
    remove: () => {},
  },
} as any;

describe('LoadingManager', () => {
  let loadingManager: LoadingManager;

  beforeEach(() => {
    loadingManager = new LoadingManager(mockRenderer);
  });

  afterEach(() => {
    loadingManager['stopSpinner']();
  });

  describe('loading operations', () => {
    it('should start loading operation', () => {
      loadingManager.startLoading('test-op', 'Test Operation');
      
      const operations = loadingManager.getActiveOperations();
      expect(operations).toHaveLength(1);
      expect(operations[0].id).toBe('test-op');
      expect(operations[0].name).toBe('Test Operation');
      expect(operations[0].state).toBe(LoadingState.Loading);
    });

    it('should update operation message', () => {
      loadingManager.startLoading('test-op', 'Test Operation');
      loadingManager.updateMessage('test-op', 'Updated message');
      
      const operation = loadingManager.getActiveOperations()[0];
      expect(operation.message).toBe('Updated message');
    });

    it('should update operation progress', () => {
      loadingManager.startLoading('test-op', 'Test Operation');
      loadingManager.updateProgress('test-op', 0.5);
      
      const operation = loadingManager.getActiveOperations()[0];
      expect(operation.progress).toBe(0.5);
    });
  });

  describe('completion states', () => {
    it('should complete operation successfully', () => {
      loadingManager.startLoading('test-op', 'Test Operation');
      loadingManager.completeSuccess('test-op', 'Success message');
      
      const operation = loadingManager.getActiveOperations()[0];
      expect(operation.state).toBe(LoadingState.Success);
      expect(operation.message).toBe('Success message');
    });

    it('should complete operation with error', () => {
      loadingManager.startLoading('test-op', 'Test Operation');
      loadingManager.completeError('test-op', 'Error message');
      
      const operation = loadingManager.getActiveOperations()[0];
      expect(operation.state).toBe(LoadingState.Error);
      expect(operation.message).toBe('Error message');
    });

    it('should complete operation with Error object', () => {
      loadingManager.startLoading('test-op', 'Test Operation');
      const error = new Error('Test error');
      loadingManager.completeError('test-op', error);
      
      const operation = loadingManager.getActiveOperations()[0];
      expect(operation.state).toBe(LoadingState.Error);
      expect(operation.message).toBe('Test error');
    });
  });

  describe('retry functionality', () => {
    it('should support retryable operations', () => {
      const onRetry = () => {};
      loadingManager.startLoading('test-op', 'Test Operation', true, onRetry);
      
      const operation = loadingManager.getActiveOperations()[0];
      expect(operation.retryable).toBe(true);
      expect(operation.onRetry).toBe(onRetry);
    });

    it('should retry operation', () => {
      let retryCalled = false;
      const onRetry = () => { retryCalled = true; };
      
      loadingManager.startLoading('test-op', 'Test Operation', true, onRetry);
      loadingManager.completeError('test-op', 'Error', true);
      loadingManager.retry('test-op');
      
      expect(retryCalled).toBe(true);
      
      const operation = loadingManager.getActiveOperations()[0];
      expect(operation.state).toBe(LoadingState.Loading);
    });

    it('should not retry non-retryable operations', () => {
      let retryCalled = false;
      const onRetry = () => { retryCalled = true; };
      
      loadingManager.startLoading('test-op', 'Test Operation', false, onRetry);
      loadingManager.completeError('test-op', 'Error', false);
      loadingManager.retry('test-op');
      
      expect(retryCalled).toBe(false);
    });
  });

  describe('state management', () => {
    it('should return idle when no operations', () => {
      expect(loadingManager.getState()).toBe(LoadingState.Idle);
    });

    it('should return loading when operations are loading', () => {
      loadingManager.startLoading('test-op', 'Test Operation');
      expect(loadingManager.getState()).toBe(LoadingState.Loading);
    });

    it('should return error when operations have errors', () => {
      loadingManager.startLoading('test-op', 'Test Operation');
      loadingManager.completeError('test-op', 'Error');
      expect(loadingManager.getState()).toBe(LoadingState.Error);
    });

    it('should return success when operations complete successfully', () => {
      loadingManager.startLoading('test-op', 'Test Operation');
      loadingManager.completeSuccess('test-op');
      expect(loadingManager.getState()).toBe(LoadingState.Success);
    });

    it('should prioritize error state', () => {
      loadingManager.startLoading('op1', 'Operation 1');
      loadingManager.startLoading('op2', 'Operation 2');
      loadingManager.completeSuccess('op1');
      loadingManager.completeError('op2', 'Error');
      
      expect(loadingManager.getState()).toBe(LoadingState.Error);
    });
  });

  describe('operation removal', () => {
    it('should remove operation', () => {
      loadingManager.startLoading('test-op', 'Test Operation');
      expect(loadingManager.getActiveOperations()).toHaveLength(1);
      
      loadingManager.removeOperation('test-op');
      expect(loadingManager.getActiveOperations()).toHaveLength(0);
    });

    it('should stop spinner when no operations', () => {
      const stopSpy = jest.spyOn(loadingManager as any, 'stopSpinner');
      
      loadingManager.startLoading('test-op', 'Test Operation');
      loadingManager.removeOperation('test-op');
      
      expect(stopSpy).toHaveBeenCalled();
    });
  });

  describe('key handling', () => {
    it('should handle retry key press', () => {
      let retryCalled = false;
      const onRetry = () => { retryCalled = true; };
      
      loadingManager.startLoading('test-op', 'Test Operation', true, onRetry);
      loadingManager.completeError('test-op', 'Error', true);
      
      const handled = loadingManager.handleKeyPress('r');
      expect(handled).toBe(true);
      expect(retryCalled).toBe(true);
    });

    it('should not handle non-retry key press', () => {
      const handled = loadingManager.handleKeyPress('x');
      expect(handled).toBe(false);
    });

    it('should not handle retry when no retryable operations', () => {
      loadingManager.startLoading('test-op', 'Test Operation', false);
      loadingManager.completeError('test-op', 'Error', false);
      
      const handled = loadingManager.handleKeyPress('r');
      expect(handled).toBe(false);
    });
  });

  describe('spinner animation', () => {
    it('should cycle through spinner frames', () => {
      loadingManager.startLoading('test-op', 'Test Operation');
      
      const frames = [];
      for (let i = 0; i < 12; i++) {
        frames.push(loadingManager['getSpinner']());
        loadingManager['currentFrame'] = (loadingManager['currentFrame'] + 1) % loadingManager['spinnerFrames'].length;
      }
      
      // Should cycle through all frames
      expect(frames).toContain('⠋');
      expect(frames).toContain('⠙');
      expect(frames).toContain('⠹');
    });
  });

  describe('operation formatting', () => {
    it('should format loading operation', () => {
      loadingManager.startLoading('test-op', 'Test Operation');
      const operation = loadingManager.getActiveOperations()[0];
      
      const formatted = loadingManager['formatOperation'](operation);
      expect(formatted).toMatch(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏] Test Operation/);
    });

    it('should format operation with progress', () => {
      loadingManager.startLoading('test-op', 'Test Operation');
      loadingManager.updateProgress('test-op', 0.5);
      
      const operation = loadingManager.getActiveOperations()[0];
      const formatted = loadingManager['formatOperation'](operation);
      expect(formatted).toContain('50%');
    });

    it('should format error operation with retry', () => {
      loadingManager.startLoading('test-op', 'Test Operation', true);
      loadingManager.completeError('test-op', 'Error', true);
      
      const operation = loadingManager.getActiveOperations()[0];
      const formatted = loadingManager['formatOperation'](operation);
      expect(formatted).toContain('⚠');
      expect(formatted).toContain('[R to retry]');
    });

    it('should format error operation without retry', () => {
      loadingManager.startLoading('test-op', 'Test Operation');
      loadingManager.completeError('test-op', 'Error', false);
      
      const operation = loadingManager.getActiveOperations()[0];
      const formatted = loadingManager['formatOperation'](operation);
      expect(formatted).toContain('❌');
      expect(formatted).not.toContain('[R to retry]');
    });
  });
});