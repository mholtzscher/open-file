/**
 * S3 Adapter - AWS S3 backend integration
 *
 * Implements the Adapter interface using AWS SDK v3 for S3 operations.
 * Handles virtual directories, prefixes, and S3-specific features.
 */

import {
  S3Client,
  ListObjectsV2Command,
  ListBucketsCommand,
  GetBucketLocationCommand,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  CopyObjectCommand,
  HeadObjectCommand,
  GetObjectTaggingCommand,
  ListObjectsV2CommandInput,
} from '@aws-sdk/client-s3';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { Adapter, ListOptions, ListResult, OperationOptions } from './adapter.js';
import { Entry, EntryType } from '../types/entry.js';
import { generateEntryId } from '../utils/entry-id.js';
import { retryWithBackoff, getS3RetryConfig } from '../utils/retry.js';
import { parseAwsError } from '../utils/errors.js';
import { getLogger } from '../utils/logger.js';
import { createS3Client, createS3ClientWithRegion, S3ClientOptions } from './s3/client-factory.js';
import {
  uploadLargeFile,
  shouldUseMultipartUpload,
  MULTIPART_THRESHOLD,
} from './s3/multipart-upload.js';
import { normalizeS3Path, getS3KeyName } from './s3/path-utils.js';
import {
  parseS3ObjectToEntry,
  parseCommonPrefixToEntry,
  parseBucketToEntry,
  sortEntries,
} from './s3/entry-parser.js';
// Re-export BucketInfo type for backwards compatibility
export type { BucketInfo } from './s3/entry-parser.js';

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
 * S3 Adapter implementation
 */
export class S3Adapter implements Adapter {
  readonly name = 's3';
  private client: S3Client;
  private bucket?: string;
  private prefix: string = '';
  private currentRegion: string;
  private clientOptions: S3ClientOptions;

  constructor(config: S3AdapterConfig) {
    const logger = getLogger();
    this.bucket = config.bucket;

    logger.debug('S3Adapter constructor called', {
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
    const { client, region } = createS3Client(this.clientOptions);
    this.client = client;
    this.currentRegion = region;

    logger.info('S3Adapter initialized', {
      bucket: this.bucket,
      region: this.currentRegion,
      profile: config.profile,
    });
  }

  /**
   * Set the bucket to operate on (for bucket selection from root view)
   */
  setBucket(bucketName: string): void {
    const logger = getLogger();
    this.bucket = bucketName;
    logger.debug('S3Adapter bucket changed', { bucket: bucketName });
  }

  /**
   * Set the region and reinitialize S3Client if needed (for bucket selection from root view)
   */
  setRegion(region: string): void {
    const logger = getLogger();
    if (region !== this.currentRegion) {
      logger.debug('S3Adapter region changed', {
        oldRegion: this.currentRegion,
        newRegion: region,
      });
      this.currentRegion = region;
      // Reinitialize S3Client with new region using factory
      const { client } = createS3ClientWithRegion(this.clientOptions, region);
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
    const bucket = this.bucket;
    const logger = getLogger();
    const prefix = this.normalizePath(path, true);

    const params: ListObjectsV2CommandInput = {
      Bucket: bucket,
      Prefix: prefix,
      Delimiter: '/',
      MaxKeys: options?.limit || 1000,
      ContinuationToken: options?.continuationToken,
    };

    logger.debug('S3Adapter.list called', {
      bucket: this.bucket,
      path,
      prefix,
      delimiter: '/',
      limit: options?.limit,
      hasContinuationToken: !!options?.continuationToken,
    });

    try {
      logger.debug('Sending ListObjectsV2Command', params);

      const response = await retryWithBackoff(() => {
        logger.debug('Executing ListObjectsV2Command...');
        const command = new ListObjectsV2Command(params);
        return this.client.send(command);
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
    } catch (error) {
      logger.error('Failed to list S3 objects', error);
      const parsedError = parseAwsError(error, 'list');
      logger.error('Parsed error', {
        code: (error as any)?.Code,
        message: (error as any)?.message,
        statusCode: (error as any)?.$metadata?.httpStatusCode,
      });
      throw parsedError;
    }
  }

  /**
   * List all S3 buckets in the account with metadata
   */
  async listBuckets(): Promise<BucketInfo[]> {
    const logger = getLogger();

    try {
      logger.debug('S3Adapter.listBuckets called');

      const response = await retryWithBackoff(() => {
        const command = new ListBucketsCommand({});
        return this.client.send(command);
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
                return this.client.send(command);
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
    } catch (error) {
      logger.error('Failed to list S3 buckets', error);
      const parsedError = parseAwsError(error, 'listBuckets');
      throw parsedError;
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
      console.error(`Failed to get metadata for ${path}:`, error);
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
      console.error(`Failed to create ${path}:`, error);
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
        const objectsToDelete: { Key: string }[] = [];

        // List all objects with pagination
        let continuationToken: string | undefined;
        do {
          const response = await retryWithBackoff(() => {
            const listCommand = new ListObjectsV2Command({
              Bucket: this.bucket,
              Prefix: prefix,
              ContinuationToken: continuationToken,
            });
            return this.client.send(listCommand);
          }, getS3RetryConfig());

          // Collect objects to delete
          if (response.Contents) {
            for (const obj of response.Contents) {
              if (obj.Key) {
                objectsToDelete.push({ Key: obj.Key });
              }
            }
          }

          continuationToken = response.NextContinuationToken;
        } while (continuationToken);

        // Batch delete objects (max 1000 per request)
        const BATCH_SIZE = 1000;
        for (let i = 0; i < objectsToDelete.length; i += BATCH_SIZE) {
          const batch = objectsToDelete.slice(i, i + BATCH_SIZE);

          await retryWithBackoff(() => {
            const deleteCommand = new DeleteObjectsCommand({
              Bucket: this.bucket,
              Delete: {
                Objects: batch,
                Quiet: true, // Don't return list of deleted objects
              },
            });
            return this.client.send(deleteCommand);
          }, getS3RetryConfig());

          // Report progress
          if (options?.onProgress) {
            const deletedCount = Math.min(i + BATCH_SIZE, objectsToDelete.length);
            options.onProgress({
              operation: 'Deleting objects',
              bytesTransferred: deletedCount,
              totalBytes: objectsToDelete.length,
              percentage: Math.round((deletedCount / objectsToDelete.length) * 100),
              currentFile: path,
            });
          }
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
    } catch (error) {
      console.error(`Failed to delete ${path}:`, error);
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
      console.error(`Failed to move ${source} to ${destination}:`, error);
      throw parseAwsError(error, 'move');
    }
  }

  /**
   * Move a single file (copy + delete)
   */
  private async moveSingleFile(source: string, destination: string): Promise<void> {
    // Copy to new location with metadata preservation
    await retryWithBackoff(() => {
      const copyCommand = new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${source}`,
        Key: destination,
        MetadataDirective: 'COPY', // Preserve metadata
      });
      return this.client.send(copyCommand);
    }, getS3RetryConfig());

    // Delete from old location
    await retryWithBackoff(() => {
      const deleteCommand = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: source,
      });
      return this.client.send(deleteCommand);
    }, getS3RetryConfig());
  }

  /**
   * Move a directory recursively
   */
  private async moveDirectory(
    source: string,
    destination: string,
    options?: OperationOptions
  ): Promise<void> {
    const objectsToMove: string[] = [];

    // List all objects with pagination
    let continuationToken: string | undefined;
    do {
      const response = await retryWithBackoff(() => {
        const listCommand = new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: source,
          ContinuationToken: continuationToken,
        });
        return this.client.send(listCommand);
      }, getS3RetryConfig());

      // Collect objects to move
      if (response.Contents) {
        for (const obj of response.Contents) {
          if (obj.Key) {
            objectsToMove.push(obj.Key);
          }
        }
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    // Move each object
    for (let i = 0; i < objectsToMove.length; i++) {
      const srcKey = objectsToMove[i];
      const relativePath = srcKey.substring(source.length);
      const destKey = destination + relativePath;

      // Copy object
      await retryWithBackoff(() => {
        const copyCommand = new CopyObjectCommand({
          Bucket: this.bucket,
          CopySource: `${this.bucket}/${srcKey}`,
          Key: destKey,
          MetadataDirective: 'COPY', // Preserve metadata
        });
        return this.client.send(copyCommand);
      }, getS3RetryConfig());

      // Delete original
      await retryWithBackoff(() => {
        const deleteCommand = new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: srcKey,
        });
        return this.client.send(deleteCommand);
      }, getS3RetryConfig());

      // Report progress
      if (options?.onProgress) {
        options.onProgress({
          operation: 'Moving objects',
          bytesTransferred: i + 1,
          totalBytes: objectsToMove.length,
          percentage: Math.round(((i + 1) / objectsToMove.length) * 100),
          currentFile: srcKey,
        });
      }
    }
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
      console.error(`Failed to copy ${source} to ${destination}:`, error);
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
    await retryWithBackoff(() => {
      const command = new CopyObjectCommand({
        Bucket: targetBucket,
        CopySource: `${this.bucket}/${source}`,
        Key: destination,
        MetadataDirective: 'COPY', // Preserve metadata
      });
      return this.client.send(command);
    }, getS3RetryConfig());
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
    const objectsToCopy: string[] = [];

    // List all objects with pagination
    let continuationToken: string | undefined;
    do {
      const response = await retryWithBackoff(() => {
        const command = new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: source,
          ContinuationToken: continuationToken,
        });
        return this.client.send(command);
      }, getS3RetryConfig());

      // Collect objects to copy
      if (response.Contents) {
        for (const obj of response.Contents) {
          if (obj.Key && obj.Key !== source) {
            // Skip the directory marker itself
            objectsToCopy.push(obj.Key);
          }
        }
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    // Copy each object
    for (let i = 0; i < objectsToCopy.length; i++) {
      const srcKey = objectsToCopy[i];
      const relativePath = srcKey.substring(source.length);
      const destKey = destination + relativePath;

      await retryWithBackoff(() => {
        const command = new CopyObjectCommand({
          Bucket: targetBucket,
          CopySource: `${this.bucket}/${srcKey}`,
          Key: destKey,
          MetadataDirective: 'COPY', // Preserve metadata
        });
        return this.client.send(command);
      }, getS3RetryConfig());

      // Report progress
      if (options?.onProgress) {
        options.onProgress({
          operation: 'Copying objects',
          bytesTransferred: i + 1,
          totalBytes: objectsToCopy.length,
          percentage: Math.round(((i + 1) / objectsToCopy.length) * 100),
          currentFile: srcKey,
        });
      }
    }
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
    const logger = getLogger();

    try {
      // First, get the file size via HeadObject
      const headResponse = await retryWithBackoff(() => {
        const command = new HeadObjectCommand({
          Bucket: this.bucket,
          Key: normalized,
        });
        return this.client.send(command);
      }, getS3RetryConfig());

      const totalBytes = headResponse.ContentLength || 0;

      // Report initial progress
      if (options?.onProgress) {
        options.onProgress({
          operation: 'Downloading file',
          bytesTransferred: 0,
          totalBytes,
          percentage: 0,
          currentFile: normalized,
        });
      }

      // Download the file
      const getResponse = await retryWithBackoff(() => {
        const command = new GetObjectCommand({
          Bucket: this.bucket,
          Key: normalized,
        });
        return this.client.send(command);
      }, getS3RetryConfig());

      // Convert stream to buffer
      if (!getResponse.Body) {
        throw new Error('No body in response');
      }

      const chunks: Uint8Array[] = [];
      let bytesTransferred = 0;

      // Handle both stream and Blob body types
      if (getResponse.Body instanceof Buffer) {
        // Direct buffer
        bytesTransferred = getResponse.Body.length;
        chunks.push(getResponse.Body);
      } else if (typeof getResponse.Body === 'object' && 'getReader' in getResponse.Body) {
        // ReadableStream or similar with getReader
        const reader = (
          getResponse.Body as any as {
            getReader(): { read(): Promise<{ done: boolean; value?: Uint8Array }> };
          }
        ).getReader();
        let done = false;
        while (!done) {
          const { done: isDone, value } = await reader.read();
          done = isDone;
          if (value) {
            chunks.push(value);
            bytesTransferred += value.length;

            // Report progress
            if (options?.onProgress) {
              options.onProgress({
                operation: 'Downloading file',
                bytesTransferred,
                totalBytes,
                percentage: totalBytes > 0 ? Math.round((bytesTransferred / totalBytes) * 100) : 0,
                currentFile: normalized,
              });
            }
          }
        }
      } else if (typeof getResponse.Body === 'object' && 'on' in getResponse.Body) {
        // Node.js stream
        const stream = getResponse.Body as any;
        await new Promise<void>((resolve, reject) => {
          stream.on('data', (chunk: Uint8Array) => {
            chunks.push(chunk);
            bytesTransferred += chunk.length;

            // Report progress
            if (options?.onProgress) {
              options.onProgress({
                operation: 'Downloading file',
                bytesTransferred,
                totalBytes,
                percentage: totalBytes > 0 ? Math.round((bytesTransferred / totalBytes) * 100) : 0,
                currentFile: normalized,
              });
            }
          });
          stream.on('end', () => resolve());
          stream.on('error', reject);
        });
      } else {
        // Try to use as buffer-like object
        const bodyBuffer = Buffer.from(await (getResponse.Body as any));
        chunks.push(bodyBuffer);
        bytesTransferred = bodyBuffer.length;
      }

      // Report completion
      if (options?.onProgress) {
        options.onProgress({
          operation: 'Downloaded file',
          bytesTransferred,
          totalBytes,
          percentage: 100,
          currentFile: normalized,
        });
      }

      // Combine chunks into single buffer
      return Buffer.concat(chunks);
    } catch (error) {
      logger.error('Failed to read file from S3', error);
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
    const logger = getLogger();
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
      logger.error(`Failed to download ${s3Path} to ${localPath}`, error);
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
    // Ensure parent directory exists
    const parentDir = dirname(localPath);
    await fs.mkdir(parentDir, { recursive: true });

    // Download the file
    const fileBuffer = await this.read(s3Key, options);

    // Write to local filesystem
    await fs.writeFile(localPath, fileBuffer);
  }

  /**
   * Download S3 directory to local filesystem recursively
   */
  private async downloadDirectoryToLocal(
    s3Prefix: string,
    localPath: string,
    options?: OperationOptions
  ): Promise<void> {
    const objectsToDownload: string[] = [];
    let continuationToken: string | undefined;
    let totalObjects = 0;

    // List all objects in the directory
    do {
      const response = await retryWithBackoff(() => {
        const command = new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: s3Prefix,
          ContinuationToken: continuationToken,
        });
        return this.client.send(command);
      }, getS3RetryConfig());

      if (response.Contents) {
        for (const obj of response.Contents) {
          if (obj.Key && obj.Key !== s3Prefix && !obj.Key.endsWith('/')) {
            objectsToDownload.push(obj.Key);
            totalObjects++;
          }
        }
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    // Download each file
    for (let i = 0; i < objectsToDownload.length; i++) {
      const s3Key = objectsToDownload[i];
      const relativePath = s3Key.substring(s3Prefix.length);
      const localFilePath = join(localPath, relativePath);

      // Ensure parent directory exists
      const parentDir = dirname(localFilePath);
      await fs.mkdir(parentDir, { recursive: true });

      // Download the file
      const fileBuffer = await this.read(s3Key, options);
      await fs.writeFile(localFilePath, fileBuffer);

      // Report progress
      if (options?.onProgress) {
        options.onProgress({
          operation: 'Downloading directory',
          bytesTransferred: i + 1,
          totalBytes: totalObjects,
          percentage: Math.round(((i + 1) / totalObjects) * 100),
          currentFile: s3Key,
        });
      }
    }
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
    const logger = getLogger();

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
      logger.error(`Failed to upload ${localPath} to ${s3Path}`, error);
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
    // Read the file
    const fileBuffer = await fs.readFile(localPath);
    const totalBytes = fileBuffer.length;

    if (options?.onProgress) {
      options.onProgress({
        operation: 'Uploading file',
        bytesTransferred: 0,
        totalBytes,
        percentage: 0,
        currentFile: s3Key,
      });
    }

    // Use multipart upload for large files
    if (shouldUseMultipartUpload(totalBytes)) {
      await uploadLargeFile(this.client, this.bucket!, s3Key, fileBuffer, options);
    } else {
      // Use regular PutObject for small files
      await retryWithBackoff(() => {
        const command = new PutObjectCommand({
          Bucket: this.bucket,
          Key: s3Key,
          Body: fileBuffer,
        });
        return this.client.send(command);
      }, getS3RetryConfig());
    }

    if (options?.onProgress) {
      options.onProgress({
        operation: 'Uploaded file',
        bytesTransferred: totalBytes,
        totalBytes,
        percentage: 100,
        currentFile: s3Key,
      });
    }
  }

  /**
   * Upload local directory to S3 recursively
   */
  private async uploadDirectoryToS3(
    localPath: string,
    s3Prefix: string,
    options?: OperationOptions
  ): Promise<void> {
    const filesToUpload: { localPath: string; s3Key: string }[] = [];

    // Recursively collect all files
    const collectFiles = async (dir: string, prefix: string) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        const s3Key = prefix + entry.name;

        if (entry.isDirectory()) {
          // Recursively collect from subdirectory
          await collectFiles(fullPath, s3Key + '/');
        } else if (entry.isFile()) {
          filesToUpload.push({ localPath: fullPath, s3Key });
        }
      }
    };

    // Collect all files
    await collectFiles(localPath, s3Prefix);

    // Upload each file
    for (let i = 0; i < filesToUpload.length; i++) {
      const { localPath: filePath, s3Key } = filesToUpload[i];
      await this.uploadSingleFileToS3(filePath, s3Key, options);

      // Report progress
      if (options?.onProgress) {
        options.onProgress({
          operation: 'Uploading directory',
          bytesTransferred: i + 1,
          totalBytes: filesToUpload.length,
          percentage: Math.round(((i + 1) / filesToUpload.length) * 100),
          currentFile: s3Key,
        });
      }
    }
  }
}
