/**
 * GCSProvider - Google Cloud Storage Provider Implementation
 *
 * Implements the StorageProvider interface using @google-cloud/storage SDK.
 * Supports service account authentication and Application Default Credentials.
 */

import { Storage, Bucket, File, DownloadOptions } from '@google-cloud/storage';
import type { GCSProfile } from '../types/profile.js';
import { BaseStorageProvider } from '../base-provider.js';
import { Capability } from '../types/capabilities.js';
import { OperationResult, Result } from '../types/result.js';
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
import { getLogger } from '../../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Logger interface for dependency injection
 */
export interface GCSProviderLogger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, error?: unknown): void;
}

/**
 * Dependencies that can be injected into GCSProvider
 */
export interface GCSProviderDependencies {
  /** Logger instance (defaults to getLogger()) */
  logger?: GCSProviderLogger;
  /** Pre-configured Storage client (for testing) */
  storageClient?: Storage;
}

// ============================================================================
// Error Mapping
// ============================================================================

/**
 * Map GCS error codes to OperationResult status codes
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapGCSError(error: unknown, operation: string): OperationResult<any> {
  const err = error as {
    code?: number | string;
    message?: string;
    errors?: Array<{ reason?: string; message?: string }>;
  };

  const errorCode = err.code;
  const message = err.message || `GCS ${operation} failed`;

  // Map specific GCS/HTTP error codes
  switch (errorCode) {
    case 404:
    case 'NOT_FOUND':
      return Result.notFound(message);

    case 403:
    case 'FORBIDDEN':
    case 'PERMISSION_DENIED':
      return Result.permissionDenied(message);

    case 401:
    case 'UNAUTHENTICATED':
      return Result.permissionDenied('Authentication failed: ' + message);

    case 408:
    case 'DEADLINE_EXCEEDED':
    case 503:
    case 'UNAVAILABLE':
      return Result.connectionFailed(message);

    case 409:
    case 'ALREADY_EXISTS':
      return Result.error('ALREADY_EXISTS', message, false, error);

    case 429:
    case 'RESOURCE_EXHAUSTED':
      return Result.error('RATE_LIMITED', message, true, error);

    default:
      return Result.error(String(errorCode || 'UNKNOWN'), message, false, error);
  }
}

// ============================================================================
// GCSProvider Implementation
// ============================================================================

/**
 * GCSProvider - Storage provider implementation for Google Cloud Storage
 *
 * Supports:
 * - Full CRUD operations on GCS objects
 * - Virtual directory support (prefixes with delimiters)
 * - Bucket listing and selection
 * - Server-side copy operations
 * - Presigned URL generation (signed URLs)
 * - Custom metadata
 * - Object versioning (when bucket versioning is enabled)
 */
export class GCSProvider extends BaseStorageProvider {
  readonly name = 'gcs';
  readonly displayName = 'Google Cloud Storage';

  private storage: Storage;
  private bucket?: Bucket;
  private bucketName?: string;
  private readonly projectId?: string;
  private readonly logger: GCSProviderLogger;

  constructor(profile: GCSProfile, dependencies?: GCSProviderDependencies) {
    super();

    // Initialize dependencies with defaults
    this.logger = dependencies?.logger ?? getLogger();

    // Set up capabilities
    // GCS supports all major storage operations
    this.addCapability(
      Capability.List,
      Capability.Read,
      Capability.Write,
      Capability.Delete,
      Capability.Mkdir,
      Capability.Copy,
      Capability.Move,
      Capability.ServerSideCopy,
      Capability.Download,
      Capability.Upload,
      Capability.Versioning,
      Capability.Metadata,
      Capability.PresignedUrls,
      Capability.BatchDelete,
      Capability.Containers
    );

    this.logger.debug('GCSProvider constructor called', {
      profileId: profile.id,
      projectId: profile.config.projectId,
      hasKeyFile: !!profile.config.keyFilePath,
      useADC: profile.config.useApplicationDefault,
      apiEndpoint: profile.config.apiEndpoint,
    });

    this.projectId = profile.config.projectId;

    // Use injected client or create new one
    if (dependencies?.storageClient) {
      this.storage = dependencies.storageClient;
    } else {
      // Configure authentication
      const storageOptions: ConstructorParameters<typeof Storage>[0] = {};

      if (profile.config.projectId) {
        storageOptions.projectId = profile.config.projectId;
      }

      if (profile.config.keyFilePath) {
        // Service account authentication
        storageOptions.keyFilename = profile.config.keyFilePath;
      }

      // Custom endpoint for emulators (e.g., fake-gcs-server)
      if (profile.config.apiEndpoint) {
        storageOptions.apiEndpoint = profile.config.apiEndpoint;
      }
      // If useApplicationDefault is true or no explicit auth, SDK uses ADC automatically

      this.storage = new Storage(storageOptions);
    }

    this.logger.info('GCSProvider initialized', {
      profileId: profile.id,
      projectId: this.projectId,
    });
  }

  // ==========================================================================
  // Container Operations (Bucket Management)
  // ==========================================================================

  /**
   * List all GCS buckets in the project
   */
  async listContainers(): Promise<OperationResult<Entry[]>> {
    try {
      const [buckets] = await this.storage.getBuckets();

      const entries: Entry[] = buckets.map(bucket => ({
        id: generateEntryId(),
        name: bucket.name || 'unknown',
        type: EntryType.Bucket,
        path: bucket.name || '',
        metadata: {
          storageClass: bucket.metadata?.storageClass,
          location: bucket.metadata?.location,
          locationType: bucket.metadata?.locationType,
        },
      }));

      return Result.success(entries);
    } catch (error) {
      this.logger.error('Failed to list GCS buckets', error);
      return mapGCSError(error, 'listContainers');
    }
  }

  /**
   * Set the current bucket context
   */
  setContainer(bucketName: string): void {
    this.bucketName = bucketName;
    this.bucket = this.storage.bucket(bucketName);
    this.logger.debug('GCSProvider bucket changed', { bucket: bucketName });
  }

  /**
   * Get the current bucket context
   */
  getContainer(): string | undefined {
    return this.bucketName;
  }

  // ==========================================================================
  // Path Utilities
  // ==========================================================================

  /**
   * Normalize path to GCS prefix format
   * - Removes leading slash
   * - Optionally ensures trailing slash for directories
   */
  private normalizePath(path: string, isDirectory: boolean = false): string {
    let normalized = path.replace(/^\/+/, '');
    if (isDirectory && normalized && !normalized.endsWith('/')) {
      normalized += '/';
    }
    return normalized;
  }

  /**
   * Extract name from a GCS object key
   */
  private getKeyName(key: string): string {
    const trimmed = key.endsWith('/') ? key.slice(0, -1) : key;
    const parts = trimmed.split('/');
    return parts[parts.length - 1] || trimmed;
  }

  /**
   * Ensure bucket is configured before operations
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private ensureBucket(): OperationResult<any> | null {
    if (!this.bucket || !this.bucketName) {
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
      const prefix = this.normalizePath(path, true);
      // Handle root path
      const effectivePrefix = prefix === '/' ? '' : prefix;

      const [files, , apiResponse] = await this.bucket!.getFiles({
        prefix: effectivePrefix,
        delimiter: options?.recursive ? undefined : '/',
        maxResults: options?.limit,
        pageToken: options?.continuationToken,
        autoPaginate: false,
      });

      const entries: Entry[] = [];

      // Add directories from prefixes (CommonPrefixes equivalent)
      const prefixes = (apiResponse as { prefixes?: string[] })?.prefixes || [];
      for (const dirPrefix of prefixes) {
        entries.push({
          id: generateEntryId(),
          name: this.getKeyName(dirPrefix),
          type: EntryType.Directory,
          path: dirPrefix,
        });
      }

      // Add files
      for (const file of files) {
        // Skip the directory marker itself
        if (file.name === effectivePrefix) continue;

        const isDirectory = file.name.endsWith('/');
        entries.push({
          id: generateEntryId(),
          name: this.getKeyName(file.name),
          type: isDirectory ? EntryType.Directory : EntryType.File,
          path: file.name,
          size: isDirectory ? undefined : parseInt(String(file.metadata?.size || '0'), 10),
          modified: file.metadata?.updated ? new Date(file.metadata.updated) : undefined,
          metadata: {
            contentType: file.metadata?.contentType,
            etag: file.metadata?.etag,
            storageClass: file.metadata?.storageClass,
            ...(file.metadata?.generation && {
              custom: { generation: String(file.metadata.generation) },
            }),
          },
        });
      }

      const nextPageToken = (apiResponse as { nextPageToken?: string })?.nextPageToken;

      return Result.success({
        entries,
        hasMore: !!nextPageToken,
        continuationToken: nextPageToken,
      });
    } catch (error) {
      this.logger.error('Failed to list GCS objects', error);
      return mapGCSError(error, 'list');
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
      const file = this.bucket!.file(normalized);
      const [metadata] = await file.getMetadata();

      const isDirectory =
        normalized.endsWith('/') || metadata.contentType === 'application/x-directory';

      const custom: Record<string, string> = {};
      if (metadata.generation) {
        custom.generation = String(metadata.generation);
      }
      if (metadata.metadata) {
        // Copy all string values from metadata
        for (const [key, value] of Object.entries(metadata.metadata)) {
          if (typeof value === 'string') {
            custom[key] = value;
          }
        }
      }

      return Result.success({
        id: generateEntryId(),
        name: this.getKeyName(normalized),
        type: isDirectory ? EntryType.Directory : EntryType.File,
        path: normalized,
        size: metadata.size ? parseInt(String(metadata.size), 10) : undefined,
        modified: metadata.updated ? new Date(metadata.updated) : undefined,
        metadata: {
          contentType: metadata.contentType,
          etag: metadata.etag,
          storageClass: metadata.storageClass,
          ...(Object.keys(custom).length > 0 && { custom }),
        },
      });
    } catch (error) {
      this.logger.error(`Failed to get metadata for ${path}`, error);
      return mapGCSError(error, 'getMetadata');
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
      const file = this.bucket!.file(normalized);
      const [exists] = await file.exists();
      return Result.success(exists);
    } catch (error) {
      this.logger.error(`Failed to check existence of ${path}`, error);
      return mapGCSError(error, 'exists');
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
      const file = this.bucket!.file(normalized);

      // Build download options
      const downloadOptions: DownloadOptions = {};

      if (options?.offset !== undefined || options?.length !== undefined) {
        const start = options.offset || 0;
        const end = options.length !== undefined ? start + options.length - 1 : undefined;
        downloadOptions.start = start;
        if (end !== undefined) {
          downloadOptions.end = end;
        }
      }

      const [contents] = await file.download(downloadOptions);

      return Result.success(contents);
    } catch (error) {
      this.logger.error(`Failed to read ${path}`, error);
      return mapGCSError(error, 'read');
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

    try {
      const file = this.bucket!.file(normalized);

      const saveOptions: Parameters<File['save']>[1] = {};

      if (options?.contentType) {
        saveOptions.contentType = options.contentType;
      }
      if (options?.metadata) {
        saveOptions.metadata = { metadata: options.metadata };
      }

      await file.save(body, saveOptions);

      return Result.success();
    } catch (error) {
      this.logger.error(`Failed to write ${path}`, error);
      return mapGCSError(error, 'write');
    }
  }

  /**
   * Create a directory (GCS directory marker)
   */
  async mkdir(path: string): Promise<OperationResult> {
    const bucketError = this.ensureBucket();
    if (bucketError) return bucketError;

    const normalized = this.normalizePath(path, true);

    try {
      const file = this.bucket!.file(normalized);

      await file.save('', {
        contentType: 'application/x-directory',
      });

      return Result.success();
    } catch (error) {
      this.logger.error(`Failed to create directory ${path}`, error);
      return mapGCSError(error, 'mkdir');
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
        // Delete directory and all contents
        const prefix = normalized.endsWith('/') ? normalized : normalized + '/';

        // List all objects with this prefix
        const [files] = await this.bucket!.getFiles({ prefix });

        if (files.length > 0) {
          // Delete in batches
          const batchSize = 100;
          for (let i = 0; i < files.length; i += batchSize) {
            const batch = files.slice(i, i + batchSize);
            await Promise.all(batch.map(file => file.delete()));

            if (options?.onProgress) {
              options.onProgress({
                operation: 'delete',
                bytesTransferred: Math.min(i + batchSize, files.length),
                totalBytes: files.length,
                percentage: Math.round(
                  (Math.min(i + batchSize, files.length) / files.length) * 100
                ),
                currentFile: path,
              });
            }
          }
        }
      } else {
        // Delete single object
        const file = this.bucket!.file(normalized);
        await file.delete();
      }

      return Result.success();
    } catch (error) {
      this.logger.error(`Failed to delete ${path}`, error);
      return mapGCSError(error, 'delete');
    }
  }

  // ==========================================================================
  // Move/Copy Operations (Native GCS Implementation)
  // ==========================================================================

  /**
   * Native copy implementation using GCS server-side copy
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
        // Copy all objects with the prefix
        const srcPrefix = srcNormalized.endsWith('/') ? srcNormalized : srcNormalized + '/';
        const [files] = await this.bucket!.getFiles({ prefix: srcPrefix });

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const relativePath = file.name.slice(srcPrefix.length);
          const destKey = destNormalized + relativePath;

          await file.copy(this.bucket!.file(destKey));

          if (options?.onProgress) {
            options.onProgress({
              operation: 'copy',
              bytesTransferred: i + 1,
              totalBytes: files.length,
              percentage: Math.round(((i + 1) / files.length) * 100),
              currentFile: file.name,
            });
          }
        }
      } else {
        const srcFile = this.bucket!.file(srcNormalized);
        await srcFile.copy(this.bucket!.file(destNormalized));
      }

      return Result.success();
    } catch (error) {
      this.logger.error(`Failed to copy ${source} to ${dest}`, error);
      return mapGCSError(error, 'copy');
    }
  }

  /**
   * Native move implementation using GCS copy + delete
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
        // Move all objects with the prefix (copy + delete)
        const srcPrefix = srcNormalized.endsWith('/') ? srcNormalized : srcNormalized + '/';
        const [files] = await this.bucket!.getFiles({ prefix: srcPrefix });

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const relativePath = file.name.slice(srcPrefix.length);
          const destKey = destNormalized + relativePath;

          await file.move(this.bucket!.file(destKey));

          if (options?.onProgress) {
            options.onProgress({
              operation: 'move',
              bytesTransferred: i + 1,
              totalBytes: files.length,
              percentage: Math.round(((i + 1) / files.length) * 100),
              currentFile: file.name,
            });
          }
        }
      } else {
        const srcFile = this.bucket!.file(srcNormalized);
        await srcFile.move(this.bucket!.file(destNormalized));
      }

      return Result.success();
    } catch (error) {
      this.logger.error(`Failed to move ${source} to ${dest}`, error);
      return mapGCSError(error, 'move');
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

    const normalized = this.normalizePath(remotePath);

    try {
      if (options?.recursive && remotePath.endsWith('/')) {
        // Download directory
        const { promises: fs } = await import('fs');
        const pathModule = await import('path');

        const prefix = normalized.endsWith('/') ? normalized : normalized + '/';
        const [files] = await this.bucket!.getFiles({ prefix });

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const relativePath = file.name.slice(prefix.length);
          const destPath = pathModule.join(localPath, relativePath);

          // Ensure parent directory exists
          await fs.mkdir(pathModule.dirname(destPath), { recursive: true });

          // Skip directory markers
          if (!file.name.endsWith('/')) {
            await file.download({ destination: destPath });
          }

          if (options?.onProgress) {
            options.onProgress({
              operation: 'download',
              bytesTransferred: i + 1,
              totalBytes: files.length,
              percentage: Math.round(((i + 1) / files.length) * 100),
              currentFile: file.name,
            });
          }
        }
      } else {
        const file = this.bucket!.file(normalized);
        await file.download({ destination: localPath });
      }

      return Result.success();
    } catch (error) {
      this.logger.error(`Failed to download ${remotePath} to ${localPath}`, error);
      return mapGCSError(error, 'download');
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
      const { promises: fs, statSync } = await import('fs');
      const pathModule = await import('path');

      const stats = statSync(localPath);

      if (stats.isDirectory() && options?.recursive) {
        // Upload directory recursively
        const normalized = this.normalizePath(remotePath, true);

        // Get all files in directory
        const getAllFiles = async (dir: string): Promise<string[]> => {
          const entries = await fs.readdir(dir, { withFileTypes: true });
          const files: string[] = [];

          for (const entry of entries) {
            const fullPath = pathModule.join(dir, entry.name);
            if (entry.isDirectory()) {
              files.push(...(await getAllFiles(fullPath)));
            } else {
              files.push(fullPath);
            }
          }

          return files;
        };

        const files = await getAllFiles(localPath);

        for (let i = 0; i < files.length; i++) {
          const filePath = files[i];
          const relativePath = pathModule.relative(localPath, filePath);
          const destKey = normalized + relativePath.replace(/\\/g, '/');

          await this.bucket!.upload(filePath, { destination: destKey });

          if (options?.onProgress) {
            options.onProgress({
              operation: 'upload',
              bytesTransferred: i + 1,
              totalBytes: files.length,
              percentage: Math.round(((i + 1) / files.length) * 100),
              currentFile: filePath,
            });
          }
        }
      } else if (stats.isFile()) {
        const normalized = this.normalizePath(remotePath, false);
        await this.bucket!.upload(localPath, { destination: normalized });
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
      return mapGCSError(error, 'upload');
    }
  }

  // ==========================================================================
  // Advanced Operations
  // ==========================================================================

  /**
   * Set custom metadata on a file
   */
  async setMetadata(path: string, metadata: Record<string, string>): Promise<OperationResult> {
    const bucketError = this.ensureBucket();
    if (bucketError) return bucketError;

    const normalized = this.normalizePath(path);

    try {
      const file = this.bucket!.file(normalized);
      await file.setMetadata({ metadata });

      return Result.success();
    } catch (error) {
      this.logger.error(`Failed to set metadata for ${path}`, error);
      return mapGCSError(error, 'setMetadata');
    }
  }

  /**
   * Generate a signed URL for direct access
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
      const file = this.bucket!.file(normalized);

      const [url] = await file.getSignedUrl({
        action: operation === 'read' ? 'read' : 'write',
        expires: Date.now() + expiresInSeconds * 1000,
      });

      return Result.success(url);
    } catch (error) {
      this.logger.error(`Failed to generate signed URL for ${path}`, error);
      return mapGCSError(error, 'getPresignedUrl');
    }
  }

  // ==========================================================================
  // Internal Accessors (for testing)
  // ==========================================================================

  /**
   * Get the internal Storage client (for testing)
   * @internal
   */
  getStorageClient(): Storage {
    return this.storage;
  }

  /**
   * Get the current bucket object (for testing)
   * @internal
   */
  getBucket(): Bucket | undefined {
    return this.bucket;
  }
}
