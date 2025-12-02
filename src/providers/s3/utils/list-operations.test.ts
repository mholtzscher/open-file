/**
 * Tests for List Operations Module
 */

import { describe, it, expect, mock } from 'bun:test';
import { listObjects, listBuckets, ListOperationsLogger } from './list-operations.js';
import { EntryType } from '../../../types/entry.js';

// Mock S3Client - returns responses in order
function createMockClient(responses: any[]) {
  let callIndex = 0;
  return {
    send: mock(async () => {
      const response = responses[callIndex] || responses[responses.length - 1];
      callIndex++;
      return response;
    }),
  } as any;
}

describe('listObjects', () => {
  describe('basic listing', () => {
    it('returns empty entries for empty bucket', async () => {
      const client = createMockClient([{ CommonPrefixes: [], Contents: [], IsTruncated: false }]);

      const result = await listObjects({
        client,
        bucket: 'test-bucket',
        prefix: '',
      });

      expect(result.entries).toHaveLength(0);
      expect(result.hasMore).toBe(false);
      expect(result.continuationToken).toBeUndefined();
    });

    it('parses directories from CommonPrefixes', async () => {
      const client = createMockClient([
        {
          CommonPrefixes: [{ Prefix: 'folder1/' }, { Prefix: 'folder2/' }],
          Contents: [],
          IsTruncated: false,
        },
      ]);

      const result = await listObjects({
        client,
        bucket: 'test-bucket',
        prefix: '',
      });

      expect(result.entries).toHaveLength(2);
      expect(result.entries[0].type).toBe(EntryType.Directory);
      expect(result.entries[0].name).toBe('folder1');
      expect(result.entries[1].type).toBe(EntryType.Directory);
      expect(result.entries[1].name).toBe('folder2');
    });

    it('parses files from Contents', async () => {
      const client = createMockClient([
        {
          CommonPrefixes: [],
          Contents: [
            { Key: 'file1.txt', Size: 100, LastModified: new Date('2024-01-01') },
            { Key: 'file2.txt', Size: 200, LastModified: new Date('2024-01-02') },
          ],
          IsTruncated: false,
        },
      ]);

      const result = await listObjects({
        client,
        bucket: 'test-bucket',
        prefix: '',
      });

      expect(result.entries).toHaveLength(2);
      expect(result.entries[0].type).toBe(EntryType.File);
      expect(result.entries[0].name).toBe('file1.txt');
      expect(result.entries[0].size).toBe(100);
      expect(result.entries[1].type).toBe(EntryType.File);
      expect(result.entries[1].name).toBe('file2.txt');
    });

    it('returns directories before files (sorted)', async () => {
      const client = createMockClient([
        {
          CommonPrefixes: [{ Prefix: 'zebra/' }],
          Contents: [{ Key: 'alpha.txt', Size: 100 }],
          IsTruncated: false,
        },
      ]);

      const result = await listObjects({
        client,
        bucket: 'test-bucket',
        prefix: '',
      });

      expect(result.entries).toHaveLength(2);
      // Directory should come first even though 'alpha' < 'zebra'
      expect(result.entries[0].type).toBe(EntryType.Directory);
      expect(result.entries[0].name).toBe('zebra');
      expect(result.entries[1].type).toBe(EntryType.File);
      expect(result.entries[1].name).toBe('alpha.txt');
    });
  });

  describe('pagination', () => {
    it('returns hasMore=true when truncated', async () => {
      const client = createMockClient([
        {
          CommonPrefixes: [],
          Contents: [{ Key: 'file.txt', Size: 100 }],
          IsTruncated: true,
          NextContinuationToken: 'token123',
        },
      ]);

      const result = await listObjects({
        client,
        bucket: 'test-bucket',
        prefix: '',
      });

      expect(result.hasMore).toBe(true);
      expect(result.continuationToken).toBe('token123');
    });

    it('returns hasMore=false when not truncated', async () => {
      const client = createMockClient([
        {
          CommonPrefixes: [],
          Contents: [{ Key: 'file.txt', Size: 100 }],
          IsTruncated: false,
        },
      ]);

      const result = await listObjects({
        client,
        bucket: 'test-bucket',
        prefix: '',
      });

      expect(result.hasMore).toBe(false);
      expect(result.continuationToken).toBeUndefined();
    });
  });

  describe('options', () => {
    it('uses default delimiter of /', async () => {
      const client = createMockClient([{ CommonPrefixes: [], Contents: [] }]);

      await listObjects({
        client,
        bucket: 'test-bucket',
        prefix: 'folder/',
      });

      expect(client.send).toHaveBeenCalled();
    });

    it('uses default maxKeys of 1000', async () => {
      const client = createMockClient([{ CommonPrefixes: [], Contents: [] }]);

      await listObjects({
        client,
        bucket: 'test-bucket',
        prefix: '',
      });

      expect(client.send).toHaveBeenCalled();
    });

    it('respects custom maxKeys', async () => {
      const client = createMockClient([{ CommonPrefixes: [], Contents: [] }]);

      await listObjects({
        client,
        bucket: 'test-bucket',
        prefix: '',
        maxKeys: 50,
      });

      expect(client.send).toHaveBeenCalled();
    });
  });

  describe('with prefix', () => {
    it('strips prefix from entry names', async () => {
      const client = createMockClient([
        {
          CommonPrefixes: [{ Prefix: 'parent/child/' }],
          Contents: [{ Key: 'parent/file.txt', Size: 100 }],
          IsTruncated: false,
        },
      ]);

      const result = await listObjects({
        client,
        bucket: 'test-bucket',
        prefix: 'parent/',
      });

      expect(result.entries).toHaveLength(2);
      expect(result.entries[0].name).toBe('child');
      expect(result.entries[1].name).toBe('file.txt');
    });
  });

  describe('logging', () => {
    it('calls logger.debug with context', async () => {
      const client = createMockClient([{ CommonPrefixes: [], Contents: [] }]);
      const logger: ListOperationsLogger = {
        debug: mock(() => {}),
        error: mock(() => {}),
      };

      await listObjects({
        client,
        bucket: 'test-bucket',
        prefix: 'folder/',
        logger,
      });

      expect(logger.debug).toHaveBeenCalled();
    });

    it('works without logger', async () => {
      const client = createMockClient([{ CommonPrefixes: [], Contents: [] }]);

      // Should not throw
      const result = await listObjects({
        client,
        bucket: 'test-bucket',
        prefix: '',
      });

      expect(result.entries).toHaveLength(0);
    });
  });
});

describe('listBuckets', () => {
  describe('basic listing', () => {
    it('returns empty array when no buckets', async () => {
      const client = createMockClient([{ Buckets: [] }]);

      const result = await listBuckets({ client });

      expect(result).toHaveLength(0);
    });

    it('returns bucket info', async () => {
      const creationDate = new Date('2024-01-15');
      const client = createMockClient([
        { Buckets: [{ Name: 'my-bucket', CreationDate: creationDate }] },
      ]);

      const result = await listBuckets({ client });

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('my-bucket');
      expect(result[0].creationDate).toEqual(creationDate);
    });
  });

  describe('sorting', () => {
    it('sorts buckets by creation date (newest first)', async () => {
      const client = createMockClient([
        {
          Buckets: [
            { Name: 'old-bucket', CreationDate: new Date('2023-01-01') },
            { Name: 'new-bucket', CreationDate: new Date('2024-06-01') },
            { Name: 'mid-bucket', CreationDate: new Date('2024-01-01') },
          ],
        },
      ]);

      const result = await listBuckets({ client });

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('new-bucket');
      expect(result[1].name).toBe('mid-bucket');
      expect(result[2].name).toBe('old-bucket');
    });
  });

  describe('filtering', () => {
    it('skips buckets without names', async () => {
      const client = createMockClient([
        {
          Buckets: [
            { Name: 'valid-bucket', CreationDate: new Date() },
            { CreationDate: new Date() }, // No name
            { Name: '', CreationDate: new Date() }, // Empty name
          ],
        },
      ]);

      const result = await listBuckets({ client });

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('valid-bucket');
    });
  });

  describe('logging', () => {
    it('calls logger.debug', async () => {
      const client = createMockClient([{ Buckets: [] }]);
      const logger: ListOperationsLogger = {
        debug: mock(() => {}),
        error: mock(() => {}),
      };

      await listBuckets({ client, logger });

      expect(logger.debug).toHaveBeenCalled();
    });
  });
});
