/**
 * Entry Types
 *
 * Entry types with extended metadata support for all provider types.
 * Supports files, directories, buckets, and symlinks with metadata
 * for cloud storage (S3/GCS), POSIX filesystems (SFTP), and more.
 */

/**
 * Type of entry in the storage provider
 */
export enum EntryType {
  /** Regular file */
  File = 'file',
  /** Directory/folder */
  Directory = 'directory',
  /** Storage container (S3/GCS bucket, SMB share, Google Drive) */
  Bucket = 'bucket',
  /** Symbolic link (SFTP) */
  Symlink = 'symlink',
}

/**
 * Extended metadata for entries
 *
 * Includes universal metadata plus provider-specific fields
 */
export interface EntryMetadata {
  // Universal metadata
  /** Content type / MIME type */
  contentType?: string;

  // Cloud storage metadata (S3/GCS)
  /** ETag for versioning and caching */
  etag?: string;
  /** Storage class (e.g., STANDARD, GLACIER, NEARLINE) */
  storageClass?: string;
  /** Version identifier */
  versionId?: string;

  // POSIX metadata (SFTP)
  /** POSIX permissions (e.g., 0o755) */
  permissions?: number;
  /** File owner username */
  owner?: string;
  /** File group name */
  group?: string;
  /** Last access time */
  accessed?: Date;

  // Symlink metadata (SFTP)
  /** Target path for symbolic links */
  symlinkTarget?: string;

  // Container metadata (buckets, shares)
  /** Region for cloud storage buckets */
  region?: string;
  /** Container creation timestamp */
  createdAt?: Date;
  /** Total size of all objects in container */
  totalSize?: number;
  /** Number of objects in container */
  objectCount?: number;

  // Custom metadata
  /** User-defined key-value metadata */
  custom?: Record<string, string>;
  /** Raw provider-specific data (for debugging/advanced use) */
  providerData?: Record<string, unknown>;
}

/**
 * A file system entry from a storage provider
 *
 * Represents files, directories, buckets, and symlinks with
 * extended metadata support for all provider types.
 */
export interface Entry {
  /** Unique identifier for tracking this entry */
  id: string;
  /** Entry name (without path) */
  name: string;
  /** Type of entry */
  type: EntryType;
  /** Full path to this entry */
  path: string;
  /** Size in bytes (undefined for directories) */
  size?: number;
  /** Last modified timestamp */
  modified?: Date;
  /** Extended metadata */
  metadata?: EntryMetadata;
}
