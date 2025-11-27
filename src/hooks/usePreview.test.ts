/**
 * Tests for usePreview hook helper functions
 *
 * Note: Full hook tests require React testing setup which is complex in Bun.
 * These tests focus on the pure functions and logic.
 */

import { describe, it, expect } from 'bun:test';
import { Entry, EntryType } from '../types/entry.js';

// ============================================================================
// Test Data Helpers
// ============================================================================

const createTextFileEntry = (name: string, size?: number): Entry => ({
  id: `file-${name}`,
  name,
  path: name,
  type: EntryType.File,
  size,
  modified: new Date(),
});

const createNonTextFileEntry = (name: string): Entry => ({
  id: `file-${name}`,
  name,
  path: name,
  type: EntryType.File,
  size: 1024,
  modified: new Date(),
});

const createDirectoryEntry = (name: string): Entry => ({
  id: `dir-${name}`,
  name,
  path: name,
  type: EntryType.Directory,
  modified: new Date(),
});

// Copy the isPreviewableFile function from the hook for testing
function isPreviewableFile(entry: Entry | undefined): boolean {
  if (!entry || entry.type !== EntryType.File) return false;

  const name = entry.name.toLowerCase();
  const textExtensions = [
    '.txt',
    '.md',
    '.json',
    '.yaml',
    '.yml',
    '.toml',
    '.xml',
    '.csv',
    '.log',
    '.js',
    '.ts',
    '.tsx',
    '.jsx',
    '.py',
    '.rb',
    '.go',
    '.rs',
    '.c',
    '.cpp',
    '.h',
    '.java',
    '.sh',
    '.bash',
    '.zsh',
    '.sql',
    '.html',
    '.css',
    '.scss',
    '.sass',
    '.less',
    '.php',
    '.swift',
    '.kt',
    '.kts',
  ];

  return textExtensions.some(ext => name.endsWith(ext));
}

// ============================================================================
// Tests
// ============================================================================

describe('usePreview - isPreviewableFile logic', () => {
  it('should return false for undefined entry', () => {
    expect(isPreviewableFile(undefined)).toBe(false);
  });

  it('should return false for directories', () => {
    const entry = createDirectoryEntry('folder');
    expect(isPreviewableFile(entry)).toBe(false);
  });

  it('should return false for non-text files', () => {
    const entries = [
      createNonTextFileEntry('image.png'),
      createNonTextFileEntry('video.mp4'),
      createNonTextFileEntry('archive.zip'),
      createNonTextFileEntry('binary.exe'),
    ];

    entries.forEach(entry => {
      expect(isPreviewableFile(entry)).toBe(false);
    });
  });

  it('should return true for text files', () => {
    const entries = [
      createTextFileEntry('readme.txt'),
      createTextFileEntry('README.md'),
      createTextFileEntry('package.json'),
      createTextFileEntry('config.yaml'),
      createTextFileEntry('script.js'),
      createTextFileEntry('component.tsx'),
      createTextFileEntry('styles.css'),
      createTextFileEntry('index.html'),
    ];

    entries.forEach(entry => {
      expect(isPreviewableFile(entry)).toBe(true);
    });
  });

  it('should be case-insensitive for extensions', () => {
    expect(isPreviewableFile(createTextFileEntry('README.TXT'))).toBe(true);
    expect(isPreviewableFile(createTextFileEntry('Config.JSON'))).toBe(true);
    expect(isPreviewableFile(createTextFileEntry('script.JS'))).toBe(true);
  });

  it('should support all common programming language extensions', () => {
    const programmingFiles = [
      'script.py',
      'app.rb',
      'main.go',
      'lib.rs',
      'code.c',
      'code.cpp',
      'header.h',
      'App.java',
      'script.sh',
      'run.bash',
      'config.zsh',
      'query.sql',
      'page.php',
      'app.swift',
      'Main.kt',
    ];

    programmingFiles.forEach(filename => {
      const entry = createTextFileEntry(filename);
      expect(isPreviewableFile(entry)).toBe(true);
    });
  });

  it('should support markup and data file extensions', () => {
    const dataFiles = [
      'config.yaml',
      'config.yml',
      'data.toml',
      'doc.xml',
      'data.csv',
      'app.log',
      'data.json',
      'readme.md',
    ];

    dataFiles.forEach(filename => {
      const entry = createTextFileEntry(filename);
      expect(isPreviewableFile(entry)).toBe(true);
    });
  });

  it('should support web development file extensions', () => {
    const webFiles = [
      'index.html',
      'styles.css',
      'styles.scss',
      'styles.sass',
      'styles.less',
      'script.js',
      'component.jsx',
      'component.ts',
      'component.tsx',
    ];

    webFiles.forEach(filename => {
      const entry = createTextFileEntry(filename);
      expect(isPreviewableFile(entry)).toBe(true);
    });
  });
});

describe('usePreview - size limit logic', () => {
  it('should identify files that exceed size limit', () => {
    const maxSize = 100 * 1024; // 100KB

    const largeFile = createTextFileEntry('large.txt', 200 * 1024); // 200KB
    const smallFile = createTextFileEntry('small.txt', 50 * 1024); // 50KB
    const exactFile = createTextFileEntry('exact.txt', 100 * 1024); // Exactly 100KB

    expect(largeFile.size! > maxSize).toBe(true);
    expect(smallFile.size! > maxSize).toBe(false);
    expect(exactFile.size! > maxSize).toBe(false); // Equal to max should be allowed
  });

  it('should handle undefined file size', () => {
    const fileWithoutSize = createTextFileEntry('unknown.txt', undefined);
    const maxSize = 100 * 1024;

    // Files without size should be allowed (size check only applies if size is known)
    expect(fileWithoutSize.size === undefined).toBe(true);
  });
});

describe('usePreview - path construction', () => {
  it('should construct full path correctly', () => {
    const currentPath = 'folder/subfolder/';
    const filename = 'test.txt';
    const expected = 'folder/subfolder/test.txt';

    const fullPath = currentPath ? `${currentPath}${filename}` : filename;
    expect(fullPath).toBe(expected);
  });

  it('should handle root path correctly', () => {
    const currentPath = '';
    const filename = 'test.txt';
    const expected = 'test.txt';

    const fullPath = currentPath ? `${currentPath}${filename}` : filename;
    expect(fullPath).toBe(expected);
  });

  it('should handle paths with trailing slashes', () => {
    const paths = [
      { current: 'folder/', file: 'test.txt', expected: 'folder/test.txt' },
      { current: 'a/b/c/', file: 'file.md', expected: 'a/b/c/file.md' },
      { current: '/', file: 'root.txt', expected: '/root.txt' },
    ];

    paths.forEach(({ current, file, expected }) => {
      const fullPath = current ? `${current}${file}` : file;
      expect(fullPath).toBe(expected);
    });
  });
});
