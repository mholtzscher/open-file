/**
 * useOperationExecutor Hook
 *
 * Unified hook for executing operations with integrated progress tracking.
 * Handles batch operations with progress, cancellation, and error handling.
 *
 * Features:
 * - execute(operations) method with automatic progress tracking
 * - cancel() method with AbortController
 * - isRunning state for UI feedback
 * - Integrated progress state management
 * - Per-operation error handling with status messages
 */

import { useCallback, useRef, useState } from 'react';
import { useStorage } from '../contexts/StorageContextProvider.js';
import { useProgressState } from './useProgressState.js';
import type { PendingOperation } from '../types/dialog.js';
import type { StorageContextValue } from '../contexts/StorageContext.js';

// ============================================================================
// Types
// ============================================================================

/** Progress event from storage operations */
interface ProgressEvent {
  operation: string;
  bytesTransferred: number;
  totalBytes?: number;
  percentage: number;
  currentFile?: string;
}

/** Result of operation execution */
export interface OperationResult {
  /** Number of successful operations */
  successCount: number;
  /** Number of failed operations */
  failureCount: number;
  /** Whether execution was cancelled */
  cancelled: boolean;
  /** Error message if any */
  error?: string;
}

/** Progress callback data */
interface OperationProgress {
  currentIndex: number;
  totalCount: number;
  overallProgress: number;
  operationType: string;
  currentFile?: string;
  description: string;
}

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
  /** Whether operations are currently being executed */
  isRunning: boolean;

  /** Execute a batch of pending operations */
  execute: (
    operations: PendingOperation[],
    callbacks?: ExecutorCallbacks
  ) => Promise<OperationResult>;

  /** Cancel the current operation */
  cancel: () => void;

  /** Progress state for UI display */
  progress: {
    visible: boolean;
    title: string;
    description: string;
    value: number;
    currentFile: string;
    currentNum: number;
    totalNum: number;
    cancellable: boolean;
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
// Operation Execution Logic
// ============================================================================

/**
 * Execute a single operation using the storage provider
 */
async function executeOperation(
  op: PendingOperation,
  storage: StorageContextValue,
  onProgress: (event: ProgressEvent) => void
): Promise<void> {
  switch (op.type) {
    case 'create':
      if (op.path) {
        if (op.entryType === 'directory') {
          await storage.mkdir(op.path);
        } else {
          // Create empty file
          await storage.write(op.path, '', { onProgress });
        }
      }
      break;

    case 'delete':
      if (op.path) {
        await storage.delete(op.path, { recursive: op.recursive, onProgress });
      }
      break;

    case 'move':
      if (op.source && op.destination) {
        await storage.move(op.source, op.destination, { onProgress });
      }
      break;

    case 'copy':
      if (op.source && op.destination) {
        await storage.copy(op.source, op.destination, { onProgress });
      }
      break;

    case 'upload':
      if (op.source && op.destination) {
        await storage.upload(op.source, op.destination, { onProgress });
      }
      break;

    case 'download':
      if (op.source && op.destination) {
        await storage.download(op.source, op.destination, { onProgress });
      }
      break;

    default:
      throw new Error(`Unknown operation type: ${(op as PendingOperation).type}`);
  }
}

/**
 * Execute a batch of operations with progress tracking
 */
async function executeOperationBatch(
  operations: PendingOperation[],
  storage: StorageContextValue,
  options: {
    onProgress?: (progress: OperationProgress) => void;
    onOperationError?: (operation: PendingOperation, error: Error) => void;
    signal?: AbortSignal;
  }
): Promise<OperationResult> {
  const { onProgress, onOperationError, signal } = options;

  let successCount = 0;
  let failureCount = 0;
  let cancelled = false;

  for (let opIndex = 0; opIndex < operations.length; opIndex++) {
    const op = operations[opIndex];

    // Check for cancellation
    if (signal?.aborted) {
      cancelled = true;
      break;
    }

    try {
      // Calculate progress
      const baseProgress = (opIndex / operations.length) * 100;
      const totalProgress = Math.round(baseProgress);

      // Create progress callback for this operation
      const operationProgressCallback = (event: ProgressEvent) => {
        const opProgress = event.percentage / operations.length;
        const combinedProgress = Math.round(baseProgress + opProgress);

        onProgress?.({
          currentIndex: opIndex,
          totalCount: operations.length,
          overallProgress: combinedProgress,
          operationType: op.type,
          currentFile: event.currentFile || op.path || op.source || '',
          description: event.operation || `${op.type}: ${op.path || op.source || 'processing'}`,
        });
      };

      // Report start of operation
      onProgress?.({
        currentIndex: opIndex,
        totalCount: operations.length,
        overallProgress: totalProgress,
        operationType: op.type,
        currentFile: op.path || op.source || '',
        description: `${op.type}: ${op.path || op.source || 'processing'}`,
      });

      // Execute operation
      await executeOperation(op, storage, operationProgressCallback);

      successCount++;
    } catch (error) {
      failureCount++;
      onOperationError?.(op, error as Error);
      // Continue with remaining operations
    }
  }

  // Report completion
  if (!cancelled) {
    onProgress?.({
      currentIndex: operations.length,
      totalCount: operations.length,
      overallProgress: 100,
      operationType: 'complete',
      description: `Completed: ${successCount} succeeded, ${failureCount} failed`,
    });
  }

  return {
    successCount,
    failureCount,
    cancelled,
    error: failureCount > 0 ? `${failureCount} operation(s) failed` : undefined,
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
 * {progress.visible && <ProgressDialog {...progress} />}
 * ```
 */
export function useOperationExecutor(): UseOperationExecutorReturn {
  const storage = useStorage();
  const {
    progress,
    showProgress,
    hideProgress,
    updateProgress,
    updateDescription: updateProgressDescription,
    dispatch: dispatchProgress,
  } = useProgressState();

  const [isRunning, setIsRunning] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const execute = useCallback(
    async (
      operations: PendingOperation[],
      callbacks?: ExecutorCallbacks
    ): Promise<OperationResult> => {
      if (operations.length === 0) {
        return { successCount: 0, failureCount: 0, cancelled: false };
      }

      setIsRunning(true);

      // Create abort controller for cancellation
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // Show progress dialog
      showProgress({
        title: `Executing ${operations[0]?.type || 'operation'}...`,
        totalNum: operations.length,
        cancellable: true,
      });

      try {
        // Execute operations with progress tracking
        const result = await executeOperationBatch(operations, storage, {
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
          signal: abortController.signal,
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
        abortControllerRef.current = null;
      }
    },
    [
      storage,
      showProgress,
      hideProgress,
      updateProgress,
      updateProgressDescription,
      dispatchProgress,
    ]
  );

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      dispatchProgress({ type: 'UPDATE', payload: { cancellable: false } });
    }
  }, [dispatchProgress]);

  return {
    isRunning,
    execute,
    cancel,
    progress: {
      visible: progress.visible,
      title: progress.title,
      description: progress.description,
      value: progress.value,
      currentFile: progress.currentFile,
      currentNum: progress.currentNum,
      totalNum: progress.totalNum,
      cancellable: progress.cancellable,
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
