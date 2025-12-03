/**
 * Google Drive Path Resolver
 *
 * Google Drive uses file IDs, not paths. This module provides bidirectional
 * mapping between human-readable paths and Drive file IDs with LRU caching.
 */

import type { drive_v3 } from 'googleapis';
import { FOLDER_MIMETYPE } from './auth.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Cache entry with TTL support
 */
interface CacheEntry {
  fileId: string;
  parentId: string | null;
  name: string;
  mimeType: string;
  timestamp: number;
}

/**
 * Options for the path resolver
 */
export interface PathResolverOptions {
  /** Cache TTL in milliseconds (default: 60000) */
  cacheTtlMs?: number;
  /** Maximum cache size (default: 1000) */
  maxCacheSize?: number;
}

/**
 * Result of resolving a path to a file ID
 */
export interface ResolveResult {
  success: true;
  fileId: string;
  name: string;
  mimeType: string;
  isFolder: boolean;
}

export interface ResolveError {
  success: false;
  error: string;
  notFound?: boolean;
}

export type PathResolveResult = ResolveResult | ResolveError;

// ============================================================================
// Path Resolver Implementation
// ============================================================================

/**
 * PathResolver provides bidirectional mapping between paths and Google Drive file IDs
 *
 * Key features:
 * - LRU cache with configurable TTL
 * - Path normalization
 * - Handles Drive root specially ('root' or 'My Drive')
 * - Supports Shared Drive roots
 */
export class PathResolver {
  private drive: drive_v3.Drive;
  private cacheTtlMs: number;
  private maxCacheSize: number;

  // Path -> CacheEntry (for path-to-ID lookups)
  private pathCache: Map<string, CacheEntry> = new Map();

  // FileId -> path (for ID-to-path lookups)
  private idToPathCache: Map<string, string> = new Map();

  // Current drive context (for Shared Drives)
  private currentDriveId: string | null = null;

  constructor(drive: drive_v3.Drive, options: PathResolverOptions = {}) {
    this.drive = drive;
    this.cacheTtlMs = options.cacheTtlMs ?? 60000;
    this.maxCacheSize = options.maxCacheSize ?? 1000;
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Set the current drive context (for Shared Drives)
   */
  setDriveContext(driveId: string | null): void {
    if (this.currentDriveId !== driveId) {
      this.currentDriveId = driveId;
      // Clear cache when switching drives
      this.invalidateAll();
    }
  }

  /**
   * Get the current drive context
   */
  getDriveContext(): string | null {
    return this.currentDriveId;
  }

  /**
   * Resolve a path to a file ID
   *
   * @param path - Path like "/" or "/folder/subfolder/file.txt"
   * @returns File ID or error
   */
  async resolvePathToId(path: string): Promise<PathResolveResult> {
    const normalizedPath = this.normalizePath(path);

    // Check cache first
    const cached = this.getCachedEntry(normalizedPath);
    if (cached) {
      return {
        success: true,
        fileId: cached.fileId,
        name: cached.name,
        mimeType: cached.mimeType,
        isFolder: cached.mimeType === FOLDER_MIMETYPE,
      };
    }

    // Root path
    if (normalizedPath === '/') {
      return this.resolveRoot();
    }

    // Split path and resolve each segment
    const segments = normalizedPath.split('/').filter(Boolean);
    let currentParentId = this.getRootId();
    let currentPath = '';

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      currentPath += '/' + segment;

      // Check if this segment is cached
      const segmentCached = this.getCachedEntry(currentPath);
      if (segmentCached) {
        currentParentId = segmentCached.fileId;
        continue;
      }

      // Query Drive for this segment
      const result = await this.findFileInFolder(currentParentId, segment);
      if (!result.success) {
        return result;
      }

      // Cache the result
      this.setCacheEntry(currentPath, {
        fileId: result.fileId,
        parentId: currentParentId,
        name: result.name,
        mimeType: result.mimeType,
        timestamp: Date.now(),
      });

      currentParentId = result.fileId;
    }

    // Return the final result
    const finalEntry = this.getCachedEntry(normalizedPath);
    if (finalEntry) {
      return {
        success: true,
        fileId: finalEntry.fileId,
        name: finalEntry.name,
        mimeType: finalEntry.mimeType,
        isFolder: finalEntry.mimeType === FOLDER_MIMETYPE,
      };
    }

    // Should not reach here, but handle gracefully
    return {
      success: false,
      error: `Failed to resolve path: ${path}`,
    };
  }

  /**
   * Get the path for a file ID
   *
   * @param fileId - The file ID to look up
   * @returns The full path for the file
   */
  async getPathForId(fileId: string): Promise<string> {
    // Check cache
    const cachedPath = this.idToPathCache.get(fileId);
    if (cachedPath) {
      return cachedPath;
    }

    // Build path by traversing parents
    const pathParts: string[] = [];
    let currentId = fileId;

    while (currentId && currentId !== 'root' && currentId !== this.currentDriveId) {
      try {
        const response = await this.drive.files.get({
          fileId: currentId,
          fields: 'id, name, parents',
          supportsAllDrives: true,
        });

        const file = response.data;
        pathParts.unshift(file.name || 'unknown');

        // Move to parent
        currentId = file.parents?.[0] || '';
      } catch {
        // If we can't get the file, stop traversing
        break;
      }
    }

    const path = '/' + pathParts.join('/');

    // Cache the result
    this.idToPathCache.set(fileId, path);

    return path;
  }

  /**
   * Invalidate cache entry for a specific path
   */
  invalidate(path: string): void {
    const normalizedPath = this.normalizePath(path);
    const entry = this.pathCache.get(normalizedPath);

    if (entry) {
      this.pathCache.delete(normalizedPath);
      this.idToPathCache.delete(entry.fileId);
    }

    // Also invalidate any child paths
    for (const [cachedPath, cachedEntry] of this.pathCache.entries()) {
      if (cachedPath.startsWith(normalizedPath + '/')) {
        this.pathCache.delete(cachedPath);
        this.idToPathCache.delete(cachedEntry.fileId);
      }
    }
  }

  /**
   * Invalidate all cached entries
   */
  invalidateAll(): void {
    this.pathCache.clear();
    this.idToPathCache.clear();
  }

  /**
   * Get the parent path
   */
  getParentPath(path: string): string {
    const normalized = this.normalizePath(path);
    if (normalized === '/') {
      return '/';
    }

    const lastSlash = normalized.lastIndexOf('/');
    if (lastSlash <= 0) {
      return '/';
    }

    return normalized.substring(0, lastSlash);
  }

  /**
   * Get the file name from a path
   */
  getFileName(path: string): string {
    const normalized = this.normalizePath(path);
    if (normalized === '/') {
      return '';
    }

    const lastSlash = normalized.lastIndexOf('/');
    return normalized.substring(lastSlash + 1);
  }

  /**
   * Join path segments
   */
  joinPath(...segments: string[]): string {
    const parts: string[] = [];

    for (const segment of segments) {
      const normalized = segment.replace(/^\/+|\/+$/g, '');
      if (normalized) {
        parts.push(normalized);
      }
    }

    return '/' + parts.join('/');
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Normalize a path for consistent caching
   */
  private normalizePath(path: string): string {
    // Handle empty or root paths
    if (!path || path === '/' || path === 'root') {
      return '/';
    }

    // Remove trailing slashes and ensure leading slash
    let normalized = path.replace(/\/+$/, '');
    if (!normalized.startsWith('/')) {
      normalized = '/' + normalized;
    }

    // Normalize multiple slashes
    normalized = normalized.replace(/\/+/g, '/');

    return normalized;
  }

  /**
   * Get the root ID for the current context
   */
  private getRootId(): string {
    return this.currentDriveId || 'root';
  }

  /**
   * Resolve the root path
   */
  private async resolveRoot(): Promise<PathResolveResult> {
    const rootId = this.getRootId();

    // For "My Drive" root, we can just return a synthetic entry
    // since the root folder ID is 'root' and we know it's a folder
    if (rootId === 'root') {
      // Cache root
      this.setCacheEntry('/', {
        fileId: 'root',
        parentId: null,
        name: 'My Drive',
        mimeType: FOLDER_MIMETYPE,
        timestamp: Date.now(),
      });

      return {
        success: true,
        fileId: 'root',
        name: 'My Drive',
        mimeType: FOLDER_MIMETYPE,
        isFolder: true,
      };
    }

    // For Shared Drives, we need to fetch the drive info
    try {
      const response = await this.drive.files.get({
        fileId: rootId,
        fields: 'id, name, mimeType',
        supportsAllDrives: true,
      });

      const file = response.data;

      // Cache root
      this.setCacheEntry('/', {
        fileId: file.id || rootId,
        parentId: null,
        name: file.name || 'Shared Drive',
        mimeType: file.mimeType || FOLDER_MIMETYPE,
        timestamp: Date.now(),
      });

      return {
        success: true,
        fileId: file.id || rootId,
        name: file.name || 'Shared Drive',
        mimeType: file.mimeType || FOLDER_MIMETYPE,
        isFolder: true,
      };
    } catch (err) {
      const driveError = err as {
        response?: { status?: number; data?: { error?: { message?: string } } };
        message?: string;
      };
      const errorMessage =
        driveError.response?.data?.error?.message || driveError.message || 'Unknown error';
      const statusCode = driveError.response?.status;
      return {
        success: false,
        error: `Failed to access Drive root: ${errorMessage}${statusCode ? ` (HTTP ${statusCode})` : ''}`,
      };
    }
  }

  /**
   * Find a file by name within a folder
   */
  private async findFileInFolder(parentId: string, fileName: string): Promise<PathResolveResult> {
    try {
      // Escape single quotes in file name for query
      const escapedName = fileName.replace(/'/g, "\\'");

      const response = await this.drive.files.list({
        q: `'${parentId}' in parents and name = '${escapedName}' and trashed = false`,
        fields: 'files(id, name, mimeType)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        pageSize: 1,
      });

      const files = response.data.files || [];

      if (files.length === 0) {
        return {
          success: false,
          error: `File not found: ${fileName}`,
          notFound: true,
        };
      }

      const file = files[0];
      return {
        success: true,
        fileId: file.id || '',
        name: file.name || fileName,
        mimeType: file.mimeType || 'application/octet-stream',
        isFolder: file.mimeType === FOLDER_MIMETYPE,
      };
    } catch (err) {
      const error = err as Error;
      return {
        success: false,
        error: `Failed to search for file: ${error.message}`,
      };
    }
  }

  /**
   * Get a cached entry if it exists and is not expired
   */
  private getCachedEntry(path: string): CacheEntry | null {
    const entry = this.pathCache.get(path);

    if (!entry) {
      return null;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > this.cacheTtlMs) {
      this.pathCache.delete(path);
      this.idToPathCache.delete(entry.fileId);
      return null;
    }

    return entry;
  }

  /**
   * Set a cache entry, evicting oldest entries if needed
   */
  private setCacheEntry(path: string, entry: CacheEntry): void {
    // Evict oldest entries if at capacity
    if (this.pathCache.size >= this.maxCacheSize) {
      // Remove oldest 10% of entries
      const entriesToRemove = Math.ceil(this.maxCacheSize * 0.1);
      const entries = Array.from(this.pathCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)
        .slice(0, entriesToRemove);

      for (const [key, value] of entries) {
        this.pathCache.delete(key);
        this.idToPathCache.delete(value.fileId);
      }
    }

    this.pathCache.set(path, entry);
    this.idToPathCache.set(entry.fileId, path);
  }
}
