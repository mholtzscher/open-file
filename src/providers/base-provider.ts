/**
 * BaseStorageProvider Abstract Class
 *
 * Provides common functionality for all storage providers:
 * - Capability management
 * - Default unimplemented responses for optional methods
 * - Fallback strategies for move() and copy()
 *
 * Concrete providers extend this class and override methods as needed.
 */

import { Entry } from '../types/entry.js';
import { Capability } from './types/capabilities.js';
import { OperationResult, Result, isSuccess } from './types/result.js';
import {
  StorageProvider,
  ListOptions,
  ListResult,
  ReadOptions,
  WriteOptions,
  DeleteOptions,
  TransferOptions,
} from './provider.js';
import { ProviderType } from './types/profile.js';

/**
 * Abstract base class for storage providers
 *
 * Provides:
 * - Capability management (hasCapability, addCapability)
 * - Default unimplemented responses for optional methods
 * - Fallback strategies (e.g., move = copy + delete)
 */
export abstract class BaseStorageProvider implements StorageProvider {
  /**
   * Provider identifier (e.g., 's3', 'sftp', 'gcs')
   * Must be overridden by concrete implementations
   */
  abstract readonly name: ProviderType;

  /**
   * Human-readable display name (e.g., 'Amazon S3', 'SSH File Transfer')
   * Must be overridden by concrete implementations
   */
  abstract readonly displayName: string;

  /**
   * Set of capabilities supported by this provider
   * Subclasses should call addCapability() in their constructor
   */
  protected capabilities = new Set<Capability>();

  // ==========================================================================
  // Capability Management
  // ==========================================================================

  /**
   * Check if a specific capability is supported
   * @param cap - The capability to check
   * @returns true if the capability is supported
   */
  hasCapability(cap: Capability): boolean {
    return this.capabilities.has(cap);
  }

  /**
   * Add capabilities to this provider
   * Protected - only callable from subclass constructors
   * @param caps - Capabilities to add
   */
  protected addCapability(...caps: Capability[]): void {
    for (const cap of caps) {
      this.capabilities.add(cap);
    }
  }

  /**
   * Remove a capability from this provider
   * Protected - for runtime capability changes (e.g., after connection)
   * @param cap - Capability to remove
   */
  protected removeCapability(cap: Capability): void {
    this.capabilities.delete(cap);
  }

  // ==========================================================================
  // Abstract Methods (must be implemented by subclasses)
  // ==========================================================================

  /**
   * List contents of a directory
   * Must be implemented by all providers
   */
  abstract list(path: string, options?: ListOptions): Promise<OperationResult<ListResult>>;

  /**
   * Get metadata for a file or directory
   * Must be implemented by all providers
   */
  abstract getMetadata(path: string): Promise<OperationResult<Entry>>;

  /**
   * Read file contents
   * Must be implemented by all providers
   */
  abstract read(path: string, options?: ReadOptions): Promise<OperationResult<Buffer>>;

  // ==========================================================================
  // Default Implementations (return unimplemented)
  // Subclasses should override these if they support the operations
  // ==========================================================================

  /**
   * Write content to a file
   * Default: returns unimplemented
   * Override if provider has Capability.Write
   */
  write(
    _path: string,
    _content: Buffer | string,
    _options?: WriteOptions
  ): Promise<OperationResult> {
    return Promise.resolve(Result.unimplemented('write'));
  }

  /**
   * Create a directory
   * Default: returns unimplemented
   * Override if provider has Capability.Mkdir
   */
  mkdir(_path: string): Promise<OperationResult> {
    return Promise.resolve(Result.unimplemented('mkdir'));
  }

  /**
   * Delete a file or directory
   * Default: returns unimplemented
   * Override if provider has Capability.Delete
   */
  delete(_path: string, _options?: DeleteOptions): Promise<OperationResult> {
    return Promise.resolve(Result.unimplemented('delete'));
  }

  /**
   * Download a remote file to local filesystem
   * Default: returns unimplemented
   * Override if provider has Capability.Download
   */
  downloadToLocal(
    _remotePath: string,
    _localPath: string,
    _options?: TransferOptions
  ): Promise<OperationResult> {
    return Promise.resolve(Result.unimplemented('downloadToLocal'));
  }

  /**
   * Upload a local file to remote storage
   * Default: returns unimplemented
   * Override if provider has Capability.Upload
   */
  uploadFromLocal(
    _localPath: string,
    _remotePath: string,
    _options?: TransferOptions
  ): Promise<OperationResult> {
    return Promise.resolve(Result.unimplemented('uploadFromLocal'));
  }

  // ==========================================================================
  // Move with Fallback Strategy
  // ==========================================================================

  /**
   * Move or rename a file/directory
   *
   * Fallback strategy:
   * 1. If provider has Capability.Move, use nativeMove()
   * 2. Else if provider has Copy + Delete, use copy() + delete()
   * 3. Else if provider has Read + Write + Delete, use read() + write() + delete()
   * 4. Else return unimplemented
   */
  async move(source: string, dest: string, options?: TransferOptions): Promise<OperationResult> {
    // Strategy 1: Native move
    if (this.hasCapability(Capability.Move)) {
      return this.nativeMove(source, dest, options);
    }

    // Strategy 2: Copy + Delete
    if (this.hasCapability(Capability.Copy) && this.hasCapability(Capability.Delete)) {
      const copyResult = await this.copy(source, dest, options);
      if (!isSuccess(copyResult)) {
        return copyResult;
      }
      return this.delete(source, { recursive: options?.recursive });
    }

    // Strategy 3: Read + Write + Delete (for simple file moves)
    if (
      this.hasCapability(Capability.Read) &&
      this.hasCapability(Capability.Write) &&
      this.hasCapability(Capability.Delete)
    ) {
      const readResult = await this.read(source);
      if (!isSuccess(readResult)) {
        return readResult as OperationResult;
      }

      const writeResult = await this.write(dest, readResult.data);
      if (!isSuccess(writeResult)) {
        return writeResult;
      }

      return this.delete(source);
    }

    return Result.unimplemented('move');
  }

  /**
   * Native move implementation
   * Override this if the provider has native move support
   * @param source - Source path
   * @param dest - Destination path
   * @param options - Transfer options
   */
  protected nativeMove(
    _source: string,
    _dest: string,
    _options?: TransferOptions
  ): Promise<OperationResult> {
    return Promise.resolve(Result.unimplemented('move'));
  }

  // ==========================================================================
  // Copy with Fallback Strategy
  // ==========================================================================

  /**
   * Copy a file/directory
   *
   * Fallback strategy:
   * 1. If provider has Capability.Copy or ServerSideCopy, use nativeCopy()
   * 2. Else if provider has Read + Write, use read() + write()
   * 3. Else return unimplemented
   */
  async copy(source: string, dest: string, options?: TransferOptions): Promise<OperationResult> {
    // Strategy 1: Native copy (server-side if available)
    if (this.hasCapability(Capability.Copy) || this.hasCapability(Capability.ServerSideCopy)) {
      return this.nativeCopy(source, dest, options);
    }

    // Strategy 2: Read + Write
    if (this.hasCapability(Capability.Read) && this.hasCapability(Capability.Write)) {
      const readResult = await this.read(source);
      if (!isSuccess(readResult)) {
        return readResult as OperationResult;
      }

      return this.write(dest, readResult.data);
    }

    return Result.unimplemented('copy');
  }

  /**
   * Native copy implementation
   * Override this if the provider has native copy support
   * @param source - Source path
   * @param dest - Destination path
   * @param options - Transfer options
   */
  protected nativeCopy(
    _source: string,
    _dest: string,
    _options?: TransferOptions
  ): Promise<OperationResult> {
    return Promise.resolve(Result.unimplemented('copy'));
  }
}
