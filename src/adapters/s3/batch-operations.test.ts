/**
 * Tests for S3 Batch Operations
 */

import { describe, it, expect, mock, beforeEach } from 'bun:test';
import {
  listAllObjects,
  batchDeleteObjects,
  DELETE_BATCH_SIZE,
  ListAllObjectsOptions,
  BatchDeleteOptions,
} from './batch-operations.js';

// Mock S3Client
function createMockClient(responses: any[]) {
  let callIndex = 0;
  return {
    send: mock(async () => {
      const response = responses[callIndex] || responses[responses.length - 1];
      callIndex++;
      return response;
    }),
  };
}

describe('listAllObjects', () => {
  it('lists objects from a single page', async () => {
    const mockClient = createMockClient([
      {
        Contents: [
          { Key: 'folder/file1.txt' },
          { Key: 'folder/file2.txt' },
          { Key: 'folder/file3.txt' },
        ],
        NextContinuationToken: undefined,
      },
    ]);

    const keys = await listAllObjects({
      client: mockClient as any,
      bucket: 'test-bucket',
      prefix: 'folder/',
    });

    expect(keys).toEqual(['folder/file1.txt', 'folder/file2.txt', 'folder/file3.txt']);
    expect(mockClient.send).toHaveBeenCalledTimes(1);
  });

  it('handles pagination across multiple pages', async () => {
    const mockClient = createMockClient([
      {
        Contents: [{ Key: 'folder/file1.txt' }, { Key: 'folder/file2.txt' }],
        NextContinuationToken: 'token1',
      },
      {
        Contents: [{ Key: 'folder/file3.txt' }],
        NextContinuationToken: undefined,
      },
    ]);

    const keys = await listAllObjects({
      client: mockClient as any,
      bucket: 'test-bucket',
      prefix: 'folder/',
    });

    expect(keys).toEqual(['folder/file1.txt', 'folder/file2.txt', 'folder/file3.txt']);
    expect(mockClient.send).toHaveBeenCalledTimes(2);
  });

  it('excludes specified key', async () => {
    const mockClient = createMockClient([
      {
        Contents: [{ Key: 'folder/' }, { Key: 'folder/file1.txt' }, { Key: 'folder/file2.txt' }],
        NextContinuationToken: undefined,
      },
    ]);

    const keys = await listAllObjects({
      client: mockClient as any,
      bucket: 'test-bucket',
      prefix: 'folder/',
      excludeKey: 'folder/',
    });

    expect(keys).toEqual(['folder/file1.txt', 'folder/file2.txt']);
  });

  it('excludes directory markers when requested', async () => {
    const mockClient = createMockClient([
      {
        Contents: [{ Key: 'folder/' }, { Key: 'folder/subfolder/' }, { Key: 'folder/file1.txt' }],
        NextContinuationToken: undefined,
      },
    ]);

    const keys = await listAllObjects({
      client: mockClient as any,
      bucket: 'test-bucket',
      prefix: 'folder/',
      excludeDirectoryMarkers: true,
    });

    expect(keys).toEqual(['folder/file1.txt']);
  });

  it('handles empty results', async () => {
    const mockClient = createMockClient([
      {
        Contents: undefined,
        NextContinuationToken: undefined,
      },
    ]);

    const keys = await listAllObjects({
      client: mockClient as any,
      bucket: 'test-bucket',
      prefix: 'empty/',
    });

    expect(keys).toEqual([]);
  });

  it('handles objects without Key property', async () => {
    const mockClient = createMockClient([
      {
        Contents: [{ Key: 'folder/file1.txt' }, { Size: 100 }, { Key: 'folder/file2.txt' }],
        NextContinuationToken: undefined,
      },
    ]);

    const keys = await listAllObjects({
      client: mockClient as any,
      bucket: 'test-bucket',
      prefix: 'folder/',
    });

    expect(keys).toEqual(['folder/file1.txt', 'folder/file2.txt']);
  });
});

describe('batchDeleteObjects', () => {
  it('deletes objects in a single batch', async () => {
    const mockClient = createMockClient([{}]);

    await batchDeleteObjects({
      client: mockClient as any,
      bucket: 'test-bucket',
      keys: ['file1.txt', 'file2.txt', 'file3.txt'],
    });

    expect(mockClient.send).toHaveBeenCalledTimes(1);
  });

  it('splits large lists into multiple batches', async () => {
    const mockClient = createMockClient([{}, {}, {}]);

    // Create more keys than DELETE_BATCH_SIZE
    const keys = Array.from({ length: DELETE_BATCH_SIZE + 500 }, (_, i) => `file${i}.txt`);

    await batchDeleteObjects({
      client: mockClient as any,
      bucket: 'test-bucket',
      keys,
    });

    // Should require 2 batches: 1000 + 500
    expect(mockClient.send).toHaveBeenCalledTimes(2);
  });

  it('calls progress callback with correct values', async () => {
    const mockClient = createMockClient([{}, {}]);
    const progressCalls: [number, number][] = [];

    const keys = Array.from({ length: DELETE_BATCH_SIZE + 100 }, (_, i) => `file${i}.txt`);

    await batchDeleteObjects({
      client: mockClient as any,
      bucket: 'test-bucket',
      keys,
      onProgress: (deleted, total) => {
        progressCalls.push([deleted, total]);
      },
    });

    expect(progressCalls).toEqual([
      [DELETE_BATCH_SIZE, DELETE_BATCH_SIZE + 100],
      [DELETE_BATCH_SIZE + 100, DELETE_BATCH_SIZE + 100],
    ]);
  });

  it('handles empty keys array', async () => {
    const mockClient = createMockClient([]);

    await batchDeleteObjects({
      client: mockClient as any,
      bucket: 'test-bucket',
      keys: [],
    });

    expect(mockClient.send).toHaveBeenCalledTimes(0);
  });

  it('handles exactly DELETE_BATCH_SIZE keys', async () => {
    const mockClient = createMockClient([{}]);

    const keys = Array.from({ length: DELETE_BATCH_SIZE }, (_, i) => `file${i}.txt`);

    await batchDeleteObjects({
      client: mockClient as any,
      bucket: 'test-bucket',
      keys,
    });

    expect(mockClient.send).toHaveBeenCalledTimes(1);
  });
});

describe('DELETE_BATCH_SIZE', () => {
  it('is set to S3 limit of 1000', () => {
    expect(DELETE_BATCH_SIZE).toBe(1000);
  });
});
