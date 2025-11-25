/**
 * S3 Adapter - AWS S3 backend integration
 *
 * Implements the Adapter interface using AWS SDK v3 for S3 operations.
 * Handles virtual directories, prefixes, and S3-specific features.
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  GetObjectTaggingCommand,
} from '@aws-sdk/client-s3';
import { promises as fs } from 'fs';
import { BucketAwareAdapter, ListOptions, ListResult, OperationOptions } from './adapter.js';
import { Entry, EntryType } from '../types/entry.js';
import { generateEntryId } from '../utils/entry-id.js';
import { retryWithBackoff, getS3RetryConfig } from '../utils/retry.js';
import { parseAwsError } from '../utils/errors.js';
import { getLogger } from '../utils/logger.js';
import { createS3Client, S3ClientOptions, S3ClientResult } from './s3/client-factory.js';
import {
  uploadLargeFile,
  shouldUseMultipartUpload,
  MULTIPART_THRESHOLD,
} from './s3/multipart-upload.js';
import { normalizeS3Path, getS3KeyName } from './s3/path-utils.js';
import { parseBucketToEntry, BucketInfo } from './s3/entry-parser.js';
import { listAllObjects, batchDeleteObjects } from './s3/batch-operations.js';
import {
  copyObject,
  copyDirectory as copyDirectoryOp,
  moveObject,
  moveDirectory as moveDirectoryOp,
} from './s3/object-operations.js';
import {
  downloadFileToLocal,
  downloadDirectoryToLocal as downloadDirToLocal,
  uploadFileToS3,
  uploadDirectoryToS3,
} from './s3/transfer-operations.js';
import { createProgressAdapter } from './s3/progress-adapter.js';
import { readObject } from './s3/read-operations.js';
import { listObjects, listBuckets as listBucketsOp } from './s3/list-operations.js';
// Re-export BucketInfo type for backwards compatibility
export type { BucketInfo } from './s3/entry-parser.js';
// Re-export client factory types for dependency injection
export type { S3ClientOptions, S3ClientResult } from './s3/client-factory.js';

/**
 * Configuration for S3 adapter
 */
export interface S3AdapterConfig {
  /** AWS region (defaults to AWS_REGION or us-east-1) */
  region?: string;
  /** S3 bucket name (optional - if not provided, bucket listing mode is used) */
  bucket?: string;
  /** Access key (optional - uses AWS credentials from environment if not provided) */
  accessKeyId?: string;
  /** Secret access key (optional) */
  secretAccessKey?: string;
  /** Session token (optional - for temporary credentials) */
  sessionToken?: string;
  /** AWS profile name (optional - uses AWS_PROFILE if not provided) */
  profile?: string;
  /** Custom S3 endpoint (for LocalStack/MinIO/etc.) */
  endpoint?: string;
  /** Force path style (required for MinIO and some S3-compatible services) */
  forcePathStyle?: boolean;
}

/**
 * Logger interface for dependency injection
 * Matches the Logger class methods used by S3Adapter
 */
export interface S3AdapterLogger {
  debug(message: string, data?: any): void;
  info(message: string, data?: any): void;
  warn(message: string, data?: any): void;
  error(message: string, error?: Error | any): void;
}

/**
 * Client factory function type for dependency injection
 */
export type S3ClientFactory = (options: S3ClientOptions) => S3ClientResult;

/**
 * Dependencies that can be injected into S3Adapter
 * All dependencies are optional and default to production implementations
 */
export interface S3AdapterDependencies {
  /** Factory function to create S3 clients (defaults to createS3Client) */
  clientFactory?: S3ClientFactory;
  /** Logger instance (defaults to getLogger()) */
  logger?: S3AdapterLogger;
}

/**
 * S3 Adapter implementation
 *
 * Implements BucketAwareAdapter which includes:
 * - ReadableStorageAdapter: list, getMetadata, exists, read
 * - MutableStorageAdapter: create, delete, move, copy
 * - TransferableStorageAdapter: downloadToLocal, uploadFromLocal
 * - BucketAwareAdapter: getBucketEntries, setBucket, setRegion
 */
export class S3Adapter implements BucketAwareAdapter {
  readonly name = 's3';
  private client: S3Client;
  private bucket?: string;
  private currentRegion: string;
  private clientOptions: S3ClientOptions;

  // Injected dependencies with defaults
  private readonly logger: S3AdapterLogger;
  private readonly clientFactory: S3ClientFactory;

  constructor(config: S3AdapterConfig, dependencies?: S3AdapterDependencies) {
    // Initialize dependencies with defaults
    this.logger = dependencies?.logger ?? getLogger();
    this.clientFactory = dependencies?.clientFactory ?? createS3Client;

    this.bucket = config.bucket;

    this.logger.debug('S3Adapter constructor called', {
      bucket: config.bucket,
      region: config.region,
      profile: config.profile,
      endpoint: config.endpoint,
      hasAccessKey: !!config.accessKeyId,
      hasSecretKey: !!config.secretAccessKey,
    });

    // Store options for client recreation
    this.clientOptions = {
      region: config.region,
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      sessionToken: config.sessionToken,
      profile: config.profile,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
    };

    // Create S3 client using factory
    const { client, region } = this.clientFactory(this.clientOptions);
    this.client = client;
    this.currentRegion = region;

    this.logger.info('S3Adapter initialized', {
      bucket: this.bucket,
      region: this.currentRegion,
      profile: config.profile,
    });
  }

  /**
   * Set the bucket to operate on (for bucket selection from root view)
   */
  setBucket(bucketName: string): void {
    this.bucket = bucketName;
    this.logger.debug('S3Adapter bucket changed', { bucket: bucketName });
  }

  /**
   * Set the region and reinitialize S3Client if needed (for bucket selection from root view)
   */
  setRegion(region: string): void {
    if (region !== this.currentRegion) {
      this.logger.debug('S3Adapter region changed', {
        oldRegion: this.currentRegion,
        newRegion: region,
      });
      this.currentRegion = region;
      // Reinitialize S3Client with new region using factory
      const { client } = this.clientFactory({ ...this.clientOptions, region });
      this.client = client;
    }
  }

  /**
   * Normalize path to S3 prefix format
   * Delegates to the path-utils module for consistent path handling.
   */
  private normalizePath(path: string, isDirectory: boolean = false): string {
    return normalizeS3Path(path, isDirectory);
  }

  /**
   * List entries at a given path
   */
  async list(path: string, options?: ListOptions): Promise<ListResult> {
    if (!this.bucket) {
      throw new Error('Bucket not configured. Use listBuckets() to list all buckets.');
    }

    try {
      return await listObjects({
        client: this.client,
        bucket: this.bucket,
        prefix: this.normalizePath(path, true),
        delimiter: '/',
        maxKeys: options?.limit,
        continuationToken: options?.continuationToken,
        logger: this.logger,
      });
    } catch (error) {
      this.logger.error('Failed to list S3 objects', error);
      throw parseAwsError(error, 'list');
    }
  }

  /**
   * List all S3 buckets in the account with metadata
   */
  async listBuckets(): Promise<BucketInfo[]> {
    try {
      return await listBucketsOp({
        client: this.client,
        logger: this.logger,
      });
    } catch (error) {
      this.logger.error('Failed to list S3 buckets', error);
      throw parseAwsError(error, 'listBuckets');
    }
  }

  /**
   * Get bucket entries for root view display
   */
  async getBucketEntries(): Promise<Entry[]> {
    const buckets = await this.listBuckets();
    return buckets.map(parseBucketToEntry);
  }

  /**
   * Get metadata for a specific entry
   */
  async getMetadata(path: string): Promise<Entry> {
    const normalized = this.normalizePath(path);

    try {
      const response = await retryWithBackoff(() => {
        const command = new HeadObjectCommand({
          Bucket: this.bucket,
          Key: normalized,
        });
        return this.client.send(command);
      }, getS3RetryConfig());

      // Determine if it's a directory based on content-type
      const isDirectory =
        normalized.endsWith('/') || response.ContentType === 'application/x-directory';

      // Fetch tags if available
      const custom: Record<string, string> = {};

      // Add version-id if available
      if (response.VersionId) {
        custom.versionId = response.VersionId;
      }

      // Try to fetch tags (may fail if bucket doesn't have tagging enabled)
      try {
        const tagsResponse = await retryWithBackoff(() => {
          const command = new GetObjectTaggingCommand({
            Bucket: this.bucket,
            Key: normalized,
            ...(response.VersionId && { VersionId: response.VersionId }),
          });
          return this.client.send(command);
        }, getS3RetryConfig());

        if (tagsResponse.TagSet && tagsResponse.TagSet.length > 0) {
          for (const tag of tagsResponse.TagSet) {
            if (tag.Key && tag.Value) {
              custom[`tag:${tag.Key}`] = tag.Value;
            }
          }
        }
      } catch (error) {
        // Ignore tagging errors - bucket may not have tagging enabled
      }

      return {
        id: generateEntryId(),
        name: getS3KeyName(normalized),
        type: isDirectory ? EntryType.Directory : EntryType.File,
        path: normalized,
        size: response.ContentLength,
        modified: response.LastModified,
        metadata: {
          contentType: response.ContentType,
          etag: response.ETag,
          storageClass: response.StorageClass,
          ...(Object.keys(custom).length > 0 && { custom }),
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get metadata for ${path}`, error);
      throw parseAwsError(error, 'getMetadata');
    }
  }

  /**
   * Create a new file or directory
   */
  async create(
    path: string,
    type: EntryType,
    content?: Buffer | string,
    options?: OperationOptions
  ): Promise<void> {
    const normalized = this.normalizePath(path, type === EntryType.Directory);

    try {
      if (type === EntryType.Directory) {
        // Create directory marker (empty object with trailing slash)
        if (options?.onProgress) {
          options.onProgress({
            operation: 'Creating directory',
            bytesTransferred: 0,
            totalBytes: 0,
            percentage: 0,
            currentFile: path,
          });
        }

        await retryWithBackoff(() => {
          const command = new PutObjectCommand({
            Bucket: this.bucket,
            Key: normalized,
            Body: '',
            ContentType: 'application/x-directory',
          });
          return this.client.send(command);
        }, getS3RetryConfig());

        if (options?.onProgress) {
          options.onProgress({
            operation: 'Created directory',
            bytesTransferred: 0,
            totalBytes: 0,
            percentage: 100,
            currentFile: path,
          });
        }
      } else {
        // Create file with content
        const body = content instanceof Buffer ? content : Buffer.from(content || '');
        const totalBytes = body.length;

        if (options?.onProgress) {
          options.onProgress({
            operation: 'Creating file',
            bytesTransferred: 0,
            totalBytes,
            percentage: 0,
            currentFile: path,
          });
        }

        // Use multipart upload for large files
        if (shouldUseMultipartUpload(totalBytes)) {
          await uploadLargeFile(this.client, this.bucket!, normalized, body, options);
        } else {
          // Use regular PutObject for small files
          await retryWithBackoff(() => {
            const command = new PutObjectCommand({
              Bucket: this.bucket,
              Key: normalized,
              Body: body,
            });
            return this.client.send(command);
          }, getS3RetryConfig());
        }

        if (options?.onProgress) {
          options.onProgress({
            operation: 'Created file',
            bytesTransferred: totalBytes,
            totalBytes,
            percentage: 100,
            currentFile: path,
          });
        }
      }
    } catch (error) {
      this.logger.error(`Failed to create ${path}`, error);
      throw parseAwsError(error, 'create');
    }
  }

  /**
   * Delete a file or directory
   */
  async delete(path: string, recursive?: boolean, options?: OperationOptions): Promise<void> {
    const normalized = this.normalizePath(path);

    try {
      if (recursive) {
        // Delete directory and all contents using batch delete
        const prefix = normalized.endsWith('/') ? normalized : normalized + '/';

        // List all objects under the prefix
        const keys = await listAllObjects({
          client: this.client,
          bucket: this.bucket!,
          prefix,
        });

        // Batch delete with progress reporting
        await batchDeleteObjects({
          client: this.client,
          bucket: this.bucket!,
          keys,
          onProgress: options?.onProgress
            ? (deleted, total) => {
                options.onProgress!({
                  operation: 'Deleting objects',
                  bytesTransferred: deleted,
                  totalBytes: total,
                  percentage: Math.round((deleted / total) * 100),
                  currentFile: path,
                });
              }
            : undefined,
        });
      } else {
        // Delete single object
        await retryWithBackoff(() => {
          const command = new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: normalized,
          });
          return this.client.send(command);
        }, getS3RetryConfig());
      }
    } catch (error) {
      this.logger.error(`Failed to delete ${path}`, error);
      throw parseAwsError(error, 'delete');
    }
  }

  /**
   * Move/rename a file or directory
   */
  async move(source: string, destination: string, options?: OperationOptions): Promise<void> {
    const srcNormalized = this.normalizePath(source);
    const isDirectory = source.endsWith('/');
    const destNormalized = this.normalizePath(destination, isDirectory);

    try {
      if (isDirectory) {
        // Move directory recursively
        await this.moveDirectory(srcNormalized, destNormalized, options);
      } else {
        // Move single file
        await this.moveSingleFile(srcNormalized, destNormalized);
      }
    } catch (error) {
      this.logger.error(`Failed to move ${source} to ${destination}`, error);
      throw parseAwsError(error, 'move');
    }
  }

  /**
   * Move a single file (copy + delete)
   */
  private async moveSingleFile(source: string, destination: string): Promise<void> {
    await moveObject({
      client: this.client,
      bucket: this.bucket!,
      sourceKey: source,
      destKey: destination,
    });
  }

  /**
   * Move a directory recursively
   */
  private async moveDirectory(
    source: string,
    destination: string,
    options?: OperationOptions
  ): Promise<void> {
    await moveDirectoryOp({
      client: this.client,
      bucket: this.bucket!,
      sourcePrefix: source,
      destPrefix: destination,
      onProgress: createProgressAdapter('Moving objects', options?.onProgress),
    });
  }

  /**
   * Copy a file or directory
   */
  async copy(
    source: string,
    destination: string,
    optionsOrBucket?: OperationOptions | string
  ): Promise<void> {
    if (!this.bucket) {
      throw new Error('Bucket not configured for copy operation.');
    }
    const srcNormalized = this.normalizePath(source);
    // Support both old targetBucket parameter and new OperationOptions
    const targetBucket = typeof optionsOrBucket === 'string' ? optionsOrBucket : undefined;
    const options = typeof optionsOrBucket === 'object' ? optionsOrBucket : undefined;
    const destBucket = targetBucket || this.bucket;
    const destNormalized = this.normalizePath(destination, source.endsWith('/'));

    try {
      // Check if source is a directory
      if (source.endsWith('/')) {
        // Copy directory recursively
        await this.copyDirectory(srcNormalized, destNormalized, destBucket, options);
      } else {
        // Copy single file
        await this.copySingleFile(srcNormalized, destNormalized, destBucket);
      }
    } catch (error) {
      this.logger.error(`Failed to copy ${source} to ${destination}`, error);
      throw parseAwsError(error, 'copy');
    }
  }

  /**
   * Copy a single file
   */
  private async copySingleFile(
    source: string,
    destination: string,
    targetBucket: string
  ): Promise<void> {
    await copyObject({
      client: this.client,
      sourceBucket: this.bucket!,
      sourceKey: source,
      destBucket: targetBucket,
      destKey: destination,
    });
  }

  /**
   * Copy a directory recursively
   */
  private async copyDirectory(
    source: string,
    destination: string,
    targetBucket: string,
    options?: OperationOptions
  ): Promise<void> {
    await copyDirectoryOp({
      client: this.client,
      sourceBucket: this.bucket!,
      sourcePrefix: source,
      destBucket: targetBucket,
      destPrefix: destination,
      onProgress: createProgressAdapter('Copying objects', options?.onProgress),
    });
  }

  /**
   * Check if a path exists
   */
  async exists(path: string): Promise<boolean> {
    const normalized = this.normalizePath(path);

    try {
      await retryWithBackoff(() => {
        const command = new HeadObjectCommand({
          Bucket: this.bucket,
          Key: normalized,
        });
        return this.client.send(command);
      }, getS3RetryConfig());
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Download/read a file with progress tracking
   */
  async read(path: string, options?: OperationOptions): Promise<Buffer> {
    const normalized = this.normalizePath(path);

    try {
      return await readObject({
        client: this.client,
        bucket: this.bucket!,
        key: normalized,
        onProgress: options?.onProgress,
        logger: this.logger,
      });
    } catch (error) {
      throw parseAwsError(error, 'read');
    }
  }

  /**
   * Download S3 objects to local filesystem
   */
  async downloadToLocal(
    s3Path: string,
    localPath: string,
    recursive: boolean = false,
    options?: OperationOptions
  ): Promise<void> {
    const s3Normalized = this.normalizePath(s3Path);

    try {
      if (recursive && s3Path.endsWith('/')) {
        // Download directory recursively
        await this.downloadDirectoryToLocal(s3Normalized, localPath, options);
      } else {
        // Download single file
        await this.downloadSingleFileToLocal(s3Normalized, localPath, options);
      }
    } catch (error) {
      this.logger.error(`Failed to download ${s3Path} to ${localPath}`, error);
      throw parseAwsError(error, 'download');
    }
  }

  /**
   * Download a single S3 file to local filesystem
   */
  private async downloadSingleFileToLocal(
    s3Key: string,
    localPath: string,
    options?: OperationOptions
  ): Promise<void> {
    await downloadFileToLocal({
      readFromS3: this.read.bind(this),
      s3Key,
      localPath,
      options,
    });
  }

  /**
   * Download S3 directory to local filesystem recursively
   */
  private async downloadDirectoryToLocal(
    s3Prefix: string,
    localPath: string,
    options?: OperationOptions
  ): Promise<void> {
    await downloadDirToLocal({
      client: this.client,
      bucket: this.bucket!,
      readFromS3: this.read.bind(this),
      s3Prefix,
      localPath,
      onProgress: createProgressAdapter('Downloading directory', options?.onProgress),
      options,
    });
  }

  /**
   * Upload local files to S3
   */
  async uploadFromLocal(
    localPath: string,
    s3Path: string,
    recursive: boolean = false,
    options?: OperationOptions
  ): Promise<void> {
    try {
      // Check if local path is a directory
      const stats = await fs.stat(localPath);

      if (stats.isDirectory() && recursive) {
        // Upload directory recursively - normalize as directory (with trailing slash)
        const s3Normalized = this.normalizePath(s3Path, true);
        await this.uploadDirectoryToS3(localPath, s3Normalized, options);
      } else if (stats.isFile()) {
        // Upload single file - normalize as file (no trailing slash)
        const s3Normalized = this.normalizePath(s3Path, false);
        await this.uploadSingleFileToS3(localPath, s3Normalized, options);
      } else {
        throw new Error(`Invalid path: ${localPath} is not a file or directory`);
      }
    } catch (error) {
      this.logger.error(`Failed to upload ${localPath} to ${s3Path}`, error);
      throw parseAwsError(error, 'upload');
    }
  }

  /**
   * Upload a single local file to S3
   */
  private async uploadSingleFileToS3(
    localPath: string,
    s3Key: string,
    options?: OperationOptions
  ): Promise<void> {
    await uploadFileToS3({
      client: this.client,
      bucket: this.bucket!,
      localPath,
      s3Key,
      options,
    });
  }

  /**
   * Upload local directory to S3 recursively
   */
  private async uploadDirectoryToS3(
    localPath: string,
    s3Prefix: string,
    options?: OperationOptions
  ): Promise<void> {
    await uploadDirectoryToS3({
      client: this.client,
      bucket: this.bucket!,
      localPath,
      s3Prefix,
      onProgress: createProgressAdapter('Uploading directory', options?.onProgress),
      options,
    });
  }
}
