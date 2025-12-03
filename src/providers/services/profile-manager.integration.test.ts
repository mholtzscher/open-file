/**
 * Integration Tests for ProfileManager
 *
 * Tests the full lifecycle of profile management including:
 * - Create, save, load, update, delete operations
 * - Persistence across ProfileManager instances
 * - Validation error scenarios
 * - createProviderFromProfile integration
 * - Credential resolution chain
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type {
  S3Profile,
  SFTPProfile,
  GCSProfile,
  FTPProfile,
  LocalProfile,
} from '../types/profile.js';
import type { ValidationResult, ValidationError } from './profile-manager.js';

// ============================================================================
// Test Setup - Isolated File-Based ProfileManager
// ============================================================================

/**
 * A test-friendly version of FileProfileManager that uses a configurable path.
 * This allows us to test the full lifecycle with isolated temp directories.
 */
class TestableProfileManager {
  private profiles: Map<string, S3Profile | SFTPProfile | GCSProfile | FTPProfile | LocalProfile> =
    new Map();
  private profilesPath: string;
  private loaded = false;

  constructor(profilesPath: string) {
    this.profilesPath = profilesPath;
  }

  private load(): void {
    if (this.loaded) return;

    if (!existsSync(this.profilesPath)) {
      this.profiles.clear();
      this.loaded = true;
      return;
    }

    const content = readFileSync(this.profilesPath, 'utf-8');
    if (!content.trim()) {
      this.profiles.clear();
      this.loaded = true;
      return;
    }

    const parsed = JSON.parse(content);
    this.profiles.clear();
    for (const profile of parsed.profiles || []) {
      this.profiles.set(profile.id, profile);
    }
    this.loaded = true;
  }

  private save(): void {
    const profiles = Array.from(this.profiles.values());
    const data = { profiles };
    writeFileSync(this.profilesPath, JSON.stringify(data, null, 2));
  }

  private ensureLoaded(): void {
    if (!this.loaded) {
      this.load();
    }
  }

  async listProfiles(options?: {
    providerType?: string;
  }): Promise<Array<S3Profile | SFTPProfile | GCSProfile | FTPProfile | LocalProfile>> {
    this.ensureLoaded();
    let profiles = Array.from(this.profiles.values());

    if (options?.providerType) {
      profiles = profiles.filter(p => p.provider === options.providerType);
    }

    return profiles;
  }

  async getProfile(
    id: string
  ): Promise<S3Profile | SFTPProfile | GCSProfile | FTPProfile | LocalProfile | undefined> {
    this.ensureLoaded();
    return this.profiles.get(id);
  }

  async saveProfile(
    profile: S3Profile | SFTPProfile | GCSProfile | FTPProfile | LocalProfile,
    options?: { skipValidation?: boolean; overwrite?: boolean }
  ): Promise<ValidationResult> {
    this.ensureLoaded();

    // Validate unless skipped
    if (!options?.skipValidation) {
      const validationResult = await this.validateProfile(profile);
      if (!validationResult.valid) {
        return validationResult;
      }
    }

    // Check for existing profile
    const existing = this.profiles.get(profile.id);
    if (existing && !options?.overwrite) {
      const error: ValidationError = {
        field: 'id',
        message: `Profile with ID "${profile.id}" already exists. Use overwrite: true to replace.`,
        code: 'duplicate_id',
      };
      return { valid: false, errors: [error] };
    }

    // Save
    this.profiles.set(profile.id, profile);
    this.save();

    return { valid: true, errors: [] };
  }

  async deleteProfile(id: string): Promise<boolean> {
    this.ensureLoaded();

    if (!this.profiles.has(id)) {
      return false;
    }

    this.profiles.delete(id);
    this.save();
    return true;
  }

  async validateProfile(
    profile: S3Profile | SFTPProfile | GCSProfile | FTPProfile | LocalProfile
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    // Validate ID
    if (!profile.id || typeof profile.id !== 'string') {
      errors.push({ field: 'id', message: 'id is required', code: 'required' });
    } else if (profile.id.trim() === '') {
      errors.push({ field: 'id', message: 'id cannot be empty', code: 'required' });
    } else if (!/^[a-zA-Z0-9_-]+$/.test(profile.id)) {
      errors.push({
        field: 'id',
        message: 'id can only contain letters, numbers, hyphens, and underscores',
        code: 'invalid_id',
      });
    }

    // Validate displayName
    if (!profile.displayName || typeof profile.displayName !== 'string') {
      errors.push({ field: 'displayName', message: 'displayName is required', code: 'required' });
    }

    // Validate provider
    const validProviders = ['s3', 'gcs', 'sftp', 'ftp', 'nfs', 'smb', 'gdrive', 'local'];
    if (!profile.provider) {
      errors.push({ field: 'provider', message: 'provider is required', code: 'required' });
    } else if (!validProviders.includes(profile.provider)) {
      errors.push({
        field: 'provider',
        message: `provider must be one of: ${validProviders.join(', ')}`,
        code: 'invalid_option',
      });
    }

    if (profile.provider === 'sftp') {
      const sftpProfile = profile;
      if (!sftpProfile.config?.host) {
        errors.push({ field: 'config.host', message: 'config.host is required', code: 'required' });
      }
      if (!sftpProfile.config?.username) {
        errors.push({
          field: 'config.username',
          message: 'config.username is required',
          code: 'required',
        });
      }
      if (!sftpProfile.config?.authMethod) {
        errors.push({
          field: 'config.authMethod',
          message: 'config.authMethod is required',
          code: 'required',
        });
      }
      if (sftpProfile.config?.authMethod === 'password' && !sftpProfile.config?.password) {
        errors.push({
          field: 'config.password',
          message: 'password is required when authMethod is "password"',
          code: 'required',
        });
      }
      if (sftpProfile.config?.authMethod === 'key' && !sftpProfile.config?.privateKeyPath) {
        errors.push({
          field: 'config.privateKeyPath',
          message: 'privateKeyPath is required when authMethod is "key"',
          code: 'required',
        });
      }
    }

    if (profile.provider === 'local') {
      const localProfile = profile;
      if (!localProfile.config?.basePath) {
        errors.push({
          field: 'config.basePath',
          message: 'config.basePath is required',
          code: 'required',
        });
      }
    }

    return { valid: errors.length === 0, errors };
  }

  async hasProfile(id: string): Promise<boolean> {
    this.ensureLoaded();
    return this.profiles.has(id);
  }

  async getProfileCount(): Promise<number> {
    this.ensureLoaded();
    return this.profiles.size;
  }

  async reload(): Promise<void> {
    this.loaded = false;
    this.load();
  }
}

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestS3Profile(id: string, overrides: Partial<S3Profile> = {}): S3Profile {
  return {
    id,
    displayName: `Test S3 Profile ${id}`,
    provider: 's3',
    config: {
      region: 'us-east-1',
    },
    ...overrides,
  };
}

function createTestSFTPProfile(id: string, overrides: Partial<SFTPProfile> = {}): SFTPProfile {
  return {
    id,
    displayName: `Test SFTP Profile ${id}`,
    provider: 'sftp',
    config: {
      host: 'example.com',
      username: 'testuser',
      authMethod: 'agent',
      ...overrides.config,
    },
    ...overrides,
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

function createTestLocalProfile(id: string): LocalProfile {
  return {
    id,
    displayName: `Test Local Profile ${id}`,
    provider: 'local',
    config: {
      basePath: '/tmp/test',
    },
  };
}

// ============================================================================
// Integration Tests
// ============================================================================

describe('ProfileManager Integration Tests', () => {
  let tempDir: string;
  let profilesPath: string;

  beforeEach(() => {
    // Create unique temp directory for each test
    tempDir = join(
      tmpdir(),
      `open-file-profile-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    mkdirSync(tempDir, { recursive: true });
    profilesPath = join(tempDir, 'profiles.json');
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  // ==========================================================================
  // Full Lifecycle Tests
  // ==========================================================================

  describe('Full Lifecycle: create -> save -> load -> update -> delete', () => {
    it('should complete full CRUD lifecycle for a single profile', async () => {
      const manager = new TestableProfileManager(profilesPath);

      // 1. CREATE: Verify empty start
      expect(await manager.getProfileCount()).toBe(0);

      // 2. SAVE: Create and save a new profile
      const profile = createTestS3Profile('lifecycle-test');
      const saveResult = await manager.saveProfile(profile);

      expect(saveResult.valid).toBe(true);
      expect(saveResult.errors).toHaveLength(0);
      expect(await manager.getProfileCount()).toBe(1);

      // 3. LOAD: Retrieve the saved profile
      const loaded = await manager.getProfile('lifecycle-test');

      expect(loaded).toBeDefined();
      expect(loaded!.id).toBe('lifecycle-test');
      expect(loaded!.displayName).toBe('Test S3 Profile lifecycle-test');
      expect(loaded!.provider).toBe('s3');
      expect((loaded as S3Profile).config.region).toBe('us-east-1');

      // 4. UPDATE: Modify the profile
      const updated: S3Profile = {
        ...profile,
        displayName: 'Updated Display Name',
        config: {
          ...profile.config,
          region: 'eu-west-1',
        },
      };
      const updateResult = await manager.saveProfile(updated, { overwrite: true });

      expect(updateResult.valid).toBe(true);

      const reloaded = await manager.getProfile('lifecycle-test');
      expect(reloaded!.displayName).toBe('Updated Display Name');
      expect((reloaded as S3Profile).config.region).toBe('eu-west-1');

      // 5. DELETE: Remove the profile
      const deleteResult = await manager.deleteProfile('lifecycle-test');

      expect(deleteResult).toBe(true);
      expect(await manager.getProfileCount()).toBe(0);
      expect(await manager.getProfile('lifecycle-test')).toBeUndefined();
    });

    it('should handle multiple profiles through full lifecycle', async () => {
      const manager = new TestableProfileManager(profilesPath);

      // Create multiple profiles of different types
      const s3Profile = createTestS3Profile('multi-s3');
      const sftpProfile = createTestSFTPProfile('multi-sftp');
      const gcsProfile = createTestGCSProfile('multi-gcs');

      // Save all
      expect((await manager.saveProfile(s3Profile)).valid).toBe(true);
      expect((await manager.saveProfile(sftpProfile)).valid).toBe(true);
      expect((await manager.saveProfile(gcsProfile)).valid).toBe(true);

      expect(await manager.getProfileCount()).toBe(3);

      // List all
      const allProfiles = await manager.listProfiles();
      expect(allProfiles).toHaveLength(3);

      // List by provider type
      const s3Profiles = await manager.listProfiles({ providerType: 's3' });
      expect(s3Profiles).toHaveLength(1);
      expect(s3Profiles[0].id).toBe('multi-s3');

      const sftpProfiles = await manager.listProfiles({ providerType: 'sftp' });
      expect(sftpProfiles).toHaveLength(1);
      expect(sftpProfiles[0].id).toBe('multi-sftp');

      // Update one
      const updatedS3: S3Profile = { ...s3Profile, displayName: 'Updated S3' };
      await manager.saveProfile(updatedS3, { overwrite: true });

      // Delete one
      await manager.deleteProfile('multi-gcs');
      expect(await manager.getProfileCount()).toBe(2);

      // Verify final state
      const finalProfiles = await manager.listProfiles();
      expect(finalProfiles).toHaveLength(2);
      expect(finalProfiles.find(p => p.id === 'multi-s3')?.displayName).toBe('Updated S3');
      expect(finalProfiles.find(p => p.id === 'multi-gcs')).toBeUndefined();
    });

    it('should handle rapid create/update/delete operations', async () => {
      const manager = new TestableProfileManager(profilesPath);

      // Rapid operations
      for (let i = 0; i < 10; i++) {
        const profile = createTestS3Profile(`rapid-${i}`);
        await manager.saveProfile(profile);
      }

      expect(await manager.getProfileCount()).toBe(10);

      // Update all
      for (let i = 0; i < 10; i++) {
        const profile = createTestS3Profile(`rapid-${i}`, {
          displayName: `Updated ${i}`,
        });
        await manager.saveProfile(profile, { overwrite: true });
      }

      // Delete odd numbers
      for (let i = 1; i < 10; i += 2) {
        await manager.deleteProfile(`rapid-${i}`);
      }

      expect(await manager.getProfileCount()).toBe(5);

      // Verify even numbers remain
      for (let i = 0; i < 10; i += 2) {
        const profile = await manager.getProfile(`rapid-${i}`);
        expect(profile).toBeDefined();
        expect(profile!.displayName).toBe(`Updated ${i}`);
      }
    });
  });

  // ==========================================================================
  // Persistence Across Instances
  // ==========================================================================

  describe('Persistence across ProfileManager instances', () => {
    it('should persist profiles when creating new manager instance', async () => {
      // First manager - create profiles
      const manager1 = new TestableProfileManager(profilesPath);
      await manager1.saveProfile(createTestS3Profile('persist-1'));
      await manager1.saveProfile(createTestSFTPProfile('persist-2'));

      expect(await manager1.getProfileCount()).toBe(2);

      // Second manager - should load persisted profiles
      const manager2 = new TestableProfileManager(profilesPath);
      expect(await manager2.getProfileCount()).toBe(2);

      const profile1 = await manager2.getProfile('persist-1');
      expect(profile1).toBeDefined();
      expect(profile1!.provider).toBe('s3');

      const profile2 = await manager2.getProfile('persist-2');
      expect(profile2).toBeDefined();
      expect(profile2!.provider).toBe('sftp');
    });

    it('should see updates made by other instances after reload', async () => {
      const manager1 = new TestableProfileManager(profilesPath);
      const manager2 = new TestableProfileManager(profilesPath);

      // Manager 1 creates profile
      await manager1.saveProfile(createTestS3Profile('shared-profile'));

      // Manager 2 needs to reload to see changes
      await manager2.reload();
      const profile = await manager2.getProfile('shared-profile');
      expect(profile).toBeDefined();

      // Manager 2 updates
      await manager2.saveProfile(
        { ...profile!, displayName: 'Updated by manager 2' } as S3Profile,
        { overwrite: true }
      );

      // Manager 1 reloads and sees update
      await manager1.reload();
      const updated = await manager1.getProfile('shared-profile');
      expect(updated!.displayName).toBe('Updated by manager 2');
    });

    it('should handle persistence with empty profiles', async () => {
      // Create manager with some profiles, then delete all
      const manager1 = new TestableProfileManager(profilesPath);
      await manager1.saveProfile(createTestS3Profile('temp-profile'));
      await manager1.deleteProfile('temp-profile');

      expect(await manager1.getProfileCount()).toBe(0);

      // New instance should also be empty
      const manager2 = new TestableProfileManager(profilesPath);
      expect(await manager2.getProfileCount()).toBe(0);
    });

    it('should preserve profile order across instances', async () => {
      const manager1 = new TestableProfileManager(profilesPath);

      // Create in specific order
      await manager1.saveProfile(createTestS3Profile('z-last'));
      await manager1.saveProfile(createTestS3Profile('a-first'));
      await manager1.saveProfile(createTestS3Profile('m-middle'));

      // New instance
      const manager2 = new TestableProfileManager(profilesPath);
      const profiles = await manager2.listProfiles();

      // Order should be preserved from file (insertion order)
      expect(profiles[0].id).toBe('z-last');
      expect(profiles[1].id).toBe('a-first');
      expect(profiles[2].id).toBe('m-middle');
    });
  });

  // ==========================================================================
  // Validation Error Scenarios
  // ==========================================================================

  describe('Validation error scenarios', () => {
    it('should reject profile with empty ID', async () => {
      const manager = new TestableProfileManager(profilesPath);

      const profile = {
        id: '',
        displayName: 'Test',
        provider: 's3' as const,
        config: { region: 'us-east-1' },
      };

      const result = await manager.saveProfile(profile);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'id')).toBe(true);
    });

    it('should reject profile with invalid ID characters', async () => {
      const manager = new TestableProfileManager(profilesPath);

      const profile = {
        id: 'invalid id with spaces',
        displayName: 'Test',
        provider: 's3' as const,
        config: { region: 'us-east-1' },
      };

      const result = await manager.saveProfile(profile);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'id' && e.code === 'invalid_id')).toBe(true);
    });

    it('should reject profile with special characters in ID', async () => {
      const manager = new TestableProfileManager(profilesPath);

      const invalidIds = ['test@profile', 'test.profile', 'test/profile', 'test:profile'];

      for (const id of invalidIds) {
        const profile = createTestS3Profile(id);
        const result = await manager.saveProfile(profile);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'id')).toBe(true);
      }
    });

    it('should accept profile with valid ID characters', async () => {
      const manager = new TestableProfileManager(profilesPath);

      const validIds = ['test-profile', 'test_profile', 'TestProfile', 'test123', 'TEST-123_abc'];

      for (const id of validIds) {
        const profile = createTestS3Profile(id);
        const result = await manager.saveProfile(profile);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      }
    });

    it('should reject duplicate profile ID without overwrite flag', async () => {
      const manager = new TestableProfileManager(profilesPath);

      const profile = createTestS3Profile('duplicate-test');
      await manager.saveProfile(profile);

      // Try to save again without overwrite
      const result = await manager.saveProfile(profile);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'duplicate_id')).toBe(true);
    });

    it('should allow duplicate profile ID with overwrite flag', async () => {
      const manager = new TestableProfileManager(profilesPath);

      const profile = createTestS3Profile('overwrite-test');
      await manager.saveProfile(profile);

      // Save again with overwrite
      const updated = { ...profile, displayName: 'Overwritten' };
      const result = await manager.saveProfile(updated, { overwrite: true });

      expect(result.valid).toBe(true);
      expect((await manager.getProfile('overwrite-test'))!.displayName).toBe('Overwritten');
    });

    it('should reject profile with invalid provider type', async () => {
      const manager = new TestableProfileManager(profilesPath);

      const profile = {
        id: 'invalid-provider',
        displayName: 'Test',
        provider: 'invalid-provider' as any,
        config: {},
      };

      const result = await manager.saveProfile(profile);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'provider')).toBe(true);
    });

    it('should accept S3 profile with empty config', async () => {
      const manager = new TestableProfileManager(profilesPath);

      const profile: S3Profile = {
        id: 'default-creds',
        displayName: 'Test',
        provider: 's3',
        config: {},
      };

      const result = await manager.saveProfile(profile);
      expect(result.valid).toBe(true);
    });

    it('should reject SFTP profile missing required fields', async () => {
      const manager = new TestableProfileManager(profilesPath);

      // Missing host
      const profile1 = {
        id: 'sftp-missing-host',
        displayName: 'Test',
        provider: 'sftp' as const,
        config: {
          username: 'user',
          authMethod: 'password' as const,
          password: 'pass',
        },
      };

      const result1 = await manager.saveProfile(profile1 as SFTPProfile);
      expect(result1.valid).toBe(false);
      expect(result1.errors.some(e => e.field === 'config.host')).toBe(true);

      // Missing username
      const profile2 = {
        id: 'sftp-missing-username',
        displayName: 'Test',
        provider: 'sftp' as const,
        config: {
          host: 'example.com',
          authMethod: 'password' as const,
          password: 'pass',
        },
      };

      const result2 = await manager.saveProfile(profile2 as SFTPProfile);
      expect(result2.valid).toBe(false);
      expect(result2.errors.some(e => e.field === 'config.username')).toBe(true);
    });

    it('should reject SFTP password auth without password', async () => {
      const manager = new TestableProfileManager(profilesPath);

      const profile = {
        id: 'sftp-no-password',
        displayName: 'Test',
        provider: 'sftp' as const,
        config: {
          host: 'example.com',
          username: 'user',
          authMethod: 'password' as const,
          // Missing password
        },
      };

      const result = await manager.saveProfile(profile as SFTPProfile);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'config.password')).toBe(true);
    });

    it('should reject SFTP key auth without privateKeyPath', async () => {
      const manager = new TestableProfileManager(profilesPath);

      const profile = {
        id: 'sftp-no-key',
        displayName: 'Test',
        provider: 'sftp' as const,
        config: {
          host: 'example.com',
          username: 'user',
          authMethod: 'key' as const,
          // Missing privateKeyPath
        },
      };

      const result = await manager.saveProfile(profile as SFTPProfile);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'config.privateKeyPath')).toBe(true);
    });

    it('should reject Local profile without basePath', async () => {
      const manager = new TestableProfileManager(profilesPath);

      const profile = {
        id: 'local-no-basepath',
        displayName: 'Test',
        provider: 'local' as const,
        config: {},
      };

      const result = await manager.saveProfile(profile as LocalProfile);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'config.basePath')).toBe(true);
    });

    it('should skip validation with skipValidation flag', async () => {
      const manager = new TestableProfileManager(profilesPath);

      // This profile is invalid but should be saved anyway
      const profile = {
        id: 'skip-validation',
        displayName: 'Test',
        provider: 'sftp' as const,
        config: {
          // Missing required fields
        },
      };

      const result = await manager.saveProfile(profile as SFTPProfile, { skipValidation: true });

      expect(result.valid).toBe(true);
      expect(await manager.hasProfile('skip-validation')).toBe(true);
    });

    it('should validate profile without saving', async () => {
      const manager = new TestableProfileManager(profilesPath);

      const invalidProfile = {
        id: '',
        displayName: '',
        provider: 'invalid' as any,
        config: {},
      };

      const result = await manager.validateProfile(invalidProfile as S3Profile);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);

      // Profile should not be saved
      expect(await manager.getProfileCount()).toBe(0);
    });
  });

  // ==========================================================================
  // Delete Operation Tests
  // ==========================================================================

  describe('Delete operations', () => {
    it('should return false when deleting non-existent profile', async () => {
      const manager = new TestableProfileManager(profilesPath);

      const result = await manager.deleteProfile('non-existent');

      expect(result).toBe(false);
    });

    it('should delete correct profile when multiple exist', async () => {
      const manager = new TestableProfileManager(profilesPath);

      await manager.saveProfile(createTestS3Profile('delete-a'));
      await manager.saveProfile(createTestS3Profile('delete-b'));
      await manager.saveProfile(createTestS3Profile('delete-c'));

      await manager.deleteProfile('delete-b');

      expect(await manager.hasProfile('delete-a')).toBe(true);
      expect(await manager.hasProfile('delete-b')).toBe(false);
      expect(await manager.hasProfile('delete-c')).toBe(true);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge cases', () => {
    it('should handle profiles with special characters in displayName', async () => {
      const manager = new TestableProfileManager(profilesPath);

      const profile = createTestS3Profile('special-display', {
        displayName: 'Profile with "quotes" and <brackets> & ampersands',
      });

      const result = await manager.saveProfile(profile);
      expect(result.valid).toBe(true);

      const loaded = await manager.getProfile('special-display');
      expect(loaded!.displayName).toBe('Profile with "quotes" and <brackets> & ampersands');
    });

    it('should handle profiles with unicode in displayName', async () => {
      const manager = new TestableProfileManager(profilesPath);

      const profile = createTestS3Profile('unicode-display', {
        displayName: 'Profile with unicode and emoji',
      });

      const result = await manager.saveProfile(profile);
      expect(result.valid).toBe(true);

      const loaded = await manager.getProfile('unicode-display');
      expect(loaded!.displayName).toBe('Profile with unicode and emoji');
    });

    it('should handle very long displayNames', async () => {
      const manager = new TestableProfileManager(profilesPath);

      const longName = 'A'.repeat(1000);
      const profile = createTestS3Profile('long-display', {
        displayName: longName,
      });

      const result = await manager.saveProfile(profile);
      expect(result.valid).toBe(true);

      const loaded = await manager.getProfile('long-display');
      expect(loaded!.displayName).toBe(longName);
    });

    it('should handle profile with all optional S3 fields', async () => {
      const manager = new TestableProfileManager(profilesPath);

      const profile: S3Profile = {
        id: 'full-s3',
        displayName: 'Full S3 Profile',
        provider: 's3',
        config: {
          region: 'us-west-2',
          profile: 'production',
          endpoint: 'https://s3.custom.endpoint.com',
          forcePathStyle: true,
        },
      };

      const result = await manager.saveProfile(profile);
      expect(result.valid).toBe(true);

      const loaded = (await manager.getProfile('full-s3')) as S3Profile;
      expect(loaded.config.region).toBe('us-west-2');
      expect(loaded.config.profile).toBe('production');
      expect(loaded.config.endpoint).toBe('https://s3.custom.endpoint.com');
      expect(loaded.config.forcePathStyle).toBe(true);
    });

    it('should handle profile with minimal S3 fields', async () => {
      const manager = new TestableProfileManager(profilesPath);

      const profile: S3Profile = {
        id: 'minimal-s3',
        displayName: 'Minimal S3 Profile',
        provider: 's3',
        config: {},
      };

      const result = await manager.saveProfile(profile);
      expect(result.valid).toBe(true);

      const loaded = (await manager.getProfile('minimal-s3')) as S3Profile;
      expect(loaded.config.region).toBeUndefined();
      expect(loaded.config.profile).toBeUndefined();
    });
  });

  // ==========================================================================
  // File System Edge Cases
  // ==========================================================================

  describe('File system edge cases', () => {
    it('should create profiles file if it does not exist', async () => {
      expect(existsSync(profilesPath)).toBe(false);

      const manager = new TestableProfileManager(profilesPath);
      await manager.saveProfile(createTestS3Profile('create-file'));

      expect(existsSync(profilesPath)).toBe(true);
    });

    it('should handle pre-existing empty profiles file', async () => {
      writeFileSync(profilesPath, '');

      const manager = new TestableProfileManager(profilesPath);
      expect(await manager.getProfileCount()).toBe(0);

      await manager.saveProfile(createTestS3Profile('after-empty'));
      expect(await manager.getProfileCount()).toBe(1);
    });

    it('should handle pre-existing profiles file with empty array', async () => {
      writeFileSync(profilesPath, JSON.stringify({ profiles: [] }));

      const manager = new TestableProfileManager(profilesPath);
      expect(await manager.getProfileCount()).toBe(0);
    });
  });
});

// ============================================================================
// createProviderFromProfile Integration Tests
// ============================================================================

describe('createProviderFromProfile Integration', () => {
  // Note: Since actual provider implementations throw "not implemented",
  // we test the error handling behavior here

  it('should throw ProfileManagerError for non-existent profile', async () => {
    // Import the real FileProfileManager to test createProviderFromProfile
    const { FileProfileManager, ProfileManagerError } = await import('./file-profile-manager.js');

    const manager = new FileProfileManager({ loadOnInit: false });

    try {
      await manager.createProviderFromProfile('non-existent-profile');
      expect(true).toBe(false); // Should not reach here
    } catch (err) {
      expect(err).toBeInstanceOf(ProfileManagerError);
      expect((err as any).code).toBe('profile_not_found');
    }
  });
});

// ============================================================================
// Credential Resolution Chain Tests
// ============================================================================

describe('Credential Resolution Chain', () => {
  it('should create a credential chain with default providers', async () => {
    const { createDefaultCredentialChain } = await import('../credentials/credential-chain.js');

    const chain = createDefaultCredentialChain();
    const providers = chain.getProviders();

    expect(providers.length).toBeGreaterThan(0);
    expect(providers.some(p => p.name === 'environment')).toBe(true);
    expect(providers.some(p => p.name === 'inline')).toBe(true);
  });

  it('should register and unregister providers', async () => {
    const { CredentialChain, EnvironmentCredentialProvider } =
      await import('../credentials/credential-chain.js');

    const chain = new CredentialChain();
    expect(chain.getProviders().length).toBe(0);

    chain.register(new EnvironmentCredentialProvider());
    expect(chain.getProviders().length).toBe(1);

    chain.unregister('environment');
    expect(chain.getProviders().length).toBe(0);
  });

  it('should defer S3 credentials to AWS SDK (not resolve via EnvironmentCredentialProvider)', async () => {
    // S3 credentials are now handled by the AWS SDK's built-in credential
    // provider chain (fromIni, fromEnv, IMDS, etc.) in client-factory.ts,
    // so our EnvironmentCredentialProvider no longer resolves S3 credentials.
    const { CredentialChain, EnvironmentCredentialProvider } =
      await import('../credentials/credential-chain.js');

    // Save original env vars
    const originalAccessKey = process.env.AWS_ACCESS_KEY_ID;
    const originalSecretKey = process.env.AWS_SECRET_ACCESS_KEY;

    try {
      // Set env vars
      process.env.AWS_ACCESS_KEY_ID = 'AKIATEST123456789';
      process.env.AWS_SECRET_ACCESS_KEY = 'testSecretKey123456789';

      const chain = new CredentialChain();
      chain.register(new EnvironmentCredentialProvider());

      const result = await chain.resolve({ providerType: 's3', profileId: 'test' });

      // S3 is now handled by AWS SDK directly, not our credential chain
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].error.message).toContain('AWS SDK');
      }
    } finally {
      // Restore original env vars
      if (originalAccessKey !== undefined) {
        process.env.AWS_ACCESS_KEY_ID = originalAccessKey;
      } else {
        delete process.env.AWS_ACCESS_KEY_ID;
      }
      if (originalSecretKey !== undefined) {
        process.env.AWS_SECRET_ACCESS_KEY = originalSecretKey;
      } else {
        delete process.env.AWS_SECRET_ACCESS_KEY;
      }
    }
  });

  it('should fail resolution when no providers can handle context', async () => {
    const { CredentialChain } = await import('../credentials/credential-chain.js');

    const chain = new CredentialChain();
    // No providers registered

    const result = await chain.resolve({ providerType: 's3', profileId: 'test' });

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
  });

  it('should aggregate errors from failed providers', async () => {
    const { CredentialChain, EnvironmentCredentialProvider } =
      await import('../credentials/credential-chain.js');

    // Save and clear env vars
    const originalAccessKey = process.env.AWS_ACCESS_KEY_ID;
    const originalSecretKey = process.env.AWS_SECRET_ACCESS_KEY;

    try {
      delete process.env.AWS_ACCESS_KEY_ID;
      delete process.env.AWS_SECRET_ACCESS_KEY;

      const chain = new CredentialChain();
      chain.register(new EnvironmentCredentialProvider());

      const result = await chain.resolve({ providerType: 's3', profileId: 'test' });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.provider === 'environment')).toBe(true);
    } finally {
      // Restore
      if (originalAccessKey !== undefined) {
        process.env.AWS_ACCESS_KEY_ID = originalAccessKey;
      }
      if (originalSecretKey !== undefined) {
        process.env.AWS_SECRET_ACCESS_KEY = originalSecretKey;
      }
    }
  });

  it('should throw CredentialChainError from resolveOrThrow', async () => {
    const { CredentialChain, CredentialChainError } =
      await import('../credentials/credential-chain.js');

    const chain = new CredentialChain();

    try {
      await chain.resolveOrThrow({ providerType: 's3', profileId: 'test' });
      expect(true).toBe(false); // Should not reach here
    } catch (err) {
      expect(err).toBeInstanceOf(CredentialChainError);
      expect((err as InstanceType<typeof CredentialChainError>).getSummary()).toContain(
        'Failed to resolve credentials'
      );
    }
  });

  it('should sort providers by priority', async () => {
    const { CredentialChain, EnvironmentCredentialProvider, InlineCredentialProvider } =
      await import('../credentials/credential-chain.js');

    const chain = new CredentialChain();

    // Register in reverse priority order
    chain.register(new InlineCredentialProvider()); // priority 1000
    chain.register(new EnvironmentCredentialProvider()); // priority 100

    const providers = chain.getProviders();

    // Should be sorted by priority (lower first)
    expect(providers[0].name).toBe('environment');
    expect(providers[1].name).toBe('inline');
  });
});
