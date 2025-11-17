/**
 * S3 Adapter - AWS S3 backend integration
 * 
 * Implements the Adapter interface using AWS SDK v3 for S3 operations.
 * Handles virtual directories, prefixes, and S3-specific features.
 */

import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  CopyObjectCommand,
  HeadObjectCommand,
  GetObjectTaggingCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  ListObjectsV2CommandInput,
  _Object,
} from '@aws-sdk/client-s3';
import { Adapter, ListOptions, ListResult, OperationOptions } from './adapter.js';
import { Entry, EntryType, EntryMetadata } from '../types/entry.js';
import { generateEntryId } from '../utils/entry-id.js';
import { retryWithBackoff, getS3RetryConfig } from '../utils/retry.js';

/**
 * Configuration for S3 adapter
 */
export interface S3AdapterConfig {
  /** AWS region */
  region: string;
  /** S3 bucket name */
  bucket: string;
  /** Access key (optional - uses AWS credentials from environment) */
  accessKeyId?: string;
  /** Secret access key (optional) */
  secretAccessKey?: string;
  /** Custom S3 endpoint (for LocalStack, etc.) */
  endpoint?: string;
}

/**
 * S3 Adapter implementation
 */
export class S3Adapter implements Adapter {
  readonly name = 's3';
  private client: S3Client;
  private bucket: string;
  private prefix: string = '';

  constructor(config: S3AdapterConfig) {
    this.bucket = config.bucket;

    // Initialize S3 client
    this.client = new S3Client({
      region: config.region,
      ...(config.endpoint && { endpoint: config.endpoint }),
      ...(config.accessKeyId && {
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey || '',
        },
      }),
    });
  }

  /**
   * Normalize path to S3 prefix format
   * - Remove leading slash
   * - Ensure trailing slash for directories
   */
  private normalizePath(path: string, isDirectory: boolean = false): string {
    let normalized = path.replace(/^\//, '').replace(/\/+/g, '/');
    if (isDirectory && !normalized.endsWith('/')) {
      normalized += '/';
    }
    return normalized;
  }

  /**
   * Parse S3 object to Entry
   */
  private parseEntry(obj: _Object, prefix: string): Entry | null {
    if (!obj.Key) return null;

    // Filter out the directory marker itself
    if (obj.Key === prefix) return null;

    const relativePath = obj.Key.substring(prefix.length);
    const parts = relativePath.split('/').filter(p => p);

    if (parts.length === 0) return null;

    // Check if this is a direct child
    if (parts.length === 1) {
      // Direct file
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
    } else if (parts.length === 2 && obj.Key.endsWith('/')) {
      // Direct subdirectory
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

    return null;
  }

  /**
   * List entries at a given path
   */
  async list(path: string, options?: ListOptions): Promise<ListResult> {
    const prefix = this.normalizePath(path, true);

    const params: ListObjectsV2CommandInput = {
      Bucket: this.bucket,
      Prefix: prefix,
      Delimiter: '/',
      MaxKeys: options?.limit || 1000,
      ContinuationToken: options?.continuationToken,
    };

    try {
      const response = await retryWithBackoff(
        () => {
          const command = new ListObjectsV2Command(params);
          return this.client.send(command);
        },
        getS3RetryConfig()
      );

      const entries: Entry[] = [];

      // Process directories (common prefixes)
      if (response.CommonPrefixes) {
        for (const commonPrefix of response.CommonPrefixes) {
          if (commonPrefix.Prefix) {
            const parts = commonPrefix.Prefix.substring(prefix.length)
              .split('/')
              .filter(p => p);
            if (parts.length > 0) {
              entries.push({
                id: generateEntryId(),
                name: parts[0],
                type: EntryType.Directory,
                path: commonPrefix.Prefix,
                modified: new Date(),
              });
            }
          }
        }
      }

      // Process files
      if (response.Contents) {
        for (const obj of response.Contents) {
          const entry = this.parseEntry(obj, prefix);
          if (entry && entry.type === EntryType.File) {
            entries.push(entry);
          }
        }
      }

      // Sort: directories first, then by name
      entries.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === EntryType.Directory ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

      return {
        entries,
        continuationToken: response.NextContinuationToken,
        hasMore: response.IsTruncated ?? false,
      };
    } catch (error) {
      console.error('Failed to list S3 objects:', error);
      throw error;
    }
  }

  /**
   * Get metadata for a specific entry
   */
  async getMetadata(path: string): Promise<Entry> {
    const normalized = this.normalizePath(path);

    try {
      const response = await retryWithBackoff(
        () => {
          const command = new HeadObjectCommand({
            Bucket: this.bucket,
            Key: normalized,
          });
          return this.client.send(command);
        },
        getS3RetryConfig()
      );

      // Determine if it's a directory based on content-type
      const isDirectory = normalized.endsWith('/') ||
        response.ContentType === 'application/x-directory';

      // Fetch tags if available
      const custom: Record<string, string> = {};
      
      // Add version-id if available
      if (response.VersionId) {
        custom.versionId = response.VersionId;
      }

      // Try to fetch tags (may fail if bucket doesn't have tagging enabled)
      try {
        const tagsResponse = await retryWithBackoff(
          () => {
            const command = new GetObjectTaggingCommand({
              Bucket: this.bucket,
              Key: normalized,
              ...(response.VersionId && { VersionId: response.VersionId }),
            });
            return this.client.send(command);
          },
          getS3RetryConfig()
        );

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
        name: normalized.split('/').filter(p => p).pop() || normalized,
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
      throw error;
    }
  }

  /**
   * Upload a large file using multipart upload
   * AWS recommends multipart upload for files larger than 100MB,
   * but it can be used for files as small as 5MB
   */
  private async uploadLargeFile(
    key: string,
    body: Buffer,
    options?: OperationOptions
  ): Promise<void> {
    const PART_SIZE = 5 * 1024 * 1024; // 5MB per part
    const totalBytes = body.length;
    const parts: { ETag: string; PartNumber: number }[] = [];
    let uploadId: string | undefined;

    try {
      // Initiate multipart upload
      const createResponse = await retryWithBackoff(
        () => {
          const command = new CreateMultipartUploadCommand({
            Bucket: this.bucket,
            Key: key,
          });
          return this.client.send(command);
        },
        getS3RetryConfig()
      );

      uploadId = createResponse.UploadId;
      if (!uploadId) {
        throw new Error('Failed to initiate multipart upload');
      }

      // Upload parts
      const numParts = Math.ceil(totalBytes / PART_SIZE);
      for (let partNumber = 1; partNumber <= numParts; partNumber++) {
        const start = (partNumber - 1) * PART_SIZE;
        const end = Math.min(start + PART_SIZE, totalBytes);
        const partBody = body.subarray(start, end);

        const uploadResponse = await retryWithBackoff(
          () => {
            const command = new UploadPartCommand({
              Bucket: this.bucket,
              Key: key,
              PartNumber: partNumber,
              UploadId: uploadId,
              Body: partBody,
            });
            return this.client.send(command);
          },
          getS3RetryConfig()
        );

        if (uploadResponse.ETag) {
          parts.push({
            ETag: uploadResponse.ETag,
            PartNumber: partNumber,
          });
        }

        // Report progress
        if (options?.onProgress) {
          options.onProgress({
            operation: 'Uploading file',
            bytesTransferred: end,
            totalBytes,
            percentage: Math.round((end / totalBytes) * 100),
            currentFile: key,
          });
        }
      }

      // Complete multipart upload
      await retryWithBackoff(
        () => {
          const command = new CompleteMultipartUploadCommand({
            Bucket: this.bucket,
            Key: key,
            UploadId: uploadId,
            MultipartUpload: { Parts: parts },
          });
          return this.client.send(command);
        },
        getS3RetryConfig()
      );
    } catch (error) {
      // Abort multipart upload on error
      if (uploadId) {
        try {
          await this.client.send(
            new AbortMultipartUploadCommand({
              Bucket: this.bucket,
              Key: key,
              UploadId: uploadId,
            })
          );
        } catch (abortError) {
          console.error('Failed to abort multipart upload:', abortError);
        }
      }
      throw error;
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
        
        await retryWithBackoff(
          () => {
            const command = new PutObjectCommand({
              Bucket: this.bucket,
              Key: normalized,
              Body: '',
              ContentType: 'application/x-directory',
            });
            return this.client.send(command);
          },
          getS3RetryConfig()
        );
        
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
        const MULTIPART_THRESHOLD = 5 * 1024 * 1024; // 5MB
        
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
        if (totalBytes > MULTIPART_THRESHOLD) {
          await this.uploadLargeFile(normalized, body, options);
        } else {
          // Use regular PutObject for small files
          await retryWithBackoff(
            () => {
              const command = new PutObjectCommand({
                Bucket: this.bucket,
                Key: normalized,
                Body: body,
              });
              return this.client.send(command);
            },
            getS3RetryConfig()
          );
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
      throw error;
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
          const response = await retryWithBackoff(
            () => {
              const listCommand = new ListObjectsV2Command({
                Bucket: this.bucket,
                Prefix: prefix,
                ContinuationToken: continuationToken,
              });
              return this.client.send(listCommand);
            },
            getS3RetryConfig()
          );

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
          
          await retryWithBackoff(
            () => {
              const deleteCommand = new DeleteObjectsCommand({
                Bucket: this.bucket,
                Delete: {
                  Objects: batch,
                  Quiet: true, // Don't return list of deleted objects
                },
              });
              return this.client.send(deleteCommand);
            },
            getS3RetryConfig()
          );

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
        await retryWithBackoff(
          () => {
            const command = new DeleteObjectCommand({
              Bucket: this.bucket,
              Key: normalized,
            });
            return this.client.send(command);
          },
          getS3RetryConfig()
        );
      }
    } catch (error) {
      console.error(`Failed to delete ${path}:`, error);
      throw error;
    }
  }

  /**
   * Move/rename a file or directory
   */
  async move(source: string, destination: string, _options?: OperationOptions): Promise<void> {
    const srcNormalized = this.normalizePath(source);
    const destNormalized = this.normalizePath(
      destination,
      source.endsWith('/')
    );

    try {
      // Copy to new location
      await retryWithBackoff(
        () => {
          const copyCommand = new CopyObjectCommand({
            Bucket: this.bucket,
            CopySource: `${this.bucket}/${srcNormalized}`,
            Key: destNormalized,
          });
          return this.client.send(copyCommand);
        },
        getS3RetryConfig()
      );

      // Delete from old location
      await retryWithBackoff(
        () => {
          const deleteCommand = new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: srcNormalized,
          });
          return this.client.send(deleteCommand);
        },
        getS3RetryConfig()
      );
    } catch (error) {
      console.error(`Failed to move ${source} to ${destination}:`, error);
      throw error;
    }
  }

  /**
   * Copy a file or directory
   */
  async copy(source: string, destination: string, optionsOrBucket?: OperationOptions | string): Promise<void> {
    const srcNormalized = this.normalizePath(source);
    // Support both old targetBucket parameter and new OperationOptions
    const targetBucket = typeof optionsOrBucket === 'string' ? optionsOrBucket : undefined;
    const destBucket = targetBucket || this.bucket;
    const destNormalized = this.normalizePath(
      destination,
      source.endsWith('/')
    );

    try {
      // Check if source is a directory
      if (source.endsWith('/')) {
        // Copy directory recursively
        await this.copyDirectory(srcNormalized, destNormalized, destBucket);
      } else {
        // Copy single file
        await this.copySingleFile(srcNormalized, destNormalized, destBucket);
      }
    } catch (error) {
      console.error(`Failed to copy ${source} to ${destination}:`, error);
      throw error;
    }
  }

  /**
   * Copy a single file
   */
  private async copySingleFile(source: string, destination: string, targetBucket: string): Promise<void> {
    await retryWithBackoff(
      () => {
        const command = new CopyObjectCommand({
          Bucket: targetBucket,
          CopySource: `${this.bucket}/${source}`,
          Key: destination,
          MetadataDirective: 'COPY', // Preserve metadata
        });
        return this.client.send(command);
      },
      getS3RetryConfig()
    );
  }

  /**
   * Copy a directory recursively
   */
  private async copyDirectory(source: string, destination: string, targetBucket: string): Promise<void> {
    // List all objects in the source directory
    const response = await retryWithBackoff(
      () => {
        const command = new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: source,
        });
        return this.client.send(command);
      },
      getS3RetryConfig()
    );

    // Copy each object
    if (response.Contents) {
      for (const obj of response.Contents) {
        if (obj.Key && obj.Key !== source) { // Skip the directory marker itself
          const relativePath = obj.Key.substring(source.length);
          const destKey = destination + relativePath;
          
          await retryWithBackoff(
            () => {
              const command = new CopyObjectCommand({
                Bucket: targetBucket,
                CopySource: `${this.bucket}/${obj.Key}`,
                Key: destKey,
                MetadataDirective: 'COPY', // Preserve metadata
              });
              return this.client.send(command);
            },
            getS3RetryConfig()
          );
        }
      }
    }
  }

  /**
   * Check if a path exists
   */
  async exists(path: string): Promise<boolean> {
    const normalized = this.normalizePath(path);

    try {
      await retryWithBackoff(
        () => {
          const command = new HeadObjectCommand({
            Bucket: this.bucket,
            Key: normalized,
          });
          return this.client.send(command);
        },
        getS3RetryConfig()
      );
      return true;
    } catch (error) {
      return false;
    }
  }
}
