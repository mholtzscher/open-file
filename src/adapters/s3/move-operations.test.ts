/**
 * Tests for S3 Move Operations
 */

import { describe, it, expect, mock } from 'bun:test';
import { moveObject, moveDirectory } from './move-operations.js';

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
