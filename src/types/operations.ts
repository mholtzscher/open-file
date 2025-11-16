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
 * Union type of all operations
 */
export type AdapterOperation =
  | CreateOperation
  | DeleteOperation
  | MoveOperation
  | CopyOperation;

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
