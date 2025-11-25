/**
 * File browser utilities for local filesystem navigation
 *
 * Provides utilities for browsing, filtering, and selecting local files
 */

import { promises as fs } from 'fs';
import path from 'path';

/**
 * Local file entry
 */
export interface LocalFileEntry {
  /** File or directory name */
  name: string;
  /** Full path to the file */
  path: string;
  /** File size in bytes */
  size: number;
  /** Last modified time */
  modified: Date;
  /** Whether this is a directory */
  isDirectory: boolean;
  /** File extension (without dot) */
  extension?: string;
}

/**
 * File type filter
 */
export enum FileTypeFilter {
  All = 'all',
  Text = 'text',
  Images = 'images',
  Archives = 'archives',
  Code = 'code',
}

/**
 * File browser options
 */
export interface FileBrowserOptions {
  /** Current directory path */
  currentPath?: string;
  /** File type filter */
  filter?: FileTypeFilter;
  /** Search pattern */
  searchPattern?: string;
  /** Include hidden files */
  includeHidden?: boolean;
}

/**
 * File browser result
 */
export interface FileBrowserResult {
  /** List of entries in current directory */
  entries: LocalFileEntry[];
  /** Current directory path */
  currentPath: string;
  /** Parent directory path (if not at root) */
  parentPath?: string;
  /** Can go up one directory? */
  canGoUp: boolean;
}

/**
 * Determine file type from extension
 */
function getFileType(filename: string): string | undefined {
  const ext = path.extname(filename).toLowerCase().slice(1);
  return ext || undefined;
}

/**
 * Check if file matches the filter
 */
function matchesFilter(entry: LocalFileEntry, filter: FileTypeFilter): boolean {
  if (filter === FileTypeFilter.All) return true;
  if (entry.isDirectory) return true; // Always show directories

  const ext = entry.extension?.toLowerCase() ?? '';
  const textExts = [
    'txt',
    'md',
    'json',
    'yaml',
    'yml',
    'toml',
    'xml',
    'csv',
    'log',
    'js',
    'ts',
    'tsx',
    'jsx',
    'py',
    'rb',
    'go',
    'rs',
    'c',
    'cpp',
    'h',
    'java',
    'sh',
    'bash',
  ];
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico'];
  const archiveExts = ['zip', 'tar', 'gz', 'rar', '7z', 'bz2', 'xz'];

  switch (filter) {
    case FileTypeFilter.Text:
      return textExts.includes(ext);
    case FileTypeFilter.Images:
      return imageExts.includes(ext);
    case FileTypeFilter.Archives:
      return archiveExts.includes(ext);
    case FileTypeFilter.Code:
      return textExts.includes(ext); // Code files are text files
    default:
      return true;
  }
}

/**
 * Check if filename matches search pattern
 */
function matchesSearchPattern(filename: string, pattern?: string): boolean {
  if (!pattern) return true;
  return filename.toLowerCase().includes(pattern.toLowerCase());
}

/**
 * Get normalized directory path
 */
export function getNormalizedPath(dirPath: string): string {
  // Expand ~ to home directory
  if (dirPath.startsWith('~')) {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '/';
    return dirPath.replace('~', homeDir);
  }
  return path.resolve(dirPath);
}

/**
 * List files in a directory with filtering
 */
export async function listFiles(options: FileBrowserOptions = {}): Promise<FileBrowserResult> {
  const currentPath = getNormalizedPath(options.currentPath || process.cwd());
  const filter = options.filter || FileTypeFilter.All;
  const searchPattern = options.searchPattern;
  const includeHidden = options.includeHidden ?? false;

  try {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    const files: LocalFileEntry[] = [];

    for (const entry of entries) {
      // Skip hidden files unless requested
      if (!includeHidden && entry.name.startsWith('.')) {
        continue;
      }

      const fullPath = path.join(currentPath, entry.name);

      try {
        const stats = await fs.stat(fullPath);
        const localEntry: LocalFileEntry = {
          name: entry.name,
          path: fullPath,
          size: stats.size,
          modified: stats.mtime,
          isDirectory: entry.isDirectory(),
          extension: entry.isDirectory() ? undefined : getFileType(entry.name),
        };

        // Apply filters
        if (!matchesFilter(localEntry, filter)) continue;
        if (!matchesSearchPattern(localEntry.name, searchPattern)) continue;

        files.push(localEntry);
      } catch (err) {
        // Skip files we can't stat
        continue;
      }
    }

    // Sort: directories first, then by name
    files.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    // Get parent directory
    const parentPath = path.dirname(currentPath);
    const canGoUp = parentPath !== currentPath;

    return {
      entries: files,
      currentPath,
      parentPath: canGoUp ? parentPath : undefined,
      canGoUp,
    };
  } catch (err) {
    console.error(`Failed to list directory ${currentPath}:`, err);
    throw new Error(`Failed to list directory: ${(err as Error).message}`);
  }
}

/**
 * Get file stats (size, modified date)
 */
export async function getFileStats(filePath: string): Promise<LocalFileEntry> {
  const normalizedPath = getNormalizedPath(filePath);

  try {
    const stats = await fs.stat(normalizedPath);
    return {
      name: path.basename(normalizedPath),
      path: normalizedPath,
      size: stats.size,
      modified: stats.mtime,
      isDirectory: stats.isDirectory(),
      extension: stats.isDirectory() ? undefined : getFileType(path.basename(normalizedPath)),
    };
  } catch (err) {
    throw new Error(`Failed to get file stats: ${(err as Error).message}`);
  }
}

/**
 * Check if directory exists
 */
export async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(getNormalizedPath(dirPath));
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Get size of file or directory recursively
 */
export async function getDirectorySize(dirPath: string): Promise<number> {
  const normalizedPath = getNormalizedPath(dirPath);

  try {
    const stats = await fs.stat(normalizedPath);

    if (!stats.isDirectory()) {
      return stats.size;
    }

    const entries = await fs.readdir(normalizedPath, { withFileTypes: true });
    let totalSize = 0;

    for (const entry of entries) {
      const fullPath = path.join(normalizedPath, entry.name);
      totalSize += await getDirectorySize(fullPath);
    }

    return totalSize;
  } catch (err) {
    console.error(`Failed to get directory size:`, err);
    return 0;
  }
}

/**
 * Format bytes for display
 * Returns '-' for undefined (e.g., folders), '0B' for zero-byte files
 * Supports B, KB, MB, GB, TB
 */
export function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined) return '-';
  if (bytes === 0) return '0B';
  if (bytes < 1024) return bytes + 'B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
  if (bytes < 1024 * 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(1) + 'GB';
  return (bytes / (1024 * 1024 * 1024 * 1024)).toFixed(1) + 'TB';
}

/**
 * Get file extension from filename
 */
export function getExtension(filename: string): string {
  const ext = path.extname(filename);
  return ext.startsWith('.') ? ext.slice(1) : ext;
}
