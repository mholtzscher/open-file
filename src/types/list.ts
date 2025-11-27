/**
 * List Types
 *
 * List operation types with pagination support.
 */

import { Entry } from './entry.js';

/**
 * Options for listing directory contents
 */
export interface ListOptions {
  /** Maximum number of entries to return per page */
  limit?: number;
  /** Token for pagination (from previous ListResult) */
  continuationToken?: string;
  /** Include subdirectories recursively */
  recursive?: boolean;
  /** Filter entries by prefix (for path-based filtering) */
  prefix?: string;
  /** Filter entries by file extension (e.g., '.txt', '.md') */
  extension?: string;
  /** Include hidden files (files starting with '.') */
  includeHidden?: boolean;
  /** Sort order for results */
  sortBy?: 'name' | 'modified' | 'size' | 'type';
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Result of a list operation with pagination support
 */
export interface ListResult {
  /** Entries in the directory */
  entries: Entry[];
  /** Token for fetching next page (if hasMore is true) */
  continuationToken?: string;
  /** Whether more entries are available */
  hasMore: boolean;
  /** Total count of entries (if known by provider) */
  totalCount?: number;
  /** Path that was listed */
  path?: string;
}
