/**
 * SMBProvider Integration Tests
 *
 * These tests require a running Samba server:
 *   docker compose up samba -d
 *   docker exec open-file-samba /bin/bash /etc/samba-init.sh
 *
 * Run with: bun test smb-provider.integration.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'bun:test';
import { SMBProvider } from './smb-provider.js';
import type { SMBProfile } from '../types/profile.js';
import { OperationStatus } from '../types/result.js';
import { EntryType } from '../../types/entry.js';

// ============================================================================
// Test Configuration
// ============================================================================

const SMB_CONFIG = {
  host: 'localhost',
  share: 'testshare',
  username: 'testuser',
  password: 'testpass',
  port: 445,
};

function createTestProfile(overrides?: Partial<SMBProfile['config']>): SMBProfile {
  return {
    id: 'test-smb-integration',
    displayName: 'Test SMB Integration',
    provider: 'smb',
    config: {
      ...SMB_CONFIG,
      ...overrides,
    },
  };
}

// ============================================================================
// Integration Tests
// ============================================================================

describe('SMBProvider Integration', () => {
  let provider: SMBProvider;

  beforeAll(() => {
    // Check if SMB server is available
    // This will be checked in the first test
  });

  beforeEach(() => {
    const profile = createTestProfile();
    provider = new SMBProvider(profile);
  });

  afterEach(async () => {
    if (provider?.isConnected()) {
      await provider.disconnect();
    }
  });

  describe('connect', () => {
    it('should connect to Samba server', async () => {
      const result = await provider.connect();

      if (result.status !== OperationStatus.Success) {
        console.log('Connection result:', result);
        // Skip test if server not available (connection failed or generic error)
        if (
          result.status === OperationStatus.ConnectionFailed ||
          result.status === OperationStatus.Error
        ) {
          console.log('Skipping test - SMB server not available');
          console.log('Run: docker compose up samba -d');
          return;
        }
      }

      expect(result.status).toBe(OperationStatus.Success);
      expect(provider.isConnected()).toBe(true);
    });

    it('should fail with wrong password', async () => {
      // First check if server is available
      const checkResult = await provider.connect();
      if (
        checkResult.status === OperationStatus.ConnectionFailed ||
        checkResult.status === OperationStatus.Error
      ) {
        console.log('Skipping test - SMB server not available');
        return;
      }
      await provider.disconnect();

      const badProfile = createTestProfile({ password: 'wrongpassword' });
      const badProvider = new SMBProvider(badProfile);

      const result = await badProvider.connect();

      // Either connection failed or permission denied is acceptable
      expect([OperationStatus.ConnectionFailed, OperationStatus.PermissionDenied]).toContain(
        result.status
      );
    });

    it('should fail with wrong share name', async () => {
      const badProfile = createTestProfile({ share: 'nonexistent' });
      const badProvider = new SMBProvider(badProfile);

      const result = await badProvider.connect();

      expect(result.status).not.toBe(OperationStatus.Success);
    });
  });

  describe('list', () => {
    it('should list root directory with test files', async () => {
      const connectResult = await provider.connect();
      if (connectResult.status !== OperationStatus.Success) {
        console.log('Skipping test - SMB server not available');
        return;
      }

      const result = await provider.list('/');

      expect(result.status).toBe(OperationStatus.Success);
      expect(result.data?.entries).toBeDefined();
      expect(result.data!.entries.length).toBeGreaterThan(0);

      // Check for expected test files from init script
      const names = result.data!.entries.map(e => e.name);
      expect(names).toContain('hello.txt');
      expect(names).toContain('documents');
    });

    it('should list subdirectory', async () => {
      const connectResult = await provider.connect();
      if (connectResult.status !== OperationStatus.Success) return;

      const result = await provider.list('/documents');

      expect(result.status).toBe(OperationStatus.Success);
      expect(result.data?.entries).toBeDefined();

      const names = result.data!.entries.map(e => e.name);
      expect(names).toContain('readme.txt');
    });

    it('should return not found for non-existent directory', async () => {
      const connectResult = await provider.connect();
      if (connectResult.status !== OperationStatus.Success) return;

      const result = await provider.list('/nonexistent-dir-12345');

      expect(result.status).toBe(OperationStatus.NotFound);
    });
  });

  describe('read', () => {
    it('should read existing file', async () => {
      const connectResult = await provider.connect();
      if (connectResult.status !== OperationStatus.Success) return;

      const result = await provider.read('/hello.txt');

      expect(result.status).toBe(OperationStatus.Success);
      expect(result.data).toBeDefined();
      expect(result.data!.toString()).toContain('Hello');
    });

    it('should return not found for non-existent file', async () => {
      const connectResult = await provider.connect();
      if (connectResult.status !== OperationStatus.Success) return;

      const result = await provider.read('/nonexistent-file-12345.txt');

      expect(result.status).toBe(OperationStatus.NotFound);
    });
  });

  describe('getMetadata', () => {
    it('should get metadata for file', async () => {
      const connectResult = await provider.connect();
      if (connectResult.status !== OperationStatus.Success) return;

      const result = await provider.getMetadata('/hello.txt');

      expect(result.status).toBe(OperationStatus.Success);
      expect(result.data).toBeDefined();
      expect(result.data!.name).toBe('hello.txt');
      expect(result.data!.type).toBe(EntryType.File);
      expect(result.data!.size).toBeGreaterThan(0);
      expect(result.data!.modified).toBeDefined();
    });

    it('should get metadata for directory', async () => {
      const connectResult = await provider.connect();
      if (connectResult.status !== OperationStatus.Success) return;

      const result = await provider.getMetadata('/documents');

      expect(result.status).toBe(OperationStatus.Success);
      expect(result.data).toBeDefined();
      expect(result.data!.name).toBe('documents');
      expect(result.data!.type).toBe(EntryType.Directory);
    });
  });

  describe('write and delete', () => {
    it('should write a new file and delete it', async () => {
      const connectResult = await provider.connect();
      if (connectResult.status !== OperationStatus.Success) return;

      const testPath = `/test-write-${Date.now()}.txt`;
      const content = 'Test content from integration test';

      // Write
      const writeResult = await provider.write(testPath, content);
      expect(writeResult.status).toBe(OperationStatus.Success);

      // Read back to verify it exists
      const readResult = await provider.read(testPath);
      expect(readResult.status).toBe(OperationStatus.Success);
      expect(readResult.data!.toString()).toBe(content);

      // Delete
      const deleteResult = await provider.delete(testPath);
      expect(deleteResult.status).toBe(OperationStatus.Success);

      // Verify it's gone by trying to read
      const goneResult = await provider.read(testPath);
      expect(goneResult.status).toBe(OperationStatus.NotFound);
    });

    it('should write file with nested path and auto-create parent dirs', async () => {
      const connectResult = await provider.connect();
      if (connectResult.status !== OperationStatus.Success) return;

      const testDir = `/test-nested-${Date.now()}`;
      const testPath = `${testDir}/subdir/file.txt`;
      const content = 'Nested file content';

      // Write (should create parent directories)
      const writeResult = await provider.write(testPath, content);
      expect(writeResult.status).toBe(OperationStatus.Success);

      // Read back
      const readResult = await provider.read(testPath);
      expect(readResult.data!.toString()).toBe(content);

      // Clean up (recursive delete)
      const deleteResult = await provider.delete(testDir, { recursive: true });
      expect(deleteResult.status).toBe(OperationStatus.Success);
    });
  });

  describe('mkdir', () => {
    it('should create a directory', async () => {
      const connectResult = await provider.connect();
      if (connectResult.status !== OperationStatus.Success) return;

      const testDir = `/test-mkdir-${Date.now()}`;

      // Create
      const mkdirResult = await provider.mkdir(testDir);
      expect(mkdirResult.status).toBe(OperationStatus.Success);

      // Verify by getting metadata
      const metaResult = await provider.getMetadata(testDir);
      expect(metaResult.status).toBe(OperationStatus.Success);
      expect(metaResult.data!.type).toBe(EntryType.Directory);

      // Clean up
      await provider.delete(testDir);
    });
  });

  describe('move', () => {
    it('should move/rename a file', async () => {
      const connectResult = await provider.connect();
      if (connectResult.status !== OperationStatus.Success) return;

      const srcPath = `/test-move-src-${Date.now()}.txt`;
      const destPath = `/test-move-dest-${Date.now()}.txt`;
      const content = 'Content to move';

      // Create source file
      await provider.write(srcPath, content);

      // Move
      const moveResult = await provider.move(srcPath, destPath);
      expect(moveResult.status).toBe(OperationStatus.Success);

      // Verify source is gone by trying to read
      const srcRead = await provider.read(srcPath);
      expect(srcRead.status).toBe(OperationStatus.NotFound);

      // Verify dest exists with correct content
      const readResult = await provider.read(destPath);
      expect(readResult.status).toBe(OperationStatus.Success);
      expect(readResult.data!.toString()).toBe(content);

      // Clean up
      await provider.delete(destPath);
    });
  });

  describe('disconnect', () => {
    it('should disconnect cleanly', async () => {
      const connectResult = await provider.connect();
      if (connectResult.status !== OperationStatus.Success) return;

      expect(provider.isConnected()).toBe(true);

      await provider.disconnect();

      expect(provider.isConnected()).toBe(false);
    });

    it('should fail operations after disconnect', async () => {
      const connectResult = await provider.connect();
      if (connectResult.status !== OperationStatus.Success) return;

      await provider.disconnect();

      const result = await provider.list('/');
      expect(result.status).toBe(OperationStatus.ConnectionFailed);
    });
  });
});
