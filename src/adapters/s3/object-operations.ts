/**
 * S3 Object Operations
 *
 * Unified functions for copying and moving S3 objects within and between buckets.
 * Move is implemented as copy + delete since S3 doesn't have native move.
 */

import { S3Client, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { retryWithBackoff, getS3RetryConfig } from '../../utils/retry.js';
import { listAllObjects } from './batch-operations.js';

/**
 * Options for copying a single object
 */
export interface CopyObjectOptions {
  /** S3 client to use */
  client: S3Client;
  /** Source bucket name */
  sourceBucket: string;
  /** Source object key */
  sourceKey: string;
  /** Destination bucket name */
  destBucket: string;
  /** Destination object key */
  destKey: string;
}

/**
 * Copy a single S3 object
 *
 * @param options - Copy options
 */
export async function copyObject(options: CopyObjectOptions): Promise<void> {
  const { client, sourceBucket, sourceKey, destBucket, destKey } = options;

  await retryWithBackoff(() => {
    const command = new CopyObjectCommand({
      Bucket: destBucket,
      CopySource: `${sourceBucket}/${sourceKey}`,
      Key: destKey,
      MetadataDirective: 'COPY', // Preserve metadata
    });
    return client.send(command);
  }, getS3RetryConfig());
}

/**
 * Options for moving a single object within a bucket
 */
export interface MoveObjectOptions {
  /** S3 client to use */
  client: S3Client;
  /** Bucket name */
  bucket: string;
  /** Source object key */
  sourceKey: string;
  /** Destination object key */
  destKey: string;
}

/**
 * Move a single S3 object (copy + delete)
 *
 * @param options - Move options
 */
export async function moveObject(options: MoveObjectOptions): Promise<void> {
  const { client, bucket, sourceKey, destKey } = options;

  // Copy to new location
  await copyObject({
    client,
    sourceBucket: bucket,
    sourceKey,
    destBucket: bucket,
    destKey,
  });

  // Delete from old location
  await retryWithBackoff(() => {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: sourceKey,
    });
    return client.send(command);
  }, getS3RetryConfig());
}

/**
 * Progress callback for batch operations
 */
export type ObjectOperationProgressCallback = (
  processed: number,
  total: number,
  currentKey: string
) => void;

// Re-export for backwards compatibility
export type CopyProgressCallback = ObjectOperationProgressCallback;
export type MoveProgressCallback = ObjectOperationProgressCallback;

/**
 * Options for batch object operations (copy or move)
 */
export interface BatchObjectOperationOptions {
  /** S3 client to use */
  client: S3Client;
  /** Source bucket name */
  sourceBucket: string;
  /** Source prefix (directory path) */
  sourcePrefix: string;
  /** Destination bucket name */
  destBucket: string;
  /** Destination prefix (directory path) */
  destPrefix: string;
  /** If true, delete source after copy (move operation) */
  deleteSource?: boolean;
  /** Optional key to exclude from the operation (e.g., directory marker) */
  excludeKey?: string;
  /** Optional progress callback */
  onProgress?: ObjectOperationProgressCallback;
}

/**
 * Batch object operation - copies or moves all objects under a prefix
 *
 * @param options - Batch operation options
 */
export async function batchObjectOperation(options: BatchObjectOperationOptions): Promise<void> {
  const {
    client,
    sourceBucket,
    sourcePrefix,
    destBucket,
    destPrefix,
    deleteSource = false,
    excludeKey,
    onProgress,
  } = options;

  // List all objects under the source prefix
  const objects = await listAllObjects({
    client,
    bucket: sourceBucket,
    prefix: sourcePrefix,
    excludeKey,
  });

  // Process each object
  for (let i = 0; i < objects.length; i++) {
    const srcKey = objects[i];
    const relativePath = srcKey.substring(sourcePrefix.length);
    const destKey = destPrefix + relativePath;

    // Copy to destination
    await copyObject({
      client,
      sourceBucket,
      sourceKey: srcKey,
      destBucket,
      destKey,
    });

    // Delete source if this is a move operation
    if (deleteSource) {
      await retryWithBackoff(() => {
        const command = new DeleteObjectCommand({
          Bucket: sourceBucket,
          Key: srcKey,
        });
        return client.send(command);
      }, getS3RetryConfig());
    }

    // Report progress
    if (onProgress) {
      onProgress(i + 1, objects.length, srcKey);
    }
  }
}

/**
 * Options for copying a directory
 */
export interface CopyDirectoryOptions {
  /** S3 client to use */
  client: S3Client;
  /** Source bucket name */
  sourceBucket: string;
  /** Source prefix (directory path) */
  sourcePrefix: string;
  /** Destination bucket name */
  destBucket: string;
  /** Destination prefix (directory path) */
  destPrefix: string;
  /** Optional progress callback */
  onProgress?: CopyProgressCallback;
}

/**
 * Copy all objects under a prefix to a new location
 *
 * @param options - Copy directory options
 */
export async function copyDirectory(options: CopyDirectoryOptions): Promise<void> {
  const { client, sourceBucket, sourcePrefix, destBucket, destPrefix, onProgress } = options;

  await batchObjectOperation({
    client,
    sourceBucket,
    sourcePrefix,
    destBucket,
    destPrefix,
    deleteSource: false,
    excludeKey: sourcePrefix, // Exclude directory marker
    onProgress,
  });
}

/**
 * Options for moving a directory
 */
export interface MoveDirectoryOptions {
  /** S3 client to use */
  client: S3Client;
  /** Bucket name */
  bucket: string;
  /** Source prefix (directory path) */
  sourcePrefix: string;
  /** Destination prefix (directory path) */
  destPrefix: string;
  /** Optional progress callback */
  onProgress?: MoveProgressCallback;
}

/**
 * Move all objects under a prefix to a new location
 *
 * @param options - Move directory options
 */
export async function moveDirectory(options: MoveDirectoryOptions): Promise<void> {
  const { client, bucket, sourcePrefix, destPrefix, onProgress } = options;

  await batchObjectOperation({
    client,
    sourceBucket: bucket,
    sourcePrefix,
    destBucket: bucket,
    destPrefix,
    deleteSource: true,
    onProgress,
  });
}
