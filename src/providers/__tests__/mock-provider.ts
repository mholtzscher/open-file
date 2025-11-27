/**
 * MockStorageProvider
 *
 * A fully in-memory implementation of a storage provider for testing.
 * Implements all operations with configurable behavior for testing
 * different scenarios.
 */

import { Entry, EntryType } from '../../types/entry.js';
import { Capability } from '../types/capabilities.js';
import { OperationResult, OperationStatus, Result, isSuccess } from '../types/result.js';
import { createInMemoryFileSystem } from './test-utils.js';

/**
 * List operation options
 */
export interface MockListOptions {
  limit?: number;
  continuationToken?: string;
  recursive?: boolean;
}

/**
 * List operation result
 */
export interface MockListResult {
  entries: Entry[];
  continuationToken?: string;
  hasMore: boolean;
}

/**
 * Progress event for mock operations
 */
export interface MockProgressEvent {
  operation: string;
  bytesTransferred: number;
  totalBytes?: number;
  percentage: number;
  currentFile?: string;
}

/**
 * Progress callback type
 */
export type MockProgressCallback = (event: MockProgressEvent) => void;

/**
 * Configuration for MockStorageProvider behavior
 */
export interface MockProviderConfig {
  /** Simulate network latency in ms */
  latencyMs?: number;
  /** Fail specific operations with specific errors */
  failOperations?: Map<string, OperationStatus>;
  /** Initial files/directories to populate */
  initialData?: {
    files?: Array<{ path: string; content: string | Buffer; metadata?: Record<string, string> }>;
    directories?: string[];
  };
  /** Capabilities to enable (default: all) */
  capabilities?: Capability[];
}

/**
 * Mock storage provider for testing
 */
export class MockStorageProvider {
  readonly name = 'mock';
  readonly displayName = 'Mock Storage Provider';

  private capabilities = new Set<Capability>();
  private fs = createInMemoryFileSystem();
  private config: MockProviderConfig;
  private connected = true;
  private container: string | undefined;

  constructor(config: MockProviderConfig = {}) {
    this.config = config;

    // Set up capabilities (default: all)
    const defaultCapabilities = [
      Capability.List,
      Capability.Read,
      Capability.Write,
      Capability.Delete,
      Capability.Mkdir,
      Capability.Rmdir,
      Capability.Copy,
      Capability.Move,
      Capability.Download,
      Capability.Upload,
      Capability.Metadata,
      Capability.Containers,
    ];

    const caps = config.capabilities ?? defaultCapabilities;
    for (const cap of caps) {
      this.capabilities.add(cap);
    }

    // Initialize with any provided data
    if (config.initialData) {
      for (const dir of config.initialData.directories ?? []) {
        this.fs.addDirectory(dir);
      }
      for (const file of config.initialData.files ?? []) {
        this.fs.addFile(file.path, file.content, file.metadata);
      }
    }
  }

  // ============================================================================
  // Capability Management
  // ============================================================================

  getCapabilities(): Set<Capability> {
    return new Set(this.capabilities);
  }

  hasCapability(cap: Capability): boolean {
    return this.capabilities.has(cap);
  }

  addCapability(cap: Capability): void {
    this.capabilities.add(cap);
  }

  removeCapability(cap: Capability): void {
    this.capabilities.delete(cap);
  }

  // ============================================================================
  // Connection Lifecycle
  // ============================================================================

  async connect(): Promise<OperationResult> {
    await this.simulateLatency();
    this.connected = true;
    return Result.success();
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  // ============================================================================
  // Core Operations
  // ============================================================================

  async list(path: string, options?: MockListOptions): Promise<OperationResult<MockListResult>> {
    await this.simulateLatency();

    if (this.shouldFail('list')) {
      return this.getFailureResult('list');
    }

    if (!this.connected) {
      return Result.connectionFailed('Not connected') as OperationResult<MockListResult>;
    }

    const normalizedPath = path.endsWith('/') ? path : path + '/';
    const childPaths = this.fs.list(normalizedPath);

    let entries: Entry[] = childPaths.map(childPath => {
      const isDir = childPath.endsWith('/');
      const name = isDir
        ? childPath.slice(normalizedPath.length, -1)
        : childPath.slice(normalizedPath.length);

      return {
        id: `entry-${childPath}`,
        name,
        type: isDir ? EntryType.Directory : EntryType.File,
        path: childPath,
        size: isDir ? undefined : this.fs.getContent(childPath)?.length,
        modified: new Date(),
      };
    });

    // Handle pagination
    const limit = options?.limit ?? 1000;
    const startIndex = options?.continuationToken ? parseInt(options.continuationToken, 10) : 0;
    const hasMore = startIndex + limit < entries.length;
    entries = entries.slice(startIndex, startIndex + limit);

    return Result.success({
      entries,
      continuationToken: hasMore ? String(startIndex + limit) : undefined,
      hasMore,
    });
  }

  async getMetadata(path: string): Promise<OperationResult<Entry>> {
    await this.simulateLatency();

    if (this.shouldFail('getMetadata')) {
      return this.getFailureResult<Entry>('getMetadata');
    }

    if (!this.fs.exists(path)) {
      return Result.notFound(path) as OperationResult<Entry>;
    }

    const isDir = this.fs.directories.has(path) || this.fs.directories.has(path + '/');
    const content = this.fs.getContent(path);
    const name = path.split('/').filter(Boolean).pop() || path;

    return Result.success({
      id: `entry-${path}`,
      name,
      type: isDir ? EntryType.Directory : EntryType.File,
      path,
      size: content?.length,
      modified: new Date(),
    });
  }

  async exists(path: string): Promise<OperationResult<boolean>> {
    await this.simulateLatency();

    if (this.shouldFail('exists')) {
      return this.getFailureResult('exists');
    }

    return Result.success(this.fs.exists(path));
  }

  async read(path: string): Promise<OperationResult<Buffer>> {
    await this.simulateLatency();

    if (this.shouldFail('read')) {
      return this.getFailureResult<Buffer>('read');
    }

    if (!this.hasCapability(Capability.Read)) {
      return Result.unimplemented('read') as OperationResult<Buffer>;
    }

    const content = this.fs.getContent(path);
    if (!content) {
      return Result.notFound(path) as OperationResult<Buffer>;
    }

    return Result.success(content);
  }

  // ============================================================================
  // Write Operations
  // ============================================================================

  async write(
    path: string,
    content: Buffer | string,
    _options?: { onProgress?: MockProgressCallback }
  ): Promise<OperationResult> {
    await this.simulateLatency();

    if (this.shouldFail('write')) {
      return this.getFailureResult('write');
    }

    if (!this.hasCapability(Capability.Write)) {
      return Result.unimplemented('write');
    }

    this.fs.addFile(path, content);
    return Result.success();
  }

  async mkdir(path: string): Promise<OperationResult> {
    await this.simulateLatency();

    if (this.shouldFail('mkdir')) {
      return this.getFailureResult('mkdir');
    }

    if (!this.hasCapability(Capability.Mkdir)) {
      return Result.unimplemented('mkdir');
    }

    this.fs.addDirectory(path);
    return Result.success();
  }

  async delete(path: string, _options?: { recursive?: boolean }): Promise<OperationResult> {
    await this.simulateLatency();

    if (this.shouldFail('delete')) {
      return this.getFailureResult('delete');
    }

    if (!this.hasCapability(Capability.Delete)) {
      return Result.unimplemented('delete');
    }

    if (!this.fs.exists(path)) {
      return Result.notFound(path);
    }

    this.fs.delete(path);
    return Result.success();
  }

  // ============================================================================
  // Move/Copy Operations
  // ============================================================================

  async move(source: string, dest: string): Promise<OperationResult> {
    await this.simulateLatency();

    if (this.shouldFail('move')) {
      return this.getFailureResult('move');
    }

    if (!this.hasCapability(Capability.Move)) {
      return Result.unimplemented('move');
    }

    const content = this.fs.getContent(source);
    if (!content && !this.fs.directories.has(source) && !this.fs.directories.has(source + '/')) {
      return Result.notFound(source);
    }

    // Copy then delete
    const copyResult = await this.copy(source, dest);
    if (!isSuccess(copyResult)) {
      return copyResult;
    }

    this.fs.delete(source);
    return Result.success();
  }

  async copy(source: string, dest: string): Promise<OperationResult> {
    await this.simulateLatency();

    if (this.shouldFail('copy')) {
      return this.getFailureResult('copy');
    }

    if (!this.hasCapability(Capability.Copy)) {
      return Result.unimplemented('copy');
    }

    const content = this.fs.getContent(source);
    if (content) {
      this.fs.addFile(dest, content);
      return Result.success();
    }

    if (this.fs.directories.has(source) || this.fs.directories.has(source + '/')) {
      this.fs.addDirectory(dest);
      return Result.success();
    }

    return Result.notFound(source);
  }

  // ============================================================================
  // Container Operations
  // ============================================================================

  async listContainers(): Promise<OperationResult<Entry[]>> {
    await this.simulateLatency();

    if (this.shouldFail('listContainers')) {
      return this.getFailureResult<Entry[]>('listContainers');
    }

    if (!this.hasCapability(Capability.Containers)) {
      return Result.unimplemented('listContainers') as OperationResult<Entry[]>;
    }

    // Return mock containers
    return Result.success([
      {
        id: 'container-1',
        name: 'bucket-1',
        type: EntryType.Bucket,
        path: '/bucket-1',
        modified: new Date(),
      },
      {
        id: 'container-2',
        name: 'bucket-2',
        type: EntryType.Bucket,
        path: '/bucket-2',
        modified: new Date(),
      },
    ]);
  }

  setContainer(name: string): void {
    this.container = name;
  }

  getContainer(): string | undefined {
    return this.container;
  }

  // ============================================================================
  // Test Helpers
  // ============================================================================

  /**
   * Get direct access to the internal filesystem for test assertions
   */
  getInternalFs() {
    return this.fs;
  }

  /**
   * Reset the provider to initial state
   */
  reset(): void {
    this.fs.clear();
    this.connected = true;
    this.container = undefined;

    // Re-initialize with initial data
    if (this.config.initialData) {
      for (const dir of this.config.initialData.directories ?? []) {
        this.fs.addDirectory(dir);
      }
      for (const file of this.config.initialData.files ?? []) {
        this.fs.addFile(file.path, file.content, file.metadata);
      }
    }
  }

  /**
   * Configure an operation to fail with a specific status
   */
  setOperationFailure(operation: string, status: OperationStatus): void {
    if (!this.config.failOperations) {
      this.config.failOperations = new Map();
    }
    this.config.failOperations.set(operation, status);
  }

  /**
   * Clear any configured operation failures
   */
  clearOperationFailures(): void {
    this.config.failOperations?.clear();
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private async simulateLatency(): Promise<void> {
    if (this.config.latencyMs && this.config.latencyMs > 0) {
      await new Promise(resolve => setTimeout(resolve, this.config.latencyMs));
    }
  }

  private shouldFail(operation: string): boolean {
    return this.config.failOperations?.has(operation) ?? false;
  }

  private getFailureResult<T = void>(operation: string): OperationResult<T> {
    const status = this.config.failOperations?.get(operation) ?? OperationStatus.Error;

    switch (status) {
      case OperationStatus.NotFound:
        return Result.notFound(operation) as OperationResult<T>;
      case OperationStatus.PermissionDenied:
        return Result.permissionDenied(operation) as OperationResult<T>;
      case OperationStatus.Unimplemented:
        return Result.unimplemented(operation) as OperationResult<T>;
      case OperationStatus.ConnectionFailed:
        return Result.connectionFailed(
          `${operation} failed: connection error`
        ) as OperationResult<T>;
      case OperationStatus.Cancelled:
        return Result.cancelled() as OperationResult<T>;
      default:
        return Result.error('MOCK_ERROR', `Mock failure for ${operation}`) as OperationResult<T>;
    }
  }
}
