/**
 * Tests for Config Encryption
 */

import { describe, it, expect } from 'bun:test';
import {
  encryptConfig,
  decryptConfig,
  isEncrypted,
  getEncryptionVersion,
  validatePassword,
  secureCompare,
  DEFAULT_PASSWORD_REQUIREMENTS,
} from './config-encryption.js';

// ============================================================================
// Test Data
// ============================================================================

const TEST_PASSWORD = 'test-password-123';
const TEST_DATA = {
  profiles: [
    {
      id: 'prod-s3',
      displayName: 'Production S3',
      provider: 's3',
      config: {
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        region: 'us-east-1',
      },
    },
  ],
};

// ============================================================================
// Encryption/Decryption Tests
// ============================================================================

describe('Config Encryption', () => {
  describe('encryptConfig', () => {
    it('should encrypt data successfully', () => {
      const result = encryptConfig(TEST_DATA, TEST_PASSWORD);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(typeof result.data).toBe('string');
        expect(result.data.length).toBeGreaterThan(0);
      }
    });

    it('should produce valid JSON output', () => {
      const result = encryptConfig(TEST_DATA, TEST_PASSWORD);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(() => JSON.parse(result.data)).not.toThrow();
      }
    });

    it('should include magic header', () => {
      const result = encryptConfig(TEST_DATA, TEST_PASSWORD);

      expect(result.success).toBe(true);
      if (result.success) {
        const parsed = JSON.parse(result.data);
        expect(parsed.magic).toBe('OPEN-FILE-ENC');
      }
    });

    it('should include version', () => {
      const result = encryptConfig(TEST_DATA, TEST_PASSWORD);

      expect(result.success).toBe(true);
      if (result.success) {
        const parsed = JSON.parse(result.data);
        expect(parsed.version).toBe(1);
      }
    });

    it('should produce different ciphertext for same data with same password', () => {
      // Due to random salt and IV, each encryption should be different
      const result1 = encryptConfig(TEST_DATA, TEST_PASSWORD);
      const result2 = encryptConfig(TEST_DATA, TEST_PASSWORD);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      if (result1.success && result2.success) {
        expect(result1.data).not.toBe(result2.data);
      }
    });

    it('should handle empty objects', () => {
      const result = encryptConfig({}, TEST_PASSWORD);

      expect(result.success).toBe(true);
    });

    it('should handle arrays', () => {
      const result = encryptConfig([1, 2, 3], TEST_PASSWORD);

      expect(result.success).toBe(true);
    });

    it('should handle strings', () => {
      const result = encryptConfig('hello world', TEST_PASSWORD);

      expect(result.success).toBe(true);
    });

    it('should handle null', () => {
      const result = encryptConfig(null, TEST_PASSWORD);

      expect(result.success).toBe(true);
    });

    it('should handle special characters in data', () => {
      const data = {
        unicode: '日本語 🚀 emoji',
        special: '<script>alert("xss")</script>',
        quotes: 'He said "hello"',
        backslash: 'C:\\Users\\test',
      };

      const result = encryptConfig(data, TEST_PASSWORD);

      expect(result.success).toBe(true);
    });
  });

  describe('decryptConfig', () => {
    it('should decrypt data successfully', () => {
      const encrypted = encryptConfig(TEST_DATA, TEST_PASSWORD);
      expect(encrypted.success).toBe(true);
      if (!encrypted.success) return;

      const decrypted = decryptConfig(encrypted.data, TEST_PASSWORD);

      expect(decrypted.success).toBe(true);
      if (decrypted.success) {
        expect(decrypted.data).toEqual(TEST_DATA);
      }
    });

    it('should fail with wrong password', () => {
      const encrypted = encryptConfig(TEST_DATA, TEST_PASSWORD);
      expect(encrypted.success).toBe(true);
      if (!encrypted.success) return;

      const decrypted = decryptConfig(encrypted.data, 'wrong-password');

      expect(decrypted.success).toBe(false);
      if (!decrypted.success) {
        expect(decrypted.error.code).toBe('invalid_password');
      }
    });

    it('should fail with invalid JSON', () => {
      const result = decryptConfig('not valid json', TEST_PASSWORD);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('invalid_format');
      }
    });

    it('should fail with wrong magic header', () => {
      const fakeEncrypted = JSON.stringify({
        magic: 'WRONG-MAGIC',
        version: 1,
        salt: 'abc',
        iv: 'def',
        authTag: 'ghi',
        ciphertext: 'jkl',
      });

      const result = decryptConfig(fakeEncrypted, TEST_PASSWORD);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('invalid_format');
      }
    });

    it('should fail with unsupported version', () => {
      const fakeEncrypted = JSON.stringify({
        magic: 'OPEN-FILE-ENC',
        version: 999,
        salt: 'abc',
        iv: 'def',
        authTag: 'ghi',
        ciphertext: 'jkl',
      });

      const result = decryptConfig(fakeEncrypted, TEST_PASSWORD);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('version_unsupported');
      }
    });

    it('should handle round-trip with complex data', () => {
      const complexData = {
        string: 'hello',
        number: 42,
        float: 3.14,
        boolean: true,
        null: null,
        array: [1, 'two', { three: 3 }],
        nested: {
          deep: {
            value: 'found',
          },
        },
      };

      const encrypted = encryptConfig(complexData, TEST_PASSWORD);
      expect(encrypted.success).toBe(true);
      if (!encrypted.success) return;

      const decrypted = decryptConfig(encrypted.data, TEST_PASSWORD);

      expect(decrypted.success).toBe(true);
      if (decrypted.success) {
        expect(decrypted.data).toEqual(complexData);
      }
    });
  });

  describe('isEncrypted', () => {
    it('should return true for encrypted data', () => {
      const encrypted = encryptConfig(TEST_DATA, TEST_PASSWORD);
      expect(encrypted.success).toBe(true);
      if (!encrypted.success) return;

      expect(isEncrypted(encrypted.data)).toBe(true);
    });

    it('should return false for plain JSON', () => {
      const plainJson = JSON.stringify(TEST_DATA);

      expect(isEncrypted(plainJson)).toBe(false);
    });

    it('should return false for invalid JSON', () => {
      expect(isEncrypted('not json')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isEncrypted('')).toBe(false);
    });

    it('should return false for JSON with wrong magic', () => {
      const wrongMagic = JSON.stringify({ magic: 'OTHER', version: 1 });

      expect(isEncrypted(wrongMagic)).toBe(false);
    });
  });

  describe('getEncryptionVersion', () => {
    it('should return version for encrypted data', () => {
      const encrypted = encryptConfig(TEST_DATA, TEST_PASSWORD);
      expect(encrypted.success).toBe(true);
      if (!encrypted.success) return;

      expect(getEncryptionVersion(encrypted.data)).toBe(1);
    });

    it('should return undefined for plain JSON', () => {
      expect(getEncryptionVersion(JSON.stringify(TEST_DATA))).toBeUndefined();
    });

    it('should return undefined for invalid JSON', () => {
      expect(getEncryptionVersion('not json')).toBeUndefined();
    });
  });
});

// ============================================================================
// Password Validation Tests
// ============================================================================

describe('Password Validation', () => {
  describe('validatePassword', () => {
    it('should accept valid password with default requirements', () => {
      const errors = validatePassword('password123');

      expect(errors).toHaveLength(0);
    });

    it('should reject short password', () => {
      const errors = validatePassword('short');

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('at least');
    });

    it('should enforce uppercase requirement', () => {
      const errors = validatePassword('lowercase', {
        ...DEFAULT_PASSWORD_REQUIREMENTS,
        requireUppercase: true,
      });

      expect(errors.some(e => e.includes('uppercase'))).toBe(true);
    });

    it('should enforce lowercase requirement', () => {
      const errors = validatePassword('UPPERCASE', {
        ...DEFAULT_PASSWORD_REQUIREMENTS,
        requireLowercase: true,
      });

      expect(errors.some(e => e.includes('lowercase'))).toBe(true);
    });

    it('should enforce numbers requirement', () => {
      const errors = validatePassword('NoNumbers', {
        ...DEFAULT_PASSWORD_REQUIREMENTS,
        requireNumbers: true,
      });

      expect(errors.some(e => e.includes('number'))).toBe(true);
    });

    it('should enforce special characters requirement', () => {
      const errors = validatePassword('NoSpecial1', {
        ...DEFAULT_PASSWORD_REQUIREMENTS,
        requireSpecial: true,
      });

      expect(errors.some(e => e.includes('special'))).toBe(true);
    });

    it('should accept password meeting all requirements', () => {
      const errors = validatePassword('SecurePass123!', {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecial: true,
      });

      expect(errors).toHaveLength(0);
    });
  });

  describe('secureCompare', () => {
    it('should return true for equal strings', () => {
      expect(secureCompare('hello', 'hello')).toBe(true);
    });

    it('should return false for different strings', () => {
      expect(secureCompare('hello', 'world')).toBe(false);
    });

    it('should return false for different length strings', () => {
      expect(secureCompare('short', 'longer string')).toBe(false);
    });

    it('should return true for empty strings', () => {
      expect(secureCompare('', '')).toBe(true);
    });
  });
});

// ============================================================================
// Edge Cases and Security Tests
// ============================================================================

describe('Config Encryption - Security', () => {
  it('should not expose plaintext in encrypted output', () => {
    const sensitiveData = {
      password: 'super-secret-password',
      apiKey: 'sk-1234567890abcdef',
    };

    const encrypted = encryptConfig(sensitiveData, TEST_PASSWORD);
    expect(encrypted.success).toBe(true);
    if (!encrypted.success) return;

    // The encrypted output should not contain the plaintext
    expect(encrypted.data).not.toContain('super-secret-password');
    expect(encrypted.data).not.toContain('sk-1234567890abcdef');
  });

  it('should handle very long data', () => {
    const largeData = {
      content: 'x'.repeat(100000), // 100KB of data
    };

    const encrypted = encryptConfig(largeData, TEST_PASSWORD);
    expect(encrypted.success).toBe(true);
    if (!encrypted.success) return;

    const decrypted = decryptConfig<typeof largeData>(encrypted.data, TEST_PASSWORD);
    expect(decrypted.success).toBe(true);
    if (decrypted.success) {
      expect(decrypted.data.content.length).toBe(100000);
    }
  });

  it('should handle empty password', () => {
    // Empty password is allowed (user's choice)
    const encrypted = encryptConfig(TEST_DATA, '');
    expect(encrypted.success).toBe(true);
    if (!encrypted.success) return;

    const decrypted = decryptConfig(encrypted.data, '');
    expect(decrypted.success).toBe(true);
  });

  it('should handle unicode password', () => {
    const unicodePassword = '密码🔐パスワード';

    const encrypted = encryptConfig(TEST_DATA, unicodePassword);
    expect(encrypted.success).toBe(true);
    if (!encrypted.success) return;

    const decrypted = decryptConfig(encrypted.data, unicodePassword);
    expect(decrypted.success).toBe(true);
  });
});
