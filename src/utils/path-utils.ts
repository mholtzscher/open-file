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
