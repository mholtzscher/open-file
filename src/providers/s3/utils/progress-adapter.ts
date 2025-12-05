/**
 * Progress Adapter Factory
 *
 * Provides factory functions to create progress callback adapters that
 * convert internal operation progress to standardized ProgressEvent format.
 * This eliminates duplicated progress adapter patterns across S3Adapter methods.
 */

import type { ProgressCallback } from '../../../types/progress.js';

/**
 * Callback type for internal S3 operations (count-based progress)
 * Used by batch operations like move/copy/delete directory
 */
export type OperationProgressCallback = (count: number, total: number, currentItem: string) => void;

/**
 * Calculate progress percentage safely
 * @param transferred - Amount transferred (count or bytes)
 * @param total - Total amount
 * @returns Percentage 0-100, or 0 if total is 0
 */
function calculatePercentage(transferred: number, total: number): number {
  return total > 0 ? Math.round((transferred / total) * 100) : 0;
}

/**
 * Report progress for simple operations
 *
 * Helper for simple progress reporting that avoids duplicated inline patterns.
 *
 * @param onProgress - External progress callback (optional)
 * @param operation - Operation name for the progress event (e.g., 'Downloading file')
 * @param bytesTransferred - Number of bytes transferred so far
 * @param totalBytes - Total number of bytes to transfer
 * @param currentFile - Current file being operated on
 *
 * @example
 * ```typescript
 * // Before (inline pattern):
 * if (options?.onProgress) {
 *   options.onProgress({
 *     operation: 'Uploading file',
 *     bytesTransferred: 0,
 *     totalBytes,
 *     percentage: 0,
 *     currentFile: s3Key,
 *   });
 * }
 *
 * // After:
 * reportProgress(options?.onProgress, 'Uploading file', 0, totalBytes, s3Key);
 * ```
 */
export function reportProgress(
  onProgress: ProgressCallback | undefined,
  operation: string,
  bytesTransferred: number,
  totalBytes: number,
  currentFile: string
): void {
  onProgress?.({
    operation,
    bytesTransferred,
    totalBytes,
    percentage: calculatePercentage(bytesTransferred, totalBytes),
    currentFile,
  });
}

/**
 * Create a progress adapter that converts internal operation progress to ProgressEvent
 *
 * @param operation - Operation name for the progress event (e.g., 'Moving objects')
 * @param onProgress - External progress callback (optional)
 * @returns Internal progress callback or undefined if no callback provided
 *
 * @example
 * ```typescript
 * // Before (repeated pattern):
 * onProgress: options?.onProgress
 *   ? (moved, total, currentKey) => {
 *       options.onProgress!({
 *         operation: 'Moving objects',
 *         bytesTransferred: moved,
 *         totalBytes: total,
 *         percentage: Math.round((moved / total) * 100),
 *         currentFile: currentKey,
 *       });
 *     }
 *   : undefined,
 *
 * // After:
 * onProgress: createProgressAdapter('Moving objects', options?.onProgress),
 * ```
 */
export function createProgressAdapter(
  operation: string,
  onProgress?: ProgressCallback
): OperationProgressCallback | undefined {
  if (!onProgress) return undefined;

  return (count: number, total: number, currentItem: string) => {
    reportProgress(onProgress, operation, count, total, currentItem);
  };
}
