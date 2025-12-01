/**
 * Storage Hooks
 *
 * Convenience hooks for accessing and interacting with the storage context.
 * These hooks provide a clean, React-friendly API for UI components.
 *
 * Available hooks:
 * - useStorage: Access the full storage context
 * - useStorageState: Access only the state (read-only)
 * - useStorageNavigation: Navigation operations
 * - useStorageOperations: File/directory operations
 * - useStorageCapabilities: Capability checking
 * - useStorageList: List entries with automatic refresh
 */

import { useState, useEffect, useCallback } from 'react';
import { useStorage as useStorageContext } from '../contexts/StorageContext.js';
import { StorageState, StorageOperationOptions } from '../contexts/StorageContext.js';
import { Entry } from '../types/entry.js';
import { Capability } from '../providers/types/capabilities.js';

// ============================================================================
// Re-export base hook
// ============================================================================

/**
 * Access the full storage context
 * This is the base hook that provides access to all storage operations
 */
export { useStorage } from '../contexts/StorageContext.js';

// ============================================================================
// State Hook
// ============================================================================

/**
 * Access only the storage state (read-only)
 * Use this when you only need to read state without performing operations
 *
 * @example
 * ```tsx
 * function CurrentPath() {
 *   const state = useStorageState();
 *   return <div>Current path: {state.currentPath}</div>;
 * }
 * ```
 */
export function useStorageState(): StorageState {
  const storage = useStorageContext();
  const [state, setState] = useState(storage.state);

  useEffect(() => {
    // Subscribe to state changes
    const unsubscribe = storage.subscribe(() => {
      setState(storage.state);
    });

    return unsubscribe;
  }, [storage]);

  return state;
}

// ============================================================================
// Navigation Hooks
// ============================================================================

/**
 * Navigation operations
 * Provides functions for navigating through the storage hierarchy
 *
 * @example
 * ```tsx
 * function NavigationButtons() {
 *   const { navigate, navigateUp, refresh, currentPath } = useStorageNavigation();
 *
 *   return (
 *     <div>
 *       <button onClick={() => navigate('/folder/')}>Go to folder</button>
 *       <button onClick={navigateUp}>Go up</button>
 *       <button onClick={refresh}>Refresh</button>
 *       <div>Current: {currentPath}</div>
 *     </div>
 *   );
 * }
 * ```
 */
export function useStorageNavigation() {
  const storage = useStorageContext();
  const state = useStorageState();

  const navigate = useCallback(
    async (path: string) => {
      await storage.navigate(path);
    },
    [storage]
  );

  const navigateUp = useCallback(async () => {
    await storage.navigateUp();
  }, [storage]);

  const refresh = useCallback(async () => {
    await storage.refresh();
  }, [storage]);

  return {
    navigate,
    navigateUp,
    refresh,
    currentPath: state.currentPath,
    isLoading: state.isLoading,
    error: state.error,
  };
}

// ============================================================================
// List Hook
// ============================================================================

/**
 * List entries with automatic refresh
 * Provides entries at the current path with loading state
 *
 * @example
 * ```tsx
 * function FileList() {
 *   const { entries, isLoading, error, refresh } = useStorageList();
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *
 *   return (
 *     <div>
 *       {entries.map(entry => <div key={entry.id}>{entry.name}</div>)}
 *       <button onClick={refresh}>Refresh</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useStorageList() {
  const storage = useStorageContext();
  const state = useStorageState();

  const refresh = useCallback(async () => {
    await storage.refresh();
  }, [storage]);

  return {
    entries: state.entries,
    isLoading: state.isLoading,
    error: state.error,
    currentPath: state.currentPath,
    refresh,
  };
}

// ============================================================================
// Operations Hook
// ============================================================================

/**
 * File and directory operations
 * Provides functions for creating, deleting, moving, and copying files
 *
 * @example
 * ```tsx
 * function FileOperations({ path }: { path: string }) {
 *   const { deleteFile, moveFile, copyFile, createDirectory } = useStorageOperations();
 *
 *   return (
 *     <div>
 *       <button onClick={() => deleteFile(path)}>Delete</button>
 *       <button onClick={() => moveFile(path, path + '.bak')}>Backup</button>
 *       <button onClick={() => copyFile(path, path + '.copy')}>Copy</button>
 *       <button onClick={() => createDirectory(path + '/new/')}>New Folder</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useStorageOperations() {
  const storage = useStorageContext();

  const createDirectory = useCallback(
    async (path: string) => {
      await storage.mkdir(path);
    },
    [storage]
  );

  const writeFile = useCallback(
    async (path: string, content: Buffer | string, options?: StorageOperationOptions) => {
      await storage.write(path, content, options);
    },
    [storage]
  );

  const readFile = useCallback(
    async (path: string) => {
      return await storage.read(path);
    },
    [storage]
  );

  const deleteFile = useCallback(
    async (path: string, options?: StorageOperationOptions) => {
      await storage.delete(path, options);
    },
    [storage]
  );

  const moveFile = useCallback(
    async (source: string, destination: string, options?: StorageOperationOptions) => {
      await storage.move(source, destination, options);
    },
    [storage]
  );

  const copyFile = useCallback(
    async (source: string, destination: string, options?: StorageOperationOptions) => {
      await storage.copy(source, destination, options);
    },
    [storage]
  );

  const downloadFile = useCallback(
    async (remotePath: string, localPath: string, options?: StorageOperationOptions) => {
      await storage.download(remotePath, localPath, options);
    },
    [storage]
  );

  const uploadFile = useCallback(
    async (localPath: string, remotePath: string, options?: StorageOperationOptions) => {
      await storage.upload(localPath, remotePath, options);
    },
    [storage]
  );

  return {
    createDirectory,
    writeFile,
    readFile,
    deleteFile,
    moveFile,
    copyFile,
    downloadFile,
    uploadFile,
  };
}

// ============================================================================
// Capabilities Hook
// ============================================================================

/**
 * Capability checking
 * Check what operations are supported by the current storage provider
 *
 * @example
 * ```tsx
 * function UploadButton() {
 *   const { hasCapability } = useStorageCapabilities();
 *
 *   if (!hasCapability(Capability.Upload)) {
 *     return null; // Hide button if upload not supported
 *   }
 *
 *   return <button>Upload</button>;
 * }
 * ```
 */
export function useStorageCapabilities() {
  const storage = useStorageContext();

  const hasCapability = useCallback(
    (capability: Capability) => {
      return storage.hasCapability(capability);
    },
    [storage]
  );

  const getCapabilities = useCallback(() => {
    return storage.getCapabilities();
  }, [storage]);

  const canDownload = hasCapability(Capability.Download);
  const canUpload = hasCapability(Capability.Upload);
  const canCopy = hasCapability(Capability.Copy);
  const canMove = hasCapability(Capability.Move);
  const canDelete = hasCapability(Capability.Delete);
  const canWrite = hasCapability(Capability.Write);
  const hasContainers = hasCapability(Capability.Containers);

  return {
    hasCapability,
    getCapabilities,
    canDownload,
    canUpload,
    canCopy,
    canMove,
    canDelete,
    canWrite,
    hasContainers,
  };
}

// ============================================================================
// Container Hook
// ============================================================================

/**
 * Container operations (buckets, shares, etc.)
 * Provides functions for working with storage containers
 *
 * @example
 * ```tsx
 * function ContainerSelector() {
 *   const { currentContainer, listContainers, setContainer, hasContainers } = useStorageContainer();
 *
 *   if (!hasContainers) {
 *     return null; // Hide if provider doesn't support containers
 *   }
 *
 *   const [containers, setContainers] = useState<Entry[]>([]);
 *
 *   useEffect(() => {
 *     listContainers().then(setContainers);
 *   }, [listContainers]);
 *
 *   return (
 *     <select
 *       value={currentContainer || ''}
 *       onChange={(e) => setContainer(e.target.value)}
 *     >
 *       {containers.map(c => <option key={c.id}>{c.name}</option>)}
 *     </select>
 *   );
 * }
 * ```
 */
export function useStorageContainer() {
  const storage = useStorageContext();
  const { hasContainers } = useStorageCapabilities();
  const state = useStorageState();

  const listContainers = useCallback(async (): Promise<Entry[]> => {
    if (!hasContainers) {
      return [];
    }
    return await storage.listContainers();
  }, [storage, hasContainers]);

  const setContainer = useCallback(
    async (name: string, region?: string) => {
      await storage.setContainer(name, region);
    },
    [storage]
  );

  const getContainer = useCallback(() => {
    return storage.getContainer();
  }, [storage]);

  return {
    currentContainer: state.currentContainer,
    listContainers,
    setContainer,
    getContainer,
    hasContainers,
  };
}

// ============================================================================
// Combined Hook for Common Use Cases
// ============================================================================

/**
 * Combined hook for common storage operations
 * Provides the most commonly used operations in a single hook
 *
 * @example
 * ```tsx
 * function FileManager() {
 *   const {
 *     entries,
 *     isLoading,
 *     currentPath,
 *     navigate,
 *     refresh,
 *     deleteFile,
 *     hasCapability,
 *   } = useStorageManager();
 *
 *   return (
 *     <div>
 *       <div>Path: {currentPath}</div>
 *       {isLoading ? <div>Loading...</div> : (
 *         <div>
 *           {entries.map(entry => (
 *             <div key={entry.id}>
 *               {entry.name}
 *               {hasCapability(Capability.Delete) && (
 *                 <button onClick={() => deleteFile(entry.path)}>Delete</button>
 *               )}
 *             </div>
 *           ))}
 *         </div>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useStorageManager() {
  const storage = useStorageContext();
  const state = useStorageState();
  const navigation = useStorageNavigation();
  const operations = useStorageOperations();
  const capabilities = useStorageCapabilities();

  return {
    // State
    ...state,

    // Navigation
    navigate: navigation.navigate,
    navigateUp: navigation.navigateUp,
    refresh: navigation.refresh,

    // Operations
    ...operations,

    // Capabilities
    ...capabilities,

    // Raw storage context (for advanced use)
    storage,
  };
}
