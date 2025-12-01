/**
 * useImmediateExecution - Helpers for immediate operation execution with progress threshold
 *
 * This hook provides utilities for executing operations immediately (not deferred)
 * with intelligent progress dialog display based on operation count and file sizes.
 *
 * Progress dialog is shown when:
 * - 5 or more files are being operated on, OR
 * - Any file is larger than 10MB
 */

import { useCallback } from 'react';
import { useStorage } from '../contexts/StorageContextProvider.js';
import { useOperationExecutor, ExecutorCallbacks } from './useOperationExecutor.js';
import type { PendingOperation } from '../types/dialog.js';
import type { Entry } from '../types/entry.js';

// ============================================================================
// Constants
// ============================================================================

/** Minimum number of files to trigger progress dialog */
const PROGRESS_FILE_COUNT_THRESHOLD = 5;

/** File size threshold (10MB) to trigger progress dialog */
const PROGRESS_SIZE_THRESHOLD_BYTES = 10 * 1024 * 1024;

// ============================================================================
// Types
// ============================================================================

export interface ImmediateExecutionCallbacks {
  /** Called on successful completion */
  onSuccess?: (message: string) => void;
  /** Called on error */
  onError?: (message: string) => void;
  /** Called when cancelled */
  onCancelled?: (message: string) => void;
  /** Called when complete (success or failure) */
  onComplete?: () => void;
}

export interface UseImmediateExecutionReturn {
  /** Whether an operation is currently running */
  isRunning: boolean;

  /** Execute delete operations with confirmation already done */
  executeDeletes: (entries: Entry[], callbacks?: ImmediateExecutionCallbacks) => Promise<void>;

  /** Execute a rename operation */
  executeRename: (
    oldPath: string,
    newPath: string,
    callbacks?: ImmediateExecutionCallbacks
  ) => Promise<void>;

  /** Execute a create operation (file or directory) */
  executeCreate: (
    path: string,
    isDirectory: boolean,
    callbacks?: ImmediateExecutionCallbacks
  ) => Promise<void>;

  /** Execute copy operations (paste from clipboard) */
  executeCopies: (
    entries: Entry[],
    sourcePaths: string[],
    destinationPath: string,
    callbacks?: ImmediateExecutionCallbacks
  ) => Promise<void>;

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
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if operations should show progress dialog based on thresholds
 */
function shouldShowProgress(entries: Entry[]): boolean {
  // Check file count threshold
  if (entries.length >= PROGRESS_FILE_COUNT_THRESHOLD) {
    return true;
  }

  // Check file size threshold
  for (const entry of entries) {
    if (entry.size && entry.size > PROGRESS_SIZE_THRESHOLD_BYTES) {
      return true;
    }
  }

  return false;
}

/**
 * Generate a unique operation ID
 */
function generateOpId(): string {
  return `op-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for immediate operation execution with progress threshold
 *
 * @example
 * ```tsx
 * const { executeDeletes, executeRename, isRunning, progress } = useImmediateExecution();
 *
 * // Delete entries (after user confirmation)
 * await executeDeletes(selectedEntries, {
 *   onSuccess: (msg) => setStatus(msg),
 *   onError: (msg) => setError(msg),
 *   onComplete: () => refreshListing(),
 * });
 *
 * // Rename immediately
 * await executeRename(oldPath, newPath, {
 *   onSuccess: () => refreshListing(),
 *   onError: (msg) => setError(msg),
 * });
 * ```
 */
export function useImmediateExecution(): UseImmediateExecutionReturn {
  const storage = useStorage();
  const executor = useOperationExecutor();

  /**
   * Execute delete operations
   */
  const executeDeletes = useCallback(
    async (entries: Entry[], callbacks?: ImmediateExecutionCallbacks) => {
      if (entries.length === 0) {
        callbacks?.onSuccess?.('Nothing to delete');
        callbacks?.onComplete?.();
        return;
      }

      // Build pending operations
      const operations: PendingOperation[] = entries.map(entry => ({
        id: generateOpId(),
        type: 'delete' as const,
        path: entry.path,
        entry,
        recursive: entry.type === 'directory',
      }));

      // Check if we need progress dialog
      const showProgress = shouldShowProgress(entries);

      if (showProgress) {
        // Use executor with progress tracking
        const executorCallbacks: ExecutorCallbacks = {
          onSuccess: (_, msg) => callbacks?.onSuccess?.(msg),
          onError: msg => callbacks?.onError?.(msg),
          onCancelled: msg => callbacks?.onCancelled?.(msg),
          onComplete: () => callbacks?.onComplete?.(),
        };

        await executor.execute(operations, executorCallbacks);
      } else {
        // Execute directly without progress dialog
        try {
          for (const entry of entries) {
            await storage.delete(entry.path, { recursive: entry.type === 'directory' });
          }
          callbacks?.onSuccess?.(`Deleted ${entries.length} item(s)`);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Delete failed';
          callbacks?.onError?.(message);
        } finally {
          callbacks?.onComplete?.();
        }
      }
    },
    [storage, executor]
  );

  /**
   * Execute a rename operation (immediate, no progress)
   */
  const executeRename = useCallback(
    async (oldPath: string, newPath: string, callbacks?: ImmediateExecutionCallbacks) => {
      try {
        await storage.move(oldPath, newPath);
        callbacks?.onSuccess?.('Renamed successfully');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Rename failed';
        callbacks?.onError?.(message);
      } finally {
        callbacks?.onComplete?.();
      }
    },
    [storage]
  );

  /**
   * Execute a create operation (immediate, no progress)
   */
  const executeCreate = useCallback(
    async (path: string, isDirectory: boolean, callbacks?: ImmediateExecutionCallbacks) => {
      try {
        if (isDirectory) {
          await storage.mkdir(path);
          callbacks?.onSuccess?.('Directory created');
        } else {
          await storage.write(path, '');
          callbacks?.onSuccess?.('File created');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Create failed';
        callbacks?.onError?.(message);
      } finally {
        callbacks?.onComplete?.();
      }
    },
    [storage]
  );

  /**
   * Execute copy operations (paste from clipboard)
   */
  const executeCopies = useCallback(
    async (
      entries: Entry[],
      sourcePaths: string[],
      destinationPath: string,
      callbacks?: ImmediateExecutionCallbacks
    ) => {
      if (entries.length === 0) {
        callbacks?.onSuccess?.('Nothing to paste');
        callbacks?.onComplete?.();
        return;
      }

      // Build pending operations
      const operations: PendingOperation[] = entries.map((entry, index) => ({
        id: generateOpId(),
        type: 'copy' as const,
        source: sourcePaths[index],
        destination: `${destinationPath}${entry.name}`,
        entry,
        recursive: entry.type === 'directory',
      }));

      // Check if we need progress dialog
      const showProgress = shouldShowProgress(entries);

      if (showProgress) {
        // Use executor with progress tracking
        const executorCallbacks: ExecutorCallbacks = {
          onSuccess: (_, msg) => callbacks?.onSuccess?.(msg),
          onError: msg => callbacks?.onError?.(msg),
          onCancelled: msg => callbacks?.onCancelled?.(msg),
          onComplete: () => callbacks?.onComplete?.(),
        };

        await executor.execute(operations, executorCallbacks);
      } else {
        // Execute directly without progress dialog
        try {
          for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            const source = sourcePaths[i];
            const destination = `${destinationPath}${entry.name}`;
            await storage.copy(source, destination);
          }
          callbacks?.onSuccess?.(`Copied ${entries.length} item(s)`);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Copy failed';
          callbacks?.onError?.(message);
        } finally {
          callbacks?.onComplete?.();
        }
      }
    },
    [storage, executor]
  );

  return {
    isRunning: executor.isRunning,
    executeDeletes,
    executeRename,
    executeCreate,
    executeCopies,
    cancel: executor.cancel,
    progress: executor.progress,
  };
}
