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

/**
 * Adapter interface - abstraction for different storage backends
 *
 * Implementations: MockAdapter (in-memory), S3Adapter (AWS S3)
 */
export interface Adapter {
  /**
   * Get adapter name/type
   */
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

  /**
   * Check if a path exists
   * @param path - Path to check
   * @returns true if exists, false otherwise
   */
  exists(path: string): Promise<boolean>;
}
