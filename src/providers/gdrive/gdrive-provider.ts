/**
 * GoogleDriveProvider - Google Drive Provider Implementation
 *
 * Implements the StorageProvider interface using the Google Drive API v3.
 * Supports OAuth2 and service account authentication.
 */

import type { drive_v3 } from 'googleapis';
import { Readable } from 'stream';
import { createWriteStream, createReadStream, statSync } from 'fs';
import type { GoogleDriveProfile } from '../types/profile.js';
import { BaseStorageProvider } from '../base-provider.js';
import { Capability } from '../types/capabilities.js';
import { OperationResult, OperationStatus, type OperationError } from '../types/result.js';
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
import {
  createDriveClient,
  FOLDER_MIMETYPE,
  isGoogleWorkspaceDocument,
  isFolder,
} from './utils/auth.js';
import { PathResolver } from './utils/path-resolver.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Logger interface for dependency injection
 */
export interface GoogleDriveProviderLogger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, error?: Error | unknown): void;
}

/**
 * Dependencies that can be injected into GoogleDriveProvider
 */
export interface GoogleDriveProviderDependencies {
  /** Logger instance (defaults to getLogger()) */
  logger?: GoogleDriveProviderLogger;
  /** Pre-configured Drive client (for testing) */
  driveClient?: drive_v3.Drive;
}

/**
 * Extended delete options for Google Drive
 */
export interface GoogleDriveDeleteOptions extends DeleteOptions {
  /** If true, permanently delete instead of moving to trash (default: false) */
  permanent?: boolean;
}

// ============================================================================
// Result Helpers
// ============================================================================

/**
 * Create a successful result
 */
function success<T>(data: T): OperationResult<T> {
  return { status: OperationStatus.Success, data };
}

/**
 * Create an error result with proper typing
 */
function errorResult<T>(status: OperationStatus, error: OperationError): OperationResult<T> {
  return { status, error };
}

/**
 * Create a not found result
 */
function notFound<T>(message: string): OperationResult<T> {
  return errorResult(OperationStatus.NotFound, {
    code: 'NOT_FOUND',
    message,
    retryable: false,
  });
}

/**
 * Create a generic error result
 */
function error<T>(
  code: string,
  message: string,
  retryable = false,
  cause?: unknown
): OperationResult<T> {
  return errorResult(OperationStatus.Error, { code, message, retryable, cause });
}

/**
 * Create a permission denied result
 */
function permissionDenied<T>(message: string): OperationResult<T> {
  return errorResult(OperationStatus.PermissionDenied, {
    code: 'PERMISSION_DENIED',
    message,
    retryable: false,
  });
}

/**
 * Create a connection failed result
 */
function connectionFailed<T>(message: string): OperationResult<T> {
  return errorResult(OperationStatus.ConnectionFailed, {
    code: 'CONNECTION_FAILED',
    message,
    retryable: true,
  });
}

/**
 * Create an unimplemented result
 */
function unimplemented<T>(operation: string): OperationResult<T> {
  return errorResult(OperationStatus.Unimplemented, {
    code: 'UNIMPLEMENTED',
    message: `${operation} not supported by this provider`,
    retryable: false,
  });
}

// ============================================================================
// Error Mapping
// ============================================================================

/**
 * Map Google Drive API errors to OperationResult status codes
 */
function mapDriveError<T>(err: unknown, operation: string): OperationResult<T> {
  const driveError = err as {
    code?: number | string;
    message?: string;
    response?: {
      status?: number;
      data?: {
        error?: {
          message?: string;
          errors?: Array<{ reason?: string; message?: string }>;
        };
      };
    };
  };

  // Get status code from response or error code
  const statusCode =
    driveError.response?.status || (typeof driveError.code === 'number' ? driveError.code : 0);
  const message =
    driveError.response?.data?.error?.message ||
    driveError.message ||
    `Google Drive ${operation} failed`;

  // Get the reason from error details if available
  const reason = driveError.response?.data?.error?.errors?.[0]?.reason;

  switch (statusCode) {
    case 404:
      return notFound(message);

    case 403:
      // Check for specific rate limit reasons
      if (reason === 'userRateLimitExceeded' || reason === 'rateLimitExceeded') {
        return error('RATE_LIMITED', message, true, err);
      }
      return permissionDenied(message);

    case 401:
      return permissionDenied('Authentication failed: ' + message);

    case 429:
      return error('RATE_LIMITED', message, true, err);

    case 500:
    case 502:
    case 503:
    case 504:
      return connectionFailed(message);

    case 409:
      return error('CONFLICT', message, false, err);

    default:
      return error(String(statusCode || 'UNKNOWN'), message, false, err);
  }
}

// ============================================================================
// GoogleDriveProvider Implementation
// ============================================================================

/**
 * GoogleDriveProvider - Storage provider implementation for Google Drive
 *
 * Supports:
 * - Full CRUD operations on files and folders
 * - OAuth2 and service account authentication
 * - My Drive and Shared Drives as containers
 * - Path-to-ID resolution with caching
 * - Server-side copy and move operations
 */
export class GoogleDriveProvider extends BaseStorageProvider {
  readonly name = 'gdrive';
  readonly displayName = 'Google Drive';

  private drive: drive_v3.Drive;
  private pathResolver: PathResolver;
  private readonly logger: GoogleDriveProviderLogger;
  private readonly profile: GoogleDriveProfile;

  // Container state
  private currentContainerId: string | null = null;

  constructor(profile: GoogleDriveProfile, dependencies?: GoogleDriveProviderDependencies) {
    super();

    this.profile = profile;
    this.logger = dependencies?.logger ?? getLogger();

    // Set up capabilities
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
      Capability.Metadata,
      Capability.Containers
    );

    this.logger.debug('GoogleDriveProvider constructor called', {
      profileId: profile.id,
      hasRefreshToken: !!profile.config.refreshToken,
      hasKeyFile: !!profile.config.keyFilePath,
      includeSharedDrives: profile.config.includeSharedDrives,
    });

    // Use injected clients or create new ones
    if (dependencies?.driveClient) {
      this.drive = dependencies.driveClient;
    } else {
      const clientResult = createDriveClient(profile);
      if (!clientResult.success) {
        throw new Error(`Failed to create Drive client: ${clientResult.error}`);
      }
      this.drive = clientResult.drive;
    }

    // Initialize path resolver
    this.pathResolver = new PathResolver(this.drive, {
      cacheTtlMs: profile.config.cacheTtlMs ?? 60000,
    });

    // Set root folder if specified
    if (profile.config.rootFolderId && profile.config.rootFolderId !== 'root') {
      this.currentContainerId = profile.config.rootFolderId;
      this.pathResolver.setDriveContext(profile.config.rootFolderId);
    }

    this.logger.info('GoogleDriveProvider initialized', {
      profileId: profile.id,
    });
  }

  // ==========================================================================
  // Container Operations (My Drive / Shared Drives)
  // ==========================================================================

  /**
   * List available containers (My Drive + Shared Drives)
   */
  async listContainers(): Promise<OperationResult<Entry[]>> {
    this.logger.debug('listContainers called');

    const containers: Entry[] = [];

    // Always include "My Drive"
    containers.push({
      id: generateEntryId(),
      name: 'My Drive',
      type: EntryType.Bucket,
      path: 'my-drive',
      metadata: {
        providerData: {
          driveId: 'root',
          isMyDrive: true,
        },
      },
    });

    // List Shared Drives if enabled
    if (this.profile.config.includeSharedDrives) {
      try {
        const response = await this.drive.drives.list({
          pageSize: 100,
          fields: 'drives(id, name)',
        });

        const drives = response.data.drives || [];
        for (const driveItem of drives) {
          containers.push({
            id: generateEntryId(),
            name: driveItem.name || 'Shared Drive',
            type: EntryType.Bucket,
            path: driveItem.id || '',
            metadata: {
              providerData: {
                driveId: driveItem.id,
                isSharedDrive: true,
              },
            },
          });
        }
      } catch (err) {
        this.logger.warn('Failed to list Shared Drives', err);
        // Don't fail completely, just return My Drive
      }
    }

    return success(containers);
  }

  /**
   * Set the current container (My Drive or a Shared Drive)
   */
  setContainer(containerPath: string): void {
    this.logger.debug('setContainer called', { containerPath });

    if (containerPath === 'my-drive' || containerPath === 'root') {
      this.currentContainerId = null;
      this.pathResolver.setDriveContext(null);
    } else {
      this.currentContainerId = containerPath;
      this.pathResolver.setDriveContext(containerPath);
    }

    // Invalidate path cache when switching containers
    this.pathResolver.invalidateAll();
  }

  /**
   * Get the current container ID
   */
  getContainer(): string | undefined {
    return this.currentContainerId || 'my-drive';
  }

  // ==========================================================================
  // Core Read Operations
  // ==========================================================================

  /**
   * List files and folders in a directory
   */
  async list(path: string, options?: ListOptions): Promise<OperationResult<ListResult>> {
    this.logger.debug('list called', { path, options });

    try {
      // Resolve path to folder ID
      const resolveResult = await this.pathResolver.resolvePathToId(path);
      if (!resolveResult.success) {
        if (resolveResult.notFound) {
          return notFound(`Folder not found: ${path}`);
        }
        return error('RESOLVE_ERROR', resolveResult.error, false);
      }

      if (!resolveResult.isFolder) {
        return error('NOT_A_DIRECTORY', `${path} is not a folder`, false);
      }

      const folderId = resolveResult.fileId;
      const entries: Entry[] = [];
      const pageToken = options?.continuationToken;

      // Build query
      const query = `'${folderId}' in parents and trashed = false`;

      // Fetch files
      const response = await this.drive.files.list({
        q: query,
        pageSize: options?.limit ?? 100,
        pageToken,
        fields:
          'nextPageToken, files(id, name, mimeType, size, modifiedTime, createdTime, parents, webViewLink)',
        orderBy: 'folder,name',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        ...(this.currentContainerId ? { driveId: this.currentContainerId, corpora: 'drive' } : {}),
      });

      const files = response.data.files || [];

      for (const file of files) {
        const entryPath = this.pathResolver.joinPath(path, file.name || 'unknown');
        const isDir = isFolder(file.mimeType || '');

        entries.push({
          id: generateEntryId(),
          name: file.name || 'unknown',
          type: isDir ? EntryType.Directory : EntryType.File,
          path: entryPath,
          size: file.size ? parseInt(file.size, 10) : undefined,
          modified: file.modifiedTime ? new Date(file.modifiedTime) : undefined,
          metadata: {
            contentType: file.mimeType || undefined,
            providerData: {
              fileId: file.id,
              webViewLink: file.webViewLink,
              isGoogleDoc: isGoogleWorkspaceDocument(file.mimeType || ''),
            },
          },
        });
      }

      return success({
        entries,
        hasMore: !!response.data.nextPageToken,
        continuationToken: response.data.nextPageToken || undefined,
      });
    } catch (err) {
      this.logger.error('list failed', err);
      return mapDriveError(err, 'list');
    }
  }

  /**
   * Get metadata for a file or folder
   */
  async getMetadata(path: string): Promise<OperationResult<Entry>> {
    this.logger.debug('getMetadata called', { path });

    try {
      // Resolve path to file ID
      const resolveResult = await this.pathResolver.resolvePathToId(path);
      if (!resolveResult.success) {
        if (resolveResult.notFound) {
          return notFound(`File not found: ${path}`);
        }
        return error('RESOLVE_ERROR', resolveResult.error, false);
      }

      const fileId = resolveResult.fileId;

      // Get full metadata
      const response = await this.drive.files.get({
        fileId,
        fields: 'id, name, mimeType, size, modifiedTime, createdTime, parents, webViewLink, owners',
        supportsAllDrives: true,
      });

      const file = response.data;
      const isDir = isFolder(file.mimeType || '');

      return success({
        id: generateEntryId(),
        name: file.name || 'unknown',
        type: isDir ? EntryType.Directory : EntryType.File,
        path,
        size: file.size ? parseInt(file.size, 10) : undefined,
        modified: file.modifiedTime ? new Date(file.modifiedTime) : undefined,
        metadata: {
          contentType: file.mimeType || undefined,
          providerData: {
            fileId: file.id,
            webViewLink: file.webViewLink,
            isGoogleDoc: isGoogleWorkspaceDocument(file.mimeType || ''),
            owners: file.owners?.map(o => o.emailAddress),
          },
        },
      });
    } catch (err) {
      this.logger.error('getMetadata failed', err);
      return mapDriveError(err, 'getMetadata');
    }
  }

  /**
   * Check if a file or folder exists
   */
  async exists(path: string): Promise<OperationResult<boolean>> {
    this.logger.debug('exists called', { path });

    const resolveResult = await this.pathResolver.resolvePathToId(path);
    return success(resolveResult.success);
  }

  /**
   * Read file contents
   */
  async read(path: string, _options?: ReadOptions): Promise<OperationResult<Buffer>> {
    this.logger.debug('read called', { path });

    try {
      // Resolve path to file ID
      const resolveResult = await this.pathResolver.resolvePathToId(path);
      if (!resolveResult.success) {
        if (resolveResult.notFound) {
          return notFound(`File not found: ${path}`);
        }
        return error('RESOLVE_ERROR', resolveResult.error, false);
      }

      // Check if it's a Google Workspace document
      if (isGoogleWorkspaceDocument(resolveResult.mimeType)) {
        return error(
          'UNSUPPORTED_FILE_TYPE',
          'Google Workspace documents cannot be downloaded directly. Use the web interface to view.',
          false
        );
      }

      if (resolveResult.isFolder) {
        return error('IS_DIRECTORY', `${path} is a folder, not a file`, false);
      }

      // Download file content
      const response = await this.drive.files.get(
        {
          fileId: resolveResult.fileId,
          alt: 'media',
          supportsAllDrives: true,
        },
        { responseType: 'arraybuffer' }
      );

      return success(Buffer.from(response.data as ArrayBuffer));
    } catch (err) {
      this.logger.error('read failed', err);
      return mapDriveError(err, 'read');
    }
  }

  // ==========================================================================
  // Write Operations
  // ==========================================================================

  /**
   * Write file contents
   */
  async write(
    path: string,
    content: Buffer | string,
    options?: WriteOptions
  ): Promise<OperationResult<void>> {
    this.logger.debug('write called', { path, contentLength: content.length });

    try {
      const fileName = this.pathResolver.getFileName(path);
      const parentPath = this.pathResolver.getParentPath(path);

      // Resolve parent folder
      let parentResult = await this.pathResolver.resolvePathToId(parentPath);
      if (!parentResult.success) {
        // Parent doesn't exist - try to create it
        const mkdirResult = await this.mkdir(parentPath);
        if (mkdirResult.status !== OperationStatus.Success) {
          return mkdirResult;
        }
        // Retry resolving parent
        parentResult = await this.pathResolver.resolvePathToId(parentPath);
        if (!parentResult.success) {
          return error('PARENT_NOT_FOUND', `Parent folder not found: ${parentPath}`, false);
        }
      }

      const parentId = parentResult.fileId;

      // Check if file already exists
      const existingResult = await this.pathResolver.resolvePathToId(path);

      const contentBuffer = typeof content === 'string' ? Buffer.from(content) : content;
      const stream = Readable.from(contentBuffer);

      if (existingResult.success) {
        // Update existing file
        await this.drive.files.update({
          fileId: existingResult.fileId,
          media: {
            mimeType: options?.contentType || 'application/octet-stream',
            body: stream,
          },
          supportsAllDrives: true,
        });

        // Invalidate cache for this path
        this.pathResolver.invalidate(path);
      } else {
        // Create new file
        const fileMetadata = {
          name: fileName,
          parents: [parentId],
          mimeType: options?.contentType || 'application/octet-stream',
        };

        await this.drive.files.create({
          requestBody: fileMetadata,
          media: {
            mimeType: options?.contentType || 'application/octet-stream',
            body: stream,
          },
          fields: 'id',
          supportsAllDrives: true,
        });

        // Invalidate parent cache to show new file
        this.pathResolver.invalidate(parentPath);
      }

      return success(undefined);
    } catch (err) {
      this.logger.error('write failed', err);
      return mapDriveError(err, 'write');
    }
  }

  /**
   * Create a directory
   */
  async mkdir(path: string): Promise<OperationResult<void>> {
    this.logger.debug('mkdir called', { path });

    try {
      // Check if already exists
      const existingResult = await this.pathResolver.resolvePathToId(path);
      if (existingResult.success) {
        if (existingResult.isFolder) {
          // Already exists as folder, that's fine
          return success(undefined);
        }
        return error('EXISTS_AS_FILE', `${path} already exists as a file`, false);
      }

      const folderName = this.pathResolver.getFileName(path);
      const parentPath = this.pathResolver.getParentPath(path);

      // Resolve parent - create recursively if needed
      let parentId: string;
      const parentResult = await this.pathResolver.resolvePathToId(parentPath);

      if (!parentResult.success) {
        // Recursively create parent
        const parentMkdirResult = await this.mkdir(parentPath);
        if (parentMkdirResult.status !== OperationStatus.Success) {
          return parentMkdirResult;
        }
        const newParentResult = await this.pathResolver.resolvePathToId(parentPath);
        if (!newParentResult.success) {
          return error('PARENT_CREATION_FAILED', `Failed to create parent: ${parentPath}`, false);
        }
        parentId = newParentResult.fileId;
      } else {
        parentId = parentResult.fileId;
      }

      // Create the folder
      const folderMetadata = {
        name: folderName,
        mimeType: FOLDER_MIMETYPE,
        parents: [parentId],
      };

      await this.drive.files.create({
        requestBody: folderMetadata,
        fields: 'id',
        supportsAllDrives: true,
      });

      // Invalidate parent cache
      this.pathResolver.invalidate(parentPath);

      return success(undefined);
    } catch (err) {
      this.logger.error('mkdir failed', err);
      return mapDriveError(err, 'mkdir');
    }
  }

  /**
   * Delete a file or folder
   */
  async delete(path: string, options?: GoogleDriveDeleteOptions): Promise<OperationResult<void>> {
    this.logger.debug('delete called', { path, options });

    try {
      // Resolve path to file ID
      const resolveResult = await this.pathResolver.resolvePathToId(path);
      if (!resolveResult.success) {
        if (resolveResult.notFound) {
          return notFound(`File not found: ${path}`);
        }
        return error('RESOLVE_ERROR', resolveResult.error, false);
      }

      const fileId = resolveResult.fileId;

      if (options?.permanent) {
        // Permanently delete
        await this.drive.files.delete({
          fileId,
          supportsAllDrives: true,
        });
      } else {
        // Move to trash
        await this.drive.files.update({
          fileId,
          requestBody: {
            trashed: true,
          },
          supportsAllDrives: true,
        });
      }

      // Invalidate cache
      this.pathResolver.invalidate(path);
      this.pathResolver.invalidate(this.pathResolver.getParentPath(path));

      return success(undefined);
    } catch (err) {
      this.logger.error('delete failed', err);
      return mapDriveError(err, 'delete');
    }
  }

  // ==========================================================================
  // Move and Copy Operations
  // ==========================================================================

  /**
   * Move a file or folder
   */
  async move(
    source: string,
    destination: string,
    _options?: TransferOptions
  ): Promise<OperationResult<void>> {
    this.logger.debug('move called', { source, destination });

    try {
      // Resolve source
      const sourceResult = await this.pathResolver.resolvePathToId(source);
      if (!sourceResult.success) {
        if (sourceResult.notFound) {
          return notFound(`Source not found: ${source}`);
        }
        return error('RESOLVE_ERROR', sourceResult.error, false);
      }

      const sourceFileId = sourceResult.fileId;

      // Get current parent
      const sourceParentPath = this.pathResolver.getParentPath(source);
      const sourceParentResult = await this.pathResolver.resolvePathToId(sourceParentPath);
      const currentParentId = sourceParentResult.success ? sourceParentResult.fileId : 'root';

      // Resolve destination parent
      const destParentPath = this.pathResolver.getParentPath(destination);
      const destFileName = this.pathResolver.getFileName(destination);

      let destParentId: string;
      const destParentResult = await this.pathResolver.resolvePathToId(destParentPath);

      if (!destParentResult.success) {
        // Create destination folder
        const mkdirResult = await this.mkdir(destParentPath);
        if (mkdirResult.status !== OperationStatus.Success) {
          return mkdirResult;
        }
        const newDestParentResult = await this.pathResolver.resolvePathToId(destParentPath);
        if (!newDestParentResult.success) {
          return error(
            'DEST_PARENT_NOT_FOUND',
            `Destination parent not found: ${destParentPath}`,
            false
          );
        }
        destParentId = newDestParentResult.fileId;
      } else {
        destParentId = destParentResult.fileId;
      }

      // Perform move (update parents and optionally rename)
      const updateRequest: { name?: string; addParents?: string; removeParents?: string } = {};

      // Check if renaming
      const sourceFileName = this.pathResolver.getFileName(source);
      if (destFileName !== sourceFileName) {
        updateRequest.name = destFileName;
      }

      // Check if moving to different folder
      if (currentParentId !== destParentId) {
        updateRequest.addParents = destParentId;
        updateRequest.removeParents = currentParentId;
      }

      if (Object.keys(updateRequest).length > 0) {
        await this.drive.files.update({
          fileId: sourceFileId,
          addParents: updateRequest.addParents,
          removeParents: updateRequest.removeParents,
          requestBody: updateRequest.name ? { name: updateRequest.name } : undefined,
          fields: 'id, parents',
          supportsAllDrives: true,
        });
      }

      // Invalidate caches
      this.pathResolver.invalidate(source);
      this.pathResolver.invalidate(sourceParentPath);
      this.pathResolver.invalidate(destParentPath);

      return success(undefined);
    } catch (err) {
      this.logger.error('move failed', err);
      return mapDriveError(err, 'move');
    }
  }

  /**
   * Copy a file or folder
   */
  async copy(
    source: string,
    destination: string,
    _options?: TransferOptions
  ): Promise<OperationResult<void>> {
    this.logger.debug('copy called', { source, destination });

    try {
      // Resolve source
      const sourceResult = await this.pathResolver.resolvePathToId(source);
      if (!sourceResult.success) {
        if (sourceResult.notFound) {
          return notFound(`Source not found: ${source}`);
        }
        return error('RESOLVE_ERROR', sourceResult.error, false);
      }

      // Can only copy files, not folders (Drive API limitation)
      if (sourceResult.isFolder) {
        // For folders, we'd need to recursively copy - use fallback
        return unimplemented('Folder copy not supported by Drive API, use fallback');
      }

      const sourceFileId = sourceResult.fileId;

      // Resolve destination parent
      const destParentPath = this.pathResolver.getParentPath(destination);
      const destFileName = this.pathResolver.getFileName(destination);

      let destParentId: string;
      const destParentResult = await this.pathResolver.resolvePathToId(destParentPath);

      if (!destParentResult.success) {
        // Create destination folder
        const mkdirResult = await this.mkdir(destParentPath);
        if (mkdirResult.status !== OperationStatus.Success) {
          return mkdirResult;
        }
        const newDestParentResult = await this.pathResolver.resolvePathToId(destParentPath);
        if (!newDestParentResult.success) {
          return error(
            'DEST_PARENT_NOT_FOUND',
            `Destination parent not found: ${destParentPath}`,
            false
          );
        }
        destParentId = newDestParentResult.fileId;
      } else {
        destParentId = destParentResult.fileId;
      }

      // Perform copy
      await this.drive.files.copy({
        fileId: sourceFileId,
        requestBody: {
          name: destFileName,
          parents: [destParentId],
        },
        fields: 'id',
        supportsAllDrives: true,
      });

      // Invalidate destination parent cache
      this.pathResolver.invalidate(destParentPath);

      return success(undefined);
    } catch (err) {
      this.logger.error('copy failed', err);
      return mapDriveError(err, 'copy');
    }
  }

  // ==========================================================================
  // Transfer Operations
  // ==========================================================================

  /**
   * Download a file to local filesystem
   */
  async downloadToLocal(
    remotePath: string,
    localPath: string,
    options?: TransferOptions
  ): Promise<OperationResult<void>> {
    this.logger.debug('downloadToLocal called', { remotePath, localPath });

    try {
      // Resolve remote path
      const resolveResult = await this.pathResolver.resolvePathToId(remotePath);
      if (!resolveResult.success) {
        if (resolveResult.notFound) {
          return notFound(`File not found: ${remotePath}`);
        }
        return error('RESOLVE_ERROR', resolveResult.error, false);
      }

      // Check if it's a Google Workspace document
      if (isGoogleWorkspaceDocument(resolveResult.mimeType)) {
        return error(
          'UNSUPPORTED_FILE_TYPE',
          'Google Workspace documents cannot be downloaded. Use the web interface.',
          false
        );
      }

      if (resolveResult.isFolder) {
        return error('IS_DIRECTORY', `${remotePath} is a folder, not a file`, false);
      }

      // Get file size for progress
      const metadataResponse = await this.drive.files.get({
        fileId: resolveResult.fileId,
        fields: 'size',
        supportsAllDrives: true,
      });
      const totalSize = parseInt(metadataResponse.data.size || '0', 10);

      // Download with streaming
      const response = await this.drive.files.get(
        {
          fileId: resolveResult.fileId,
          alt: 'media',
          supportsAllDrives: true,
        },
        { responseType: 'stream' }
      );

      // Write to local file
      const writeStream = createWriteStream(localPath);
      const dataStream = response.data as Readable;

      let bytesDownloaded = 0;

      return new Promise(resolve => {
        dataStream.on('data', (chunk: Buffer | string) => {
          const chunkSize = typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.length;
          bytesDownloaded += chunkSize;
          if (options?.onProgress && totalSize > 0) {
            options.onProgress({
              operation: 'download',
              bytesTransferred: bytesDownloaded,
              totalBytes: totalSize,
              percentage: Math.round((bytesDownloaded / totalSize) * 100),
            });
          }
        });

        dataStream.on('error', err => {
          writeStream.close();
          this.logger.error('downloadToLocal stream error', err);
          resolve(mapDriveError(err, 'downloadToLocal'));
        });

        writeStream.on('error', err => {
          this.logger.error('downloadToLocal write error', err);
          resolve(error('WRITE_ERROR', `Failed to write local file: ${err.message}`, false));
        });

        writeStream.on('finish', () => {
          resolve(success(undefined));
        });

        dataStream.pipe(writeStream);
      });
    } catch (err) {
      this.logger.error('downloadToLocal failed', err);
      return mapDriveError(err, 'downloadToLocal');
    }
  }

  /**
   * Upload a file from local filesystem
   */
  async uploadFromLocal(
    localPath: string,
    remotePath: string,
    options?: TransferOptions
  ): Promise<OperationResult<void>> {
    this.logger.debug('uploadFromLocal called', { localPath, remotePath });

    try {
      // Get local file stats
      let fileStats;
      try {
        fileStats = statSync(localPath);
      } catch {
        return notFound(`Local file not found: ${localPath}`);
      }

      if (fileStats.isDirectory()) {
        return error('IS_DIRECTORY', `${localPath} is a directory, not a file`, false);
      }

      const totalSize = fileStats.size;
      const fileName = this.pathResolver.getFileName(remotePath);
      const parentPath = this.pathResolver.getParentPath(remotePath);

      // Resolve or create parent folder
      let parentId: string;
      let parentResult = await this.pathResolver.resolvePathToId(parentPath);

      if (!parentResult.success) {
        const mkdirResult = await this.mkdir(parentPath);
        if (mkdirResult.status !== OperationStatus.Success) {
          return mkdirResult;
        }
        parentResult = await this.pathResolver.resolvePathToId(parentPath);
        if (!parentResult.success) {
          return error('PARENT_CREATION_FAILED', `Failed to create parent: ${parentPath}`, false);
        }
      }
      parentId = parentResult.fileId;

      // Check if file already exists
      const existingResult = await this.pathResolver.resolvePathToId(remotePath);

      // Create read stream with progress tracking
      const readStream = createReadStream(localPath);
      let bytesUploaded = 0;

      readStream.on('data', (chunk: Buffer | string) => {
        const chunkSize = typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.length;
        bytesUploaded += chunkSize;
        if (options?.onProgress && totalSize > 0) {
          options.onProgress({
            operation: 'upload',
            bytesTransferred: bytesUploaded,
            totalBytes: totalSize,
            percentage: Math.round((bytesUploaded / totalSize) * 100),
          });
        }
      });

      if (existingResult.success) {
        // Update existing file
        await this.drive.files.update({
          fileId: existingResult.fileId,
          media: {
            body: readStream,
          },
          supportsAllDrives: true,
        });
        this.pathResolver.invalidate(remotePath);
      } else {
        // Create new file
        const fileMetadata = {
          name: fileName,
          parents: [parentId],
        };

        await this.drive.files.create({
          requestBody: fileMetadata,
          media: {
            body: readStream,
          },
          fields: 'id',
          supportsAllDrives: true,
        });
        this.pathResolver.invalidate(parentPath);
      }

      return success(undefined);
    } catch (err) {
      this.logger.error('uploadFromLocal failed', err);
      return mapDriveError(err, 'uploadFromLocal');
    }
  }
}
