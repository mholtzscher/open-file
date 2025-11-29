/**
 * Storage URI Utilities Tests
 */

import { describe, it, expect } from 'bun:test';
import {
  buildUri,
  parseUri,
  getParentUri,
  getDirectoryPath,
  entryToUri,
  isUriInPath,
  buildDestinationUri,
  providerNameToScheme,
  StorageScheme,
} from './storage-uri.js';
import { Entry, EntryType } from '../types/entry.js';

describe('storage-uri', () => {
  // ============================================
  // buildUri
  // ============================================
  describe('buildUri', () => {
    it('builds S3 URIs correctly', () => {
      expect(buildUri('s3', 'my-bucket', 'path/to/file.txt')).toBe(
        's3://my-bucket/path/to/file.txt'
      );
    });

    it('builds S3 URIs with empty path', () => {
      expect(buildUri('s3', 'my-bucket', '')).toBe('s3://my-bucket/');
    });

    it('builds S3 URIs and normalizes leading slash', () => {
      expect(buildUri('s3', 'my-bucket', '/path/to/file.txt')).toBe(
        's3://my-bucket/path/to/file.txt'
      );
    });

    it('builds GCS URIs correctly', () => {
      expect(buildUri('gcs', 'my-bucket', 'path/to/file.txt')).toBe(
        'gcs://my-bucket/path/to/file.txt'
      );
    });

    it('builds SFTP URIs correctly', () => {
      expect(buildUri('sftp', 'host.example.com:22', 'home/user/file.txt')).toBe(
        'sftp://host.example.com:22/home/user/file.txt'
      );
    });

    it('builds file URIs correctly', () => {
      expect(buildUri('file', undefined, '/home/user/file.txt')).toBe('file:///home/user/file.txt');
    });

    it('builds file URIs without leading slash', () => {
      expect(buildUri('file', undefined, 'relative/path.txt')).toBe('file:///relative/path.txt');
    });

    it('builds mock URIs correctly', () => {
      expect(buildUri('mock', 'test-bucket', 'path/to/file.txt')).toBe(
        'mock://test-bucket/path/to/file.txt'
      );
    });

    it('builds mock URIs with default bucket', () => {
      expect(buildUri('mock', undefined, 'path/to/file.txt')).toBe(
        'mock://default/path/to/file.txt'
      );
    });

    it('throws for S3 without bucket', () => {
      expect(() => buildUri('s3', undefined, 'path')).toThrow('S3 URIs require a bucket name');
    });

    it('throws for GCS without bucket', () => {
      expect(() => buildUri('gcs', undefined, 'path')).toThrow('GCS URIs require a bucket name');
    });

    it('throws for SFTP without host', () => {
      expect(() => buildUri('sftp', undefined, 'path')).toThrow('SFTP URIs require a host');
    });

    it('throws for unknown scheme', () => {
      expect(() => buildUri('unknown' as StorageScheme, 'bucket', 'path')).toThrow(
        'Unknown scheme: unknown'
      );
    });
  });

  // ============================================
  // parseUri
  // ============================================
  describe('parseUri', () => {
    it('parses S3 URIs correctly', () => {
      const result = parseUri('s3://my-bucket/path/to/file.txt');
      expect(result).toEqual({
        scheme: 's3',
        bucket: 'my-bucket',
        host: undefined,
        port: undefined,
        path: 'path/to/file.txt',
        name: 'file.txt',
      });
    });

    it('parses S3 URIs with empty path', () => {
      const result = parseUri('s3://my-bucket/');
      expect(result).toEqual({
        scheme: 's3',
        bucket: 'my-bucket',
        host: undefined,
        port: undefined,
        path: '',
        name: '',
      });
    });

    it('parses GCS URIs correctly', () => {
      const result = parseUri('gcs://my-bucket/path/to/file.txt');
      expect(result.scheme).toBe('gcs');
      expect(result.bucket).toBe('my-bucket');
      expect(result.path).toBe('path/to/file.txt');
    });

    it('parses SFTP URIs correctly with host and port', () => {
      const result = parseUri('sftp://host.example.com:22/home/user/file.txt');
      expect(result).toEqual({
        scheme: 'sftp',
        bucket: 'host.example.com:22',
        host: 'host.example.com',
        port: 22,
        path: 'home/user/file.txt',
        name: 'file.txt',
      });
    });

    it('parses SFTP URIs without port', () => {
      const result = parseUri('sftp://host.example.com/home/user/file.txt');
      expect(result.host).toBe('host.example.com');
      expect(result.port).toBeUndefined();
    });

    it('parses file URIs correctly', () => {
      const result = parseUri('file:///home/user/file.txt');
      expect(result.scheme).toBe('file');
      expect(result.path).toBe('/home/user/file.txt');
      expect(result.name).toBe('file.txt');
      // bucket is empty string for file URIs
      expect(result.bucket).toBeFalsy();
    });

    it('parses mock URIs correctly', () => {
      const result = parseUri('mock://test-bucket/path/to/file.txt');
      expect(result.scheme).toBe('mock');
      expect(result.bucket).toBe('test-bucket');
      expect(result.path).toBe('path/to/file.txt');
    });

    it('throws for invalid URI format', () => {
      expect(() => parseUri('invalid')).toThrow('Invalid URI format');
      expect(() => parseUri('s3:bucket/path')).toThrow('Invalid URI format');
    });

    it('throws for unknown scheme', () => {
      expect(() => parseUri('xyz://bucket/path')).toThrow('Unknown scheme: xyz');
    });

    it('extracts name from nested path', () => {
      const result = parseUri('s3://bucket/a/b/c/file.txt');
      expect(result.name).toBe('file.txt');
    });

    it('extracts name from directory path', () => {
      const result = parseUri('s3://bucket/a/b/c/');
      expect(result.name).toBe('c');
    });
  });

  // ============================================
  // getParentUri
  // ============================================
  describe('getParentUri', () => {
    it('returns parent directory URI', () => {
      expect(getParentUri('s3://bucket/path/to/file.txt')).toBe('s3://bucket/path/to/');
    });

    it('returns root for top-level file', () => {
      expect(getParentUri('s3://bucket/file.txt')).toBe('s3://bucket/');
    });

    it('returns parent for directory', () => {
      expect(getParentUri('s3://bucket/path/to/')).toBe('s3://bucket/path/');
    });

    it('handles root directory', () => {
      expect(getParentUri('s3://bucket/')).toBe('s3://bucket/');
    });
  });

  // ============================================
  // getDirectoryPath
  // ============================================
  describe('getDirectoryPath', () => {
    it('returns directory path for file', () => {
      expect(getDirectoryPath('s3://bucket/path/to/file.txt')).toBe('path/to/');
    });

    it('returns empty for root level file', () => {
      expect(getDirectoryPath('s3://bucket/file.txt')).toBe('');
    });

    it('returns parent for directory path', () => {
      expect(getDirectoryPath('s3://bucket/path/to/')).toBe('path/');
    });
  });

  // ============================================
  // entryToUri
  // ============================================
  describe('entryToUri', () => {
    it('builds URI for entry', () => {
      const entry: Entry = {
        id: '1',
        name: 'file.txt',
        type: EntryType.File,
        path: 'path/to/file.txt',
      };
      expect(entryToUri(entry, 's3', 'my-bucket')).toBe('s3://my-bucket/path/to/file.txt');
    });

    it('builds URI for directory entry', () => {
      const entry: Entry = {
        id: '2',
        name: 'folder',
        type: EntryType.Directory,
        path: 'path/to/folder/',
      };
      expect(entryToUri(entry, 's3', 'my-bucket')).toBe('s3://my-bucket/path/to/folder/');
    });
  });

  // ============================================
  // isUriInPath
  // ============================================
  describe('isUriInPath', () => {
    it('returns true for direct child', () => {
      expect(isUriInPath('s3://bucket/foo/bar.txt', 'foo/', 's3', 'bucket')).toBe(true);
    });

    it('returns false for nested file', () => {
      expect(isUriInPath('s3://bucket/foo/sub/bar.txt', 'foo/', 's3', 'bucket')).toBe(false);
    });

    it('returns true for root level file', () => {
      expect(isUriInPath('s3://bucket/bar.txt', '', 's3', 'bucket')).toBe(true);
    });

    it('returns false for different bucket', () => {
      expect(isUriInPath('s3://other-bucket/foo/bar.txt', 'foo/', 's3', 'bucket')).toBe(false);
    });

    it('returns false for different scheme', () => {
      expect(isUriInPath('gcs://bucket/foo/bar.txt', 'foo/', 's3', 'bucket')).toBe(false);
    });

    it('handles path without trailing slash', () => {
      expect(isUriInPath('s3://bucket/foo/bar.txt', 'foo', 's3', 'bucket')).toBe(true);
    });

    it('returns true for direct directory child', () => {
      expect(isUriInPath('s3://bucket/foo/subdir/', 'foo/', 's3', 'bucket')).toBe(true);
    });
  });

  // ============================================
  // buildDestinationUri
  // ============================================
  describe('buildDestinationUri', () => {
    it('builds destination URI preserving entry name', () => {
      const entry: Entry = {
        id: '1',
        name: 'file.txt',
        type: EntryType.File,
        path: 'source/file.txt',
      };
      expect(buildDestinationUri(entry, 'dest/', 's3', 'bucket')).toBe('s3://bucket/dest/file.txt');
    });

    it('handles destination without trailing slash', () => {
      const entry: Entry = {
        id: '1',
        name: 'file.txt',
        type: EntryType.File,
        path: 'source/file.txt',
      };
      expect(buildDestinationUri(entry, 'dest', 's3', 'bucket')).toBe('s3://bucket/dest/file.txt');
    });

    it('handles root destination', () => {
      const entry: Entry = {
        id: '1',
        name: 'file.txt',
        type: EntryType.File,
        path: 'source/file.txt',
      };
      expect(buildDestinationUri(entry, '', 's3', 'bucket')).toBe('s3://bucket/file.txt');
    });
  });

  // ============================================
  // providerNameToScheme
  // ============================================
  describe('providerNameToScheme', () => {
    it('converts s3 to scheme', () => {
      expect(providerNameToScheme('s3')).toBe('s3');
      expect(providerNameToScheme('S3')).toBe('s3');
    });

    it('converts sftp to scheme', () => {
      expect(providerNameToScheme('sftp')).toBe('sftp');
      expect(providerNameToScheme('SFTP')).toBe('sftp');
    });

    it('converts gcs to scheme', () => {
      expect(providerNameToScheme('gcs')).toBe('gcs');
    });

    it('converts file to scheme', () => {
      expect(providerNameToScheme('file')).toBe('file');
      expect(providerNameToScheme('local')).toBe('file');
    });

    it('converts ftp to scheme', () => {
      expect(providerNameToScheme('ftp')).toBe('ftp');
    });

    it('converts mock to scheme', () => {
      expect(providerNameToScheme('mock')).toBe('mock');
    });

    it('throws for unknown provider', () => {
      expect(() => providerNameToScheme('unknown')).toThrow('Unknown provider name: unknown');
    });
  });
});
