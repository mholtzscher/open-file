import { Entry, EntryType } from '../types/entry.js';

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
   */
  create(
    path: string,
    type: EntryType,
    content?: Buffer | string
  ): Promise<void>;

  /**
   * Delete a file or directory
   * @param path - Path to delete
   * @param recursive - Delete recursively (for directories)
   */
  delete(path: string, recursive?: boolean): Promise<void>;

  /**
   * Move/rename a file or directory
   * @param source - Source path
   * @param destination - Destination path
   */
  move(source: string, destination: string): Promise<void>;

  /**
   * Copy a file or directory
   * @param source - Source path
   * @param destination - Destination path
   */
  copy(source: string, destination: string): Promise<void>;

  /**
   * Check if a path exists
   * @param path - Path to check
   * @returns true if exists, false otherwise
   */
  exists(path: string): Promise<boolean>;
}
