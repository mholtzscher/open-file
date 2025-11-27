/**
 * Provider List Types
 *
 * Provider-specific list operation types with pagination support.
 * These types use the 'Provider' prefix to avoid conflicts with
 * the existing UI types (ListOptions, ListResult).
 *
 * The prefix will be removed in Phase 7 (Cleanup) after legacy code removal.
 *
 * Use mapper functions (see mappers.ts) to convert between:
 * - ProviderListOptions <-> ListOptions (for UI compatibility)
 * - ProviderListResult <-> ListResult (for UI compatibility)
 */

import { ProviderEntry } from './entry.js';

/**
 * Options for listing directory contents
 */
export interface ProviderListOptions {
  /** Maximum number of entries to return per page */
  limit?: number;
  /** Token for pagination (from previous ProviderListResult) */
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
export interface ProviderListResult {
  /** Entries in the directory */
  entries: ProviderEntry[];
  /** Token for fetching next page (if hasMore is true) */
  continuationToken?: string;
  /** Whether more entries are available */
  hasMore: boolean;
  /** Total count of entries (if known by provider) */
  totalCount?: number;
  /** Path that was listed */
  path?: string;
}
