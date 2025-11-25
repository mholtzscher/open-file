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
 * Adapter registry for managing multiple adapters
 */
export class AdapterRegistry {
  private adapters: Map<string, Adapter> = new Map();

  constructor() {
    // Register built-in adapters
    this.register('mock', new MockAdapter());
  }

  /**
   * Register an adapter
   */
  register(name: string, adapter: Adapter): void {
    this.adapters.set(name, adapter);
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
   */
  getAdapter(name: string): Adapter {
    const adapter = this.adapters.get(name);
    if (!adapter) {
      throw new Error(`Adapter not found: ${name}`);
    }
    return adapter;
  }

  /**
   * Check if an adapter is registered
   */
  hasAdapter(name: string): boolean {
    return this.adapters.has(name);
  }

  /**
   * List all registered adapters
   */
  listAdapters(): string[] {
    return Array.from(this.adapters.keys());
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
 * Use this for explicit dependency injection rather than relying on the global singleton.
 * The registry comes pre-configured with a MockAdapter for testing convenience.
 *
 * @example
 * ```typescript
 * // Create isolated registry for testing
 * const registry = createAdapterRegistry();
 * registry.registerS3({ region: 'us-east-1' });
 * const adapter = registry.getAdapter('s3');
 * ```
 */
export function createAdapterRegistry(): AdapterRegistry {
  return new AdapterRegistry();
}

// ============================================================================
// Global Registry (for backwards compatibility)
// ============================================================================

// Global registry instance
let globalRegistry: AdapterRegistry | null = null;

/**
 * Get the global adapter registry (singleton)
 *
 * @deprecated Prefer using createAdapterRegistry() for explicit dependency injection,
 * or use AdapterProvider/useAdapter for React components.
 */
export function getAdapterRegistry(): AdapterRegistry {
  if (!globalRegistry) {
    globalRegistry = new AdapterRegistry();
  }
  return globalRegistry;
}

/**
 * Reset the global adapter registry
 *
 * Useful for testing to ensure a clean state between tests.
 * Creates a fresh registry instance on next getAdapterRegistry() call.
 *
 * @example
 * ```typescript
 * beforeEach(() => {
 *   resetAdapterRegistry();
 * });
 * ```
 */
export function resetAdapterRegistry(): void {
  globalRegistry = null;
}

/**
 * Set a custom global adapter registry
 *
 * Useful for testing to inject a pre-configured registry.
 *
 * @example
 * ```typescript
 * const mockRegistry = createAdapterRegistry();
 * mockRegistry.register('custom', myCustomAdapter);
 * setAdapterRegistry(mockRegistry);
 * ```
 */
export function setAdapterRegistry(registry: AdapterRegistry): void {
  globalRegistry = registry;
}

/**
 * Register a global adapter
 *
 * @deprecated Prefer using createAdapterRegistry() for explicit dependency injection.
 */
export function registerAdapter(name: string, adapter: Adapter): void {
  getAdapterRegistry().register(name, adapter);
}

/**
 * Get a global adapter
 *
 * @deprecated Prefer using createAdapterRegistry() for explicit dependency injection.
 */
export function getAdapter(name: string): Adapter {
  return getAdapterRegistry().getAdapter(name);
}

/**
 * Register global S3 adapter
 *
 * @deprecated Prefer using createAdapterRegistry() for explicit dependency injection.
 */
export function registerS3(config: S3AdapterConfig): void {
  getAdapterRegistry().registerS3(config);
}
