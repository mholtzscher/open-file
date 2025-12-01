/**
 * StorageContext
 *
 * Unified storage context that provides a consistent interface for UI components,
 * abstracting over both the legacy adapter system and the new provider system.
 *
 * This context serves as the primary interface between UI components and storage
 * operations, allowing seamless migration from adapters to providers via feature flags.
 *
 * Key Features:
 * - Unified interface for both legacy adapters and new providers
 * - Capability-based feature detection
 * - Centralized state management (current path, entries, loading, errors)
 * - Progress tracking for long-running operations
 * - Type-safe operation methods
 * - Multi-provider support (switch between different storage backends)
 */

import { createContext, useContext, ReactNode } from 'react';
import { Entry } from '../types/entry.js';
import { ProgressEvent } from '../types/progress.js';
import { Capability } from '../providers/types/capabilities.js';
import type { ProfileManager } from '../providers/services/profile-manager.js';

// ============================================================================
// Storage State
// ============================================================================

/**
 * Current storage state
 * Represents the state of the storage browser at any given time
 */
export interface StorageState {
  /** Current provider/adapter identifier (e.g., 's3', 'gcs', 'sftp') */
  providerId: string;

  /** Display name of the current provider/adapter (e.g., 'Amazon S3') */
  providerDisplayName: string;

  /** Current profile ID (unique identifier for the profile) */
  profileId?: string;

  /** Current profile name (e.g., 'LocalStack (Dev)', 'Personal AWS Account') */
  profileName?: string;

  /** Current path being viewed */
  currentPath: string;

  /** Current bucket/container (if applicable) */
  currentContainer?: string;

  /** Entries at the current path */
  entries: Entry[];

  /** Whether a list operation is in progress */
  isLoading: boolean;

  /** Current error, if any */
  error?: StorageError;

  /** Whether currently connected (for connection-oriented protocols) */
  isConnected: boolean;
}

/**
 * Storage error with context
 */
export interface StorageError {
  /** Error code for programmatic handling */
  code: string;

  /** Human-readable error message */
  message: string;

  /** Whether the operation can be retried */
  retryable: boolean;

  /** Original error if available */
  cause?: unknown;
}

// ============================================================================
// Operation Options
// ============================================================================

/**
 * Options for storage operations
 */
export interface StorageOperationOptions {
  /** Progress callback for long-running operations */
  onProgress?: (event: ProgressEvent) => void;

  /** Whether to perform operation recursively (for directories) */
  recursive?: boolean;

  /** Whether to overwrite existing files */
  overwrite?: boolean;
}

/**
 * Options for list operations
 */
export interface StorageListOptions {
  /** Maximum number of entries to return */
  limit?: number;

  /** Continuation token for pagination */
  continuationToken?: string;

  /** Whether to list recursively */
  recursive?: boolean;
}

/**
 * Options for read operations
 */
export interface StorageReadOptions {
  /** Byte offset to start reading from */
  offset?: number;

  /** Number of bytes to read */
  length?: number;

  /** Progress callback for long reads */
  onProgress?: (event: ProgressEvent) => void;
}

/**
 * Options for write operations
 */
export interface StorageWriteOptions {
  /** Content type / MIME type */
  contentType?: string;

  /** Custom metadata key-value pairs */
  metadata?: Record<string, string>;

  /** Progress callback for long writes */
  onProgress?: (event: ProgressEvent) => void;
}

// ============================================================================
// Storage Context Value
// ============================================================================

/**
 * Value provided by StorageContext
 *
 * This is the main interface used by UI components to interact with storage.
 * All operations are async and return Promises that resolve/reject appropriately.
 */
export interface StorageContextValue {
  // ==========================================================================
  // State
  // ==========================================================================

  /** Current storage state */
  state: StorageState;

  // ==========================================================================
  // Navigation Actions
  // ==========================================================================

  /**
   * Navigate to a different path
   * @param path - Path to navigate to
   */
  navigate(path: string): Promise<void>;

  /**
   * Navigate up one directory level
   */
  navigateUp(): Promise<void>;

  /**
   * Refresh the current path
   * Reloads entries at the current location
   */
  refresh(): Promise<void>;

  // ==========================================================================
  // Read Operations
  // ==========================================================================

  /**
   * List entries at a specific path
   * @param path - Path to list (defaults to current path)
   * @param options - List options (pagination, etc.)
   * @returns List of entries
   */
  list(path?: string, options?: StorageListOptions): Promise<Entry[]>;

  /**
   * Read file contents
   * @param path - Path to the file
   * @param options - Read options (offset, length, progress)
   * @returns File contents as Buffer
   */
  read(path: string, options?: StorageReadOptions): Promise<Buffer>;

  /**
   * Check if a path exists
   * @param path - Path to check
   * @returns true if the path exists
   */
  exists(path: string): Promise<boolean>;

  /**
   * Get metadata for a specific entry
   * @param path - Path to the entry
   * @returns Entry with full metadata
   */
  getMetadata(path: string): Promise<Entry>;

  // ==========================================================================
  // Write Operations
  // ==========================================================================

  /**
   * Write content to a file
   * @param path - Path to write to
   * @param content - Content to write
   * @param options - Write options (contentType, metadata, progress)
   */
  write(path: string, content: Buffer | string, options?: StorageWriteOptions): Promise<void>;

  /**
   * Create a new directory
   * @param path - Path where to create the directory
   */
  mkdir(path: string): Promise<void>;

  /**
   * Delete a file or directory
   * @param path - Path to delete
   * @param options - Operation options (recursive for directories)
   */
  delete(path: string, options?: StorageOperationOptions): Promise<void>;

  // ==========================================================================
  // Move/Copy Operations
  // ==========================================================================

  /**
   * Move/rename a file or directory
   * @param source - Source path
   * @param destination - Destination path
   * @param options - Operation options (progress callback)
   */
  move(source: string, destination: string, options?: StorageOperationOptions): Promise<void>;

  /**
   * Copy a file or directory
   * @param source - Source path
   * @param destination - Destination path
   * @param options - Operation options (progress callback)
   */
  copy(source: string, destination: string, options?: StorageOperationOptions): Promise<void>;

  // ==========================================================================
  // Local Filesystem Transfers
  // ==========================================================================

  /**
   * Download a file/directory to local filesystem
   * Only available if provider has Download capability
   * @param remotePath - Remote path to download
   * @param localPath - Local filesystem path
   * @param options - Transfer options (recursive, progress)
   */
  download(remotePath: string, localPath: string, options?: StorageOperationOptions): Promise<void>;

  /**
   * Upload a file/directory from local filesystem
   * Only available if provider has Upload capability
   * @param localPath - Local filesystem path
   * @param remotePath - Remote path to upload to
   * @param options - Transfer options (recursive, progress)
   */
  upload(localPath: string, remotePath: string, options?: StorageOperationOptions): Promise<void>;

  // ==========================================================================
  // Container Operations (Buckets, Shares, etc.)
  // ==========================================================================

  /**
   * List available containers (buckets, shares, drives)
   * Only available if provider has Containers capability
   * @returns List of container entries
   */
  listContainers(): Promise<Entry[]>;

  /**
   * Set the current container context
   * Only available if provider has Containers capability
   * @param name - Container name to set
   */
  setContainer(name: string, region?: string): Promise<void>;

  /**
   * Get the current container context
   * @returns Current container name, or undefined if not in a container context
   */
  getContainer(): string | undefined;

  // ==========================================================================
  // Capability Introspection
  // ==========================================================================

  /**
   * Check if a specific capability is supported
   * @param capability - The capability to check
   * @returns true if the capability is supported
   */
  hasCapability(capability: Capability): boolean;

  /**
   * Get all capabilities supported by the current provider
   * @returns Set of supported capabilities
   */
  getCapabilities(): Set<Capability>;

  // ==========================================================================
  // Provider Management
  // ==========================================================================

  /**
   * Switch to a different storage provider
   * @param providerId - ID of the provider to switch to
   */
  switchProvider(providerId: string): Promise<void>;

  /**
   * Disconnect from the current provider
   * Only needed for connection-oriented protocols (SFTP, FTP, SMB)
   */
  disconnect(): Promise<void>;

  /**
   * Connect/reconnect to the current provider
   * Only needed for connection-oriented protocols
   */
  connect(): Promise<void>;

  /**
   * Subscribe to state changes
   * @param listener - Callback function called when state changes
   * @returns Unsubscribe function
   */
  subscribe(listener: () => void): () => void;

  // ==========================================================================
  // Profile Management
  // ==========================================================================

  /**
   * Get the ProfileManager instance (if available)
   * Only available when new provider system is enabled
   * @returns ProfileManager instance or undefined
   */
  getProfileManager(): ProfileManager | undefined;

  /**
   * Switch to a different profile
   * Only available when ProfileManager is configured
   *
   * This will:
   * 1. Disconnect from the current provider
   * 2. Load the new profile from ProfileManager
   * 3. Create a new provider instance
   * 4. Connect to the new provider
   * 5. Reload the current path (or navigate to root)
   *
   * @param profileId - ID of the profile to switch to
   * @throws Error if ProfileManager not available or profile not found
   */
  switchProfile(profileId: string): Promise<void>;
}

// ============================================================================
// Context
// ============================================================================

/**
 * React Context for storage operations
 */
const StorageContext = createContext<StorageContextValue | null>(null);

// ============================================================================
// Provider Props
// ============================================================================

/**
 * Props for StorageProvider component
 */
export interface StorageProviderProps {
  /** Child components */
  children: ReactNode;

  /**
   * Initial provider ID (optional)
   * If not provided, a default provider will be used
   */
  initialProviderId?: string;

  /**
   * Initial path to navigate to (optional)
   * Defaults to root ("/")
   */
  initialPath?: string;

  /**
   * Initial container (bucket, share, etc.) - optional
   */
  initialContainer?: string;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to access the storage context
 *
 * @throws Error if used outside StorageProvider
 *
 * @example
 * ```tsx
 * function FileList() {
 *   const storage = useStorage();
 *
 *   useEffect(() => {
 *     storage.list().then(console.log);
 *   }, [storage]);
 *
 *   return <div>...</div>;
 * }
 * ```
 */
export function useStorage(): StorageContextValue {
  const context = useContext(StorageContext);
  if (!context) {
    throw new Error('useStorage must be used within a StorageProvider');
  }
  return context;
}

/**
 * Hook to check if we're inside a StorageProvider
 *
 * @example
 * ```tsx
 * function OptionalFeature() {
 *   const hasStorage = useHasStorage();
 *
 *   if (!hasStorage) {
 *     return <div>Feature unavailable</div>;
 *   }
 *
 *   return <FeatureWithStorage />;
 * }
 * ```
 */
export function useHasStorage(): boolean {
  const context = useContext(StorageContext);
  return context !== null;
}

/**
 * Hook to access the storage context, returning null if not available
 *
 * Use this when storage is optional (e.g., during profile selection)
 *
 * @example
 * ```tsx
 * function OptionalStorageFeature() {
 *   const storage = useOptionalStorage();
 *
 *   if (!storage) {
 *     return <ProfileSelector />;
 *   }
 *
 *   return <FileList storage={storage} />;
 * }
 * ```
 */
export function useOptionalStorage(): StorageContextValue | null {
  return useContext(StorageContext);
}

// ============================================================================
// Provider Implementation
// ============================================================================

/**
 * StorageProvider component implementation
 *
 * This will be implemented in a separate file (StorageContextProvider.tsx)
 * to avoid circular dependencies and keep the context definition clean.
 *
 * See: StorageContextProvider.tsx for the actual implementation
 */

// ============================================================================
// Export Context (for provider implementation)
// ============================================================================

export { StorageContext };
