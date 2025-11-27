/**
 * StorageProvider Interface
 *
 * Unified storage provider interface supporting multiple backends.
 * All operations return OperationResult to handle success, errors,
 * and unimplemented operations explicitly.
 */

import { Entry } from '../types/entry.js';
import { Capability } from './types/capabilities.js';
import { OperationResult } from './types/result.js';

// ============================================================================
// List Operations
// ============================================================================

/**
 * Options for listing directory contents
 */
export interface ListOptions {
  /** Maximum number of entries to return */
  limit?: number;
  /** Token for pagination (from previous ListResult) */
  continuationToken?: string;
  /** Include subdirectories recursively */
  recursive?: boolean;
}

/**
 * Result of a list operation
 */
export interface ListResult {
  /** Entries in the directory */
  entries: Entry[];
  /** Token for fetching next page (if hasMore is true) */
  continuationToken?: string;
  /** Whether more entries are available */
  hasMore: boolean;
}

// ============================================================================
// Read/Write Operations
// ============================================================================

/**
 * Options for reading file contents
 */
export interface ReadOptions {
  /** Byte offset to start reading from */
  offset?: number;
  /** Number of bytes to read */
  length?: number;
  /** Progress callback for long reads */
  onProgress?: ProgressCallback;
}

/**
 * Options for writing file contents
 */
export interface WriteOptions {
  /** Content type / MIME type */
  contentType?: string;
  /** Custom metadata key-value pairs */
  metadata?: Record<string, string>;
  /** Progress callback for long writes */
  onProgress?: ProgressCallback;
}

/**
 * Options for delete operations
 */
export interface DeleteOptions {
  /** Delete directories recursively */
  recursive?: boolean;
  /** Progress callback for recursive deletes */
  onProgress?: ProgressCallback;
}

// ============================================================================
// Transfer Operations
// ============================================================================

/**
 * Options for copy/move and local filesystem transfers
 */
export interface TransferOptions {
  /** Transfer directories recursively */
  recursive?: boolean;
  /** Overwrite existing files at destination */
  overwrite?: boolean;
  /** Progress callback for long transfers */
  onProgress?: ProgressCallback;
}

/**
 * Progress event for long-running operations
 */
export interface ProgressEvent {
  /** Type of operation (e.g., 'upload', 'download', 'copy') */
  operation: string;
  /** Bytes transferred so far */
  bytesTransferred: number;
  /** Total bytes to transfer (if known) */
  totalBytes?: number;
  /** Percentage complete (0-100) */
  percentage: number;
  /** Current file being processed (for recursive operations) */
  currentFile?: string;
}

/**
 * Callback for receiving progress updates
 */
export type ProgressCallback = (event: ProgressEvent) => void;

// ============================================================================
// StorageProvider Interface
// ============================================================================

/**
 * Unified storage provider interface
 *
 * All operations return OperationResult to handle:
 * - Success with data
 * - Unimplemented (provider doesn't support this operation)
 * - Errors with context
 *
 * Providers explicitly declare their capabilities via getCapabilities().
 * The UI can introspect and adapt based on what operations are supported.
 */
export interface StorageProvider {
  /** Provider identifier (e.g., 's3', 'sftp', 'gcs') */
  readonly name: string;
  /** Human-readable display name (e.g., 'Amazon S3', 'SSH File Transfer') */
  readonly displayName: string;

  // ==========================================================================
  // Capability Introspection
  // ==========================================================================

  /**
   * Get all capabilities supported by this provider
   * @returns Set of supported capabilities
   */
  getCapabilities(): Set<Capability>;

  /**
   * Check if a specific capability is supported
   * @param cap - The capability to check
   * @returns true if the capability is supported
   */
  hasCapability(cap: Capability): boolean;

  // ==========================================================================
  // Connection Lifecycle (for connection-oriented protocols)
  // ==========================================================================

  /**
   * Establish connection to the storage provider
   * Optional - only needed for connection-oriented protocols (SFTP, FTP, SMB)
   * Cloud providers (S3, GCS) are typically stateless per-request
   */
  connect?(): Promise<OperationResult>;

  /**
   * Close connection to the storage provider
   * Optional - only needed for connection-oriented protocols
   */
  disconnect?(): Promise<void>;

  /**
   * Check if currently connected
   * Optional - only needed for connection-oriented protocols
   */
  isConnected?(): boolean;

  // ==========================================================================
  // Core Read Operations (all providers should implement these)
  // ==========================================================================

  /**
   * List contents of a directory
   * @param path - Directory path to list
   * @param options - Pagination and filtering options
   * @returns List of entries with pagination info
   */
  list(path: string, options?: ListOptions): Promise<OperationResult<ListResult>>;

  /**
   * Get metadata for a file or directory
   * @param path - Path to the entry
   * @returns Entry metadata
   */
  getMetadata(path: string): Promise<OperationResult<Entry>>;

  /**
   * Check if a path exists
   * @param path - Path to check
   * @returns true if the path exists
   */
  exists(path: string): Promise<OperationResult<boolean>>;

  /**
   * Read file contents
   * @param path - Path to the file
   * @param options - Read options (offset, length, progress)
   * @returns File contents as Buffer
   */
  read(path: string, options?: ReadOptions): Promise<OperationResult<Buffer>>;

  // ==========================================================================
  // Mutable Operations
  // ==========================================================================

  /**
   * Write content to a file
   * @param path - Path to write to
   * @param content - Content to write (Buffer, string, or stream)
   * @param options - Write options (contentType, metadata, progress)
   */
  write(path: string, content: Buffer | string, options?: WriteOptions): Promise<OperationResult>;

  /**
   * Create a directory
   * @param path - Directory path to create
   */
  mkdir(path: string): Promise<OperationResult>;

  /**
   * Delete a file or directory
   * @param path - Path to delete
   * @param options - Delete options (recursive for directories)
   */
  delete(path: string, options?: DeleteOptions): Promise<OperationResult>;

  // ==========================================================================
  // Move/Copy Operations
  // ==========================================================================

  /**
   * Move or rename a file/directory
   * Base class provides fallback: copy + delete if no native move
   * @param source - Source path
   * @param dest - Destination path
   * @param options - Transfer options
   */
  move(source: string, dest: string, options?: TransferOptions): Promise<OperationResult>;

  /**
   * Copy a file/directory
   * Base class provides fallback: read + write if no native copy
   * @param source - Source path
   * @param dest - Destination path
   * @param options - Transfer options
   */
  copy(source: string, dest: string, options?: TransferOptions): Promise<OperationResult>;

  // ==========================================================================
  // Local Filesystem Transfers
  // ==========================================================================

  /**
   * Download a remote file to local filesystem
   * @param remotePath - Path on the remote storage
   * @param localPath - Path on local filesystem
   * @param options - Transfer options (progress callback)
   */
  downloadToLocal(
    remotePath: string,
    localPath: string,
    options?: TransferOptions
  ): Promise<OperationResult>;

  /**
   * Upload a local file to remote storage
   * @param localPath - Path on local filesystem
   * @param remotePath - Path on the remote storage
   * @param options - Transfer options (progress callback)
   */
  uploadFromLocal(
    localPath: string,
    remotePath: string,
    options?: TransferOptions
  ): Promise<OperationResult>;

  // ==========================================================================
  // Container Operations (S3 buckets, GCS buckets, SMB shares)
  // ==========================================================================

  /**
   * List available containers (buckets, shares, drives)
   * Only available if provider has Capability.Containers
   */
  listContainers?(): Promise<OperationResult<Entry[]>>;

  /**
   * Set the current container context
   * Subsequent operations will be relative to this container
   */
  setContainer?(name: string): void;

  /**
   * Get the current container context
   */
  getContainer?(): string | undefined;

  // ==========================================================================
  // Advanced Operations (optional)
  // ==========================================================================

  /**
   * Set custom metadata on a file
   * Only available if provider has Capability.Metadata
   */
  setMetadata?(path: string, metadata: Record<string, string>): Promise<OperationResult>;

  /**
   * Generate a presigned URL for direct access
   * Only available if provider has Capability.PresignedUrls
   */
  getPresignedUrl?(
    path: string,
    operation: 'read' | 'write',
    expiresInSeconds: number
  ): Promise<OperationResult<string>>;

  /**
   * Read the target of a symbolic link
   * Only available if provider has Capability.Symlinks
   */
  readSymlink?(path: string): Promise<OperationResult<string>>;

  /**
   * Set POSIX permissions on a file/directory
   * Only available if provider has Capability.Permissions
   */
  setPermissions?(path: string, mode: number): Promise<OperationResult>;
}
