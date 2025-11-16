/**
 * Entry type - represents a file or directory in the adapter
 */
export enum EntryType {
  File = 'file',
  Directory = 'directory',
}

/**
 * Entry metadata - additional information about an entry
 */
export interface EntryMetadata {
  /** Content type / MIME type */
  contentType?: string;
  /** ETag for versioning */
  etag?: string;
  /** Storage class (for S3) */
  storageClass?: string;
  /** Custom metadata key-value pairs */
  custom?: Record<string, string>;
}

/**
 * Entry - represents a single file or directory entry
 */
export interface Entry {
  /** Unique identifier for tracking this entry */
  id: string;
  /** Entry name (without path) */
  name: string;
  /** Type of entry */
  type: EntryType;
  /** Size in bytes (undefined for directories) */
  size?: number;
  /** Last modified timestamp */
  modified?: Date;
  /** Additional metadata */
  metadata?: EntryMetadata;
  /** Full path to this entry */
  path: string;
}
