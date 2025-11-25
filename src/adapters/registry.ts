/**
 * Adapter Registry
 *
 * Manages multiple adapters and provides a way to switch between them.
 * Allows the application to support different storage backends.
 */

import { Adapter } from './adapter.js';
import { MockAdapter } from './mock-adapter.js';
import { S3Adapter, S3AdapterConfig } from './s3-adapter.js';

// Re-export interfaces and type guards for convenience
export type {
  ReadableStorageAdapter,
  MutableStorageAdapter,
  TransferableStorageAdapter,
  BucketAwareAdapter,
} from './adapter.js';

export { isMutableAdapter, isTransferableAdapter, isBucketAwareAdapter } from './adapter.js';

/**
 * Factory function type for lazy adapter instantiation
 */
export type AdapterFactory = () => Adapter;

/**
 * Adapter registry for managing multiple adapters
 *
 * Supports both eager registration (with instances) and lazy registration
 * (with factories) for optimization. Built-in adapters like MockAdapter
 * are registered lazily to avoid instantiation in production code.
 */
export class AdapterRegistry {
  private adapters: Map<string, Adapter> = new Map();
  private factories: Map<string, AdapterFactory> = new Map();

  constructor() {
    // Register built-in adapters lazily to avoid instantiation overhead
    this.registerFactory('mock', () => new MockAdapter());
  }

  /**
   * Register an adapter instance
   */
  register(name: string, adapter: Adapter): void {
    this.adapters.set(name, adapter);
    // Remove factory if one exists (instance takes precedence)
    this.factories.delete(name);
  }

  /**
   * Register an adapter factory for lazy instantiation
   *
   * The factory will be called on first getAdapter() call for this name.
   * The resulting instance is cached for subsequent calls.
   */
  registerFactory(name: string, factory: AdapterFactory): void {
    this.factories.set(name, factory);
  }

  /**
   * Register S3 adapter with configuration
   */
  registerS3(config: S3AdapterConfig): void {
    const adapter = new S3Adapter(config);
    this.register('s3', adapter);
  }

  /**
   * Get an adapter by name
   *
   * If a factory is registered for this name and no instance exists,
   * the factory is called and the result is cached.
   */
  getAdapter(name: string): Adapter {
    // Check for existing instance first
    let adapter = this.adapters.get(name);
    if (adapter) {
      return adapter;
    }

    // Check for factory and instantiate lazily
    const factory = this.factories.get(name);
    if (factory) {
      adapter = factory();
      this.adapters.set(name, adapter);
      return adapter;
    }

    throw new Error(`Adapter not found: ${name}`);
  }

  /**
   * Check if an adapter is registered (either as instance or factory)
   */
  hasAdapter(name: string): boolean {
    return this.adapters.has(name) || this.factories.has(name);
  }

  /**
   * List all registered adapters (both instances and factories)
   */
  listAdapters(): string[] {
    const names = new Set([...this.adapters.keys(), ...this.factories.keys()]);
    return Array.from(names);
  }

  /**
   * Get the default adapter (mock for now)
   */
  getDefaultAdapter(): Adapter {
    return this.getAdapter('mock');
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new AdapterRegistry instance
 *
 * Use this for explicit dependency injection.
 * The registry comes pre-configured with a MockAdapter factory for testing convenience.
 *
 * @example
 * ```typescript
 * const registry = createAdapterRegistry();
 * registry.registerS3({ region: 'us-east-1' });
 * const adapter = registry.getAdapter('s3');
 * ```
 */
export function createAdapterRegistry(): AdapterRegistry {
  return new AdapterRegistry();
}
