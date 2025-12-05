/**
 * Tests for MockStorageProvider
 *
 * Verifies that the mock provider correctly implements
 * provider behavior for use in testing.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { MockStorageProvider } from './mock-provider.js';
import { Capability, OperationStatus, Result } from '../types/index.js';
import {
  expectSuccess,
  expectSuccessWithData,
  expectNotFound,
  expectUnimplemented,
} from './test-utils.js';
import { SAMPLE_TEXT_CONTENT } from './fixtures.js';

describe('MockStorageProvider', () => {
  let provider: MockStorageProvider;

  beforeEach(() => {
    provider = new MockStorageProvider({
      initialData: {
        directories: ['/test-bucket/', '/test-bucket/docs/'],
        files: [
          { path: '/test-bucket/readme.txt', content: SAMPLE_TEXT_CONTENT },
          { path: '/test-bucket/docs/guide.md', content: '# Guide' },
        ],
      },
    });
  });

  describe('capabilities', () => {
    test('should have default capabilities', () => {
      const caps = provider.getCapabilities();
      expect(caps.has(Capability.List)).toBe(true);
      expect(caps.has(Capability.Read)).toBe(true);
      expect(caps.has(Capability.Write)).toBe(true);
      expect(caps.has(Capability.Delete)).toBe(true);
    });

    test('should support capability checking', () => {
      expect(provider.hasCapability(Capability.List)).toBe(true);
      expect(provider.hasCapability(Capability.Versioning)).toBe(false);
    });

    test('should allow adding/removing capabilities', () => {
      provider.addCapability(Capability.Versioning);
      expect(provider.hasCapability(Capability.Versioning)).toBe(true);

      provider.removeCapability(Capability.Versioning);
      expect(provider.hasCapability(Capability.Versioning)).toBe(false);
    });

    test('should support custom capabilities on creation', () => {
      const limited = new MockStorageProvider({
        capabilities: [Capability.List, Capability.Read],
      });

      expect(limited.hasCapability(Capability.List)).toBe(true);
      expect(limited.hasCapability(Capability.Read)).toBe(true);
      expect(limited.hasCapability(Capability.Write)).toBe(false);
    });
  });

  describe('connection lifecycle', () => {
    test('should be connected by default', () => {
      expect(provider.isConnected()).toBe(true);
    });

    test('should support connect/disconnect', async () => {
      await provider.disconnect();
      expect(provider.isConnected()).toBe(false);

      const result = await provider.connect();
      expectSuccess(result);
      expect(provider.isConnected()).toBe(true);
    });
  });

  describe('list', () => {
    test('should list directory contents', async () => {
      const result = await provider.list('/test-bucket/');
      expectSuccess(result);

      const { entries } = expectSuccessWithData(result);
      expect(entries.length).toBe(2); // docs/ and readme.txt
    });

    test('should return hasMore=false when no pagination', async () => {
      const result = await provider.list('/test-bucket/');
      const data = expectSuccessWithData(result);
      expect(data.hasMore).toBe(false);
    });
  });

  describe('read', () => {
    test('should read file content', async () => {
      const result = await provider.read('/test-bucket/readme.txt');
      expectSuccess(result);

      const content = expectSuccessWithData(result);
      expect(content.toString()).toBe(SAMPLE_TEXT_CONTENT);
    });

    test('should return not found for missing files', async () => {
      const result = await provider.read('/test-bucket/nonexistent.txt');
      expectNotFound(result);
    });
  });

  describe('write', () => {
    test('should write new file', async () => {
      const result = await provider.write('/test-bucket/new-file.txt', 'new content');
      expectSuccess(result);

      // Verify file exists
      const readResult = await provider.read('/test-bucket/new-file.txt');
      const content = expectSuccessWithData(readResult);
      expect(content.toString()).toBe('new content');
    });

    test('should overwrite existing file', async () => {
      await provider.write('/test-bucket/readme.txt', 'updated content');

      const result = await provider.read('/test-bucket/readme.txt');
      const content = expectSuccessWithData(result);
      expect(content.toString()).toBe('updated content');
    });
  });

  describe('delete', () => {
    test('should delete file', async () => {
      const result = await provider.delete('/test-bucket/readme.txt');
      expectSuccess(result);

      const existsResult = await provider.exists('/test-bucket/readme.txt');
      expect(expectSuccessWithData(existsResult)).toBe(false);
    });

    test('should return not found for missing files', async () => {
      const result = await provider.delete('/test-bucket/nonexistent.txt');
      expectNotFound(result);
    });
  });

  describe('mkdir', () => {
    test('should create directory', async () => {
      const result = await provider.mkdir('/test-bucket/new-dir/');
      expectSuccess(result);

      const existsResult = await provider.exists('/test-bucket/new-dir/');
      expect(expectSuccessWithData(existsResult)).toBe(true);
    });
  });

  describe('copy', () => {
    test('should copy file', async () => {
      const result = await provider.copy('/test-bucket/readme.txt', '/test-bucket/readme-copy.txt');
      expectSuccess(result);

      // Original should still exist
      const originalExists = await provider.exists('/test-bucket/readme.txt');
      expect(expectSuccessWithData(originalExists)).toBe(true);

      // Copy should exist
      const copyExists = await provider.exists('/test-bucket/readme-copy.txt');
      expect(expectSuccessWithData(copyExists)).toBe(true);
    });
  });

  describe('move', () => {
    test('should move file', async () => {
      const result = await provider.move(
        '/test-bucket/readme.txt',
        '/test-bucket/readme-moved.txt'
      );
      expectSuccess(result);

      // Original should not exist
      const originalExists = await provider.exists('/test-bucket/readme.txt');
      expect(expectSuccessWithData(originalExists)).toBe(false);

      // New location should exist
      const newExists = await provider.exists('/test-bucket/readme-moved.txt');
      expect(expectSuccessWithData(newExists)).toBe(true);
    });
  });

  describe('containers', () => {
    test('should list containers', async () => {
      const result = await provider.listContainers();
      expectSuccess(result);

      const containers = expectSuccessWithData(result);
      expect(containers.length).toBeGreaterThan(0);
    });

    test('should set/get container', () => {
      expect(provider.getContainer()).toBeUndefined();

      provider.setContainer('my-bucket');
      expect(provider.getContainer()).toBe('my-bucket');
    });
  });

  describe('error simulation', () => {
    test('should simulate configured failures', async () => {
      provider.setOperationFailure('read', OperationStatus.PermissionDenied);

      const result = await provider.read('/test-bucket/readme.txt');
      expect(result.status).toBe(OperationStatus.PermissionDenied);
    });

    test('should clear failures', async () => {
      provider.setOperationFailure('read', OperationStatus.Error);
      provider.clearOperationFailures();

      const result = await provider.read('/test-bucket/readme.txt');
      expectSuccess(result);
    });
  });

  describe('unimplemented operations', () => {
    test('should return unimplemented for disabled capabilities', async () => {
      const limited = new MockStorageProvider({
        capabilities: [Capability.List, Capability.Read],
      });

      const writeResult = await limited.write('/test/file.txt', 'content');
      expectUnimplemented(writeResult);
    });
  });

  describe('reset', () => {
    test('should reset to initial state', async () => {
      // Modify state
      await provider.write('/test-bucket/new-file.txt', 'new');
      await provider.delete('/test-bucket/readme.txt');

      // Reset
      provider.reset();

      // Verify original state restored
      const readmeExists = await provider.exists('/test-bucket/readme.txt');
      expect(expectSuccessWithData(readmeExists)).toBe(true);

      const newFileExists = await provider.exists('/test-bucket/new-file.txt');
      expect(expectSuccessWithData(newFileExists)).toBe(false);
    });
  });
});

describe('Result factory', () => {
  test('success should create success result', () => {
    const result = Result.success('data');
    expect(result.status).toBe(OperationStatus.Success);
    expect(result.data).toBe('data');
  });

  test('notFound should create not found result', () => {
    const result = Result.notFound('/path');
    expect(result.status).toBe(OperationStatus.NotFound);
    expect(result.error?.code).toBe('NOT_FOUND');
  });

  test('unimplemented should create unimplemented result', () => {
    const result = Result.unimplemented('operation');
    expect(result.status).toBe(OperationStatus.Unimplemented);
    expect(result.error?.code).toBe('UNIMPLEMENTED');
  });

  test('connectionFailed should be retryable', () => {
    const result = Result.connectionFailed('error');
    expect(result.status).toBe(OperationStatus.ConnectionFailed);
    expect(result.error?.retryable).toBe(true);
  });
});
