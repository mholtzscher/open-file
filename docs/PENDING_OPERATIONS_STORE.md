# Pending Operations Store - Implementation Design

## Implementation Status

> **Status: PARTIALLY IMPLEMENTED**
>
> This document describes the target architecture for a global Pending Operations Store.
> The current implementation uses buffer-scoped deletion tracking which has known limitations.

### What's Implemented

| Component                       | Status   | Location                                     |
| ------------------------------- | -------- | -------------------------------------------- |
| `PendingOperation` type (basic) | **Done** | `src/types/dialog.ts:29-39`                  |
| Buffer-scoped deletion tracking | **Done** | `src/hooks/useBufferState.ts:80-85, 269-291` |
| Deletion mark actions           | **Done** | `src/hooks/buffer-reducer.ts`                |
| Integration with dialogs        | **Done** | `src/hooks/useDialogHandlers.ts`             |

### What's Planned (Not Yet Implemented)

| Component                                | Status  | Proposed Location                       |
| ---------------------------------------- | ------- | --------------------------------------- |
| `src/types/pending-operations.ts`        | Planned | Enhanced types with URI scheme          |
| `src/utils/storage-uri.ts`               | Planned | URI building/parsing utilities          |
| `src/stores/pending-operations-store.ts` | Planned | Global store (directory does not exist) |
| `src/hooks/usePendingOperations.ts`      | Planned | React hook for store                    |
| Cross-directory persistence              | Planned | Requires global store                   |

---

## Overview

This document describes the architecture for a **Pending Operations Store** that tracks file operations (deletes, moves, copies, renames, creates) across directory navigation. This replaces the current buffer-scoped `deletedEntryIds` approach with a global, URI-based store that works identically across all storage backends (S3, SFTP, GCS, local filesystem).

## Problem Statement

### Current Behavior (Known Bug)

When a user marks a file for deletion in directory `/foo/`, navigates to `/bar/`, and returns to `/foo/`, the deletion mark is lost because:

1. `onLoadBuffer()` fetches fresh entries from the adapter
2. `setEntries()` replaces the buffer's entry array
3. `deletedEntryIds` becomes orphaned (references stale entry IDs)

### Current Implementation

The existing buffer-scoped deletion tracking in `useBufferState.ts`:

```typescript
// src/hooks/useBufferState.ts (lines 80-85)
// Deletion marking (oil.nvim style)
markForDeletion: (entryId: string) => void;
unmarkForDeletion: (entryId: string) => void;
isMarkedForDeletion: (entryId: string) => boolean;
getMarkedForDeletion: () => Entry[];
clearDeletionMarks: () => void;
```

And the basic `PendingOperation` type in `src/types/dialog.ts`:

```typescript
export interface PendingOperation {
  id: string;
  type: 'create' | 'delete' | 'move' | 'copy' | 'download' | 'upload';
  path?: string;
  source?: string;
  destination?: string;
  entry?: Entry;
  entryType?: 'file' | 'directory';
  recursive?: boolean;
}
```

### Root Cause

The current architecture ties pending change state to the **view layer** (`useBufferState`), but this is actually a **domain/model layer concern** that must persist across navigation.

### Requirements

1. Pending changes must survive directory navigation
2. Cross-directory operations (move file from `/a/` to `/b/`) must work
3. Solution must be backend-agnostic (S3, SFTP, GCS, local)
4. Visual feedback must reflect pending state in any directory view
5. Undo/redo support for pending operations

## Architecture

### Design Choice: Explicit Operations Store

Rather than caching buffer states or building a virtual filesystem tree, we use an **explicit operations log** where user intent is captured at action time:

- **Cut** creates a pending move when pasted
- **Copy** creates a pending copy when pasted
- **Delete** creates a pending delete immediately
- **Rename** creates a pending rename immediately

This is simpler than inferring operations from state diffs and handles cross-directory moves naturally.

### System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Actions                            │
│  dd (delete) │ yy (copy) │ p (paste) │ cw (rename) │ :w (save) │
└──────┬───────┴─────┬─────┴─────┬─────┴──────┬──────┴─────┬─────┘
       │             │           │            │            │
       ▼             ▼           ▼            ▼            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   usePendingOperations Hook                     │
│                                                                 │
│  Provides React bindings to the store with scheme/bucket context│
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                   PendingOperationsStore                        │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ operations: PendingOperation[]                           │   │
│  │ clipboard: ClipboardState | null                         │   │
│  │ undoStack: PendingOperation[][]                          │   │
│  │ redoStack: PendingOperation[][]                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Methods: markForDeletion, cut, copy, paste, rename, execute   │
└────────────────────────────────┬────────────────────────────────┘
                                 │
          ┌──────────────────────┼──────────────────┐
          │                      │                  │
          ▼                      ▼                  ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   BufferView    │    │   BufferView    │    │   BufferView    │
│   /foo/         │    │   /bar/         │    │   /baz/         │
│                 │    │                 │    │                 │
│ Calls           │    │ Calls           │    │ Calls           │
│ getEntryState() │    │ getEntryState() │    │ getEntryState() │
│ for styling     │    │ for styling     │    │ for styling     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### URI Scheme

Entries are identified by URIs that encode the storage backend:

```
s3://bucket-name/path/to/file.txt
gcs://bucket-name/path/to/file.txt
sftp://host:port/path/to/file.txt
file:///local/path/to/file.txt
```

This allows the store to work identically across all backends.

## Type Definitions

### File: `src/types/pending-operations.ts` (PLANNED - does not exist yet)

```typescript
import { Entry, EntryType } from './entry.js';

/**
 * URI scheme for identifying entries across different backends
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
  id: string;
  type: PendingOperationType;
  createdAt: number;
}

/**
 * Mark an entry for deletion
 */
export interface PendingDelete extends BasePendingOperation {
  type: 'delete';
  uri: StorageUri;
  entry: Entry;
}

/**
 * Move an entry to a different location (cross-directory)
 */
export interface PendingMove extends BasePendingOperation {
  type: 'move';
  sourceUri: StorageUri;
  destUri: StorageUri;
  entry: Entry;
}

/**
 * Copy an entry to a different location
 */
export interface PendingCopy extends BasePendingOperation {
  type: 'copy';
  sourceUri: StorageUri;
  destUri: StorageUri;
  entry: Entry;
}

/**
 * Rename an entry (same directory)
 */
export interface PendingRename extends BasePendingOperation {
  type: 'rename';
  uri: StorageUri;
  entry: Entry;
  newName: string;
}

/**
 * Create a new entry
 */
export interface PendingCreate extends BasePendingOperation {
  type: 'create';
  uri: StorageUri;
  entryType: EntryType;
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
  entries: Entry[];
  sourceUris: StorageUri[];
  operation: 'cut' | 'copy';
  timestamp: number;
}

/**
 * Visual state for an entry (computed from pending operations)
 */
export interface EntryVisualState {
  isDeleted: boolean;
  isMovedAway: boolean; // Source of a move
  isMovedHere: boolean; // Destination of a move
  isCopiedHere: boolean; // Destination of a copy
  isRenamed: boolean;
  isCreated: boolean;
  newName?: string; // For renames
  moveDestination?: string; // For showing "→ /dest/" on moved items
}
```

## Store Interface

### File: `src/stores/pending-operations-store.ts` (PLANNED - directory does not exist)

```typescript
import { Entry, EntryType } from '../types/entry.js';
import {
  StorageUri,
  PendingOperation,
  ClipboardState,
  EntryVisualState,
} from '../types/pending-operations.js';
import { MutableStorageAdapter } from '../adapters/adapter.js';

export interface PendingOperationsStore {
  // ============================================
  // State Access
  // ============================================

  /** Get all pending operations */
  getOperations(): PendingOperation[];

  /** Get operations affecting a specific directory path */
  getOperationsForPath(path: string): PendingOperation[];

  /** Get current clipboard state */
  getClipboard(): ClipboardState | null;

  /** Check if there are any pending changes */
  hasPendingChanges(): boolean;

  /** Get count of pending operations */
  getPendingCount(): number;

  // ============================================
  // Visual State (for rendering)
  // ============================================

  /** Get visual state for a specific entry */
  getEntryState(uri: StorageUri): EntryVisualState;

  /**
   * Get "virtual" entries for a path
   * Returns entries that should appear due to pending ops:
   * - Moves TO this directory
   * - Copies TO this directory
   * - Creates IN this directory
   */
  getVirtualEntries(path: string): Entry[];

  // ============================================
  // Mutation Operations
  // ============================================

  /** Mark an entry for deletion */
  markForDeletion(uri: StorageUri, entry: Entry): void;

  /** Unmark an entry (remove pending delete) */
  unmarkForDeletion(uri: StorageUri): void;

  /** Toggle deletion mark */
  toggleDeletion(uri: StorageUri, entry: Entry): void;

  /** Rename an entry */
  rename(uri: StorageUri, entry: Entry, newName: string): void;

  /** Create a new entry */
  create(parentPath: string, name: string, entryType: EntryType): void;

  // ============================================
  // Clipboard Operations
  // ============================================

  /** Cut entries (prepare for move) */
  cut(entries: Entry[], uris: StorageUri[]): void;

  /** Copy entries (prepare for copy) */
  copy(entries: Entry[], uris: StorageUri[]): void;

  /** Paste clipboard contents to destination */
  paste(destPath: string): void;

  /** Clear clipboard */
  clearClipboard(): void;

  // ============================================
  // Undo/Redo
  // ============================================

  /** Undo last operation */
  undo(): boolean;

  /** Redo last undone operation */
  redo(): boolean;

  /** Check if undo is available */
  canUndo(): boolean;

  /** Check if redo is available */
  canRedo(): boolean;

  // ============================================
  // Execution
  // ============================================

  /**
   * Execute all pending operations against the adapter
   * @param adapter - Storage adapter to execute operations against
   * @param onProgress - Optional callback for progress updates
   * @returns List of failed operations (empty on full success)
   */
  execute(
    adapter: MutableStorageAdapter,
    onProgress?: (op: PendingOperation, index: number, total: number) => void
  ): Promise<PendingOperation[]>;

  /** Discard all pending operations */
  discard(): void;

  /** Remove a specific operation by ID */
  removeOperation(id: string): void;

  // ============================================
  // Subscriptions (for React integration)
  // ============================================

  /** Subscribe to state changes */
  subscribe(listener: () => void): () => void;
}
```

## URI Utilities

### File: `src/utils/storage-uri.ts` (PLANNED - does not exist yet)

```typescript
import { Entry } from '../types/entry.js';

export type StorageScheme = 's3' | 'sftp' | 'gcs' | 'file' | 'mock';

export interface ParsedUri {
  scheme: StorageScheme;
  bucket?: string; // For S3/GCS
  host?: string; // For SFTP
  port?: number; // For SFTP
  path: string;
  name: string; // Last segment
}

/**
 * Build a storage URI from components
 */
export function buildUri(scheme: StorageScheme, bucket: string | undefined, path: string): string {
  switch (scheme) {
    case 's3':
      return `s3://${bucket}/${path}`;
    case 'gcs':
      return `gcs://${bucket}/${path}`;
    case 'sftp':
      return `sftp://${bucket}/${path}`; // bucket = host:port
    case 'file':
      return `file://${path}`;
    case 'mock':
      return `mock://${bucket || 'default'}/${path}`;
    default:
      throw new Error(`Unknown scheme: ${scheme}`);
  }
}

/**
 * Parse a storage URI into components
 */
export function parseUri(uri: string): ParsedUri {
  const match = uri.match(/^(\w+):\/\/([^/]+)?\/?(.*)/);
  if (!match) throw new Error(`Invalid URI: ${uri}`);

  const [, scheme, bucketOrHost, path] = match;
  const name = path.split('/').filter(Boolean).pop() || '';

  return {
    scheme: scheme as StorageScheme,
    bucket: bucketOrHost,
    path,
    name,
  };
}

/**
 * Get parent path from URI
 */
export function getParentUri(uri: string): string {
  const parsed = parseUri(uri);
  const pathParts = parsed.path.split('/').filter(Boolean);
  pathParts.pop();
  const parentPath = pathParts.length > 0 ? pathParts.join('/') + '/' : '';
  return buildUri(parsed.scheme, parsed.bucket, parentPath);
}

/**
 * Build URI for an entry given current context
 */
export function entryToUri(entry: Entry, scheme: StorageScheme, bucket?: string): string {
  return buildUri(scheme, bucket, entry.path);
}

/**
 * Check if a URI is within a given directory path
 */
export function isUriInPath(
  uri: string,
  directoryPath: string,
  scheme: StorageScheme,
  bucket?: string
): boolean {
  const parsed = parseUri(uri);
  const dirUri = buildUri(scheme, bucket, directoryPath);
  const dirParsed = parseUri(dirUri);

  // Same scheme and bucket
  if (parsed.scheme !== dirParsed.scheme || parsed.bucket !== dirParsed.bucket) {
    return false;
  }

  // Path starts with directory path and is exactly one level deep
  if (!parsed.path.startsWith(directoryPath)) {
    return false;
  }

  const relativePath = parsed.path.slice(directoryPath.length);
  const segments = relativePath.split('/').filter(Boolean);
  return segments.length === 1;
}
```

## React Hook

### File: `src/hooks/usePendingOperations.ts` (PLANNED - does not exist yet)

```typescript
import { useSyncExternalStore, useCallback } from 'react';
import {
  PendingOperationsStore,
  createPendingOperationsStore,
} from '../stores/pending-operations-store.js';
import { Entry, EntryType } from '../types/entry.js';
import {
  StorageUri,
  EntryVisualState,
  PendingOperation,
  ClipboardState,
} from '../types/pending-operations.js';
import { StorageScheme, entryToUri } from '../utils/storage-uri.js';
import { MutableStorageAdapter } from '../adapters/adapter.js';

// Singleton store instance (could also use React Context)
let storeInstance: PendingOperationsStore | null = null;

function getStore(): PendingOperationsStore {
  if (!storeInstance) {
    storeInstance = createPendingOperationsStore();
  }
  return storeInstance;
}

export interface UsePendingOperationsReturn {
  // State
  operations: PendingOperation[];
  hasPendingChanges: boolean;
  pendingCount: number;
  clipboard: ClipboardState | null;

  // Entry state helpers
  getEntryState: (entry: Entry) => EntryVisualState;
  getVirtualEntries: (path: string) => Entry[];

  // Actions
  markForDeletion: (entry: Entry) => void;
  unmarkForDeletion: (entry: Entry) => void;
  toggleDeletion: (entry: Entry) => void;
  rename: (entry: Entry, newName: string) => void;
  create: (parentPath: string, name: string, entryType: EntryType) => void;

  // Clipboard
  cut: (entries: Entry[]) => void;
  copy: (entries: Entry[]) => void;
  paste: (destPath: string) => void;
  clearClipboard: () => void;

  // Undo/Redo
  undo: () => boolean;
  redo: () => boolean;
  canUndo: boolean;
  canRedo: boolean;

  // Execution
  execute: () => Promise<PendingOperation[]>;
  discard: () => void;
}

export function usePendingOperations(
  scheme: StorageScheme,
  bucket?: string,
  adapter?: MutableStorageAdapter
): UsePendingOperationsReturn {
  const store = getStore();

  // Subscribe to store changes for React re-renders
  const operations = useSyncExternalStore(
    store.subscribe,
    () => store.getOperations(),
    () => store.getOperations()
  );

  const clipboard = useSyncExternalStore(
    store.subscribe,
    () => store.getClipboard(),
    () => store.getClipboard()
  );

  // Helper to build URI for entry in current context
  const toUri = useCallback(
    (entry: Entry): StorageUri => entryToUri(entry, scheme, bucket),
    [scheme, bucket]
  );

  // Wrapped actions with scheme/bucket context
  const markForDeletion = useCallback(
    (entry: Entry) => store.markForDeletion(toUri(entry), entry),
    [store, toUri]
  );

  const unmarkForDeletion = useCallback(
    (entry: Entry) => store.unmarkForDeletion(toUri(entry)),
    [store, toUri]
  );

  const toggleDeletion = useCallback(
    (entry: Entry) => store.toggleDeletion(toUri(entry), entry),
    [store, toUri]
  );

  const renameEntry = useCallback(
    (entry: Entry, newName: string) => store.rename(toUri(entry), entry, newName),
    [store, toUri]
  );

  const createEntry = useCallback(
    (parentPath: string, name: string, entryType: EntryType) =>
      store.create(parentPath, name, entryType),
    [store]
  );

  const cut = useCallback(
    (entries: Entry[]) => store.cut(entries, entries.map(toUri)),
    [store, toUri]
  );

  const copy = useCallback(
    (entries: Entry[]) => store.copy(entries, entries.map(toUri)),
    [store, toUri]
  );

  const paste = useCallback((destPath: string) => store.paste(destPath), [store]);

  const getEntryState = useCallback(
    (entry: Entry): EntryVisualState => store.getEntryState(toUri(entry)),
    [store, toUri]
  );

  const execute = useCallback(async () => {
    if (!adapter) throw new Error('No adapter provided');
    return store.execute(adapter);
  }, [store, adapter]);

  return {
    operations,
    hasPendingChanges: store.hasPendingChanges(),
    pendingCount: store.getPendingCount(),
    clipboard,

    getEntryState,
    getVirtualEntries: store.getVirtualEntries.bind(store),

    markForDeletion,
    unmarkForDeletion,
    toggleDeletion,
    rename: renameEntry,
    create: createEntry,

    cut,
    copy,
    paste,
    clearClipboard: store.clearClipboard.bind(store),

    undo: store.undo.bind(store),
    redo: store.redo.bind(store),
    canUndo: store.canUndo(),
    canRedo: store.canRedo(),

    execute,
    discard: store.discard.bind(store),
  };
}
```

## Store Implementation

### File: `src/stores/pending-operations-store.ts` (PLANNED - implementation)

```typescript
import { Entry, EntryType } from '../types/entry.js';
import {
  StorageUri,
  PendingOperation,
  PendingDelete,
  PendingMove,
  PendingCopy,
  PendingRename,
  PendingCreate,
  ClipboardState,
  EntryVisualState,
} from '../types/pending-operations.js';
import { MutableStorageAdapter } from '../adapters/adapter.js';
import { parseUri } from '../utils/storage-uri.js';

function generateId(): string {
  return `op-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createPendingOperationsStore(): PendingOperationsStore {
  let operations: PendingOperation[] = [];
  let clipboard: ClipboardState | null = null;
  let undoStack: PendingOperation[][] = [];
  let redoStack: PendingOperation[][] = [];
  let listeners: Set<() => void> = new Set();

  function notify() {
    listeners.forEach(listener => listener());
  }

  function saveToUndoStack() {
    undoStack.push([...operations]);
    redoStack = []; // Clear redo stack on new action
  }

  return {
    // ============================================
    // State Access
    // ============================================

    getOperations() {
      return [...operations];
    },

    getOperationsForPath(path: string) {
      return operations.filter(op => {
        switch (op.type) {
          case 'delete':
          case 'rename':
          case 'create':
            return parseUri(op.uri).path.startsWith(path);
          case 'move':
          case 'copy':
            return (
              parseUri(op.sourceUri).path.startsWith(path) ||
              parseUri(op.destUri).path.startsWith(path)
            );
          default:
            return false;
        }
      });
    },

    getClipboard() {
      return clipboard;
    },

    hasPendingChanges() {
      return operations.length > 0;
    },

    getPendingCount() {
      return operations.length;
    },

    // ============================================
    // Visual State
    // ============================================

    getEntryState(uri: StorageUri): EntryVisualState {
      const state: EntryVisualState = {
        isDeleted: false,
        isMovedAway: false,
        isMovedHere: false,
        isCopiedHere: false,
        isRenamed: false,
        isCreated: false,
      };

      for (const op of operations) {
        switch (op.type) {
          case 'delete':
            if (op.uri === uri) state.isDeleted = true;
            break;
          case 'move':
            if (op.sourceUri === uri) {
              state.isMovedAway = true;
              state.moveDestination = parseUri(op.destUri).path;
            }
            if (op.destUri === uri) state.isMovedHere = true;
            break;
          case 'copy':
            if (op.destUri === uri) state.isCopiedHere = true;
            break;
          case 'rename':
            if (op.uri === uri) {
              state.isRenamed = true;
              state.newName = op.newName;
            }
            break;
          case 'create':
            if (op.uri === uri) state.isCreated = true;
            break;
        }
      }

      return state;
    },

    getVirtualEntries(path: string): Entry[] {
      const virtualEntries: Entry[] = [];

      for (const op of operations) {
        if (op.type === 'move' || op.type === 'copy') {
          const destParsed = parseUri(op.destUri);
          const destDir = destParsed.path.split('/').slice(0, -1).join('/') + '/';

          if (destDir === path || (path === '' && destDir === '/')) {
            // This operation adds an entry to this directory
            virtualEntries.push({
              ...op.entry,
              id: `virtual-${op.id}`,
              path: destParsed.path,
              name: destParsed.name,
            });
          }
        } else if (op.type === 'create') {
          const createParsed = parseUri(op.uri);
          const createDir = createParsed.path.split('/').slice(0, -1).join('/') + '/';

          if (createDir === path || (path === '' && createDir === '/')) {
            virtualEntries.push({
              id: `virtual-${op.id}`,
              name: op.name,
              type: op.entryType,
              path: createParsed.path,
            });
          }
        }
      }

      return virtualEntries;
    },

    // ============================================
    // Mutation Operations
    // ============================================

    markForDeletion(uri: StorageUri, entry: Entry) {
      saveToUndoStack();

      const op: PendingDelete = {
        id: generateId(),
        type: 'delete',
        uri,
        entry,
        createdAt: Date.now(),
      };

      operations.push(op);
      notify();
    },

    unmarkForDeletion(uri: StorageUri) {
      saveToUndoStack();
      operations = operations.filter(op => !(op.type === 'delete' && op.uri === uri));
      notify();
    },

    toggleDeletion(uri: StorageUri, entry: Entry) {
      const existing = operations.find(op => op.type === 'delete' && op.uri === uri);

      if (existing) {
        this.unmarkForDeletion(uri);
      } else {
        this.markForDeletion(uri, entry);
      }
    },

    rename(uri: StorageUri, entry: Entry, newName: string) {
      saveToUndoStack();

      // Remove any existing rename for this URI
      operations = operations.filter(op => !(op.type === 'rename' && op.uri === uri));

      const op: PendingRename = {
        id: generateId(),
        type: 'rename',
        uri,
        entry,
        newName,
        createdAt: Date.now(),
      };

      operations.push(op);
      notify();
    },

    create(parentPath: string, name: string, entryType: EntryType) {
      saveToUndoStack();

      // Note: URI will need scheme/bucket from context
      // This is a simplified version - real implementation needs URI building
      const uri = `${parentPath}${name}` as StorageUri;

      const op: PendingCreate = {
        id: generateId(),
        type: 'create',
        uri,
        name,
        entryType,
        createdAt: Date.now(),
      };

      operations.push(op);
      notify();
    },

    // ============================================
    // Clipboard Operations
    // ============================================

    cut(entries: Entry[], uris: StorageUri[]) {
      clipboard = {
        entries,
        sourceUris: uris,
        operation: 'cut',
        timestamp: Date.now(),
      };
      notify();
    },

    copy(entries: Entry[], uris: StorageUri[]) {
      clipboard = {
        entries,
        sourceUris: uris,
        operation: 'copy',
        timestamp: Date.now(),
      };
      notify();
    },

    paste(destPath: string) {
      if (!clipboard) return;

      saveToUndoStack();

      for (let i = 0; i < clipboard.entries.length; i++) {
        const entry = clipboard.entries[i];
        const sourceUri = clipboard.sourceUris[i];
        const destUri = `${destPath}${entry.name}` as StorageUri;

        if (clipboard.operation === 'cut') {
          const op: PendingMove = {
            id: generateId(),
            type: 'move',
            sourceUri,
            destUri,
            entry,
            createdAt: Date.now(),
          };
          operations.push(op);
        } else {
          const op: PendingCopy = {
            id: generateId(),
            type: 'copy',
            sourceUri,
            destUri,
            entry,
            createdAt: Date.now(),
          };
          operations.push(op);
        }
      }

      // Clear clipboard after cut (but not copy)
      if (clipboard.operation === 'cut') {
        clipboard = null;
      }

      notify();
    },

    clearClipboard() {
      clipboard = null;
      notify();
    },

    // ============================================
    // Undo/Redo
    // ============================================

    undo(): boolean {
      if (undoStack.length === 0) return false;

      redoStack.push([...operations]);
      operations = undoStack.pop()!;
      notify();
      return true;
    },

    redo(): boolean {
      if (redoStack.length === 0) return false;

      undoStack.push([...operations]);
      operations = redoStack.pop()!;
      notify();
      return true;
    },

    canUndo(): boolean {
      return undoStack.length > 0;
    },

    canRedo(): boolean {
      return redoStack.length > 0;
    },

    // ============================================
    // Execution
    // ============================================

    async execute(
      adapter: MutableStorageAdapter,
      onProgress?: (op: PendingOperation, index: number, total: number) => void
    ): Promise<PendingOperation[]> {
      const failedOps: PendingOperation[] = [];

      // Sort operations: creates first, then moves/copies/renames, then deletes
      const sortedOps = [...operations].sort((a, b) => {
        const order = { create: 0, copy: 1, move: 2, rename: 3, delete: 4 };
        return order[a.type] - order[b.type];
      });

      for (let i = 0; i < sortedOps.length; i++) {
        const op = sortedOps[i];

        if (onProgress) {
          onProgress(op, i, sortedOps.length);
        }

        try {
          switch (op.type) {
            case 'create': {
              const parsed = parseUri(op.uri);
              await adapter.create(parsed.path, op.entryType);
              break;
            }
            case 'delete': {
              const parsed = parseUri(op.uri);
              const isDirectory = op.entry.type === 'directory';
              await adapter.delete(parsed.path, isDirectory);
              break;
            }
            case 'move': {
              const srcParsed = parseUri(op.sourceUri);
              const dstParsed = parseUri(op.destUri);
              await adapter.move(srcParsed.path, dstParsed.path);
              break;
            }
            case 'copy': {
              const srcParsed = parseUri(op.sourceUri);
              const dstParsed = parseUri(op.destUri);
              await adapter.copy(srcParsed.path, dstParsed.path);
              break;
            }
            case 'rename': {
              const parsed = parseUri(op.uri);
              const pathParts = parsed.path.split('/');
              pathParts[pathParts.length - 1] = op.newName;
              const newPath = pathParts.join('/');
              await adapter.move(parsed.path, newPath);
              break;
            }
          }
        } catch (error) {
          console.error(`Failed to execute ${op.type} operation:`, error);
          failedOps.push(op);
        }
      }

      // Clear successful operations
      if (failedOps.length === 0) {
        operations = [];
        undoStack = [];
        redoStack = [];
      } else {
        // Keep only failed operations
        operations = failedOps;
      }

      notify();
      return failedOps;
    },

    discard() {
      operations = [];
      clipboard = null;
      undoStack = [];
      redoStack = [];
      notify();
    },

    removeOperation(id: string) {
      saveToUndoStack();
      operations = operations.filter(op => op.id !== id);
      notify();
    },

    // ============================================
    // Subscriptions
    // ============================================

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
```

## Integration Changes

### Changes to `useBufferState.ts` (PENDING)

> **Current State**: These functions exist and are in use. They will be removed when the global store is implemented.

Remove the following (they move to the pending operations store):

- `deletedEntryIds: Set<string>` (line 27)
- `markForDeletion()` (line 81, 270-272)
- `unmarkForDeletion()` (line 82, 274-276)
- `isMarkedForDeletion()` (line 83, 278-283)
- `getMarkedForDeletion()` (line 84, 285-287)
- `clearDeletionMarks()` (line 85, 289-291)

Also remove from `buffer-reducer.ts`:

- `MARK_FOR_DELETION` action
- `UNMARK_FOR_DELETION` action
- `CLEAR_DELETION_MARKS` action
- `deletedEntryIds` from `BufferState` and `BufferSnapshot`

Keep undo/redo for buffer-level operations (cursor, entries), but pending operations now have their own undo stack.

### Changes to `file-explorer.tsx` (PENDING)

> **Note**: The document previously referenced `S3Explorer.tsx` but the main component is `file-explorer.tsx`.

### Changes to `file-explorer.tsx`

```typescript
// Add the hook (PLANNED)
const pendingOps = usePendingOperations('s3', bucket, adapter);

// Update action handlers to use new hook instead of bufferState.markForDeletion
'entry:delete': () => {
  const selected = getActiveBuffer().getSelectedEntries();
  for (const entry of selected) {
    pendingOps.toggleDeletion(entry);
  }
},

'entry:copy': () => {
  const selected = getActiveBuffer().getSelectedEntries();
  pendingOps.copy(selected);
},

'entry:paste': () => {
  const currentPath = getActiveBuffer().currentPath;
  pendingOps.paste(currentPath);
},

'buffer:save': async () => {
  if (!pendingOps.hasPendingChanges) {
    setStatusMessage('No changes to save');
    return;
  }
  const failed = await pendingOps.execute();
  if (failed.length === 0) {
    setStatusMessage('All operations completed');
    // Refresh current directory
    await navigationHandlers.navigateToPath(activeBufferState.currentPath);
  } else {
    setStatusMessage(`${failed.length} operation(s) failed`);
  }
},
```

### Changes to `BufferView` (PENDING)

```typescript
function EntryRow({ entry, pendingOps }: Props) {
  const state = pendingOps.getEntryState(entry);

  const style = {
    textDecoration: (state.isDeleted || state.isMovedAway) ? 'line-through' : 'none',
    opacity: (state.isCreated || state.isMovedHere || state.isCopiedHere) ? 0.7 : 1,
    color: state.isDeleted ? colors.red :
           state.isRenamed ? colors.yellow :
           state.isCreated ? colors.green :
           colors.text,
  };

  const displayName = state.isRenamed
    ? `${entry.name} → ${state.newName}`
    : entry.name;

  const suffix = state.isMovedAway
    ? ` → ${state.moveDestination}`
    : '';

  return <Text style={style}>{displayName}{suffix}</Text>;
}
```

## Implementation Order

> **Current Progress**: None of the phases below have been started.

1. **Phase 1: Types & Utilities** - NOT STARTED
   - [ ] Create `src/types/pending-operations.ts`
   - [ ] Create `src/utils/storage-uri.ts`
   - [ ] Add tests for URI utilities

2. **Phase 2: Store Implementation** - NOT STARTED
   - [ ] Create `src/stores/` directory
   - [ ] Create `src/stores/pending-operations-store.ts`
   - [ ] Add comprehensive tests for all store operations

3. **Phase 3: React Hook** - NOT STARTED
   - [ ] Create `src/hooks/usePendingOperations.ts`
   - [ ] Add tests for hook behavior

4. **Phase 4: Integration** - NOT STARTED
   - [ ] Update `file-explorer.tsx` to use the new hook
   - [ ] Update `BufferView` rendering
   - [ ] Remove old deletion tracking from `useBufferState.ts`
   - [ ] Remove deletion actions from `buffer-reducer.ts`
   - [ ] Update `useDialogHandlers.ts` to use new store

5. **Phase 5: Polish** - NOT STARTED
   - [ ] Add visual indicators for all pending operation types
   - [ ] Implement confirmation dialog updates
   - [ ] Add keyboard shortcuts for cut/copy/paste

## Testing Strategy

### Unit Tests

- URI parsing and building
- Store state mutations
- Visual state computation
- Operation ordering for execution

### Integration Tests

- Mark file in dir A, navigate to B, return to A, verify mark persists
- Cut file from A, paste in B, verify move operation created
- Execute operations and verify adapter calls
- Undo/redo across navigation

### E2E Tests

- Full workflow: mark files, navigate, save, verify S3 state
- Cross-directory move workflow
- Error handling when operations fail

## Future Enhancements

1. **Persist pending operations** - Save to localStorage/file for crash recovery
2. **Operation batching** - Group operations for atomic execution
3. **Conflict detection** - Warn when source file changed since marking
4. **Progress per operation** - Fine-grained progress for large operations
5. **Operation preview** - Show diff view before executing

---

## Appendix: Current Implementation Reference

### Files Currently Using Deletion Tracking

| File                             | Usage                                                 |
| -------------------------------- | ----------------------------------------------------- |
| `src/hooks/useBufferState.ts`    | Defines deletion marking interface and implementation |
| `src/hooks/buffer-reducer.ts`    | Reducer actions for deletion state                    |
| `src/hooks/useDialogHandlers.ts` | Converts marks to `PendingOperation[]` on save        |
| `src/hooks/useS3Actions.ts`      | `dd` keybinding toggles deletion mark                 |
| `src/ui/file-explorer.tsx`       | Passes bufferState to components                      |

### Migration Notes

When implementing the global store, ensure:

1. **Backward compatibility**: The current `dd` keybinding workflow should work identically
2. **Test coverage**: Add tests that verify marks persist across navigation
3. **Gradual migration**: Can implement store alongside existing code, then switch over
