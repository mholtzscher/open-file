/**
 * SMBProvider - Server Message Block Provider Implementation
 *
 * Implements the StorageProvider interface using @marsaud/smb2.
 * Supports SMB2/3 protocol for Windows file shares and Samba servers.
 */

import SMB2 from '@marsaud/smb2';
import { promises as fs } from 'fs';
import { join, dirname, posix } from 'path';
import type { SMBProfile } from '../types/profile.js';
import { BaseStorageProvider } from '../base-provider.js';
import { Capability } from '../types/capabilities.js';
import { OperationResult, OperationStatus, Result } from '../types/result.js';
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
export interface SMBProviderLogger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, error?: unknown): void;
}

/**
 * Dependencies that can be injected into SMBProvider
 */
export interface SMBProviderDependencies {
  /** Logger instance (defaults to getLogger()) */
  logger?: SMBProviderLogger;
}

/**
 * SMB2 readdir entry with stats
 */
interface SMBDirEntry {
  name: string;
  birthtime: Date;
  mtime: Date;
  atime: Date;
  ctime: Date;
  size?: number;
  isDirectory(): boolean;
}

/**
 * SMB2 stat result
 *
 * The @marsaud/smb2 library's IStats type definition is incomplete - it lacks
 * the `size` property which is actually returned by the stat() method for files.
 * This interface extends the library's incomplete type with the actual properties.
 */
interface SMBStats {
  birthtime: Date;
  mtime: Date;
  atime: Date;
  ctime: Date;
  /** File size in bytes. Present for files, undefined for directories. */
  size: number;
  isDirectory(): boolean;
}

// ============================================================================
// Error Mapping
// ============================================================================

/**
 * Map SMB error codes to OperationResult status codes
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSMBError(error: unknown, operation: string): OperationResult<any> {
  const err = error as {
    code?: string;
    message?: string;
    name?: string;
  };

  const message = err.message || `SMB ${operation} failed`;
  const code = err.code || '';

  // Check for common error patterns
  if (
    code.includes('STATUS_OBJECT_NAME_NOT_FOUND') ||
    code.includes('STATUS_NO_SUCH_FILE') ||
    message.includes('not found') ||
    message.includes('ENOENT')
  ) {
    return Result.notFound(message);
  }
  if (
    code.includes('STATUS_ACCESS_DENIED') ||
    code.includes('STATUS_LOGON_FAILURE') ||
    message.includes('Permission') ||
    message.includes('access denied')
  ) {
    return Result.permissionDenied(message);
  }
  if (
    message.includes('ECONNREFUSED') ||
    message.includes('ECONNRESET') ||
    message.includes('ETIMEDOUT') ||
    message.includes('STATUS_CONNECTION') ||
    message.includes('not connected') ||
    message.includes('socket')
  ) {
    return Result.connectionFailed(message);
  }
  if (code.includes('STATUS_OBJECT_NAME_COLLISION') || message.includes('already exists')) {
    return Result.error('ALREADY_EXISTS', message, false, error);
  }
  if (code.includes('STATUS_DIRECTORY_NOT_EMPTY')) {
    return Result.error('DIRECTORY_NOT_EMPTY', message, false, error);
  }

  return Result.error('SMB_ERROR', message, false, error);
}

// ============================================================================
// SMBProvider Implementation
// ============================================================================

/**
 * SMBProvider - Storage provider implementation for SMB/CIFS
 *
 * Supports:
 * - Full CRUD operations on remote files
 * - Directory operations
 * - SMB2/3 protocol
 * - Windows file shares and Samba servers
 */
export class SMBProvider extends BaseStorageProvider {
  readonly name = 'smb';
  readonly displayName = 'SMB/CIFS';

  private client: SMB2 | null = null;
  private connected = false;
  private readonly profile: SMBProfile;
  private readonly logger: SMBProviderLogger;

  constructor(profile: SMBProfile, dependencies?: SMBProviderDependencies) {
    super();

    // Initialize dependencies with defaults
    this.logger = dependencies?.logger ?? getLogger();
    this.profile = profile;

    // Set up capabilities
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
      Capability.Connection,
      Capability.Metadata
    );

    this.logger.debug('SMBProvider constructor called', {
      profileId: profile.id,
      host: profile.config.host,
      port: profile.config.port ?? 445,
      share: profile.config.share,
      domain: profile.config.domain,
      username: profile.config.username,
    });
  }

  // ==========================================================================
  // Connection Lifecycle
  // ==========================================================================

  /**
   * Establish connection to the SMB server
   */
  async connect(): Promise<OperationResult> {
    if (this.connected && this.client) {
      return Result.success();
    }

    try {
      const config = this.profile.config;
      const host = config.host;
      const port = config.port ?? 445;
      const share = config.share;

      // Build UNC path: \\host\share or \\host:port\share
      const uncPath = port === 445 ? `\\\\${host}\\${share}` : `\\\\${host}:${port}\\${share}`;

      this.logger.debug('Connecting to SMB server', {
        host,
        port,
        share,
        domain: config.domain,
        username: config.username,
        uncPath,
      });

      // Warn about unsupported options
      // The @marsaud/smb2 library doesn't support version or encryption options
      if (config.version) {
        this.logger.warn(
          `SMB version option '${config.version}' is configured but not supported by the underlying library. ` +
            'The library will negotiate the highest mutually supported version automatically.'
        );
      }
      if (config.encryption) {
        this.logger.warn(
          'SMB encryption option is configured but not supported by the underlying library. ' +
            'Connection will proceed without explicit encryption configuration.'
        );
      }

      // Create SMB2 client
      // Note: autoCloseTimeout must be > 0 to allow file handles to be closed
      // after operations. A value of 0 means "never close" which causes
      // STATUS_DIRECTORY_NOT_EMPTY errors when deleting directories.
      this.client = new SMB2({
        share: uncPath,
        domain: config.domain || 'WORKGROUP',
        username: config.username || '',
        password: config.password || '',
        autoCloseTimeout: 100, // Auto-close handles after 100ms of inactivity
      });

      // Test connection by checking if we can access the share
      // The library connects lazily, so we need to do an operation to verify
      // Using readdir('') to test root access
      await this.client.readdir('');
      this.connected = true;

      this.logger.info('Connected to SMB server', {
        host: config.host,
        share: config.share,
      });

      return Result.success();
    } catch (error) {
      const err = error as Error;
      this.logger.error('Failed to connect to SMB server', {
        message: err.message,
        name: err.name,
      });
      return mapSMBError(error, 'connect');
    }
  }

  /**
   * Close connection to the SMB server
   */
  disconnect(): Promise<void> {
    if (this.connected && this.client) {
      try {
        this.client.disconnect();
      } catch (error) {
        this.logger.warn('Error during disconnect', { error });
      }
      this.client = null;
      this.connected = false;
      this.logger.info('Disconnected from SMB server');
    }
    return Promise.resolve();
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.connected && this.client !== null;
  }

  // ==========================================================================
  // Path Utilities
  // ==========================================================================

  /**
   * Convert path to SMB format (backslashes, no leading slash for relative paths)
   * SMB2 library expects paths without leading slashes for the share root
   */
  private normalizePath(path: string): string {
    // Convert forward slashes to backslashes
    let normalized = path.replace(/\//g, '\\');

    // Remove leading backslash - SMB2 library expects relative paths
    if (normalized.startsWith('\\')) {
      normalized = normalized.slice(1);
    }

    // Empty path means root
    if (normalized === '' || normalized === '.') {
      return '';
    }

    return normalized;
  }

  /**
   * Ensure connected before operations
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private ensureConnected(): OperationResult<any> | null {
    if (!this.connected || !this.client) {
      return Result.connectionFailed('Not connected to SMB server. Call connect() first.');
    }
    return null;
  }

  /**
   * Convert SMB directory entry to Entry
   */
  private smbEntryToEntry(entry: SMBDirEntry, parentPath: string): Entry {
    const fullPath = parentPath ? posix.join(parentPath, entry.name) : entry.name;

    const entryType: EntryType = entry.isDirectory() ? EntryType.Directory : EntryType.File;

    return {
      id: generateEntryId(),
      name: entry.name,
      type: entryType,
      path: '/' + fullPath.replace(/\\/g, '/'),
      modified: entry.mtime,
      metadata: {
        accessed: entry.atime,
        createdAt: entry.birthtime,
        providerData: {
          ctime: entry.ctime,
        },
      },
    };
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

    const normalized = this.normalizePath(path);

    try {
      // Use readdir with stats option to get file metadata
      // For SMB2, empty string means root (not '.' which fails)
      const entries = (await this.client!.readdir(normalized, {
        stats: true,
      })) as SMBDirEntry[];

      let mappedEntries = entries.map(entry => this.smbEntryToEntry(entry, normalized));

      // Apply limit if specified
      const hasMore = options?.limit ? mappedEntries.length > options.limit : false;
      if (options?.limit) {
        mappedEntries = mappedEntries.slice(0, options.limit);
      }

      return Result.success({
        entries: mappedEntries,
        hasMore,
      });
    } catch (error) {
      this.logger.error(`Failed to list ${path}`, error);
      return mapSMBError(error, 'list');
    }
  }

  /**
   * Get metadata for a specific entry
   */
  async getMetadata(path: string): Promise<OperationResult<Entry>> {
    const connError = this.ensureConnected();
    if (connError) return connError;

    const normalized = this.normalizePath(path);

    // Handle root path
    if (!normalized || normalized === '.') {
      return Result.success({
        id: generateEntryId(),
        name: '/',
        type: EntryType.Directory,
        path: '/',
      });
    }

    try {
      // SMB2 library's stat() returns IStats which lacks the size property in its
      // type definitions, but the actual runtime object includes it for files.
      // We cast through unknown to SMBStats which properly represents the actual
      // return type. See: https://github.com/marsaud/node-smb2/blob/master/lib/api/stat.js
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stats = (await this.client!.stat(normalized)) as any as SMBStats;
      const isDir = stats.isDirectory();

      return Result.success({
        id: generateEntryId(),
        name: posix.basename(path),
        type: isDir ? EntryType.Directory : EntryType.File,
        path: '/' + normalized.replace(/\\/g, '/'),
        size: isDir ? undefined : stats.size,
        modified: stats.mtime,
        metadata: {
          accessed: stats.atime,
          createdAt: stats.birthtime,
          providerData: {
            ctime: stats.ctime,
          },
        },
      });
    } catch (error) {
      this.logger.error(`Failed to get metadata for ${path}`, error);
      return mapSMBError(error, 'getMetadata');
    }
  }

  /**
   * Check if a path exists
   */
  async exists(path: string): Promise<OperationResult<boolean>> {
    const connError = this.ensureConnected();
    if (connError) return connError;

    const normalized = this.normalizePath(path);

    // Root always exists
    if (!normalized || normalized === '.') {
      return Result.success(true);
    }

    try {
      const exists = await this.client!.exists(normalized);
      return Result.success(exists);
    } catch (error) {
      // If we get an error checking existence, assume it doesn't exist
      const err = error as { code?: string };
      if (err.code?.includes('STATUS_OBJECT_NAME_NOT_FOUND')) {
        return Result.success(false);
      }
      this.logger.error(`Failed to check existence of ${path}`, error);
      return mapSMBError(error, 'exists');
    }
  }

  /**
   * Read file contents
   */
  async read(path: string, _options?: ReadOptions): Promise<OperationResult<Buffer>> {
    const connError = this.ensureConnected();
    if (connError) return connError;

    const normalized = this.normalizePath(path);

    try {
      const buffer = await this.client!.readFile(normalized);
      return Result.success(buffer);
    } catch (error) {
      this.logger.error(`Failed to read ${path}`, error);
      return mapSMBError(error, 'read');
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

    const normalized = this.normalizePath(path);

    try {
      // Ensure parent directory exists
      const parentDir = posix.dirname(normalized.replace(/\\/g, '/'));
      if (parentDir && parentDir !== '.' && parentDir !== '/') {
        await this.ensureDirectory(parentDir);
      }

      // Write the file
      await this.client!.writeFile(normalized, content);

      return Result.success();
    } catch (error) {
      this.logger.error(`Failed to write ${path}`, error);
      return mapSMBError(error, 'write');
    }
  }

  /**
   * Check if an error indicates the directory already exists
   */
  private isAlreadyExistsError(error: unknown): boolean {
    const err = error as { code?: string; message?: string };
    const code = err.code || '';
    const message = err.message || '';

    return (
      code.includes('STATUS_OBJECT_NAME_COLLISION') ||
      message.includes('already exists') ||
      message.includes('EEXIST')
    );
  }

  /**
   * Ensure a directory exists, creating it recursively if needed
   */
  private async ensureDirectory(path: string): Promise<void> {
    const parts = path.split('/').filter(p => p.length > 0);

    let currentPath = '';
    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}\\${part}` : part;
      try {
        const exists = await this.client!.exists(currentPath);
        if (!exists) {
          await this.client!.mkdir(currentPath);
        }
      } catch {
        // exists() failed - try to create the directory
        try {
          await this.client!.mkdir(currentPath);
        } catch (mkdirError) {
          // Only ignore "already exists" errors; re-throw permission/connection errors
          if (!this.isAlreadyExistsError(mkdirError)) {
            throw mkdirError;
          }
        }
      }
    }
  }

  /**
   * Create a directory
   */
  async mkdir(path: string): Promise<OperationResult> {
    const connError = this.ensureConnected();
    if (connError) return connError;

    const normalized = this.normalizePath(path);

    try {
      await this.ensureDirectory(normalized.replace(/\\/g, '/'));
      return Result.success();
    } catch (error) {
      this.logger.error(`Failed to create directory ${path}`, error);
      return mapSMBError(error, 'mkdir');
    }
  }

  /**
   * Delete a file or directory
   */
  async delete(path: string, options?: DeleteOptions): Promise<OperationResult> {
    const connError = this.ensureConnected();
    if (connError) return connError;

    const normalized = this.normalizePath(path);

    try {
      // Check if it exists and what type it is
      const metadataResult = await this.getMetadata(path);
      if (metadataResult.status !== OperationStatus.Success) {
        return metadataResult as OperationResult;
      }

      const entry = metadataResult.data!;

      if (entry.type === EntryType.Directory) {
        if (options?.recursive) {
          await this.deleteDirectoryRecursive(normalized);
        } else {
          await this.client!.rmdir(normalized);
        }
      } else {
        await this.client!.unlink(normalized);
      }

      return Result.success();
    } catch (error) {
      this.logger.error(`Failed to delete ${path}`, error);
      return mapSMBError(error, 'delete');
    }
  }

  /**
   * Check if an error indicates the directory is not empty
   */
  private isDirectoryNotEmptyError(error: unknown): boolean {
    const err = error as { code?: string; message?: string };
    const code = err.code || '';
    const message = err.message || '';

    return code.includes('STATUS_DIRECTORY_NOT_EMPTY') || message.includes('not empty');
  }

  /**
   * Recursively delete a directory and its contents
   */
  private async deleteDirectoryRecursive(path: string): Promise<void> {
    const entries = (await this.client!.readdir(path, { stats: true })) as SMBDirEntry[];

    for (const entry of entries) {
      const entryPath = path ? `${path}\\${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await this.deleteDirectoryRecursive(entryPath);
      } else {
        await this.client!.unlink(entryPath);
      }
    }

    // Retry rmdir with exponential backoff to handle SMB handle caching
    // SMB servers may cache file handles briefly after operations complete,
    // causing STATUS_DIRECTORY_NOT_EMPTY errors even when contents are deleted
    const maxRetries = 5;
    const baseDelayMs = 50;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await this.client!.rmdir(path);
        return; // Success
      } catch (error) {
        if (this.isDirectoryNotEmptyError(error) && attempt < maxRetries - 1) {
          // Wait with exponential backoff: 50ms, 100ms, 200ms, 400ms
          const delay = baseDelayMs * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw error; // Re-throw on final attempt or non-retryable error
        }
      }
    }
  }

  // ==========================================================================
  // Move/Copy Operations
  // ==========================================================================

  /**
   * Native move implementation using SMB rename
   */
  protected async nativeMove(
    source: string,
    dest: string,
    _options?: TransferOptions
  ): Promise<OperationResult> {
    const connError = this.ensureConnected();
    if (connError) return connError;

    const srcNormalized = this.normalizePath(source);
    const destNormalized = this.normalizePath(dest);

    try {
      // Ensure destination parent exists
      const destParent = posix.dirname(destNormalized.replace(/\\/g, '/'));
      if (destParent && destParent !== '.' && destParent !== '/') {
        await this.ensureDirectory(destParent);
      }

      await this.client!.rename(srcNormalized, destNormalized);

      return Result.success();
    } catch (error) {
      this.logger.error(`Failed to move ${source} to ${dest}`, error);
      return mapSMBError(error, 'move');
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

    const normalized = this.normalizePath(remotePath);

    try {
      // Check if it exists and what type it is
      const metadataResult = await this.getMetadata(remotePath);
      if (metadataResult.status !== OperationStatus.Success) {
        return metadataResult as OperationResult;
      }

      const entry = metadataResult.data!;

      if (entry.type === EntryType.Directory && options?.recursive) {
        // Download directory recursively
        await this.downloadDirectoryRecursive(normalized, localPath);
      } else if (entry.type === EntryType.File) {
        // Download single file
        await fs.mkdir(dirname(localPath), { recursive: true });

        const content = await this.client!.readFile(normalized);
        await fs.writeFile(localPath, content);
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
      return mapSMBError(error, 'download');
    }
  }

  /**
   * Recursively download a directory
   */
  private async downloadDirectoryRecursive(remotePath: string, localPath: string): Promise<void> {
    await fs.mkdir(localPath, { recursive: true });

    const entries = (await this.client!.readdir(remotePath || '.', {
      stats: true,
    })) as SMBDirEntry[];

    for (const entry of entries) {
      const remoteEntryPath = remotePath ? `${remotePath}\\${entry.name}` : entry.name;
      const localEntryPath = join(localPath, entry.name);

      if (entry.isDirectory()) {
        await this.downloadDirectoryRecursive(remoteEntryPath, localEntryPath);
      } else {
        const content = await this.client!.readFile(remoteEntryPath);
        await fs.writeFile(localEntryPath, content);
      }
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

    const normalized = this.normalizePath(remotePath);

    try {
      const stats = await fs.stat(localPath);

      if (stats.isDirectory() && options?.recursive) {
        // Upload directory recursively
        await this.uploadDirectoryRecursive(localPath, normalized);
      } else if (stats.isFile()) {
        // Ensure parent directory exists
        const parentDir = posix.dirname(normalized.replace(/\\/g, '/'));
        if (parentDir && parentDir !== '.' && parentDir !== '/') {
          await this.ensureDirectory(parentDir);
        }

        // Read file and upload
        const content = await fs.readFile(localPath);
        await this.client!.writeFile(normalized, content);
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
      return mapSMBError(error, 'upload');
    }
  }

  /**
   * Recursively upload a directory
   */
  private async uploadDirectoryRecursive(localPath: string, remotePath: string): Promise<void> {
    await this.ensureDirectory(remotePath.replace(/\\/g, '/'));

    const entries = await fs.readdir(localPath, { withFileTypes: true });

    for (const entry of entries) {
      const localEntryPath = join(localPath, entry.name);
      const remoteEntryPath = remotePath ? `${remotePath}\\${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        await this.uploadDirectoryRecursive(localEntryPath, remoteEntryPath);
      } else if (entry.isFile()) {
        const content = await fs.readFile(localEntryPath);
        await this.client!.writeFile(remoteEntryPath, content);
      }
    }
  }

  // ==========================================================================
  // Internal Accessors (for testing)
  // ==========================================================================

  /**
   * Get the internal SMB client (for testing)
   * @internal
   */
  getClient(): SMB2 | null {
    return this.client;
  }
}
