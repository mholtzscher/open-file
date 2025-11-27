/**
 * Provider Storage Adapter
 *
 * Wraps the new StorageProvider interface to implement the StorageContextValue
 * interface. This enables the UI to use the unified StorageContext API while
 * leveraging the new provider system with its advanced features.
 *
 * Key features:
 * - Maps OperationResult to UI-friendly errors
 * - Handles capability checking for UI features
 * - Manages provider lifecycle (connect/disconnect)
 * - Provides progress tracking and state management
 */

import {
  StorageProvider,
  ListOptions as ProviderListOptions,
  ReadOptions as ProviderReadOptions,
  WriteOptions as ProviderWriteOptions,
  DeleteOptions as ProviderDeleteOptions,
  TransferOptions as ProviderTransferOptions,
} from '../providers/provider.js';
import {
  StorageContextValue,
  StorageState,
  StorageError,
  StorageOperationOptions,
  StorageListOptions,
  StorageReadOptions,
  StorageWriteOptions,
} from './StorageContext.js';
import { Entry } from '../types/entry.js';
import { Capability } from '../providers/types/capabilities.js';
import { OperationResult, isSuccess, isUnimplemented } from '../providers/types/result.js';
import type { ProfileManager } from '../providers/services/profile-manager.js';

// ============================================================================
// Implementation
// ============================================================================

/**
 * Provider storage adapter implementation
 *
 * Wraps the new StorageProvider interface to provide the StorageContext API.
 * All operations use the provider's OperationResult pattern for error handling.
 */
export class ProviderStorageAdapter implements StorageContextValue {
  private provider: StorageProvider;
  private profileManager?: ProfileManager;
  private internalState: StorageState;
  private listeners: Set<() => void> = new Set();

  /**
   * Create a new provider storage adapter
   * @param provider - The storage provider to wrap
   * @param initialPath - Initial path to navigate to (defaults to "/")
   * @param initialContainer - Initial container (optional)
   * @param profileManager - Optional ProfileManager instance for profile switching
   */
  constructor(
    provider: StorageProvider,
    initialPath: string = '/',
    initialContainer?: string,
    profileManager?: ProfileManager
  ) {
    this.provider = provider;
    this.profileManager = profileManager;
    this.internalState = {
      providerId: provider.name,
      providerDisplayName: provider.displayName,
      currentPath: initialPath,
      currentContainer: initialContainer,
      entries: [],
      isLoading: false,
      error: undefined,
      isConnected: provider.isConnected?.() ?? true,
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
   * Convert OperationResult error to StorageError
   */
  private resultToStorageError<T>(result: OperationResult<T>): StorageError | undefined {
    if (!result.error) {
      return undefined;
    }

    return {
      code: result.error.code,
      message: result.error.message,
      retryable: result.error.retryable,
      cause: result.error.cause,
    };
  }

  /**
   * Execute an operation with error handling and state management
   */
  private async executeOperation<T>(
    operation: () => Promise<OperationResult<T>>,
    options?: { skipLoadingState?: boolean }
  ): Promise<T> {
    if (!options?.skipLoadingState) {
      this.setState({ isLoading: true, error: undefined });
    }

    try {
      const result = await operation();

      if (isSuccess(result)) {
        if (!options?.skipLoadingState) {
          this.setState({ isLoading: false });
        }
        return result.data as T;
      }

      // Handle error result
      const error = this.resultToStorageError(result);
      this.setState({ isLoading: false, error });

      // Throw for unimplemented operations
      if (isUnimplemented(result)) {
        throw new Error(result.error!.message);
      }

      // Throw for other errors
      throw new Error(result.error!.message);
    } catch (err) {
      // Handle unexpected errors (not OperationResult)
      if (!options?.skipLoadingState) {
        this.setState({
          isLoading: false,
          error: {
            code: 'UNEXPECTED_ERROR',
            message: err instanceof Error ? err.message : String(err),
            retryable: false,
            cause: err,
          },
        });
      }
      throw err;
    }
  }

  // ==========================================================================
  // Navigation Actions
  // ==========================================================================

  /**
   * Navigate to a different path
   */
  async navigate(path: string): Promise<void> {
    this.setState({ isLoading: true, error: undefined });

    try {
      const result = await this.provider.list(path);

      if (isSuccess(result)) {
        this.setState({
          currentPath: path,
          entries: result.data!.entries,
          isLoading: false,
        });
      } else {
        const error = this.resultToStorageError(result);
        this.setState({ isLoading: false, error });
        throw new Error(result.error!.message);
      }
    } catch (err) {
      this.setState({
        isLoading: false,
        error: {
          code: 'UNEXPECTED_ERROR',
          message: err instanceof Error ? err.message : String(err),
          retryable: false,
          cause: err,
        },
      });
      throw err;
    }
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

    const providerOptions: ProviderListOptions = {
      limit: options?.limit,
      continuationToken: options?.continuationToken,
      recursive: options?.recursive,
    };

    this.setState({ isLoading: true, error: undefined });

    try {
      const result = await this.provider.list(targetPath, providerOptions);

      if (isSuccess(result)) {
        // Update state if listing current path
        if (targetPath === this.internalState.currentPath) {
          this.setState({ entries: result.data!.entries, isLoading: false });
        } else {
          this.setState({ isLoading: false });
        }
        return result.data!.entries;
      }

      // Handle error
      const error = this.resultToStorageError(result);
      this.setState({ isLoading: false, error });
      throw new Error(result.error!.message);
    } catch (err) {
      this.setState({
        isLoading: false,
        error: {
          code: 'UNEXPECTED_ERROR',
          message: err instanceof Error ? err.message : String(err),
          retryable: false,
          cause: err,
        },
      });
      throw err;
    }
  }

  /**
   * Read file contents
   */
  async read(path: string, options?: StorageReadOptions): Promise<Buffer> {
    const providerOptions: ProviderReadOptions = {
      offset: options?.offset,
      length: options?.length,
      onProgress: options?.onProgress,
    };

    return await this.executeOperation(
      async () => {
        return await this.provider.read(path, providerOptions);
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
        return await this.provider.exists(path);
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
        return await this.provider.getMetadata(path);
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
    const providerOptions: ProviderWriteOptions = {
      contentType: options?.contentType,
      metadata: options?.metadata,
      onProgress: options?.onProgress,
    };

    await this.executeOperation(async () => {
      return await this.provider.write(path, content, providerOptions);
    });
  }

  /**
   * Create a new directory
   */
  async mkdir(path: string): Promise<void> {
    await this.executeOperation(async () => {
      return await this.provider.mkdir(path);
    });
  }

  /**
   * Delete a file or directory
   */
  async delete(path: string, options?: StorageOperationOptions): Promise<void> {
    const providerOptions: ProviderDeleteOptions = {
      recursive: options?.recursive,
      onProgress: options?.onProgress,
    };

    await this.executeOperation(async () => {
      return await this.provider.delete(path, providerOptions);
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
    const providerOptions: ProviderTransferOptions = {
      recursive: options?.recursive,
      overwrite: options?.overwrite,
      onProgress: options?.onProgress,
    };

    await this.executeOperation(async () => {
      return await this.provider.move(source, destination, providerOptions);
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
    const providerOptions: ProviderTransferOptions = {
      recursive: options?.recursive,
      overwrite: options?.overwrite,
      onProgress: options?.onProgress,
    };

    await this.executeOperation(async () => {
      return await this.provider.copy(source, destination, providerOptions);
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
    if (!this.hasCapability(Capability.Download)) {
      throw new Error('Download not supported by this provider');
    }

    const providerOptions: ProviderTransferOptions = {
      recursive: options?.recursive,
      onProgress: options?.onProgress,
    };

    await this.executeOperation(async () => {
      return await this.provider.downloadToLocal(remotePath, localPath, providerOptions);
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
    if (!this.hasCapability(Capability.Upload)) {
      throw new Error('Upload not supported by this provider');
    }

    const providerOptions: ProviderTransferOptions = {
      recursive: options?.recursive,
      onProgress: options?.onProgress,
    };

    await this.executeOperation(async () => {
      return await this.provider.uploadFromLocal(localPath, remotePath, providerOptions);
    });
  }

  // ==========================================================================
  // Container Operations
  // ==========================================================================

  /**
   * List available containers
   */
  async listContainers(): Promise<Entry[]> {
    if (!this.hasCapability(Capability.Containers)) {
      throw new Error('Container listing not supported by this provider');
    }

    if (!this.provider.listContainers) {
      throw new Error('listContainers method not available');
    }

    return await this.executeOperation(async () => {
      return await this.provider.listContainers!();
    });
  }

  /**
   * Set the current container
   */
  async setContainer(name: string, _region?: string): Promise<void> {
    if (!this.hasCapability(Capability.Containers)) {
      throw new Error('Container operations not supported by this provider');
    }

    if (!this.provider.setContainer) {
      throw new Error('setContainer method not available');
    }

    this.provider.setContainer(name);

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
    if (this.provider.getContainer) {
      return this.provider.getContainer();
    }
    return this.internalState.currentContainer;
  }

  // ==========================================================================
  // Capability Introspection
  // ==========================================================================

  /**
   * Check if a capability is supported
   */
  hasCapability(capability: Capability | string): boolean {
    if (typeof capability === 'string') {
      // Try to convert string to Capability enum
      const cap = capability as Capability;
      return this.provider.hasCapability(cap);
    }
    return this.provider.hasCapability(capability);
  }

  /**
   * Get all capabilities
   */
  getCapabilities(): Set<Capability | string> {
    return this.provider.getCapabilities();
  }

  // ==========================================================================
  // Provider Management
  // ==========================================================================

  /**
   * Switch to a different storage provider
   * Not supported - requires multi-provider context
   */
  async switchProvider(_providerId: string): Promise<void> {
    throw new Error('Provider switching requires multi-provider context');
  }

  /**
   * Disconnect from the current provider
   */
  async disconnect(): Promise<void> {
    if (this.provider.disconnect) {
      await this.provider.disconnect();
    }
    this.setState({ isConnected: false });
  }

  /**
   * Connect/reconnect to the current provider
   */
  async connect(): Promise<void> {
    if (this.provider.connect) {
      const result = await this.provider.connect();
      if (isSuccess(result)) {
        this.setState({ isConnected: true });
      } else {
        const error = this.resultToStorageError(result);
        this.setState({ isConnected: false, error });
        throw new Error(result.error!.message);
      }
    } else {
      this.setState({ isConnected: true });
    }
  }

  /**
   * Get the ProfileManager instance (if available)
   */
  getProfileManager(): ProfileManager | undefined {
    return this.profileManager;
  }
}
