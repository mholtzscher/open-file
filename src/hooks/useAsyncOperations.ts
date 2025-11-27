/**
 * useAsyncOperations hook
 *
 * Provides operation execution logic that works with both legacy adapters and new providers.
 * Handles batch operations with progress tracking, cancellation, and error handling.
 *
 * This hook centralizes the operation execution logic that was previously embedded in S3Explorer,
 * making it reusable and testable.
 */

import { useCallback, useRef } from 'react';
import { useAdapter } from '../contexts/AdapterContext.js';
import { useStorage, useHasStorage } from '../contexts/StorageContextProvider.js';
import { PendingOperation } from '../types/dialog.js';
import { ProgressEvent } from '../adapters/adapter.js';
import { EntryType } from '../types/entry.js';
import { isFeatureEnabled, FeatureFlag } from '../utils/feature-flags.js';

/**
 * Progress callback for operation execution
 */
export interface OperationProgress {
  /** Current operation index (0-based) */
  currentIndex: number;

  /** Total number of operations */
  totalCount: number;

  /** Overall progress percentage (0-100) */
  overallProgress: number;

  /** Current operation type */
  operationType: string;

  /** Current file being processed */
  currentFile?: string;

  /** Progress description */
  description: string;
}

/**
 * Result of operation execution
 */
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

/**
 * Options for executing operations
 */
export interface ExecuteOperationsOptions {
  /** Progress callback */
  onProgress?: (progress: OperationProgress) => void;

  /** Error callback for individual operation failures */
  onOperationError?: (operation: PendingOperation, error: Error) => void;

  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

/**
 * Hook for executing async operations with progress tracking
 */
export function useAsyncOperations() {
  const adapter = useAdapter();
  const hasStorage = useHasStorage();
  const storage = hasStorage ? useStorage() : null;
  const useNewProviderSystem = isFeatureEnabled(FeatureFlag.USE_NEW_PROVIDER_SYSTEM);

  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Execute a batch of pending operations
   */
  const executeOperations = useCallback(
    async (
      operations: PendingOperation[],
      options: ExecuteOperationsOptions = {}
    ): Promise<OperationResult> => {
      const { onProgress, onOperationError, signal } = options;

      // Create abort controller if not provided
      const abortController = signal ? null : new AbortController();
      if (abortController) {
        abortControllerRef.current = abortController;
      }
      const effectiveSignal = signal || abortController?.signal;

      let successCount = 0;
      let failureCount = 0;
      let cancelled = false;

      for (let opIndex = 0; opIndex < operations.length; opIndex++) {
        const op = operations[opIndex];

        // Check for cancellation
        if (effectiveSignal?.aborted) {
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

          // Execute operation based on type
          if (useNewProviderSystem && storage) {
            // Use new provider system
            await executeOperationWithStorage(op, storage, operationProgressCallback);
          } else {
            // Use legacy adapter
            await executeOperationWithAdapter(op, adapter, operationProgressCallback);
          }

          successCount++;
        } catch (error) {
          failureCount++;
          onOperationError?.(op, error as Error);

          // For critical operations, might want to stop on first error
          // For now, we continue with remaining operations
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
    },
    [adapter, storage, useNewProviderSystem]
  );

  /**
   * Cancel ongoing operations
   */
  const cancelOperations = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  return {
    executeOperations,
    cancelOperations,
  };
}

/**
 * Execute a single operation using the new storage provider system
 */
async function executeOperationWithStorage(
  op: PendingOperation,
  storage: ReturnType<typeof useStorage>,
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
      throw new Error(`Unknown operation type: ${(op as any).type}`);
  }
}

/**
 * Execute a single operation using the legacy adapter system
 */
async function executeOperationWithAdapter(
  op: PendingOperation,
  adapter: ReturnType<typeof useAdapter>,
  onProgress: (event: ProgressEvent) => void
): Promise<void> {
  switch (op.type) {
    case 'create':
      if (op.path) {
        const createType = op.entryType === 'directory' ? EntryType.Directory : EntryType.File;
        await adapter.create(op.path, createType, undefined, { onProgress });
      }
      break;

    case 'delete':
      if (op.path) {
        await adapter.delete(op.path, op.recursive, { onProgress });
      }
      break;

    case 'move':
      if (op.source && op.destination) {
        await adapter.move(op.source, op.destination, { onProgress });
      }
      break;

    case 'copy':
      if (op.source && op.destination) {
        await adapter.copy(op.source, op.destination, { onProgress });
      }
      break;

    case 'upload':
      if (op.source && op.destination) {
        // Legacy adapter uses uploadFromLocal
        if (adapter.uploadFromLocal) {
          await adapter.uploadFromLocal(op.source, op.destination, op.recursive, { onProgress });
        } else {
          throw new Error('Upload operation not supported by adapter');
        }
      }
      break;

    case 'download':
      if (op.source && op.destination) {
        // Legacy adapter uses downloadToLocal
        if (adapter.downloadToLocal) {
          await adapter.downloadToLocal(op.source, op.destination, op.recursive, { onProgress });
        } else {
          throw new Error('Download operation not supported by adapter');
        }
      }
      break;

    default:
      throw new Error(`Unknown operation type: ${(op as any).type}`);
  }
}
