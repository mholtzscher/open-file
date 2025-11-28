/**
 * Path utility functions
 */

import { homedir } from 'os';

/**
 * Expand ~ to home directory
 */
export function expandUser(path: string): string {
  if (path.startsWith('~')) {
    return path.replace('~', homedir());
  }
  return path;
}

/**
 * Normalize path separators
 */
export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

/**
 * Join path segments
 */
export function joinPath(...segments: string[]): string {
  return segments
    .filter(s => s && s !== '/')
    .join('/')
    .replace(/\/+/g, '/');
}

/**
 * Get parent directory
 */
export function getParentPath(path: string): string {
  const normalized = path.replace(/\/$/, '');
  const parts = normalized.split('/').filter(p => p);
  parts.pop();
  return parts.join('/') + '/';
}

/**
 * Calculate parent path for navigation, preserving path style.
 *
 * Handles both:
 * - S3/GCS style paths (no leading slash): "folder/subfolder/" -> "folder/"
 * - SFTP style paths (with leading slash): "/data/images/" -> "/data/"
 *
 * Returns:
 * - { parentPath, atContainerRoot: false } if navigation possible
 * - { parentPath, atContainerRoot: true } if at container root (should go back to container list)
 */
export function calculateParentPath(currentPath: string): {
  parentPath: string;
  atContainerRoot: boolean;
} {
  const parts = currentPath.split('/').filter(p => p);

  if (parts.length === 0) {
    // Already at container root
    return { parentPath: '', atContainerRoot: true };
  }

  // Remove last segment
  parts.pop();

  if (parts.length === 0) {
    // Was at first level, now at container root
    // Return appropriate root based on original path style
    const parentPath = currentPath.startsWith('/') ? '/' : '';
    return { parentPath, atContainerRoot: false };
  }

  // Still have path parts - preserve leading slash if original had one
  const parentPath = currentPath.startsWith('/')
    ? '/' + parts.join('/') + '/'
    : parts.join('/') + '/';

  return { parentPath, atContainerRoot: false };
}

/**
 * Get filename from path
 */
export function getFileName(path: string): string {
  const normalized = path.replace(/\/$/, '');
  const parts = normalized.split('/');
  return parts[parts.length - 1] || '';
}

/**
 * Check if path is a directory
 */
export function isDirectory(path: string): boolean {
  return path.endsWith('/');
}

/**
 * Make path a directory path (add trailing slash)
 */
export function asDirectory(path: string): string {
  if (!path.endsWith('/')) {
    return path + '/';
  }
  return path;
}

/**
 * Make path a file path (remove trailing slash)
 */
export function asFile(path: string): string {
  return path.replace(/\/$/, '');
}
