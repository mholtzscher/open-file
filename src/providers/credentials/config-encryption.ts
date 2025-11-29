/**
 * Config Encryption
 *
 * Provides portable encrypted storage for sensitive configuration data.
 * Uses Node's crypto module with:
 * - scrypt for key derivation (password → encryption key)
 * - AES-256-GCM for authenticated encryption
 *
 * Format is inspired by rclone's encrypted config:
 * - Magic header to identify encrypted files
 * - Salt stored with ciphertext for portability
 * - All necessary data in a single file
 */

import { scryptSync, randomBytes, createCipheriv, createDecipheriv, timingSafeEqual } from 'crypto';

// ============================================================================
// Constants
// ============================================================================

/** Magic bytes to identify encrypted config files */
const MAGIC_HEADER = 'OPEN-FILE-ENC';

/** Current encryption version */
const VERSION = 1;

/** Encryption algorithm */
const ALGORITHM = 'aes-256-gcm';

/** Key length in bytes (256 bits) */
const KEY_LENGTH = 32;

/** Salt length in bytes */
const SALT_LENGTH = 32;

/** IV/Nonce length in bytes (96 bits recommended for GCM) */
const IV_LENGTH = 12;

/** Auth tag length in bytes (for documentation - GCM handles this automatically) */
// const AUTH_TAG_LENGTH = 16;

/** Scrypt parameters (N=2^14, r=8, p=1) - balance of security and speed */
const SCRYPT_N = 16384; // 2^14 - compatible with most systems
const SCRYPT_R = 8;
const SCRYPT_P = 1;

// ============================================================================
// Types
// ============================================================================

/**
 * Result of encryption/decryption operations
 */
export type EncryptionResult<T> =
  | { success: true; data: T }
  | { success: false; error: EncryptionError };

/**
 * Encryption error
 */
export interface EncryptionError {
  code: EncryptionErrorCode;
  message: string;
  cause?: Error;
}

/**
 * Encryption error codes
 */
export type EncryptionErrorCode =
  | 'invalid_password' // Wrong password or corrupted data
  | 'invalid_format' // Data doesn't match expected format
  | 'version_unsupported' // Encryption version not supported
  | 'crypto_error' // Generic crypto error
  | 'encoding_error'; // JSON encoding/decoding error

/**
 * Encrypted data structure (internal)
 */
interface EncryptedPayload {
  /** Magic header */
  magic: string;
  /** Encryption version */
  version: number;
  /** Salt for key derivation (base64) */
  salt: string;
  /** Initialization vector (base64) */
  iv: string;
  /** Authentication tag (base64) */
  authTag: string;
  /** Encrypted data (base64) */
  ciphertext: string;
}

// ============================================================================
// Key Derivation
// ============================================================================

/**
 * Derive an encryption key from a password using scrypt
 *
 * @param password - User password
 * @param salt - Salt bytes (should be random and stored with ciphertext)
 * @returns Derived key
 */
function deriveKey(password: string, salt: Buffer): Buffer {
  return scryptSync(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
}

// ============================================================================
// Encryption Functions
// ============================================================================

/**
 * Encrypt configuration data with a password
 *
 * The output is a JSON string containing all necessary data to decrypt:
 * - Magic header for identification
 * - Version for future compatibility
 * - Salt, IV, and ciphertext
 *
 * @param data - Configuration data to encrypt (will be JSON-serialized)
 * @param password - Password for encryption
 * @returns Encrypted data as a JSON string
 */
export function encryptConfig<T>(data: T, password: string): EncryptionResult<string> {
  try {
    // Generate random salt and IV
    const salt = randomBytes(SALT_LENGTH);
    const iv = randomBytes(IV_LENGTH);

    // Derive key from password
    const key = deriveKey(password, salt);

    // Serialize data to JSON
    let plaintext: string;
    try {
      plaintext = JSON.stringify(data);
    } catch (err) {
      return {
        success: false,
        error: {
          code: 'encoding_error',
          message: 'Failed to serialize data to JSON',
          cause: err as Error,
        },
      };
    }

    // Encrypt with AES-256-GCM
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Build payload
    const payload: EncryptedPayload = {
      magic: MAGIC_HEADER,
      version: VERSION,
      salt: salt.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      ciphertext: encrypted.toString('base64'),
    };

    return {
      success: true,
      data: JSON.stringify(payload, null, 2),
    };
  } catch (err) {
    return {
      success: false,
      error: {
        code: 'crypto_error',
        message: 'Encryption failed',
        cause: err as Error,
      },
    };
  }
}

/**
 * Decrypt configuration data with a password
 *
 * @param encryptedData - Encrypted data (JSON string from encryptConfig)
 * @param password - Password for decryption
 * @returns Decrypted configuration data
 */
export function decryptConfig<T>(encryptedData: string, password: string): EncryptionResult<T> {
  // Parse payload
  let payload: EncryptedPayload;
  try {
    payload = JSON.parse(encryptedData);
  } catch (err) {
    return {
      success: false,
      error: {
        code: 'invalid_format',
        message: 'Encrypted data is not valid JSON',
        cause: err as Error,
      },
    };
  }

  // Verify magic header
  if (payload.magic !== MAGIC_HEADER) {
    return {
      success: false,
      error: {
        code: 'invalid_format',
        message: 'Data is not an encrypted open-file config',
      },
    };
  }

  // Check version
  if (payload.version !== VERSION) {
    return {
      success: false,
      error: {
        code: 'version_unsupported',
        message: `Encryption version ${payload.version} is not supported (expected ${VERSION})`,
      },
    };
  }

  try {
    // Decode base64 fields
    const salt = Buffer.from(payload.salt, 'base64');
    const iv = Buffer.from(payload.iv, 'base64');
    const authTag = Buffer.from(payload.authTag, 'base64');
    const ciphertext = Buffer.from(payload.ciphertext, 'base64');

    // Derive key from password
    const key = deriveKey(password, salt);

    // Decrypt with AES-256-GCM
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let plaintext: string;
    try {
      plaintext = decipher.update(ciphertext).toString('utf8') + decipher.final('utf8');
    } catch {
      // Authentication failed - wrong password or corrupted data
      return {
        success: false,
        error: {
          code: 'invalid_password',
          message: 'Decryption failed - wrong password or corrupted data',
        },
      };
    }

    // Parse JSON
    let data: T;
    try {
      data = JSON.parse(plaintext);
    } catch (err) {
      return {
        success: false,
        error: {
          code: 'encoding_error',
          message: 'Decrypted data is not valid JSON',
          cause: err as Error,
        },
      };
    }

    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: {
        code: 'crypto_error',
        message: 'Decryption failed',
        cause: err as Error,
      },
    };
  }
}

/**
 * Check if data appears to be encrypted
 *
 * @param data - Data to check
 * @returns true if data appears to be encrypted config
 */
export function isEncrypted(data: string): boolean {
  try {
    const parsed = JSON.parse(data);
    return (
      typeof parsed === 'object' &&
      parsed !== null &&
      parsed.magic === MAGIC_HEADER &&
      typeof parsed.version === 'number'
    );
  } catch {
    return false;
  }
}

/**
 * Get encryption version from encrypted data
 *
 * @param data - Encrypted data
 * @returns Version number or undefined if not encrypted
 */
export function getEncryptionVersion(data: string): number | undefined {
  try {
    const parsed = JSON.parse(data);
    if (parsed.magic === MAGIC_HEADER) {
      return parsed.version;
    }
  } catch {
    // Not valid JSON
  }
  return undefined;
}

// ============================================================================
// Password Validation
// ============================================================================

/**
 * Minimum password requirements
 */
export interface PasswordRequirements {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecial: boolean;
}

/**
 * Default password requirements
 */
export const DEFAULT_PASSWORD_REQUIREMENTS: PasswordRequirements = {
  minLength: 8,
  requireUppercase: false,
  requireLowercase: false,
  requireNumbers: false,
  requireSpecial: false,
};

/**
 * Validate a password against requirements
 *
 * @param password - Password to validate
 * @param requirements - Requirements to check (defaults to minimum length of 8)
 * @returns Array of validation error messages (empty if valid)
 */
export function validatePassword(
  password: string,
  requirements: PasswordRequirements = DEFAULT_PASSWORD_REQUIREMENTS
): string[] {
  const errors: string[] = [];

  if (password.length < requirements.minLength) {
    errors.push(`Password must be at least ${requirements.minLength} characters`);
  }

  if (requirements.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (requirements.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (requirements.requireNumbers && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (requirements.requireSpecial && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return errors;
}

/**
 * Securely compare two strings in constant time
 *
 * @param a - First string
 * @param b - Second string
 * @returns true if strings are equal
 */
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return timingSafeEqual(bufA, bufB);
}
