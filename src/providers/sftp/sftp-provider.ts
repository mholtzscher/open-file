/**
 * SFTPProvider - SSH File Transfer Protocol Provider Implementation
 *
 * Implements the StorageProvider interface using ssh2-sftp-client.
 * Supports password, key-based, and SSH agent authentication.
 */

import Client from 'ssh2-sftp-client';
import type { ConnectOptions, FileInfo, FileStats } from 'ssh2-sftp-client';
import { promises as fs } from 'fs';
import { join, dirname, basename } from 'path';
import type { SFTPProfile } from '../types/profile.js';
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
export interface SFTPProviderLogger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, error?: Error | unknown): void;
}

/**
 * Dependencies that can be injected into SFTPProvider
 */
export interface SFTPProviderDependencies {
  /** Logger instance (defaults to getLogger()) */
  logger?: SFTPProviderLogger;
  /** Pre-configured SFTP client (for testing) */
  sftpClient?: Client;
}

// ============================================================================
// Error Mapping
// ============================================================================

/**
 * Map SFTP error codes to OperationResult status codes
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSFTPError(error: unknown, operation: string): OperationResult<any> {
  const err = error as {
    code?: string | number;
    message?: string;
    custom?: string;
  };

  const errorCode = err.code;
  const message = err.message || err.custom || `SFTP ${operation} failed`;

  // Map specific SFTP/SSH error codes
  switch (errorCode) {
    case 'ENOTFOUND':
    case 'ENOENT':
    case 2: // SSH_FX_NO_SUCH_FILE
      return Result.notFound(message);

    case 'EACCES':
    case 'EPERM':
    case 3: // SSH_FX_PERMISSION_DENIED
      return Result.permissionDenied(message);

    case 'ECONNREFUSED':
    case 'ECONNRESET':
    case 'ETIMEDOUT':
    case 'EHOSTUNREACH':
      return Result.connectionFailed(message);

    case 'ERR_GENERIC_CLIENT':
      // Check message for more specific error types
      if (message.includes('not connected') || message.includes('No SFTP')) {
        return Result.connectionFailed(message);
      }
      if (message.includes('permission') || message.includes('Permission')) {
        return Result.permissionDenied(message);
      }
      if (message.includes('No such file') || message.includes('not found')) {
        return Result.notFound(message);
      }
      return Result.error('SFTP_ERROR', message, false, error);

    case 4: // SSH_FX_FAILURE
      return Result.error('SFTP_FAILURE', message, false, error);

    case 5: // SSH_FX_BAD_MESSAGE
      return Result.error('SFTP_BAD_MESSAGE', message, false, error);

    case 'EEXIST':
    case 11: // SSH_FX_FILE_ALREADY_EXISTS
      return Result.error('ALREADY_EXISTS', message, false, error);

    default:
      return Result.error(String(errorCode || 'UNKNOWN'), message, false, error);
  }
}

/**
 * Convert SFTP rights string to numeric mode
 */
function rightsToMode(rights: FileInfo['rights']): number {
  const parseRights = (r: string): number => {
    let mode = 0;
    if (r.includes('r')) mode |= 4;
    if (r.includes('w')) mode |= 2;
    if (r.includes('x')) mode |= 1;
    return mode;
  };

  return (
    (parseRights(rights.user) << 6) | (parseRights(rights.group) << 3) | parseRights(rights.other)
  );
}

// ============================================================================
// SFTPProvider Implementation
// ============================================================================

/**
 * SFTPProvider - Storage provider implementation for SFTP
 *
 * Supports:
 * - Full CRUD operations on remote files
 * - Directory operations with recursive support
 * - POSIX permissions
 * - Symbolic link handling
 * - Multiple authentication methods (password, key, agent)
 * - Resumable transfers
 */
export class SFTPProvider extends BaseStorageProvider {
  readonly name = 'sftp';
  readonly displayName = 'SFTP';

  private client: Client;
  private connected = false;
  private connecting: Promise<OperationResult> | null = null;
  private readonly profile: SFTPProfile;
  private readonly logger: SFTPProviderLogger;
  private basePath: string;
  private readonly injectedClient?: Client;

  constructor(profile: SFTPProfile, dependencies?: SFTPProviderDependencies) {
    super();

    // Initialize dependencies with defaults
    this.logger = dependencies?.logger ?? getLogger();
    this.profile = profile;
    this.basePath = profile.config.basePath || '/';

    // Track injected client for testing (so we don't replace it)
    this.injectedClient = dependencies?.sftpClient;

    // Use injected client or create new one
    this.client = this.injectedClient ?? new Client();

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
      Capability.Resume,
      Capability.Permissions,
      Capability.Symlinks,
      Capability.Connection,
      Capability.Containers
    );

    this.logger.debug('SFTPProvider constructor called', {
      profileId: profile.id,
      host: profile.config.host,
      port: profile.config.port,
      username: profile.config.username,
      authMethod: profile.config.authMethod,
    });
  }

  // ==========================================================================
  // Connection Lifecycle
  // ==========================================================================

  /**
   * Establish connection to the SFTP server
   */
  async connect(): Promise<OperationResult> {
    // Already connected
    if (this.connected) {
      return Result.success();
    }

    // Connection in progress - wait for it
    if (this.connecting) {
      return this.connecting;
    }

    // Start connection
    this.connecting = this.doConnect();
    try {
      return await this.connecting;
    } finally {
      this.connecting = null;
    }
  }

  /**
   * Internal connection implementation
   */
  private async doConnect(): Promise<OperationResult> {
    try {
      // Create a fresh client if not using an injected one
      // This handles the case where a previous connection failed or was closed
      if (!this.injectedClient) {
        this.client = new Client();
      }

      const config = this.profile.config;

      const connectOptions: ConnectOptions = {
        host: config.host,
        port: config.port ?? 22,
        username: config.username,
      };

      // Configure authentication
      switch (config.authMethod) {
        case 'password':
          connectOptions.password = config.password;
          break;

        case 'key':
          if (config.privateKeyPath) {
            const keyContent = await fs.readFile(config.privateKeyPath, 'utf-8');
            connectOptions.privateKey = keyContent;
            if (config.passphrase) {
              connectOptions.passphrase = config.passphrase;
            }
          }
          break;

        case 'agent':
          // ssh2 will automatically use SSH_AUTH_SOCK
          connectOptions.agent = process.env.SSH_AUTH_SOCK;
          break;
      }

      this.logger.debug('Connecting to SFTP server', {
        host: config.host,
        port: connectOptions.port,
        username: config.username,
        authMethod: config.authMethod,
      });

      await this.client.connect(connectOptions);
      this.connected = true;

      this.logger.info('Connected to SFTP server', {
        host: config.host,
      });

      return Result.success();
    } catch (error) {
      this.logger.error('Failed to connect to SFTP server', error);
      return mapSFTPError(error, 'connect');
    }
  }

  /**
   * Close connection to the SFTP server
   */
  async disconnect(): Promise<void> {
    if (this.connected) {
      try {
        await this.client.end();
      } catch (error) {
        this.logger.warn('Error during disconnect', { error });
      }
      this.connected = false;
      this.logger.info('Disconnected from SFTP server');
    }
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  // ==========================================================================
  // Container Operations (Virtual - SFTP has no real container concept)
  // ==========================================================================

  /**
   * List "containers" for SFTP.
   * Since SFTP doesn't have buckets, we return a single virtual container
   * representing the base path configured in the profile.
   */
  async listContainers(): Promise<OperationResult<Entry[]>> {
    // Return a single virtual "container" representing the SFTP root/base path
    const containerName =
      this.basePath === '/' ? 'root' : this.basePath.split('/').filter(Boolean).pop() || 'sftp';

    const entry: Entry = {
      id: generateEntryId(),
      name: containerName,
      type: EntryType.Directory,
      path: this.basePath,
      modified: new Date(),
      metadata: {
        providerData: {
          isVirtualContainer: true,
          basePath: this.basePath,
        },
      },
    };

    return Result.success([entry]);
  }

  /**
   * Set the current container (base path) for SFTP.
   * This updates the base path that all operations are relative to.
   */
  setContainer(path: string): void {
    this.basePath = path;
    this.logger.debug('SFTPProvider base path changed', { basePath: path });
  }

  /**
   * Get the current container (base path)
   */
  getContainer(): string | undefined {
    return this.basePath;
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
    if (!this.connected) {
      return Result.connectionFailed('Not connected to SFTP server. Call connect() first.');
    }
    return null;
  }

  /**
   * Convert FileInfo to Entry
   */
  private fileInfoToEntry(info: FileInfo, parentPath: string): Entry {
    const fullPath = join(parentPath, info.name);
    let entryType: EntryType;

    switch (info.type) {
      case 'd':
        entryType = EntryType.Directory;
        break;
      case 'l':
        entryType = EntryType.Symlink;
        break;
      default:
        entryType = EntryType.File;
    }

    return {
      id: generateEntryId(),
      name: info.name,
      type: entryType,
      path: fullPath,
      size: info.type === '-' ? info.size : undefined,
      modified: new Date(info.modifyTime),
      metadata: {
        permissions: rightsToMode(info.rights),
        accessed: new Date(info.accessTime),
        providerData: {
          owner: info.owner,
          group: info.group,
        },
      },
    };
  }

  /**
   * Convert FileStats to Entry
   */
  private fileStatsToEntry(stats: FileStats, path: string): Entry {
    const name = basename(path);
    let entryType: EntryType;

    if (stats.isDirectory) {
      entryType = EntryType.Directory;
    } else if (stats.isFile) {
      entryType = EntryType.File;
    } else {
      // Could be symlink or other special file
      entryType = EntryType.File;
    }

    return {
      id: generateEntryId(),
      name,
      type: entryType,
      path,
      size: stats.isFile ? stats.size : undefined,
      modified: new Date(stats.modifyTime),
      metadata: {
        permissions: stats.mode & 0o777,
        accessed: new Date(stats.accessTime),
        providerData: {
          uid: stats.uid,
          gid: stats.gid,
          mode: stats.mode,
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
      return mapSFTPError(error, 'list');
    }
  }

  /**
   * Get metadata for a specific entry
   */
  async getMetadata(path: string): Promise<OperationResult<Entry>> {
    const connError = this.ensureConnected();
    if (connError) return connError;

    const resolved = this.resolvePath(path);

    try {
      const stats = await this.client.stat(resolved);
      return Result.success(this.fileStatsToEntry(stats, resolved));
    } catch (error) {
      this.logger.error(`Failed to get metadata for ${path}`, error);
      return mapSFTPError(error, 'getMetadata');
    }
  }

  /**
   * Check if a path exists
   */
  async exists(path: string): Promise<OperationResult<boolean>> {
    const connError = this.ensureConnected();
    if (connError) return connError;

    const resolved = this.resolvePath(path);

    try {
      const result = await this.client.exists(resolved);
      return Result.success(result !== false);
    } catch (error) {
      this.logger.error(`Failed to check existence of ${path}`, error);
      return mapSFTPError(error, 'exists');
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
      // Use get() which returns a Buffer when no destination is provided
      const result = await this.client.get(resolved);

      if (Buffer.isBuffer(result)) {
        return Result.success(result);
      }

      // If we got a string (shouldn't happen with no dst), convert it
      if (typeof result === 'string') {
        return Result.success(Buffer.from(result));
      }

      return Result.error(
        'UNEXPECTED_RESULT',
        'Unexpected result type from SFTP get',
        false
      ) as OperationResult<Buffer>;
    } catch (error) {
      this.logger.error(`Failed to read ${path}`, error);
      return mapSFTPError(error, 'read');
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
      await this.client.put(body, resolved);
      return Result.success();
    } catch (error) {
      this.logger.error(`Failed to write ${path}`, error);
      return mapSFTPError(error, 'write');
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
      await this.client.mkdir(resolved, true);
      return Result.success();
    } catch (error) {
      this.logger.error(`Failed to create directory ${path}`, error);
      return mapSFTPError(error, 'mkdir');
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
      // Check if it's a directory
      const stats = await this.client.stat(resolved);

      if (stats.isDirectory) {
        // Use rmdir with recursive option
        await this.client.rmdir(resolved, options?.recursive ?? false);
      } else {
        await this.client.delete(resolved);
      }

      return Result.success();
    } catch (error) {
      this.logger.error(`Failed to delete ${path}`, error);
      return mapSFTPError(error, 'delete');
    }
  }

  // ==========================================================================
  // Move/Copy Operations
  // ==========================================================================

  /**
   * Native move implementation using SFTP rename
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
      // Try posixRename first (more reliable for cross-directory moves)
      try {
        await this.client.posixRename(srcResolved, destResolved);
      } catch {
        // Fall back to regular rename
        await this.client.rename(srcResolved, destResolved);
      }

      return Result.success();
    } catch (error) {
      this.logger.error(`Failed to move ${source} to ${dest}`, error);
      return mapSFTPError(error, 'move');
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
      const exists = await this.client.exists(resolved);

      if (exists === 'd' && options?.recursive) {
        // Download directory recursively
        await this.client.downloadDir(resolved, localPath);
      } else if (exists === '-' || exists === 'l') {
        // Download single file using fastGet for better performance
        await fs.mkdir(dirname(localPath), { recursive: true });

        const transferOptions = options?.onProgress
          ? {
              step: (transferred: number, _chunk: number, total: number) => {
                options.onProgress!({
                  operation: 'download',
                  bytesTransferred: transferred,
                  totalBytes: total,
                  percentage: Math.round((transferred / total) * 100),
                  currentFile: remotePath,
                });
              },
            }
          : undefined;

        await this.client.fastGet(resolved, localPath, transferOptions);
      } else {
        return Result.notFound(`Path not found: ${remotePath}`);
      }

      return Result.success();
    } catch (error) {
      this.logger.error(`Failed to download ${remotePath} to ${localPath}`, error);
      return mapSFTPError(error, 'download');
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
        await this.client.uploadDir(localPath, resolved);
      } else if (stats.isFile()) {
        // Ensure parent directory exists
        const parentDir = dirname(resolved);
        await this.client.mkdir(parentDir, true);

        // Upload single file using fastPut for better performance
        const transferOptions = options?.onProgress
          ? {
              step: (transferred: number, _chunk: number, total: number) => {
                options.onProgress!({
                  operation: 'upload',
                  bytesTransferred: transferred,
                  totalBytes: total,
                  percentage: Math.round((transferred / total) * 100),
                  currentFile: localPath,
                });
              },
            }
          : undefined;

        await this.client.fastPut(localPath, resolved, transferOptions);
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
      return mapSFTPError(error, 'upload');
    }
  }

  // ==========================================================================
  // Advanced Operations
  // ==========================================================================

  /**
   * Set POSIX permissions on a file/directory
   */
  async setPermissions(path: string, mode: number): Promise<OperationResult> {
    const connError = this.ensureConnected();
    if (connError) return connError;

    const resolved = this.resolvePath(path);

    try {
      await this.client.chmod(resolved, mode);
      return Result.success();
    } catch (error) {
      this.logger.error(`Failed to set permissions on ${path}`, error);
      return mapSFTPError(error, 'setPermissions');
    }
  }

  /**
   * Read the target of a symbolic link
   */
  async readSymlink(path: string): Promise<OperationResult<string>> {
    const connError = this.ensureConnected();
    if (connError) return connError;

    const resolved = this.resolvePath(path);

    try {
      const target = await this.client.realPath(resolved);
      return Result.success(target);
    } catch (error) {
      this.logger.error(`Failed to read symlink ${path}`, error);
      return mapSFTPError(error, 'readSymlink');
    }
  }

  // ==========================================================================
  // Internal Accessors (for testing)
  // ==========================================================================

  /**
   * Get the internal SFTP client (for testing)
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
