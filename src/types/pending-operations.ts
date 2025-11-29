/**
 * Pending Operations Types
 *
 * Types for the global Pending Operations Store that tracks file operations
 * (deletes, moves, copies, renames, creates) across directory navigation.
 *
 * Uses URI-based entry identification that works identically across all
 * storage backends (S3, SFTP, GCS, local filesystem).
 */

import { Entry, EntryType } from './entry.js';

/**
 * URI scheme for identifying entries across different backends
 *
 * Examples:
 * - s3://bucket-name/path/to/file.txt
 * - gcs://bucket-name/path/to/file.txt
 * - sftp://host:port/path/to/file.txt
 * - file:///local/path/to/file.txt
 */
export type StorageUri = string;

/**
 * Pending operation types
 */
export type PendingOperationType = 'delete' | 'move' | 'copy' | 'rename' | 'create';

/**
 * Base pending operation
 */
interface BasePendingOperation {
  /** Unique identifier for this operation */
  id: string;
  /** Type of operation */
  type: PendingOperationType;
  /** Timestamp when the operation was created */
  createdAt: number;
}

/**
 * Mark an entry for deletion
 */
export interface PendingDelete extends BasePendingOperation {
  type: 'delete';
  /** URI of the entry to delete */
  uri: StorageUri;
  /** Entry metadata snapshot at time of marking */
  entry: Entry;
}

/**
 * Move an entry to a different location (cross-directory)
 */
export interface PendingMove extends BasePendingOperation {
  type: 'move';
  /** URI of the source entry */
  sourceUri: StorageUri;
  /** URI of the destination */
  destUri: StorageUri;
  /** Entry metadata snapshot at time of cut */
  entry: Entry;
}

/**
 * Copy an entry to a different location
 */
export interface PendingCopy extends BasePendingOperation {
  type: 'copy';
  /** URI of the source entry */
  sourceUri: StorageUri;
  /** URI of the destination */
  destUri: StorageUri;
  /** Entry metadata snapshot at time of copy */
  entry: Entry;
}

/**
 * Rename an entry (same directory)
 */
export interface PendingRename extends BasePendingOperation {
  type: 'rename';
  /** URI of the entry to rename */
  uri: StorageUri;
  /** Entry metadata snapshot at time of rename */
  entry: Entry;
  /** New name for the entry */
  newName: string;
}

/**
 * Create a new entry
 */
export interface PendingCreate extends BasePendingOperation {
  type: 'create';
  /** URI where the entry will be created */
  uri: StorageUri;
  /** Type of entry to create */
  entryType: EntryType;
  /** Name of the entry to create */
  name: string;
}

/**
 * Union of all pending operation types
 */
export type PendingOperation =
  | PendingDelete
  | PendingMove
  | PendingCopy
  | PendingRename
  | PendingCreate;

/**
 * Clipboard state for cut/copy operations
 */
export interface ClipboardState {
  /** Entries in the clipboard */
  entries: Entry[];
  /** URIs of the source entries */
  sourceUris: StorageUri[];
  /** Type of clipboard operation */
  operation: 'cut' | 'copy';
  /** Timestamp when the clipboard was populated */
  timestamp: number;
}

/**
 * Visual state for an entry (computed from pending operations)
 *
 * Used by the UI to display pending operation indicators
 */
export interface EntryVisualState {
  /** Entry is marked for deletion */
  isDeleted: boolean;
  /** Entry is the source of a pending move (will disappear) */
  isMovedAway: boolean;
  /** Entry is the destination of a pending move (will appear) */
  isMovedHere: boolean;
  /** Entry is the destination of a pending copy (will appear) */
  isCopiedHere: boolean;
  /** Entry is marked for rename */
  isRenamed: boolean;
  /** Entry is pending creation */
  isCreated: boolean;
  /** New name for renamed entries */
  newName?: string;
  /** Destination path for moved items (for display) */
  moveDestination?: string;
}

/**
 * Default visual state (no pending operations)
 */
export const DEFAULT_VISUAL_STATE: EntryVisualState = {
  isDeleted: false,
  isMovedAway: false,
  isMovedHere: false,
  isCopiedHere: false,
  isRenamed: false,
  isCreated: false,
};
