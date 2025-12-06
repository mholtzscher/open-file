/**
 * FTPProvider - File Transfer Protocol Provider Implementation
 *
 * Implements the StorageProvider interface using basic-ftp.
 * Supports plain FTP, explicit FTPS, and implicit FTPS.
 */

import { Client, FileInfo as FTPFileInfo, AccessOptions } from 'basic-ftp';
import { Writable } from 'stream';
import { promises as fs } from 'fs';
import { join, dirname, basename } from 'path';
import type { FTPProfile } from '../types/profile.js';
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
export interface FTPProviderLogger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, error?: unknown): void;
}

/**
 * Dependencies that can be injected into FTPProvider
 */
export interface FTPProviderDependencies {
  /** Logger instance (defaults to getLogger()) */
  logger?: FTPProviderLogger;
  /** Pre-configured FTP client (for testing) */
  ftpClient?: Client;
}

// ============================================================================
// Error Mapping
// ============================================================================

/**
 * Map FTP error codes to OperationResult status codes
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapFTPError(error: unknown, operation: string): OperationResult<any> {
  const err = error as {
    code?: string | number;
    message?: string;
  };

  const message = err.message || `FTP ${operation} failed`;

  // Check for common error patterns in message
  if (message.includes('550') || message.includes('No such file')) {
    return Result.notFound(message);
  }
  if (message.includes('530') || message.includes('Login') || message.includes('Permission')) {
    return Result.permissionDenied(message);
  }
  if (
    message.includes('ECONNREFUSED') ||
    message.includes('ECONNRESET') ||
    message.includes('ETIMEDOUT') ||
    message.includes('Timeout') ||
    message.includes('not connected')
  ) {
    return Result.connectionFailed(message);
  }
  if (message.includes('553') || message.includes('already exists')) {
    return Result.error('ALREADY_EXISTS', message, false, error);
  }

  return Result.error('FTP_ERROR', message, false, error);
}

// ============================================================================
// FTPProvider Implementation
// ============================================================================

/**
 * FTPProvider - Storage provider implementation for FTP
 *
 * Supports:
 * - Full CRUD operations on remote files
 * - Directory operations
 * - Plain FTP, explicit FTPS, and implicit FTPS
 * - Anonymous and authenticated access
 */
export class FTPProvider extends BaseStorageProvider {
  readonly name = 'ftp';
  readonly displayName = 'FTP';

  private client: Client;
  private connected = false;
  private readonly profile: FTPProfile;
  private readonly logger: FTPProviderLogger;
  private basePath: string;

  constructor(profile: FTPProfile, dependencies?: FTPProviderDependencies) {
    super();

    // Initialize dependencies with defaults
    this.logger = dependencies?.logger ?? getLogger();
    this.profile = profile;
    this.basePath = profile.config.basePath || '/';

    // Use injected client or create new one
    this.client = dependencies?.ftpClient ?? new Client();

    // Set up capabilities
    // FTP has more limited capabilities than SFTP
    this.addCapability(
      Capability.List,
      Capability.Read,
      Capability.Write,
      Capability.Delete,
      Capability.Mkdir,
      Capability.Rmdir,
      Capability.Move,
      Capability.Download,
      Capability.Upload,
      Capability.Connection
    );

    this.logger.debug('FTPProvider constructor called', {
      profileId: profile.id,
      host: profile.config.host,
      port: profile.config.port,
      username: profile.config.username,
      secure: profile.config.secure,
    });
  }

  // ==========================================================================
  // Connection Lifecycle
  // ==========================================================================

  /**
   * Establish connection to the FTP server
   */
  async connect(): Promise<OperationResult> {
    if (this.connected) {
      return Result.success();
    }

    try {
      const config = this.profile.config;

      const accessOptions: AccessOptions = {
        host: config.host,
        port: config.port ?? 21,
        user: config.username ?? 'anonymous',
        password: config.password ?? 'anonymous@',
        secure: config.secure ?? false,
      };

      this.logger.debug('Connecting to FTP server', {
        host: config.host,
        port: accessOptions.port,
        user: accessOptions.user,
        secure: accessOptions.secure,
      });

      await this.client.access(accessOptions);
      this.connected = true;

      this.logger.info('Connected to FTP server', {
        host: config.host,
      });

      return Result.success();
    } catch (error) {
      this.logger.error('Failed to connect to FTP server', error);
      return mapFTPError(error, 'connect');
    }
  }

  /**
   * Close connection to the FTP server
   */
  disconnect(): Promise<void> {
    if (this.connected) {
      try {
        this.client.close();
      } catch (error) {
        this.logger.warn('Error during disconnect', { error });
      }
      this.connected = false;
      this.logger.info('Disconnected from FTP server');
    }
    return Promise.resolve();
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.connected && !this.client.closed;
  }

  // ==========================================================================
  // Path Utilities
  // ==========================================================================

  /**
   * Resolve a path relative to the base path
   */
  private resolvePath(path: string): string {
    if (path.startsWith('/')) {
      return path;
    }
    return join(this.basePath, path);
  }

  /**
   * Ensure connected before operations
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private ensureConnected(): OperationResult<any> | null {
    if (!this.connected || this.client.closed) {
      return Result.connectionFailed('Not connected to FTP server. Call connect() first.');
    }
    return null;
  }

  /**
   * Convert FTPFileInfo to Entry
   */
  private fileInfoToEntry(info: FTPFileInfo, parentPath: string): Entry {
    const fullPath = join(parentPath, info.name);

    let entryType: EntryType;
    if (info.isDirectory) {
      entryType = EntryType.Directory;
    } else if (info.isSymbolicLink) {
      entryType = EntryType.Symlink;
    } else {
      entryType = EntryType.File;
    }

    return {
      id: generateEntryId(),
      name: info.name,
      type: entryType,
      path: fullPath,
      size: info.isFile ? info.size : undefined,
      modified: info.modifiedAt,
      metadata: {
        permissions: info.permissions?.user ? this.parsePermissions(info.permissions) : undefined,
        providerData: {
          rawModifiedAt: info.rawModifiedAt,
          uniqueID: info.uniqueID,
        },
      },
    };
  }

  /**
   * Parse FTP permissions object to numeric mode
   */
  private parsePermissions(perms: FTPFileInfo['permissions']): number {
    if (!perms) return 0;

    const parseSection = (section: number): number => {
      // basic-ftp returns permissions as numeric already
      return section & 7;
    };

    const user = perms.user ?? 0;
    const group = perms.group ?? 0;
    const world = perms.world ?? 0;

    return (parseSection(user) << 6) | (parseSection(group) << 3) | parseSection(world);
  }

  // ==========================================================================
  // Core Read Operations
  // ==========================================================================

  /**
   * List entries at a given path
   */
  async list(path: string, options?: ListOptions): Promise<OperationResult<ListResult>> {
    const connError = this.ensureConnected();
    if (connError) return connError;

    const resolved = this.resolvePath(path);

    try {
      const files = await this.client.list(resolved);

      let entries = files.map(file => this.fileInfoToEntry(file, resolved));

      // Apply limit if specified
      const hasMore = options?.limit ? entries.length > options.limit : false;
      if (options?.limit) {
        entries = entries.slice(0, options.limit);
      }

      return Result.success({
        entries,
        hasMore,
      });
    } catch (error) {
      this.logger.error(`Failed to list ${path}`, error);
      return mapFTPError(error, 'list');
    }
  }

  /**
   * Get metadata for a specific entry
   */
  async getMetadata(path: string): Promise<OperationResult<Entry>> {
    const connError = this.ensureConnected();
    if (connError) return connError;

    const resolved = this.resolvePath(path);
    const parentDir = dirname(resolved);
    const fileName = basename(resolved);

    try {
      // FTP doesn't have a direct stat command, so we list the parent and find our file
      const files = await this.client.list(parentDir);
      const file = files.find(f => f.name === fileName);

      if (!file) {
        return Result.notFound(`File not found: ${path}`) as OperationResult<Entry>;
      }

      return Result.success(this.fileInfoToEntry(file, parentDir));
    } catch (error) {
      this.logger.error(`Failed to get metadata for ${path}`, error);
      return mapFTPError(error, 'getMetadata');
    }
  }

  /**
   * Check if a path exists (internal helper)
   */
  protected async exists(path: string): Promise<OperationResult<boolean>> {
    const connError = this.ensureConnected();
    if (connError) return connError;

    const resolved = this.resolvePath(path);
    const parentDir = dirname(resolved);
    const fileName = basename(resolved);

    try {
      const files = await this.client.list(parentDir);
      const exists = files.some(f => f.name === fileName);
      return Result.success(exists);
    } catch (error) {
      // If we can't list the parent, assume it doesn't exist
      const err = error as { message?: string };
      if (err.message?.includes('550')) {
        return Result.success(false);
      }
      this.logger.error(`Failed to check existence of ${path}`, error);
      return mapFTPError(error, 'exists');
    }
  }

  /**
   * Read file contents
   */
  async read(path: string, _options?: ReadOptions): Promise<OperationResult<Buffer>> {
    const connError = this.ensureConnected();
    if (connError) return connError;

    const resolved = this.resolvePath(path);

    try {
      const chunks: Uint8Array[] = [];
      const writable = new Writable({
        write(chunk, _encoding, callback) {
          chunks.push(chunk as Uint8Array);
          callback();
        },
      });

      await this.client.downloadTo(writable, resolved);

      return Result.success(Buffer.concat(chunks));
    } catch (error) {
      this.logger.error(`Failed to read ${path}`, error);
      return mapFTPError(error, 'read');
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
    _options?: WriteOptions
  ): Promise<OperationResult> {
    const connError = this.ensureConnected();
    if (connError) return connError;

    const resolved = this.resolvePath(path);
    const body = content instanceof Buffer ? content : Buffer.from(content);

    try {
      // Ensure parent directory exists
      const parentDir = dirname(resolved);
      await this.client.ensureDir(parentDir);
      await this.client.cd('/'); // Reset to root after ensureDir

      // Create a readable stream from the buffer
      const { Readable } = await import('stream');
      const readable = Readable.from(body);

      await this.client.uploadFrom(readable, resolved);

      return Result.success();
    } catch (error) {
      this.logger.error(`Failed to write ${path}`, error);
      return mapFTPError(error, 'write');
    }
  }

  /**
   * Create a directory
   */
  async mkdir(path: string): Promise<OperationResult> {
    const connError = this.ensureConnected();
    if (connError) return connError;

    const resolved = this.resolvePath(path);

    try {
      await this.client.ensureDir(resolved);
      await this.client.cd('/'); // Reset to root after ensureDir
      return Result.success();
    } catch (error) {
      this.logger.error(`Failed to create directory ${path}`, error);
      return mapFTPError(error, 'mkdir');
    }
  }

  /**
   * Delete a file or directory
   */
  async delete(path: string, options?: DeleteOptions): Promise<OperationResult> {
    const connError = this.ensureConnected();
    if (connError) return connError;

    const resolved = this.resolvePath(path);

    try {
      // Try to determine if it's a directory or file
      const parentDir = dirname(resolved);
      const fileName = basename(resolved);
      const files = await this.client.list(parentDir);
      const entry = files.find(f => f.name === fileName);

      if (!entry) {
        return Result.notFound(`Path not found: ${path}`);
      }

      if (entry.isDirectory) {
        if (options?.recursive) {
          await this.client.removeDir(resolved);
        } else {
          // Try to remove empty directory
          await this.client.send(`RMD ${resolved}`);
        }
      } else {
        await this.client.remove(resolved);
      }

      return Result.success();
    } catch (error) {
      this.logger.error(`Failed to delete ${path}`, error);
      return mapFTPError(error, 'delete');
    }
  }

  // ==========================================================================
  // Move/Copy Operations
  // ==========================================================================

  /**
   * Native move implementation using FTP rename
   */
  protected async nativeMove(
    source: string,
    dest: string,
    _options?: TransferOptions
  ): Promise<OperationResult> {
    const connError = this.ensureConnected();
    if (connError) return connError;

    const srcResolved = this.resolvePath(source);
    const destResolved = this.resolvePath(dest);

    try {
      await this.client.rename(srcResolved, destResolved);
      return Result.success();
    } catch (error) {
      this.logger.error(`Failed to move ${source} to ${dest}`, error);
      return mapFTPError(error, 'move');
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
    const connError = this.ensureConnected();
    if (connError) return connError;

    const resolved = this.resolvePath(remotePath);

    try {
      // Check if it's a directory
      const parentDir = dirname(resolved);
      const fileName = basename(resolved);
      const files = await this.client.list(parentDir);
      const entry = files.find(f => f.name === fileName);

      if (!entry) {
        return Result.notFound(`Path not found: ${remotePath}`);
      }

      if (entry.isDirectory && options?.recursive) {
        // Download directory recursively
        await this.client.cd(resolved);
        await this.client.downloadToDir(localPath);
        await this.client.cd('/');
      } else if (!entry.isDirectory) {
        // Download single file
        await fs.mkdir(dirname(localPath), { recursive: true });

        // Set up progress tracking if callback provided
        if (options?.onProgress) {
          this.client.trackProgress(info => {
            options.onProgress!({
              operation: 'download',
              bytesTransferred: info.bytes,
              totalBytes: info.bytesOverall,
              percentage: entry.size > 0 ? Math.round((info.bytes / entry.size) * 100) : 0,
              currentFile: remotePath,
            });
          });
        }

        await this.client.downloadTo(localPath, resolved);

        // Stop progress tracking
        this.client.trackProgress();
      } else {
        return Result.error(
          'INVALID_OPERATION',
          'Cannot download directory without recursive option',
          false
        );
      }

      return Result.success();
    } catch (error) {
      this.logger.error(`Failed to download ${remotePath} to ${localPath}`, error);
      return mapFTPError(error, 'download');
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
    const connError = this.ensureConnected();
    if (connError) return connError;

    const resolved = this.resolvePath(remotePath);

    try {
      const stats = await fs.stat(localPath);

      if (stats.isDirectory() && options?.recursive) {
        // Upload directory recursively
        await this.client.ensureDir(resolved);
        await this.client.cd(resolved);
        await this.client.uploadFromDir(localPath);
        await this.client.cd('/');
      } else if (stats.isFile()) {
        // Ensure parent directory exists
        const parentDir = dirname(resolved);
        await this.client.ensureDir(parentDir);
        await this.client.cd('/');

        // Set up progress tracking if callback provided
        if (options?.onProgress) {
          this.client.trackProgress(info => {
            options.onProgress!({
              operation: 'upload',
              bytesTransferred: info.bytes,
              totalBytes: info.bytesOverall,
              percentage: stats.size > 0 ? Math.round((info.bytes / stats.size) * 100) : 0,
              currentFile: localPath,
            });
          });
        }

        await this.client.uploadFrom(localPath, resolved);

        // Stop progress tracking
        this.client.trackProgress();
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
      return mapFTPError(error, 'upload');
    }
  }

  // ==========================================================================
  // Internal Accessors (for testing)
  // ==========================================================================

  /**
   * Get the internal FTP client (for testing)
   * @internal
   */
  getClient(): Client {
    return this.client;
  }

  /**
   * Get the base path
   * @internal
   */
  getBasePath(): string {
    return this.basePath;
  }
}
