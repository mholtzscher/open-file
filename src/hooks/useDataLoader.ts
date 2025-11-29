/**
 * useDataLoader Hook
 *
 * Extracts initial data loading logic from S3Explorer.
 * Handles bucket listing vs bucket contents loading with proper
 * status messaging and error handling.
 *
 * Features:
 * - isInitialized state tracking
 * - reload() method for manual refresh
 * - Bucket listing vs bucket contents logic
 * - Integration with useStatusMessage
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useStorage } from '../contexts/StorageContextProvider.js';
import { Capability } from '../providers/types/capabilities.js';
import { parseAwsError, formatErrorForDisplay } from '../utils/errors.js';
import type { Entry } from '../types/entry.js';

// ============================================================================
// Types
// ============================================================================

export interface DataLoaderOptions {
  /** Current bucket name (undefined for root/bucket listing view) */
  bucket: string | undefined;

  /** Current path within the bucket */
  currentPath: string;

  /** Callback to set entries in the buffer */
  setEntries: (entries: Entry[]) => void;

  /** Callback to set current path in the buffer */
  setCurrentPath: (path: string) => void;

  /** Callback for success messages */
  onSuccess?: (message: string) => void;

  /** Callback for error messages */
  onError?: (message: string) => void;
}

export interface UseDataLoaderReturn {
  /** Whether data has been loaded at least once */
  isInitialized: boolean;

  /** Whether data is currently being loaded */
  isLoading: boolean;

  /** Manually reload the current data */
  reload: () => Promise<void>;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for managing initial data loading in the explorer
 *
 * Handles the logic of loading either bucket listings (at root) or
 * bucket contents (when a bucket is selected).
 *
 * @example
 * ```tsx
 * const { isInitialized, isLoading, reload } = useDataLoader({
 *   bucket,
 *   currentPath: bufferState.currentPath,
 *   setEntries: bufferState.setEntries,
 *   setCurrentPath: bufferState.setCurrentPath,
 *   onSuccess: (msg) => showSuccess(msg),
 *   onError: (msg) => showError(msg),
 * });
 * ```
 */
export function useDataLoader(options: DataLoaderOptions): UseDataLoaderReturn {
  const { bucket, currentPath, setEntries, setCurrentPath, onSuccess, onError } = options;

  const storage = useStorage();
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Track the current bucket to detect changes
  const prevBucketRef = useRef<string | undefined>(bucket);

  const loadData = useCallback(async () => {
    setIsLoading(true);

    try {
      console.error(`[useDataLoader] Loading data...`);

      if (!bucket) {
        // Root view - load bucket/container listing or root directory
        console.error(`[useDataLoader] Root view mode, loading containers...`);

        if (storage.hasCapability(Capability.Containers)) {
          // Container-based providers (S3, GCS) - list containers first
          const entries = await storage.listContainers();
          console.error(`[useDataLoader] Received ${entries.length} containers`);

          setEntries([...entries]);
          setCurrentPath('');

          onSuccess?.(`Found ${entries.length} bucket(s)`);
        } else {
          // Non-container providers (Local, SFTP, FTP) - list root directory directly
          console.error(`[useDataLoader] No containers, listing root directory`);
          const entries = await storage.list('');
          console.error(`[useDataLoader] Received ${entries.length} entries from root`);

          setEntries([...entries]);
          setCurrentPath('');

          onSuccess?.(`Loaded ${entries.length} items`);
        }
      } else {
        // Bucket selected - load bucket contents
        console.error(`[useDataLoader] Loading bucket: ${bucket}, path: "${currentPath}"`);

        const entries = await storage.list(currentPath);
        console.error(`[useDataLoader] Received ${entries.length} entries`);

        setEntries([...entries]);
        console.error(`[useDataLoader] Entries loaded into buffer state`);

        onSuccess?.(`Loaded ${entries.length} items`);
      }

      console.error(`[useDataLoader] Data loaded successfully`);
      setIsInitialized(true);
    } catch (err) {
      console.error('[useDataLoader] Error loading data:', err);

      const parsedError = parseAwsError(
        err,
        bucket ? 'Failed to load bucket' : 'Failed to list buckets'
      );
      const errorDisplay = formatErrorForDisplay(parsedError, 70);

      console.error('[useDataLoader] Setting error message:', errorDisplay);
      onError?.(errorDisplay);

      // Still mark as initialized even on error to show UI
      setIsInitialized(true);
    } finally {
      setIsLoading(false);
    }
  }, [bucket, currentPath, storage, setEntries, setCurrentPath, onSuccess, onError]);

  // Load data when bucket changes or on initial mount
  useEffect(() => {
    console.error(`[useDataLoader] useEffect triggered, bucket: ${bucket}`);

    // Always reload when bucket changes
    if (prevBucketRef.current !== bucket) {
      console.error(
        `[useDataLoader] Bucket changed from ${prevBucketRef.current} to ${bucket}, reloading...`
      );
      prevBucketRef.current = bucket;
    }

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bucket, storage]);

  // Provide reload function that can be called manually
  const reload = useCallback(async () => {
    console.error('[useDataLoader] Manual reload triggered');
    await loadData();
  }, [loadData]);

  return {
    isInitialized,
    isLoading,
    reload,
  };
}
