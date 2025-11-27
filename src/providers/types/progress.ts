/**
 * Progress Types
 *
 * Progress event types for tracking long-running operations.
 */

/**
 * Progress event for long-running provider operations
 *
 * Emitted during uploads, downloads, copies, and other transfers
 * to track progress and provide user feedback.
 */
export interface ProgressEvent {
  /** Type of operation (e.g., 'upload', 'download', 'copy', 'delete') */
  operation: string;
  /** Bytes transferred so far */
  bytesTransferred: number;
  /** Total bytes to transfer (if known) */
  totalBytes?: number;
  /** Percentage complete (0-100) */
  percentage: number;
  /** Current file being processed (for recursive operations) */
  currentFile?: string;
  /** Number of files processed so far (for batch operations) */
  filesProcessed?: number;
  /** Total number of files to process (for batch operations) */
  totalFiles?: number;
  /** Estimated time remaining in milliseconds (if calculable) */
  estimatedTimeRemaining?: number;
  /** Transfer speed in bytes per second (if calculable) */
  bytesPerSecond?: number;
}

/**
 * Callback for receiving progress updates
 */
export type ProgressCallback = (event: ProgressEvent) => void;
