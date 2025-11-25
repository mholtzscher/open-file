/**
 * Tests for S3 Transfer Operations
 */

import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  downloadFileToLocal,
  downloadDirectoryToLocal,
  uploadFileToS3,
  uploadDirectoryToS3,
} from './transfer-operations.js';

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

// Create a mock read function
function createMockReadFn(content: Buffer = Buffer.from('test content')) {
  return mock(async () => content);
}

describe('downloadFileToLocal', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'transfer-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('downloads a file to local filesystem', async () => {
    const content = Buffer.from('hello world');
    const mockRead = createMockReadFn(content);
    const localPath = join(tempDir, 'downloaded.txt');

    await downloadFileToLocal({
      readFromS3: mockRead,
      s3Key: 'folder/file.txt',
      localPath,
    });

    expect(mockRead).toHaveBeenCalledTimes(1);
    const downloaded = await fs.readFile(localPath);
    expect(downloaded.toString()).toBe('hello world');
  });

  it('creates parent directories if they do not exist', async () => {
    const mockRead = createMockReadFn(Buffer.from('data'));
    const localPath = join(tempDir, 'nested', 'deep', 'file.txt');

    await downloadFileToLocal({
      readFromS3: mockRead,
      s3Key: 'file.txt',
      localPath,
    });

    const exists = await fs
      .stat(localPath)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(true);
  });
});

describe('downloadDirectoryToLocal', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'transfer-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('downloads all files in a directory', async () => {
    const mockClient = createMockClient([
      {
        Contents: [{ Key: 'src/file1.txt' }, { Key: 'src/file2.txt' }],
        NextContinuationToken: undefined,
      },
    ]);

    let readCount = 0;
    const mockRead = mock(async (key: string) => {
      readCount++;
      return Buffer.from(`content of ${key}`);
    });

    await downloadDirectoryToLocal({
      client: mockClient as any,
      bucket: 'bucket',
      readFromS3: mockRead,
      s3Prefix: 'src/',
      localPath: tempDir,
    });

    expect(readCount).toBe(2);

    const file1 = await fs.readFile(join(tempDir, 'file1.txt'), 'utf8');
    expect(file1).toBe('content of src/file1.txt');

    const file2 = await fs.readFile(join(tempDir, 'file2.txt'), 'utf8');
    expect(file2).toBe('content of src/file2.txt');
  });

  it('reports progress during download', async () => {
    const mockClient = createMockClient([
      {
        Contents: [{ Key: 'dir/a.txt' }, { Key: 'dir/b.txt' }],
        NextContinuationToken: undefined,
      },
    ]);

    const mockRead = createMockReadFn(Buffer.from('data'));
    const progressCalls: [number, number, string][] = [];

    await downloadDirectoryToLocal({
      client: mockClient as any,
      bucket: 'bucket',
      readFromS3: mockRead,
      s3Prefix: 'dir/',
      localPath: tempDir,
      onProgress: (transferred, total, file) => {
        progressCalls.push([transferred, total, file]);
      },
    });

    expect(progressCalls).toEqual([
      [1, 2, 'dir/a.txt'],
      [2, 2, 'dir/b.txt'],
    ]);
  });

  it('handles empty directory', async () => {
    const mockClient = createMockClient([
      {
        Contents: [],
        NextContinuationToken: undefined,
      },
    ]);

    const mockRead = createMockReadFn();

    await downloadDirectoryToLocal({
      client: mockClient as any,
      bucket: 'bucket',
      readFromS3: mockRead,
      s3Prefix: 'empty/',
      localPath: tempDir,
    });

    expect(mockRead).toHaveBeenCalledTimes(0);
  });
});

describe('uploadFileToS3', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'transfer-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('uploads a small file to S3', async () => {
    const localPath = join(tempDir, 'upload.txt');
    await fs.writeFile(localPath, 'upload content');

    const mockClient = createMockClient([{}]);

    await uploadFileToS3({
      client: mockClient as any,
      bucket: 'bucket',
      localPath,
      s3Key: 'uploaded.txt',
    });

    expect(mockClient.send).toHaveBeenCalledTimes(1);
  });

  it('reports progress during upload', async () => {
    const localPath = join(tempDir, 'file.txt');
    await fs.writeFile(localPath, 'test');

    const mockClient = createMockClient([{}]);
    const progressCalls: string[] = [];

    await uploadFileToS3({
      client: mockClient as any,
      bucket: 'bucket',
      localPath,
      s3Key: 'file.txt',
      options: {
        onProgress: info => {
          progressCalls.push(info.operation);
        },
      },
    });

    expect(progressCalls).toContain('Uploading file');
    expect(progressCalls).toContain('Uploaded file');
  });
});

describe('uploadDirectoryToS3', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'transfer-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('uploads all files in a directory', async () => {
    // Create test files
    await fs.writeFile(join(tempDir, 'file1.txt'), 'content1');
    await fs.writeFile(join(tempDir, 'file2.txt'), 'content2');

    const mockClient = createMockClient([{}, {}]);

    await uploadDirectoryToS3({
      client: mockClient as any,
      bucket: 'bucket',
      localPath: tempDir,
      s3Prefix: 'dest/',
    });

    expect(mockClient.send).toHaveBeenCalledTimes(2);
  });

  it('handles nested directories', async () => {
    // Create nested structure
    await fs.mkdir(join(tempDir, 'subdir'));
    await fs.writeFile(join(tempDir, 'root.txt'), 'root');
    await fs.writeFile(join(tempDir, 'subdir', 'nested.txt'), 'nested');

    const mockClient = createMockClient([{}, {}]);

    await uploadDirectoryToS3({
      client: mockClient as any,
      bucket: 'bucket',
      localPath: tempDir,
      s3Prefix: 'upload/',
    });

    expect(mockClient.send).toHaveBeenCalledTimes(2);
  });

  it('reports progress during upload', async () => {
    await fs.writeFile(join(tempDir, 'a.txt'), 'a');
    await fs.writeFile(join(tempDir, 'b.txt'), 'b');

    const mockClient = createMockClient([{}, {}]);
    const progressCalls: [number, number][] = [];

    await uploadDirectoryToS3({
      client: mockClient as any,
      bucket: 'bucket',
      localPath: tempDir,
      s3Prefix: 'dest/',
      onProgress: (transferred, total) => {
        progressCalls.push([transferred, total]);
      },
    });

    expect(progressCalls.length).toBe(2);
    expect(progressCalls[progressCalls.length - 1]).toEqual([2, 2]);
  });

  it('handles empty directory', async () => {
    const mockClient = createMockClient([]);

    await uploadDirectoryToS3({
      client: mockClient as any,
      bucket: 'bucket',
      localPath: tempDir,
      s3Prefix: 'empty/',
    });

    expect(mockClient.send).toHaveBeenCalledTimes(0);
  });
});
