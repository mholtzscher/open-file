/**
 * Tests for AdapterRegistry
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { AdapterRegistry, createAdapterRegistry } from './registry.js';
import { MockAdapter } from './mock-adapter.js';
import { S3Adapter } from './s3-adapter.js';

describe('AdapterRegistry', () => {
  let registry: AdapterRegistry;

  beforeEach(() => {
    registry = new AdapterRegistry();
  });

  describe('constructor', () => {
    it('should register mock adapter by default', () => {
      expect(registry.hasAdapter('mock')).toBe(true);
      expect(registry.getAdapter('mock')).toBeInstanceOf(MockAdapter);
    });
  });

  describe('register', () => {
    it('should register an adapter', () => {
      const adapter = new MockAdapter();
      registry.register('test', adapter);

      expect(registry.hasAdapter('test')).toBe(true);
      expect(registry.getAdapter('test')).toBe(adapter);
    });

    it('should overwrite existing adapter', () => {
      const adapter1 = new MockAdapter();
      const adapter2 = new MockAdapter();

      registry.register('test', adapter1);
      registry.register('test', adapter2);

      expect(registry.getAdapter('test')).toBe(adapter2);
    });
  });

  describe('registerS3', () => {
    it('should register S3 adapter with config', () => {
      const config = {
        region: 'us-east-1',
        bucket: 'test-bucket',
        credentials: {
          accessKeyId: 'test',
          secretAccessKey: 'test',
        },
      };

      registry.registerS3(config);

      expect(registry.hasAdapter('s3')).toBe(true);
      expect(registry.getAdapter('s3')).toBeInstanceOf(S3Adapter);
    });
  });

  describe('getAdapter', () => {
    it('should return registered adapter', () => {
      const adapter = registry.getAdapter('mock');
      expect(adapter).toBeInstanceOf(MockAdapter);
    });

    it('should throw for non-existent adapter', () => {
      expect(() => {
        registry.getAdapter('nonexistent');
      }).toThrow('Adapter not found: nonexistent');
    });
  });

  describe('hasAdapter', () => {
    it('should return true for existing adapter', () => {
      expect(registry.hasAdapter('mock')).toBe(true);
    });

    it('should return false for non-existent adapter', () => {
      expect(registry.hasAdapter('nonexistent')).toBe(false);
    });
  });

  describe('listAdapters', () => {
    it('should list all registered adapters', () => {
      registry.register('test1', new MockAdapter());
      registry.register('test2', new MockAdapter());

      const adapters = registry.listAdapters();
      expect(adapters).toContain('mock');
      expect(adapters).toContain('test1');
      expect(adapters).toContain('test2');
      expect(adapters.length).toBe(3);
    });
  });

  describe('getDefaultAdapter', () => {
    it('should return mock adapter as default', () => {
      const adapter = registry.getDefaultAdapter();
      expect(adapter).toBeInstanceOf(MockAdapter);
    });
  });

  describe('registerFactory', () => {
    it('should register a factory for lazy instantiation', () => {
      const factory = mock(() => new MockAdapter());
      registry.registerFactory('lazy', factory);

      // Factory not called yet
      expect(factory).not.toHaveBeenCalled();
      expect(registry.hasAdapter('lazy')).toBe(true);

      // Factory called on first getAdapter
      const adapter = registry.getAdapter('lazy');
      expect(factory).toHaveBeenCalledTimes(1);
      expect(adapter).toBeInstanceOf(MockAdapter);
    });

    it('should cache instance after first getAdapter call', () => {
      const factory = mock(() => new MockAdapter());
      registry.registerFactory('lazy', factory);

      const adapter1 = registry.getAdapter('lazy');
      const adapter2 = registry.getAdapter('lazy');

      // Factory only called once
      expect(factory).toHaveBeenCalledTimes(1);
      // Same instance returned
      expect(adapter1).toBe(adapter2);
    });

    it('should be overwritten by register()', () => {
      const factory = mock(() => new MockAdapter());
      registry.registerFactory('test', factory);

      const directAdapter = new MockAdapter();
      registry.register('test', directAdapter);

      const adapter = registry.getAdapter('test');
      expect(factory).not.toHaveBeenCalled();
      expect(adapter).toBe(directAdapter);
    });

    it('should include factory adapters in listAdapters()', () => {
      registry.registerFactory('lazy1', () => new MockAdapter());
      registry.registerFactory('lazy2', () => new MockAdapter());

      const adapters = registry.listAdapters();
      expect(adapters).toContain('lazy1');
      expect(adapters).toContain('lazy2');
    });
  });

  describe('lazy MockAdapter instantiation', () => {
    it('should not instantiate MockAdapter until first access', () => {
      // Create a fresh registry - MockAdapter should be registered as factory
      const freshRegistry = new AdapterRegistry();

      // hasAdapter should return true even before instantiation
      expect(freshRegistry.hasAdapter('mock')).toBe(true);

      // listAdapters should include mock
      expect(freshRegistry.listAdapters()).toContain('mock');
    });
  });
});

describe('Factory functions', () => {
  describe('createAdapterRegistry', () => {
    it('should create a new registry instance', () => {
      const registry1 = createAdapterRegistry();
      const registry2 = createAdapterRegistry();

      // Should be different instances
      expect(registry1).not.toBe(registry2);
      expect(registry1).toBeInstanceOf(AdapterRegistry);
      expect(registry2).toBeInstanceOf(AdapterRegistry);
    });

    it('should create registry with mock adapter pre-registered', () => {
      const registry = createAdapterRegistry();
      expect(registry.hasAdapter('mock')).toBe(true);
      expect(registry.getAdapter('mock')).toBeInstanceOf(MockAdapter);
    });

    it('should create isolated registries', () => {
      const registry1 = createAdapterRegistry();
      const registry2 = createAdapterRegistry();

      // Register adapter in one registry
      registry1.register('custom', new MockAdapter());

      // Should not affect the other
      expect(registry1.hasAdapter('custom')).toBe(true);
      expect(registry2.hasAdapter('custom')).toBe(false);
    });
  });
});
