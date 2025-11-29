/**
 * usePendingOperations Hook
 *
 * React hook that provides access to the global Pending Operations Store
 * with scheme/bucket context for the current storage provider.
 *
 * This hook wraps the store methods to automatically handle URI building
 * based on the current provider context.
 */

import { useSyncExternalStore, useCallback, useMemo } from 'react';
import { Entry, EntryType } from '../types/entry.js';
import {
  StorageUri,
  EntryVisualState,
  PendingOperation,
  ClipboardState,
} from '../types/pending-operations.js';
import { StorageScheme, entryToUri } from '../utils/storage-uri.js';
import {
  getPendingOperationsStore,
  PendingOperationsStore,
} from '../stores/pending-operations-store.js';
import { StorageProvider } from '../providers/provider.js';

/**
 * Return type for usePendingOperations hook
 */
export interface UsePendingOperationsReturn {
  // State
  /** All pending operations */
  operations: PendingOperation[];
  /** Whether there are pending changes to save */
  hasPendingChanges: boolean;
  /** Count of pending operations */
  pendingCount: number;
  /** Current clipboard state */
  clipboard: ClipboardState | null;

  // Entry state helpers
  /** Get visual state for an entry (deleted, renamed, etc.) */
  getEntryState: (entry: Entry) => EntryVisualState;
  /** Get virtual entries for current path (moves/copies/creates) */
  getVirtualEntries: (path: string) => Entry[];
  /** Check if an entry should be filtered out (deleted/moved away) */
  shouldFilterEntry: (entry: Entry) => boolean;
  /** Check if an entry is marked for deletion */
  isMarkedForDeletion: (entry: Entry) => boolean;

  // Deletion actions
  /** Mark an entry for deletion */
  markForDeletion: (entry: Entry) => void;
  /** Unmark an entry (remove pending delete) */
  unmarkForDeletion: (entry: Entry) => void;
  /** Toggle deletion mark on an entry */
  toggleDeletion: (entry: Entry) => void;
  /** Get all entries marked for deletion */
  getMarkedForDeletion: () => Entry[];

  // Other mutation actions
  /** Rename an entry */
  rename: (entry: Entry, newName: string) => void;
  /** Create a new entry */
  create: (parentPath: string, name: string, entryType: EntryType) => void;

  // Clipboard
  /** Cut entries (prepare for move) */
  cut: (entries: Entry[]) => void;
  /** Copy entries (prepare for copy) */
  copy: (entries: Entry[]) => void;
  /** Paste clipboard contents to destination */
  paste: (destPath: string) => void;
  /** Clear clipboard */
  clearClipboard: () => void;
  /** Check if clipboard has content */
  hasClipboardContent: boolean;
  /** Check if clipboard operation is cut */
  isClipboardCut: boolean;

  // Undo/Redo
  /** Undo last operation */
  undo: () => boolean;
  /** Redo last undone operation */
  redo: () => boolean;
  /** Check if undo is available */
  canUndo: boolean;
  /** Check if redo is available */
  canRedo: boolean;

  // Execution
  /** Execute all pending operations */
  execute: () => Promise<PendingOperation[]>;
  /** Discard all pending operations */
  discard: () => void;
  /** Remove a specific operation by ID */
  removeOperation: (id: string) => void;
}

/**
 * Hook to access and manage pending operations with provider context
 *
 * @param scheme - Storage scheme (s3, sftp, gcs, file, etc.)
 * @param bucket - Bucket name or host for the provider
 * @param provider - Optional storage provider for executing operations
 * @returns Pending operations state and actions
 *
 * @example
 * ```tsx
 * const pendingOps = usePendingOperations('s3', 'my-bucket', provider);
 *
 * // Mark file for deletion
 * pendingOps.toggleDeletion(selectedEntry);
 *
 * // Check if entry is deleted
 * const state = pendingOps.getEntryState(entry);
 * if (state.isDeleted) {
 *   // Render with strikethrough
 * }
 *
 * // Save changes
 * await pendingOps.execute();
 * ```
 */
export function usePendingOperations(
  scheme: StorageScheme,
  bucket?: string,
  provider?: StorageProvider
): UsePendingOperationsReturn {
  const store = getPendingOperationsStore();

  // Subscribe to store changes using React 18's useSyncExternalStore
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot // Server snapshot (same for this use case)
  );

  // Helper to build URI for entry in current context
  // Returns null if we can't build a valid URI (e.g., no bucket for S3)
  const toUri = useCallback(
    (entry: Entry): StorageUri | null => {
      // Can't build URI without bucket for cloud storage
      if (!bucket && (scheme === 's3' || scheme === 'gcs')) {
        return null;
      }
      return entryToUri(entry, scheme, bucket);
    },
    [scheme, bucket]
  );

  // ============================================
  // Entry State Helpers
  // ============================================

  const getEntryState = useCallback(
    (entry: Entry): EntryVisualState => {
      const uri = toUri(entry);
      if (!uri)
        return {
          isDeleted: false,
          isMovedAway: false,
          isMovedHere: false,
          isCopiedHere: false,
          isRenamed: false,
          isCreated: false,
        };
      return store.getEntryState(uri);
    },
    [store, toUri]
  );

  const getVirtualEntries = useCallback(
    (path: string): Entry[] => {
      return store.getVirtualEntries(path, scheme, bucket);
    },
    [store, scheme, bucket]
  );

  const shouldFilterEntry = useCallback(
    (entry: Entry): boolean => {
      const uri = toUri(entry);
      if (!uri) return false;
      return store.shouldFilterEntry(uri);
    },
    [store, toUri]
  );

  const isMarkedForDeletion = useCallback(
    (entry: Entry): boolean => {
      const uri = toUri(entry);
      if (!uri) return false;
      return store.isMarkedForDeletion(uri);
    },
    [store, toUri]
  );

  // ============================================
  // Deletion Actions
  // ============================================

  const markForDeletion = useCallback(
    (entry: Entry): void => {
      const uri = toUri(entry);
      if (!uri) return;
      store.markForDeletion(uri, entry);
    },
    [store, toUri]
  );

  const unmarkForDeletion = useCallback(
    (entry: Entry): void => {
      const uri = toUri(entry);
      if (!uri) return;
      store.unmarkForDeletion(uri);
    },
    [store, toUri]
  );

  const toggleDeletion = useCallback(
    (entry: Entry): void => {
      const uri = toUri(entry);
      if (!uri) return;
      store.toggleDeletion(uri, entry);
    },
    [store, toUri]
  );

  const getMarkedForDeletion = useCallback((): Entry[] => {
    // Read directly from store to get immediate state (not stale React snapshot)
    // This is important for getting accurate counts right after mutations
    return store
      .getOperations()
      .filter((op): op is Extract<PendingOperation, { type: 'delete' }> => op.type === 'delete')
      .map(op => op.entry);
  }, [store]);

  // ============================================
  // Other Mutation Actions
  // ============================================

  const renameEntry = useCallback(
    (entry: Entry, newName: string): void => {
      const uri = toUri(entry);
      if (!uri) return;
      store.rename(uri, entry, newName);
    },
    [store, toUri]
  );

  const createEntry = useCallback(
    (parentPath: string, name: string, entryType: EntryType): void => {
      // Build URI for the new entry
      const normalizedPath =
        parentPath.endsWith('/') || parentPath === '' ? parentPath : parentPath + '/';
      const fullPath = normalizedPath + name;
      const uri = entryToUri({ id: '', name, type: entryType, path: fullPath }, scheme, bucket);
      store.create(uri, name, entryType);
    },
    [store, scheme, bucket]
  );

  // ============================================
  // Clipboard Actions
  // ============================================

  const cut = useCallback(
    (entries: Entry[]): void => {
      const uris = entries.map(toUri).filter((uri): uri is string => uri !== null);
      if (uris.length !== entries.length) return; // Can't cut without valid URIs
      store.cut(entries, uris);
    },
    [store, toUri]
  );

  const copy = useCallback(
    (entries: Entry[]): void => {
      const uris = entries.map(toUri).filter((uri): uri is string => uri !== null);
      if (uris.length !== entries.length) return; // Can't copy without valid URIs
      store.copy(entries, uris);
    },
    [store, toUri]
  );

  const paste = useCallback(
    (destPath: string): void => {
      store.paste(destPath, scheme, bucket);
    },
    [store, scheme, bucket]
  );

  const clearClipboard = useCallback((): void => {
    store.clearClipboard();
  }, [store]);

  // ============================================
  // Undo/Redo
  // ============================================

  const undo = useCallback((): boolean => {
    return store.undo();
  }, [store]);

  const redo = useCallback((): boolean => {
    return store.redo();
  }, [store]);

  // ============================================
  // Execution
  // ============================================

  const execute = useCallback(async (): Promise<PendingOperation[]> => {
    if (!provider) {
      throw new Error('No storage provider available for executing operations');
    }
    return store.execute(provider);
  }, [store, provider]);

  const discard = useCallback((): void => {
    store.discard();
  }, [store]);

  const removeOperation = useCallback(
    (id: string): void => {
      store.removeOperation(id);
    },
    [store]
  );

  // ============================================
  // Memoized return value
  // ============================================

  return useMemo(
    () => ({
      // State from snapshot
      operations: snapshot.operations,
      hasPendingChanges: snapshot.operations.length > 0,
      pendingCount: snapshot.operations.length,
      clipboard: snapshot.clipboard,

      // Entry state helpers
      getEntryState,
      getVirtualEntries,
      shouldFilterEntry,
      isMarkedForDeletion,

      // Deletion actions
      markForDeletion,
      unmarkForDeletion,
      toggleDeletion,
      getMarkedForDeletion,

      // Other mutations
      rename: renameEntry,
      create: createEntry,

      // Clipboard
      cut,
      copy,
      paste,
      clearClipboard,
      hasClipboardContent: snapshot.clipboard !== null && snapshot.clipboard.entries.length > 0,
      isClipboardCut: snapshot.clipboard?.operation === 'cut',

      // Undo/Redo
      undo,
      redo,
      canUndo: snapshot.canUndo,
      canRedo: snapshot.canRedo,

      // Execution
      execute,
      discard,
      removeOperation,
    }),
    [
      snapshot,
      getEntryState,
      getVirtualEntries,
      shouldFilterEntry,
      isMarkedForDeletion,
      markForDeletion,
      unmarkForDeletion,
      toggleDeletion,
      getMarkedForDeletion,
      renameEntry,
      createEntry,
      cut,
      copy,
      paste,
      clearClipboard,
      undo,
      redo,
      execute,
      discard,
      removeOperation,
    ]
  );
}

/**
 * Convenience hook to get the raw store instance
 * Useful for components that need direct store access without provider context
 */
export function usePendingOperationsStore(): PendingOperationsStore {
  return getPendingOperationsStore();
}
