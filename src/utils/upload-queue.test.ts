/**
 * Upload queue management tests
 */

import { describe, it, expect } from 'bun:test';
import { UploadQueue, UploadStatus } from './upload-queue.js';

describe('UploadQueue', () => {
  it('creates upload queue with default config', () => {
    const queue = new UploadQueue();
    const stats = queue.getStats();

    expect(stats.total).toBe(0);
    expect(stats.pending).toBe(0);
    expect(stats.uploading).toBe(0);
    expect(stats.completed).toBe(0);
  });

  it('adds files to queue', () => {
    const queue = new UploadQueue();
    const fileSizes = new Map<string, number>([
      ['/local/file1.txt', 1024],
      ['/local/file2.txt', 2048],
    ]);

    const ids = queue.addFiles(
      ['/local/file1.txt', '/local/file2.txt'],
      '/bucket/uploads',
      fileSizes
    );

    expect(ids.length).toBe(2);

    const stats = queue.getStats();
    expect(stats.total).toBe(2);
    expect(stats.pending).toBe(2);
    expect(stats.totalSize).toBe(3072);
  });

  it('tracks upload progress', () => {
    const queue = new UploadQueue();
    const fileSizes = new Map<string, number>([['/local/file1.txt', 1000]]);

    const ids = queue.addFiles(['/local/file1.txt'], '/bucket', fileSizes);
    const id = ids[0];

    // Start uploading
    queue.markUploading(id);
    expect(queue.getItem(id)?.status).toBe(UploadStatus.Uploading);

    // Update progress
    queue.updateProgress(id, 500, 1000);
    expect(queue.getItem(id)?.progress).toBe(50);
    expect(queue.getItem(id)?.bytesUploaded).toBe(500);

    // Complete
    queue.markCompleted(id);
    expect(queue.getItem(id)?.status).toBe(UploadStatus.Completed);
    expect(queue.getItem(id)?.progress).toBe(100);
  });

  it('handles failed uploads and retries', () => {
    const queue = new UploadQueue({ maxRetries: 3 });
    const fileSizes = new Map([['/local/file1.txt', 1000]]);

    const ids = queue.addFiles(['/local/file1.txt'], '/bucket', fileSizes);
    const id = ids[0];

    queue.markUploading(id);
    queue.markFailed(id, 'Network error');

    expect(queue.getItem(id)?.status).toBe(UploadStatus.Failed);
    expect(queue.getItem(id)?.error).toBe('Network error');
    expect(queue.getItem(id)?.retries).toBe(0);

    // Retry
    const canRetry = queue.retry(id);
    expect(canRetry).toBe(true);
    expect(queue.getItem(id)?.status).toBe(UploadStatus.Pending);
    expect(queue.getItem(id)?.retries).toBe(1);
  });

  it('prevents retries when max retries exceeded', () => {
    const queue = new UploadQueue({ maxRetries: 1 });
    const fileSizes = new Map([['/local/file1.txt', 1000]]);

    const ids = queue.addFiles(['/local/file1.txt'], '/bucket', fileSizes);
    const id = ids[0];

    queue.markFailed(id, 'Error');
    queue.retry(id);
    queue.markFailed(id, 'Still failing');

    const canRetry = queue.retry(id);
    expect(canRetry).toBe(false);
  });

  it('cancels uploads', () => {
    const queue = new UploadQueue();
    const fileSizes = new Map([['/local/file1.txt', 1000]]);

    const ids = queue.addFiles(['/local/file1.txt'], '/bucket', fileSizes);
    const id = ids[0];

    queue.markUploading(id);
    queue.cancel(id);

    expect(queue.getItem(id)?.status).toBe(UploadStatus.Cancelled);
  });

  it('detects duplicate uploads', () => {
    const queue = new UploadQueue();
    const fileSizes = new Map([['/local/file1.txt', 1000]]);

    queue.addFiles(['/local/file1.txt'], '/bucket', fileSizes);

    const isDuplicate = queue.isDuplicate('/local/file1.txt', '/bucket');
    expect(isDuplicate).toBe(true);
  });

  it('calculates queue statistics', () => {
    const queue = new UploadQueue();
    const fileSizes = new Map<string, number>([
      ['/file1.txt', 1000],
      ['/file2.txt', 2000],
      ['/file3.txt', 3000],
    ]);

    const ids = queue.addFiles(['/file1.txt', '/file2.txt', '/file3.txt'], '/bucket', fileSizes);

    queue.markUploading(ids[0]);
    queue.updateProgress(ids[0], 500, 1000);
    queue.markCompleted(ids[0]);

    queue.markUploading(ids[1]);

    const stats = queue.getStats();
    expect(stats.total).toBe(3);
    expect(stats.completed).toBe(1);
    expect(stats.uploading).toBe(1);
    expect(stats.pending).toBe(1);
    expect(stats.totalSize).toBe(6000);
    expect(stats.uploadedSize).toBeGreaterThanOrEqual(1000);
  });

  it('manages concurrent uploads', () => {
    const queue = new UploadQueue({ maxConcurrent: 2 });
    const fileSizes = new Map<string, number>([
      ['/file1.txt', 1000],
      ['/file2.txt', 1000],
      ['/file3.txt', 1000],
      ['/file4.txt', 1000],
    ]);

    const ids = queue.addFiles(
      ['/file1.txt', '/file2.txt', '/file3.txt', '/file4.txt'],
      '/bucket',
      fileSizes
    );

    // Get first batch
    let pending = queue.getPendingToProcess();
    expect(pending.length).toBeLessThanOrEqual(2);

    // Mark as processing
    queue.markProcessing(pending.map(p => p.id));

    // Start processing
    for (const item of pending) {
      queue.markUploading(item.id);
    }

    // Complete first one
    queue.markCompleted(ids[0]);

    // Now we should be able to start the third one
    pending = queue.getPendingToProcess();
    expect(pending.length).toBeGreaterThan(0);
  });

  it('clears completed uploads', () => {
    const queue = new UploadQueue();
    const fileSizes = new Map<string, number>([
      ['/file1.txt', 1000],
      ['/file2.txt', 1000],
    ]);

    const ids = queue.addFiles(['/file1.txt', '/file2.txt'], '/bucket', fileSizes);

    queue.markCompleted(ids[0]);
    queue.cancel(ids[1]);

    const cleared = queue.clearCompleted();
    expect(cleared).toBe(2);

    const stats = queue.getStats();
    expect(stats.total).toBe(0);
  });

  it('clears entire queue', () => {
    const queue = new UploadQueue();
    const fileSizes = new Map<string, number>([
      ['/file1.txt', 1000],
      ['/file2.txt', 1000],
    ]);

    queue.addFiles(['/file1.txt', '/file2.txt'], '/bucket', fileSizes);

    let stats = queue.getStats();
    expect(stats.total).toBe(2);

    queue.clear();

    stats = queue.getStats();
    expect(stats.total).toBe(0);
  });

  it('gets items by status', () => {
    const queue = new UploadQueue();
    const fileSizes = new Map<string, number>([
      ['/file1.txt', 1000],
      ['/file2.txt', 1000],
      ['/file3.txt', 1000],
    ]);

    const ids = queue.addFiles(['/file1.txt', '/file2.txt', '/file3.txt'], '/bucket', fileSizes);

    queue.markUploading(ids[0]);
    queue.markCompleted(ids[1]);

    const uploading = queue.getByStatus(UploadStatus.Uploading);
    const completed = queue.getByStatus(UploadStatus.Completed);
    const pending = queue.getByStatus(UploadStatus.Pending);

    expect(uploading.length).toBe(1);
    expect(completed.length).toBe(1);
    expect(pending.length).toBe(1);
  });
});
