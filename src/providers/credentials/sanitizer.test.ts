/**
 * Tests for Sensitive Data Sanitizer
 */

import { describe, it, expect } from 'bun:test';
import {
  isSensitiveFieldName,
  hasSensitiveData,
  getSensitiveFieldPaths,
  maskValue,
  maskSensitiveFields,
  sanitizeForLogging,
  safeStringify,
  checkForSensitiveDataWarnings,
} from './sanitizer.js';

// ============================================================================
// isSensitiveFieldName Tests
// ============================================================================

describe('isSensitiveFieldName', () => {
  describe('sensitive patterns', () => {
    it('should detect password fields', () => {
      expect(isSensitiveFieldName('password')).toBe(true);
      expect(isSensitiveFieldName('Password')).toBe(true);
      expect(isSensitiveFieldName('PASSWORD')).toBe(true);
      expect(isSensitiveFieldName('userPassword')).toBe(true);
    });

    it('should detect secret fields', () => {
      expect(isSensitiveFieldName('secret')).toBe(true);
      expect(isSensitiveFieldName('secretAccessKey')).toBe(true);
      expect(isSensitiveFieldName('clientSecret')).toBe(true);
    });

    it('should detect token fields', () => {
      expect(isSensitiveFieldName('token')).toBe(true);
      expect(isSensitiveFieldName('accessToken')).toBe(true);
      expect(isSensitiveFieldName('refreshToken')).toBe(true);
      expect(isSensitiveFieldName('sessionToken')).toBe(true);
    });

    it('should detect key fields', () => {
      expect(isSensitiveFieldName('apiKey')).toBe(true);
      expect(isSensitiveFieldName('privateKey')).toBe(true);
    });

    it('should detect credential fields', () => {
      expect(isSensitiveFieldName('credential')).toBe(true);
      expect(isSensitiveFieldName('credentials')).toBe(true);
    });

    it('should detect passphrase fields', () => {
      expect(isSensitiveFieldName('passphrase')).toBe(true);
    });
  });

  describe('safe list', () => {
    it('should not flag accessKeyId as sensitive', () => {
      expect(isSensitiveFieldName('accessKeyId')).toBe(false);
    });

    it('should not flag keyFilePath as sensitive', () => {
      expect(isSensitiveFieldName('keyFilePath')).toBe(false);
    });

    it('should not flag publicKey as sensitive', () => {
      expect(isSensitiveFieldName('publicKey')).toBe(false);
    });

    it('should not flag authMethod as sensitive', () => {
      expect(isSensitiveFieldName('authMethod')).toBe(false);
    });
  });

  describe('non-sensitive fields', () => {
    it('should not flag regular fields', () => {
      expect(isSensitiveFieldName('username')).toBe(false);
      expect(isSensitiveFieldName('host')).toBe(false);
      expect(isSensitiveFieldName('port')).toBe(false);
      expect(isSensitiveFieldName('region')).toBe(false);
      expect(isSensitiveFieldName('displayName')).toBe(false);
    });
  });
});

// ============================================================================
// hasSensitiveData Tests
// ============================================================================

describe('hasSensitiveData', () => {
  it('should return false for null', () => {
    expect(hasSensitiveData(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(hasSensitiveData(undefined)).toBe(false);
  });

  it('should return false for empty object', () => {
    expect(hasSensitiveData({})).toBe(false);
  });

  it('should return false for object without sensitive fields', () => {
    expect(hasSensitiveData({ username: 'test', host: 'example.com' })).toBe(false);
  });

  it('should return true for object with password', () => {
    expect(hasSensitiveData({ password: 'secret123' })).toBe(true);
  });

  it('should return false for empty password', () => {
    expect(hasSensitiveData({ password: '' })).toBe(false);
  });

  it('should return false for null password', () => {
    expect(hasSensitiveData({ password: null })).toBe(false);
  });

  it('should detect nested sensitive fields', () => {
    expect(
      hasSensitiveData({
        config: {
          secretAccessKey: 'abc123',
        },
      })
    ).toBe(true);
  });

  it('should detect sensitive fields in arrays', () => {
    expect(hasSensitiveData([{ password: 'secret' }, { username: 'test' }])).toBe(true);
  });
});

// ============================================================================
// getSensitiveFieldPaths Tests
// ============================================================================

describe('getSensitiveFieldPaths', () => {
  it('should return empty array for no sensitive fields', () => {
    expect(getSensitiveFieldPaths({ username: 'test' })).toEqual([]);
  });

  it('should return paths for sensitive fields', () => {
    const paths = getSensitiveFieldPaths({ password: 'secret' });
    expect(paths).toContain('password');
  });

  it('should return nested paths', () => {
    const paths = getSensitiveFieldPaths({
      config: {
        secretAccessKey: 'abc123',
      },
    });
    expect(paths).toContain('config.secretAccessKey');
  });

  it('should handle array paths', () => {
    const paths = getSensitiveFieldPaths({
      profiles: [{ password: 'secret1' }, { password: 'secret2' }],
    });
    expect(paths).toContain('profiles[0].password');
    expect(paths).toContain('profiles[1].password');
  });

  it('should find multiple sensitive fields', () => {
    const paths = getSensitiveFieldPaths({
      password: 'pass1',
      config: {
        secretAccessKey: 'key1',
        sessionToken: 'token1',
      },
    });
    expect(paths).toHaveLength(3);
  });
});

// ============================================================================
// maskValue Tests
// ============================================================================

describe('maskValue', () => {
  it('should mask with default mask', () => {
    expect(maskValue('secret123')).toBe('********');
  });

  it('should use custom mask', () => {
    expect(maskValue('secret', { mask: '[REDACTED]' })).toBe('[REDACTED]');
  });

  it('should handle null', () => {
    expect(maskValue(null)).toBe('');
  });

  it('should handle undefined', () => {
    expect(maskValue(undefined)).toBe('');
  });

  it('should show partial value', () => {
    const result = maskValue('sk-1234567890abcdef', { showPartial: true });
    expect(result).toBe('sk-***cdef');
  });

  it('should not show partial for short values', () => {
    const result = maskValue('short', { showPartial: true });
    expect(result).toBe('********');
  });
});

// ============================================================================
// maskSensitiveFields Tests
// ============================================================================

describe('maskSensitiveFields', () => {
  it('should return null for null input', () => {
    expect(maskSensitiveFields(null)).toBeNull();
  });

  it('should return undefined for undefined input', () => {
    expect(maskSensitiveFields(undefined)).toBeUndefined();
  });

  it('should mask password field', () => {
    const result = maskSensitiveFields({ password: 'secret123' });
    expect(result.password).toBe('********');
  });

  it('should not mask non-sensitive fields', () => {
    const result = maskSensitiveFields({ username: 'testuser', password: 'secret' });
    expect(result.username).toBe('testuser');
    expect(result.password).toBe('********');
  });

  it('should mask nested fields', () => {
    const result = maskSensitiveFields({
      config: {
        secretAccessKey: 'abc123',
        region: 'us-east-1',
      },
    });
    expect(result.config.secretAccessKey).toBe('********');
    expect(result.config.region).toBe('us-east-1');
  });

  it('should mask fields in arrays', () => {
    const result = maskSensitiveFields([{ password: 'pass1' }, { password: 'pass2' }]);
    expect(result[0].password).toBe('********');
    expect(result[1].password).toBe('********');
  });

  it('should create a deep copy', () => {
    const original = { config: { password: 'secret' } };
    const masked = maskSensitiveFields(original);

    expect(masked.config.password).toBe('********');
    expect(original.config.password).toBe('secret'); // Original unchanged
  });

  it('should handle complex profile', () => {
    const profile = {
      id: 'prod-s3',
      displayName: 'Production S3',
      provider: 's3',
      config: {
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        region: 'us-east-1',
      },
    };

    const masked = maskSensitiveFields(profile);

    expect(masked.id).toBe('prod-s3');
    expect(masked.config.accessKeyId).toBe('AKIAIOSFODNN7EXAMPLE'); // Not sensitive
    expect(masked.config.secretAccessKey).toBe('********'); // Sensitive
    expect(masked.config.region).toBe('us-east-1');
  });
});

// ============================================================================
// sanitizeForLogging Tests
// ============================================================================

describe('sanitizeForLogging', () => {
  it('should mask sensitive fields', () => {
    const result = sanitizeForLogging({ password: 'secret' }) as Record<string, unknown>;
    expect(result.password).toBe('********');
  });

  it('should truncate long strings', () => {
    const longString = 'x'.repeat(200);
    const result = sanitizeForLogging({ data: longString }) as Record<string, unknown>;
    expect((result.data as string).length).toBeLessThan(200);
    expect(result.data).toContain('...');
  });

  it('should handle circular references', () => {
    const obj: Record<string, unknown> = { name: 'test' };
    obj.self = obj;

    const result = sanitizeForLogging(obj) as Record<string, unknown>;
    expect(result.self).toBe('[Circular]');
  });

  it('should preserve structure', () => {
    const obj = {
      user: 'test',
      config: {
        host: 'example.com',
        password: 'secret',
      },
    };

    const result = sanitizeForLogging(obj) as typeof obj;
    expect(result.user).toBe('test');
    expect(result.config.host).toBe('example.com');
    expect(result.config.password).toBe('********');
  });
});

// ============================================================================
// safeStringify Tests
// ============================================================================

describe('safeStringify', () => {
  it('should return JSON string with masked fields', () => {
    const result = safeStringify({ password: 'secret' });
    expect(result).toContain('"password"');
    expect(result).toContain('********');
    expect(result).not.toContain('secret');
  });

  it('should handle unstringifiable objects', () => {
    const obj: Record<string, unknown> = {};
    obj.self = obj;

    // Should not throw
    const result = safeStringify(obj);
    expect(typeof result).toBe('string');
  });

  it('should format with indentation', () => {
    const result = safeStringify({ a: 1, b: 2 }, 2);
    expect(result).toContain('\n');
  });
});

// ============================================================================
// checkForSensitiveDataWarnings Tests
// ============================================================================

describe('checkForSensitiveDataWarnings', () => {
  it('should return empty array for safe profile', () => {
    const warnings = checkForSensitiveDataWarnings({
      id: 'test',
      provider: 's3',
      config: { region: 'us-east-1' },
    });
    expect(warnings).toHaveLength(0);
  });

  it('should warn about plaintext passwords', () => {
    const warnings = checkForSensitiveDataWarnings({
      config: { password: 'secret123' },
    });
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some(w => w.severity === 'warning')).toBe(true);
    expect(warnings.some(w => w.message.includes('plaintext'))).toBe(true);
  });

  it('should warn about inline secret keys', () => {
    const warnings = checkForSensitiveDataWarnings({
      config: { secretAccessKey: 'wJalrXUtnFEMI...' },
    });
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some(w => w.message.includes('secret keys'))).toBe(true);
  });

  it('should info about tokens', () => {
    const warnings = checkForSensitiveDataWarnings({
      config: { refreshToken: 'token123' },
    });
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some(w => w.severity === 'info')).toBe(true);
    expect(warnings.some(w => w.message.includes('tokens'))).toBe(true);
  });

  it('should return null/undefined handling', () => {
    expect(checkForSensitiveDataWarnings(null)).toHaveLength(0);
    expect(checkForSensitiveDataWarnings(undefined)).toHaveLength(0);
  });
});
