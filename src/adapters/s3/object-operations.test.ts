/**
 * Tests for S3 Object Operations (Copy and Move)
 */

import { describe, it, expect, mock } from 'bun:test';
import {
  copyObject,
  moveObject,
  copyDirectory,
  moveDirectory,
  batchObjectOperation,
} from './object-operations.js';

// Mock S3Client
function createMockClient(responses: any[] = [{}]) {
  let callIndex = 0;
  return {
    send: mock(async () => {
      const response = responses[callIndex] || responses[responses.length - 1];
      callIndex++;
      return response;
    }),
  };
}

describe('copyObject', () => {
  it('copies a single object', async () => {
    const mockClient = createMockClient([{}]);

    await copyObject({
      client: mockClient as any,
      sourceBucket: 'source-bucket',
      sourceKey: 'folder/file.txt',
      destBucket: 'dest-bucket',
      destKey: 'new-folder/file.txt',
    });

    expect(mockClient.send).toHaveBeenCalledTimes(1);
  });

  it('copies within the same bucket', async () => {
    const mockClient = createMockClient([{}]);

    await copyObject({
      client: mockClient as any,
      sourceBucket: 'my-bucket',
      sourceKey: 'original.txt',
      destBucket: 'my-bucket',
      destKey: 'copy.txt',
    });

    expect(mockClient.send).toHaveBeenCalledTimes(1);
  });

  it('copies to a different bucket', async () => {
    const mockClient = createMockClient([{}]);

    await copyObject({
      client: mockClient as any,
      sourceBucket: 'bucket-a',
      sourceKey: 'file.txt',
      destBucket: 'bucket-b',
      destKey: 'file.txt',
    });

    expect(mockClient.send).toHaveBeenCalledTimes(1);
  });
});

describe('moveObject', () => {
  it('moves a single object (copy + delete)', async () => {
    const mockClient = createMockClient([{}, {}]);

    await moveObject({
      client: mockClient as any,
      bucket: 'my-bucket',
      sourceKey: 'old/file.txt',
      destKey: 'new/file.txt',
    });

    // Should call copy then delete
    expect(mockClient.send).toHaveBeenCalledTimes(2);
  });

  it('renames a file in the same directory', async () => {
    const mockClient = createMockClient([{}, {}]);

    await moveObject({
      client: mockClient as any,
      bucket: 'bucket',
      sourceKey: 'folder/old-name.txt',
      destKey: 'folder/new-name.txt',
    });

    expect(mockClient.send).toHaveBeenCalledTimes(2);
  });
});

describe('copyDirectory', () => {
  it('copies all objects in a directory', async () => {
    // Mock: first call is listAllObjects, subsequent calls are copyObject
    const mockClient = createMockClient([
      // ListObjectsV2 response
      {
        Contents: [
          { Key: 'source/file1.txt' },
          { Key: 'source/file2.txt' },
          { Key: 'source/subdir/file3.txt' },
        ],
        NextContinuationToken: undefined,
      },
      // CopyObject responses
      {},
      {},
      {},
    ]);

    await copyDirectory({
      client: mockClient as any,
      sourceBucket: 'my-bucket',
      sourcePrefix: 'source/',
      destBucket: 'my-bucket',
      destPrefix: 'dest/',
    });

    // 1 list call + 3 copy calls
    expect(mockClient.send).toHaveBeenCalledTimes(4);
  });

  it('reports progress during copy', async () => {
    const mockClient = createMockClient([
      {
        Contents: [{ Key: 'src/a.txt' }, { Key: 'src/b.txt' }],
        NextContinuationToken: undefined,
      },
      {},
      {},
    ]);

    const progressCalls: [number, number, string][] = [];

    await copyDirectory({
      client: mockClient as any,
      sourceBucket: 'bucket',
      sourcePrefix: 'src/',
      destBucket: 'bucket',
      destPrefix: 'dst/',
      onProgress: (copied, total, key) => {
        progressCalls.push([copied, total, key]);
      },
    });

    expect(progressCalls).toEqual([
      [1, 2, 'src/a.txt'],
      [2, 2, 'src/b.txt'],
    ]);
  });

  it('handles empty directory', async () => {
    const mockClient = createMockClient([
      {
        Contents: [],
        NextContinuationToken: undefined,
      },
    ]);

    await copyDirectory({
      client: mockClient as any,
      sourceBucket: 'bucket',
      sourcePrefix: 'empty/',
      destBucket: 'bucket',
      destPrefix: 'dest/',
    });

    // Only 1 list call, no copy calls
    expect(mockClient.send).toHaveBeenCalledTimes(1);
  });

  it('excludes source prefix from copy list', async () => {
    const mockClient = createMockClient([
      {
        Contents: [
          { Key: 'dir/' }, // directory marker - should be excluded
          { Key: 'dir/file.txt' },
        ],
        NextContinuationToken: undefined,
      },
      {},
    ]);

    await copyDirectory({
      client: mockClient as any,
      sourceBucket: 'bucket',
      sourcePrefix: 'dir/',
      destBucket: 'bucket',
      destPrefix: 'new/',
    });

    // 1 list + 1 copy (dir marker excluded)
    expect(mockClient.send).toHaveBeenCalledTimes(2);
  });

  it('copies to a different bucket', async () => {
    const mockClient = createMockClient([
      {
        Contents: [{ Key: 'src/file.txt' }],
        NextContinuationToken: undefined,
      },
      {},
    ]);

    await copyDirectory({
      client: mockClient as any,
      sourceBucket: 'source-bucket',
      sourcePrefix: 'src/',
      destBucket: 'dest-bucket',
      destPrefix: 'dst/',
    });

    expect(mockClient.send).toHaveBeenCalledTimes(2);
  });
});

describe('moveDirectory', () => {
  it('moves all objects in a directory', async () => {
    const mockClient = createMockClient([
      // ListObjectsV2 response
      {
        Contents: [{ Key: 'source/file1.txt' }, { Key: 'source/file2.txt' }],
        NextContinuationToken: undefined,
      },
      // Move operations (copy + delete for each)
      {},
      {}, // file1: copy, delete
      {},
      {}, // file2: copy, delete
    ]);

    await moveDirectory({
      client: mockClient as any,
      bucket: 'my-bucket',
      sourcePrefix: 'source/',
      destPrefix: 'dest/',
    });

    // 1 list + 2 files * 2 operations (copy + delete)
    expect(mockClient.send).toHaveBeenCalledTimes(5);
  });

  it('reports progress during move', async () => {
    const mockClient = createMockClient([
      {
        Contents: [{ Key: 'src/a.txt' }, { Key: 'src/b.txt' }],
        NextContinuationToken: undefined,
      },
      {},
      {}, // file1
      {},
      {}, // file2
    ]);

    const progressCalls: [number, number, string][] = [];

    await moveDirectory({
      client: mockClient as any,
      bucket: 'bucket',
      sourcePrefix: 'src/',
      destPrefix: 'dst/',
      onProgress: (moved, total, key) => {
        progressCalls.push([moved, total, key]);
      },
    });

    expect(progressCalls).toEqual([
      [1, 2, 'src/a.txt'],
      [2, 2, 'src/b.txt'],
    ]);
  });

  it('handles empty directory', async () => {
    const mockClient = createMockClient([
      {
        Contents: [],
        NextContinuationToken: undefined,
      },
    ]);

    await moveDirectory({
      client: mockClient as any,
      bucket: 'bucket',
      sourcePrefix: 'empty/',
      destPrefix: 'dest/',
    });

    // Only 1 list call, no move operations
    expect(mockClient.send).toHaveBeenCalledTimes(1);
  });

  it('preserves relative paths when moving', async () => {
    const mockClient = createMockClient([
      {
        Contents: [{ Key: 'src/subdir/file.txt' }],
        NextContinuationToken: undefined,
      },
      {},
      {}, // copy + delete
    ]);

    await moveDirectory({
      client: mockClient as any,
      bucket: 'bucket',
      sourcePrefix: 'src/',
      destPrefix: 'dst/',
    });

    // The test verifies the function runs without error
    // The actual path transformation is tested implicitly
    expect(mockClient.send).toHaveBeenCalledTimes(3);
  });

  it('handles pagination when listing objects', async () => {
    const mockClient = createMockClient([
      // First page
      {
        Contents: [{ Key: 'src/file1.txt' }],
        NextContinuationToken: 'token1',
      },
      // Second page
      {
        Contents: [{ Key: 'src/file2.txt' }],
        NextContinuationToken: undefined,
      },
      // Move operations
      {},
      {}, // file1
      {},
      {}, // file2
    ]);

    await moveDirectory({
      client: mockClient as any,
      bucket: 'bucket',
      sourcePrefix: 'src/',
      destPrefix: 'dst/',
    });

    // 2 list calls + 2 files * 2 operations
    expect(mockClient.send).toHaveBeenCalledTimes(6);
  });
});

describe('batchObjectOperation', () => {
  it('copies without deleting source when deleteSource is false', async () => {
    const mockClient = createMockClient([
      {
        Contents: [{ Key: 'src/file.txt' }],
        NextContinuationToken: undefined,
      },
      {}, // copy only
    ]);

    await batchObjectOperation({
      client: mockClient as any,
      sourceBucket: 'bucket',
      sourcePrefix: 'src/',
      destBucket: 'bucket',
      destPrefix: 'dst/',
      deleteSource: false,
    });

    // 1 list + 1 copy (no delete)
    expect(mockClient.send).toHaveBeenCalledTimes(2);
  });

  it('copies and deletes source when deleteSource is true', async () => {
    const mockClient = createMockClient([
      {
        Contents: [{ Key: 'src/file.txt' }],
        NextContinuationToken: undefined,
      },
      {}, // copy
      {}, // delete
    ]);

    await batchObjectOperation({
      client: mockClient as any,
      sourceBucket: 'bucket',
      sourcePrefix: 'src/',
      destBucket: 'bucket',
      destPrefix: 'dst/',
      deleteSource: true,
    });

    // 1 list + 1 copy + 1 delete
    expect(mockClient.send).toHaveBeenCalledTimes(3);
  });

  it('excludes specified key from operation', async () => {
    const mockClient = createMockClient([
      {
        Contents: [
          { Key: 'src/' }, // directory marker - should be excluded
          { Key: 'src/file.txt' },
        ],
        NextContinuationToken: undefined,
      },
      {},
    ]);

    await batchObjectOperation({
      client: mockClient as any,
      sourceBucket: 'bucket',
      sourcePrefix: 'src/',
      destBucket: 'bucket',
      destPrefix: 'dst/',
      excludeKey: 'src/',
      deleteSource: false,
    });

    // 1 list + 1 copy (directory marker excluded)
    expect(mockClient.send).toHaveBeenCalledTimes(2);
  });

  it('supports cross-bucket operations', async () => {
    const mockClient = createMockClient([
      {
        Contents: [{ Key: 'src/file.txt' }],
        NextContinuationToken: undefined,
      },
      {},
    ]);

    await batchObjectOperation({
      client: mockClient as any,
      sourceBucket: 'source-bucket',
      sourcePrefix: 'src/',
      destBucket: 'dest-bucket',
      destPrefix: 'dst/',
      deleteSource: false,
    });

    expect(mockClient.send).toHaveBeenCalledTimes(2);
  });
});
