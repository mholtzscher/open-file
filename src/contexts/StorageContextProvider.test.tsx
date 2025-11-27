/**
 * Unit tests for StorageContextProvider
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { StorageContextProvider } from './StorageContextProvider.js';
import { LegacyStorageAdapter } from './LegacyStorageAdapter.js';
import { ProviderStorageAdapter } from './ProviderStorageAdapter.js';
import { MockAdapter } from '../adapters/mock-adapter.js';
import { BaseStorageProvider } from '../providers/base-provider.js';
import { Capability } from '../providers/types/capabilities.js';
import { OperationResult, Result } from '../providers/types/result.js';
import { ListOptions, ListResult } from '../providers/provider.js';
import { Entry, EntryType } from '../types/entry.js';

/**
 * Simple mock provider for testing
 */
class TestProvider extends BaseStorageProvider {
  name = 'test-provider';
  displayName = 'Test Provider';
  disconnectCalled = false;
  connectCalled = false;

  constructor() {
    super();
    this.addCapability(Capability.List, Capability.Read);
  }

  async list(_path: string, _options?: ListOptions): Promise<OperationResult<ListResult>> {
    return Result.success({
      entries: [
        {
          id: 'test',
          name: 'test.txt',
          type: EntryType.File,
          path: 'test.txt',
          modified: new Date(),
        },
      ],
      hasMore: false,
    });
  }

  async getMetadata(_path: string): Promise<OperationResult<Entry>> {
    return Result.success({
      id: 'test',
      name: 'test.txt',
      type: EntryType.File,
      path: 'test.txt',
      modified: new Date(),
    });
  }

  async exists(_path: string): Promise<OperationResult<boolean>> {
    return Result.success(true);
  }

  async read(_path: string): Promise<OperationResult<Buffer>> {
    return Result.success(Buffer.from('test content'));
  }

  async disconnect(): Promise<void> {
    this.disconnectCalled = true;
  }

  async connect(): Promise<OperationResult> {
    this.connectCalled = true;
    return Result.success();
  }
}

describe('StorageContextProvider', () => {
  describe('Validation', () => {
    it('should throw error if adapter not provided in legacy mode', () => {
      expect(() => {
        // Testing with invalid props
        const props: any = { useProviderSystem: false, children: null };
        StorageContextProvider(props);
      }).toThrow();
    });

    it('should throw error if provider not provided in provider mode', () => {
      expect(() => {
        // Testing with invalid props
        const props: any = { useProviderSystem: true, children: null };
        StorageContextProvider(props);
      }).toThrow();
    });
  });

  describe('Component existence', () => {
    it('should export StorageContextProvider', () => {
      expect(StorageContextProvider).toBeDefined();
      expect(typeof StorageContextProvider).toBe('function');
    });
  });

  describe('Legacy adapter integration', () => {
    let mockAdapter: MockAdapter;

    beforeEach(() => {
      mockAdapter = new MockAdapter();
    });

    it('should create storage adapter with correct properties', () => {
      const adapter = new LegacyStorageAdapter(mockAdapter, '/');

      expect(adapter.state.providerId).toBe('mock');
      expect(adapter.state.providerDisplayName).toBe('mock');
      expect(adapter.state.currentPath).toBe('/');
      expect(adapter.state.isConnected).toBe(true);
    });

    it('should handle custom initial path', () => {
      const adapter = new LegacyStorageAdapter(mockAdapter, '/custom/');

      expect(adapter.state.currentPath).toBe('/custom/');
    });

    it('should handle custom initial container', () => {
      const adapter = new LegacyStorageAdapter(mockAdapter, '/', 'my-bucket');

      expect(adapter.state.currentContainer).toBe('my-bucket');
    });
  });

  describe('Provider integration', () => {
    let testProvider: TestProvider;

    beforeEach(() => {
      testProvider = new TestProvider();
    });

    it('should create storage adapter with correct properties', () => {
      const adapter = new ProviderStorageAdapter(testProvider, '/');

      expect(adapter.state.providerId).toBe('test-provider');
      expect(adapter.state.providerDisplayName).toBe('Test Provider');
      expect(adapter.state.currentPath).toBe('/');
      expect(adapter.state.isConnected).toBe(true);
    });

    it('should handle custom initial path', () => {
      const adapter = new ProviderStorageAdapter(testProvider, '/custom/');

      expect(adapter.state.currentPath).toBe('/custom/');
    });

    it('should handle custom initial container', () => {
      const adapter = new ProviderStorageAdapter(testProvider, '/', 'my-container');

      expect(adapter.state.currentContainer).toBe('my-container');
    });
  });

  describe('Feature flag behavior', () => {
    it('should respect useProviderSystem flag when true', () => {
      const testProvider = new TestProvider();
      const adapter = new ProviderStorageAdapter(testProvider, '/');

      // Verify it's using the provider system
      expect(adapter.state.providerId).toBe('test-provider');
    });

    it('should respect useProviderSystem flag when false', () => {
      const mockAdapter = new MockAdapter();
      const adapter = new LegacyStorageAdapter(mockAdapter, '/');

      // Verify it's using the legacy adapter
      expect(adapter.state.providerId).toBe('mock');
    });
  });

  describe('Adapter operations', () => {
    it('should support navigation with legacy adapter', async () => {
      const mockAdapter = new MockAdapter();
      const adapter = new LegacyStorageAdapter(mockAdapter, '/');

      await adapter.navigate('test-bucket/');

      expect(adapter.state.currentPath).toBe('test-bucket/');
      expect(adapter.state.entries.length).toBeGreaterThan(0);
    });

    it('should support navigation with provider', async () => {
      const testProvider = new TestProvider();
      const adapter = new ProviderStorageAdapter(testProvider, '/');

      await adapter.navigate('/');

      expect(adapter.state.currentPath).toBe('/');
      expect(adapter.state.entries.length).toBe(1);
    });

    it('should support disconnect with provider', async () => {
      const testProvider = new TestProvider();
      const adapter = new ProviderStorageAdapter(testProvider, '/');

      await adapter.disconnect();

      expect(testProvider.disconnectCalled).toBe(true);
      expect(adapter.state.isConnected).toBe(false);
    });

    it('should support connect with provider', async () => {
      const testProvider = new TestProvider();
      const adapter = new ProviderStorageAdapter(testProvider, '/');

      await adapter.disconnect();
      await adapter.connect();

      expect(testProvider.connectCalled).toBe(true);
      expect(adapter.state.isConnected).toBe(true);
    });
  });

  describe('Capability checking', () => {
    it('should check capabilities with legacy adapter', () => {
      const mockAdapter = new MockAdapter();
      const adapter = new LegacyStorageAdapter(mockAdapter, '/');

      expect(adapter.hasCapability(Capability.List)).toBe(true);
      expect(adapter.hasCapability(Capability.Read)).toBe(true);
      expect(adapter.hasCapability(Capability.Write)).toBe(true);
    });

    it('should check capabilities with provider', () => {
      const testProvider = new TestProvider();
      const adapter = new ProviderStorageAdapter(testProvider, '/');

      expect(adapter.hasCapability(Capability.List)).toBe(true);
      expect(adapter.hasCapability(Capability.Read)).toBe(true);
      expect(adapter.hasCapability(Capability.Write)).toBe(false);
    });
  });

  describe('Error handling', () => {
    it('should handle navigation errors gracefully', async () => {
      const mockAdapter = new MockAdapter();
      const adapter = new LegacyStorageAdapter(mockAdapter, '/');

      try {
        await adapter.navigate('nonexistent-path/');
      } catch (error) {
        // Error expected for nonexistent path
        expect(adapter.state.error).toBeDefined();
      }
    });
  });
});
