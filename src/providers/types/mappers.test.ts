/**
 * Tests for Type Mapper Functions
 *
 * Verifies roundtrip compatibility and correct mapping between
 * provider-specific types and UI/legacy types.
 */

import { describe, test, expect } from 'bun:test';
import { Entry, EntryType, EntryMetadata } from '../../types/entry.js';
import { ProviderEntry, ProviderEntryType, ProviderEntryMetadata } from './entry.js';
import { ProviderProgressEvent } from './progress.js';
import { ProviderListResult } from './list.js';
import { ListResult, ProgressEvent } from '../provider.js';
import {
  toProviderEntry,
  fromProviderEntry,
  toProviderEntryType,
  fromProviderEntryType,
  toProviderEntryMetadata,
  fromProviderEntryMetadata,
  toProviderProgressEvent,
  fromProviderProgressEvent,
  toProviderListResult,
  fromProviderListResult,
  toProviderEntries,
  fromProviderEntries,
} from './mappers.js';

describe('Entry Type Mappers', () => {
  test('toProviderEntryType maps all UI types correctly', () => {
    expect(toProviderEntryType(EntryType.File)).toBe(ProviderEntryType.File);
    expect(toProviderEntryType(EntryType.Directory)).toBe(ProviderEntryType.Directory);
    expect(toProviderEntryType(EntryType.Bucket)).toBe(ProviderEntryType.Bucket);
  });

  test('fromProviderEntryType maps all provider types correctly', () => {
    expect(fromProviderEntryType(ProviderEntryType.File)).toBe(EntryType.File);
    expect(fromProviderEntryType(ProviderEntryType.Directory)).toBe(EntryType.Directory);
    expect(fromProviderEntryType(ProviderEntryType.Bucket)).toBe(EntryType.Bucket);
    // Symlink maps to File (UI doesn't support symlinks)
    expect(fromProviderEntryType(ProviderEntryType.Symlink)).toBe(EntryType.File);
  });

  test('roundtrip for standard types preserves value', () => {
    expect(fromProviderEntryType(toProviderEntryType(EntryType.File))).toBe(EntryType.File);
    expect(fromProviderEntryType(toProviderEntryType(EntryType.Directory))).toBe(
      EntryType.Directory
    );
    expect(fromProviderEntryType(toProviderEntryType(EntryType.Bucket))).toBe(EntryType.Bucket);
  });
});

describe('Entry Metadata Mappers', () => {
  test('handles undefined metadata', () => {
    expect(toProviderEntryMetadata(undefined)).toBeUndefined();
    expect(fromProviderEntryMetadata(undefined)).toBeUndefined();
  });

  test('maps common metadata fields', () => {
    const metadata: EntryMetadata = {
      contentType: 'text/plain',
      etag: '"abc123"',
      storageClass: 'STANDARD',
      region: 'us-east-1',
      createdAt: new Date('2024-01-01'),
      totalSize: 1024,
      objectCount: 10,
      custom: { key: 'value' },
    };

    const providerMetadata = toProviderEntryMetadata(metadata);
    expect(providerMetadata).toBeDefined();
    expect(providerMetadata!.contentType).toBe('text/plain');
    expect(providerMetadata!.etag).toBe('"abc123"');
    expect(providerMetadata!.storageClass).toBe('STANDARD');
    expect(providerMetadata!.region).toBe('us-east-1');
    expect(providerMetadata!.custom).toEqual({ key: 'value' });
  });

  test('roundtrip preserves common fields', () => {
    const metadata: EntryMetadata = {
      contentType: 'application/json',
      etag: '"xyz789"',
    };

    const result = fromProviderEntryMetadata(toProviderEntryMetadata(metadata));
    expect(result?.contentType).toBe(metadata.contentType);
    expect(result?.etag).toBe(metadata.etag);
  });
});

describe('Entry Mappers', () => {
  const sampleEntry: Entry = {
    id: 'entry-1',
    name: 'test.txt',
    type: EntryType.File,
    path: '/bucket/test.txt',
    size: 1024,
    modified: new Date('2024-01-15'),
    metadata: {
      contentType: 'text/plain',
    },
  };

  test('toProviderEntry maps all fields', () => {
    const result = toProviderEntry(sampleEntry);

    expect(result.id).toBe('entry-1');
    expect(result.name).toBe('test.txt');
    expect(result.type).toBe(ProviderEntryType.File);
    expect(result.path).toBe('/bucket/test.txt');
    expect(result.size).toBe(1024);
    expect(result.modified).toEqual(sampleEntry.modified);
    expect(result.metadata?.contentType).toBe('text/plain');
  });

  test('fromProviderEntry maps all fields', () => {
    const providerEntry: ProviderEntry = {
      id: 'entry-2',
      name: 'folder',
      type: ProviderEntryType.Directory,
      path: '/bucket/folder/',
      modified: new Date('2024-02-01'),
    };

    const result = fromProviderEntry(providerEntry);

    expect(result.id).toBe('entry-2');
    expect(result.name).toBe('folder');
    expect(result.type).toBe(EntryType.Directory);
    expect(result.path).toBe('/bucket/folder/');
  });

  test('roundtrip preserves all common fields', () => {
    const result = fromProviderEntry(toProviderEntry(sampleEntry));

    expect(result.id).toBe(sampleEntry.id);
    expect(result.name).toBe(sampleEntry.name);
    expect(result.type).toBe(sampleEntry.type);
    expect(result.path).toBe(sampleEntry.path);
    expect(result.size).toBe(sampleEntry.size);
    expect(result.modified).toEqual(sampleEntry.modified);
  });

  test('toProviderEntries maps array of entries', () => {
    const entries: Entry[] = [sampleEntry, { ...sampleEntry, id: 'entry-2', name: 'test2.txt' }];

    const result = toProviderEntries(entries);

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('test.txt');
    expect(result[1].name).toBe('test2.txt');
  });

  test('fromProviderEntries maps array of provider entries', () => {
    const providerEntries: ProviderEntry[] = [
      { id: '1', name: 'a.txt', type: ProviderEntryType.File, path: '/a.txt' },
      { id: '2', name: 'b.txt', type: ProviderEntryType.File, path: '/b.txt' },
    ];

    const result = fromProviderEntries(providerEntries);

    expect(result).toHaveLength(2);
    expect(result[0].type).toBe(EntryType.File);
    expect(result[1].type).toBe(EntryType.File);
  });
});

describe('Progress Event Mappers', () => {
  const sampleEvent: ProgressEvent = {
    operation: 'upload',
    bytesTransferred: 500,
    totalBytes: 1000,
    percentage: 50,
    currentFile: 'test.txt',
  };

  test('toProviderProgressEvent maps all fields', () => {
    const result = toProviderProgressEvent(sampleEvent);

    expect(result.operation).toBe('upload');
    expect(result.bytesTransferred).toBe(500);
    expect(result.totalBytes).toBe(1000);
    expect(result.percentage).toBe(50);
    expect(result.currentFile).toBe('test.txt');
  });

  test('fromProviderProgressEvent maps common fields', () => {
    const providerEvent: ProviderProgressEvent = {
      operation: 'download',
      bytesTransferred: 250,
      totalBytes: 500,
      percentage: 50,
      currentFile: 'data.json',
      filesProcessed: 5,
      totalFiles: 10,
      bytesPerSecond: 1024,
    };

    const result = fromProviderProgressEvent(providerEvent);

    expect(result.operation).toBe('download');
    expect(result.bytesTransferred).toBe(250);
    expect(result.totalBytes).toBe(500);
    expect(result.percentage).toBe(50);
    expect(result.currentFile).toBe('data.json');
    // Extended fields are not in UI type
    expect((result as any).filesProcessed).toBeUndefined();
  });

  test('roundtrip preserves common fields', () => {
    const result = fromProviderProgressEvent(toProviderProgressEvent(sampleEvent));

    expect(result.operation).toBe(sampleEvent.operation);
    expect(result.bytesTransferred).toBe(sampleEvent.bytesTransferred);
    expect(result.percentage).toBe(sampleEvent.percentage);
  });
});

describe('List Result Mappers', () => {
  const sampleListResult: ListResult = {
    entries: [
      { id: '1', name: 'file.txt', type: EntryType.File, path: '/file.txt' },
      { id: '2', name: 'folder', type: EntryType.Directory, path: '/folder/' },
    ],
    continuationToken: 'token123',
    hasMore: true,
  };

  test('toProviderListResult maps all fields', () => {
    const result = toProviderListResult(sampleListResult);

    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].type).toBe(ProviderEntryType.File);
    expect(result.entries[1].type).toBe(ProviderEntryType.Directory);
    expect(result.continuationToken).toBe('token123');
    expect(result.hasMore).toBe(true);
  });

  test('fromProviderListResult maps common fields', () => {
    const providerResult: ProviderListResult = {
      entries: [{ id: '1', name: 'a.txt', type: ProviderEntryType.File, path: '/a.txt' }],
      continuationToken: 'next-page',
      hasMore: false,
      totalCount: 100,
      path: '/bucket/',
    };

    const result = fromProviderListResult(providerResult);

    expect(result.entries).toHaveLength(1);
    expect(result.continuationToken).toBe('next-page');
    expect(result.hasMore).toBe(false);
    // Extended fields are not in UI type
    expect((result as any).totalCount).toBeUndefined();
  });

  test('roundtrip preserves common fields', () => {
    const result = fromProviderListResult(toProviderListResult(sampleListResult));

    expect(result.entries).toHaveLength(sampleListResult.entries.length);
    expect(result.continuationToken).toBe(sampleListResult.continuationToken);
    expect(result.hasMore).toBe(sampleListResult.hasMore);
  });
});
