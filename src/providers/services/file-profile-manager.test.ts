/**
 * Tests for FileProfileManager
 */

import { describe, it, expect } from 'bun:test';
import { FileProfileManager, ProfileManagerError } from './file-profile-manager.js';
import type { S3Profile, SFTPProfile, GCSProfile } from '../types/profile.js';

// ============================================================================
// Test Setup
// ============================================================================

// We need to mock the profile storage module to use temp directories
// For now, we'll test the in-memory behavior and integration

// Helper to create test profiles
function createTestS3Profile(id: string, overrides: Partial<S3Profile> = {}): S3Profile {
  return {
    id,
    displayName: `Test S3 Profile ${id}`,
    provider: 's3',
    config: {
      region: 'us-east-1',
      profile: 'default',
    },
    ...overrides,
  };
}

function createTestSFTPProfile(id: string): SFTPProfile {
  return {
    id,
    displayName: `Test SFTP Profile ${id}`,
    provider: 'sftp',
    config: {
      host: 'example.com',
      username: 'testuser',
      authMethod: 'agent',
    },
  };
}

function createTestGCSProfile(id: string): GCSProfile {
  return {
    id,
    displayName: `Test GCS Profile ${id}`,
    provider: 'gcs',
    config: {
      projectId: 'test-project',
    },
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('FileProfileManager', () => {
  describe('constructor', () => {
    it('should create a new instance', () => {
      // This will try to load from the default path, which may or may not exist
      // We just verify it doesn't throw
      const manager = new FileProfileManager({ loadOnInit: false });
      expect(manager).toBeDefined();
    });

    it('should support lazy loading with loadOnInit: false', () => {
      const manager = new FileProfileManager({ loadOnInit: false });
      expect(manager).toBeDefined();
    });
  });

  describe('validateProfile', () => {
    it('should validate a valid S3 profile', async () => {
      const manager = new FileProfileManager({ loadOnInit: false });
      const profile = createTestS3Profile('test-s3');

      const result = await manager.validateProfile(profile);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid profile', async () => {
      const manager = new FileProfileManager({ loadOnInit: false });
      const profile = {
        id: '', // Invalid - empty
        displayName: 'Test',
        provider: 's3',
        config: {},
      } as S3Profile;

      const result = await manager.validateProfile(profile);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate SFTP profile with required fields', async () => {
      const manager = new FileProfileManager({ loadOnInit: false });
      const profile = createTestSFTPProfile('test-sftp');

      const result = await manager.validateProfile(profile);

      expect(result.valid).toBe(true);
    });

    it('should reject SFTP profile missing required fields', async () => {
      const manager = new FileProfileManager({ loadOnInit: false });
      const profile = {
        id: 'test-sftp',
        displayName: 'Test',
        provider: 'sftp',
        config: {
          // Missing host, username, authMethod
        },
      } as unknown as SFTPProfile;

      const result = await manager.validateProfile(profile);

      expect(result.valid).toBe(false);
    });
  });

  describe('CRUD operations (in-memory)', () => {
    // These tests use a manager with loadOnInit: false to test in-memory behavior
    // without actually touching the filesystem

    it('should start with empty profiles when not loading from disk', async () => {
      const manager = new FileProfileManager({ loadOnInit: false });

      const profiles = await manager.listProfiles();

      expect(profiles).toHaveLength(0);
    });

    it('should return undefined for non-existent profile', async () => {
      const manager = new FileProfileManager({ loadOnInit: false });

      const profile = await manager.getProfile('non-existent');

      expect(profile).toBeUndefined();
    });

    it('should report hasProfile correctly', async () => {
      const manager = new FileProfileManager({ loadOnInit: false });

      expect(await manager.hasProfile('test')).toBe(false);
    });

    it('should report correct profile count', async () => {
      const manager = new FileProfileManager({ loadOnInit: false });

      expect(await manager.getProfileCount()).toBe(0);
    });
  });

  describe('createProviderFromProfile', () => {
    it('should throw for non-existent profile', async () => {
      const manager = new FileProfileManager({ loadOnInit: false });

      try {
        await manager.createProviderFromProfile('non-existent');
        expect(true).toBe(false); // Should not reach here
      } catch (err) {
        expect(err).toBeInstanceOf(ProfileManagerError);
        expect((err as ProfileManagerError).code).toBe('profile_not_found');
      }
    });
  });

  describe('listProfiles filtering', () => {
    it('should filter by provider type', async () => {
      // We can't easily test this without mocking saveProfilesToDisk
      // because the manager tries to persist on save
      // This is a placeholder for when we add proper mocking
      const manager = new FileProfileManager({ loadOnInit: false });

      // For now, just verify the filter option is accepted
      const profiles = await manager.listProfiles({ providerType: 's3' });
      expect(Array.isArray(profiles)).toBe(true);
    });
  });
});

describe('FileProfileManager - Error Handling', () => {
  it('should have proper error class', () => {
    const error = new ProfileManagerError('Test error', 'profile_not_found');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ProfileManagerError);
    expect(error.name).toBe('ProfileManagerError');
    expect(error.code).toBe('profile_not_found');
    expect(error.message).toBe('Test error');
  });

  it('should include cause in error', () => {
    const cause = new Error('Original error');
    const error = new ProfileManagerError('Wrapped error', 'load_failed', cause);

    expect(error.cause).toBe(cause);
  });
});

describe('FileProfileManager - Validation Integration', () => {
  it('should validate profile ID format', async () => {
    const manager = new FileProfileManager({ loadOnInit: false });

    // Invalid ID with spaces
    const profile = createTestS3Profile('invalid id');
    const result = await manager.validateProfile(profile);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'id')).toBe(true);
  });

  it('should validate provider type', async () => {
    const manager = new FileProfileManager({ loadOnInit: false });

    const profile = {
      id: 'test',
      displayName: 'Test',
      provider: 'invalid-provider',
      config: {},
    };

    const result = await manager.validateProfile(profile as any);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'provider')).toBe(true);
  });

  it('should accept S3 profile with empty config', async () => {
    const manager = new FileProfileManager({ loadOnInit: false });

    const profile = createTestS3Profile('test', {
      config: {},
    });

    const result = await manager.validateProfile(profile);
    expect(result.valid).toBe(true);
  });

  it('should validate GCS profile', async () => {
    const manager = new FileProfileManager({ loadOnInit: false });

    const profile = createTestGCSProfile('test-gcs');
    const result = await manager.validateProfile(profile);

    expect(result.valid).toBe(true);
  });
});

describe('FileProfileManager - Provider Type Counts', () => {
  it('should return empty map when no profiles', async () => {
    const manager = new FileProfileManager({ loadOnInit: false });

    const counts = await manager.getProfileCountByProvider();

    expect(counts.size).toBe(0);
  });
});
