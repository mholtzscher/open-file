/**
 * LocalStack Integration Tests for S3Provider
 *
 * These tests verify that the S3Provider works correctly with LocalStack,
 * a local AWS service emulator. To run these tests:
 *
 * 1. Install LocalStack:
 *    pip install localstack
 *
 * 2. Start LocalStack in a terminal:
 *    localstack start
 *
 * 3. Set dummy AWS credentials (LocalStack accepts any values):
 *    export AWS_ACCESS_KEY_ID=test
 *    export AWS_SECRET_ACCESS_KEY=test
 *
 * 4. Run the tests:
 *    bun test src/providers/s3/s3-provider.localstack.test.ts
 *
 * The tests verify all provider operations work correctly with a real
 * S3-compatible endpoint using the OperationResult pattern.
 */

// Set dummy AWS credentials for LocalStack (must be before imports that use them)
process.env.AWS_ACCESS_KEY_ID = 'test';
process.env.AWS_SECRET_ACCESS_KEY = 'test';

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';
import { S3Provider } from './s3-provider.js';
import type { S3Profile } from '../types/profile.js';
import { EntryType } from '../../types/entry.js';
import { S3Client, CreateBucketCommand, DeleteBucketCommand } from '@aws-sdk/client-s3';
import { isSuccess, OperationStatus } from '../types/result.js';
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// ============================================================================
// LocalStack Configuration
// ============================================================================

const LOCALSTACK_ENDPOINT = 'http://localhost:4566';
const TEST_REGION = 'us-east-1';
const TEST_BUCKET = 'test-bucket-s3provider';

/**
 * Check if LocalStack is available
 */
async function isLocalStackAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${LOCALSTACK_ENDPOINT}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Create a test profile for LocalStack
 */
function createLocalStackProfile(): S3Profile {
  return {
    id: 'localstack-test',
    displayName: 'LocalStack Test Profile',
    provider: 's3',
    config: {
      region: TEST_REGION,
      endpoint: LOCALSTACK_ENDPOINT,
      forcePathStyle: true,
    },
  };
}

/**
 * Create test bucket in LocalStack
 */
async function createTestBucket(client: S3Client, bucketName: string): Promise<void> {
  try {
    await client.send(new CreateBucketCommand({ Bucket: bucketName }));
  } catch {
    // Bucket may already exist
  }
}

/**
 * Delete test bucket from LocalStack
 */
async function deleteTestBucket(client: S3Client, bucketName: string): Promise<void> {
  try {
    // First clean up using provider
    const provider = new S3Provider(createLocalStackProfile());
    provider.setContainer(bucketName);

    const listResult = await provider.list('/');
    if (isSuccess(listResult)) {
      for (const entry of listResult.data.entries) {
        await provider.delete(entry.path, { recursive: true });
      }
    }

    await client.send(new DeleteBucketCommand({ Bucket: bucketName }));
  } catch {
    // Ignore cleanup errors
  }
}

// ============================================================================
// Integration Tests
// ============================================================================

describe.if(await isLocalStackAvailable())('S3Provider LocalStack Integration', () => {
  let provider: S3Provider;
  let s3Client: S3Client;

  beforeAll(async () => {
    // AWS credentials are set via environment variables at the top of the file
    s3Client = new S3Client({
      region: TEST_REGION,
      endpoint: LOCALSTACK_ENDPOINT,
      forcePathStyle: true,
    });

    await createTestBucket(s3Client, TEST_BUCKET);

    provider = new S3Provider(createLocalStackProfile());
    provider.setContainer(TEST_BUCKET);
  });

  afterAll(async () => {
    await deleteTestBucket(s3Client, TEST_BUCKET);
    s3Client.destroy();
  });

  // Clean up after each test
  afterEach(async () => {
    const listResult = await provider.list('/');
    if (isSuccess(listResult)) {
      for (const entry of listResult.data.entries) {
        await provider.delete(entry.path, { recursive: true });
      }
    }
  });

  // ==========================================================================
  // Container Operations
  // ==========================================================================

  describe('container operations', () => {
    it('should list buckets', async () => {
      const result = await provider.listContainers();

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(Array.isArray(result.data)).toBe(true);
        const bucketNames = result.data.map(b => b.name);
        expect(bucketNames).toContain(TEST_BUCKET);
      }
    });
  });

  // ==========================================================================
  // Core Operations
  // ==========================================================================

  describe('list operations', () => {
    it('should list empty directory', async () => {
      const result = await provider.list('/');

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.entries).toHaveLength(0);
        expect(result.data.hasMore).toBe(false);
      }
    });

    it('should list files and directories', async () => {
      // Create test files
      await provider.write('file1.txt', 'content 1');
      await provider.write('file2.txt', 'content 2');
      await provider.mkdir('folder/');

      const result = await provider.list('/');

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.entries.length).toBeGreaterThanOrEqual(2);
        const names = result.data.entries.map(e => e.name);
        expect(names).toContain('file1.txt');
        expect(names).toContain('file2.txt');
      }
    });

    it('should support pagination', async () => {
      // Create multiple files
      for (let i = 0; i < 5; i++) {
        await provider.write(`file${i}.txt`, `content ${i}`);
      }

      // List with limit
      const result1 = await provider.list('/', { limit: 2 });

      expect(isSuccess(result1)).toBe(true);
      if (isSuccess(result1)) {
        expect(result1.data.entries.length).toBeLessThanOrEqual(2);

        if (result1.data.hasMore && result1.data.continuationToken) {
          // Get next page
          const result2 = await provider.list('/', {
            limit: 2,
            continuationToken: result1.data.continuationToken,
          });

          expect(isSuccess(result2)).toBe(true);
        }
      }
    });
  });

  describe('read/write operations', () => {
    it('should write and read text content', async () => {
      const content = 'Hello, S3Provider!';

      const writeResult = await provider.write('test.txt', content);
      expect(isSuccess(writeResult)).toBe(true);

      const readResult = await provider.read('test.txt');
      expect(isSuccess(readResult)).toBe(true);
      if (isSuccess(readResult)) {
        expect(readResult.data.toString()).toBe(content);
      }
    });

    it('should write and read binary content', async () => {
      const content = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0xfd]);

      const writeResult = await provider.write('binary.bin', content);
      expect(isSuccess(writeResult)).toBe(true);

      const readResult = await provider.read('binary.bin');
      expect(isSuccess(readResult)).toBe(true);
      if (isSuccess(readResult)) {
        expect(Buffer.compare(readResult.data, content)).toBe(0);
      }
    });

    it('should write with content type', async () => {
      const content = '{"key": "value"}';

      const writeResult = await provider.write('data.json', content, {
        contentType: 'application/json',
      });
      expect(isSuccess(writeResult)).toBe(true);

      const metadataResult = await provider.getMetadata('data.json');
      expect(isSuccess(metadataResult)).toBe(true);
      if (isSuccess(metadataResult)) {
        expect(metadataResult.data.metadata?.contentType).toBe('application/json');
      }
    });

    it('should overwrite existing file', async () => {
      await provider.write('overwrite.txt', 'original');
      await provider.write('overwrite.txt', 'updated');

      const readResult = await provider.read('overwrite.txt');
      expect(isSuccess(readResult)).toBe(true);
      if (isSuccess(readResult)) {
        expect(readResult.data.toString()).toBe('updated');
      }
    });
  });

  describe('exists operation', () => {
    it('should return true for existing file', async () => {
      await provider.write('exists.txt', 'content');

      const result = await provider.exists('exists.txt');
      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data).toBe(true);
      }
    });

    it('should return false for non-existing file', async () => {
      const result = await provider.exists('nonexistent.txt');
      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data).toBe(false);
      }
    });
  });

  describe('mkdir operation', () => {
    it('should create directory marker', async () => {
      const result = await provider.mkdir('new-folder/');
      expect(isSuccess(result)).toBe(true);

      const existsResult = await provider.exists('new-folder/');
      expect(isSuccess(existsResult)).toBe(true);
      if (isSuccess(existsResult)) {
        expect(existsResult.data).toBe(true);
      }
    });
  });

  describe('delete operation', () => {
    it('should delete single file', async () => {
      await provider.write('to-delete.txt', 'content');

      const deleteResult = await provider.delete('to-delete.txt');
      expect(isSuccess(deleteResult)).toBe(true);

      const existsResult = await provider.exists('to-delete.txt');
      if (isSuccess(existsResult)) {
        expect(existsResult.data).toBe(false);
      }
    });

    it('should delete directory recursively', async () => {
      await provider.write('folder/file1.txt', 'content 1');
      await provider.write('folder/file2.txt', 'content 2');
      await provider.write('folder/subfolder/file3.txt', 'content 3');

      const deleteResult = await provider.delete('folder/', { recursive: true });
      expect(isSuccess(deleteResult)).toBe(true);

      const exists1 = await provider.exists('folder/file1.txt');
      const exists2 = await provider.exists('folder/subfolder/file3.txt');

      if (isSuccess(exists1)) expect(exists1.data).toBe(false);
      if (isSuccess(exists2)) expect(exists2.data).toBe(false);
    });
  });

  describe('getMetadata operation', () => {
    it('should return file metadata', async () => {
      const content = 'test content for metadata';
      await provider.write('metadata-test.txt', content);

      const result = await provider.getMetadata('metadata-test.txt');

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.name).toBe('metadata-test.txt');
        expect(result.data.type).toBe(EntryType.File);
        expect(result.data.size).toBe(content.length);
        expect(result.data.modified).toBeInstanceOf(Date);
      }
    });

    it('should return not found for missing file', async () => {
      const result = await provider.getMetadata('nonexistent.txt');

      expect(result.status).toBe(OperationStatus.NotFound);
    });
  });

  // ==========================================================================
  // Copy/Move Operations
  // ==========================================================================

  describe('copy operation', () => {
    it('should copy file', async () => {
      const content = 'content to copy';
      await provider.write('source.txt', content);

      const copyResult = await provider.copy('source.txt', 'destination.txt');
      expect(isSuccess(copyResult)).toBe(true);

      // Both files should exist
      const sourceExists = await provider.exists('source.txt');
      const destExists = await provider.exists('destination.txt');

      if (isSuccess(sourceExists)) expect(sourceExists.data).toBe(true);
      if (isSuccess(destExists)) expect(destExists.data).toBe(true);

      // Content should be same
      const destContent = await provider.read('destination.txt');
      if (isSuccess(destContent)) {
        expect(destContent.data.toString()).toBe(content);
      }
    });
  });

  describe('move operation', () => {
    it('should move file', async () => {
      const content = 'content to move';
      await provider.write('move-source.txt', content);

      const moveResult = await provider.move('move-source.txt', 'move-dest.txt');
      expect(isSuccess(moveResult)).toBe(true);

      // Source should not exist
      const sourceExists = await provider.exists('move-source.txt');
      if (isSuccess(sourceExists)) expect(sourceExists.data).toBe(false);

      // Destination should exist with same content
      const destContent = await provider.read('move-dest.txt');
      if (isSuccess(destContent)) {
        expect(destContent.data.toString()).toBe(content);
      }
    });
  });

  // ==========================================================================
  // Local Filesystem Transfers
  // ==========================================================================

  describe('local filesystem transfers', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = join(tmpdir(), `s3-provider-test-${Date.now()}`);
      mkdirSync(tempDir, { recursive: true });
    });

    afterEach(() => {
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should download file to local', async () => {
      const content = 'download test content';
      await provider.write('download-test.txt', content);

      const localPath = join(tempDir, 'downloaded.txt');
      const result = await provider.downloadToLocal('download-test.txt', localPath);

      expect(isSuccess(result)).toBe(true);
      expect(existsSync(localPath)).toBe(true);
      expect(readFileSync(localPath, 'utf-8')).toBe(content);
    });

    it('should upload file from local', async () => {
      const content = 'upload test content';
      const localPath = join(tempDir, 'to-upload.txt');
      writeFileSync(localPath, content);

      const result = await provider.uploadFromLocal(localPath, 'uploaded.txt');

      expect(isSuccess(result)).toBe(true);

      const readResult = await provider.read('uploaded.txt');
      if (isSuccess(readResult)) {
        expect(readResult.data.toString()).toBe(content);
      }
    });
  });
});

// ============================================================================
// Skip message when LocalStack not available
// ============================================================================

describe.if(!(await isLocalStackAvailable()))('S3Provider LocalStack (skipped)', () => {
  it.skip('LocalStack not available - start with: localstack start', () => {
    // This test is skipped
  });
});
