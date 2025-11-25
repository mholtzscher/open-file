import { Entry, EntryType } from '../types/entry.js';

/**
 * Progress event for tracking operation progress
 */
export interface ProgressEvent {
  /** Current operation being performed */
  operation: string;
  /** Bytes transferred so far */
  bytesTransferred: number;
  /** Total bytes to transfer (if known) */
  totalBytes?: number;
  /** Progress percentage (0-100) */
  percentage: number;
  /** Current file/object being processed */
  currentFile?: string;
}

/**
 * Progress callback for long-running operations
 */
export type ProgressCallback = (event: ProgressEvent) => void;

/**
 * Operation options with optional progress tracking
 */
export interface OperationOptions {
  /** Optional progress callback for tracking operation progress */
  onProgress?: ProgressCallback;
}

/**
 * List options for filtering/pagination
 */
export interface ListOptions {
  /** Maximum number of entries to return */
  limit?: number;
  /** Continuation token for pagination */
  continuationToken?: string;
  /** Recursive listing */
  recursive?: boolean;
}

/**
 * List result with pagination support
 */
export interface ListResult {
  /** List of entries */
  entries: Entry[];
  /** Continuation token for next page (if any) */
  continuationToken?: string;
  /** Whether there are more results */
  hasMore: boolean;
}

// ============================================================================
// Interface Segregation: Focused interfaces following ISP
// ============================================================================

/**
 * Base interface for all storage adapters
 * Provides read-only operations that all adapters must support
 */
export interface ReadableStorageAdapter {
  /** Adapter name/type identifier */
  readonly name: string;

  /**
   * List entries at a given path
   * @param path - Path to list (e.g., "bucket/prefix/")
   * @param options - Listing options
   * @returns List of entries at this path
   */
  list(path: string, options?: ListOptions): Promise<ListResult>;

  /**
   * Get metadata for a specific entry
   * @param path - Path to the entry
   * @returns Entry with full metadata
   */
  getMetadata(path: string): Promise<Entry>;

  /**
   * Check if a path exists
   * @param path - Path to check
   * @returns true if exists, false otherwise
   */
  exists(path: string): Promise<boolean>;

  /**
   * Read a file's contents
   * @param path - Path to the file to read
   * @param options - Operation options (progress callback, etc.)
   * @returns File content as Buffer
   */
  read(path: string, options?: OperationOptions): Promise<Buffer>;
}

/**
 * Interface for adapters that support write operations
 * Extends ReadableStorageAdapter with create, delete, move, copy
 */
export interface MutableStorageAdapter extends ReadableStorageAdapter {
  /**
   * Create a new file or directory
   * @param path - Path where to create
   * @param type - Type of entry to create
   * @param content - Content for files (optional)
   * @param options - Operation options (progress callback, etc.)
   */
  create(
    path: string,
    type: EntryType,
    content?: Buffer | string,
    options?: OperationOptions
  ): Promise<void>;

  /**
   * Delete a file or directory
   * @param path - Path to delete
   * @param recursive - Delete recursively (for directories)
   * @param options - Operation options (progress callback, etc.)
   */
  delete(path: string, recursive?: boolean, options?: OperationOptions): Promise<void>;

  /**
   * Move/rename a file or directory
   * @param source - Source path
   * @param destination - Destination path
   * @param options - Operation options (progress callback, etc.)
   */
  move(source: string, destination: string, options?: OperationOptions): Promise<void>;

  /**
   * Copy a file or directory
   * @param source - Source path
   * @param destination - Destination path
   * @param options - Operation options (progress callback, etc.)
   */
  copy(source: string, destination: string, options?: OperationOptions): Promise<void>;
}

/**
 * Interface for adapters that support local filesystem transfers
 * Useful for cloud storage adapters that can transfer to/from local disk
 */
export interface TransferableStorageAdapter extends MutableStorageAdapter {
  /**
   * Download a file/directory to local filesystem
   * @param remotePath - Remote path to download
   * @param localPath - Local filesystem path
   * @param recursive - Download recursively (for directories)
   * @param options - Operation options (progress callback, etc.)
   */
  downloadToLocal(
    remotePath: string,
    localPath: string,
    recursive?: boolean,
    options?: OperationOptions
  ): Promise<void>;

  /**
   * Upload a file/directory from local filesystem
   * @param localPath - Local filesystem path
   * @param remotePath - Remote path to upload to
   * @param recursive - Upload recursively (for directories)
   * @param options - Operation options (progress callback, etc.)
   */
  uploadFromLocal(
    localPath: string,
    remotePath: string,
    recursive?: boolean,
    options?: OperationOptions
  ): Promise<void>;
}

/**
 * Interface for adapters that support bucket-level operations
 * Specific to S3-like storage systems with bucket concepts
 */
export interface BucketAwareAdapter extends TransferableStorageAdapter {
  /**
   * Get list of available buckets
   * @returns List of bucket entries
   */
  getBucketEntries(): Promise<Entry[]>;

  /**
   * Set the current bucket to operate on
   * @param bucket - Bucket name to set
   */
  setBucket(bucket: string): void;

  /**
   * Set the current region
   * @param region - Region identifier to set
   */
  setRegion(region: string): void;
}

// ============================================================================
// Type Guards for Interface Discrimination
// ============================================================================

/**
 * Check if an adapter supports mutable operations (create, delete, move, copy)
 */
export function isMutableAdapter(
  adapter: ReadableStorageAdapter
): adapter is MutableStorageAdapter {
  return (
    'create' in adapter &&
    'delete' in adapter &&
    'move' in adapter &&
    'copy' in adapter &&
    typeof (adapter as MutableStorageAdapter).create === 'function' &&
    typeof (adapter as MutableStorageAdapter).delete === 'function' &&
    typeof (adapter as MutableStorageAdapter).move === 'function' &&
    typeof (adapter as MutableStorageAdapter).copy === 'function'
  );
}

/**
 * Check if an adapter supports local filesystem transfers
 */
export function isTransferableAdapter(
  adapter: ReadableStorageAdapter
): adapter is TransferableStorageAdapter {
  return (
    isMutableAdapter(adapter) &&
    'downloadToLocal' in adapter &&
    'uploadFromLocal' in adapter &&
    typeof (adapter as TransferableStorageAdapter).downloadToLocal === 'function' &&
    typeof (adapter as TransferableStorageAdapter).uploadFromLocal === 'function'
  );
}

/**
 * Check if an adapter supports bucket operations
 */
export function isBucketAwareAdapter(
  adapter: ReadableStorageAdapter
): adapter is BucketAwareAdapter {
  return (
    isTransferableAdapter(adapter) &&
    'getBucketEntries' in adapter &&
    'setBucket' in adapter &&
    'setRegion' in adapter &&
    typeof (adapter as BucketAwareAdapter).getBucketEntries === 'function' &&
    typeof (adapter as BucketAwareAdapter).setBucket === 'function' &&
    typeof (adapter as BucketAwareAdapter).setRegion === 'function'
  );
}

// ============================================================================
// Backwards Compatibility: Adapter type alias
// ============================================================================

/**
 * Adapter interface - backwards compatible alias for MutableStorageAdapter
 * with optional methods for transferable and bucket-aware functionality
 *
 * @deprecated Use specific interfaces (ReadableStorageAdapter, MutableStorageAdapter,
 * TransferableStorageAdapter, BucketAwareAdapter) for better type safety.
 * This type is maintained for backwards compatibility.
 *
 * Implementations: MockAdapter (in-memory), S3Adapter (AWS S3)
 */
export interface Adapter extends MutableStorageAdapter {
  /**
   * (Optional) Download a file from remote to local filesystem
   * @deprecated Use TransferableStorageAdapter.downloadToLocal instead
   */
  downloadToLocal?(
    remotePath: string,
    localPath: string,
    recursive?: boolean,
    options?: OperationOptions
  ): Promise<void>;

  /**
   * (Optional) Upload a file from local filesystem to remote
   * @deprecated Use TransferableStorageAdapter.uploadFromLocal instead
   */
  uploadFromLocal?(
    localPath: string,
    remotePath: string,
    recursive?: boolean,
    options?: OperationOptions
  ): Promise<void>;

  /**
   * (Optional) Get bucket entries for root view
   * @deprecated Use BucketAwareAdapter.getBucketEntries instead
   */
  getBucketEntries?(): Promise<Entry[]>;

  /**
   * (Optional) Set the current bucket
   * @deprecated Use BucketAwareAdapter.setBucket instead
   */
  setBucket?(bucket: string): void;

  /**
   * (Optional) Set the current region
   * @deprecated Use BucketAwareAdapter.setRegion instead
   */
  setRegion?(region: string): void;
}
