/**
 * Unit tests for S3Adapter copy method enhancements
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { S3Adapter, S3AdapterConfig } from './s3-adapter.js';
import { EntryType } from '../types/entry.js';
import {
  S3Client,
  ListObjectsV2Command,
  CopyObjectCommand,
  ListObjectsV2CommandOutput,
} from '@aws-sdk/client-s3';

// Mock command classes with proper constructors
class MockListObjectsV2Command {
  constructor(public params: any) {}
}

class MockCopyObjectCommand {
  constructor(public params: any) {}
}

class MockHeadObjectCommand {
  constructor(public params: any) {}
}

class MockPutObjectCommand {
  constructor(public params: any) {}
}

class MockDeleteObjectCommand {
  constructor(public params: any) {}
}

class MockGetObjectCommand {
  constructor(public params: any) {}
}

class MockCreateBucketCommand {
  constructor(public params: any) {}
}

class MockDeleteBucketCommand {
  constructor(public params: any) {}
}

// Track all commands sent
let commandsSent: any[] = [];

// Mock the AWS SDK
const mockSend = mock(async (command: any) => {
  commandsSent.push(command);
  if (command.constructor.name === 'MockListObjectsV2Command') {
    return (mockSend as any).mockListResponse || { Contents: [], $metadata: {} };
  }
  return {};
});

const mockClient = {
  send: mockSend,
} as any;

// Mock S3Client constructor
mock.module('@aws-sdk/client-s3', () => ({
  S3Client: mock(() => mockClient),
  ListObjectsV2Command: MockListObjectsV2Command,
  CopyObjectCommand: MockCopyObjectCommand,
  HeadObjectCommand: MockHeadObjectCommand,
  PutObjectCommand: MockPutObjectCommand,
  DeleteObjectCommand: MockDeleteObjectCommand,
  GetObjectCommand: MockGetObjectCommand,
  CreateBucketCommand: MockCreateBucketCommand,
  DeleteBucketCommand: MockDeleteBucketCommand,
}));

describe('S3Adapter copy enhancements', () => {
  let adapter: S3Adapter;
  const config: S3AdapterConfig = {
    region: 'us-east-1',
    bucket: 'test-bucket',
    accessKeyId: 'test',
    secretAccessKey: 'test',
  };

  beforeEach(() => {
    adapter = new S3Adapter(config);
    commandsSent = [];
    mockSend.mockClear();
  });

  describe('copy single file', () => {
    it('should copy file within same bucket', async () => {
      await adapter.copy('source.txt', 'dest.txt');

      expect(commandsSent).toHaveLength(1);
      const command = commandsSent[0];
      expect(command.constructor.name).toBe('MockCopyObjectCommand');
      expect(command.params.Bucket).toBe('test-bucket');
      expect(command.params.CopySource).toBe('test-bucket/source.txt');
      expect(command.params.Key).toBe('dest.txt');
      expect(command.params.MetadataDirective).toBe('COPY');
    });

    it('should copy file to different bucket', async () => {
      await adapter.copy('source.txt', 'dest.txt', 'target-bucket');

      expect(commandsSent).toHaveLength(1);
      const command = commandsSent[0];
      expect(command.params.Bucket).toBe('target-bucket');
      expect(command.params.CopySource).toBe('test-bucket/source.txt');
      expect(command.params.Key).toBe('dest.txt');
    });
  });

  describe('copy directory', () => {
    it('should copy directory recursively within same bucket', async () => {
      // Store the mock response on the mockSend function
      (mockSend as any).mockListResponse = {
        Contents: [
          { Key: 'source-dir/' },
          { Key: 'source-dir/file1.txt' },
          { Key: 'source-dir/file2.txt' },
          { Key: 'source-dir/subdir/file3.txt' },
        ],
      };

      await adapter.copy('source-dir/', 'dest-dir/');

      // Should have 1 list call + 3 copy calls (excluding directory marker)
      expect(commandsSent).toHaveLength(4);

      // Check the copy calls
      const copyCommands = commandsSent
        .filter((cmd: any) => cmd.constructor.name === 'MockCopyObjectCommand')
        .map((cmd: any) => cmd.params);

      expect(copyCommands).toHaveLength(3);
      expect(copyCommands[0].CopySource).toBe('test-bucket/source-dir/file1.txt');
      expect(copyCommands[0].Key).toBe('dest-dir/file1.txt');
      expect(copyCommands[1].CopySource).toBe('test-bucket/source-dir/file2.txt');
      expect(copyCommands[1].Key).toBe('dest-dir/file2.txt');
      expect(copyCommands[2].CopySource).toBe('test-bucket/source-dir/subdir/file3.txt');
      expect(copyCommands[2].Key).toBe('dest-dir/subdir/file3.txt');
    });

    it('should copy directory recursively to different bucket', async () => {
      (mockSend as any).mockListResponse = {
        Contents: [{ Key: 'source-dir/' }, { Key: 'source-dir/file1.txt' }],
      };

      await adapter.copy('source-dir/', 'dest-dir/', 'target-bucket');

      const copyCommands = commandsSent
        .filter((cmd: any) => cmd.constructor.name === 'MockCopyObjectCommand')
        .map((cmd: any) => cmd.params);

      expect(copyCommands[0].Bucket).toBe('target-bucket');
      expect(copyCommands[0].CopySource).toBe('test-bucket/source-dir/file1.txt');
      expect(copyCommands[0].Key).toBe('dest-dir/file1.txt');
    });
  });
});
