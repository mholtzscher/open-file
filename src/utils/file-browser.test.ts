/**
 * File browser utility tests
 */

import { describe, it, expect } from 'bun:test';
import { FileTypeFilter, formatBytes, getExtension, getNormalizedPath } from './file-browser.js';

describe('File Browser Utilities', () => {
  describe('formatBytes', () => {
    it('formats bytes correctly', () => {
      expect(formatBytes(0)).toBe('0B');
      expect(formatBytes(512)).toBe('512B');
      expect(formatBytes(1024)).toBe('1.0KB');
      expect(formatBytes(1024 * 10)).toBe('10.0KB');
      expect(formatBytes(1024 * 1024)).toBe('1.0MB');
      expect(formatBytes(1024 * 1024 * 100)).toBe('100.0MB');
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1.0GB');
      expect(formatBytes(1024 * 1024 * 1024 * 2)).toBe('2.0GB');
    });
  });

  describe('getExtension', () => {
    it('extracts file extension', () => {
      expect(getExtension('file.txt')).toBe('txt');
      expect(getExtension('archive.tar.gz')).toBe('gz');
      expect(getExtension('image.jpg')).toBe('jpg');
      expect(getExtension('script.py')).toBe('py');
      expect(getExtension('noextension')).toBe('');
      expect(getExtension('config.hidden.json')).toBe('json');
    });
  });

  describe('getNormalizedPath', () => {
    it('normalizes paths correctly', () => {
      const currentPath = getNormalizedPath('.');
      expect(currentPath).toBeTruthy();
      expect(currentPath.length).toBeGreaterThan(0);
    });

    it('expands home directory', () => {
      const homePath = getNormalizedPath('~');
      expect(homePath).not.toContain('~');
      expect(homePath.length).toBeGreaterThan(0);
    });

    it('handles absolute paths', () => {
      const absPath = getNormalizedPath('/tmp');
      expect(absPath).toBe('/tmp');
    });
  });

  describe('FileTypeFilter enum', () => {
    it('has all filter types', () => {
      const filterTypes = [
        FileTypeFilter.All,
        FileTypeFilter.Text,
        FileTypeFilter.Images,
        FileTypeFilter.Archives,
        FileTypeFilter.Code,
      ];
      expect(filterTypes.length).toBe(5);
      expect(filterTypes).toContain(FileTypeFilter.All);
    });
  });

  describe('File selection scenarios', () => {
    it('tracks selected files', () => {
      const selectedFiles = new Set<string>();

      selectedFiles.add('/path/to/file1.txt');
      selectedFiles.add('/path/to/file2.txt');

      expect(selectedFiles.size).toBe(2);
      expect(selectedFiles.has('/path/to/file1.txt')).toBe(true);
    });

    it('handles multiple selection toggling', () => {
      const selectedFiles = new Set<string>();
      const file1 = '/path/to/file1.txt';

      selectedFiles.add(file1);
      expect(selectedFiles.has(file1)).toBe(true);

      selectedFiles.delete(file1);
      expect(selectedFiles.has(file1)).toBe(false);
    });
  });

  describe('Upload queue management', () => {
    it('tracks upload queue items', () => {
      interface QueueItem {
        id: string;
        path: string;
        status: 'pending' | 'uploading' | 'completed' | 'failed';
        progress: number;
      }

      const queue: QueueItem[] = [];

      queue.push({
        id: 'upload-1',
        path: '/path/to/file1.txt',
        status: 'pending',
        progress: 0,
      });

      expect(queue.length).toBe(1);
      expect(queue[0].status).toBe('pending');

      // Update progress
      queue[0].status = 'uploading';
      queue[0].progress = 50;

      expect(queue[0].progress).toBe(50);
      expect(queue[0].status).toBe('uploading');
    });

    it('calculates total queue size', () => {
      interface QueueItem {
        path: string;
        size: number;
      }

      const queue: QueueItem[] = [
        { path: '/file1.txt', size: 1024 },
        { path: '/file2.txt', size: 2048 },
        { path: '/file3.txt', size: 4096 },
      ];

      const totalSize = queue.reduce((sum, item) => sum + item.size, 0);
      expect(totalSize).toBe(7168);
    });
  });

  describe('Directory navigation', () => {
    it('tracks current directory', () => {
      let currentPath = '/home/user/downloads';

      const goUp = (path: string) => {
        const parent = path.substring(0, path.lastIndexOf('/'));
        return parent || '/';
      };

      expect(goUp(currentPath)).toBe('/home/user');
      expect(goUp(goUp(currentPath))).toBe('/home');
    });
  });
});
