/**
 * Adapter Registry
 * 
 * Manages multiple adapters and provides a way to switch between them.
 * Allows the application to support different storage backends.
 */

import { Adapter } from './adapter.js';
import { MockAdapter } from './mock-adapter.js';
import { S3Adapter, S3AdapterConfig } from './s3-adapter.js';

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

// Global registry instance
let globalRegistry: AdapterRegistry | null = null;

/**
 * Get the global adapter registry
 */
export function getAdapterRegistry(): AdapterRegistry {
  if (!globalRegistry) {
    globalRegistry = new AdapterRegistry();
  }
  return globalRegistry;
}

/**
 * Register a global adapter
 */
export function registerAdapter(name: string, adapter: Adapter): void {
  getAdapterRegistry().register(name, adapter);
}

/**
 * Get a global adapter
 */
export function getAdapter(name: string): Adapter {
  return getAdapterRegistry().getAdapter(name);
}

/**
 * Register global S3 adapter
 */
export function registerS3(config: S3AdapterConfig): void {
  getAdapterRegistry().registerS3(config);
}
