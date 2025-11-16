/**
 * Tests for AdapterRegistry
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { AdapterRegistry, getAdapterRegistry, registerAdapter, getAdapter, registerS3 } from './registry.js';
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
        credentials: {
          accessKeyId: 'test',
          secretAccessKey: 'test'
        }
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

describe('Global registry functions', () => {
  beforeEach(() => {
    // Reset global registry
    (globalThis as any).globalRegistry = null;
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
        credentials: {
          accessKeyId: 'test',
          secretAccessKey: 'test'
        }
      };
      
      registerS3(config);
      
      const registry = getAdapterRegistry();
      expect(registry.hasAdapter('s3')).toBe(true);
      expect(registry.getAdapter('s3')).toBeInstanceOf(S3Adapter);
    });
  });
});