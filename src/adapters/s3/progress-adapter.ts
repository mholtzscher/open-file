/**
 * Progress Adapter Factory
 *
 * Provides factory functions to create progress callback adapters that
 * convert internal operation progress to standardized ProgressEvent format.
 * This eliminates duplicated progress adapter patterns across S3Adapter methods.
 */

import { ProgressCallback, ProgressEvent } from '../adapter.js';

/**
 * Callback type for internal S3 operations (count-based progress)
 * Used by batch operations like move/copy/delete directory
 */
export type OperationProgressCallback = (
  count: number,
  total: number,
  currentItem: string
) => void;

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
    onProgress({
      operation,
      bytesTransferred: count,
      totalBytes: total,
      percentage: calculatePercentage(count, total),
      currentFile: currentItem,
    });
  };
}
