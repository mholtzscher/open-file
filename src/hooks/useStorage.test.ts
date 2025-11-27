/**
 * Unit tests for storage hooks
 *
 * Note: These tests validate the hook logic by testing the underlying
 * storage adapter functionality that the hooks wrap. Full React hook
 * testing would require a React testing environment.
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { LegacyStorageAdapter } from '../contexts/LegacyStorageAdapter.js';
import { ProviderStorageAdapter } from '../contexts/ProviderStorageAdapter.js';
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

  constructor() {
    super();
    this.addCapability(Capability.List, Capability.Read, Capability.Write);
  }

  async list(_path: string, _options?: ListOptions): Promise<OperationResult<ListResult>> {
    return Result.success({
      entries: [],
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
}

describe('Storage Hook Functionality', () => {
  describe('State access (useStorageState behavior)', () => {
    let mockAdapter: MockAdapter;
    let storageAdapter: LegacyStorageAdapter;

    beforeEach(() => {
      mockAdapter = new MockAdapter();
      storageAdapter = new LegacyStorageAdapter(mockAdapter, '/');
    });

    it('should expose current state', () => {
      const state = storageAdapter.state;

      expect(state.providerId).toBe('mock');
      expect(state.currentPath).toBe('/');
      expect(state.isLoading).toBe(false);
      expect(state.isConnected).toBe(true);
    });

    it('should update state on navigation', async () => {
      await storageAdapter.navigate('test-bucket/');

      expect(storageAdapter.state.currentPath).toBe('test-bucket/');
      expect(storageAdapter.state.entries.length).toBeGreaterThan(0);
    });
  });

  describe('Navigation operations (useStorageNavigation behavior)', () => {
    let mockAdapter: MockAdapter;
    let storageAdapter: LegacyStorageAdapter;

    beforeEach(() => {
      mockAdapter = new MockAdapter();
      storageAdapter = new LegacyStorageAdapter(mockAdapter, '/');
    });

    it('should navigate to path', async () => {
      await storageAdapter.navigate('test-bucket/');

      expect(storageAdapter.state.currentPath).toBe('test-bucket/');
    });

    it('should navigate up', async () => {
      await storageAdapter.navigate('test-bucket/documents/');
      await storageAdapter.navigateUp();

      expect(storageAdapter.state.currentPath).toBe('test-bucket/');
    });

    it('should refresh current path', async () => {
      await storageAdapter.navigate('test-bucket/');
      await storageAdapter.refresh();

      expect(storageAdapter.state.currentPath).toBe('test-bucket/');
      expect(storageAdapter.state.entries).toBeDefined();
    });
  });

  describe('List operations (useStorageList behavior)', () => {
    let mockAdapter: MockAdapter;
    let storageAdapter: LegacyStorageAdapter;

    beforeEach(() => {
      mockAdapter = new MockAdapter();
      storageAdapter = new LegacyStorageAdapter(mockAdapter, '/');
    });

    it('should provide entries', async () => {
      await storageAdapter.navigate('test-bucket/');

      expect(storageAdapter.state.entries).toBeDefined();
      expect(storageAdapter.state.entries.length).toBeGreaterThan(0);
    });

    it('should support list at specific path', async () => {
      const entries = await storageAdapter.list('test-bucket/');

      expect(Array.isArray(entries)).toBe(true);
      expect(entries.length).toBeGreaterThan(0);
    });
  });

  describe('File operations (useStorageOperations behavior)', () => {
    let mockAdapter: MockAdapter;
    let storageAdapter: LegacyStorageAdapter;

    beforeEach(() => {
      mockAdapter = new MockAdapter();
      storageAdapter = new LegacyStorageAdapter(mockAdapter, '/');
    });

    it('should create directory', async () => {
      await storageAdapter.mkdir('test-bucket/new-folder/');

      const exists = await storageAdapter.exists('test-bucket/new-folder/');
      expect(exists).toBe(true);
    });

    it('should write file', async () => {
      await storageAdapter.write('test-bucket/new-file.txt', 'Hello');

      const content = await storageAdapter.read('test-bucket/new-file.txt');
      expect(content.toString()).toBe('Hello');
    });

    it('should read file', async () => {
      await storageAdapter.write('test-bucket/test.txt', 'Content');
      const content = await storageAdapter.read('test-bucket/test.txt');

      expect(content.toString()).toBe('Content');
    });

    it('should delete file', async () => {
      await storageAdapter.write('test-bucket/to-delete.txt', 'Delete me');
      await storageAdapter.delete('test-bucket/to-delete.txt');

      const exists = await storageAdapter.exists('test-bucket/to-delete.txt');
      expect(exists).toBe(false);
    });

    it('should move file', async () => {
      await storageAdapter.write('test-bucket/source.txt', 'Content');
      await storageAdapter.move('test-bucket/source.txt', 'test-bucket/dest.txt');

      const sourceExists = await storageAdapter.exists('test-bucket/source.txt');
      const destExists = await storageAdapter.exists('test-bucket/dest.txt');

      expect(sourceExists).toBe(false);
      expect(destExists).toBe(true);
    });

    it('should copy file', async () => {
      await storageAdapter.write('test-bucket/original.txt', 'Content');
      await storageAdapter.copy('test-bucket/original.txt', 'test-bucket/copy.txt');

      const originalExists = await storageAdapter.exists('test-bucket/original.txt');
      const copyExists = await storageAdapter.exists('test-bucket/copy.txt');

      expect(originalExists).toBe(true);
      expect(copyExists).toBe(true);
    });
  });

  describe('Capability checking (useStorageCapabilities behavior)', () => {
    let mockAdapter: MockAdapter;
    let storageAdapter: LegacyStorageAdapter;

    beforeEach(() => {
      mockAdapter = new MockAdapter();
      storageAdapter = new LegacyStorageAdapter(mockAdapter, '/');
    });

    it('should check core capabilities', () => {
      expect(storageAdapter.hasCapability(Capability.List)).toBe(true);
      expect(storageAdapter.hasCapability(Capability.Read)).toBe(true);
      expect(storageAdapter.hasCapability(Capability.Write)).toBe(true);
      expect(storageAdapter.hasCapability(Capability.Delete)).toBe(true);
      expect(storageAdapter.hasCapability(Capability.Copy)).toBe(true);
      expect(storageAdapter.hasCapability(Capability.Move)).toBe(true);
    });

    it('should return false for unsupported capabilities', () => {
      expect(storageAdapter.hasCapability(Capability.Versioning)).toBe(false);
      expect(storageAdapter.hasCapability(Capability.Download)).toBe(false);
      expect(storageAdapter.hasCapability(Capability.Upload)).toBe(false);
    });

    it('should get all capabilities', () => {
      const capabilities = storageAdapter.getCapabilities();

      expect(capabilities.has(Capability.List)).toBe(true);
      expect(capabilities.has(Capability.Read)).toBe(true);
      expect(capabilities.has(Capability.Write)).toBe(true);
    });
  });

  describe('Container operations (useStorageContainer behavior)', () => {
    let mockAdapter: MockAdapter;
    let storageAdapter: LegacyStorageAdapter;

    beforeEach(() => {
      mockAdapter = new MockAdapter();
      storageAdapter = new LegacyStorageAdapter(mockAdapter, '/');
    });

    it('should detect container support', () => {
      // MockAdapter doesn't support containers
      expect(storageAdapter.hasCapability(Capability.Containers)).toBe(false);
    });

    it('should throw when containers not supported', async () => {
      expect(async () => {
        await storageAdapter.listContainers();
      }).toThrow();
    });

    it('should get current container', () => {
      const container = storageAdapter.getContainer();
      expect(container).toBeUndefined();
    });
  });

  describe('Provider adapter integration', () => {
    let testProvider: TestProvider;
    let storageAdapter: ProviderStorageAdapter;

    beforeEach(() => {
      testProvider = new TestProvider();
      storageAdapter = new ProviderStorageAdapter(testProvider, '/');
    });

    it('should support navigation', async () => {
      await storageAdapter.navigate('/');

      expect(storageAdapter.state.currentPath).toBe('/');
    });

    it('should support capability checking', () => {
      expect(storageAdapter.hasCapability(Capability.List)).toBe(true);
      expect(storageAdapter.hasCapability(Capability.Read)).toBe(true);
      expect(storageAdapter.hasCapability(Capability.Write)).toBe(true);
    });

    it('should provide state', () => {
      const state = storageAdapter.state;

      expect(state.providerId).toBe('test-provider');
      expect(state.providerDisplayName).toBe('Test Provider');
      expect(state.currentPath).toBe('/');
    });
  });

  describe('Combined functionality (useStorageManager behavior)', () => {
    let mockAdapter: MockAdapter;
    let storageAdapter: LegacyStorageAdapter;

    beforeEach(() => {
      mockAdapter = new MockAdapter();
      storageAdapter = new LegacyStorageAdapter(mockAdapter, '/');
    });

    it('should provide all operations', async () => {
      // Navigation
      await storageAdapter.navigate('test-bucket/');
      expect(storageAdapter.state.currentPath).toBe('test-bucket/');

      // Operations
      await storageAdapter.write('test-bucket/test.txt', 'Content');
      const content = await storageAdapter.read('test-bucket/test.txt');
      expect(content.toString()).toBe('Content');

      // Capabilities
      expect(storageAdapter.hasCapability(Capability.List)).toBe(true);

      // State
      expect(storageAdapter.state.providerId).toBe('mock');
    });
  });
});
