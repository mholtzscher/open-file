/**
 * Unit tests for ProviderStorageAdapter
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { ProviderStorageAdapter } from './ProviderStorageAdapter.js';
import { BaseStorageProvider } from '../providers/base-provider.js';
import { Entry, EntryType } from '../types/entry.js';
import { Capability } from '../providers/types/capabilities.js';
import { OperationResult, Result } from '../providers/types/result.js';
import { ListOptions, ListResult } from '../providers/provider.js';

/**
 * Mock provider for testing
 */
class MockProvider extends BaseStorageProvider {
  name = 'mock-provider';
  displayName = 'Mock Provider';

  private entries = new Map<string, Entry[]>();
  private files = new Map<string, Buffer>();
  private connected = true;

  constructor() {
    super();

    // Add core capabilities
    this.addCapability(
      Capability.List,
      Capability.Read,
      Capability.Write,
      Capability.Delete,
      Capability.Mkdir,
      Capability.Copy,
      Capability.Move
    );

    // Seed test data
    this.seedTestData();
  }

  private seedTestData(): void {
    // Root entries
    this.entries.set('/', [
      {
        id: 'test-dir',
        name: 'test-dir',
        type: EntryType.Directory,
        path: 'test-dir/',
        modified: new Date(),
      },
    ]);

    // Test dir entries
    this.entries.set('test-dir/', [
      {
        id: 'file1',
        name: 'file1.txt',
        type: EntryType.File,
        path: 'test-dir/file1.txt',
        size: 13,
        modified: new Date(),
      },
      {
        id: 'subdir',
        name: 'subdir',
        type: EntryType.Directory,
        path: 'test-dir/subdir/',
        modified: new Date(),
      },
    ]);

    // File contents
    this.files.set('test-dir/file1.txt', Buffer.from('Hello, World!'));
  }

  async list(path: string, _options?: ListOptions): Promise<OperationResult<ListResult>> {
    const entries = this.entries.get(path) || [];
    return Result.success({
      entries,
      hasMore: false,
    });
  }

  async getMetadata(path: string): Promise<OperationResult<Entry>> {
    // Search through all entries
    for (const entries of this.entries.values()) {
      const entry = entries.find(e => e.path === path);
      if (entry) {
        return Result.success(entry);
      }
    }
    const notFoundResult: OperationResult<Entry> = Result.notFound(path) as any;
    return notFoundResult;
  }

  async exists(path: string): Promise<OperationResult<boolean>> {
    // Check if it's a file
    if (this.files.has(path)) {
      return Result.success(true);
    }

    // Check if it's a directory
    if (this.entries.has(path)) {
      return Result.success(true);
    }

    // Check if it's in entries
    const metadata = await this.getMetadata(path);
    return Result.success(metadata.status === 'success');
  }

  async read(path: string): Promise<OperationResult<Buffer>> {
    const content = this.files.get(path);
    if (content) {
      return Result.success(content);
    }
    const notFoundResult: OperationResult<Buffer> = Result.notFound(path) as any;
    return notFoundResult;
  }

  async write(path: string, content: Buffer | string): Promise<OperationResult> {
    const buffer = typeof content === 'string' ? Buffer.from(content) : content;
    this.files.set(path, buffer);
    return Result.success();
  }

  async mkdir(path: string): Promise<OperationResult> {
    this.entries.set(path, []);
    return Result.success();
  }

  async delete(path: string): Promise<OperationResult> {
    this.files.delete(path);
    this.entries.delete(path);
    return Result.success();
  }

  async move(source: string, dest: string): Promise<OperationResult> {
    const content = this.files.get(source);
    if (content) {
      this.files.set(dest, content);
      this.files.delete(source);
    }
    return Result.success();
  }

  async copy(source: string, dest: string): Promise<OperationResult> {
    const content = this.files.get(source);
    if (content) {
      this.files.set(dest, content);
    }
    return Result.success();
  }

  isConnected(): boolean {
    return this.connected;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async connect(): Promise<OperationResult> {
    this.connected = true;
    return Result.success();
  }
}

describe('ProviderStorageAdapter', () => {
  let mockProvider: MockProvider;
  let storageAdapter: ProviderStorageAdapter;

  beforeEach(() => {
    mockProvider = new MockProvider();
    storageAdapter = new ProviderStorageAdapter(mockProvider, '/');
  });

  describe('Initialization', () => {
    it('should initialize with correct default state', () => {
      const state = storageAdapter.state;

      expect(state.providerId).toBe('mock-provider');
      expect(state.providerDisplayName).toBe('Mock Provider');
      expect(state.currentPath).toBe('/');
      expect(state.entries).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeUndefined();
      expect(state.isConnected).toBe(true);
    });

    it('should accept custom initial path', () => {
      const adapter = new ProviderStorageAdapter(mockProvider, '/test-dir/');
      expect(adapter.state.currentPath).toBe('/test-dir/');
    });

    it('should accept custom initial container', () => {
      const adapter = new ProviderStorageAdapter(mockProvider, '/', 'my-container');
      expect(adapter.state.currentContainer).toBe('my-container');
    });
  });

  describe('Navigation', () => {
    it('should navigate to a path', async () => {
      await storageAdapter.navigate('test-dir/');

      const state = storageAdapter.state;
      expect(state.currentPath).toBe('test-dir/');
      expect(state.entries.length).toBe(2);
      expect(state.isLoading).toBe(false);
    });

    it('should update entries when navigating', async () => {
      await storageAdapter.navigate('test-dir/');
      expect(storageAdapter.state.entries.length).toBe(2);
      expect(storageAdapter.state.entries[0].name).toBe('file1.txt');
    });

    it('should navigate up one level', async () => {
      await storageAdapter.navigate('test-dir/subdir/');
      await storageAdapter.navigateUp();

      expect(storageAdapter.state.currentPath).toBe('test-dir/');
    });

    it('should handle navigateUp at root', async () => {
      await storageAdapter.navigate('/');
      await storageAdapter.navigateUp();

      // Should stay at root
      expect(storageAdapter.state.currentPath).toBe('/');
    });

    it('should refresh current path', async () => {
      await storageAdapter.navigate('test-dir/');
      await storageAdapter.refresh();

      // Entries should be refreshed
      expect(storageAdapter.state.currentPath).toBe('test-dir/');
      expect(storageAdapter.state.entries).toBeDefined();
    });
  });

  describe('List operations', () => {
    it('should list entries at current path', async () => {
      await storageAdapter.navigate('test-dir/');
      const entries = await storageAdapter.list();

      expect(Array.isArray(entries)).toBe(true);
      expect(entries.length).toBe(2);
    });

    it('should list entries at specific path', async () => {
      const entries = await storageAdapter.list('test-dir/');

      expect(Array.isArray(entries)).toBe(true);
      expect(entries.length).toBe(2);
    });

    it('should update state when listing current path', async () => {
      await storageAdapter.navigate('test-dir/');
      const entries = await storageAdapter.list('test-dir/');

      expect(storageAdapter.state.entries).toEqual(entries);
    });

    it('should not update state when listing different path', async () => {
      await storageAdapter.navigate('/');
      const currentEntries = storageAdapter.state.entries;

      await storageAdapter.list('test-dir/');

      // State should not change
      expect(storageAdapter.state.entries).toEqual(currentEntries);
    });
  });

  describe('Read operations', () => {
    it('should read file contents', async () => {
      const content = await storageAdapter.read('test-dir/file1.txt');

      expect(content).toBeInstanceOf(Buffer);
      expect(content.toString()).toBe('Hello, World!');
    });

    it('should check if path exists', async () => {
      const exists = await storageAdapter.exists('test-dir/file1.txt');
      expect(exists).toBe(true);

      const notExists = await storageAdapter.exists('nonexistent.txt');
      expect(notExists).toBe(false);
    });

    it('should get metadata for entry', async () => {
      const metadata = await storageAdapter.getMetadata('test-dir/file1.txt');

      expect(metadata.name).toBe('file1.txt');
      expect(metadata.type).toBe(EntryType.File);
      expect(metadata.path).toBe('test-dir/file1.txt');
    });

    it('should throw on read error', async () => {
      expect(async () => {
        await storageAdapter.read('nonexistent.txt');
      }).toThrow();
    });
  });

  describe('Write operations', () => {
    it('should write file content', async () => {
      await storageAdapter.write('test-dir/new-file.txt', 'New content');

      const content = await storageAdapter.read('test-dir/new-file.txt');
      expect(content.toString()).toBe('New content');
    });

    it('should create directory', async () => {
      await storageAdapter.mkdir('test-dir/new-folder/');

      // Verify it exists
      const exists = await storageAdapter.exists('test-dir/new-folder/');
      expect(exists).toBe(true);
    });

    it('should delete file', async () => {
      await storageAdapter.write('test-dir/to-delete.txt', 'Delete me');
      await storageAdapter.delete('test-dir/to-delete.txt');

      const exists = await storageAdapter.exists('test-dir/to-delete.txt');
      expect(exists).toBe(false);
    });
  });

  describe('Move and copy operations', () => {
    it('should move file', async () => {
      await storageAdapter.write('test-dir/source.txt', 'Content');
      await storageAdapter.move('test-dir/source.txt', 'test-dir/dest.txt');

      const sourceExists = await storageAdapter.exists('test-dir/source.txt');
      const destExists = await storageAdapter.exists('test-dir/dest.txt');

      expect(sourceExists).toBe(false);
      expect(destExists).toBe(true);
    });

    it('should copy file', async () => {
      await storageAdapter.write('test-dir/original.txt', 'Content');
      await storageAdapter.copy('test-dir/original.txt', 'test-dir/copy.txt');

      const originalExists = await storageAdapter.exists('test-dir/original.txt');
      const copyExists = await storageAdapter.exists('test-dir/copy.txt');

      expect(originalExists).toBe(true);
      expect(copyExists).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should set error state on operation failure', async () => {
      try {
        await storageAdapter.read('nonexistent-file.txt');
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
        await storageAdapter.read('nonexistent-file.txt');
      } catch {
        // Expected
      }
      expect(storageAdapter.state.error).toBeDefined();

      // Successful operation should clear error
      await storageAdapter.navigate('test-dir/');
      expect(storageAdapter.state.error).toBeUndefined();
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

    it('should not support unsupported capabilities', () => {
      expect(storageAdapter.hasCapability(Capability.Versioning)).toBe(false);
      expect(storageAdapter.hasCapability(Capability.Download)).toBe(false);
      expect(storageAdapter.hasCapability(Capability.Upload)).toBe(false);
    });

    it('should return all capabilities', () => {
      const capabilities = storageAdapter.getCapabilities();

      expect(capabilities.has(Capability.List)).toBe(true);
      expect(capabilities.has(Capability.Read)).toBe(true);
      expect(capabilities.has(Capability.Write)).toBe(true);
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

      await storageAdapter.navigate('test-dir/');

      expect(notified).toBe(true);

      unsubscribe();
    });

    it('should unsubscribe listeners', async () => {
      let count = 0;

      const unsubscribe = storageAdapter.subscribe(() => {
        count++;
      });

      await storageAdapter.navigate('test-dir/');
      expect(count).toBeGreaterThan(0);

      const prevCount = count;
      unsubscribe();

      await storageAdapter.navigate('/');
      // Count should not increase after unsubscribe
      expect(count).toBe(prevCount);
    });

    it('should support multiple listeners', async () => {
      let count1 = 0;
      let count2 = 0;

      storageAdapter.subscribe(() => count1++);
      storageAdapter.subscribe(() => count2++);

      await storageAdapter.navigate('test-dir/');

      expect(count1).toBeGreaterThan(0);
      expect(count2).toBeGreaterThan(0);
      expect(count1).toBe(count2);
    });
  });

  describe('Transfer operations', () => {
    it('should throw error for download if not supported', async () => {
      expect(async () => {
        await storageAdapter.download('remote.txt', '/local.txt');
      }).toThrow();
    });

    it('should throw error for upload if not supported', async () => {
      expect(async () => {
        await storageAdapter.upload('/local.txt', 'remote.txt');
      }).toThrow();
    });
  });

  describe('Container operations', () => {
    it('should throw error for listContainers if not supported', async () => {
      expect(async () => {
        await storageAdapter.listContainers();
      }).toThrow();
    });

    it('should throw error for setContainer if not supported', async () => {
      expect(async () => {
        await storageAdapter.setContainer('my-container');
      }).toThrow();
    });

    it('should return undefined for getContainer when not supported', () => {
      expect(storageAdapter.getContainer()).toBeUndefined();
    });
  });
});
