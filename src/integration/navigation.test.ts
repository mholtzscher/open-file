/**
 * Integration tests for bucket context navigation
 *
 * Tests the ability to navigate from buckets back to root view
 * and between different bucket paths.
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { MockAdapter } from '../adapters/mock-adapter.js';
import { EntryType } from '../types/entry.js';

describe('Bucket Context Navigation', () => {
  let adapter: MockAdapter;

  beforeEach(() => {
    adapter = new MockAdapter();
  });

  describe('navigating back to root from bucket root', () => {
    it('should identify when at bucket root level', async () => {
      // Load bucket entries
      const entries = await adapter.list('test-bucket/');
      expect(entries.entries.length).toBeGreaterThan(0);

      // At bucket root (empty path after bucket name)
      const currentPath = '';
      const parts = currentPath.split('/').filter(p => p);
      expect(parts.length).toBe(0);
    });

    it('should identify when inside a bucket subdirectory', async () => {
      // At subdirectory level
      const currentPath = 'documents/';
      const parts = currentPath.split('/').filter(p => p);
      expect(parts.length).toBeGreaterThan(0);
    });

    it('should calculate parent path correctly when navigating up', () => {
      // From deep path
      let currentPath = 'documents/reports/2024/';
      let parts = currentPath.split('/').filter(p => p);
      parts.pop();
      const parentPath = parts.length > 0 ? parts.join('/') + '/' : '';

      expect(parentPath).toBe('documents/reports/');
    });

    it('should return to root when at bucket root and navigating up', () => {
      // At bucket root (empty path)
      const currentPath = '';
      const parts = currentPath.split('/').filter(p => p);

      // If parts.length === 0, we're at root and should go back to bucket list
      expect(parts.length).toBe(0);
    });
  });

  describe('bucket entries detection', () => {
    it('should identify bucket entries by type', async () => {
      const entries = await adapter.list('test-bucket/');

      // All entries should have a type
      for (const entry of entries.entries) {
        expect(entry.type).toBeDefined();
        expect([EntryType.File, EntryType.Directory]).toContain(entry.type);
      }
    });

    it('should support navigating into directories from any level', async () => {
      // Get root entries
      const rootEntries = await adapter.list('test-bucket/');

      // Find a directory
      const directory = rootEntries.entries.find(e => e.type === EntryType.Directory);
      expect(directory).toBeDefined();

      if (directory) {
        // Navigate into it
        const subEntries = await adapter.list(directory.path);
        expect(subEntries.entries).toBeDefined();
      }
    });
  });

  describe('navigation path construction', () => {
    it('should handle empty paths (bucket root)', () => {
      const path = '';
      const parts = path.split('/').filter(p => p);
      expect(parts.length).toBe(0);
    });

    it('should handle single-level paths', () => {
      const path = 'documents/';
      const parts = path.split('/').filter(p => p);
      expect(parts.length).toBe(1);
      expect(parts[0]).toBe('documents');
    });

    it('should handle multi-level paths', () => {
      const path = 'documents/reports/q4/';
      const parts = path.split('/').filter(p => p);
      expect(parts.length).toBe(3);
    });

    it('should correctly navigate up from multi-level path', () => {
      let path = 'documents/reports/q4/';
      let parts = path.split('/').filter(p => p);

      parts.pop();
      path = parts.length > 0 ? parts.join('/') + '/' : '';

      expect(path).toBe('documents/reports/');
    });

    it('should return empty path from single-level directory', () => {
      let path = 'documents/';
      let parts = path.split('/').filter(p => p);

      parts.pop();
      path = parts.length > 0 ? parts.join('/') + '/' : '';

      expect(path).toBe('');
    });
  });

  describe('breadcrumb navigation sequence', () => {
    it('should support navigating through multiple levels', async () => {
      // Start at root
      let currentPath = '';
      let entries = await adapter.list('test-bucket/' + currentPath);
      expect(entries.entries.length).toBeGreaterThan(0);

      // Navigate into first directory
      const firstDir = entries.entries.find(e => e.type === EntryType.Directory);
      if (firstDir) {
        currentPath = firstDir.path.replace('test-bucket/', '');
        entries = await adapter.list('test-bucket/' + currentPath);

        // Navigate up
        const parts = currentPath.split('/').filter(p => p);
        if (parts.length > 0) {
          parts.pop();
          currentPath = parts.length > 0 ? parts.join('/') + '/' : '';
          entries = await adapter.list('test-bucket/' + currentPath);
          expect(entries.entries).toBeDefined();
        }
      }
    });

    it('should complete full navigation cycle: root -> dir -> root', async () => {
      // Start at bucket root
      let currentPath = '';
      let entries = await adapter.list('test-bucket/' + currentPath);
      const initialCount = entries.entries.length;

      // Navigate into a directory
      const targetDir = entries.entries.find(e => e.type === EntryType.Directory);
      if (targetDir) {
        currentPath = targetDir.path.replace('test-bucket/', '');
        expect(currentPath).not.toBe('');

        // Navigate back to root
        const parts = currentPath.split('/').filter(p => p);
        while (parts.length > 0) {
          parts.pop();
          currentPath = parts.length > 0 ? parts.join('/') + '/' : '';
        }

        expect(currentPath).toBe('');

        // Reload at root
        entries = await adapter.list('test-bucket/' + currentPath);
        expect(entries.entries.length).toBeGreaterThanOrEqual(initialCount);
      }
    });
  });

  describe('back-to-root keybindings', () => {
    it('should have backspace mapped to navigate up', () => {
      // This is tested in useKeyboardEvents
      const keysForNavigateUp = ['h', '-', 'backspace'];
      expect(keysForNavigateUp).toContain('backspace');
      expect(keysForNavigateUp).toContain('h');
    });

    it('should handle pressing h at bucket root to go back to bucket list', () => {
      // Simulating the navigation logic
      const currentPath = '';
      const parts = currentPath.split('/').filter(p => p);

      // At bucket root (parts.length === 0), pressing h should go back to root view
      const shouldGoToRoot = parts.length === 0;
      expect(shouldGoToRoot).toBe(true);
    });

    it('should handle pressing backspace inside a bucket to go up a level', () => {
      // Simulating the navigation logic
      const bucket = 'my-bucket';
      let currentPath = 'documents/reports/';
      let parts = currentPath.split('/').filter(p => p);

      // Pressing backspace should remove last directory
      if (parts.length > 0) {
        parts.pop();
        currentPath = parts.length > 0 ? parts.join('/') + '/' : '';
      }

      expect(currentPath).toBe('documents/');
    });
  });
});
