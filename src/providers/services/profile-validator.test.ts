/**
 * Tests for profile validation
 */

import { describe, it, expect } from 'bun:test';
import { validateProfile, isValidProfileId } from './profile-validator.js';
import type {
  S3Profile,
  GCSProfile,
  SFTPProfile,
  FTPProfile,
  SMBProfile,
  GoogleDriveProfile,
  LocalProfile,
} from '../types/profile.js';

// ============================================================================
// Test Helpers
// ============================================================================

function expectValid(result: ReturnType<typeof validateProfile>) {
  expect(result.valid).toBe(true);
  expect(result.errors).toHaveLength(0);
}

function expectInvalid(result: ReturnType<typeof validateProfile>, expectedErrorCount?: number) {
  expect(result.valid).toBe(false);
  expect(result.errors.length).toBeGreaterThan(0);
  if (expectedErrorCount !== undefined) {
    expect(result.errors).toHaveLength(expectedErrorCount);
  }
}

function expectErrorOnField(result: ReturnType<typeof validateProfile>, field: string) {
  expect(result.errors.some(e => e.field === field)).toBe(true);
}

function expectErrorCode(result: ReturnType<typeof validateProfile>, code: string) {
  expect(result.errors.some(e => e.code === code)).toBe(true);
}

// ============================================================================
// Base Profile Validation
// ============================================================================

describe('Profile Validator - Base Profile', () => {
  describe('id validation', () => {
    it('should reject missing id', () => {
      const result = validateProfile({
        displayName: 'Test',
        provider: 's3',
        config: {},
      });
      expectInvalid(result);
      expectErrorOnField(result, 'id');
      expectErrorCode(result, 'required');
    });

    it('should reject empty id', () => {
      const result = validateProfile({
        id: '',
        displayName: 'Test',
        provider: 's3',
        config: {},
      });
      expectInvalid(result);
      expectErrorOnField(result, 'id');
    });

    it('should reject whitespace-only id', () => {
      const result = validateProfile({
        id: '   ',
        displayName: 'Test',
        provider: 's3',
        config: {},
      });
      expectInvalid(result);
      expectErrorOnField(result, 'id');
    });

    it('should reject id with invalid characters', () => {
      const result = validateProfile({
        id: 'my profile!',
        displayName: 'Test',
        provider: 's3',
        config: {},
      });
      expectInvalid(result);
      expectErrorOnField(result, 'id');
      expectErrorCode(result, 'invalid_id');
    });

    it('should accept valid id with alphanumeric, hyphens, underscores', () => {
      const result = validateProfile({
        id: 'my-profile_123',
        displayName: 'Test',
        provider: 's3',
        config: { profile: 'default' },
      });
      expectValid(result);
    });

    it('should reject non-string id', () => {
      const result = validateProfile({
        id: 123,
        displayName: 'Test',
        provider: 's3',
        config: { profile: 'default' },
      });
      expectInvalid(result);
      expectErrorOnField(result, 'id');
      expectErrorCode(result, 'invalid_type');
    });
  });

  describe('displayName validation', () => {
    it('should reject missing displayName', () => {
      const result = validateProfile({
        id: 'test',
        provider: 's3',
        config: {},
      });
      expectInvalid(result);
      expectErrorOnField(result, 'displayName');
    });

    it('should reject non-string displayName', () => {
      const result = validateProfile({
        id: 'test',
        displayName: 123,
        provider: 's3',
        config: {},
      });
      expectInvalid(result);
      expectErrorOnField(result, 'displayName');
    });

    it('should accept empty displayName (allowed)', () => {
      const result = validateProfile({
        id: 'test',
        displayName: '',
        provider: 's3',
        config: { profile: 'default' },
      });
      expectValid(result);
    });
  });

  describe('provider validation', () => {
    it('should reject missing provider', () => {
      const result = validateProfile({
        id: 'test',
        displayName: 'Test',
        config: {},
      });
      expectInvalid(result);
      expectErrorOnField(result, 'provider');
    });

    it('should reject invalid provider', () => {
      const result = validateProfile({
        id: 'test',
        displayName: 'Test',
        provider: 'invalid',
        config: {},
      });
      expectInvalid(result);
      expectErrorOnField(result, 'provider');
      expectErrorCode(result, 'invalid_option');
    });

    it('should accept all valid provider types', () => {
      const providers = ['s3', 'gcs', 'sftp', 'ftp', 'smb', 'gdrive', 'local'];
      for (const provider of providers) {
        const profile: Record<string, unknown> = {
          id: 'test',
          displayName: 'Test',
          provider,
          config: {},
        };

        // Add required fields for each provider
        if (provider === 's3') {
          profile.config = { profile: 'default' };
        } else if (provider === 'sftp') {
          profile.config = { host: 'example.com', username: 'user', authMethod: 'agent' };
        } else if (provider === 'smb') {
          profile.config = { host: 'example.com', share: 'documents' };
        } else if (provider === 'gdrive') {
          profile.config = { clientId: 'id', clientSecret: 'secret' };
        } else if (provider === 'local') {
          profile.config = { basePath: '/tmp' };
        } else if (provider === 'ftp') {
          profile.config = { host: 'example.com' };
        }

        const result = validateProfile(profile);
        expect(result.valid).toBe(true);
      }
    });
  });

  describe('edge cases', () => {
    it('should reject null profile', () => {
      const result = validateProfile(null);
      expectInvalid(result);
    });

    it('should reject undefined profile', () => {
      const result = validateProfile(undefined);
      expectInvalid(result);
    });

    it('should reject non-object profile', () => {
      const result = validateProfile('not an object');
      expectInvalid(result);
    });
  });
});

// ============================================================================
// S3 Profile Validation
// ============================================================================

describe('Profile Validator - S3', () => {
  const validS3ProfileWithAwsProfile: S3Profile = {
    id: 'test-s3',
    displayName: 'Test S3',
    provider: 's3',
    config: {
      profile: 'default',
    },
  };

  it('should accept S3 profile with AWS CLI profile', () => {
    const result = validateProfile(validS3ProfileWithAwsProfile);
    expectValid(result);
  });

  it('should accept S3 profile with no profile', () => {
    const profile: S3Profile = {
      id: 'test-s3',
      displayName: 'Test S3',
      provider: 's3',
      config: {
        region: 'us-east-1',
      },
    };
    const result = validateProfile(profile);
    expectValid(result);
  });

  it('should accept S3 profile with all optional fields', () => {
    const profile: S3Profile = {
      ...validS3ProfileWithAwsProfile,
      config: {
        region: 'us-east-1',
        profile: 'default',
        endpoint: 'https://s3.amazonaws.com',
        forcePathStyle: true,
      },
    };
    const result = validateProfile(profile);
    expectValid(result);
  });

  it('should accept S3 profile with empty config', () => {
    const profile: S3Profile = {
      id: 'test-s3',
      displayName: 'Test S3',
      provider: 's3',
      config: {},
    };
    const result = validateProfile(profile);
    expectValid(result);
  });

  it('should reject missing config', () => {
    const result = validateProfile({
      id: 'test',
      displayName: 'Test',
      provider: 's3',
    });
    expectInvalid(result);
    expectErrorOnField(result, 'config');
  });

  it('should reject non-boolean forcePathStyle', () => {
    const result = validateProfile({
      ...validS3ProfileWithAwsProfile,
      config: { profile: 'default', forcePathStyle: 'true' as unknown as boolean },
    });
    expectInvalid(result);
    expectErrorOnField(result, 'config.forcePathStyle');
  });
});

// ============================================================================
// GCS Profile Validation
// ============================================================================

describe('Profile Validator - GCS', () => {
  const validGCSProfile: GCSProfile = {
    id: 'test-gcs',
    displayName: 'Test GCS',
    provider: 'gcs',
    config: {},
  };

  it('should accept minimal valid GCS profile', () => {
    const result = validateProfile(validGCSProfile);
    expectValid(result);
  });

  it('should accept GCS profile with all optional fields', () => {
    const profile: GCSProfile = {
      ...validGCSProfile,
      config: {
        projectId: 'my-project',
        keyFilePath: '/path/to/key.json',
        useApplicationDefault: true,
      },
    };
    const result = validateProfile(profile);
    expectValid(result);
  });

  it('should reject non-boolean useApplicationDefault', () => {
    const result = validateProfile({
      ...validGCSProfile,
      config: { useApplicationDefault: 'true' },
    });
    expectInvalid(result);
    expectErrorOnField(result, 'config.useApplicationDefault');
  });
});

// ============================================================================
// SFTP Profile Validation
// ============================================================================

describe('Profile Validator - SFTP', () => {
  const validSFTPProfile: SFTPProfile = {
    id: 'test-sftp',
    displayName: 'Test SFTP',
    provider: 'sftp',
    config: {
      host: 'example.com',
      username: 'user',
      authMethod: 'agent',
    },
  };

  it('should accept minimal valid SFTP profile', () => {
    const result = validateProfile(validSFTPProfile);
    expectValid(result);
  });

  it('should reject missing host', () => {
    const result = validateProfile({
      ...validSFTPProfile,
      config: { username: 'user', authMethod: 'agent' },
    });
    expectInvalid(result);
    expectErrorOnField(result, 'config.host');
  });

  it('should reject missing username', () => {
    const result = validateProfile({
      ...validSFTPProfile,
      config: { host: 'example.com', authMethod: 'agent' },
    });
    expectInvalid(result);
    expectErrorOnField(result, 'config.username');
  });

  it('should reject missing authMethod', () => {
    const result = validateProfile({
      ...validSFTPProfile,
      config: { host: 'example.com', username: 'user' },
    });
    expectInvalid(result);
    expectErrorOnField(result, 'config.authMethod');
  });

  it('should reject invalid authMethod', () => {
    const result = validateProfile({
      ...validSFTPProfile,
      config: { host: 'example.com', username: 'user', authMethod: 'invalid' },
    });
    expectInvalid(result);
    expectErrorOnField(result, 'config.authMethod');
  });

  it('should require password when authMethod is password', () => {
    const result = validateProfile({
      ...validSFTPProfile,
      config: { host: 'example.com', username: 'user', authMethod: 'password' },
    });
    expectInvalid(result);
    expectErrorOnField(result, 'config.password');
  });

  it('should require privateKeyPath when authMethod is key', () => {
    const result = validateProfile({
      ...validSFTPProfile,
      config: { host: 'example.com', username: 'user', authMethod: 'key' },
    });
    expectInvalid(result);
    expectErrorOnField(result, 'config.privateKeyPath');
  });

  it('should accept password authMethod with password', () => {
    const result = validateProfile({
      ...validSFTPProfile,
      config: { host: 'example.com', username: 'user', authMethod: 'password', password: 'secret' },
    });
    expectValid(result);
  });

  it('should accept key authMethod with privateKeyPath', () => {
    const result = validateProfile({
      ...validSFTPProfile,
      config: {
        host: 'example.com',
        username: 'user',
        authMethod: 'key',
        privateKeyPath: '/path/to/key',
      },
    });
    expectValid(result);
  });

  it('should reject invalid port', () => {
    const result = validateProfile({
      ...validSFTPProfile,
      config: { ...validSFTPProfile.config, port: 70000 },
    });
    expectInvalid(result);
    expectErrorOnField(result, 'config.port');
  });

  it('should accept valid port', () => {
    const result = validateProfile({
      ...validSFTPProfile,
      config: { ...validSFTPProfile.config, port: 2222 },
    });
    expectValid(result);
  });
});

// ============================================================================
// FTP Profile Validation
// ============================================================================

describe('Profile Validator - FTP', () => {
  const validFTPProfile: FTPProfile = {
    id: 'test-ftp',
    displayName: 'Test FTP',
    provider: 'ftp',
    config: {
      host: 'example.com',
    },
  };

  it('should accept minimal valid FTP profile', () => {
    const result = validateProfile(validFTPProfile);
    expectValid(result);
  });

  it('should reject missing host', () => {
    const result = validateProfile({
      ...validFTPProfile,
      config: {},
    });
    expectInvalid(result);
    expectErrorOnField(result, 'config.host');
  });

  it('should accept FTP profile with all optional fields', () => {
    const profile: FTPProfile = {
      ...validFTPProfile,
      config: {
        host: 'example.com',
        port: 21,
        username: 'user',
        password: 'pass',
        secure: true,
        basePath: '/home/user',
      },
    };
    const result = validateProfile(profile);
    expectValid(result);
  });

  it('should accept secure: implicit', () => {
    const result = validateProfile({
      ...validFTPProfile,
      config: { host: 'example.com', secure: 'implicit' },
    });
    expectValid(result);
  });

  it('should reject invalid secure value', () => {
    const result = validateProfile({
      ...validFTPProfile,
      config: { host: 'example.com', secure: 'invalid' },
    });
    expectInvalid(result);
    expectErrorOnField(result, 'config.secure');
  });
});

// ============================================================================
// SMB Profile Validation
// ============================================================================

describe('Profile Validator - SMB', () => {
  const validSMBProfile: SMBProfile = {
    id: 'test-smb',
    displayName: 'Test SMB',
    provider: 'smb',
    config: {
      host: 'example.com',
      share: 'documents',
    },
  };

  it('should accept minimal valid SMB profile', () => {
    const result = validateProfile(validSMBProfile);
    expectValid(result);
  });

  it('should reject missing host', () => {
    const result = validateProfile({
      ...validSMBProfile,
      config: { share: 'documents' },
    });
    expectInvalid(result);
    expectErrorOnField(result, 'config.host');
  });

  it('should reject missing share', () => {
    const result = validateProfile({
      ...validSMBProfile,
      config: { host: 'example.com' },
    });
    expectInvalid(result);
    expectErrorOnField(result, 'config.share');
  });

  it('should accept valid SMB versions', () => {
    for (const version of ['2.0', '2.1', '3.0', '3.1.1']) {
      const result = validateProfile({
        ...validSMBProfile,
        config: { ...validSMBProfile.config, version },
      });
      expectValid(result);
    }
  });

  it('should reject invalid SMB version', () => {
    const result = validateProfile({
      ...validSMBProfile,
      config: { ...validSMBProfile.config, version: '1.0' },
    });
    expectInvalid(result);
    expectErrorOnField(result, 'config.version');
  });

  it('should accept all optional SMB fields', () => {
    const profile: SMBProfile = {
      ...validSMBProfile,
      config: {
        host: 'example.com',
        share: 'documents',
        port: 445,
        domain: 'WORKGROUP',
        username: 'user',
        password: 'pass',
        version: '3.0',
        encryption: true,
      },
    };
    const result = validateProfile(profile);
    expectValid(result);
  });
});

// ============================================================================
// Google Drive Profile Validation
// ============================================================================

describe('Profile Validator - Google Drive', () => {
  const validGDriveProfile: GoogleDriveProfile = {
    id: 'test-gdrive',
    displayName: 'Test GDrive',
    provider: 'gdrive',
    config: {
      clientId: 'client-id',
      clientSecret: 'client-secret',
    },
  };

  it('should accept minimal valid Google Drive profile', () => {
    const result = validateProfile(validGDriveProfile);
    expectValid(result);
  });

  it('should reject missing clientId', () => {
    const result = validateProfile({
      ...validGDriveProfile,
      config: { clientSecret: 'secret' },
    });
    expectInvalid(result);
    expectErrorOnField(result, 'config.clientId');
  });

  it('should reject missing clientSecret', () => {
    const result = validateProfile({
      ...validGDriveProfile,
      config: { clientId: 'id' },
    });
    expectInvalid(result);
    expectErrorOnField(result, 'config.clientSecret');
  });

  it('should accept valid exportFormat values', () => {
    for (const exportFormat of ['pdf', 'docx', 'txt']) {
      const result = validateProfile({
        ...validGDriveProfile,
        config: { ...validGDriveProfile.config, exportFormat },
      });
      expectValid(result);
    }
  });

  it('should reject invalid exportFormat', () => {
    const result = validateProfile({
      ...validGDriveProfile,
      config: { ...validGDriveProfile.config, exportFormat: 'html' },
    });
    expectInvalid(result);
    expectErrorOnField(result, 'config.exportFormat');
  });

  it('should reject negative cacheTtlMs', () => {
    const result = validateProfile({
      ...validGDriveProfile,
      config: { ...validGDriveProfile.config, cacheTtlMs: -1 },
    });
    expectInvalid(result);
    expectErrorOnField(result, 'config.cacheTtlMs');
  });

  it('should accept all optional Google Drive fields', () => {
    const profile: GoogleDriveProfile = {
      ...validGDriveProfile,
      config: {
        clientId: 'id',
        clientSecret: 'secret',
        refreshToken: 'token',
        keyFilePath: '/path/to/key.json',
        impersonateEmail: 'user@example.com',
        rootFolderId: 'folder-id',
        includeSharedDrives: true,
        exportFormat: 'pdf',
        cacheTtlMs: 60000,
      },
    };
    const result = validateProfile(profile);
    expectValid(result);
  });
});

// ============================================================================
// Local Profile Validation
// ============================================================================

describe('Profile Validator - Local', () => {
  const validLocalProfile: LocalProfile = {
    id: 'test-local',
    displayName: 'Test Local',
    provider: 'local',
    config: {
      basePath: '/tmp/test',
    },
  };

  it('should accept minimal valid Local profile', () => {
    const result = validateProfile(validLocalProfile);
    expectValid(result);
  });

  it('should reject missing basePath', () => {
    const result = validateProfile({
      ...validLocalProfile,
      config: {},
    });
    expectInvalid(result);
    expectErrorOnField(result, 'config.basePath');
  });

  it('should reject non-string basePath', () => {
    const result = validateProfile({
      ...validLocalProfile,
      config: { basePath: 123 },
    });
    expectInvalid(result);
    expectErrorOnField(result, 'config.basePath');
  });
});

// ============================================================================
// isValidProfileId
// ============================================================================

describe('isValidProfileId', () => {
  it('should accept valid IDs', () => {
    expect(isValidProfileId('test')).toBe(true);
    expect(isValidProfileId('my-profile')).toBe(true);
    expect(isValidProfileId('my_profile')).toBe(true);
    expect(isValidProfileId('Profile123')).toBe(true);
    expect(isValidProfileId('a-b_c-1_2')).toBe(true);
  });

  it('should reject invalid IDs', () => {
    expect(isValidProfileId('')).toBe(false);
    expect(isValidProfileId('   ')).toBe(false);
    expect(isValidProfileId('my profile')).toBe(false);
    expect(isValidProfileId('my.profile')).toBe(false);
    expect(isValidProfileId('my@profile')).toBe(false);
    expect(isValidProfileId('profile!')).toBe(false);
  });
});
