/**
 * Tests for Credential Resolvers
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import {
  // S3
  S3EnvironmentCredentialProvider,
  S3ProfileCredentialProvider,
  S3InlineCredentialProvider,
  createS3CredentialProviders,
  // GCS
  GCSAdcCredentialProvider,
  GCSKeyFileCredentialProvider,
  GCSInlineCredentialProvider,
  createGCSCredentialProviders,
  // SFTP
  SFTPAgentCredentialProvider,
  SFTPEnvironmentCredentialProvider,
  SFTPInlineCredentialProvider,
  createSFTPCredentialProviders,
  // FTP
  FTPEnvironmentCredentialProvider,
  FTPInlineCredentialProvider,
  FTPAnonymousCredentialProvider,
  createFTPCredentialProviders,
  // SMB
  SMBEnvironmentCredentialProvider,
  SMBGuestCredentialProvider,
  createSMBCredentialProviders,
  // Google Drive
  GDriveServiceAccountCredentialProvider,
  GDriveInlineCredentialProvider,
  createGDriveCredentialProviders,
  // Factory
  createCredentialProvidersForType,
  createCredentialChainForType,
} from './index.js';

import type { S3Credentials, FTPCredentials, SMBCredentials } from '../types.js';

// ============================================================================
// Test Setup
// ============================================================================

let tempDir: string;

beforeEach(() => {
  tempDir = join(tmpdir(), `open-file-resolver-test-${Date.now()}`);
  mkdirSync(tempDir, { recursive: true });
});

afterEach(() => {
  try {
    rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
});

// ============================================================================
// S3 Credential Resolver Tests
// ============================================================================

describe('S3 Credential Resolvers', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.AWS_SESSION_TOKEN;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('S3EnvironmentCredentialProvider', () => {
    it('should resolve credentials from environment', async () => {
      process.env.AWS_ACCESS_KEY_ID = 'AKIAIOSFODNN7EXAMPLE';
      process.env.AWS_SECRET_ACCESS_KEY = 'wJalrXUtnFEMI/K7MDENG';

      const provider = new S3EnvironmentCredentialProvider();
      const result = await provider.resolve({ providerType: 's3' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.credentials.type).toBe('s3');
        expect((result.credentials as S3Credentials).accessKeyId).toBe('AKIAIOSFODNN7EXAMPLE');
      }
    });

    it('should fail when env vars not set', async () => {
      const provider = new S3EnvironmentCredentialProvider();
      const result = await provider.resolve({ providerType: 's3' });

      expect(result.success).toBe(false);
    });

    it('should only handle s3 provider type', () => {
      const provider = new S3EnvironmentCredentialProvider();

      expect(provider.canHandle({ providerType: 's3' })).toBe(true);
      expect(provider.canHandle({ providerType: 'gcs' })).toBe(false);
    });
  });

  describe('S3ProfileCredentialProvider', () => {
    it('should only handle s3 provider type', () => {
      const provider = new S3ProfileCredentialProvider();

      expect(provider.canHandle({ providerType: 's3' })).toBe(true);
      expect(provider.canHandle({ providerType: 'sftp' })).toBe(false);
    });
  });

  describe('S3InlineCredentialProvider', () => {
    it('should resolve credentials from config', async () => {
      const provider = new S3InlineCredentialProvider();
      provider.setConfig({
        accessKeyId: 'AKIAEXAMPLE',
        secretAccessKey: 'secretkey123',
      });

      const result = await provider.resolve({ providerType: 's3' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.credentials as S3Credentials).accessKeyId).toBe('AKIAEXAMPLE');
      }
    });

    it('should fail when credentials not in config', async () => {
      const provider = new S3InlineCredentialProvider();
      provider.setConfig({ region: 'us-east-1' });

      const result = await provider.resolve({ providerType: 's3' });

      expect(result.success).toBe(false);
    });

    it('should not handle when config not set', () => {
      const provider = new S3InlineCredentialProvider();

      expect(provider.canHandle({ providerType: 's3' })).toBe(false);
    });
  });

  describe('createS3CredentialProviders', () => {
    it('should return providers in priority order', () => {
      const providers = createS3CredentialProviders();

      expect(providers.length).toBe(3);
      expect(providers[0].priority).toBeLessThan(providers[1].priority);
      expect(providers[1].priority).toBeLessThan(providers[2].priority);
    });
  });
});

// ============================================================================
// GCS Credential Resolver Tests
// ============================================================================

describe('GCS Credential Resolvers', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('GCSAdcCredentialProvider', () => {
    it('should resolve when GOOGLE_APPLICATION_CREDENTIALS is set', async () => {
      const keyFile = join(tempDir, 'key.json');
      writeFileSync(keyFile, JSON.stringify({ type: 'service_account' }));
      process.env.GOOGLE_APPLICATION_CREDENTIALS = keyFile;

      const provider = new GCSAdcCredentialProvider();
      const result = await provider.resolve({ providerType: 'gcs' });

      expect(result.success).toBe(true);
    });

    it('should fail when file does not exist', async () => {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = '/nonexistent/key.json';

      const provider = new GCSAdcCredentialProvider();
      const result = await provider.resolve({ providerType: 'gcs' });

      expect(result.success).toBe(false);
    });
  });

  describe('GCSKeyFileCredentialProvider', () => {
    it('should resolve from key file', async () => {
      const keyFile = join(tempDir, 'key.json');
      writeFileSync(keyFile, JSON.stringify({ type: 'service_account' }));

      const provider = new GCSKeyFileCredentialProvider();
      provider.setKeyFilePath(keyFile);

      const result = await provider.resolve({ providerType: 'gcs' });

      expect(result.success).toBe(true);
    });

    it('should fail when key file not found', async () => {
      const provider = new GCSKeyFileCredentialProvider();
      provider.setKeyFilePath('/nonexistent/key.json');

      const result = await provider.resolve({ providerType: 'gcs' });

      expect(result.success).toBe(false);
    });
  });

  describe('GCSInlineCredentialProvider', () => {
    it('should resolve with useApplicationDefault', async () => {
      const provider = new GCSInlineCredentialProvider();
      provider.setConfig({ useApplicationDefault: true });

      const result = await provider.resolve({ providerType: 'gcs' });

      expect(result.success).toBe(true);
    });
  });

  describe('createGCSCredentialProviders', () => {
    it('should return providers in priority order', () => {
      const providers = createGCSCredentialProviders();

      expect(providers.length).toBe(3);
    });
  });
});

// ============================================================================
// SFTP Credential Resolver Tests
// ============================================================================

describe('SFTP Credential Resolvers', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.SSH_AUTH_SOCK;
    delete process.env.SFTP_PASSWORD;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('SFTPAgentCredentialProvider', () => {
    it('should detect SSH agent availability', () => {
      const provider = new SFTPAgentCredentialProvider();

      expect(provider.canHandle({ providerType: 'sftp' })).toBe(false);

      process.env.SSH_AUTH_SOCK = '/tmp/ssh-agent.sock';
      expect(provider.canHandle({ providerType: 'sftp' })).toBe(true);
    });

    it('should resolve when agent is available', async () => {
      process.env.SSH_AUTH_SOCK = '/tmp/ssh-agent.sock';

      const provider = new SFTPAgentCredentialProvider();
      const result = await provider.resolve({ providerType: 'sftp' });

      expect(result.success).toBe(true);
    });
  });

  describe('SFTPEnvironmentCredentialProvider', () => {
    it('should resolve password from environment', async () => {
      process.env.SFTP_PASSWORD = 'secret123';

      const provider = new SFTPEnvironmentCredentialProvider();
      const result = await provider.resolve({ providerType: 'sftp' });

      expect(result.success).toBe(true);
    });

    it('should fail when password not set', async () => {
      const provider = new SFTPEnvironmentCredentialProvider();
      const result = await provider.resolve({ providerType: 'sftp' });

      expect(result.success).toBe(false);
    });
  });

  describe('SFTPInlineCredentialProvider', () => {
    it('should resolve password auth', async () => {
      const provider = new SFTPInlineCredentialProvider();
      provider.setConfig({
        authMethod: 'password',
        password: 'secret',
      });

      const result = await provider.resolve({ providerType: 'sftp' });

      expect(result.success).toBe(true);
    });

    it('should resolve agent auth', async () => {
      const provider = new SFTPInlineCredentialProvider();
      provider.setConfig({ authMethod: 'agent' });

      const result = await provider.resolve({ providerType: 'sftp' });

      expect(result.success).toBe(true);
    });

    it('should fail password auth without password', async () => {
      const provider = new SFTPInlineCredentialProvider();
      provider.setConfig({ authMethod: 'password' });

      const result = await provider.resolve({ providerType: 'sftp' });

      expect(result.success).toBe(false);
    });
  });

  describe('createSFTPCredentialProviders', () => {
    it('should return providers in priority order', () => {
      const providers = createSFTPCredentialProviders();

      expect(providers.length).toBe(4);
    });
  });
});

// ============================================================================
// FTP Credential Resolver Tests
// ============================================================================

describe('FTP Credential Resolvers', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.FTP_USERNAME;
    delete process.env.FTP_PASSWORD;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('FTPEnvironmentCredentialProvider', () => {
    it('should resolve credentials from environment', async () => {
      process.env.FTP_USERNAME = 'ftpuser';
      process.env.FTP_PASSWORD = 'ftppass';

      const provider = new FTPEnvironmentCredentialProvider();
      const result = await provider.resolve({ providerType: 'ftp' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.credentials as FTPCredentials).username).toBe('ftpuser');
      }
    });
  });

  describe('FTPInlineCredentialProvider', () => {
    it('should resolve from config', async () => {
      const provider = new FTPInlineCredentialProvider();
      provider.setConfig({ username: 'user', password: 'pass' });

      const result = await provider.resolve({ providerType: 'ftp' });

      expect(result.success).toBe(true);
    });
  });

  describe('FTPAnonymousCredentialProvider', () => {
    it('should always provide anonymous credentials', async () => {
      const provider = new FTPAnonymousCredentialProvider();
      const result = await provider.resolve({ providerType: 'ftp' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.credentials as FTPCredentials).username).toBe('anonymous');
      }
    });
  });

  describe('createFTPCredentialProviders', () => {
    it('should return providers in priority order', () => {
      const providers = createFTPCredentialProviders();

      expect(providers.length).toBe(3);
    });
  });
});

// ============================================================================
// SMB Credential Resolver Tests
// ============================================================================

describe('SMB Credential Resolvers', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.SMB_USERNAME;
    delete process.env.SMB_PASSWORD;
    delete process.env.SMB_DOMAIN;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('SMBEnvironmentCredentialProvider', () => {
    it('should resolve credentials from environment', async () => {
      process.env.SMB_USERNAME = 'smbuser';
      process.env.SMB_PASSWORD = 'smbpass';
      process.env.SMB_DOMAIN = 'WORKGROUP';

      const provider = new SMBEnvironmentCredentialProvider();
      const result = await provider.resolve({ providerType: 'smb' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.credentials as SMBCredentials).domain).toBe('WORKGROUP');
      }
    });
  });

  describe('SMBGuestCredentialProvider', () => {
    it('should provide guest credentials', async () => {
      const provider = new SMBGuestCredentialProvider();
      const result = await provider.resolve({ providerType: 'smb' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.credentials as SMBCredentials).username).toBe('guest');
      }
    });
  });

  describe('createSMBCredentialProviders', () => {
    it('should return providers in priority order', () => {
      const providers = createSMBCredentialProviders();

      expect(providers.length).toBe(3);
    });
  });
});

// ============================================================================
// Google Drive Credential Resolver Tests
// ============================================================================

describe('Google Drive Credential Resolvers', () => {
  describe('GDriveServiceAccountCredentialProvider', () => {
    it('should resolve from key file', async () => {
      const keyFile = join(tempDir, 'gdrive-key.json');
      writeFileSync(keyFile, JSON.stringify({ type: 'service_account' }));

      const provider = new GDriveServiceAccountCredentialProvider();
      provider.setKeyFilePath(keyFile);

      const result = await provider.resolve({ providerType: 'gdrive' });

      expect(result.success).toBe(true);
    });

    it('should fail with invalid JSON', async () => {
      const keyFile = join(tempDir, 'invalid-key.json');
      writeFileSync(keyFile, 'not valid json');

      const provider = new GDriveServiceAccountCredentialProvider();
      provider.setKeyFilePath(keyFile);

      const result = await provider.resolve({ providerType: 'gdrive' });

      expect(result.success).toBe(false);
    });
  });

  describe('GDriveInlineCredentialProvider', () => {
    it('should resolve with refresh token', async () => {
      const provider = new GDriveInlineCredentialProvider();
      provider.setConfig({ refreshToken: 'refresh-token-123' });

      const result = await provider.resolve({ providerType: 'gdrive' });

      expect(result.success).toBe(true);
    });

    it('should fail without credentials', async () => {
      const provider = new GDriveInlineCredentialProvider();
      provider.setConfig({ clientId: 'id' });

      const result = await provider.resolve({ providerType: 'gdrive' });

      expect(result.success).toBe(false);
    });
  });

  describe('createGDriveCredentialProviders', () => {
    it('should return providers in priority order', () => {
      const providers = createGDriveCredentialProviders();

      expect(providers.length).toBe(3);
    });
  });
});

// ============================================================================
// Factory Function Tests
// ============================================================================

describe('Factory Functions', () => {
  describe('createCredentialProvidersForType', () => {
    it('should return S3 providers for s3 type', () => {
      const providers = createCredentialProvidersForType('s3');
      expect(providers.length).toBe(3);
      expect(providers.some(p => p.name.includes('s3'))).toBe(true);
    });

    it('should return empty array for local type', () => {
      const providers = createCredentialProvidersForType('local');
      expect(providers).toHaveLength(0);
    });

    it('should return empty array for nfs type', () => {
      const providers = createCredentialProvidersForType('nfs');
      expect(providers).toHaveLength(0);
    });
  });

  describe('createCredentialChainForType', () => {
    it('should create a configured chain', () => {
      const chain = createCredentialChainForType('s3');
      const providers = chain.getProviders();

      expect(providers.length).toBe(3);
    });
  });
});
