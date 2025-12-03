/**
 * Test Fixtures for Provider Testing
 *
 * Provides pre-built mock data for testing provider implementations.
 */

import { Entry, EntryType } from '../../types/entry.js';
import type {
  S3Profile,
  GCSProfile,
  SFTPProfile,
  FTPProfile,
  SMBProfile,
  LocalProfile,
  Profile,
} from '../types/profile.js';

// ============================================================================
// Entry Fixtures
// ============================================================================

/**
 * Create a mock file entry
 */
export function createMockFile(overrides: Partial<Entry> = {}): Entry {
  return {
    id: 'file-1',
    name: 'test-file.txt',
    type: EntryType.File,
    path: '/test-bucket/test-file.txt',
    size: 1024,
    modified: new Date('2025-01-15T10:00:00Z'),
    metadata: {
      contentType: 'text/plain',
      etag: '"abc123"',
    },
    ...overrides,
  };
}

/**
 * Create a mock directory entry
 */
export function createMockDirectory(overrides: Partial<Entry> = {}): Entry {
  return {
    id: 'dir-1',
    name: 'test-folder',
    type: EntryType.Directory,
    path: '/test-bucket/test-folder/',
    size: undefined,
    modified: new Date('2025-01-15T10:00:00Z'),
    ...overrides,
  };
}

/**
 * Create a mock bucket entry
 */
export function createMockBucket(overrides: Partial<Entry> = {}): Entry {
  return {
    id: 'bucket-1',
    name: 'test-bucket',
    type: EntryType.Bucket,
    path: '/test-bucket',
    size: undefined,
    modified: undefined,
    metadata: {
      region: 'us-east-1',
      createdAt: new Date('2024-01-01T00:00:00Z'),
    },
    ...overrides,
  };
}

/**
 * Create a collection of mock entries for testing list operations
 */
export function createMockEntryList(): Entry[] {
  return [
    createMockDirectory({ id: 'dir-1', name: 'documents', path: '/test-bucket/documents/' }),
    createMockDirectory({ id: 'dir-2', name: 'images', path: '/test-bucket/images/' }),
    createMockFile({
      id: 'file-1',
      name: 'readme.txt',
      path: '/test-bucket/readme.txt',
      size: 256,
    }),
    createMockFile({
      id: 'file-2',
      name: 'config.json',
      path: '/test-bucket/config.json',
      size: 512,
      metadata: { contentType: 'application/json' },
    }),
    createMockFile({
      id: 'file-3',
      name: 'data.csv',
      path: '/test-bucket/data.csv',
      size: 2048,
      metadata: { contentType: 'text/csv' },
    }),
  ];
}

/**
 * Create a collection of mock bucket entries
 */
export function createMockBucketList(): Entry[] {
  return [
    createMockBucket({ id: 'bucket-1', name: 'my-bucket', path: '/my-bucket' }),
    createMockBucket({ id: 'bucket-2', name: 'data-bucket', path: '/data-bucket' }),
    createMockBucket({
      id: 'bucket-3',
      name: 'logs-bucket',
      path: '/logs-bucket',
      metadata: { region: 'eu-west-1' },
    }),
  ];
}

// ============================================================================
// Profile Fixtures
// ============================================================================

/**
 * Create a mock S3 profile
 */
export function createMockS3Profile(overrides: Partial<S3Profile> = {}): S3Profile {
  return {
    id: 'test-s3-profile',
    displayName: 'Test S3 Profile',
    provider: 's3',
    config: {
      region: 'us-east-1',
      profile: 'default',
    },
    ...overrides,
  };
}

/**
 * Create a mock S3 profile with LocalStack configuration
 */
export function createMockLocalStackProfile(overrides: Partial<S3Profile> = {}): S3Profile {
  return {
    id: 'localstack-profile',
    displayName: 'LocalStack',
    provider: 's3',
    config: {
      region: 'us-east-1',
      endpoint: 'http://localhost:4566',
      forcePathStyle: true,
    },
    ...overrides,
  };
}

/**
 * Create a mock GCS profile
 */
export function createMockGCSProfile(overrides: Partial<GCSProfile> = {}): GCSProfile {
  return {
    id: 'test-gcs-profile',
    displayName: 'Test GCS Profile',
    provider: 'gcs',
    config: {
      projectId: 'test-project',
      useApplicationDefault: true,
    },
    ...overrides,
  };
}

/**
 * Create a mock SFTP profile
 */
export function createMockSFTPProfile(overrides: Partial<SFTPProfile> = {}): SFTPProfile {
  return {
    id: 'test-sftp-profile',
    displayName: 'Test SFTP Profile',
    provider: 'sftp',
    config: {
      host: 'localhost',
      port: 22,
      username: 'testuser',
      authMethod: 'password',
      password: 'testpass',
      basePath: '/home/testuser',
    },
    ...overrides,
  };
}

/**
 * Create a mock FTP profile
 */
export function createMockFTPProfile(overrides: Partial<FTPProfile> = {}): FTPProfile {
  return {
    id: 'test-ftp-profile',
    displayName: 'Test FTP Profile',
    provider: 'ftp',
    config: {
      host: 'localhost',
      port: 21,
      username: 'anonymous',
      secure: false,
    },
    ...overrides,
  };
}

/**
 * Create a mock SMB profile
 */
export function createMockSMBProfile(overrides: Partial<SMBProfile> = {}): SMBProfile {
  return {
    id: 'test-smb-profile',
    displayName: 'Test SMB Profile',
    provider: 'smb',
    config: {
      host: 'localhost',
      share: 'testshare',
      domain: 'WORKGROUP',
      username: 'testuser',
      password: 'testpass',
    },
    ...overrides,
  };
}

/**
 * Create a mock local filesystem profile
 */
export function createMockLocalProfile(overrides: Partial<LocalProfile> = {}): LocalProfile {
  return {
    id: 'test-local-profile',
    displayName: 'Test Local Profile',
    provider: 'local',
    config: {
      basePath: '/tmp/test-storage',
    },
    ...overrides,
  };
}

/**
 * Create a collection of mock profiles for all provider types
 */
export function createMockProfileCollection(): Profile[] {
  return [
    createMockS3Profile(),
    createMockGCSProfile(),
    createMockSFTPProfile(),
    createMockFTPProfile(),
    createMockSMBProfile(),
    createMockLocalProfile(),
  ];
}

// ============================================================================
// Content Fixtures
// ============================================================================

/**
 * Sample file content for testing read/write operations
 */
export const SAMPLE_TEXT_CONTENT = 'Hello, World!\nThis is a test file.\n';
export const SAMPLE_JSON_CONTENT = JSON.stringify({ key: 'value', count: 42 }, null, 2);
export const SAMPLE_BINARY_CONTENT = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // PNG header

/**
 * Create a buffer of specified size for testing large file operations
 */
export function createLargeContent(sizeInBytes: number): Buffer {
  const buffer = Buffer.alloc(sizeInBytes);
  for (let i = 0; i < sizeInBytes; i++) {
    buffer[i] = i % 256;
  }
  return buffer;
}
