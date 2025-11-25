/**
 * S3 Batch Operations
 *
 * Functions for batch/paginated S3 operations.
 * Eliminates duplication of pagination logic across delete, move, copy, and download.
 */

import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { retryWithBackoff, getS3RetryConfig } from '../../utils/retry.js';

/**
 * Options for listing all objects
 */
export interface ListAllObjectsOptions {
  /** S3 client to use */
  client: S3Client;
  /** Bucket name */
  bucket: string;
  /** Prefix to list under */
  prefix: string;
  /** Optional key to exclude (e.g., the directory marker itself) */
  excludeKey?: string;
  /** Whether to exclude directory markers (keys ending with /) */
  excludeDirectoryMarkers?: boolean;
}

/**
 * List all S3 object keys under a prefix with automatic pagination
 *
 * @param options - Options for listing
 * @returns Array of all object keys
 */
export async function listAllObjects(options: ListAllObjectsOptions): Promise<string[]> {
  const { client, bucket, prefix, excludeKey, excludeDirectoryMarkers } = options;
  const keys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await retryWithBackoff(() => {
      const command = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      });
      return client.send(command);
    }, getS3RetryConfig());

    if (response.Contents) {
      for (const obj of response.Contents) {
        if (obj.Key) {
          // Skip excluded key
          if (excludeKey && obj.Key === excludeKey) {
            continue;
          }
          // Skip directory markers if requested
          if (excludeDirectoryMarkers && obj.Key.endsWith('/')) {
            continue;
          }
          keys.push(obj.Key);
        }
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return keys;
}

/**
 * Options for batch delete
 */
export interface BatchDeleteOptions {
  /** S3 client to use */
  client: S3Client;
  /** Bucket name */
  bucket: string;
  /** Array of keys to delete */
  keys: string[];
  /** Optional progress callback */
  onProgress?: (deleted: number, total: number) => void;
}

/** Maximum objects per DeleteObjects request (S3 limit) */
export const DELETE_BATCH_SIZE = 1000;

/**
 * Delete multiple S3 objects in batches
 *
 * @param options - Options for batch delete
 */
export async function batchDeleteObjects(options: BatchDeleteOptions): Promise<void> {
  const { client, bucket, keys, onProgress } = options;

  for (let i = 0; i < keys.length; i += DELETE_BATCH_SIZE) {
    const batch = keys.slice(i, i + DELETE_BATCH_SIZE);
    const objects = batch.map(Key => ({ Key }));

    await retryWithBackoff(() => {
      const command = new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: objects,
          Quiet: true, // Don't return list of deleted objects
        },
      });
      return client.send(command);
    }, getS3RetryConfig());

    // Report progress
    if (onProgress) {
      const deletedCount = Math.min(i + DELETE_BATCH_SIZE, keys.length);
      onProgress(deletedCount, keys.length);
    }
  }
}
