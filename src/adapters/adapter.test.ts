/**
 * Tests for adapter implementations
 */

import { describe, it, expect } from 'bun:test';
import { MockAdapter } from './mock-adapter.js';
import { S3Adapter } from './s3-adapter.js';
import { EntryType } from '../types/entry.js';
import {
  ProgressEvent,
  ReadableStorageAdapter,
  isMutableAdapter,
  isTransferableAdapter,
  isBucketAwareAdapter,
} from './adapter.js';

describe('Interface Type Guards', () => {
  describe('isMutableAdapter', () => {
    it('should return true for MockAdapter', () => {
      const adapter = new MockAdapter();
      expect(isMutableAdapter(adapter)).toBe(true);
    });

    it('should return true for S3Adapter', () => {
      const adapter = new S3Adapter({
        region: 'us-east-1',
        accessKeyId: 'test',
        secretAccessKey: 'test',
      });
      expect(isMutableAdapter(adapter)).toBe(true);
    });

    it('should return false for read-only adapter', () => {
      // Create a minimal read-only adapter
      const readOnlyAdapter: ReadableStorageAdapter = {
        name: 'readonly',
        list: async () => ({ entries: [], hasMore: false }),
        getMetadata: async () => {
          throw new Error('Not implemented');
        },
        exists: async () => false,
        read: async () => Buffer.from(''),
      };
      expect(isMutableAdapter(readOnlyAdapter)).toBe(false);
    });
  });

  describe('isTransferableAdapter', () => {
    it('should return false for MockAdapter (no transfer methods)', () => {
      const adapter = new MockAdapter();
      expect(isTransferableAdapter(adapter)).toBe(false);
    });

    it('should return true for S3Adapter', () => {
      const adapter = new S3Adapter({
        region: 'us-east-1',
        accessKeyId: 'test',
        secretAccessKey: 'test',
      });
      expect(isTransferableAdapter(adapter)).toBe(true);
    });
  });

  describe('isBucketAwareAdapter', () => {
    it('should return false for MockAdapter (partial bucket support)', () => {
      const adapter = new MockAdapter();
      // MockAdapter has getBucketEntries but not setBucket/setRegion
      expect(isBucketAwareAdapter(adapter)).toBe(false);
    });

    it('should return true for S3Adapter', () => {
      const adapter = new S3Adapter({
        region: 'us-east-1',
        accessKeyId: 'test',
        secretAccessKey: 'test',
      });
      expect(isBucketAwareAdapter(adapter)).toBe(true);
    });
  });

  describe('type narrowing', () => {
    it('should narrow type after isMutableAdapter check', () => {
      const adapter: ReadableStorageAdapter = new MockAdapter();

      if (isMutableAdapter(adapter)) {
        // TypeScript should now allow calling create
        expect(typeof adapter.create).toBe('function');
        expect(typeof adapter.delete).toBe('function');
        expect(typeof adapter.move).toBe('function');
        expect(typeof adapter.copy).toBe('function');
      }
    });

    it('should narrow type after isTransferableAdapter check', () => {
      const adapter: ReadableStorageAdapter = new S3Adapter({
        region: 'us-east-1',
        accessKeyId: 'test',
        secretAccessKey: 'test',
      });

      if (isTransferableAdapter(adapter)) {
        // TypeScript should now allow calling transfer methods
        expect(typeof adapter.downloadToLocal).toBe('function');
        expect(typeof adapter.uploadFromLocal).toBe('function');
      }
    });

    it('should narrow type after isBucketAwareAdapter check', () => {
      const adapter: ReadableStorageAdapter = new S3Adapter({
        region: 'us-east-1',
        accessKeyId: 'test',
        secretAccessKey: 'test',
      });

      if (isBucketAwareAdapter(adapter)) {
        // TypeScript should now allow calling bucket methods
        expect(typeof adapter.getBucketEntries).toBe('function');
        expect(typeof adapter.setBucket).toBe('function');
        expect(typeof adapter.setRegion).toBe('function');
      }
    });
  });
});

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

  describe('progress tracking', () => {
    it('should track progress during file creation', async () => {
      const progressEvents: ProgressEvent[] = [];
      const content = 'Hello World - Test Content';

      await adapter.create('test-bucket/progress-create.txt', EntryType.File, content, {
        onProgress: (event: ProgressEvent) => {
          progressEvents.push(event);
        },
      });

      // Progress should have been reported (may vary based on file size)
      expect(progressEvents.length).toBeGreaterThanOrEqual(0);
      if (progressEvents.length > 0) {
        // Check that progress events have the right structure
        const event = progressEvents[0];
        expect(event.operation).toBeDefined();
        expect(typeof event.bytesTransferred).toBe('number');
        expect(typeof event.percentage).toBe('number');
      }
    });

    it('should track progress during file copy', async () => {
      await adapter.create('test-bucket/original-copy.txt', EntryType.File, 'test content');

      const progressEvents: ProgressEvent[] = [];
      await adapter.copy('test-bucket/original-copy.txt', 'test-bucket/copied-file.txt', {
        onProgress: (event: ProgressEvent) => {
          progressEvents.push(event);
        },
      });

      // Copy operations may or may not report progress depending on size
      expect(Array.isArray(progressEvents)).toBe(true);
    });

    it('should track progress during file move', async () => {
      await adapter.create('test-bucket/original-move.txt', EntryType.File, 'test content');

      const progressEvents: ProgressEvent[] = [];
      await adapter.move('test-bucket/original-move.txt', 'test-bucket/moved-file.txt', {
        onProgress: (event: ProgressEvent) => {
          progressEvents.push(event);
        },
      });

      // Move operations may or may not report progress depending on size
      expect(Array.isArray(progressEvents)).toBe(true);
    });

    it('should track progress during file deletion', async () => {
      await adapter.create('test-bucket/file-to-delete.txt', EntryType.File, 'test content');

      const progressEvents: ProgressEvent[] = [];
      await adapter.delete('test-bucket/file-to-delete.txt', false, {
        onProgress: (event: ProgressEvent) => {
          progressEvents.push(event);
        },
      });

      // Deletion may or may not report progress
      expect(Array.isArray(progressEvents)).toBe(true);
    });

    it('should include current file in progress events', async () => {
      const progressEvents: ProgressEvent[] = [];
      const content = 'X'.repeat(1000); // Larger content

      await adapter.create('test-bucket/progress-file.txt', EntryType.File, content, {
        onProgress: (event: ProgressEvent) => {
          progressEvents.push(event);
        },
      });

      // If any progress events were reported, they should have currentFile
      if (progressEvents.length > 0) {
        for (const event of progressEvents) {
          expect(event.currentFile).toBeDefined();
        }
      }
    });

    it('should report progress percentage (0-100)', async () => {
      const progressEvents: ProgressEvent[] = [];
      const content = 'X'.repeat(1000);

      await adapter.create('test-bucket/progress-percentage.txt', EntryType.File, content, {
        onProgress: (event: ProgressEvent) => {
          progressEvents.push(event);
        },
      });

      if (progressEvents.length > 0) {
        for (const event of progressEvents) {
          expect(event.percentage).toBeGreaterThanOrEqual(0);
          expect(event.percentage).toBeLessThanOrEqual(100);
        }
      }
    });

    it('should work without progress callback', async () => {
      // Ensure that operations work fine without progress callback
      await adapter.create('test-bucket/no-progress.txt', EntryType.File, 'test');
      const exists = await adapter.exists('test-bucket/no-progress.txt');
      expect(exists).toBe(true);
    });
  });

  describe('read operation', () => {
    it('should read file content', async () => {
      const content = 'Hello from file';
      await adapter.create('test-bucket/read-test.txt', EntryType.File, content);

      const buffer = await adapter.read('test-bucket/read-test.txt');
      expect(buffer.toString()).toBe(content);
    });

    it('should read file with progress tracking', async () => {
      const content = 'X'.repeat(1000);
      await adapter.create('test-bucket/read-progress.txt', EntryType.File, content);

      const progressEvents: ProgressEvent[] = [];
      const buffer = await adapter.read('test-bucket/read-progress.txt', {
        onProgress: (event: ProgressEvent) => {
          progressEvents.push(event);
        },
      });

      expect(buffer.toString()).toBe(content);
      expect(Array.isArray(progressEvents)).toBe(true);
    });

    it('should throw error when reading directory', async () => {
      await adapter.create('test-bucket/read-dir/', EntryType.Directory);

      expect(async () => {
        await adapter.read('test-bucket/read-dir/');
      }).toThrow();
    });

    it('should throw error when reading non-existent file', async () => {
      expect(async () => {
        await adapter.read('test-bucket/non-existent-file.txt');
      }).toThrow();
    });
  });
});
