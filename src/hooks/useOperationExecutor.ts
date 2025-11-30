/**
 * useOperationExecutor Hook
 *
 * High-level hook for executing operations with integrated progress tracking.
 * Combines useAsyncOperations with useProgressState and provides a unified
 * interface for operation execution, progress updates, and result handling.
 *
 * Features:
 * - execute(operations) method with automatic progress tracking
 * - cancel() method with AbortController
 * - isRunning state for UI feedback
 * - Integrated progress state management
 * - Per-operation error handling with status messages
 */

import { createSignal, onCleanup } from 'solid-js';
import { useAsyncOperations, OperationResult } from './useAsyncOperations.js';
import { useProgressState } from './useProgressState.js';
import type { PendingOperation } from '../types/dialog.js';

// ============================================================================
// Types
// ============================================================================

export interface ExecutorCallbacks {
  /** Called when an operation succeeds */
  onSuccess?: (result: OperationResult, message: string) => void;

  /** Called when an operation fails */
  onError?: (message: string) => void;

  /** Called when operations are cancelled */
  onCancelled?: (message: string) => void;

  /** Called when operations complete (success or failure) */
  onComplete?: () => void;
}

export interface UseOperationExecutorReturn {
  /** Whether operations are currently being executed (call as function) */
  isRunning: () => boolean;

  /** Execute a batch of pending operations */
  execute: (
    operations: PendingOperation[],
    callbacks?: ExecutorCallbacks
  ) => Promise<OperationResult>;

  /** Cancel the current operation */
  cancel: () => void;

  /** Progress state for UI display (object with accessor functions) */
  progress: {
    visible: () => boolean;
    title: () => string;
    description: () => string;
    value: () => number;
    currentFile: () => string;
    currentNum: () => number;
    totalNum: () => number;
    cancellable: () => boolean;
  };

  /** Direct access to progress actions for advanced use */
  progressActions: {
    showProgress: ReturnType<typeof useProgressState>['showProgress'];
    hideProgress: ReturnType<typeof useProgressState>['hideProgress'];
    updateProgress: ReturnType<typeof useProgressState>['updateProgress'];
    updateDescription: ReturnType<typeof useProgressState>['updateDescription'];
    dispatch: ReturnType<typeof useProgressState>['dispatch'];
  };
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for executing operations with integrated progress tracking
 *
 * @example
 * ```tsx
 * const { isRunning, execute, cancel, progress } = useOperationExecutor();
 *
 * // Execute operations
 * const result = await execute(pendingOperations, {
 *   onSuccess: (result, message) => showSuccess(message),
 *   onError: (message) => showError(message),
 *   onCancelled: (message) => showWarning(message),
 * });
 *
 * // Cancel if needed
 * cancel();
 *
 * // Use progress state for UI
 * {progress.visible() && <ProgressDialog {...progress} />}
 * ```
 */
export function useOperationExecutor(): UseOperationExecutorReturn {
  const { executeOperations, cancelOperations } = useAsyncOperations();
  const {
    progress,
    showProgress,
    hideProgress,
    updateProgress,
    updateDescription: updateProgressDescription,
    dispatch: dispatchProgress,
  } = useProgressState();

  const [isRunning, setIsRunning] = createSignal(false);

  // In Solid, regular variables persist across renders
  let abortController: AbortController | null = null;

  const execute = async (
    operations: PendingOperation[],
    callbacks?: ExecutorCallbacks
  ): Promise<OperationResult> => {
    if (operations.length === 0) {
      return { successCount: 0, failureCount: 0, cancelled: false };
    }

    setIsRunning(true);

    // Create abort controller for cancellation
    abortController = new AbortController();

    // Show progress dialog
    showProgress({
      title: `Executing ${operations[0]?.type || 'operation'}...`,
      totalNum: operations.length,
      cancellable: true,
    });

    try {
      // Execute operations with progress tracking
      const result = await executeOperations(operations, {
        onProgress: progressEvent => {
          updateProgress(progressEvent.overallProgress);
          updateProgressDescription(progressEvent.description);
          dispatchProgress({
            type: 'UPDATE',
            payload: {
              value: progressEvent.overallProgress,
              description: progressEvent.description,
              currentFile: progressEvent.currentFile || '',
              currentNum: progressEvent.currentIndex + 1,
            },
          });
        },
        onOperationError: (op, error) => {
          console.error(`Failed to execute ${op.type} operation:`, error);
        },
        signal: abortController!.signal,
      });

      hideProgress();

      // Handle result
      if (result.cancelled) {
        const message = 'Operation cancelled by user';
        callbacks?.onCancelled?.(message);
      } else if (result.successCount > 0 && result.failureCount === 0) {
        const message = `${result.successCount} operation(s) completed successfully`;
        callbacks?.onSuccess?.(result, message);
      } else if (result.failureCount > 0) {
        const message = `${result.failureCount} operation(s) failed`;
        callbacks?.onError?.(message);
      } else if (result.successCount > 0) {
        // Some succeeded, some failed
        const message = `${result.successCount} succeeded, ${result.failureCount} failed`;
        callbacks?.onSuccess?.(result, message);
      }

      callbacks?.onComplete?.();
      return result;
    } catch (error) {
      console.error('Unexpected error in operation execution:', error);
      hideProgress();

      const message = 'Unexpected error during operation execution';
      callbacks?.onError?.(message);
      callbacks?.onComplete?.();

      return {
        successCount: 0,
        failureCount: operations.length,
        cancelled: false,
        error: message,
      };
    } finally {
      setIsRunning(false);
      abortController = null;
    }
  };

  const cancel = () => {
    if (abortController) {
      abortController.abort();
      dispatchProgress({ type: 'UPDATE', payload: { cancellable: false } });
    }
    cancelOperations();
  };

  // Cleanup on unmount
  onCleanup(() => {
    if (abortController) {
      abortController.abort();
    }
  });

  return {
    isRunning,
    execute,
    cancel,
    progress: {
      visible: () => progress().visible,
      title: () => progress().title,
      description: () => progress().description,
      value: () => progress().value,
      currentFile: () => progress().currentFile,
      currentNum: () => progress().currentNum,
      totalNum: () => progress().totalNum,
      cancellable: () => progress().cancellable,
    },
    progressActions: {
      showProgress,
      hideProgress,
      updateProgress,
      updateDescription: updateProgressDescription,
      dispatch: dispatchProgress,
    },
  };
}
