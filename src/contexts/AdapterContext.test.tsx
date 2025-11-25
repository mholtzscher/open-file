/**
 * AdapterContext Tests
 *
 * Tests for the adapter dependency injection context.
 * Tests the logic without requiring React rendering.
 */

import { describe, it, expect } from 'bun:test';
import { MockAdapter } from '../adapters/mock-adapter.js';
import type { Adapter, ReadableStorageAdapter } from '../adapters/adapter.js';

/**
 * Simple implementation to test the adapter context logic
 * without needing React's useContext/hooks
 */
class AdapterContextStore {
  private adapter: Adapter | null = null;

  setAdapter(adapter: Adapter): void {
    this.adapter = adapter;
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

  hasAdapter(): boolean {
    return this.adapter !== null;
  }

  clear(): void {
    this.adapter = null;
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
