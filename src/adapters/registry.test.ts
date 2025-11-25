/**
 * Tests for AdapterRegistry
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import {
  AdapterRegistry,
  createAdapterRegistry,
  getAdapterRegistry,
  resetAdapterRegistry,
  setAdapterRegistry,
  registerAdapter,
  getAdapter,
  registerS3,
} from './registry.js';
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

describe('Global registry functions', () => {
  beforeEach(() => {
    // Reset global registry using the proper function
    resetAdapterRegistry();
  });

  describe('getAdapterRegistry', () => {
    it('should create singleton registry', () => {
      const registry1 = getAdapterRegistry();
      const registry2 = getAdapterRegistry();

      expect(registry1).toBe(registry2);
      expect(registry1).toBeInstanceOf(AdapterRegistry);
    });

    it('should register mock adapter by default', () => {
      const registry = getAdapterRegistry();
      expect(registry.hasAdapter('mock')).toBe(true);
    });
  });

  describe('resetAdapterRegistry', () => {
    it('should reset the global registry', () => {
      const registry1 = getAdapterRegistry();
      registry1.register('custom', new MockAdapter());

      resetAdapterRegistry();

      const registry2 = getAdapterRegistry();
      expect(registry1).not.toBe(registry2);
      expect(registry2.hasAdapter('custom')).toBe(false);
    });

    it('should create fresh registry on next getAdapterRegistry call', () => {
      const registry1 = getAdapterRegistry();
      resetAdapterRegistry();
      const registry2 = getAdapterRegistry();

      expect(registry1).not.toBe(registry2);
      // New registry should have default mock adapter
      expect(registry2.hasAdapter('mock')).toBe(true);
    });
  });

  describe('setAdapterRegistry', () => {
    it('should set a custom global registry', () => {
      const customRegistry = createAdapterRegistry();
      customRegistry.register('custom-adapter', new MockAdapter());

      setAdapterRegistry(customRegistry);

      const globalReg = getAdapterRegistry();
      expect(globalReg).toBe(customRegistry);
      expect(globalReg.hasAdapter('custom-adapter')).toBe(true);
    });

    it('should replace existing global registry', () => {
      const oldRegistry = getAdapterRegistry();
      oldRegistry.register('old-adapter', new MockAdapter());

      const newRegistry = createAdapterRegistry();
      setAdapterRegistry(newRegistry);

      const currentRegistry = getAdapterRegistry();
      expect(currentRegistry).toBe(newRegistry);
      expect(currentRegistry.hasAdapter('old-adapter')).toBe(false);
    });
  });

  describe('registerAdapter', () => {
    it('should register adapter globally', () => {
      const adapter = new MockAdapter();
      registerAdapter('global-test', adapter);

      const registry = getAdapterRegistry();
      expect(registry.hasAdapter('global-test')).toBe(true);
      expect(registry.getAdapter('global-test')).toBe(adapter);
    });
  });

  describe('getAdapter', () => {
    it('should get adapter from global registry', () => {
      const adapter = getAdapter('mock');
      expect(adapter).toBeInstanceOf(MockAdapter);
    });

    it('should throw for non-existent global adapter', () => {
      expect(() => {
        getAdapter('nonexistent');
      }).toThrow('Adapter not found: nonexistent');
    });
  });

  describe('registerS3', () => {
    it('should register S3 adapter globally', () => {
      const config = {
        region: 'us-west-2',
        bucket: 'test-bucket',
        accessKeyId: 'test',
        secretAccessKey: 'test',
      };

      registerS3(config);

      const registry = getAdapterRegistry();
      expect(registry.hasAdapter('s3')).toBe(true);
      expect(registry.getAdapter('s3')).toBeInstanceOf(S3Adapter);
    });
  });
});
