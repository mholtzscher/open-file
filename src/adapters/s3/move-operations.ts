/**
 * S3 Move Operations
 *
 * Functions for moving/renaming S3 objects within a bucket.
 * Move is implemented as copy + delete since S3 doesn't have native move.
 */

import { S3Client, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { retryWithBackoff, getS3RetryConfig } from '../../utils/retry.js';
import { listAllObjects } from './batch-operations.js';

/**
 * Options for moving a single object
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

  // Copy to new location with metadata preservation
  await retryWithBackoff(() => {
    const command = new CopyObjectCommand({
      Bucket: bucket,
      CopySource: `${bucket}/${sourceKey}`,
      Key: destKey,
      MetadataDirective: 'COPY',
    });
    return client.send(command);
  }, getS3RetryConfig());

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
 * Progress callback for directory move
 */
export type MoveProgressCallback = (moved: number, total: number, currentKey: string) => void;

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

  // List all objects under the source prefix
  const objectsToMove = await listAllObjects({
    client,
    bucket,
    prefix: sourcePrefix,
  });

  // Move each object (copy + delete)
  for (let i = 0; i < objectsToMove.length; i++) {
    const srcKey = objectsToMove[i];
    const relativePath = srcKey.substring(sourcePrefix.length);
    const destKey = destPrefix + relativePath;

    await moveObject({
      client,
      bucket,
      sourceKey: srcKey,
      destKey,
    });

    // Report progress
    if (onProgress) {
      onProgress(i + 1, objectsToMove.length, srcKey);
    }
  }
}
