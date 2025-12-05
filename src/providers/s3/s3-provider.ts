/**
 * S3Provider - AWS S3 Storage Provider Implementation
 *
 * Implements the StorageProvider interface using AWS SDK v3 for S3 operations.
 * Handles virtual directories, prefixes, and S3-specific features.
 *
 * Uses the existing S3 adapter helper modules for the underlying operations.
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  GetObjectTaggingCommand,
  GetObjectCommand,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { promises as fs } from 'fs';
import type { S3Profile } from '../types/profile.js';
import { BaseStorageProvider } from '../base-provider.js';
import { Capability } from '../types/capabilities.js';
import { OperationResult, Result, isSuccess } from '../types/result.js';
import type {
  ListOptions,
  ListResult,
  ReadOptions,
  WriteOptions,
  DeleteOptions,
  TransferOptions,
} from '../provider.js';
import { Entry, EntryType } from '../../types/entry.js';
import { generateEntryId } from '../../utils/entry-id.js';

// Import S3 utility modules
import { createS3Client, S3ClientOptions, S3ClientResult } from './utils/client-factory.js';
import { uploadLargeFile, shouldUseMultipartUpload } from './utils/multipart-upload.js';
import { normalizeS3Path, getS3KeyName } from './utils/path-utils.js';
import { parseBucketToEntry } from './utils/entry-parser.js';
import { listAllObjects, batchDeleteObjects } from './utils/batch-operations.js';
import {
  copyObject,
  copyDirectory as copyDirectoryOp,
  moveObject,
  moveDirectory as moveDirectoryOp,
} from './utils/object-operations.js';
import {
  downloadFileToLocal,
  downloadDirectoryToLocal as downloadDirToLocal,
  uploadFileToS3,
  uploadDirectoryToS3,
} from './utils/transfer-operations.js';
import { createProgressAdapter, reportProgress } from './utils/progress-adapter.js';
import { readObject } from './utils/read-operations.js';
import { listObjects, listBuckets as listBucketsOp } from './utils/list-operations.js';
import { retryWithBackoff, getS3RetryConfig } from '../../utils/retry.js';
import { getLogger } from '../../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Logger interface for dependency injection
 */
export interface S3ProviderLogger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, error?: unknown): void;
}

/**
 * Client factory function type for dependency injection
 */
export type S3ClientFactory = (options: S3ClientOptions) => S3ClientResult;

/**
 * Dependencies that can be injected into S3Provider
 */
export interface S3ProviderDependencies {
  /** Factory function to create S3 clients (defaults to createS3Client) */
  clientFactory?: S3ClientFactory;
  /** Logger instance (defaults to getLogger()) */
  logger?: S3ProviderLogger;
}

// ============================================================================
// Error Mapping
// ============================================================================

/**
 * Map AWS S3 error codes to OperationResult status codes
 * Returns a generic error result that can be used for any OperationResult<T>
 * since error results don't carry data.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapS3Error(error: unknown, operation: string): OperationResult<any> {
  const err = error as {
    name?: string;
    Code?: string;
    $metadata?: { httpStatusCode?: number };
    message?: string;
  };

  const errorCode = err.name || err.Code || 'UNKNOWN';
  const httpStatus = err.$metadata?.httpStatusCode;
  const message = err.message || `S3 ${operation} failed`;

  // Map specific S3 error codes
  switch (errorCode) {
    case 'NoSuchKey':
    case 'NotFound':
    case 'NoSuchBucket':
      return Result.notFound(message);

    case 'AccessDenied':
    case 'InvalidAccessKeyId':
    case 'SignatureDoesNotMatch':
      return Result.permissionDenied(message);

    case 'RequestTimeout':
    case 'ServiceUnavailable':
    case 'SlowDown':
    case 'InternalError':
      return Result.connectionFailed(message);

    default:
      break;
  }

  // Map by HTTP status code as fallback
  switch (httpStatus) {
    case 404:
      return Result.notFound(message);
    case 403:
      return Result.permissionDenied(message);
    case 408:
    case 502:
    case 503:
    case 504:
      return Result.connectionFailed(message);
    default:
      return Result.error(errorCode, message, false, error);
  }
}

// ============================================================================
// S3Provider Implementation
// ============================================================================

/**
 * S3Provider - Storage provider implementation for AWS S3
 *
 * Supports:
 * - Full CRUD operations on S3 objects
 * - Virtual directory support (CommonPrefixes)
 * - Bucket listing and selection
 * - Multipart uploads for large files
 * - Server-side copy operations
 * - Presigned URL generation
 * - Custom metadata and tagging
 */
export class S3Provider extends BaseStorageProvider {
  readonly name = 's3';
  readonly displayName = 'Amazon S3';

  private client: S3Client;
  private bucket?: string;
  private currentRegion: string;
  private clientOptions: S3ClientOptions;
  private readonly logger: S3ProviderLogger;
  private readonly clientFactory: S3ClientFactory;

  constructor(profile: S3Profile, dependencies?: S3ProviderDependencies) {
    super();

    // Initialize dependencies with defaults
    this.logger = dependencies?.logger ?? getLogger();
    this.clientFactory = dependencies?.clientFactory ?? createS3Client;

    // Set up capabilities
    this.addCapability(
      Capability.List,
      Capability.Read,
      Capability.Write,
      Capability.Delete,
      Capability.Mkdir,
      Capability.Rmdir,
      Capability.Copy,
      Capability.Move,
      Capability.ServerSideCopy,
      Capability.Download,
      Capability.Upload,
      Capability.Metadata,
      Capability.Containers,
      Capability.PresignedUrls,
      Capability.BatchDelete
    );

    this.logger.debug('S3Provider constructor called', {
      profileId: profile.id,
      region: profile.config.region,
      profile: profile.config.profile,
      endpoint: profile.config.endpoint,
    });

    this.clientOptions = {
      region: profile.config.region,
      profile: profile.config.profile,
      endpoint: profile.config.endpoint,
      forcePathStyle: profile.config.forcePathStyle,
    };

    // Create S3 client using factory
    const { client, region } = this.clientFactory(this.clientOptions);
    this.client = client;
    this.currentRegion = region;

    this.logger.info('S3Provider initialized', {
      profileId: profile.id,
      region: this.currentRegion,
    });
  }

  // ==========================================================================
  // Container Operations (Bucket Management)
  // ==========================================================================

  /**
   * List all S3 buckets in the account
   */
  async listContainers(): Promise<OperationResult<Entry[]>> {
    try {
      const buckets = await listBucketsOp({
        client: this.client,
        logger: this.logger,
      });
      return Result.success(buckets.map(parseBucketToEntry));
    } catch (error) {
      this.logger.error('Failed to list S3 buckets', error);
      return mapS3Error(error, 'listContainers');
    }
  }

  /**
   * Set the current bucket context
   */
  setContainer(bucketName: string): void {
    this.bucket = bucketName;
    this.logger.debug('S3Provider bucket changed', { bucket: bucketName });
  }

  /**
   * Get the current bucket context
   */
  getContainer(): string | undefined {
    return this.bucket;
  }

  /**
   * Set the region and reinitialize S3Client if needed
   */
  setRegion(region: string): void {
    if (region !== this.currentRegion) {
      this.logger.debug('S3Provider region changed', {
        oldRegion: this.currentRegion,
        newRegion: region,
      });
      this.currentRegion = region;
      const { client } = this.clientFactory({ ...this.clientOptions, region });
      this.client = client;
    }
  }

  // ==========================================================================
  // Path Utilities
  // ==========================================================================

  /**
   * Normalize path to S3 prefix format
   */
  private normalizePath(path: string, isDirectory: boolean = false): string {
    return normalizeS3Path(path, isDirectory);
  }

  /**
   * Ensure bucket is configured before operations
   * Returns an error result that can be cast to any OperationResult<T>
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private ensureBucket(): OperationResult<any> | null {
    if (!this.bucket) {
      return Result.error(
        'BUCKET_NOT_CONFIGURED',
        'Bucket not configured. Use listContainers() and setContainer() first.',
        false
      );
    }
    return null;
  }

  // ==========================================================================
  // Core Read Operations
  // ==========================================================================

  /**
   * List entries at a given path
   */
  async list(path: string, options?: ListOptions): Promise<OperationResult<ListResult>> {
    const bucketError = this.ensureBucket();
    if (bucketError) return bucketError;

    try {
      const result = await listObjects({
        client: this.client,
        bucket: this.bucket!,
        prefix: this.normalizePath(path, true),
        delimiter: options?.recursive ? undefined : '/',
        maxKeys: options?.limit,
        continuationToken: options?.continuationToken,
        logger: this.logger,
      });
      return Result.success(result);
    } catch (error) {
      this.logger.error('Failed to list S3 objects', error);
      return mapS3Error(error, 'list');
    }
  }

  /**
   * Get metadata for a specific entry
   */
  async getMetadata(path: string): Promise<OperationResult<Entry>> {
    const bucketError = this.ensureBucket();
    if (bucketError) return bucketError;

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

      if (response.VersionId) {
        custom.versionId = response.VersionId;
      }

      // Try to fetch tags
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
      } catch {
        // Ignore tagging errors - bucket may not have tagging enabled
      }

      return Result.success({
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
      });
    } catch (error) {
      this.logger.error(`Failed to get metadata for ${path}`, error);
      return mapS3Error(error, 'getMetadata');
    }
  }

  /**
   * Check if a path exists
   */
  async exists(path: string): Promise<OperationResult<boolean>> {
    const bucketError = this.ensureBucket();
    if (bucketError) return bucketError;

    const normalized = this.normalizePath(path);

    try {
      await retryWithBackoff(() => {
        const command = new HeadObjectCommand({
          Bucket: this.bucket,
          Key: normalized,
        });
        return this.client.send(command);
      }, getS3RetryConfig());
      return Result.success(true);
    } catch (error) {
      const err = error as { name?: string };
      if (err.name === 'NotFound' || err.name === 'NoSuchKey') {
        return Result.success(false);
      }
      return mapS3Error(error, 'exists');
    }
  }

  /**
   * Read file contents
   */
  async read(path: string, options?: ReadOptions): Promise<OperationResult<Buffer>> {
    const bucketError = this.ensureBucket();
    if (bucketError) return bucketError;

    const normalized = this.normalizePath(path);

    try {
      const buffer = await readObject({
        client: this.client,
        bucket: this.bucket!,
        key: normalized,
        onProgress: options?.onProgress,
        logger: this.logger,
      });
      return Result.success(buffer);
    } catch (error) {
      this.logger.error(`Failed to read ${path}`, error);
      return mapS3Error(error, 'read');
    }
  }

  // ==========================================================================
  // Mutable Operations
  // ==========================================================================

  /**
   * Write content to a file
   */
  async write(
    path: string,
    content: Buffer | string,
    options?: WriteOptions
  ): Promise<OperationResult> {
    const bucketError = this.ensureBucket();
    if (bucketError) return bucketError;

    const normalized = this.normalizePath(path);
    const body = content instanceof Buffer ? content : Buffer.from(content);
    const totalBytes = body.length;

    try {
      reportProgress(options?.onProgress, 'write', 0, totalBytes, path);

      // Use multipart upload for large files
      if (shouldUseMultipartUpload(totalBytes)) {
        await uploadLargeFile(this.client, this.bucket!, normalized, body, {
          onProgress: options?.onProgress,
        });
      } else {
        await retryWithBackoff(() => {
          const command = new PutObjectCommand({
            Bucket: this.bucket,
            Key: normalized,
            Body: body,
            ContentType: options?.contentType,
            Metadata: options?.metadata,
          });
          return this.client.send(command);
        }, getS3RetryConfig());
      }

      reportProgress(options?.onProgress, 'write', totalBytes, totalBytes, path);

      return Result.success();
    } catch (error) {
      this.logger.error(`Failed to write ${path}`, error);
      return mapS3Error(error, 'write');
    }
  }

  /**
   * Create a directory (S3 directory marker)
   */
  async mkdir(path: string): Promise<OperationResult> {
    const bucketError = this.ensureBucket();
    if (bucketError) return bucketError;

    const normalized = this.normalizePath(path, true);

    try {
      await retryWithBackoff(() => {
        const command = new PutObjectCommand({
          Bucket: this.bucket,
          Key: normalized,
          Body: '',
          ContentType: 'application/x-directory',
        });
        return this.client.send(command);
      }, getS3RetryConfig());

      return Result.success();
    } catch (error) {
      this.logger.error(`Failed to create directory ${path}`, error);
      return mapS3Error(error, 'mkdir');
    }
  }

  /**
   * Delete a file or directory
   */
  async delete(path: string, options?: DeleteOptions): Promise<OperationResult> {
    const bucketError = this.ensureBucket();
    if (bucketError) return bucketError;

    const normalized = this.normalizePath(path);

    try {
      if (options?.recursive) {
        // Delete directory and all contents using batch delete
        const prefix = normalized.endsWith('/') ? normalized : normalized + '/';

        const keys = await listAllObjects({
          client: this.client,
          bucket: this.bucket!,
          prefix,
        });

        if (keys.length > 0) {
          await batchDeleteObjects({
            client: this.client,
            bucket: this.bucket!,
            keys,
            onProgress: options?.onProgress
              ? (deleted, total) => {
                  options.onProgress!({
                    operation: 'delete',
                    bytesTransferred: deleted,
                    totalBytes: total,
                    percentage: Math.round((deleted / total) * 100),
                    currentFile: path,
                  });
                }
              : undefined,
          });
        }
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

      return Result.success();
    } catch (error) {
      this.logger.error(`Failed to delete ${path}`, error);
      return mapS3Error(error, 'delete');
    }
  }

  // ==========================================================================
  // Move/Copy Operations (Native S3 Implementation)
  // ==========================================================================

  /**
   * Native move implementation using S3 copy + delete
   */
  protected async nativeMove(
    source: string,
    dest: string,
    options?: TransferOptions
  ): Promise<OperationResult> {
    const bucketError = this.ensureBucket();
    if (bucketError) return bucketError;

    const srcNormalized = this.normalizePath(source);
    const isDirectory = source.endsWith('/');
    const destNormalized = this.normalizePath(dest, isDirectory);

    try {
      if (isDirectory && options?.recursive) {
        await moveDirectoryOp({
          client: this.client,
          bucket: this.bucket!,
          sourcePrefix: srcNormalized,
          destPrefix: destNormalized,
          onProgress: createProgressAdapter('move', options?.onProgress),
        });
      } else {
        await moveObject({
          client: this.client,
          bucket: this.bucket!,
          sourceKey: srcNormalized,
          destKey: destNormalized,
        });
      }

      return Result.success();
    } catch (error) {
      this.logger.error(`Failed to move ${source} to ${dest}`, error);
      return mapS3Error(error, 'move');
    }
  }

  /**
   * Native copy implementation using S3 server-side copy
   */
  protected async nativeCopy(
    source: string,
    dest: string,
    options?: TransferOptions
  ): Promise<OperationResult> {
    const bucketError = this.ensureBucket();
    if (bucketError) return bucketError;

    const srcNormalized = this.normalizePath(source);
    const isDirectory = source.endsWith('/');
    const destNormalized = this.normalizePath(dest, isDirectory);

    try {
      if (isDirectory && options?.recursive) {
        await copyDirectoryOp({
          client: this.client,
          sourceBucket: this.bucket!,
          sourcePrefix: srcNormalized,
          destBucket: this.bucket!,
          destPrefix: destNormalized,
          onProgress: createProgressAdapter('copy', options?.onProgress),
        });
      } else {
        await copyObject({
          client: this.client,
          sourceBucket: this.bucket!,
          sourceKey: srcNormalized,
          destBucket: this.bucket!,
          destKey: destNormalized,
        });
      }

      return Result.success();
    } catch (error) {
      this.logger.error(`Failed to copy ${source} to ${dest}`, error);
      return mapS3Error(error, 'copy');
    }
  }

  // ==========================================================================
  // Local Filesystem Transfers
  // ==========================================================================

  /**
   * Download a remote file to local filesystem
   */
  async downloadToLocal(
    remotePath: string,
    localPath: string,
    options?: TransferOptions
  ): Promise<OperationResult> {
    const bucketError = this.ensureBucket();
    if (bucketError) return bucketError;

    const s3Normalized = this.normalizePath(remotePath);

    try {
      if (options?.recursive && remotePath.endsWith('/')) {
        await downloadDirToLocal({
          client: this.client,
          bucket: this.bucket!,
          readFromS3: async (key: string) => {
            const result = await this.read(key);
            if (!isSuccess(result)) {
              throw new Error(result.error?.message || 'Failed to read from S3');
            }
            return result.data;
          },
          s3Prefix: s3Normalized,
          localPath,
          onProgress: createProgressAdapter('download', options?.onProgress),
          options: { onProgress: options?.onProgress },
        });
      } else {
        await downloadFileToLocal({
          readFromS3: async (key: string) => {
            const result = await this.read(key);
            if (!isSuccess(result)) {
              throw new Error(result.error?.message || 'Failed to read from S3');
            }
            return result.data;
          },
          s3Key: s3Normalized,
          localPath,
          options: { onProgress: options?.onProgress },
        });
      }

      return Result.success();
    } catch (error) {
      this.logger.error(`Failed to download ${remotePath} to ${localPath}`, error);
      return mapS3Error(error, 'download');
    }
  }

  /**
   * Upload a local file to remote storage
   */
  async uploadFromLocal(
    localPath: string,
    remotePath: string,
    options?: TransferOptions
  ): Promise<OperationResult> {
    const bucketError = this.ensureBucket();
    if (bucketError) return bucketError;

    try {
      const stats = await fs.stat(localPath);

      if (stats.isDirectory() && options?.recursive) {
        const s3Normalized = this.normalizePath(remotePath, true);
        await uploadDirectoryToS3({
          client: this.client,
          bucket: this.bucket!,
          localPath,
          s3Prefix: s3Normalized,
          onProgress: createProgressAdapter('upload', options?.onProgress),
          options: { onProgress: options?.onProgress },
        });
      } else if (stats.isFile()) {
        const s3Normalized = this.normalizePath(remotePath, false);
        await uploadFileToS3({
          client: this.client,
          bucket: this.bucket!,
          localPath,
          s3Key: s3Normalized,
          options: { onProgress: options?.onProgress },
        });
      } else {
        return Result.error(
          'INVALID_PATH',
          `Invalid path: ${localPath} is not a file or directory`,
          false
        );
      }

      return Result.success();
    } catch (error) {
      this.logger.error(`Failed to upload ${localPath} to ${remotePath}`, error);
      return mapS3Error(error, 'upload');
    }
  }

  // ==========================================================================
  // Advanced Operations
  // ==========================================================================

  /**
   * Set custom metadata on a file (uses copy-replace)
   */
  async setMetadata(path: string, metadata: Record<string, string>): Promise<OperationResult> {
    const bucketError = this.ensureBucket();
    if (bucketError) return bucketError;

    const normalized = this.normalizePath(path);

    try {
      // S3 requires copy-replace to update metadata
      await retryWithBackoff(() => {
        const command = new CopyObjectCommand({
          Bucket: this.bucket,
          CopySource: `${this.bucket}/${normalized}`,
          Key: normalized,
          Metadata: metadata,
          MetadataDirective: 'REPLACE',
        });
        return this.client.send(command);
      }, getS3RetryConfig());

      return Result.success();
    } catch (error) {
      this.logger.error(`Failed to set metadata for ${path}`, error);
      return mapS3Error(error, 'setMetadata');
    }
  }

  /**
   * Generate a presigned URL for direct access
   */
  async getPresignedUrl(
    path: string,
    operation: 'read' | 'write',
    expiresInSeconds: number
  ): Promise<OperationResult<string>> {
    const bucketError = this.ensureBucket();
    if (bucketError) return bucketError;

    const normalized = this.normalizePath(path);

    try {
      const command =
        operation === 'read'
          ? new GetObjectCommand({ Bucket: this.bucket, Key: normalized })
          : new PutObjectCommand({ Bucket: this.bucket, Key: normalized });

      // Cast to any to work around AWS SDK v3 type mismatch between S3Client and presigner
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const url = await getSignedUrl(this.client as any, command, {
        expiresIn: expiresInSeconds,
      });

      return Result.success(url);
    } catch (error) {
      this.logger.error(`Failed to generate presigned URL for ${path}`, error);
      return mapS3Error(error, 'getPresignedUrl');
    }
  }

  // ==========================================================================
  // Internal Accessors (for testing)
  // ==========================================================================

  /**
   * Get the internal S3 client (for testing)
   * @internal
   */
  getClient(): S3Client {
    return this.client;
  }

  /**
   * Get the current region
   * @internal
   */
  getRegion(): string {
    return this.currentRegion;
  }
}
