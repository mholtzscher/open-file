/**
 * Provider Capabilities
 *
 * Instead of interface inheritance, providers declare capabilities explicitly.
 * The UI can introspect and adapt based on what operations are supported.
 */

export enum Capability {
  // Core operations
  /** List directory contents */
  List = 'list',
  /** Read file contents */
  Read = 'read',
  /** Write/create files */
  Write = 'write',
  /** Delete files or directories */
  Delete = 'delete',

  // Navigation
  /** Create directories */
  Mkdir = 'mkdir',
  /** Remove directories */
  Rmdir = 'rmdir',

  // File management
  /** Copy files within provider */
  Copy = 'copy',
  /** Move/rename files */
  Move = 'move',
  /** Server-side copy (no data transfer through client) */
  ServerSideCopy = 'serverSideCopy',

  // Transfers
  /** Download to local filesystem */
  Download = 'download',
  /** Upload from local filesystem */
  Upload = 'upload',
  /** Resumable transfers */
  Resume = 'resume',

  // Advanced
  /** Version history support */
  Versioning = 'versioning',
  /** Custom metadata support */
  Metadata = 'metadata',
  /** POSIX-style permissions */
  Permissions = 'permissions',
  /** Symbolic links */
  Symlinks = 'symlinks',
  /** Hard links */
  Hardlinks = 'hardlinks',
  /** Generate presigned URLs */
  PresignedUrls = 'presignedUrls',
  /** Batch delete operations */
  BatchDelete = 'batchDelete',
  /** Extended attributes (xattr on NFS, ADS on SMB) */
  ExtendedAttrs = 'extendedAttrs',

  // Container concepts
  /** S3/GCS bucket listing, SMB shares, Google Drive folders */
  Containers = 'containers',

  // Locking (NFS/SMB)
  /** Byte-range file locking */
  FileLocking = 'fileLocking',
  /** NFS delegations / SMB oplocks */
  Delegations = 'delegations',
}
