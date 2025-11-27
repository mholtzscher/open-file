/**
 * Legacy Storage Adapter
 *
 * Wraps the existing Adapter interface (S3Adapter, MockAdapter) to implement
 * the new StorageContextValue interface. This provides backward compatibility
 * while allowing the UI to use the unified StorageContext API.
 *
 * This adapter maintains full compatibility with existing behavior and serves
 * as the default implementation until the new provider system is enabled.
 */

import {
  Adapter,
  isBucketAwareAdapter,
  isTransferableAdapter,
  ProgressEvent as AdapterProgressEvent,
} from '../adapters/adapter.js';
import {
  StorageContextValue,
  StorageState,
  StorageError,
  StorageOperationOptions,
  StorageListOptions,
  StorageReadOptions,
  StorageWriteOptions,
} from './StorageContext.js';
import { Entry, EntryType } from '../types/entry.js';
import { Capability } from '../providers/types/capabilities.js';

// ============================================================================
// Implementation
// ============================================================================

/**
 * Legacy storage adapter implementation
 *
 * Wraps the legacy Adapter interface to provide the new StorageContext API.
 * All operations delegate to the underlying adapter while maintaining state.
 */
export class LegacyStorageAdapter implements StorageContextValue {
  private adapter: Adapter;
  private internalState: StorageState;
  private listeners: Set<() => void> = new Set();

  /**
   * Create a new legacy storage adapter
   * @param adapter - The legacy adapter to wrap
   * @param initialPath - Initial path to navigate to (defaults to "/")
   * @param initialContainer - Initial container/bucket (optional)
   */
  constructor(adapter: Adapter, initialPath: string = '/', initialContainer?: string) {
    this.adapter = adapter;
    this.internalState = {
      providerId: adapter.name,
      providerDisplayName: adapter.name,
      currentPath: initialPath,
      currentContainer: initialContainer,
      entries: [],
      isLoading: false,
      error: undefined,
      isConnected: true, // Legacy adapters are always "connected"
    };
  }

  // ==========================================================================
  // State Management
  // ==========================================================================

  /**
   * Get the current storage state
   */
  get state(): StorageState {
    return { ...this.internalState };
  }

  /**
   * Update state and notify listeners
   */
  private setState(update: Partial<StorageState>): void {
    this.internalState = { ...this.internalState, ...update };
    this.notifyListeners();
  }

  /**
   * Subscribe to state changes
   * @param listener - Callback to call when state changes
   * @returns Unsubscribe function
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of state changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }

  // ==========================================================================
  // Error Handling
  // ==========================================================================

  /**
   * Convert an error to StorageError format
   */
  private toStorageError(error: unknown): StorageError {
    if (error instanceof Error) {
      return {
        code: 'ADAPTER_ERROR',
        message: error.message,
        retryable: true,
        cause: error,
      };
    }
    return {
      code: 'UNKNOWN_ERROR',
      message: String(error),
      retryable: false,
      cause: error,
    };
  }

  /**
   * Execute an operation with error handling and state management
   */
  private async executeOperation<T>(
    operation: () => Promise<T>,
    options?: { skipLoadingState?: boolean }
  ): Promise<T> {
    if (!options?.skipLoadingState) {
      this.setState({ isLoading: true, error: undefined });
    }

    try {
      const result = await operation();
      if (!options?.skipLoadingState) {
        this.setState({ isLoading: false });
      }
      return result;
    } catch (error) {
      const storageError = this.toStorageError(error);
      this.setState({ isLoading: false, error: storageError });
      throw error;
    }
  }

  // ==========================================================================
  // Navigation Actions
  // ==========================================================================

  /**
   * Navigate to a different path
   */
  async navigate(path: string): Promise<void> {
    await this.executeOperation(async () => {
      const result = await this.adapter.list(path);
      this.setState({
        currentPath: path,
        entries: result.entries,
      });
    });
  }

  /**
   * Navigate up one directory level
   */
  async navigateUp(): Promise<void> {
    const currentPath = this.internalState.currentPath;
    if (currentPath === '/' || currentPath === '') {
      return; // Already at root
    }

    // Remove trailing slash and go up one level
    const normalized = currentPath.replace(/\/$/, '');
    const lastSlashIndex = normalized.lastIndexOf('/');
    const parentPath = lastSlashIndex > 0 ? normalized.substring(0, lastSlashIndex) + '/' : '/';
    await this.navigate(parentPath);
  }

  /**
   * Refresh the current path
   */
  async refresh(): Promise<void> {
    await this.navigate(this.internalState.currentPath);
  }

  // ==========================================================================
  // Read Operations
  // ==========================================================================

  /**
   * List entries at a specific path
   */
  async list(path?: string, options?: StorageListOptions): Promise<Entry[]> {
    const targetPath = path ?? this.internalState.currentPath;

    return await this.executeOperation(async () => {
      const result = await this.adapter.list(targetPath, options);

      // Update state if listing current path
      if (targetPath === this.internalState.currentPath) {
        this.setState({ entries: result.entries });
      }

      return result.entries;
    });
  }

  /**
   * Read file contents
   */
  async read(path: string, options?: StorageReadOptions): Promise<Buffer> {
    return await this.executeOperation(
      async () => {
        return await this.adapter.read(path, {
          onProgress: options?.onProgress,
        });
      },
      { skipLoadingState: true }
    );
  }

  /**
   * Check if a path exists
   */
  async exists(path: string): Promise<boolean> {
    return await this.executeOperation(
      async () => {
        return await this.adapter.exists(path);
      },
      { skipLoadingState: true }
    );
  }

  /**
   * Get metadata for a specific entry
   */
  async getMetadata(path: string): Promise<Entry> {
    return await this.executeOperation(
      async () => {
        return await this.adapter.getMetadata(path);
      },
      { skipLoadingState: true }
    );
  }

  // ==========================================================================
  // Write Operations
  // ==========================================================================

  /**
   * Write content to a file
   */
  async write(
    path: string,
    content: Buffer | string,
    options?: StorageWriteOptions
  ): Promise<void> {
    await this.executeOperation(async () => {
      await this.adapter.create(path, EntryType.File, content, {
        onProgress: options?.onProgress,
      });
    });
  }

  /**
   * Create a new directory
   */
  async mkdir(path: string): Promise<void> {
    await this.executeOperation(async () => {
      await this.adapter.create(path, EntryType.Directory);
    });
  }

  /**
   * Delete a file or directory
   */
  async delete(path: string, options?: StorageOperationOptions): Promise<void> {
    await this.executeOperation(async () => {
      await this.adapter.delete(path, options?.recursive, {
        onProgress: options?.onProgress,
      });
    });
  }

  // ==========================================================================
  // Move/Copy Operations
  // ==========================================================================

  /**
   * Move/rename a file or directory
   */
  async move(
    source: string,
    destination: string,
    options?: StorageOperationOptions
  ): Promise<void> {
    await this.executeOperation(async () => {
      await this.adapter.move(source, destination, {
        onProgress: options?.onProgress,
      });
    });
  }

  /**
   * Copy a file or directory
   */
  async copy(
    source: string,
    destination: string,
    options?: StorageOperationOptions
  ): Promise<void> {
    await this.executeOperation(async () => {
      await this.adapter.copy(source, destination, {
        onProgress: options?.onProgress,
      });
    });
  }

  // ==========================================================================
  // Local Filesystem Transfers
  // ==========================================================================

  /**
   * Download a file/directory to local filesystem
   */
  async download(
    remotePath: string,
    localPath: string,
    options?: StorageOperationOptions
  ): Promise<void> {
    if (!isTransferableAdapter(this.adapter)) {
      throw new Error('Download not supported by this adapter');
    }

    await this.executeOperation(async () => {
      if (!this.adapter.downloadToLocal) {
        throw new Error('downloadToLocal method not available');
      }
      await this.adapter.downloadToLocal(remotePath, localPath, options?.recursive, {
        onProgress: options?.onProgress,
      });
    });
  }

  /**
   * Upload a file/directory from local filesystem
   */
  async upload(
    localPath: string,
    remotePath: string,
    options?: StorageOperationOptions
  ): Promise<void> {
    if (!isTransferableAdapter(this.adapter)) {
      throw new Error('Upload not supported by this adapter');
    }

    await this.executeOperation(async () => {
      if (!this.adapter.uploadFromLocal) {
        throw new Error('uploadFromLocal method not available');
      }
      await this.adapter.uploadFromLocal(localPath, remotePath, options?.recursive, {
        onProgress: options?.onProgress,
      });
    });
  }

  // ==========================================================================
  // Container Operations
  // ==========================================================================

  /**
   * List available containers
   */
  async listContainers(): Promise<Entry[]> {
    if (!isBucketAwareAdapter(this.adapter)) {
      throw new Error('Container listing not supported by this adapter');
    }

    return await this.executeOperation(async () => {
      if (!this.adapter.getBucketEntries) {
        throw new Error('getBucketEntries method not available');
      }
      return await this.adapter.getBucketEntries();
    });
  }

  /**
   * Set the current container
   */
  async setContainer(name: string, region?: string): Promise<void> {
    if (!isBucketAwareAdapter(this.adapter)) {
      throw new Error('Container operations not supported by this adapter');
    }

    if (!this.adapter.setBucket) {
      throw new Error('setBucket method not available');
    }
    this.adapter.setBucket(name);

    if (region) {
      if (!this.adapter.setRegion) {
        throw new Error('setRegion method not available');
      }
      this.adapter.setRegion(region);
    }

    this.setState({
      currentContainer: name,
      currentPath: '/',
    });

    // Automatically navigate to root of new container
    await this.refresh();
  }

  /**
   * Get the current container
   */
  getContainer(): string | undefined {
    return this.internalState.currentContainer;
  }

  // ==========================================================================
  // Capability Introspection
  // ==========================================================================

  /**
   * Check if a capability is supported
   *
   * Maps new Capability enum to legacy adapter capabilities
   */
  hasCapability(capability: Capability | string): boolean {
    switch (capability) {
      case Capability.List:
      case Capability.Read:
      case Capability.Write:
      case Capability.Delete:
      case Capability.Mkdir:
      case Capability.Copy:
      case Capability.Move:
        // All adapters support these core operations
        return true;

      case Capability.Download:
      case Capability.Upload:
        return isTransferableAdapter(this.adapter);

      case Capability.Containers:
        return isBucketAwareAdapter(this.adapter);

      // Advanced capabilities not supported by legacy adapters
      case Capability.Versioning:
      case Capability.Metadata:
      case Capability.Permissions:
      case Capability.Symlinks:
      case Capability.Hardlinks:
      case Capability.PresignedUrls:
      case Capability.BatchDelete:
      case Capability.ExtendedAttrs:
      case Capability.FileLocking:
      case Capability.Delegations:
      case Capability.ServerSideCopy:
      case Capability.Resume:
        return false;

      default:
        // Unknown capability
        return false;
    }
  }

  /**
   * Get all capabilities
   */
  getCapabilities(): Set<Capability | string> {
    const capabilities = new Set<Capability | string>([
      Capability.List,
      Capability.Read,
      Capability.Write,
      Capability.Delete,
      Capability.Mkdir,
      Capability.Copy,
      Capability.Move,
    ]);

    if (isTransferableAdapter(this.adapter)) {
      capabilities.add(Capability.Download);
      capabilities.add(Capability.Upload);
    }

    if (isBucketAwareAdapter(this.adapter)) {
      capabilities.add(Capability.Containers);
    }

    return capabilities;
  }

  // ==========================================================================
  // Provider Management
  // ==========================================================================

  /**
   * Switch to a different storage provider
   * Not supported in legacy mode - only one adapter at a time
   */
  async switchProvider(_providerId: string): Promise<void> {
    throw new Error('Provider switching not supported in legacy mode');
  }

  /**
   * Disconnect from the current provider
   * No-op for legacy adapters (they're always connected)
   */
  async disconnect(): Promise<void> {
    this.setState({ isConnected: false });
  }

  /**
   * Connect/reconnect to the current provider
   * No-op for legacy adapters (they're always connected)
   */
  async connect(): Promise<void> {
    this.setState({ isConnected: true });
  }
}
