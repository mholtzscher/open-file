/**
 * LocalStack Integration Tests for S3Adapter
 * 
 * These tests verify that the S3Adapter works correctly with LocalStack,
 * a local AWS service emulator. To run these tests:
 * 
 * 1. Install LocalStack:
 *    pip install localstack
 * 
 * 2. Start LocalStack in a terminal:
 *    localstack start
 * 
 * 3. Run the tests:
 *    bun test src/adapters/s3-adapter.localstack.test.ts
 * 
 * The tests verify all adapter operations (list, create, delete, move, copy)
 * work correctly with a real S3-compatible endpoint.
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { S3Adapter, S3AdapterConfig } from './s3-adapter.js';
import { EntryType } from '../types/entry.js';
import { 
  S3Client, 
  CreateBucketCommand, 
  DeleteBucketCommand 
} from '@aws-sdk/client-s3';

// LocalStack configuration
const LOCALSTACK_ENDPOINT = 'http://localhost:4566';
const TEST_REGION = 'us-east-1';
const TEST_BUCKET = 'test-bucket-localstack';

/**
 * Check if LocalStack is available
 */
async function isLocalStackAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${LOCALSTACK_ENDPOINT}/health`);
    return response.ok;
  } catch (e) {
    return false;
  }
}

/**
 * Create test bucket in LocalStack
 */
async function createTestBucket(client: S3Client, bucketName: string): Promise<void> {
  try {
    await client.send(new CreateBucketCommand({ Bucket: bucketName }));
  } catch (e) {
    // Bucket may already exist
    console.log(`Bucket ${bucketName} creation - ignoring error`);
  }
}

/**
 * Delete test bucket from LocalStack
 */
async function deleteTestBucket(client: S3Client, bucketName: string): Promise<void> {
  try {
    // First delete all objects
    const adapter = new S3Adapter({
      region: TEST_REGION,
      bucket: bucketName,
      endpoint: LOCALSTACK_ENDPOINT,
    });

    const result = await adapter.list('');
    for (const entry of result.entries) {
      try {
        await adapter.delete(entry.path, true);
      } catch (e) {
        // Ignore errors while cleaning up
      }
    }

    // Then delete bucket
    await client.send(new DeleteBucketCommand({ Bucket: bucketName }));
  } catch (e) {
    console.log(`Bucket ${bucketName} cleanup - ignoring error`);
  }
}

describe.if(await isLocalStackAvailable())('S3Adapter with LocalStack', () => {
  let adapter: S3Adapter;

  beforeAll(async () => {
    const config: S3AdapterConfig = {
      region: TEST_REGION,
      bucket: TEST_BUCKET,
      endpoint: LOCALSTACK_ENDPOINT,
      accessKeyId: 'test',
      secretAccessKey: 'test',
    };

    // Create test bucket
    const client = new S3Client({
      region: TEST_REGION,
      endpoint: LOCALSTACK_ENDPOINT,
      credentials: {
        accessKeyId: 'test',
        secretAccessKey: 'test',
      },
    });

    await createTestBucket(client, TEST_BUCKET);
    adapter = new S3Adapter(config);
  });

  afterAll(async () => {
    const client = new S3Client({
      region: TEST_REGION,
      endpoint: LOCALSTACK_ENDPOINT,
      credentials: {
        accessKeyId: 'test',
        secretAccessKey: 'test',
      },
    });

    await deleteTestBucket(client, TEST_BUCKET);
  });

  describe('list', () => {
    it('should list empty bucket', async () => {
      const result = await adapter.list('');
      expect(result.entries).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });

    it('should list files after creating them', async () => {
      await adapter.create('file1.txt', EntryType.File, 'content1');
      await adapter.create('file2.txt', EntryType.File, 'content2');

      const result = await adapter.list('');
      expect(result.entries.length).toBeGreaterThanOrEqual(2);
    });

    it('should separate directories and files', async () => {
      await adapter.create('dir1/', EntryType.Directory);
      await adapter.create('test-file.txt', EntryType.File, 'test');

      const result = await adapter.list('');
      const hasDirectories = result.entries.some(e => e.type.toString() === 'directory');
      const hasFiles = result.entries.some(e => e.type.toString() === 'file');
      expect(hasDirectories).toBe(true);
      expect(hasFiles).toBe(true);
    });
  });

  describe('create', () => {
    it('should create a file', async () => {
      const fileName = 'integration-test.txt';
      await adapter.create(fileName, EntryType.File, 'integration test content');
      
      const exists = await adapter.exists(fileName);
      expect(exists).toBe(true);
    });

    it('should create a directory', async () => {
      const dirName = 'integration-dir/';
      await adapter.create(dirName, EntryType.Directory);
      
      const exists = await adapter.exists(dirName);
      expect(exists).toBe(true);
    });

    it('should create a file in a directory', async () => {
      const filePath = 'integration-dir/nested-file.txt';
      await adapter.create(filePath, EntryType.File, 'nested content');
      
      const exists = await adapter.exists(filePath);
      expect(exists).toBe(true);
    });
  });

  describe('delete', () => {
    it('should delete a file', async () => {
      await adapter.create('to-delete.txt', EntryType.File, 'delete me');
      expect(await adapter.exists('to-delete.txt')).toBe(true);
      
      await adapter.delete('to-delete.txt');
      expect(await adapter.exists('to-delete.txt')).toBe(false);
    });

    it('should delete a directory recursively', async () => {
      await adapter.create('to-delete-dir/', EntryType.Directory);
      await adapter.create('to-delete-dir/file.txt', EntryType.File, 'content');
      
      expect(await adapter.exists('to-delete-dir/')).toBe(true);
      
      await adapter.delete('to-delete-dir/', true);
      expect(await adapter.exists('to-delete-dir/')).toBe(false);
    });
  });

  describe('move', () => {
    it('should move a file', async () => {
      await adapter.create('source.txt', EntryType.File, 'move me');
      await adapter.move('source.txt', 'destination.txt');
      
      expect(await adapter.exists('source.txt')).toBe(false);
      expect(await adapter.exists('destination.txt')).toBe(true);
    });

    it('should move a file to a directory', async () => {
      await adapter.create('move-me.txt', EntryType.File, 'content');
      await adapter.create('target-dir/', EntryType.Directory);
      
      await adapter.move('move-me.txt', 'target-dir/move-me.txt');
      
      expect(await adapter.exists('move-me.txt')).toBe(false);
      expect(await adapter.exists('target-dir/move-me.txt')).toBe(true);
    });
  });

  describe('copy', () => {
    it('should copy a file', async () => {
      await adapter.create('original.txt', EntryType.File, 'original content');
      await adapter.copy('original.txt', 'copy.txt');
      
      expect(await adapter.exists('original.txt')).toBe(true);
      expect(await adapter.exists('copy.txt')).toBe(true);
    });

    it('should copy a file to a directory', async () => {
      await adapter.create('file-to-copy.txt', EntryType.File, 'copy me');
      await adapter.create('copy-dest-dir/', EntryType.Directory);
      
      await adapter.copy('file-to-copy.txt', 'copy-dest-dir/file-to-copy.txt');
      
      expect(await adapter.exists('file-to-copy.txt')).toBe(true);
      expect(await adapter.exists('copy-dest-dir/file-to-copy.txt')).toBe(true);
    });
  });

  describe('getMetadata', () => {
    it('should get metadata for a file', async () => {
      await adapter.create('metadata-test.txt', EntryType.File, 'test');
      const entry = await adapter.getMetadata('metadata-test.txt');
      
      expect(entry.name).toBe('metadata-test.txt');
      expect(entry.type.toString()).toBe('file');
    });

    it('should throw for non-existent entry', async () => {
      expect(async () => {
        await adapter.getMetadata('non-existent.txt');
      }).toThrow();
    });
  });
});

describe.skipIf(await isLocalStackAvailable())('S3Adapter LocalStack Tests Skipped', () => {
  it('should skip LocalStack tests if not available', () => {
    // This test runs if LocalStack is NOT available
    expect(true).toBe(true);
  });
});
