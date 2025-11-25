/**
 * S3 Copy Operations
 *
 * Functions for copying S3 objects within and between buckets.
 */

import { S3Client, CopyObjectCommand } from '@aws-sdk/client-s3';
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
 * Progress callback for directory copy
 */
export type CopyProgressCallback = (copied: number, total: number, currentKey: string) => void;

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

  // List all objects under the source prefix, excluding the directory marker
  const objectsToCopy = await listAllObjects({
    client,
    bucket: sourceBucket,
    prefix: sourcePrefix,
    excludeKey: sourcePrefix,
  });

  // Copy each object
  for (let i = 0; i < objectsToCopy.length; i++) {
    const srcKey = objectsToCopy[i];
    const relativePath = srcKey.substring(sourcePrefix.length);
    const destKey = destPrefix + relativePath;

    await copyObject({
      client,
      sourceBucket,
      sourceKey: srcKey,
      destBucket,
      destKey,
    });

    // Report progress
    if (onProgress) {
      onProgress(i + 1, objectsToCopy.length, srcKey);
    }
  }
}
