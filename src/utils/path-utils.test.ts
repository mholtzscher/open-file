/**
 * Tests for path utility functions
 */

import { describe, it, expect } from 'bun:test';
import {
  expandUser,
  normalizePath,
  joinPath,
  getParentPath,
  getFileName,
  isDirectory,
  asDirectory,
  asFile,
  calculateParentPath,
} from './path-utils.js';

describe('path-utils', () => {
  describe('expandUser', () => {
    it('expands ~ to home directory', () => {
      const result = expandUser('~/test');
      expect(result).not.toContain('~');
      expect(result).toContain('/test');
    });

    it('leaves paths without ~ unchanged', () => {
      expect(expandUser('/absolute/path')).toBe('/absolute/path');
      expect(expandUser('relative/path')).toBe('relative/path');
    });
  });

  describe('normalizePath', () => {
    it('converts backslashes to forward slashes', () => {
      expect(normalizePath('a\\b\\c')).toBe('a/b/c');
    });

    it('leaves forward slashes unchanged', () => {
      expect(normalizePath('a/b/c')).toBe('a/b/c');
    });
  });

  describe('joinPath', () => {
    it('joins path segments', () => {
      expect(joinPath('a', 'b', 'c')).toBe('a/b/c');
    });

    it('filters empty segments', () => {
      expect(joinPath('a', '', 'b')).toBe('a/b');
    });

    it('normalizes multiple slashes', () => {
      expect(joinPath('a/', '/b')).toBe('a/b');
    });
  });

  describe('getParentPath', () => {
    it('returns parent of nested path', () => {
      expect(getParentPath('a/b/c/')).toBe('a/b/');
    });

    it('handles paths without trailing slash', () => {
      expect(getParentPath('a/b/c')).toBe('a/b/');
    });
  });

  describe('getFileName', () => {
    it('extracts filename from path', () => {
      expect(getFileName('a/b/file.txt')).toBe('file.txt');
    });

    it('handles directory paths', () => {
      expect(getFileName('a/b/dir/')).toBe('dir');
    });
  });

  describe('isDirectory', () => {
    it('returns true for paths with trailing slash', () => {
      expect(isDirectory('folder/')).toBe(true);
    });

    it('returns false for paths without trailing slash', () => {
      expect(isDirectory('file.txt')).toBe(false);
    });
  });

  describe('asDirectory', () => {
    it('adds trailing slash if missing', () => {
      expect(asDirectory('folder')).toBe('folder/');
    });

    it('leaves trailing slash if present', () => {
      expect(asDirectory('folder/')).toBe('folder/');
    });
  });

  describe('asFile', () => {
    it('removes trailing slash', () => {
      expect(asFile('folder/')).toBe('folder');
    });

    it('leaves paths without trailing slash unchanged', () => {
      expect(asFile('file.txt')).toBe('file.txt');
    });
  });

  describe('calculateParentPath', () => {
    describe('S3/GCS style paths (no leading slash)', () => {
      it('navigates up from nested folder', () => {
        const result = calculateParentPath('folder/subfolder/');
        expect(result.parentPath).toBe('folder/');
        expect(result.atContainerRoot).toBe(false);
      });

      it('navigates up from deeply nested folder', () => {
        const result = calculateParentPath('a/b/c/d/');
        expect(result.parentPath).toBe('a/b/c/');
        expect(result.atContainerRoot).toBe(false);
      });

      it('navigates from first-level folder to container root', () => {
        const result = calculateParentPath('folder/');
        expect(result.parentPath).toBe('');
        expect(result.atContainerRoot).toBe(false);
      });

      it('returns atContainerRoot when at empty path', () => {
        const result = calculateParentPath('');
        expect(result.atContainerRoot).toBe(true);
      });

      it('handles paths without trailing slash', () => {
        const result = calculateParentPath('folder/subfolder');
        expect(result.parentPath).toBe('folder/');
        expect(result.atContainerRoot).toBe(false);
      });
    });

    describe('SFTP style paths (with leading slash)', () => {
      it('navigates up from nested folder', () => {
        const result = calculateParentPath('/data/images/');
        expect(result.parentPath).toBe('/data/');
        expect(result.atContainerRoot).toBe(false);
      });

      it('navigates up from deeply nested folder', () => {
        const result = calculateParentPath('/data/a/b/c/');
        expect(result.parentPath).toBe('/data/a/b/');
        expect(result.atContainerRoot).toBe(false);
      });

      it('navigates from first-level folder to container root', () => {
        const result = calculateParentPath('/data/');
        expect(result.parentPath).toBe('/');
        expect(result.atContainerRoot).toBe(false);
      });

      it('returns atContainerRoot when at root', () => {
        const result = calculateParentPath('/');
        expect(result.atContainerRoot).toBe(true);
      });

      it('handles paths without trailing slash', () => {
        const result = calculateParentPath('/data/images');
        expect(result.parentPath).toBe('/data/');
        expect(result.atContainerRoot).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('handles single segment without leading slash', () => {
        const result = calculateParentPath('data');
        expect(result.parentPath).toBe('');
        expect(result.atContainerRoot).toBe(false);
      });

      it('handles single segment with leading slash', () => {
        const result = calculateParentPath('/data');
        expect(result.parentPath).toBe('/');
        expect(result.atContainerRoot).toBe(false);
      });

      it('handles paths with multiple slashes', () => {
        // Leading slash is preserved even with multiple slashes
        const result = calculateParentPath('//folder//subfolder//');
        expect(result.parentPath).toBe('/folder/');
        expect(result.atContainerRoot).toBe(false);
      });
    });
  });
});
