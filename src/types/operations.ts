import { Entry, EntryType } from './entry.js';

/**
 * Base operation interface
 */
interface BaseOperation {
  /** Operation ID for tracking */
  id: string;
}

/**
 * Create operation - create a new file or directory
 */
export interface CreateOperation extends BaseOperation {
  type: 'create';
  /** Path where to create the entry */
  path: string;
  /** Type of entry to create */
  entryType: EntryType;
  /** Content for files (optional, can be empty) */
  content?: Buffer | string;
}

/**
 * Delete operation - remove a file or directory
 */
export interface DeleteOperation extends BaseOperation {
  type: 'delete';
  /** Path to delete */
  path: string;
  /** Entry being deleted (for confirmation display) */
  entry: Entry;
}

/**
 * Move operation - rename or move a file/directory
 */
export interface MoveOperation extends BaseOperation {
  type: 'move';
  /** Source path */
  source: string;
  /** Destination path */
  destination: string;
  /** Entry being moved */
  entry: Entry;
}

/**
 * Copy operation - duplicate a file/directory
 */
export interface CopyOperation extends BaseOperation {
  type: 'copy';
  /** Source path */
  source: string;
  /** Destination path */
  destination: string;
  /** Entry being copied */
  entry: Entry;
}

/**
 * Download operation - download S3 objects to local filesystem
 */
export interface DownloadOperation extends BaseOperation {
  type: 'download';
  /** S3 path to download from */
  source: string;
  /** Local destination path */
  destination: string;
  /** Entry being downloaded */
  entry: Entry;
  /** Whether to download recursively for directories */
  recursive?: boolean;
}

/**
 * Upload operation - upload local files to S3
 */
export interface UploadOperation extends BaseOperation {
  type: 'upload';
  /** Local source path */
  source: string;
  /** S3 destination path */
  destination: string;
  /** Entry being uploaded */
  entry: Entry;
  /** Whether to upload recursively for directories */
  recursive?: boolean;
}

/**
 * Union type of all operations
 */
export type AdapterOperation =
  | CreateOperation
  | DeleteOperation
  | MoveOperation
  | CopyOperation
  | DownloadOperation
  | UploadOperation;

/**
 * Operation plan - collection of operations to execute
 */
export interface OperationPlan {
  /** List of operations to execute */
  operations: AdapterOperation[];
  /** Summary statistics */
  summary: {
    creates: number;
    deletes: number;
    moves: number;
    copies: number;
    total: number;
  };
}
