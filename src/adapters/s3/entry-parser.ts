/**
 * S3 Entry Parser
 *
 * Functions for converting S3 API responses to Entry objects.
 * Handles S3 objects, common prefixes (directories), and buckets.
 */

import type { _Object, CommonPrefix } from '@aws-sdk/client-s3';
import { Entry, EntryType } from '../../types/entry.js';
import { generateEntryId } from '../../utils/entry-id.js';
import { getS3RelativePath } from './path-utils.js';

/**
 * Information about an S3 bucket
 */
export interface BucketInfo {
  /** Bucket name */
  name: string;
  /** Creation date */
  creationDate?: Date;
  /** Bucket region */
  region?: string;
  /** Total size in bytes */
  totalSize?: number;
  /** Number of objects */
  objectCount?: number;
}

/**
 * Parse an S3 object (_Object) to an Entry
 *
 * @param obj - The S3 object from ListObjectsV2
 * @param prefix - The current prefix being listed
 * @returns Entry if this is a direct child, null otherwise
 */
export function parseS3ObjectToEntry(obj: _Object, prefix: string): Entry | null {
  if (!obj.Key) return null;

  // Filter out the directory marker itself
  if (obj.Key === prefix) return null;

  const relativePath = getS3RelativePath(obj.Key, prefix);
  const parts = relativePath.split('/').filter(p => p);

  if (parts.length === 0) return null;

  // Check if this is a direct child
  if (parts.length === 1) {
    // Directory marker (ends with /)
    if (obj.Key.endsWith('/')) {
      return {
        id: generateEntryId(),
        name: parts[0],
        type: EntryType.Directory,
        path: obj.Key,
        modified: obj.LastModified,
        metadata: {
          storageClass: obj.StorageClass,
        },
      };
    }
    // Regular file
    return {
      id: generateEntryId(),
      name: parts[0],
      type: EntryType.File,
      path: obj.Key,
      size: obj.Size,
      modified: obj.LastModified,
      metadata: {
        etag: obj.ETag,
        storageClass: obj.StorageClass,
      },
    };
  }

  // Not a direct child
  return null;
}

/**
 * Parse an S3 common prefix to a directory Entry
 *
 * @param commonPrefix - The common prefix from ListObjectsV2
 * @param prefix - The current prefix being listed
 * @returns Entry if valid, null otherwise
 */
export function parseCommonPrefixToEntry(commonPrefix: CommonPrefix, prefix: string): Entry | null {
  if (!commonPrefix.Prefix) return null;

  const relativePath = getS3RelativePath(commonPrefix.Prefix, prefix);
  const parts = relativePath.split('/').filter(p => p);

  if (parts.length === 0) return null;

  return {
    id: generateEntryId(),
    name: parts[0],
    type: EntryType.Directory,
    path: commonPrefix.Prefix,
    modified: new Date(), // Common prefixes don't have modification dates
  };
}

/**
 * Parse bucket info to a bucket Entry
 *
 * @param bucket - The bucket information
 * @returns Entry representing the bucket
 */
export function parseBucketToEntry(bucket: BucketInfo): Entry {
  return {
    id: generateEntryId(),
    name: bucket.name,
    type: EntryType.Bucket,
    path: bucket.name,
    modified: bucket.creationDate,
    metadata: {
      region: bucket.region,
      createdAt: bucket.creationDate,
    },
  };
}

/**
 * Sort entries: directories first, then by name
 *
 * @param entries - Array of entries to sort
 * @returns Sorted array (mutates original)
 */
export function sortEntries(entries: Entry[]): Entry[] {
  return entries.sort((a, b) => {
    if (a.type !== b.type) {
      // Buckets first, then directories, then files
      const typeOrder = { [EntryType.Bucket]: 0, [EntryType.Directory]: 1, [EntryType.File]: 2 };
      return typeOrder[a.type] - typeOrder[b.type];
    }
    return a.name.localeCompare(b.name);
  });
}
