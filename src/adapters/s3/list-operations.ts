/**
 * List Operations Module
 *
 * Handles listing S3 objects and buckets with pagination support.
 * Extracts complex list logic from S3Adapter for better testability.
 */

import {
  S3Client,
  ListObjectsV2Command,
  ListObjectsV2CommandInput,
  ListBucketsCommand,
  GetBucketLocationCommand,
} from '@aws-sdk/client-s3';
import { Entry, EntryType } from '../../types/entry.js';
import { retryWithBackoff, getS3RetryConfig } from '../../utils/retry.js';
import {
  parseS3ObjectToEntry,
  parseCommonPrefixToEntry,
  sortEntries,
  BucketInfo,
} from './entry-parser.js';

/**
 * Logger interface for list operations
 */
export interface ListOperationsLogger {
  debug(message: string, context?: Record<string, unknown>): void;
  error(message: string, error?: unknown): void;
}

/**
 * Options for listing S3 objects
 */
export interface ListObjectsOptions {
  /** S3 client instance */
  client: S3Client;
  /** Bucket name */
  bucket: string;
  /** Prefix to filter objects */
  prefix: string;
  /** Delimiter for directory-style listing (default: '/') */
  delimiter?: string;
  /** Maximum number of keys to return */
  maxKeys?: number;
  /** Continuation token for pagination */
  continuationToken?: string;
  /** Optional logger */
  logger?: ListOperationsLogger;
}

/**
 * Result of listing S3 objects
 */
export interface ListObjectsResult {
  /** List of entries (files and directories) */
  entries: Entry[];
  /** Continuation token for next page (if any) */
  continuationToken?: string;
  /** Whether there are more results */
  hasMore: boolean;
}

/**
 * Options for listing S3 buckets
 */
export interface ListBucketsOptions {
  /** S3 client instance */
  client: S3Client;
  /** Optional logger */
  logger?: ListOperationsLogger;
}

/**
 * No-op logger for when no logger is provided
 */
const noopLogger: ListOperationsLogger = {
  debug: () => {},
  error: () => {},
};

/**
 * List objects in an S3 bucket with pagination support
 *
 * @param options - List options including client, bucket, prefix, and pagination
 * @returns List result with entries, continuation token, and hasMore flag
 *
 * @example
 * ```typescript
 * const result = await listObjects({
 *   client: s3Client,
 *   bucket: 'my-bucket',
 *   prefix: 'folder/',
 *   maxKeys: 100,
 * });
 * console.log(`Found ${result.entries.length} entries`);
 * if (result.hasMore) {
 *   // Fetch next page using result.continuationToken
 * }
 * ```
 */
export async function listObjects(options: ListObjectsOptions): Promise<ListObjectsResult> {
  const {
    client,
    bucket,
    prefix,
    delimiter = '/',
    maxKeys = 1000,
    continuationToken,
    logger = noopLogger,
  } = options;

  const params: ListObjectsV2CommandInput = {
    Bucket: bucket,
    Prefix: prefix,
    Delimiter: delimiter,
    MaxKeys: maxKeys,
    ContinuationToken: continuationToken,
  };

  logger.debug('listObjects called', {
    bucket,
    prefix,
    delimiter,
    maxKeys,
    hasContinuationToken: !!continuationToken,
  });

  logger.debug('Sending ListObjectsV2Command', { ...params });

  const response = await retryWithBackoff(() => {
    logger.debug('Executing ListObjectsV2Command...');
    const command = new ListObjectsV2Command(params);
    return client.send(command);
  }, getS3RetryConfig());

  logger.debug('ListObjectsV2 response received', {
    commonPrefixesCount: response.CommonPrefixes?.length || 0,
    contentsCount: response.Contents?.length || 0,
    isTruncated: response.IsTruncated,
    nextContinuationToken: !!response.NextContinuationToken,
  });

  const entries: Entry[] = [];

  // Process directories (common prefixes)
  if (response.CommonPrefixes) {
    for (const commonPrefix of response.CommonPrefixes) {
      const entry = parseCommonPrefixToEntry(commonPrefix, prefix);
      if (entry) {
        entries.push(entry);
      }
    }
  }

  // Process files
  if (response.Contents) {
    for (const obj of response.Contents) {
      const entry = parseS3ObjectToEntry(obj, prefix);
      if (entry && entry.type === EntryType.File) {
        entries.push(entry);
      }
    }
  }

  // Sort: directories first, then by name
  sortEntries(entries);

  logger.debug('Parsed entries', {
    count: entries.length,
    directories: entries.filter(e => e.type === EntryType.Directory).length,
    files: entries.filter(e => e.type === EntryType.File).length,
  });

  return {
    entries,
    continuationToken: response.NextContinuationToken,
    hasMore: response.IsTruncated ?? false,
  };
}

/**
 * List all S3 buckets in the account with metadata
 *
 * Fetches all buckets and their regions. Region lookup may fail for some
 * buckets due to permissions, in which case region will be undefined.
 *
 * @param options - List options including client and logger
 * @returns Array of bucket info sorted by creation date (newest first)
 *
 * @example
 * ```typescript
 * const buckets = await listBuckets({ client: s3Client });
 * for (const bucket of buckets) {
 *   console.log(`${bucket.name} (${bucket.region})`);
 * }
 * ```
 */
export async function listBuckets(options: ListBucketsOptions): Promise<BucketInfo[]> {
  const { client, logger = noopLogger } = options;

  logger.debug('listBuckets called');

  const response = await retryWithBackoff(() => {
    const command = new ListBucketsCommand({});
    return client.send(command);
  }, getS3RetryConfig());

  logger.debug('ListBuckets response received', {
    bucketCount: response.Buckets?.length || 0,
  });

  const buckets: BucketInfo[] = [];

  // Process each bucket
  if (response.Buckets) {
    for (const bucket of response.Buckets) {
      if (bucket.Name) {
        // Get bucket region
        let region: string | undefined;
        try {
          const locationResponse = await retryWithBackoff(() => {
            const command = new GetBucketLocationCommand({ Bucket: bucket.Name });
            return client.send(command);
          }, getS3RetryConfig());
          // LocationConstraint is undefined for us-east-1, otherwise it's the region
          region = locationResponse.LocationConstraint || 'us-east-1';
        } catch (error) {
          logger.debug('Failed to get bucket location', {
            bucket: bucket.Name,
            error: (error as any)?.message,
          });
          // Region might not be accessible, continue anyway
        }

        buckets.push({
          name: bucket.Name,
          creationDate: bucket.CreationDate,
          region,
        });
      }
    }
  }

  // Sort by creation date (newest first)
  buckets.sort((a, b) => {
    if (!a.creationDate || !b.creationDate) return 0;
    return b.creationDate.getTime() - a.creationDate.getTime();
  });

  logger.debug('Parsed buckets', { count: buckets.length });

  return buckets;
}
