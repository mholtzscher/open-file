/**
 * Pending Operations Store
 *
 * Global store for tracking file operations (deletes, moves, copies, renames, creates)
 * across directory navigation. This replaces the buffer-scoped deletion tracking
 * with a URI-based store that works identically across all storage backends.
 *
 * Features:
 * - URI-based entry identification (works across all backends)
 * - Clipboard for cut/copy operations
 * - Undo/redo support
 * - Subscribe/notify pattern for React integration
 */

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
  DEFAULT_VISUAL_STATE,
} from '../types/pending-operations.js';
import { StorageProvider } from '../providers/provider.js';
import { OperationStatus } from '../providers/types/result.js';
import { parseUri, StorageScheme, buildDestinationUri } from '../utils/storage-uri.js';

/**
 * Generate a unique operation ID
 */
function generateId(): string {
  return `op-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Pending Operations Store Interface
 */
export interface PendingOperationsStore {
  // ============================================
  // State Access
  // ============================================

  /** Get all pending operations */
  getOperations(): PendingOperation[];

  /** Get operations affecting a specific directory path */
  getOperationsForPath(path: string, scheme: StorageScheme, bucket?: string): PendingOperation[];

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
  getVirtualEntries(path: string, scheme: StorageScheme, bucket?: string): Entry[];

  /**
   * Check if an entry should be filtered out (deleted or moved away)
   */
  shouldFilterEntry(uri: StorageUri): boolean;

  // ============================================
  // Mutation Operations
  // ============================================

  /** Mark an entry for deletion */
  markForDeletion(uri: StorageUri, entry: Entry): void;

  /** Unmark an entry (remove pending delete) */
  unmarkForDeletion(uri: StorageUri): void;

  /** Toggle deletion mark */
  toggleDeletion(uri: StorageUri, entry: Entry): void;

  /** Check if an entry is marked for deletion */
  isMarkedForDeletion(uri: StorageUri): boolean;

  /** Rename an entry */
  rename(uri: StorageUri, entry: Entry, newName: string): void;

  /** Create a new entry */
  create(uri: StorageUri, name: string, entryType: EntryType): void;

  // ============================================
  // Clipboard Operations
  // ============================================

  /** Cut entries (prepare for move) */
  cut(entries: Entry[], uris: StorageUri[]): void;

  /** Copy entries (prepare for copy) */
  copy(entries: Entry[], uris: StorageUri[]): void;

  /** Paste clipboard contents to destination */
  paste(destPath: string, scheme: StorageScheme, bucket?: string): void;

  /** Clear clipboard */
  clearClipboard(): void;

  /** Check if clipboard has content */
  hasClipboardContent(): boolean;

  /** Check if clipboard operation is cut */
  isClipboardCut(): boolean;

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
   * Execute all pending operations against the storage provider
   * @param provider - Storage provider to execute operations against
   * @param onProgress - Optional callback for progress updates
   * @returns List of failed operations (empty on full success)
   */
  execute(
    provider: StorageProvider,
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

  /** Get snapshot for useSyncExternalStore */
  getSnapshot(): PendingOperationsSnapshot;
}

/**
 * Snapshot of store state for React's useSyncExternalStore
 */
export interface PendingOperationsSnapshot {
  operations: PendingOperation[];
  clipboard: ClipboardState | null;
  canUndo: boolean;
  canRedo: boolean;
}

/**
 * Create a new Pending Operations Store instance
 */
export function createPendingOperationsStore(): PendingOperationsStore {
  // Internal state
  let operations: PendingOperation[] = [];
  let clipboard: ClipboardState | null = null;
  let undoStack: PendingOperation[][] = [];
  let redoStack: PendingOperation[][] = [];
  const listeners = new Set<() => void>();

  // Snapshot cache for React
  let cachedSnapshot: PendingOperationsSnapshot | null = null;

  function notify(): void {
    // Invalidate snapshot cache
    cachedSnapshot = null;
    listeners.forEach(listener => listener());
  }

  function saveToUndoStack(): void {
    undoStack.push([...operations]);
    redoStack = []; // Clear redo stack on new action
  }

  function getSnapshot(): PendingOperationsSnapshot {
    if (!cachedSnapshot) {
      cachedSnapshot = {
        operations: [...operations],
        clipboard: clipboard ? { ...clipboard } : null,
        canUndo: undoStack.length > 0,
        canRedo: redoStack.length > 0,
      };
    }
    return cachedSnapshot;
  }

  const store: PendingOperationsStore = {
    // ============================================
    // State Access
    // ============================================

    getOperations(): PendingOperation[] {
      return [...operations];
    },

    getOperationsForPath(path: string, scheme: StorageScheme, bucket?: string): PendingOperation[] {
      return operations.filter(op => {
        switch (op.type) {
          case 'delete':
          case 'rename':
          case 'create': {
            const parsed = parseUri(op.uri);
            return (
              parsed.scheme === scheme && parsed.bucket === bucket && parsed.path.startsWith(path)
            );
          }
          case 'move':
          case 'copy': {
            const srcParsed = parseUri(op.sourceUri);
            const dstParsed = parseUri(op.destUri);
            const srcMatches =
              srcParsed.scheme === scheme &&
              srcParsed.bucket === bucket &&
              srcParsed.path.startsWith(path);
            const dstMatches =
              dstParsed.scheme === scheme &&
              dstParsed.bucket === bucket &&
              dstParsed.path.startsWith(path);
            return srcMatches || dstMatches;
          }
          default:
            return false;
        }
      });
    },

    getClipboard(): ClipboardState | null {
      return clipboard ? { ...clipboard } : null;
    },

    hasPendingChanges(): boolean {
      return operations.length > 0;
    },

    getPendingCount(): number {
      return operations.length;
    },

    // ============================================
    // Visual State
    // ============================================

    getEntryState(uri: StorageUri): EntryVisualState {
      const state: EntryVisualState = { ...DEFAULT_VISUAL_STATE };

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

    getVirtualEntries(path: string, scheme: StorageScheme, bucket?: string): Entry[] {
      const virtualEntries: Entry[] = [];

      // Normalize path to ensure consistent comparison
      const normalizedPath = path.endsWith('/') || path === '' ? path : path + '/';

      for (const op of operations) {
        if (op.type === 'move' || op.type === 'copy') {
          const destParsed = parseUri(op.destUri);

          // Check if destination is in this directory
          if (destParsed.scheme !== scheme || destParsed.bucket !== bucket) {
            continue;
          }

          // Get directory of destination
          const pathParts = destParsed.path.split('/').filter(Boolean);
          pathParts.pop(); // Remove filename
          const destDir = pathParts.length > 0 ? pathParts.join('/') + '/' : '';

          if (destDir === normalizedPath || (normalizedPath === '' && destDir === '')) {
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

          if (createParsed.scheme !== scheme || createParsed.bucket !== bucket) {
            continue;
          }

          // Get directory of creation
          const pathParts = createParsed.path.split('/').filter(Boolean);
          pathParts.pop();
          const createDir = pathParts.length > 0 ? pathParts.join('/') + '/' : '';

          if (createDir === normalizedPath || (normalizedPath === '' && createDir === '')) {
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

    shouldFilterEntry(uri: StorageUri): boolean {
      const state = store.getEntryState(uri);
      return state.isDeleted || state.isMovedAway;
    },

    // ============================================
    // Mutation Operations
    // ============================================

    markForDeletion(uri: StorageUri, entry: Entry): void {
      // Don't add duplicate
      if (operations.some(op => op.type === 'delete' && op.uri === uri)) {
        return;
      }

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

    unmarkForDeletion(uri: StorageUri): void {
      const hadOperation = operations.some(op => op.type === 'delete' && op.uri === uri);
      if (!hadOperation) return;

      saveToUndoStack();
      operations = operations.filter(op => !(op.type === 'delete' && op.uri === uri));
      notify();
    },

    toggleDeletion(uri: StorageUri, entry: Entry): void {
      const existing = operations.find(op => op.type === 'delete' && op.uri === uri);

      if (existing) {
        store.unmarkForDeletion(uri);
      } else {
        store.markForDeletion(uri, entry);
      }
    },

    isMarkedForDeletion(uri: StorageUri): boolean {
      return operations.some(op => op.type === 'delete' && op.uri === uri);
    },

    rename(uri: StorageUri, entry: Entry, newName: string): void {
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

    create(uri: StorageUri, name: string, entryType: EntryType): void {
      saveToUndoStack();

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

    cut(entries: Entry[], uris: StorageUri[]): void {
      clipboard = {
        entries: structuredClone(entries),
        sourceUris: [...uris],
        operation: 'cut',
        timestamp: Date.now(),
      };
      notify();
    },

    copy(entries: Entry[], uris: StorageUri[]): void {
      clipboard = {
        entries: structuredClone(entries),
        sourceUris: [...uris],
        operation: 'copy',
        timestamp: Date.now(),
      };
      notify();
    },

    paste(destPath: string, scheme: StorageScheme, bucket?: string): void {
      if (!clipboard) return;

      saveToUndoStack();

      for (let i = 0; i < clipboard.entries.length; i++) {
        const entry = clipboard.entries[i];
        const sourceUri = clipboard.sourceUris[i];
        const destUri = buildDestinationUri(entry, destPath, scheme, bucket);

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

    clearClipboard(): void {
      if (!clipboard) return;
      clipboard = null;
      notify();
    },

    hasClipboardContent(): boolean {
      return clipboard !== null && clipboard.entries.length > 0;
    },

    isClipboardCut(): boolean {
      return clipboard?.operation === 'cut';
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
      provider: StorageProvider,
      onProgress?: (op: PendingOperation, index: number, total: number) => void
    ): Promise<PendingOperation[]> {
      const failedOps: PendingOperation[] = [];

      // Sort operations: creates first, then moves/copies/renames, then deletes
      const sortedOps = [...operations].sort((a, b) => {
        const order: Record<string, number> = {
          create: 0,
          copy: 1,
          move: 2,
          rename: 3,
          delete: 4,
        };
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
              const result = await provider.mkdir(parsed.path);
              if (result.status !== OperationStatus.Success && result.error) {
                throw new Error(result.error.message);
              }
              break;
            }
            case 'delete': {
              const parsed = parseUri(op.uri);
              const isDirectory = op.entry.type === EntryType.Directory;
              const result = await provider.delete(parsed.path, { recursive: isDirectory });
              if (result.status !== OperationStatus.Success && result.error) {
                throw new Error(result.error.message);
              }
              break;
            }
            case 'move': {
              const srcParsed = parseUri(op.sourceUri);
              const dstParsed = parseUri(op.destUri);
              const result = await provider.move(srcParsed.path, dstParsed.path);
              if (result.status !== OperationStatus.Success && result.error) {
                throw new Error(result.error.message);
              }
              break;
            }
            case 'copy': {
              const srcParsed = parseUri(op.sourceUri);
              const dstParsed = parseUri(op.destUri);
              const result = await provider.copy(srcParsed.path, dstParsed.path);
              if (result.status !== OperationStatus.Success && result.error) {
                throw new Error(result.error.message);
              }
              break;
            }
            case 'rename': {
              const parsed = parseUri(op.uri);
              const pathParts = parsed.path.split('/');
              pathParts[pathParts.length - 1] = op.newName;
              const newPath = pathParts.join('/');
              const result = await provider.move(parsed.path, newPath);
              if (result.status !== OperationStatus.Success && result.error) {
                throw new Error(result.error.message);
              }
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

    discard(): void {
      operations = [];
      clipboard = null;
      undoStack = [];
      redoStack = [];
      notify();
    },

    removeOperation(id: string): void {
      const hadOperation = operations.some(op => op.id === id);
      if (!hadOperation) return;

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

    getSnapshot,
  };

  return store;
}

/**
 * Singleton store instance for global access
 */
let globalStoreInstance: PendingOperationsStore | null = null;

/**
 * Get the global pending operations store instance
 * Creates a new instance if one doesn't exist
 */
export function getPendingOperationsStore(): PendingOperationsStore {
  if (!globalStoreInstance) {
    globalStoreInstance = createPendingOperationsStore();
  }
  return globalStoreInstance;
}

/**
 * Reset the global store instance (for testing)
 */
export function resetPendingOperationsStore(): void {
  if (globalStoreInstance) {
    globalStoreInstance.discard();
  }
  globalStoreInstance = null;
}
