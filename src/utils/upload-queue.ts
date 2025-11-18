/**
 * Upload queue management system
 *
 * Manages file upload queue, progress tracking, and retry logic
 */

import { randomUUID } from 'crypto';

/**
 * Upload queue item status
 */
export enum UploadStatus {
  Pending = 'pending',
  Uploading = 'uploading',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

/**
 * Upload queue item
 */
export interface UploadQueueItem {
  /** Unique identifier for this upload */
  id: string;
  /** Local file path */
  localPath: string;
  /** S3 destination path */
  s3Path: string;
  /** File size in bytes */
  size: number;
  /** Current status */
  status: UploadStatus;
  /** Progress percentage (0-100) */
  progress: number;
  /** Bytes uploaded so far */
  bytesUploaded: number;
  /** Number of retry attempts */
  retries: number;
  /** Error message if failed */
  error?: string;
  /** When the upload started */
  startedAt?: Date;
  /** When the upload completed/failed */
  completedAt?: Date;
}

/**
 * Upload queue configuration
 */
export interface UploadQueueConfig {
  /** Maximum concurrent uploads */
  maxConcurrent?: number;
  /** Maximum retry attempts per file */
  maxRetries?: number;
  /** Initial retry delay in milliseconds */
  retryDelayMs?: number;
}

/**
 * Upload queue
 */
export class UploadQueue {
  private items: Map<string, UploadQueueItem> = new Map();
  private processingIds: Set<string> = new Set();
  private config: Required<UploadQueueConfig>;

  constructor(config: UploadQueueConfig = {}) {
    this.config = {
      maxConcurrent: config.maxConcurrent ?? 3,
      maxRetries: config.maxRetries ?? 3,
      retryDelayMs: config.retryDelayMs ?? 1000,
    };
  }

  /**
   * Add files to upload queue
   */
  addFiles(localPaths: string[], s3Destination: string, fileSizes: Map<string, number>): string[] {
    const ids: string[] = [];

    for (const localPath of localPaths) {
      const id = randomUUID();
      const size = fileSizes.get(localPath) || 0;

      const item: UploadQueueItem = {
        id,
        localPath,
        s3Path: `${s3Destination}/${localPath.split('/').pop()}`,
        size,
        status: UploadStatus.Pending,
        progress: 0,
        bytesUploaded: 0,
        retries: 0,
      };

      this.items.set(id, item);
      ids.push(id);
    }

    return ids;
  }

  /**
   * Get queue item by ID
   */
  getItem(id: string): UploadQueueItem | undefined {
    return this.items.get(id);
  }

  /**
   * Get all queue items
   */
  getAll(): UploadQueueItem[] {
    return Array.from(this.items.values());
  }

  /**
   * Get queue items by status
   */
  getByStatus(status: UploadStatus): UploadQueueItem[] {
    return this.getAll().filter(item => item.status === status);
  }

  /**
   * Update item progress
   */
  updateProgress(id: string, bytesUploaded: number, totalBytes: number): void {
    const item = this.items.get(id);
    if (!item) return;

    item.bytesUploaded = bytesUploaded;
    item.progress = totalBytes > 0 ? Math.round((bytesUploaded / totalBytes) * 100) : 0;
  }

  /**
   * Mark item as uploading
   */
  markUploading(id: string): void {
    const item = this.items.get(id);
    if (item) {
      item.status = UploadStatus.Uploading;
      item.startedAt = new Date();
    }
  }

  /**
   * Mark item as completed
   */
  markCompleted(id: string): void {
    const item = this.items.get(id);
    if (item) {
      item.status = UploadStatus.Completed;
      item.progress = 100;
      item.bytesUploaded = item.size;
      item.completedAt = new Date();
      this.processingIds.delete(id);
    }
  }

  /**
   * Mark item as failed
   */
  markFailed(id: string, error: string): void {
    const item = this.items.get(id);
    if (item) {
      item.status = UploadStatus.Failed;
      item.error = error;
      item.completedAt = new Date();
      this.processingIds.delete(id);
    }
  }

  /**
   * Retry a failed upload
   */
  retry(id: string): boolean {
    const item = this.items.get(id);
    if (!item) return false;

    if (item.retries >= this.config.maxRetries) {
      return false;
    }

    item.retries++;
    item.status = UploadStatus.Pending;
    item.progress = 0;
    item.bytesUploaded = 0;
    item.error = undefined;
    item.startedAt = undefined;
    item.completedAt = undefined;

    return true;
  }

  /**
   * Cancel an upload
   */
  cancel(id: string): void {
    const item = this.items.get(id);
    if (item) {
      item.status = UploadStatus.Cancelled;
      item.completedAt = new Date();
      this.processingIds.delete(id);
    }
  }

  /**
   * Get pending uploads that can be processed
   */
  getPendingToProcess(): UploadQueueItem[] {
    const pending = this.getByStatus(UploadStatus.Pending);
    const availableSlots = this.config.maxConcurrent - this.processingIds.size;
    return pending.slice(0, Math.max(0, availableSlots));
  }

  /**
   * Mark items as being processed
   */
  markProcessing(ids: string[]): void {
    for (const id of ids) {
      this.processingIds.add(id);
    }
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    total: number;
    pending: number;
    uploading: number;
    completed: number;
    failed: number;
    cancelled: number;
    totalSize: number;
    uploadedSize: number;
    totalProgress: number;
  } {
    const all = this.getAll();
    const pending = this.getByStatus(UploadStatus.Pending);
    const uploading = this.getByStatus(UploadStatus.Uploading);
    const completed = this.getByStatus(UploadStatus.Completed);
    const failed = this.getByStatus(UploadStatus.Failed);
    const cancelled = this.getByStatus(UploadStatus.Cancelled);

    const totalSize = all.reduce((sum, item) => sum + item.size, 0);
    const uploadedSize = all.reduce((sum, item) => sum + item.bytesUploaded, 0);

    return {
      total: all.length,
      pending: pending.length,
      uploading: uploading.length,
      completed: completed.length,
      failed: failed.length,
      cancelled: cancelled.length,
      totalSize,
      uploadedSize,
      totalProgress: totalSize > 0 ? Math.round((uploadedSize / totalSize) * 100) : 0,
    };
  }

  /**
   * Check for duplicate uploads
   */
  isDuplicate(localPath: string, s3Destination: string): boolean {
    const targetPath = `${s3Destination}/${localPath.split('/').pop()}`;
    return this.getAll().some(
      item =>
        (item.status === UploadStatus.Pending || item.status === UploadStatus.Uploading) &&
        item.s3Path === targetPath
    );
  }

  /**
   * Clear completed uploads from queue
   */
  clearCompleted(): number {
    let cleared = 0;
    for (const [id, item] of this.items.entries()) {
      if (item.status === UploadStatus.Completed || item.status === UploadStatus.Cancelled) {
        this.items.delete(id);
        cleared++;
      }
    }
    return cleared;
  }

  /**
   * Clear entire queue
   */
  clear(): void {
    this.items.clear();
    this.processingIds.clear();
  }
}
