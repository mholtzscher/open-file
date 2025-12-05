/**
 * Tests for S3 Multipart Upload
 */

import { describe, it, expect, mock } from 'bun:test';
import type { S3Client } from '@aws-sdk/client-s3';
import type { ProgressEvent } from '../../../types/progress.js';
import {
  shouldUseMultipartUpload,
  MULTIPART_THRESHOLD,
  PART_SIZE,
  uploadLargeFile,
  abortMultipartUpload,
} from './multipart-upload.js';

// Type for command object in mock
interface MockCommand {
  constructor: { name: string };
  input: { PartNumber?: number; Bucket?: string; Key?: string; UploadId?: string };
}

describe('S3 Multipart Upload', () => {
  describe('constants', () => {
    it('should have MULTIPART_THRESHOLD of 5MB', () => {
      expect(MULTIPART_THRESHOLD).toBe(5 * 1024 * 1024);
    });

    it('should have PART_SIZE of 5MB', () => {
      expect(PART_SIZE).toBe(5 * 1024 * 1024);
    });
  });

  describe('shouldUseMultipartUpload', () => {
    it('should return false for files smaller than threshold', () => {
      expect(shouldUseMultipartUpload(1024)).toBe(false); // 1KB
      expect(shouldUseMultipartUpload(1024 * 1024)).toBe(false); // 1MB
      expect(shouldUseMultipartUpload(MULTIPART_THRESHOLD - 1)).toBe(false);
    });

    it('should return false for files exactly at threshold', () => {
      expect(shouldUseMultipartUpload(MULTIPART_THRESHOLD)).toBe(false);
    });

    it('should return true for files larger than threshold', () => {
      expect(shouldUseMultipartUpload(MULTIPART_THRESHOLD + 1)).toBe(true);
      expect(shouldUseMultipartUpload(10 * 1024 * 1024)).toBe(true); // 10MB
      expect(shouldUseMultipartUpload(100 * 1024 * 1024)).toBe(true); // 100MB
    });

    it('should return false for zero-size files', () => {
      expect(shouldUseMultipartUpload(0)).toBe(false);
    });
  });

  describe('uploadLargeFile', () => {
    it('should call S3 multipart upload APIs in correct order', async () => {
      // Track call order
      const callOrder: string[] = [];

      // Mock S3Client
      const mockClient = {
        send: mock((command: MockCommand) => {
          const commandName = command.constructor.name;
          callOrder.push(commandName);

          if (commandName === 'CreateMultipartUploadCommand') {
            return Promise.resolve({ UploadId: 'test-upload-id' });
          }
          if (commandName === 'UploadPartCommand') {
            return Promise.resolve({ ETag: `"etag-${command.input.PartNumber}"` });
          }
          if (commandName === 'CompleteMultipartUploadCommand') {
            return Promise.resolve({});
          }
          return Promise.resolve({});
        }),
      } as unknown as S3Client;

      // Create a buffer just over threshold (6MB)
      const buffer = Buffer.alloc(6 * 1024 * 1024);

      await uploadLargeFile(mockClient, 'test-bucket', 'test-key', buffer);

      // Verify call order
      expect(callOrder[0]).toBe('CreateMultipartUploadCommand');
      expect(callOrder.filter(c => c === 'UploadPartCommand').length).toBe(2); // 6MB = 2 parts of 5MB
      expect(callOrder[callOrder.length - 1]).toBe('CompleteMultipartUploadCommand');
    });

    it('should report progress during upload', async () => {
      const progressEvents: ProgressEvent[] = [];

      const mockClient = {
        send: mock((command: MockCommand) => {
          const commandName = command.constructor.name;
          if (commandName === 'CreateMultipartUploadCommand') {
            return Promise.resolve({ UploadId: 'test-upload-id' });
          }
          if (commandName === 'UploadPartCommand') {
            return Promise.resolve({ ETag: '"test-etag"' });
          }
          return Promise.resolve({});
        }),
      } as unknown as S3Client;

      const buffer = Buffer.alloc(6 * 1024 * 1024);

      await uploadLargeFile(mockClient, 'test-bucket', 'test-key', buffer, {
        onProgress: event => progressEvents.push(event),
      });

      // Should have progress events for each part
      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[0].operation).toBe('Uploading file');
      expect(progressEvents[0].currentFile).toBe('test-key');

      // Last event should show 100% or close to it
      const lastEvent = progressEvents[progressEvents.length - 1];
      expect(lastEvent.bytesTransferred).toBe(buffer.length);
    });

    it('should abort upload on error', async () => {
      let abortCalled = false;

      const mockClient = {
        send: mock((command: MockCommand) => {
          const commandName = command.constructor.name;
          if (commandName === 'CreateMultipartUploadCommand') {
            return Promise.resolve({ UploadId: 'test-upload-id' });
          }
          if (commandName === 'UploadPartCommand') {
            return Promise.reject(new Error('Upload failed'));
          }
          if (commandName === 'AbortMultipartUploadCommand') {
            abortCalled = true;
            return Promise.resolve({});
          }
          return Promise.resolve({});
        }),
      } as unknown as S3Client;

      const buffer = Buffer.alloc(6 * 1024 * 1024);

      try {
        await uploadLargeFile(mockClient, 'test-bucket', 'test-key', buffer);
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toContain('Upload failed');
      }

      expect(abortCalled).toBe(true);
    });

    it('should throw if CreateMultipartUpload returns no UploadId', async () => {
      const mockClient = {
        send: mock(() => Promise.resolve({})), // No UploadId
      } as unknown as S3Client;

      const buffer = Buffer.alloc(6 * 1024 * 1024);

      try {
        await uploadLargeFile(mockClient, 'test-bucket', 'test-key', buffer);
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toContain('no UploadId');
      }
    });

    it('should calculate correct number of parts', async () => {
      const partNumbers: number[] = [];

      const mockClient = {
        send: mock((command: MockCommand) => {
          const commandName = command.constructor.name;
          if (commandName === 'CreateMultipartUploadCommand') {
            return Promise.resolve({ UploadId: 'test-upload-id' });
          }
          if (commandName === 'UploadPartCommand') {
            partNumbers.push(command.input.PartNumber as number);
            return Promise.resolve({ ETag: '"test-etag"' });
          }
          return Promise.resolve({});
        }),
      } as unknown as S3Client;

      // 12MB = 3 parts (5MB + 5MB + 2MB)
      const buffer = Buffer.alloc(12 * 1024 * 1024);

      await uploadLargeFile(mockClient, 'test-bucket', 'test-key', buffer);

      expect(partNumbers).toEqual([1, 2, 3]);
    });
  });

  describe('abortMultipartUpload', () => {
    it('should send AbortMultipartUploadCommand', async () => {
      let abortCommand: MockCommand | null = null;

      const mockClient = {
        send: mock((command: MockCommand) => {
          abortCommand = command;
          return Promise.resolve({});
        }),
      } as unknown as S3Client;

      await abortMultipartUpload(mockClient, 'test-bucket', 'test-key', 'upload-123');

      expect(abortCommand).not.toBeNull();
      expect(abortCommand!.input.Bucket).toBe('test-bucket');
      expect(abortCommand!.input.Key).toBe('test-key');
      expect(abortCommand!.input.UploadId).toBe('upload-123');
    });

    it('should not throw on abort failure', async () => {
      const mockClient = {
        send: mock(() => Promise.reject(new Error('Abort failed'))),
      } as unknown as S3Client;

      // Should not throw - if it throws, the test will fail
      const result = await abortMultipartUpload(
        mockClient,
        'test-bucket',
        'test-key',
        'upload-123'
      );
      expect(result).toBeUndefined();
    });
  });
});
