import { describe, it, expect } from 'bun:test';
import type { _Object, CommonPrefix } from '@aws-sdk/client-s3';
import {
  parseS3ObjectToEntry,
  parseCommonPrefixToEntry,
  parseBucketToEntry,
  sortEntries,
  BucketInfo,
} from './entry-parser.js';
import { Entry, EntryType } from '../../types/entry.js';

describe('parseS3ObjectToEntry', () => {
  describe('file parsing', () => {
    it('parses a direct child file', () => {
      const obj: _Object = {
        Key: 'folder/file.txt',
        Size: 1024,
        LastModified: new Date('2024-01-01'),
        ETag: '"abc123"',
        StorageClass: 'STANDARD',
      };

      const entry = parseS3ObjectToEntry(obj, 'folder/');

      expect(entry).not.toBeNull();
      expect(entry!.name).toBe('file.txt');
      expect(entry!.type).toBe(EntryType.File);
      expect(entry!.path).toBe('folder/file.txt');
      expect(entry!.size).toBe(1024);
      expect(entry!.metadata?.etag).toBe('"abc123"');
      expect(entry!.metadata?.storageClass).toBe('STANDARD');
    });

    it('parses a root-level file', () => {
      const obj: _Object = {
        Key: 'file.txt',
        Size: 512,
      };

      const entry = parseS3ObjectToEntry(obj, '');

      expect(entry).not.toBeNull();
      expect(entry!.name).toBe('file.txt');
      expect(entry!.type).toBe(EntryType.File);
      expect(entry!.path).toBe('file.txt');
    });

    it('returns null for nested files (not direct children)', () => {
      const obj: _Object = {
        Key: 'folder/subfolder/file.txt',
        Size: 100,
      };

      const entry = parseS3ObjectToEntry(obj, 'folder/');

      expect(entry).toBeNull();
    });
  });

  describe('directory marker parsing', () => {
    it('parses a direct subdirectory marker', () => {
      const obj: _Object = {
        Key: 'folder/subfolder/',
        LastModified: new Date('2024-01-01'),
        StorageClass: 'STANDARD',
      };

      const entry = parseS3ObjectToEntry(obj, 'folder/');

      expect(entry).not.toBeNull();
      expect(entry!.name).toBe('subfolder');
      expect(entry!.type).toBe(EntryType.Directory);
      expect(entry!.path).toBe('folder/subfolder/');
    });

    it('returns null for deeply nested directory markers', () => {
      const obj: _Object = {
        Key: 'folder/a/b/c/',
      };

      const entry = parseS3ObjectToEntry(obj, 'folder/');

      expect(entry).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('returns null for object without Key', () => {
      const obj: _Object = {
        Size: 100,
      };

      const entry = parseS3ObjectToEntry(obj, 'folder/');

      expect(entry).toBeNull();
    });

    it('returns null when object Key equals prefix', () => {
      const obj: _Object = {
        Key: 'folder/',
      };

      const entry = parseS3ObjectToEntry(obj, 'folder/');

      expect(entry).toBeNull();
    });

    it('returns null for empty relative path', () => {
      const obj: _Object = {
        Key: 'folder/',
      };

      const entry = parseS3ObjectToEntry(obj, 'folder/');

      expect(entry).toBeNull();
    });

    it('generates unique IDs for each entry', () => {
      const obj1: _Object = { Key: 'file1.txt' };
      const obj2: _Object = { Key: 'file2.txt' };

      const entry1 = parseS3ObjectToEntry(obj1, '');
      const entry2 = parseS3ObjectToEntry(obj2, '');

      expect(entry1!.id).not.toBe(entry2!.id);
    });
  });
});

describe('parseCommonPrefixToEntry', () => {
  it('parses a common prefix to directory entry', () => {
    const commonPrefix: CommonPrefix = {
      Prefix: 'folder/subfolder/',
    };

    const entry = parseCommonPrefixToEntry(commonPrefix, 'folder/');

    expect(entry).not.toBeNull();
    expect(entry!.name).toBe('subfolder');
    expect(entry!.type).toBe(EntryType.Directory);
    expect(entry!.path).toBe('folder/subfolder/');
    expect(entry!.modified).toBeInstanceOf(Date);
  });

  it('parses a root-level common prefix', () => {
    const commonPrefix: CommonPrefix = {
      Prefix: 'folder/',
    };

    const entry = parseCommonPrefixToEntry(commonPrefix, '');

    expect(entry).not.toBeNull();
    expect(entry!.name).toBe('folder');
    expect(entry!.type).toBe(EntryType.Directory);
  });

  it('returns null for empty Prefix', () => {
    const commonPrefix: CommonPrefix = {};

    const entry = parseCommonPrefixToEntry(commonPrefix, 'folder/');

    expect(entry).toBeNull();
  });

  it('returns null when prefix results in empty parts', () => {
    const commonPrefix: CommonPrefix = {
      Prefix: 'folder/',
    };

    const entry = parseCommonPrefixToEntry(commonPrefix, 'folder/');

    expect(entry).toBeNull();
  });
});

describe('parseBucketToEntry', () => {
  it('parses bucket info to bucket entry', () => {
    const bucket: BucketInfo = {
      name: 'my-bucket',
      creationDate: new Date('2024-01-01'),
      region: 'us-east-1',
    };

    const entry = parseBucketToEntry(bucket);

    expect(entry.name).toBe('my-bucket');
    expect(entry.type).toBe(EntryType.Bucket);
    expect(entry.path).toBe('my-bucket');
    expect(entry.modified).toEqual(new Date('2024-01-01'));
    expect(entry.metadata?.region).toBe('us-east-1');
    expect(entry.metadata?.createdAt).toEqual(new Date('2024-01-01'));
  });

  it('handles bucket without optional fields', () => {
    const bucket: BucketInfo = {
      name: 'simple-bucket',
    };

    const entry = parseBucketToEntry(bucket);

    expect(entry.name).toBe('simple-bucket');
    expect(entry.type).toBe(EntryType.Bucket);
    expect(entry.modified).toBeUndefined();
    expect(entry.metadata?.region).toBeUndefined();
  });

  it('generates unique IDs', () => {
    const bucket1: BucketInfo = { name: 'bucket1' };
    const bucket2: BucketInfo = { name: 'bucket2' };

    const entry1 = parseBucketToEntry(bucket1);
    const entry2 = parseBucketToEntry(bucket2);

    expect(entry1.id).not.toBe(entry2.id);
  });
});

describe('sortEntries', () => {
  it('sorts directories before files', () => {
    const entries: Entry[] = [
      { id: '1', name: 'file.txt', type: EntryType.File, path: 'file.txt' },
      { id: '2', name: 'folder', type: EntryType.Directory, path: 'folder/' },
    ];

    const sorted = sortEntries(entries);

    expect(sorted[0].type).toBe(EntryType.Directory);
    expect(sorted[1].type).toBe(EntryType.File);
  });

  it('sorts buckets before directories', () => {
    const entries: Entry[] = [
      { id: '1', name: 'folder', type: EntryType.Directory, path: 'folder/' },
      { id: '2', name: 'my-bucket', type: EntryType.Bucket, path: 'my-bucket' },
    ];

    const sorted = sortEntries(entries);

    expect(sorted[0].type).toBe(EntryType.Bucket);
    expect(sorted[1].type).toBe(EntryType.Directory);
  });

  it('sorts same types alphabetically by name', () => {
    const entries: Entry[] = [
      { id: '1', name: 'zebra.txt', type: EntryType.File, path: 'zebra.txt' },
      { id: '2', name: 'alpha.txt', type: EntryType.File, path: 'alpha.txt' },
      { id: '3', name: 'beta.txt', type: EntryType.File, path: 'beta.txt' },
    ];

    const sorted = sortEntries(entries);

    expect(sorted[0].name).toBe('alpha.txt');
    expect(sorted[1].name).toBe('beta.txt');
    expect(sorted[2].name).toBe('zebra.txt');
  });

  it('handles mixed types correctly', () => {
    const entries: Entry[] = [
      { id: '1', name: 'file.txt', type: EntryType.File, path: 'file.txt' },
      { id: '2', name: 'bucket-z', type: EntryType.Bucket, path: 'bucket-z' },
      { id: '3', name: 'dir-b', type: EntryType.Directory, path: 'dir-b/' },
      { id: '4', name: 'bucket-a', type: EntryType.Bucket, path: 'bucket-a' },
      { id: '5', name: 'dir-a', type: EntryType.Directory, path: 'dir-a/' },
    ];

    const sorted = sortEntries(entries);

    expect(sorted[0].name).toBe('bucket-a');
    expect(sorted[1].name).toBe('bucket-z');
    expect(sorted[2].name).toBe('dir-a');
    expect(sorted[3].name).toBe('dir-b');
    expect(sorted[4].name).toBe('file.txt');
  });

  it('handles empty array', () => {
    const entries: Entry[] = [];
    const sorted = sortEntries(entries);
    expect(sorted).toEqual([]);
  });

  it('mutates the original array', () => {
    const entries: Entry[] = [
      { id: '1', name: 'b', type: EntryType.File, path: 'b' },
      { id: '2', name: 'a', type: EntryType.File, path: 'a' },
    ];

    const sorted = sortEntries(entries);

    expect(sorted).toBe(entries); // Same reference
    expect(entries[0].name).toBe('a');
  });
});
