/**
 * Unit tests for storage hooks
 *
 * Note: These tests validate the hook logic by testing the underlying
 * storage adapter functionality that the hooks wrap. Full React hook
 * testing would require a React testing environment.
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { ProviderStorageAdapter } from '../contexts/ProviderStorageAdapter.js';
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
});
