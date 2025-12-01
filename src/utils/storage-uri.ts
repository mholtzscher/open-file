/**
 * Storage URI Utilities
 *
 * Utilities for building and parsing storage URIs that identify entries
 * across different storage backends.
 *
 * URI Format Examples:
 * - s3://bucket-name/path/to/file.txt
 * - gcs://bucket-name/path/to/file.txt
 * - sftp://host:port/path/to/file.txt
 * - file:///local/path/to/file.txt
 * - mock://default/path/to/file.txt (for testing)
 */

import { Entry } from '../types/entry.js';
import { StorageUri } from '../types/pending-operations.js';

/**
 * Supported storage scheme types
 */
export type StorageScheme = 's3' | 'sftp' | 'gcs' | 'file' | 'ftp' | 'mock';

/**
 * Parsed URI components
 */
export interface ParsedUri {
  /** Storage scheme (s3, sftp, gcs, file, etc.) */
  scheme: StorageScheme;
  /** Bucket name for cloud storage, host:port for SFTP */
  bucket?: string;
  /** Host for connection-oriented protocols */
  host?: string;
  /** Port for connection-oriented protocols */
  port?: number;
  /** Path within the storage backend */
  path: string;
  /** Last segment of the path (filename) */
  name: string;
}

/**
 * Build a storage URI from components
 *
 * @param scheme - Storage scheme (s3, sftp, gcs, file, mock)
 * @param bucket - Bucket name or host:port for SFTP
 * @param path - Path within the storage backend
 * @returns Fully-formed storage URI
 *
 * @example
 * buildUri('s3', 'my-bucket', 'path/to/file.txt')
 * // => 's3://my-bucket/path/to/file.txt'
 *
 * buildUri('file', undefined, '/home/user/file.txt')
 * // => 'file:///home/user/file.txt'
 */
export function buildUri(
  scheme: StorageScheme,
  bucket: string | undefined,
  path: string
): StorageUri {
  // Normalize path - remove leading slash for cloud storage
  const normalizedPath = path.startsWith('/') && scheme !== 'file' ? path.slice(1) : path;

  switch (scheme) {
    case 's3':
      if (!bucket) throw new Error('S3 URIs require a bucket name');
      return `s3://${bucket}/${normalizedPath}`;

    case 'gcs':
      if (!bucket) throw new Error('GCS URIs require a bucket name');
      return `gcs://${bucket}/${normalizedPath}`;

    case 'sftp':
      if (!bucket) throw new Error('SFTP URIs require a host');
      return `sftp://${bucket}/${normalizedPath}`;

    case 'ftp':
      if (!bucket) throw new Error('FTP URIs require a host');
      return `ftp://${bucket}/${normalizedPath}`;

    case 'file':
      // File URIs always have three slashes: file:///path
      return `file://${normalizedPath.startsWith('/') ? '' : '/'}${normalizedPath}`;

    case 'mock':
      return `mock://${bucket || 'default'}/${normalizedPath}`;

    default:
      throw new Error('Unknown scheme');
  }
}

/**
 * Parse a storage URI into components
 *
 * @param uri - Storage URI to parse
 * @returns Parsed URI components
 * @throws Error if URI format is invalid
 *
 * @example
 * parseUri('s3://my-bucket/path/to/file.txt')
 * // => { scheme: 's3', bucket: 'my-bucket', path: 'path/to/file.txt', name: 'file.txt' }
 */
export function parseUri(uri: string): ParsedUri {
  // Match scheme://authority/path pattern
  const match = uri.match(/^(\w+):\/\/([^/]*)(\/.*)?$/);
  if (!match) {
    throw new Error(`Invalid URI format: ${uri}`);
  }

  const [, schemeStr, authority, pathPart] = match;
  const scheme = schemeStr as StorageScheme;

  // Validate scheme
  const validSchemes: StorageScheme[] = ['s3', 'sftp', 'gcs', 'file', 'ftp', 'mock'];
  if (!validSchemes.includes(scheme)) {
    throw new Error(`Unknown scheme: ${scheme}`);
  }

  // Extract path (remove leading slash for cloud storage)
  let path = pathPart || '';
  if (path.startsWith('/') && scheme !== 'file') {
    path = path.slice(1);
  }

  // Extract name from path
  const pathSegments = path.split('/').filter(Boolean);
  const name = pathSegments.length > 0 ? pathSegments[pathSegments.length - 1] : '';

  // Parse host:port for connection-oriented protocols
  let host: string | undefined;
  let port: number | undefined;
  if (scheme === 'sftp' || scheme === 'ftp') {
    const hostPortMatch = authority.match(/^([^:]+)(?::(\d+))?$/);
    if (hostPortMatch) {
      host = hostPortMatch[1];
      port = hostPortMatch[2] ? parseInt(hostPortMatch[2], 10) : undefined;
    }
  }

  return {
    scheme,
    bucket: authority || undefined,
    host,
    port,
    path,
    name,
  };
}

/**
 * Get the parent directory URI
 *
 * @param uri - Storage URI
 * @returns Parent directory URI
 *
 * @example
 * getParentUri('s3://bucket/path/to/file.txt')
 * // => 's3://bucket/path/to/'
 */
export function getParentUri(uri: string): StorageUri {
  const parsed = parseUri(uri);
  const pathParts = parsed.path.split('/').filter(Boolean);

  // Remove the last segment
  pathParts.pop();

  // Rebuild parent path with trailing slash for directories
  const parentPath = pathParts.length > 0 ? pathParts.join('/') + '/' : '';

  return buildUri(parsed.scheme, parsed.bucket, parentPath);
}

/**
 * Get the directory path from a URI (without scheme/bucket)
 *
 * @param uri - Storage URI
 * @returns Directory path portion
 */
export function getDirectoryPath(uri: string): string {
  const parsed = parseUri(uri);
  const pathParts = parsed.path.split('/').filter(Boolean);
  pathParts.pop();
  return pathParts.length > 0 ? pathParts.join('/') + '/' : '';
}

/**
 * Build URI for an entry given current context
 *
 * @param entry - Entry to build URI for
 * @param scheme - Storage scheme
 * @param bucket - Bucket or host context
 * @returns Storage URI for the entry
 */
export function entryToUri(entry: Entry, scheme: StorageScheme, bucket?: string): StorageUri {
  return buildUri(scheme, bucket, entry.path);
}

/**
 * Check if a URI is within a given directory path
 *
 * @param uri - URI to check
 * @param directoryPath - Directory path to check against
 * @param scheme - Storage scheme for directory
 * @param bucket - Bucket context for directory
 * @returns true if the URI is a direct child of the directory
 *
 * @example
 * isUriInPath('s3://bucket/foo/bar.txt', 'foo/', 's3', 'bucket')
 * // => true (bar.txt is a direct child of foo/)
 *
 * isUriInPath('s3://bucket/foo/sub/bar.txt', 'foo/', 's3', 'bucket')
 * // => false (bar.txt is in a subdirectory)
 */
export function isUriInPath(
  uri: string,
  directoryPath: string,
  scheme: StorageScheme,
  bucket?: string
): boolean {
  const parsed = parseUri(uri);

  // Must match scheme and bucket
  if (parsed.scheme !== scheme) {
    return false;
  }
  if (parsed.bucket !== bucket) {
    return false;
  }

  // Normalize directory path
  const normalizedDirPath = directoryPath.endsWith('/')
    ? directoryPath
    : directoryPath.length > 0
      ? directoryPath + '/'
      : '';

  // Path must start with directory path
  if (!parsed.path.startsWith(normalizedDirPath)) {
    return false;
  }

  // Check it's a direct child (exactly one more segment)
  const relativePath = parsed.path.slice(normalizedDirPath.length);
  const segments = relativePath.split('/').filter(Boolean);

  // Allow for trailing slash on directories
  return segments.length === 1 || (segments.length === 0 && relativePath === '');
}

/**
 * Build a destination URI from a source entry and destination directory
 *
 * @param entry - Source entry
 * @param destPath - Destination directory path
 * @param scheme - Storage scheme
 * @param bucket - Bucket context
 * @returns Destination URI preserving the entry name
 */
export function buildDestinationUri(
  entry: Entry,
  destPath: string,
  scheme: StorageScheme,
  bucket?: string
): StorageUri {
  // Ensure destination path ends with / for directories
  const normalizedDestPath = destPath.endsWith('/') || destPath === '' ? destPath : destPath + '/';
  const destFullPath = normalizedDestPath + entry.name;
  return buildUri(scheme, bucket, destFullPath);
}

/**
 * Extract scheme from a provider name
 *
 * @param providerName - Provider name (e.g., 's3', 'sftp', 'gcs')
 * @returns Storage scheme
 */
export function providerNameToScheme(providerName: string): StorageScheme {
  const normalized = providerName.toLowerCase();
  const schemeMap: Record<string, StorageScheme> = {
    s3: 's3',
    sftp: 'sftp',
    gcs: 'gcs',
    file: 'file',
    local: 'file',
    ftp: 'ftp',
    mock: 'mock',
  };

  const scheme = schemeMap[normalized];
  if (!scheme) {
    throw new Error(`Unknown provider name: ${providerName}`);
  }

  return scheme;
}
