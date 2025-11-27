import { describe, it, expect } from 'bun:test';
import {
  normalizeS3Path,
  getS3KeyName,
  isS3Directory,
  joinS3Path,
  getS3ParentPath,
  getS3RelativePath,
} from './path-utils.js';

describe('normalizeS3Path', () => {
  describe('basic normalization', () => {
    it('removes leading slash', () => {
      expect(normalizeS3Path('/folder/file.txt')).toBe('folder/file.txt');
    });

    it('collapses multiple consecutive slashes', () => {
      expect(normalizeS3Path('folder//subfolder///file.txt')).toBe('folder/subfolder/file.txt');
    });

    it('returns empty string for root path "/"', () => {
      expect(normalizeS3Path('/')).toBe('');
    });

    it('returns empty string for empty input', () => {
      expect(normalizeS3Path('')).toBe('');
    });

    it('handles path with only slashes', () => {
      expect(normalizeS3Path('///')).toBe('');
    });
  });

  describe('directory handling', () => {
    it('adds trailing slash for directories', () => {
      expect(normalizeS3Path('folder', true)).toBe('folder/');
    });

    it('does not double trailing slash for directories', () => {
      expect(normalizeS3Path('folder/', true)).toBe('folder/');
    });

    it('does not add trailing slash for empty path as directory', () => {
      expect(normalizeS3Path('', true)).toBe('');
    });

    it('does not add trailing slash for files', () => {
      expect(normalizeS3Path('folder/file.txt', false)).toBe('folder/file.txt');
    });
  });

  describe('complex paths', () => {
    it('handles deeply nested paths', () => {
      expect(normalizeS3Path('/a/b/c/d/e/file.txt')).toBe('a/b/c/d/e/file.txt');
    });

    it('handles paths with special characters', () => {
      expect(normalizeS3Path('/folder/file with spaces.txt')).toBe('folder/file with spaces.txt');
    });

    it('handles paths with dots', () => {
      expect(normalizeS3Path('/folder/../file.txt')).toBe('folder/../file.txt');
    });
  });
});

describe('getS3KeyName', () => {
  it('extracts file name from path', () => {
    expect(getS3KeyName('folder/subfolder/file.txt')).toBe('file.txt');
  });

  it('extracts directory name from path with trailing slash', () => {
    expect(getS3KeyName('folder/subfolder/')).toBe('subfolder');
  });

  it('handles root-level file', () => {
    expect(getS3KeyName('file.txt')).toBe('file.txt');
  });

  it('handles single directory', () => {
    expect(getS3KeyName('folder/')).toBe('folder');
  });

  it('returns key for empty path', () => {
    expect(getS3KeyName('')).toBe('');
  });

  it('handles key with only slashes', () => {
    expect(getS3KeyName('/')).toBe('/');
  });
});

describe('isS3Directory', () => {
  it('returns true for path ending with slash', () => {
    expect(isS3Directory('folder/')).toBe(true);
  });

  it('returns true for nested path ending with slash', () => {
    expect(isS3Directory('folder/subfolder/')).toBe(true);
  });

  it('returns false for file path', () => {
    expect(isS3Directory('folder/file.txt')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isS3Directory('')).toBe(false);
  });

  it('returns true for root slash', () => {
    expect(isS3Directory('/')).toBe(true);
  });
});

describe('joinS3Path', () => {
  it('joins simple segments', () => {
    expect(joinS3Path('folder', 'file.txt')).toBe('folder/file.txt');
  });

  it('handles segments with trailing slashes', () => {
    expect(joinS3Path('folder/', 'file.txt')).toBe('folder/file.txt');
  });

  it('handles segments with leading slashes', () => {
    expect(joinS3Path('/folder', '/file.txt')).toBe('folder/file.txt');
  });

  it('handles multiple segments', () => {
    expect(joinS3Path('a', 'b', 'c', 'd.txt')).toBe('a/b/c/d.txt');
  });

  it('filters out empty segments', () => {
    expect(joinS3Path('folder', '', 'file.txt')).toBe('folder/file.txt');
  });

  it('handles all empty segments', () => {
    expect(joinS3Path('', '', '')).toBe('');
  });

  it('handles single segment', () => {
    expect(joinS3Path('file.txt')).toBe('file.txt');
  });

  it('handles no segments', () => {
    expect(joinS3Path()).toBe('');
  });
});

describe('getS3ParentPath', () => {
  it('returns parent for nested file', () => {
    expect(getS3ParentPath('folder/subfolder/file.txt')).toBe('folder/subfolder/');
  });

  it('returns parent for directory with trailing slash', () => {
    expect(getS3ParentPath('folder/subfolder/')).toBe('folder/');
  });

  it('returns empty string for root-level file', () => {
    expect(getS3ParentPath('file.txt')).toBe('');
  });

  it('returns empty string for root-level directory', () => {
    expect(getS3ParentPath('folder/')).toBe('');
  });

  it('returns empty string for empty path', () => {
    expect(getS3ParentPath('')).toBe('');
  });
});

describe('getS3RelativePath', () => {
  it('removes prefix from key', () => {
    expect(getS3RelativePath('folder/subfolder/file.txt', 'folder/')).toBe('subfolder/file.txt');
  });

  it('returns key if prefix does not match', () => {
    expect(getS3RelativePath('other/file.txt', 'folder/')).toBe('other/file.txt');
  });

  it('returns empty string if key equals prefix', () => {
    expect(getS3RelativePath('folder/', 'folder/')).toBe('');
  });

  it('handles empty prefix', () => {
    expect(getS3RelativePath('folder/file.txt', '')).toBe('folder/file.txt');
  });

  it('handles exact prefix match', () => {
    expect(getS3RelativePath('prefix/path/file.txt', 'prefix/path/')).toBe('file.txt');
  });
});
