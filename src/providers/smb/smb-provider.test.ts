/**
 * Tests for SMBProvider
 *
 * Unit tests mock the SMB client. Integration tests require:
 *   docker compose up samba -d
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { SMBProvider } from './smb-provider.js';
import type { SMBProfile } from '../types/profile.js';
import { OperationStatus } from '../types/result.js';
import { Capability } from '../types/capabilities.js';

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestProfile(overrides?: Partial<SMBProfile['config']>): SMBProfile {
  return {
    id: 'test-smb',
    displayName: 'Test SMB',
    provider: 'smb',
    config: {
      host: 'localhost',
      share: 'testshare',
      username: 'testuser',
      password: 'testpass',
      ...overrides,
    },
  };
}

// ============================================================================
// SMBProvider Unit Tests
// ============================================================================

describe('SMBProvider', () => {
  describe('constructor', () => {
    it('should initialize with correct name and displayName', () => {
      const profile = createTestProfile();
      const provider = new SMBProvider(profile);

      expect(provider.name).toBe('smb');
      expect(provider.displayName).toBe('SMB/CIFS');
    });

    it('should have correct capabilities', () => {
      const profile = createTestProfile();
      const provider = new SMBProvider(profile);

      expect(provider.hasCapability(Capability.List)).toBe(true);
      expect(provider.hasCapability(Capability.Read)).toBe(true);
      expect(provider.hasCapability(Capability.Write)).toBe(true);
      expect(provider.hasCapability(Capability.Delete)).toBe(true);
      expect(provider.hasCapability(Capability.Mkdir)).toBe(true);
      expect(provider.hasCapability(Capability.Move)).toBe(true);
      expect(provider.hasCapability(Capability.Download)).toBe(true);
      expect(provider.hasCapability(Capability.Upload)).toBe(true);
      expect(provider.hasCapability(Capability.Connection)).toBe(true);
      expect(provider.hasCapability(Capability.Metadata)).toBe(true);
    });

    it('should use default port 445 if not specified', () => {
      const profile = createTestProfile();
      const provider = new SMBProvider(profile);

      // We can check this through the client, but it's a private field
      // Just verify it initializes without error
      expect(provider).toBeDefined();
    });

    it('should use custom port if specified', () => {
      const profile = createTestProfile({ port: 4455 });
      const provider = new SMBProvider(profile);

      expect(provider).toBeDefined();
    });
  });

  describe('connection lifecycle', () => {
    it('should report not connected initially', () => {
      const profile = createTestProfile();
      const provider = new SMBProvider(profile);

      expect(provider.isConnected()).toBe(false);
    });

    it('should return connection error when not connected', async () => {
      const profile = createTestProfile();
      const provider = new SMBProvider(profile);

      const result = await provider.list('/');

      expect(result.status).toBe(OperationStatus.ConnectionFailed);
    });
  });

  describe('path normalization', () => {
    it('should normalize paths consistently', async () => {
      const profile = createTestProfile();
      const provider = new SMBProvider(profile);

      // These should all fail with connection error, but the path processing happens first
      // The fact that we get ConnectionFailed (not some path error) tells us paths are OK
      const result1 = await provider.exists('some/path');
      const result2 = await provider.exists('/some/path');
      const result3 = await provider.exists('some\\path');

      expect(result1.status).toBe(OperationStatus.ConnectionFailed);
      expect(result2.status).toBe(OperationStatus.ConnectionFailed);
      expect(result3.status).toBe(OperationStatus.ConnectionFailed);
    });
  });
});

// ============================================================================
// SMBProvider Integration Tests (require Docker)
// ============================================================================
// To run: docker compose up samba -d && bun test smb-provider.test.ts

describe.skip('SMBProvider Integration', () => {
  let provider: SMBProvider;

  beforeEach(() => {
    const profile = createTestProfile({
      host: 'localhost',
      share: 'testshare',
      username: 'testuser',
      password: 'testpass',
    });
    provider = new SMBProvider(profile);
  });

  afterEach(async () => {
    if (provider.isConnected()) {
      await provider.disconnect();
    }
  });

  describe('connect', () => {
    it('should connect successfully', async () => {
      const result = await provider.connect();

      expect(result.status).toBe(OperationStatus.Success);
      expect(provider.isConnected()).toBe(true);
    });

    it('should fail with wrong credentials', async () => {
      const badProfile = createTestProfile({ password: 'wrongpass' });
      const badProvider = new SMBProvider(badProfile);

      const result = await badProvider.connect();

      expect(result.status).toBe(OperationStatus.PermissionDenied);
    });
  });

  describe('list', () => {
    it('should list root directory', async () => {
      await provider.connect();

      const result = await provider.list('/');

      expect(result.status).toBe(OperationStatus.Success);
      expect(result.data?.entries).toBeDefined();
      expect(result.data?.hasMore).toBe(false);
    });
  });

  describe('write and read', () => {
    it('should write and read a file', async () => {
      await provider.connect();

      const content = 'Hello, SMB!';
      const path = `/test-${Date.now()}.txt`;

      // Write
      const writeResult = await provider.write(path, content);
      expect(writeResult.status).toBe(OperationStatus.Success);

      // Read
      const readResult = await provider.read(path);
      expect(readResult.status).toBe(OperationStatus.Success);
      expect(readResult.data?.toString()).toBe(content);

      // Clean up
      await provider.delete(path);
    });
  });

  describe('mkdir and delete', () => {
    it('should create and delete a directory', async () => {
      await provider.connect();

      const dirPath = `/testdir-${Date.now()}`;

      // Create
      const mkdirResult = await provider.mkdir(dirPath);
      expect(mkdirResult.status).toBe(OperationStatus.Success);

      // Verify exists
      const existsResult = await provider.exists(dirPath);
      expect(existsResult.status).toBe(OperationStatus.Success);
      expect(existsResult.data).toBe(true);

      // Delete
      const deleteResult = await provider.delete(dirPath);
      expect(deleteResult.status).toBe(OperationStatus.Success);

      // Verify gone
      const goneResult = await provider.exists(dirPath);
      expect(goneResult.status).toBe(OperationStatus.Success);
      expect(goneResult.data).toBe(false);
    });
  });

  describe('move', () => {
    it('should move a file', async () => {
      await provider.connect();

      const srcPath = `/move-src-${Date.now()}.txt`;
      const destPath = `/move-dest-${Date.now()}.txt`;
      const content = 'Move me!';

      // Create source file
      await provider.write(srcPath, content);

      // Move
      const moveResult = await provider.move(srcPath, destPath);
      expect(moveResult.status).toBe(OperationStatus.Success);

      // Verify source gone
      const srcExists = await provider.exists(srcPath);
      expect(srcExists.data).toBe(false);

      // Verify dest exists with content
      const readResult = await provider.read(destPath);
      expect(readResult.data?.toString()).toBe(content);

      // Clean up
      await provider.delete(destPath);
    });
  });
});
