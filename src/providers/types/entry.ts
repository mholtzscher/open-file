/**
 * Provider Entry Types
 *
 * Provider-specific entry types with extended metadata support.
 * These types use the 'Provider' prefix to avoid conflicts with
 * the existing UI types (Entry, EntryType, EntryMetadata).
 *
 * The prefix will be removed in Phase 7 (Cleanup) after legacy code removal.
 *
 * Use mapper functions (see mappers.ts) to convert between:
 * - ProviderEntry <-> Entry (for UI compatibility)
 */

/**
 * Type of entry in the storage provider
 */
export enum ProviderEntryType {
  /** Regular file */
  File = 'file',
  /** Directory/folder */
  Directory = 'directory',
  /** Storage container (S3/GCS bucket, SMB share, Google Drive) */
  Bucket = 'bucket',
  /** Symbolic link (SFTP, NFS) */
  Symlink = 'symlink',
}

/**
 * Extended metadata for provider entries
 *
 * Includes universal metadata plus provider-specific fields
 */
export interface ProviderEntryMetadata {
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

  // POSIX metadata (SFTP, NFS)
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
export interface ProviderEntry {
  /** Unique identifier for tracking this entry */
  id: string;
  /** Entry name (without path) */
  name: string;
  /** Type of entry */
  type: ProviderEntryType;
  /** Full path to this entry */
  path: string;
  /** Size in bytes (undefined for directories) */
  size?: number;
  /** Last modified timestamp */
  modified?: Date;
  /** Extended metadata */
  metadata?: ProviderEntryMetadata;
}
