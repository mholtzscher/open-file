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
  CopyObjectCommand,
  HeadObjectCommand,
  ListObjectsV2CommandInput,
  _Object,
} from '@aws-sdk/client-s3';
import { Adapter, ListOptions, ListResult } from './adapter.js';
import { Entry, EntryType, EntryMetadata } from '../types/entry.js';
import { generateEntryId } from '../utils/entry-id.js';

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
      const command = new ListObjectsV2Command(params);
      const response = await this.client.send(command);

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
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: normalized,
      });

      const response = await this.client.send(command);

      // Determine if it's a directory based on content-type
      const isDirectory = normalized.endsWith('/') ||
        response.ContentType === 'application/x-directory';

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
        },
      };
    } catch (error) {
      console.error(`Failed to get metadata for ${path}:`, error);
      throw error;
    }
  }

  /**
   * Create a new file or directory
   */
  async create(
    path: string,
    type: EntryType,
    content?: Buffer | string
  ): Promise<void> {
    const normalized = this.normalizePath(path, type === EntryType.Directory);

    try {
      if (type === EntryType.Directory) {
        // Create directory marker (empty object with trailing slash)
        const command = new PutObjectCommand({
          Bucket: this.bucket,
          Key: normalized,
          Body: '',
          ContentType: 'application/x-directory',
        });
        await this.client.send(command);
      } else {
        // Create file with content
        const body = content instanceof Buffer ? content : Buffer.from(content || '');
        const command = new PutObjectCommand({
          Bucket: this.bucket,
          Key: normalized,
          Body: body,
        });
        await this.client.send(command);
      }
    } catch (error) {
      console.error(`Failed to create ${path}:`, error);
      throw error;
    }
  }

  /**
   * Delete a file or directory
   */
  async delete(path: string, recursive?: boolean): Promise<void> {
    const normalized = this.normalizePath(path);

    try {
      if (recursive) {
        // Delete directory and all contents
        const prefix = normalized.endsWith('/') ? normalized : normalized + '/';
        const listCommand = new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
        });

        const response = await this.client.send(listCommand);

        // Delete all objects in the directory
        if (response.Contents) {
          for (const obj of response.Contents) {
            if (obj.Key) {
              const deleteCommand = new DeleteObjectCommand({
                Bucket: this.bucket,
                Key: obj.Key,
              });
              await this.client.send(deleteCommand);
            }
          }
        }
      }

      // Delete the object itself
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: normalized,
      });
      await this.client.send(command);
    } catch (error) {
      console.error(`Failed to delete ${path}:`, error);
      throw error;
    }
  }

  /**
   * Move/rename a file or directory
   */
  async move(source: string, destination: string): Promise<void> {
    const srcNormalized = this.normalizePath(source);
    const destNormalized = this.normalizePath(
      destination,
      source.endsWith('/')
    );

    try {
      // Copy to new location
      const copyCommand = new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${srcNormalized}`,
        Key: destNormalized,
      });
      await this.client.send(copyCommand);

      // Delete from old location
      const deleteCommand = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: srcNormalized,
      });
      await this.client.send(deleteCommand);
    } catch (error) {
      console.error(`Failed to move ${source} to ${destination}:`, error);
      throw error;
    }
  }

  /**
   * Copy a file or directory
   */
  async copy(source: string, destination: string): Promise<void> {
    const srcNormalized = this.normalizePath(source);
    const destNormalized = this.normalizePath(
      destination,
      source.endsWith('/')
    );

    try {
      const command = new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${srcNormalized}`,
        Key: destNormalized,
      });
      await this.client.send(command);
    } catch (error) {
      console.error(`Failed to copy ${source} to ${destination}:`, error);
      throw error;
    }
  }

  /**
   * Check if a path exists
   */
  async exists(path: string): Promise<boolean> {
    const normalized = this.normalizePath(path);

    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: normalized,
      });
      await this.client.send(command);
      return true;
    } catch (error) {
      return false;
    }
  }
}
