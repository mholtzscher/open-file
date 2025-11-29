/**
 * LocalProvider - Local Filesystem Storage Provider
 *
 * Provides access to the local filesystem using Node.js fs module.
 * This is a simple wrapper that implements the StorageProvider interface
 * for browsing and managing local files.
 */

import {
  existsSync,
  statSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  renameSync,
  copyFileSync,
  lstatSync,
  readlinkSync,
} from 'fs';
import { join, basename, dirname } from 'path';
import { homedir } from 'os';
import { randomUUID } from 'crypto';

import { Entry, EntryType } from '../../types/entry.js';
import { ListResult } from '../../types/list.js';
import { Capability } from '../types/capabilities.js';
import { OperationResult, Result, OperationStatus } from '../types/result.js';
import { BaseStorageProvider } from '../base-provider.js';
import type { LocalProfile } from '../types/profile.js';
import type {
  ListOptions,
  ReadOptions,
  WriteOptions,
  DeleteOptions,
  TransferOptions,
} from '../provider.js';

/**
 * Logger interface for LocalProvider
 */
export interface LocalProviderLogger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, error?: Error | unknown): void;
}

/**
 * Dependencies that can be injected for testing
 */
export interface LocalProviderDependencies {
  logger?: LocalProviderLogger;
}

/**
 * LocalProvider implements StorageProvider for local filesystem access
 */
export class LocalProvider extends BaseStorageProvider {
  readonly name = 'local';
  readonly displayName = 'Local Filesystem';

  private readonly basePath: string;
  private readonly logger?: LocalProviderLogger;

  constructor(profile: LocalProfile, deps?: LocalProviderDependencies) {
    super();

    // Set base path from profile config, defaulting to home directory
    this.basePath = profile.config.basePath || homedir();
    this.logger = deps?.logger;

    // Register capabilities - local filesystem supports most operations
    this.addCapability(
      Capability.List,
      Capability.Read,
      Capability.Write,
      Capability.Delete,
      Capability.Mkdir,
      Capability.Rmdir,
      Capability.Copy,
      Capability.Move,
      Capability.Download,
      Capability.Upload,
      Capability.Permissions,
      Capability.Symlinks
    );

    this.logger?.debug('LocalProvider initialized', { basePath: this.basePath });
  }

  /**
   * Resolve a path relative to the base path
   */
  private resolvePath(path: string): string {
    // Handle empty path or root
    if (!path || path === '/' || path === '.') {
      return this.basePath;
    }

    // If path starts with /, treat it as relative to basePath
    if (path.startsWith('/')) {
      return join(this.basePath, path);
    }

    return join(this.basePath, path);
  }

  /**
   * Convert fs.Stats to Entry
   */
  private statsToEntry(fullPath: string, name: string): Entry {
    try {
      // Use lstat to not follow symlinks
      const lstats = lstatSync(fullPath);

      let type: EntryType;
      let symlinkTarget: string | undefined;

      if (lstats.isSymbolicLink()) {
        type = EntryType.Symlink;
        try {
          symlinkTarget = readlinkSync(fullPath);
        } catch {
          // Can't read symlink target
        }
      } else if (lstats.isDirectory()) {
        type = EntryType.Directory;
      } else {
        type = EntryType.File;
      }

      const relativePath = fullPath.replace(this.basePath, '') || '/';

      return {
        id: randomUUID(),
        name,
        path: relativePath,
        type,
        size: lstats.size,
        modified: lstats.mtime,
        metadata: {
          permissions: lstats.mode,
          accessed: lstats.atime,
          createdAt: lstats.birthtime,
          symlinkTarget,
        },
      };
    } catch {
      // Return a basic entry if we can't stat
      const relativePath = fullPath.replace(this.basePath, '') || '/';
      return {
        id: randomUUID(),
        name,
        path: relativePath,
        type: EntryType.File,
        size: 0,
        modified: new Date(),
      };
    }
  }

  /**
   * List contents of a directory
   */
  async list(path: string, options?: ListOptions): Promise<OperationResult<ListResult>> {
    const fullPath = this.resolvePath(path);

    try {
      if (!existsSync(fullPath)) {
        return Result.notFound(path) as OperationResult<ListResult>;
      }

      const stats = statSync(fullPath);
      if (!stats.isDirectory()) {
        return Result.error(
          'NOT_DIRECTORY',
          `Path is not a directory: ${path}`,
          false
        ) as OperationResult<ListResult>;
      }

      const entries = readdirSync(fullPath);
      const items: Entry[] = [];

      for (const name of entries) {
        // Skip hidden files if not requested
        if (!options?.includeHidden && name.startsWith('.')) {
          continue;
        }

        const itemPath = join(fullPath, name);
        items.push(this.statsToEntry(itemPath, name));
      }

      // Sort: directories first, then by name
      items.sort((a, b) => {
        if (a.type === EntryType.Directory && b.type !== EntryType.Directory) return -1;
        if (a.type !== EntryType.Directory && b.type === EntryType.Directory) return 1;
        return a.name.localeCompare(b.name);
      });

      return Result.success({
        entries: items,
        hasMore: false,
        path,
      });
    } catch (err) {
      const error = err as NodeJS.ErrnoException;
      if (error.code === 'EACCES') {
        return Result.permissionDenied(path) as OperationResult<ListResult>;
      }
      return Result.error(
        'LIST_ERROR',
        `Failed to list directory: ${error.message}`,
        false,
        err
      ) as OperationResult<ListResult>;
    }
  }

  /**
   * Get metadata for a file or directory
   */
  async getMetadata(path: string): Promise<OperationResult<Entry>> {
    const fullPath = this.resolvePath(path);

    try {
      if (!existsSync(fullPath)) {
        return Result.notFound(path) as OperationResult<Entry>;
      }

      const name = basename(fullPath) || '/';
      return Result.success(this.statsToEntry(fullPath, name));
    } catch (err) {
      const error = err as NodeJS.ErrnoException;
      if (error.code === 'EACCES') {
        return Result.permissionDenied(path) as OperationResult<Entry>;
      }
      return Result.error(
        'METADATA_ERROR',
        `Failed to get metadata: ${error.message}`,
        false,
        err
      ) as OperationResult<Entry>;
    }
  }

  /**
   * Check if a path exists
   */
  async exists(path: string): Promise<OperationResult<boolean>> {
    const fullPath = this.resolvePath(path);

    try {
      return Result.success(existsSync(fullPath));
    } catch (err) {
      return Result.error(
        'EXISTS_ERROR',
        `Failed to check existence: ${(err as Error).message}`,
        false,
        err
      ) as OperationResult<boolean>;
    }
  }

  /**
   * Read file contents
   */
  async read(path: string, options?: ReadOptions): Promise<OperationResult<Buffer>> {
    const fullPath = this.resolvePath(path);

    try {
      if (!existsSync(fullPath)) {
        return Result.notFound(path) as OperationResult<Buffer>;
      }

      const stats = statSync(fullPath);
      if (stats.isDirectory()) {
        return Result.error(
          'IS_DIRECTORY',
          `Cannot read directory as file: ${path}`,
          false
        ) as OperationResult<Buffer>;
      }

      let content: Buffer;
      if (options?.offset !== undefined || options?.length !== undefined) {
        // Partial read
        const buffer = readFileSync(fullPath);
        const start = options.offset || 0;
        const end = options.length ? start + options.length : buffer.length;
        content = buffer.subarray(start, end);
      } else {
        content = readFileSync(fullPath);
      }

      return Result.success(content);
    } catch (err) {
      const error = err as NodeJS.ErrnoException;
      if (error.code === 'EACCES') {
        return Result.permissionDenied(path) as OperationResult<Buffer>;
      }
      return Result.error(
        'READ_ERROR',
        `Failed to read file: ${error.message}`,
        false,
        err
      ) as OperationResult<Buffer>;
    }
  }

  /**
   * Write content to a file
   */
  async write(
    path: string,
    content: Buffer | string,
    _options?: WriteOptions
  ): Promise<OperationResult> {
    const fullPath = this.resolvePath(path);

    try {
      // Ensure parent directory exists
      const parentDir = dirname(fullPath);
      if (!existsSync(parentDir)) {
        mkdirSync(parentDir, { recursive: true });
      }

      writeFileSync(fullPath, content);
      return Result.success();
    } catch (err) {
      const error = err as NodeJS.ErrnoException;
      if (error.code === 'EACCES') {
        return Result.permissionDenied(path);
      }
      return Result.error('WRITE_ERROR', `Failed to write file: ${error.message}`, false, err);
    }
  }

  /**
   * Create a directory
   */
  async mkdir(path: string): Promise<OperationResult> {
    const fullPath = this.resolvePath(path);

    try {
      if (existsSync(fullPath)) {
        return Result.error('ALREADY_EXISTS', `Directory already exists: ${path}`, false);
      }

      mkdirSync(fullPath, { recursive: true });
      return Result.success();
    } catch (err) {
      const error = err as NodeJS.ErrnoException;
      if (error.code === 'EACCES') {
        return Result.permissionDenied(path);
      }
      return Result.error(
        'MKDIR_ERROR',
        `Failed to create directory: ${error.message}`,
        false,
        err
      );
    }
  }

  /**
   * Delete a file or directory
   */
  async delete(path: string, options?: DeleteOptions): Promise<OperationResult> {
    const fullPath = this.resolvePath(path);

    try {
      if (!existsSync(fullPath)) {
        return Result.notFound(path);
      }

      const stats = statSync(fullPath);

      // For directories, we need recursive even for empty ones with rmSync
      // because rmSync with recursive:false can't delete directories
      const shouldRecurse = stats.isDirectory() || (options?.recursive ?? false);

      rmSync(fullPath, { recursive: shouldRecurse, force: true });
      return Result.success();
    } catch (err) {
      const error = err as NodeJS.ErrnoException;
      if (error.code === 'EACCES') {
        return Result.permissionDenied(path);
      }
      if (error.code === 'ENOTEMPTY') {
        return Result.error(
          'NOT_EMPTY',
          `Directory is not empty: ${path}. Use recursive option.`,
          false
        );
      }
      return Result.error('DELETE_ERROR', `Failed to delete: ${error.message}`, false, err);
    }
  }

  /**
   * Native move implementation using rename
   */
  protected async nativeMove(
    source: string,
    dest: string,
    _options?: TransferOptions
  ): Promise<OperationResult> {
    const sourcePath = this.resolvePath(source);
    const destPath = this.resolvePath(dest);

    try {
      if (!existsSync(sourcePath)) {
        return Result.notFound(source);
      }

      // Ensure parent directory exists
      const parentDir = dirname(destPath);
      if (!existsSync(parentDir)) {
        mkdirSync(parentDir, { recursive: true });
      }

      renameSync(sourcePath, destPath);
      return Result.success();
    } catch (err) {
      const error = err as NodeJS.ErrnoException;
      if (error.code === 'EACCES') {
        return Result.permissionDenied(source);
      }
      // Cross-device move - fall back to copy + delete
      if (error.code === 'EXDEV') {
        const copyResult = await this.nativeCopy(source, dest, _options);
        if (copyResult.status !== OperationStatus.Success) {
          return copyResult;
        }
        return this.delete(source, { recursive: true });
      }
      return Result.error('MOVE_ERROR', `Failed to move: ${error.message}`, false, err);
    }
  }

  /**
   * Native copy implementation
   */
  protected async nativeCopy(
    source: string,
    dest: string,
    options?: TransferOptions
  ): Promise<OperationResult> {
    const sourcePath = this.resolvePath(source);
    const destPath = this.resolvePath(dest);

    try {
      if (!existsSync(sourcePath)) {
        return Result.notFound(source);
      }

      const stats = statSync(sourcePath);

      // Ensure parent directory exists
      const parentDir = dirname(destPath);
      if (!existsSync(parentDir)) {
        mkdirSync(parentDir, { recursive: true });
      }

      if (stats.isDirectory()) {
        if (!options?.recursive) {
          return Result.error(
            'IS_DIRECTORY',
            `Cannot copy directory without recursive option`,
            false
          );
        }
        // Recursive directory copy
        await this.copyDirectory(sourcePath, destPath);
      } else {
        copyFileSync(sourcePath, destPath);
      }

      return Result.success();
    } catch (err) {
      const error = err as NodeJS.ErrnoException;
      if (error.code === 'EACCES') {
        return Result.permissionDenied(source);
      }
      return Result.error('COPY_ERROR', `Failed to copy: ${error.message}`, false, err);
    }
  }

  /**
   * Recursively copy a directory
   */
  private async copyDirectory(source: string, dest: string): Promise<void> {
    mkdirSync(dest, { recursive: true });

    const entries = readdirSync(source);
    for (const entry of entries) {
      const srcPath = join(source, entry);
      const dstPath = join(dest, entry);
      const stats = statSync(srcPath);

      if (stats.isDirectory()) {
        await this.copyDirectory(srcPath, dstPath);
      } else {
        copyFileSync(srcPath, dstPath);
      }
    }
  }

  /**
   * Download is a no-op for local filesystem (just copy)
   */
  async downloadToLocal(
    remotePath: string,
    localPath: string,
    options?: TransferOptions
  ): Promise<OperationResult> {
    return this.nativeCopy(remotePath, localPath, options);
  }

  /**
   * Upload is a no-op for local filesystem (just copy)
   */
  async uploadFromLocal(
    localPath: string,
    remotePath: string,
    options?: TransferOptions
  ): Promise<OperationResult> {
    // For local provider, localPath is an absolute path, remotePath is relative to basePath
    const destPath = this.resolvePath(remotePath);

    try {
      if (!existsSync(localPath)) {
        return Result.notFound(localPath);
      }

      const stats = statSync(localPath);

      // Ensure parent directory exists
      const parentDir = dirname(destPath);
      if (!existsSync(parentDir)) {
        mkdirSync(parentDir, { recursive: true });
      }

      if (stats.isDirectory()) {
        if (!options?.recursive) {
          return Result.error(
            'IS_DIRECTORY',
            `Cannot upload directory without recursive option`,
            false
          );
        }
        await this.copyDirectory(localPath, destPath);
      } else {
        copyFileSync(localPath, destPath);
      }

      return Result.success();
    } catch (err) {
      const error = err as NodeJS.ErrnoException;
      if (error.code === 'EACCES') {
        return Result.permissionDenied(localPath);
      }
      return Result.error('UPLOAD_ERROR', `Failed to upload: ${error.message}`, false, err);
    }
  }
}
