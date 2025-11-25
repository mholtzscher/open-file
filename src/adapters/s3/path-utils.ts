/**
 * S3 Path Utilities
 *
 * Functions for normalizing and manipulating S3 paths/keys.
 * S3 uses "keys" which are flat strings, but we present them
 * as hierarchical paths using "/" as a delimiter.
 */

/**
 * Normalize a path to S3 prefix format
 * - Remove leading slash
 * - Collapse multiple consecutive slashes
 * - Ensure trailing slash for directories
 * - Root path returns empty string (S3 expects "" not "/")
 *
 * @param path - The path to normalize
 * @param isDirectory - Whether to treat this as a directory (adds trailing slash)
 * @returns Normalized S3 key/prefix
 */
export function normalizeS3Path(path: string, isDirectory: boolean = false): string {
  // Remove leading slash and collapse multiple slashes
  let normalized = path.replace(/^\//, '').replace(/\/+/g, '/');

  // Add trailing slash for directories (if not already present and not empty)
  if (isDirectory && !normalized.endsWith('/') && normalized !== '') {
    normalized += '/';
  }

  // S3 expects empty string for root, not "/"
  if (normalized === '/') {
    normalized = '';
  }

  return normalized;
}

/**
 * Extract the name (last segment) from an S3 key
 *
 * @param key - The S3 key (e.g., "folder/subfolder/file.txt")
 * @returns The name part (e.g., "file.txt")
 */
export function getS3KeyName(key: string): string {
  // Remove trailing slash for directories
  const trimmed = key.replace(/\/$/, '');

  // Split and get last non-empty segment
  const parts = trimmed.split('/').filter(p => p);

  return parts.pop() || key;
}

/**
 * Check if an S3 key represents a directory
 * Directories in S3 are represented by keys ending with "/"
 *
 * @param key - The S3 key to check
 * @returns true if the key represents a directory
 */
export function isS3Directory(key: string): boolean {
  return key.endsWith('/');
}

/**
 * Join multiple path segments into an S3 key
 * Handles leading/trailing slashes appropriately
 *
 * @param segments - Path segments to join
 * @returns Joined S3 key
 */
export function joinS3Path(...segments: string[]): string {
  // Filter out empty segments and join with /
  const joined = segments
    .map(s => s.replace(/^\/+|\/+$/g, '')) // Trim slashes from each segment
    .filter(s => s) // Remove empty segments
    .join('/');

  return joined;
}

/**
 * Get the parent prefix/directory of an S3 key
 *
 * @param key - The S3 key
 * @returns The parent prefix, or empty string for root-level keys
 */
export function getS3ParentPath(key: string): string {
  // Remove trailing slash if present
  const trimmed = key.replace(/\/$/, '');

  const lastSlash = trimmed.lastIndexOf('/');
  if (lastSlash === -1) {
    return '';
  }

  return trimmed.substring(0, lastSlash + 1);
}

/**
 * Get the relative path from a prefix to a key
 *
 * @param key - The full S3 key
 * @param prefix - The prefix to remove
 * @returns The relative path after the prefix
 */
export function getS3RelativePath(key: string, prefix: string): string {
  if (!key.startsWith(prefix)) {
    return key;
  }
  return key.substring(prefix.length);
}
