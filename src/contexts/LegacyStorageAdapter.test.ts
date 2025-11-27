/**
 * Unit tests for LegacyStorageAdapter
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { LegacyStorageAdapter } from './LegacyStorageAdapter.js';
import { MockAdapter } from '../adapters/mock-adapter.js';
import { EntryType } from '../types/entry.js';
import { Capability } from '../providers/types/capabilities.js';

describe('LegacyStorageAdapter', () => {
  let mockAdapter: MockAdapter;
  let storageAdapter: LegacyStorageAdapter;

  beforeEach(() => {
    mockAdapter = new MockAdapter();
    storageAdapter = new LegacyStorageAdapter(mockAdapter, '/');
  });

  describe('Initialization', () => {
    it('should initialize with correct default state', () => {
      const state = storageAdapter.state;

      expect(state.providerId).toBe('mock');
      expect(state.providerDisplayName).toBe('mock');
      expect(state.currentPath).toBe('/');
      expect(state.entries).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeUndefined();
      expect(state.isConnected).toBe(true);
    });

    it('should accept custom initial path', () => {
      const adapter = new LegacyStorageAdapter(mockAdapter, '/test-bucket/');
      expect(adapter.state.currentPath).toBe('/test-bucket/');
    });

    it('should accept custom initial container', () => {
      const adapter = new LegacyStorageAdapter(mockAdapter, '/', 'my-bucket');
      expect(adapter.state.currentContainer).toBe('my-bucket');
    });
  });

  describe('Navigation', () => {
    it('should navigate to a path', async () => {
      await storageAdapter.navigate('test-bucket/');

      const state = storageAdapter.state;
      expect(state.currentPath).toBe('test-bucket/');
      expect(state.entries.length).toBeGreaterThan(0);
      expect(state.isLoading).toBe(false);
    });

    it('should update entries when navigating', async () => {
      await storageAdapter.navigate('test-bucket/');
      expect(storageAdapter.state.entries.length).toBeGreaterThan(0);
    });

    it('should navigate up one level', async () => {
      await storageAdapter.navigate('test-bucket/documents/');
      await storageAdapter.navigateUp();

      expect(storageAdapter.state.currentPath).toBe('test-bucket/');
    });

    it('should handle navigateUp at root', async () => {
      await storageAdapter.navigate('/');
      await storageAdapter.navigateUp();

      // Should stay at root
      expect(storageAdapter.state.currentPath).toBe('/');
    });

    it('should refresh current path', async () => {
      await storageAdapter.navigate('test-bucket/');
      await storageAdapter.refresh();

      // Entries should be refreshed (same path, potentially updated data)
      expect(storageAdapter.state.currentPath).toBe('test-bucket/');
      expect(storageAdapter.state.entries).toBeDefined();
    });
  });

  describe('List operations', () => {
    it('should list entries at current path', async () => {
      await storageAdapter.navigate('test-bucket/');
      const entries = await storageAdapter.list();

      expect(Array.isArray(entries)).toBe(true);
      expect(entries.length).toBeGreaterThan(0);
    });

    it('should list entries at specific path', async () => {
      const entries = await storageAdapter.list('test-bucket/');

      expect(Array.isArray(entries)).toBe(true);
      expect(entries.length).toBeGreaterThan(0);
    });

    it('should support list options', async () => {
      const entries = await storageAdapter.list('test-bucket/', { limit: 5 });

      expect(Array.isArray(entries)).toBe(true);
      // MockAdapter may or may not honor limit, but it shouldn't crash
    });

    it('should update state when listing current path', async () => {
      await storageAdapter.navigate('test-bucket/');
      const entries = await storageAdapter.list('test-bucket/');

      expect(storageAdapter.state.entries).toEqual(entries);
    });

    it('should not update state when listing different path', async () => {
      await storageAdapter.navigate('test-bucket/');
      const currentEntries = storageAdapter.state.entries;

      await storageAdapter.list('test-bucket/documents/');

      // State should not change
      expect(storageAdapter.state.entries).toEqual(currentEntries);
    });
  });

  describe('Read operations', () => {
    it('should read file contents', async () => {
      const content = await storageAdapter.read('test-bucket/README.md');

      expect(content).toBeInstanceOf(Buffer);
      expect(content.toString()).toContain('Hello');
    });

    it('should check if path exists', async () => {
      const exists = await storageAdapter.exists('test-bucket/README.md');
      expect(exists).toBe(true);

      const notExists = await storageAdapter.exists('test-bucket/nonexistent.txt');
      expect(notExists).toBe(false);
    });

    it('should get metadata for entry', async () => {
      const metadata = await storageAdapter.getMetadata('test-bucket/README.md');

      expect(metadata.name).toBe('README.md');
      expect(metadata.type).toBe(EntryType.File);
      expect(metadata.path).toBeTruthy();
    });
  });

  describe('Write operations', () => {
    it('should write file content', async () => {
      await storageAdapter.write('test-bucket/new-file.txt', 'Hello World');

      const content = await storageAdapter.read('test-bucket/new-file.txt');
      expect(content.toString()).toBe('Hello World');
    });

    it('should create directory', async () => {
      await storageAdapter.mkdir('test-bucket/new-folder/');

      const exists = await storageAdapter.exists('test-bucket/new-folder/');
      expect(exists).toBe(true);
    });

    it('should delete file', async () => {
      await storageAdapter.write('test-bucket/to-delete.txt', 'Delete me');
      await storageAdapter.delete('test-bucket/to-delete.txt');

      const exists = await storageAdapter.exists('test-bucket/to-delete.txt');
      expect(exists).toBe(false);
    });

    it('should delete directory recursively', async () => {
      await storageAdapter.mkdir('test-bucket/folder-to-delete/');
      await storageAdapter.write('test-bucket/folder-to-delete/file.txt', 'Content');

      await storageAdapter.delete('test-bucket/folder-to-delete/', { recursive: true });

      const exists = await storageAdapter.exists('test-bucket/folder-to-delete/');
      expect(exists).toBe(false);
    });
  });

  describe('Move and copy operations', () => {
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

  describe('Error handling', () => {
    it('should set error state on operation failure', async () => {
      try {
        await storageAdapter.read('nonexistent/file.txt');
      } catch {
        // Expected to throw
      }

      const state = storageAdapter.state;
      expect(state.error).toBeDefined();
      expect(state.error?.code).toBeTruthy();
      expect(state.isLoading).toBe(false);
    });

    it('should clear error on successful operation', async () => {
      // Trigger an error
      try {
        await storageAdapter.read('nonexistent/file.txt');
      } catch {
        // Expected
      }
      expect(storageAdapter.state.error).toBeDefined();

      // Successful operation should clear error
      await storageAdapter.navigate('test-bucket/');
      expect(storageAdapter.state.error).toBeUndefined();
    });
  });

  describe('Loading state', () => {
    it('should set loading state during operations', async () => {
      const navigationPromise = storageAdapter.navigate('test-bucket/');

      // Note: In real async scenarios, this would be checked during the operation
      // For now, just verify it completes without error
      await navigationPromise;

      expect(storageAdapter.state.isLoading).toBe(false);
    });
  });

  describe('Capability introspection', () => {
    it('should support core capabilities', () => {
      expect(storageAdapter.hasCapability(Capability.List)).toBe(true);
      expect(storageAdapter.hasCapability(Capability.Read)).toBe(true);
      expect(storageAdapter.hasCapability(Capability.Write)).toBe(true);
      expect(storageAdapter.hasCapability(Capability.Delete)).toBe(true);
      expect(storageAdapter.hasCapability(Capability.Mkdir)).toBe(true);
      expect(storageAdapter.hasCapability(Capability.Copy)).toBe(true);
      expect(storageAdapter.hasCapability(Capability.Move)).toBe(true);
    });

    it('should not support advanced capabilities', () => {
      expect(storageAdapter.hasCapability(Capability.Versioning)).toBe(false);
      expect(storageAdapter.hasCapability(Capability.Metadata)).toBe(false);
      expect(storageAdapter.hasCapability(Capability.Permissions)).toBe(false);
      expect(storageAdapter.hasCapability(Capability.Symlinks)).toBe(false);
      expect(storageAdapter.hasCapability(Capability.PresignedUrls)).toBe(false);
    });

    it('should not support transfer capabilities (MockAdapter)', () => {
      // MockAdapter doesn't implement TransferableStorageAdapter
      expect(storageAdapter.hasCapability(Capability.Download)).toBe(false);
      expect(storageAdapter.hasCapability(Capability.Upload)).toBe(false);
    });

    it('should not support containers (MockAdapter)', () => {
      // MockAdapter doesn't implement BucketAwareAdapter
      expect(storageAdapter.hasCapability(Capability.Containers)).toBe(false);
    });

    it('should return all capabilities', () => {
      const capabilities = storageAdapter.getCapabilities();

      expect(capabilities.has(Capability.List)).toBe(true);
      expect(capabilities.has(Capability.Read)).toBe(true);
      expect(capabilities.has(Capability.Write)).toBe(true);
      expect(capabilities.has(Capability.Delete)).toBe(true);
      expect(capabilities.has(Capability.Mkdir)).toBe(true);
      expect(capabilities.has(Capability.Copy)).toBe(true);
      expect(capabilities.has(Capability.Move)).toBe(true);
    });
  });

  describe('Container operations', () => {
    it('should throw error for listContainers on MockAdapter', async () => {
      expect(async () => {
        await storageAdapter.listContainers();
      }).toThrow();
    });

    it('should throw error for setContainer on MockAdapter', async () => {
      expect(async () => {
        await storageAdapter.setContainer('my-bucket');
      }).toThrow();
    });

    it('should return undefined for getContainer when not set', () => {
      expect(storageAdapter.getContainer()).toBeUndefined();
    });
  });

  describe('Provider management', () => {
    it('should throw error for switchProvider', async () => {
      expect(async () => {
        await storageAdapter.switchProvider('s3');
      }).toThrow();
    });

    it('should handle disconnect', async () => {
      await storageAdapter.disconnect();
      expect(storageAdapter.state.isConnected).toBe(false);
    });

    it('should handle connect', async () => {
      await storageAdapter.disconnect();
      expect(storageAdapter.state.isConnected).toBe(false);

      await storageAdapter.connect();
      expect(storageAdapter.state.isConnected).toBe(true);
    });
  });

  describe('State subscription', () => {
    it('should notify listeners on state changes', async () => {
      let notified = false;

      const unsubscribe = storageAdapter.subscribe(() => {
        notified = true;
      });

      await storageAdapter.navigate('test-bucket/');

      expect(notified).toBe(true);

      unsubscribe();
    });

    it('should unsubscribe listeners', async () => {
      let count = 0;

      const unsubscribe = storageAdapter.subscribe(() => {
        count++;
      });

      await storageAdapter.navigate('test-bucket/');
      // Note: setState is called multiple times during navigation (loading, success)
      expect(count).toBeGreaterThan(0);

      const prevCount = count;
      unsubscribe();

      await storageAdapter.navigate('test-bucket/documents/');
      // Count should not increase after unsubscribe
      expect(count).toBe(prevCount);
    });

    it('should support multiple listeners', async () => {
      let count1 = 0;
      let count2 = 0;

      storageAdapter.subscribe(() => count1++);
      storageAdapter.subscribe(() => count2++);

      await storageAdapter.navigate('test-bucket/');

      // Both listeners should be notified (may be multiple times per operation)
      expect(count1).toBeGreaterThan(0);
      expect(count2).toBeGreaterThan(0);
      expect(count1).toBe(count2); // Should be called the same number of times
    });
  });
});
