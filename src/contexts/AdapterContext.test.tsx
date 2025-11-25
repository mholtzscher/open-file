/**
 * AdapterContext Tests
 *
 * Tests for the adapter dependency injection context.
 * Tests the logic without requiring React rendering.
 */

import { describe, it, expect } from 'bun:test';
import { MockAdapter } from '../adapters/mock-adapter.js';
import { createAdapterRegistry, AdapterRegistry } from '../adapters/registry.js';
import type { Adapter, ReadableStorageAdapter } from '../adapters/adapter.js';

/**
 * Simple implementation to test the adapter context logic
 * without needing React's useContext/hooks
 */
class AdapterContextStore {
  private adapter: Adapter | null = null;
  private registry: AdapterRegistry | undefined = undefined;

  setAdapter(adapter: Adapter, registry?: AdapterRegistry): void {
    this.adapter = adapter;
    this.registry = registry;
  }

  getAdapter(): Adapter {
    if (!this.adapter) {
      throw new Error('useAdapter must be used within an AdapterProvider');
    }
    return this.adapter;
  }

  getTypedAdapter<T extends ReadableStorageAdapter>(): T {
    return this.getAdapter() as unknown as T;
  }

  getAdapterRegistry(): AdapterRegistry | undefined {
    if (!this.adapter) {
      throw new Error('useAdapterRegistry must be used within an AdapterProvider');
    }
    return this.registry;
  }

  hasAdapter(): boolean {
    return this.adapter !== null;
  }

  clear(): void {
    this.adapter = null;
    this.registry = undefined;
  }
}

describe('AdapterContext logic', () => {
  describe('adapter provider', () => {
    it('should store and provide adapter', () => {
      const store = new AdapterContextStore();
      const adapter = new MockAdapter();

      store.setAdapter(adapter);

      expect(store.getAdapter()).toBe(adapter);
    });

    it('should store and provide registry when specified', () => {
      const store = new AdapterContextStore();
      const adapter = new MockAdapter();
      const registry = createAdapterRegistry();

      store.setAdapter(adapter, registry);

      expect(store.getAdapterRegistry()).toBe(registry);
    });

    it('should return undefined registry when not provided', () => {
      const store = new AdapterContextStore();
      const adapter = new MockAdapter();

      store.setAdapter(adapter);

      expect(store.getAdapterRegistry()).toBeUndefined();
    });
  });

  describe('getAdapter (useAdapter equivalent)', () => {
    it('should return the adapter from context', () => {
      const store = new AdapterContextStore();
      const adapter = new MockAdapter();

      store.setAdapter(adapter);

      expect(store.getAdapter()).toBe(adapter);
      expect(store.getAdapter().name).toBe('mock');
    });

    it('should throw when used outside provider', () => {
      const store = new AdapterContextStore();

      expect(() => store.getAdapter()).toThrow('useAdapter must be used within an AdapterProvider');
    });
  });

  describe('getTypedAdapter (useTypedAdapter equivalent)', () => {
    it('should return adapter with narrowed type', () => {
      const store = new AdapterContextStore();
      const adapter = new MockAdapter();

      store.setAdapter(adapter);

      const typedAdapter = store.getTypedAdapter<ReadableStorageAdapter>();

      // Should have ReadableStorageAdapter methods
      expect(typeof typedAdapter.list).toBe('function');
      expect(typeof typedAdapter.read).toBe('function');
      expect(typeof typedAdapter.exists).toBe('function');
    });
  });

  describe('getAdapterRegistry (useAdapterRegistry equivalent)', () => {
    it('should return registry when provided', () => {
      const store = new AdapterContextStore();
      const adapter = new MockAdapter();
      const registry = createAdapterRegistry();
      registry.register('custom', new MockAdapter());

      store.setAdapter(adapter, registry);

      expect(store.getAdapterRegistry()).toBe(registry);
      expect(store.getAdapterRegistry()?.hasAdapter('custom')).toBe(true);
    });

    it('should throw when used outside provider', () => {
      const store = new AdapterContextStore();

      expect(() => store.getAdapterRegistry()).toThrow(
        'useAdapterRegistry must be used within an AdapterProvider'
      );
    });
  });

  describe('hasAdapter (useHasAdapter equivalent)', () => {
    it('should return true when adapter is set', () => {
      const store = new AdapterContextStore();
      const adapter = new MockAdapter();

      store.setAdapter(adapter);

      expect(store.hasAdapter()).toBe(true);
    });

    it('should return false when adapter is not set', () => {
      const store = new AdapterContextStore();

      expect(store.hasAdapter()).toBe(false);
    });

    it('should return false after clear', () => {
      const store = new AdapterContextStore();
      const adapter = new MockAdapter();

      store.setAdapter(adapter);
      expect(store.hasAdapter()).toBe(true);

      store.clear();
      expect(store.hasAdapter()).toBe(false);
    });
  });
});

describe('AdapterContext integration patterns', () => {
  describe('single adapter usage', () => {
    it('should work with just an adapter', () => {
      const store = new AdapterContextStore();
      const adapter = new MockAdapter();

      store.setAdapter(adapter);

      // Components can access the adapter
      const retrieved = store.getAdapter();
      expect(retrieved.name).toBe('mock');
    });
  });

  describe('multi-adapter with registry', () => {
    it('should allow switching adapters via registry', () => {
      const store = new AdapterContextStore();
      const registry = createAdapterRegistry();

      // Register multiple adapters
      const mockAdapter1 = new MockAdapter();
      const mockAdapter2 = new MockAdapter();
      (mockAdapter1 as any).testId = 'adapter1';
      (mockAdapter2 as any).testId = 'adapter2';

      registry.register('adapter1', mockAdapter1);
      registry.register('adapter2', mockAdapter2);

      // Start with adapter1
      store.setAdapter(mockAdapter1, registry);
      expect((store.getAdapter() as any).testId).toBe('adapter1');

      // Switch to adapter2
      const adapter2 = registry.getAdapter('adapter2');
      store.setAdapter(adapter2, registry);
      expect((store.getAdapter() as any).testId).toBe('adapter2');
    });
  });

  describe('adapter lifecycle', () => {
    it('should support adapter replacement', () => {
      const store = new AdapterContextStore();

      const adapter1 = new MockAdapter();
      const adapter2 = new MockAdapter();
      (adapter1 as any).version = 1;
      (adapter2 as any).version = 2;

      store.setAdapter(adapter1);
      expect((store.getAdapter() as any).version).toBe(1);

      store.setAdapter(adapter2);
      expect((store.getAdapter() as any).version).toBe(2);
    });

    it('should handle clearing and re-setting', () => {
      const store = new AdapterContextStore();
      const adapter = new MockAdapter();

      store.setAdapter(adapter);
      expect(store.hasAdapter()).toBe(true);

      store.clear();
      expect(store.hasAdapter()).toBe(false);

      store.setAdapter(adapter);
      expect(store.hasAdapter()).toBe(true);
      expect(store.getAdapter()).toBe(adapter);
    });
  });
});
