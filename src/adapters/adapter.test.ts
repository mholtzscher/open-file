/**
 * Tests for adapter implementations
 */

import { describe, it, expect } from 'bun:test';
import { MockAdapter } from './mock-adapter.js';
import { EntryType } from '../types/entry.js';

describe('MockAdapter', () => {
  const adapter = new MockAdapter();

  describe('list', () => {
    it('should list entries in root bucket', async () => {
      const result = await adapter.list('test-bucket/');
      expect(result.entries.length).toBeGreaterThan(0);
      expect(result.hasMore).toBe(false);
    });

    it('should list entries in subdirectory', async () => {
      const result = await adapter.list('test-bucket/documents/');
      expect(result.entries.length).toBeGreaterThan(0);
    });

    it('should separate directories and files', async () => {
      const result = await adapter.list('test-bucket/');
      const hasDirectories = result.entries.some(e => e.type.toString() === 'directory');
      expect(hasDirectories).toBe(true);
    });

    it('should sort directories before files', async () => {
      const result = await adapter.list('test-bucket/');
      let lastWasDirectory = true;
      for (const entry of result.entries) {
        const isDirectory = entry.type.toString() === 'directory';
        if (lastWasDirectory && !isDirectory) {
          lastWasDirectory = false;
        }
        if (!lastWasDirectory && isDirectory) {
          throw new Error('File appears before directory');
        }
      }
    });
  });

  describe('getMetadata', () => {
    it('should get metadata for an entry', async () => {
      const entry = await adapter.getMetadata('test-bucket/README.md');
      expect(entry.name).toBe('README.md');
      expect(entry.type.toString()).toBe('file');
      expect(entry.size).toBeGreaterThan(0);
    });

    it('should throw for non-existent entry', async () => {
      expect(async () => {
        await adapter.getMetadata('test-bucket/does-not-exist.txt');
      }).toThrow();
    });
  });

  describe('create', () => {
    it('should create a file', async () => {
      await adapter.create('test-bucket/new-file.txt', EntryType.File, 'test content');
      const entry = await adapter.getMetadata('test-bucket/new-file.txt');
      expect(entry.name).toBe('new-file.txt');
      expect(entry.type.toString()).toBe('file');
    });

    it('should create a directory', async () => {
      await adapter.create('test-bucket/new-dir/', EntryType.Directory);
      const entry = await adapter.getMetadata('test-bucket/new-dir/');
      expect(entry.type.toString()).toBe('directory');
    });
  });

  describe('delete', () => {
    it('should delete a file', async () => {
      await adapter.create('test-bucket/temp.txt', EntryType.File, 'temp');
      await adapter.delete('test-bucket/temp.txt');
      const exists = await adapter.exists('test-bucket/temp.txt');
      expect(exists).toBe(false);
    });

    it('should delete directory recursively', async () => {
      await adapter.create('test-bucket/temp-dir/', EntryType.Directory);
      await adapter.create('test-bucket/temp-dir/file.txt', EntryType.File, 'test');
      await adapter.delete('test-bucket/temp-dir/', true);
      const exists = await adapter.exists('test-bucket/temp-dir/');
      expect(exists).toBe(false);
    });

    it('should throw for non-existent entry', async () => {
      expect(async () => {
        await adapter.delete('test-bucket/does-not-exist.txt');
      }).toThrow();
    });
  });

  describe('move', () => {
    it('should move a file', async () => {
      await adapter.create('test-bucket/source.txt', EntryType.File, 'content');
      await adapter.move('test-bucket/source.txt', 'test-bucket/dest.txt');
      
      const exists1 = await adapter.exists('test-bucket/source.txt');
      const exists2 = await adapter.exists('test-bucket/dest.txt');
      expect(exists1).toBe(false);
      expect(exists2).toBe(true);
    });
  });

  describe('copy', () => {
    it('should copy a file', async () => {
      await adapter.create('test-bucket/original.txt', EntryType.File, 'content');
      await adapter.copy('test-bucket/original.txt', 'test-bucket/copy.txt');
      
      const original = await adapter.getMetadata('test-bucket/original.txt');
      const copy = await adapter.getMetadata('test-bucket/copy.txt');
      expect(original.size).toBe(copy.size);
      expect(original.id).not.toBe(copy.id);
    });
  });

  describe('exists', () => {
    it('should return true for existing entry', async () => {
      const exists = await adapter.exists('test-bucket/');
      expect(exists).toBe(true);
    });

    it('should return false for non-existent entry', async () => {
      const exists = await adapter.exists('test-bucket/does-not-exist.txt');
      expect(exists).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should throw error when deleting non-existent entry', async () => {
      expect(async () => {
        await adapter.delete('test-bucket/does-not-exist-12345.txt');
      }).toThrow();
    });

    it('should throw error when copying non-existent entry', async () => {
      expect(async () => {
        await adapter.copy('test-bucket/non-existent-12345.txt', 'test-bucket/copy.txt');
      }).toThrow();
    });

    it('should handle getMetadata for non-existent entry', async () => {
      expect(async () => {
        await adapter.getMetadata('test-bucket/does-not-exist-12345.txt');
      }).toThrow();
    });
  });

  describe('pagination support', () => {
    it('should accept pagination options', async () => {
      const result = await adapter.list('test-bucket/', { limit: 5 });
      expect(result.entries.length).toBeGreaterThan(0);
      expect(result.entries).toBeDefined();
    });

    it('should return hasMore flag', async () => {
      const result = await adapter.list('test-bucket/scrollable/', { limit: 10 });
      expect(typeof result.hasMore).toBe('boolean');
      // With 100 files in scrollable directory and limit of 10, should have more
      if (result.hasMore) {
        expect(result.continuationToken).toBeDefined();
      }
    });

    it('should retrieve large directory listings', async () => {
      const result = await adapter.list('test-bucket/scrollable/');
      // Should handle large listings
      expect(result.entries.length).toBeGreaterThan(10);
    });
  });

  describe('batch operations', () => {
    it('should handle multiple operations in sequence', async () => {
      // Create multiple files
      await adapter.create('test-bucket/batch1.txt', EntryType.File, 'content1');
      await adapter.create('test-bucket/batch2.txt', EntryType.File, 'content2');
      await adapter.create('test-bucket/batch3.txt', EntryType.File, 'content3');

      // List to verify all created
      const result = await adapter.list('test-bucket/');
      const batchFiles = result.entries.filter(e => e.name.startsWith('batch'));
      expect(batchFiles.length).toBe(3);

      // Delete them
      await adapter.delete('test-bucket/batch1.txt');
      await adapter.delete('test-bucket/batch2.txt');
      await adapter.delete('test-bucket/batch3.txt');

      // Verify deletion
      const result2 = await adapter.list('test-bucket/');
      const remaining = result2.entries.filter(e => e.name.startsWith('batch'));
      expect(remaining.length).toBe(0);
    });
  });

  describe('entry metadata', () => {
    it('should preserve entry ID across operations', async () => {
      await adapter.create('test-bucket/metadata-test.txt', EntryType.File, 'test');
      const entry1 = await adapter.getMetadata('test-bucket/metadata-test.txt');
      const entry2 = await adapter.getMetadata('test-bucket/metadata-test.txt');
      expect(entry1.id).toBe(entry2.id);
    });

    it('should include modification timestamp', async () => {
      await adapter.create('test-bucket/timestamp-test.txt', EntryType.File, 'test');
      const entry = await adapter.getMetadata('test-bucket/timestamp-test.txt');
      expect(entry.modified).toBeDefined();
      expect(entry.modified instanceof Date).toBe(true);
    });

    it('should have correct size for created file', async () => {
      const content = 'hello world';
      await adapter.create('test-bucket/size-test.txt', EntryType.File, content);
      const entry = await adapter.getMetadata('test-bucket/size-test.txt');
      expect(entry.size).toBe(content.length);
    });
  });
});
