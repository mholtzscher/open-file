/**
 * Tests for LocalProvider
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { LocalProvider } from './local-provider.js';
import type { LocalProfile } from '../types/profile.js';
import { OperationStatus } from '../types/result.js';
import { EntryType } from '../../types/entry.js';
import { Capability } from '../types/capabilities.js';

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestProfile(basePath: string): LocalProfile {
  return {
    id: 'test-local',
    displayName: 'Test Local',
    provider: 'local',
    config: {
      basePath,
    },
  };
}

// ============================================================================
// LocalProvider Tests
// ============================================================================

describe('LocalProvider', () => {
  let tempDir: string;
  let provider: LocalProvider;

  beforeEach(() => {
    // Create a unique temp directory for each test
    tempDir = join(
      tmpdir(),
      `open-file-local-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    mkdirSync(tempDir, { recursive: true });

    const profile = createTestProfile(tempDir);
    provider = new LocalProvider(profile);
  });

  afterEach(() => {
    // Clean up temp directory
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('constructor', () => {
    it('should initialize with correct name and displayName', () => {
      expect(provider.name).toBe('local');
      expect(provider.displayName).toBe('Local Filesystem');
    });

    it('should have correct capabilities', () => {
      expect(provider.hasCapability(Capability.List)).toBe(true);
      expect(provider.hasCapability(Capability.Read)).toBe(true);
      expect(provider.hasCapability(Capability.Write)).toBe(true);
      expect(provider.hasCapability(Capability.Delete)).toBe(true);
      expect(provider.hasCapability(Capability.Mkdir)).toBe(true);
      expect(provider.hasCapability(Capability.Copy)).toBe(true);
      expect(provider.hasCapability(Capability.Move)).toBe(true);
    });
  });

  describe('list', () => {
    it('should list empty directory', async () => {
      const result = await provider.list('/');

      expect(result.status).toBe(OperationStatus.Success);
      expect(result.data?.entries).toHaveLength(0);
      expect(result.data?.hasMore).toBe(false);
    });

    it('should list files and directories', async () => {
      // Create test files and directories
      writeFileSync(join(tempDir, 'file1.txt'), 'content1');
      writeFileSync(join(tempDir, 'file2.txt'), 'content2');
      mkdirSync(join(tempDir, 'subdir'));

      const result = await provider.list('/');

      expect(result.status).toBe(OperationStatus.Success);
      expect(result.data?.entries).toHaveLength(3);

      // Directories should come first
      const names = result.data?.entries.map(e => e.name);
      expect(names?.[0]).toBe('subdir');
      expect(names).toContain('file1.txt');
      expect(names).toContain('file2.txt');
    });

    it('should hide hidden files by default', async () => {
      writeFileSync(join(tempDir, '.hidden'), 'hidden');
      writeFileSync(join(tempDir, 'visible.txt'), 'visible');

      const result = await provider.list('/');

      expect(result.status).toBe(OperationStatus.Success);
      expect(result.data?.entries).toHaveLength(1);
      expect(result.data?.entries[0].name).toBe('visible.txt');
    });

    it('should show hidden files when includeHidden is true', async () => {
      writeFileSync(join(tempDir, '.hidden'), 'hidden');
      writeFileSync(join(tempDir, 'visible.txt'), 'visible');

      const result = await provider.list('/', { includeHidden: true });

      expect(result.status).toBe(OperationStatus.Success);
      expect(result.data?.entries).toHaveLength(2);
    });

    it('should return not found for non-existent path', async () => {
      const result = await provider.list('/nonexistent');

      expect(result.status).toBe(OperationStatus.NotFound);
    });
  });

  describe('read', () => {
    it('should read file contents', async () => {
      const content = 'Hello, World!';
      writeFileSync(join(tempDir, 'test.txt'), content);

      const result = await provider.read('/test.txt');

      expect(result.status).toBe(OperationStatus.Success);
      expect(result.data?.toString()).toBe(content);
    });

    it('should return not found for non-existent file', async () => {
      const result = await provider.read('/nonexistent.txt');

      expect(result.status).toBe(OperationStatus.NotFound);
    });

    it('should support partial reads', async () => {
      writeFileSync(join(tempDir, 'test.txt'), 'Hello, World!');

      const result = await provider.read('/test.txt', { offset: 7, length: 5 });

      expect(result.status).toBe(OperationStatus.Success);
      expect(result.data?.toString()).toBe('World');
    });
  });

  describe('write', () => {
    it('should write file contents', async () => {
      const content = 'New content';
      const result = await provider.write('/new-file.txt', content);

      expect(result.status).toBe(OperationStatus.Success);
      expect(existsSync(join(tempDir, 'new-file.txt'))).toBe(true);
    });

    it('should create parent directories', async () => {
      const result = await provider.write('/deep/nested/file.txt', 'content');

      expect(result.status).toBe(OperationStatus.Success);
      expect(existsSync(join(tempDir, 'deep', 'nested', 'file.txt'))).toBe(true);
    });

    it('should overwrite existing file', async () => {
      writeFileSync(join(tempDir, 'existing.txt'), 'old content');

      const result = await provider.write('/existing.txt', 'new content');

      expect(result.status).toBe(OperationStatus.Success);

      const readResult = await provider.read('/existing.txt');
      expect(readResult.data?.toString()).toBe('new content');
    });
  });

  describe('mkdir', () => {
    it('should create directory', async () => {
      const result = await provider.mkdir('/new-dir');

      expect(result.status).toBe(OperationStatus.Success);
      expect(existsSync(join(tempDir, 'new-dir'))).toBe(true);
    });

    it('should create nested directories', async () => {
      const result = await provider.mkdir('/a/b/c');

      expect(result.status).toBe(OperationStatus.Success);
      expect(existsSync(join(tempDir, 'a', 'b', 'c'))).toBe(true);
    });

    it('should return error if directory exists', async () => {
      mkdirSync(join(tempDir, 'existing'));

      const result = await provider.mkdir('/existing');

      expect(result.status).toBe(OperationStatus.Error);
      expect(result.error?.code).toBe('ALREADY_EXISTS');
    });
  });

  describe('delete', () => {
    it('should delete file', async () => {
      writeFileSync(join(tempDir, 'to-delete.txt'), 'content');

      const result = await provider.delete('/to-delete.txt');

      expect(result.status).toBe(OperationStatus.Success);
      expect(existsSync(join(tempDir, 'to-delete.txt'))).toBe(false);
    });

    it('should delete empty directory', async () => {
      mkdirSync(join(tempDir, 'empty-dir'));

      const result = await provider.delete('/empty-dir');

      expect(result.status).toBe(OperationStatus.Success);
      expect(existsSync(join(tempDir, 'empty-dir'))).toBe(false);
    });

    it('should delete directory recursively', async () => {
      mkdirSync(join(tempDir, 'dir-with-files'));
      writeFileSync(join(tempDir, 'dir-with-files', 'file.txt'), 'content');

      const result = await provider.delete('/dir-with-files', { recursive: true });

      expect(result.status).toBe(OperationStatus.Success);
      expect(existsSync(join(tempDir, 'dir-with-files'))).toBe(false);
    });

    it('should return not found for non-existent path', async () => {
      const result = await provider.delete('/nonexistent');

      expect(result.status).toBe(OperationStatus.NotFound);
    });
  });

  describe('getMetadata', () => {
    it('should return metadata for file', async () => {
      writeFileSync(join(tempDir, 'file.txt'), 'content');

      const result = await provider.getMetadata('/file.txt');

      expect(result.status).toBe(OperationStatus.Success);
      expect(result.data?.name).toBe('file.txt');
      expect(result.data?.type).toBe(EntryType.File);
      expect(result.data?.size).toBe(7); // 'content'.length
    });

    it('should return metadata for directory', async () => {
      mkdirSync(join(tempDir, 'dir'));

      const result = await provider.getMetadata('/dir');

      expect(result.status).toBe(OperationStatus.Success);
      expect(result.data?.name).toBe('dir');
      expect(result.data?.type).toBe(EntryType.Directory);
    });

    it('should return not found for non-existent path', async () => {
      const result = await provider.getMetadata('/nonexistent');

      expect(result.status).toBe(OperationStatus.NotFound);
    });
  });

  describe('move', () => {
    it('should move/rename file', async () => {
      writeFileSync(join(tempDir, 'source.txt'), 'content');

      const result = await provider.move('/source.txt', '/dest.txt');

      expect(result.status).toBe(OperationStatus.Success);
      expect(existsSync(join(tempDir, 'source.txt'))).toBe(false);
      expect(existsSync(join(tempDir, 'dest.txt'))).toBe(true);
    });

    it('should move directory', async () => {
      mkdirSync(join(tempDir, 'source-dir'));
      writeFileSync(join(tempDir, 'source-dir', 'file.txt'), 'content');

      const result = await provider.move('/source-dir', '/dest-dir');

      expect(result.status).toBe(OperationStatus.Success);
      expect(existsSync(join(tempDir, 'source-dir'))).toBe(false);
      expect(existsSync(join(tempDir, 'dest-dir', 'file.txt'))).toBe(true);
    });
  });

  describe('copy', () => {
    it('should copy file', async () => {
      writeFileSync(join(tempDir, 'source.txt'), 'content');

      const result = await provider.copy('/source.txt', '/copy.txt');

      expect(result.status).toBe(OperationStatus.Success);
      expect(existsSync(join(tempDir, 'source.txt'))).toBe(true);
      expect(existsSync(join(tempDir, 'copy.txt'))).toBe(true);
    });

    it('should copy directory recursively', async () => {
      mkdirSync(join(tempDir, 'source-dir'));
      writeFileSync(join(tempDir, 'source-dir', 'file.txt'), 'content');

      const result = await provider.copy('/source-dir', '/copy-dir', { recursive: true });

      expect(result.status).toBe(OperationStatus.Success);
      expect(existsSync(join(tempDir, 'source-dir', 'file.txt'))).toBe(true);
      expect(existsSync(join(tempDir, 'copy-dir', 'file.txt'))).toBe(true);
    });
  });
});
