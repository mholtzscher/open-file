/**
 * Tests for Credential Chain
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  CredentialChain,
  CredentialChainError,
  EnvironmentCredentialProvider,
  InlineCredentialProvider,
  createDefaultCredentialChain,
} from './credential-chain.js';
import type { CredentialProvider, CredentialResult, S3Credentials } from './types.js';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a mock credential provider
 */
function createMockProvider(
  name: string,
  priority: number,
  result: CredentialResult | 'throw',
  canHandle: boolean = true
): CredentialProvider {
  return {
    name,
    description: `Mock provider ${name}`,
    priority,
    canHandle: () => canHandle,
    resolve: async () => {
      if (result === 'throw') {
        throw new Error(`Provider ${name} threw an error`);
      }
      return result;
    },
  };
}

// ============================================================================
// CredentialChain Tests
// ============================================================================

describe('CredentialChain', () => {
  describe('constructor', () => {
    it('should create an empty chain', () => {
      const chain = new CredentialChain();
      expect(chain.getProviders()).toHaveLength(0);
    });
  });

  describe('register', () => {
    it('should register a provider', () => {
      const chain = new CredentialChain();
      const provider = createMockProvider('test', 100, {
        success: false,
        error: { code: 'not_found', message: 'test' },
      });

      chain.register(provider);

      expect(chain.getProviders()).toHaveLength(1);
      expect(chain.getProvider('test')).toBe(provider);
    });

    it('should sort providers by priority', () => {
      const chain = new CredentialChain();
      const low = createMockProvider('low', 300, {
        success: false,
        error: { code: 'not_found', message: 'test' },
      });
      const high = createMockProvider('high', 100, {
        success: false,
        error: { code: 'not_found', message: 'test' },
      });
      const medium = createMockProvider('medium', 200, {
        success: false,
        error: { code: 'not_found', message: 'test' },
      });

      chain.register(low).register(high).register(medium);

      const providers = chain.getProviders();
      expect(providers[0].name).toBe('high');
      expect(providers[1].name).toBe('medium');
      expect(providers[2].name).toBe('low');
    });

    it('should support method chaining', () => {
      const chain = new CredentialChain();
      const p1 = createMockProvider('p1', 100, {
        success: false,
        error: { code: 'not_found', message: 'test' },
      });
      const p2 = createMockProvider('p2', 200, {
        success: false,
        error: { code: 'not_found', message: 'test' },
      });

      const result = chain.register(p1).register(p2);

      expect(result).toBe(chain);
    });
  });

  describe('unregister', () => {
    it('should remove a provider by name', () => {
      const chain = new CredentialChain();
      const provider = createMockProvider('test', 100, {
        success: false,
        error: { code: 'not_found', message: 'test' },
      });
      chain.register(provider);

      const removed = chain.unregister('test');

      expect(removed).toBe(true);
      expect(chain.getProviders()).toHaveLength(0);
    });

    it('should return false for non-existent provider', () => {
      const chain = new CredentialChain();

      const removed = chain.unregister('nonexistent');

      expect(removed).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all providers', () => {
      const chain = new CredentialChain();
      chain.register(
        createMockProvider('p1', 100, {
          success: false,
          error: { code: 'not_found', message: 'test' },
        })
      );
      chain.register(
        createMockProvider('p2', 200, {
          success: false,
          error: { code: 'not_found', message: 'test' },
        })
      );

      chain.clear();

      expect(chain.getProviders()).toHaveLength(0);
    });
  });

  describe('resolve', () => {
    it('should return success from first successful provider', async () => {
      const chain = new CredentialChain();
      const failProvider = createMockProvider('fail', 100, {
        success: false,
        error: { code: 'not_found', message: 'Not found' },
      });
      const successProvider = createMockProvider('success', 200, {
        success: true,
        credentials: {
          type: 's3',
          source: 'environment',
          accessKeyId: 'key',
          secretAccessKey: 'secret',
        },
      });

      chain.register(failProvider).register(successProvider);

      const result = await chain.resolve({ providerType: 's3' });

      expect(result.success).toBe(true);
      expect(result.resolvedBy).toBe('success');
      expect(result.credentials?.type).toBe('s3');
    });

    it('should skip providers that cannot handle context', async () => {
      const chain = new CredentialChain();
      const cannotHandle = createMockProvider(
        'skip',
        100,
        {
          success: true,
          credentials: {
            type: 's3',
            source: 'environment',
            accessKeyId: 'key',
            secretAccessKey: 'secret',
          },
        },
        false
      );
      const canHandle = createMockProvider(
        'use',
        200,
        {
          success: true,
          credentials: {
            type: 's3',
            source: 'inline',
            accessKeyId: 'key2',
            secretAccessKey: 'secret2',
          },
        },
        true
      );

      chain.register(cannotHandle).register(canHandle);

      const result = await chain.resolve({ providerType: 's3' });

      expect(result.success).toBe(true);
      expect(result.resolvedBy).toBe('use');
      expect(result.skipped).toContain('skip');
    });

    it('should collect errors from all failed providers', async () => {
      const chain = new CredentialChain();
      chain.register(
        createMockProvider('p1', 100, {
          success: false,
          error: { code: 'not_found', message: 'P1 not found' },
        })
      );
      chain.register(
        createMockProvider('p2', 200, {
          success: false,
          error: { code: 'access_denied', message: 'P2 access denied' },
        })
      );

      const result = await chain.resolve({ providerType: 's3' });

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].provider).toBe('p1');
      expect(result.errors[1].provider).toBe('p2');
    });

    it('should handle provider exceptions', async () => {
      const chain = new CredentialChain();
      chain.register(createMockProvider('throws', 100, 'throw'));

      const result = await chain.resolve({ providerType: 's3' });

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error.code).toBe('unknown');
    });

    it('should return empty result when no providers registered', async () => {
      const chain = new CredentialChain();

      const result = await chain.resolve({ providerType: 's3' });

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(0);
      expect(result.skipped).toHaveLength(0);
    });
  });

  describe('resolveOrThrow', () => {
    it('should return credentials on success', async () => {
      const chain = new CredentialChain();
      chain.register(
        createMockProvider('success', 100, {
          success: true,
          credentials: {
            type: 's3',
            source: 'environment',
            accessKeyId: 'key',
            secretAccessKey: 'secret',
          },
        })
      );

      const credentials = await chain.resolveOrThrow<S3Credentials>({ providerType: 's3' });

      expect(credentials.type).toBe('s3');
      expect(credentials.accessKeyId).toBe('key');
    });

    it('should throw CredentialChainError on failure', async () => {
      const chain = new CredentialChain();
      chain.register(
        createMockProvider('fail', 100, {
          success: false,
          error: { code: 'not_found', message: 'Not found' },
        })
      );

      try {
        await chain.resolveOrThrow({ providerType: 's3' });
        expect(true).toBe(false); // Should not reach here
      } catch (err) {
        expect(err).toBeInstanceOf(CredentialChainError);
        const chainError = err as CredentialChainError;
        expect(chainError.errors).toHaveLength(1);
      }
    });
  });
});

// ============================================================================
// EnvironmentCredentialProvider Tests
// ============================================================================

describe('EnvironmentCredentialProvider', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear relevant env vars
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.AWS_SESSION_TOKEN;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    delete process.env.SFTP_PASSWORD;
    delete process.env.FTP_PASSWORD;
    delete process.env.SMB_PASSWORD;
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
  });

  describe('S3 credentials', () => {
    it('should resolve S3 credentials from environment', async () => {
      process.env.AWS_ACCESS_KEY_ID = 'AKIAIOSFODNN7EXAMPLE';
      process.env.AWS_SECRET_ACCESS_KEY = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';

      const provider = new EnvironmentCredentialProvider();
      const result = await provider.resolve({ providerType: 's3' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.credentials.type).toBe('s3');
        const s3Creds = result.credentials as S3Credentials;
        expect(s3Creds.accessKeyId).toBe('AKIAIOSFODNN7EXAMPLE');
        expect(s3Creds.source).toBe('environment');
      }
    });

    it('should include session token if present', async () => {
      process.env.AWS_ACCESS_KEY_ID = 'AKIAIOSFODNN7EXAMPLE';
      process.env.AWS_SECRET_ACCESS_KEY = 'secret';
      process.env.AWS_SESSION_TOKEN = 'token123';

      const provider = new EnvironmentCredentialProvider();
      const result = await provider.resolve({ providerType: 's3' });

      expect(result.success).toBe(true);
      if (result.success) {
        const s3Creds = result.credentials as S3Credentials;
        expect(s3Creds.sessionToken).toBe('token123');
      }
    });

    it('should fail if AWS credentials not set', async () => {
      const provider = new EnvironmentCredentialProvider();
      const result = await provider.resolve({ providerType: 's3' });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('not_found');
      }
    });
  });

  describe('GCS credentials', () => {
    it('should resolve GCS credentials from environment', async () => {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = '/path/to/key.json';

      const provider = new EnvironmentCredentialProvider();
      const result = await provider.resolve({ providerType: 'gcs' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.credentials.type).toBe('gcs');
      }
    });
  });

  describe('canHandle', () => {
    it('should return true for all provider types', () => {
      const provider = new EnvironmentCredentialProvider();

      expect(provider.canHandle({ providerType: 's3' })).toBe(true);
      expect(provider.canHandle({ providerType: 'gcs' })).toBe(true);
      expect(provider.canHandle({ providerType: 'sftp' })).toBe(true);
    });
  });
});

// ============================================================================
// InlineCredentialProvider Tests
// ============================================================================

describe('InlineCredentialProvider', () => {
  it('should not handle when no config set', () => {
    const provider = new InlineCredentialProvider();

    expect(provider.canHandle({ providerType: 's3' })).toBe(false);
  });

  it('should handle when config is set', () => {
    const provider = new InlineCredentialProvider();
    provider.setProfileConfig({ accessKeyId: 'key', secretAccessKey: 'secret' });

    expect(provider.canHandle({ providerType: 's3' })).toBe(true);
  });

  it('should resolve S3 credentials from config', async () => {
    const provider = new InlineCredentialProvider();
    provider.setProfileConfig({
      accessKeyId: 'AKIAEXAMPLE',
      secretAccessKey: 'secretkey',
    });

    const result = await provider.resolve({ providerType: 's3' });

    expect(result.success).toBe(true);
    if (result.success) {
      const creds = result.credentials as S3Credentials;
      expect(creds.accessKeyId).toBe('AKIAEXAMPLE');
      expect(creds.source).toBe('inline');
    }
  });

  it('should fail if S3 credentials not in config', async () => {
    const provider = new InlineCredentialProvider();
    provider.setProfileConfig({ region: 'us-east-1' }); // No credentials

    const result = await provider.resolve({ providerType: 's3' });

    expect(result.success).toBe(false);
  });

  it('should resolve local credentials (always succeeds)', async () => {
    const provider = new InlineCredentialProvider();
    provider.setProfileConfig({});

    const result = await provider.resolve({ providerType: 'local' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.credentials.type).toBe('local');
    }
  });
});

// ============================================================================
// createDefaultCredentialChain Tests
// ============================================================================

describe('createDefaultCredentialChain', () => {
  it('should create a chain with default providers', () => {
    const chain = createDefaultCredentialChain();

    expect(chain.getProviders().length).toBeGreaterThan(0);
    expect(chain.getProvider('environment')).toBeDefined();
    expect(chain.getProvider('inline')).toBeDefined();
  });

  it('should have environment provider with higher priority than inline', () => {
    const chain = createDefaultCredentialChain();
    const env = chain.getProvider('environment');
    const inline = chain.getProvider('inline');

    expect(env!.priority).toBeLessThan(inline!.priority);
  });
});

// ============================================================================
// CredentialChainError Tests
// ============================================================================

describe('CredentialChainError', () => {
  it('should store errors and skipped providers', () => {
    const errors = [
      { provider: 'p1', error: { code: 'not_found' as const, message: 'Not found' } },
    ];
    const skipped = ['p2', 'p3'];

    const error = new CredentialChainError('Failed', errors, skipped);

    expect(error.errors).toBe(errors);
    expect(error.skipped).toBe(skipped);
    expect(error.name).toBe('CredentialChainError');
  });

  it('should generate a summary', () => {
    const errors = [
      { provider: 'env', error: { code: 'not_found' as const, message: 'Env var not set' } },
    ];
    const skipped = ['keychain'];

    const error = new CredentialChainError('Resolution failed', errors, skipped);
    const summary = error.getSummary();

    expect(summary).toContain('Resolution failed');
    expect(summary).toContain('env');
    expect(summary).toContain('Env var not set');
    expect(summary).toContain('keychain');
  });
});
