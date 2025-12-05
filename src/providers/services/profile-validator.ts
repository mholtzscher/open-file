/**
 * Profile Validation
 *
 * Validates provider profiles for structural correctness.
 * Each provider type has its own validation rules.
 */

import type {
  ProviderType,
  S3Profile,
  GCSProfile,
  SFTPProfile,
  FTPProfile,
  SMBProfile,
  GoogleDriveProfile,
  LocalProfile,
} from '../types/profile.js';
import type { ValidationError, ValidationErrorCode, ValidationResult } from './profile-manager.js';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a validation error
 */
function error(field: string, message: string, code: ValidationErrorCode): ValidationError {
  return { field, message, code };
}

/**
 * Create a "required field" error
 */
function required(field: string): ValidationError {
  return error(field, `${field} is required`, 'required');
}

/**
 * Create an "invalid type" error
 */
function invalidType(field: string, expected: string): ValidationError {
  return error(field, `${field} must be ${expected}`, 'invalid_type');
}

/**
 * Create an "invalid option" error
 */
function invalidOption(field: string, allowed: string[]): ValidationError {
  return error(field, `${field} must be one of: ${allowed.join(', ')}`, 'invalid_option');
}

/**
 * Create an "invalid range" error
 */
function invalidRange(field: string, min: number, max: number): ValidationError {
  return error(field, `${field} must be between ${min} and ${max}`, 'invalid_range');
}

/**
 * Valid profile ID pattern: alphanumeric, hyphens, underscores
 */
const VALID_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * Valid provider types
 */
const VALID_PROVIDER_TYPES: ProviderType[] = ['s3', 'gcs', 'sftp', 'ftp', 'smb', 'gdrive', 'local'];

// ============================================================================
// Base Profile Validation
// ============================================================================

/**
 * Validate base profile fields common to all providers
 */
function validateBaseProfile(profile: unknown): ValidationError[] {
  const errors: ValidationError[] = [];

  if (typeof profile !== 'object' || profile === null) {
    errors.push(invalidType('profile', 'an object'));
    return errors;
  }

  const obj = profile as Record<string, unknown>;

  // id: required, non-empty string, valid characters
  if (obj.id === undefined || obj.id === null) {
    errors.push(required('id'));
  } else if (typeof obj.id !== 'string') {
    errors.push(invalidType('id', 'a string'));
  } else if (obj.id.trim() === '') {
    errors.push(error('id', 'id cannot be empty', 'required'));
  } else if (!VALID_ID_PATTERN.test(obj.id)) {
    errors.push(
      error('id', 'id can only contain letters, numbers, hyphens, and underscores', 'invalid_id')
    );
  }

  // displayName: required, string
  if (obj.displayName === undefined || obj.displayName === null) {
    errors.push(required('displayName'));
  } else if (typeof obj.displayName !== 'string') {
    errors.push(invalidType('displayName', 'a string'));
  }

  // provider: required, valid provider type
  if (obj.provider === undefined || obj.provider === null) {
    errors.push(required('provider'));
  } else if (typeof obj.provider !== 'string') {
    errors.push(invalidType('provider', 'a string'));
  } else if (!VALID_PROVIDER_TYPES.includes(obj.provider as ProviderType)) {
    errors.push(invalidOption('provider', VALID_PROVIDER_TYPES));
  }

  return errors;
}

// ============================================================================
// S3 Profile Validation
// ============================================================================

/**
 * Validate S3-specific profile fields
 */
function validateS3Profile(profile: S3Profile): ValidationError[] {
  const errors: ValidationError[] = [];

  // config: required object
  if (!profile.config || typeof profile.config !== 'object') {
    errors.push(required('config'));
    return errors;
  }

  const config = profile.config;

  // region: optional string
  if (config.region !== undefined && typeof config.region !== 'string') {
    errors.push(invalidType('config.region', 'a string'));
  }

  // profile: optional string (AWS CLI profile name)
  if (config.profile !== undefined && typeof config.profile !== 'string') {
    errors.push(invalidType('config.profile', 'a string'));
  }

  // endpoint: optional string (URL)
  if (config.endpoint !== undefined && typeof config.endpoint !== 'string') {
    errors.push(invalidType('config.endpoint', 'a string'));
  }

  // forcePathStyle: optional boolean
  if (config.forcePathStyle !== undefined && typeof config.forcePathStyle !== 'boolean') {
    errors.push(invalidType('config.forcePathStyle', 'a boolean'));
  }

  return errors;
}

// ============================================================================
// GCS Profile Validation
// ============================================================================

/**
 * Validate GCS-specific profile fields
 */
function validateGCSProfile(profile: GCSProfile): ValidationError[] {
  const errors: ValidationError[] = [];

  // config: required object
  if (!profile.config || typeof profile.config !== 'object') {
    errors.push(required('config'));
    return errors;
  }

  const config = profile.config;

  // projectId: optional string
  if (config.projectId !== undefined && typeof config.projectId !== 'string') {
    errors.push(invalidType('config.projectId', 'a string'));
  }

  // keyFilePath: optional string
  if (config.keyFilePath !== undefined && typeof config.keyFilePath !== 'string') {
    errors.push(invalidType('config.keyFilePath', 'a string'));
  }

  // useApplicationDefault: optional boolean
  if (
    config.useApplicationDefault !== undefined &&
    typeof config.useApplicationDefault !== 'boolean'
  ) {
    errors.push(invalidType('config.useApplicationDefault', 'a boolean'));
  }

  return errors;
}

// ============================================================================
// SFTP Profile Validation
// ============================================================================

/**
 * Validate SFTP-specific profile fields
 */
function validateSFTPProfile(profile: SFTPProfile): ValidationError[] {
  const errors: ValidationError[] = [];

  // config: required object
  if (!profile.config || typeof profile.config !== 'object') {
    errors.push(required('config'));
    return errors;
  }

  const config = profile.config;

  // host: required string
  if (!config.host) {
    errors.push(required('config.host'));
  } else if (typeof config.host !== 'string') {
    errors.push(invalidType('config.host', 'a string'));
  }

  // port: optional number (1-65535)
  if (config.port !== undefined) {
    if (typeof config.port !== 'number') {
      errors.push(invalidType('config.port', 'a number'));
    } else if (config.port < 1 || config.port > 65535) {
      errors.push(invalidRange('config.port', 1, 65535));
    }
  }

  // username: required string
  if (!config.username) {
    errors.push(required('config.username'));
  } else if (typeof config.username !== 'string') {
    errors.push(invalidType('config.username', 'a string'));
  }

  // authMethod: required, must be 'password' | 'key' | 'agent'
  const validAuthMethods = ['password', 'key', 'agent'];
  if (!config.authMethod) {
    errors.push(required('config.authMethod'));
  } else if (!validAuthMethods.includes(config.authMethod)) {
    errors.push(invalidOption('config.authMethod', validAuthMethods));
  }

  // Logical validation based on authMethod
  if (config.authMethod === 'password' && !config.password) {
    errors.push(
      error('config.password', 'password is required when authMethod is "password"', 'required')
    );
  }
  if (config.authMethod === 'key' && !config.privateKeyPath) {
    errors.push(
      error(
        'config.privateKeyPath',
        'privateKeyPath is required when authMethod is "key"',
        'required'
      )
    );
  }

  // password: optional string
  if (config.password !== undefined && typeof config.password !== 'string') {
    errors.push(invalidType('config.password', 'a string'));
  }

  // privateKeyPath: optional string
  if (config.privateKeyPath !== undefined && typeof config.privateKeyPath !== 'string') {
    errors.push(invalidType('config.privateKeyPath', 'a string'));
  }

  // passphrase: optional string
  if (config.passphrase !== undefined && typeof config.passphrase !== 'string') {
    errors.push(invalidType('config.passphrase', 'a string'));
  }

  // basePath: optional string
  if (config.basePath !== undefined && typeof config.basePath !== 'string') {
    errors.push(invalidType('config.basePath', 'a string'));
  }

  return errors;
}

// ============================================================================
// FTP Profile Validation
// ============================================================================

/**
 * Validate FTP-specific profile fields
 */
function validateFTPProfile(profile: FTPProfile): ValidationError[] {
  const errors: ValidationError[] = [];

  // config: required object
  if (!profile.config || typeof profile.config !== 'object') {
    errors.push(required('config'));
    return errors;
  }

  const config = profile.config;

  // host: required string
  if (!config.host) {
    errors.push(required('config.host'));
  } else if (typeof config.host !== 'string') {
    errors.push(invalidType('config.host', 'a string'));
  }

  // port: optional number (1-65535)
  if (config.port !== undefined) {
    if (typeof config.port !== 'number') {
      errors.push(invalidType('config.port', 'a number'));
    } else if (config.port < 1 || config.port > 65535) {
      errors.push(invalidRange('config.port', 1, 65535));
    }
  }

  // username: optional string
  if (config.username !== undefined && typeof config.username !== 'string') {
    errors.push(invalidType('config.username', 'a string'));
  }

  // password: optional string
  if (config.password !== undefined && typeof config.password !== 'string') {
    errors.push(invalidType('config.password', 'a string'));
  }

  // secure: optional boolean or 'implicit'
  if (config.secure !== undefined) {
    if (typeof config.secure !== 'boolean' && config.secure !== 'implicit') {
      errors.push(invalidType('config.secure', 'a boolean or "implicit"'));
    }
  }

  // basePath: optional string
  if (config.basePath !== undefined && typeof config.basePath !== 'string') {
    errors.push(invalidType('config.basePath', 'a string'));
  }

  return errors;
}

// ============================================================================
// SMB Profile Validation
// ============================================================================

/**
 * Validate SMB-specific profile fields
 */
function validateSMBProfile(profile: SMBProfile): ValidationError[] {
  const errors: ValidationError[] = [];

  // config: required object
  if (!profile.config || typeof profile.config !== 'object') {
    errors.push(required('config'));
    return errors;
  }

  const config = profile.config;

  // host: required string
  if (!config.host) {
    errors.push(required('config.host'));
  } else if (typeof config.host !== 'string') {
    errors.push(invalidType('config.host', 'a string'));
  }

  // share: required string
  if (!config.share) {
    errors.push(required('config.share'));
  } else if (typeof config.share !== 'string') {
    errors.push(invalidType('config.share', 'a string'));
  }

  // port: optional number (1-65535)
  if (config.port !== undefined) {
    if (typeof config.port !== 'number') {
      errors.push(invalidType('config.port', 'a number'));
    } else if (config.port < 1 || config.port > 65535) {
      errors.push(invalidRange('config.port', 1, 65535));
    }
  }

  // domain: optional string
  if (config.domain !== undefined && typeof config.domain !== 'string') {
    errors.push(invalidType('config.domain', 'a string'));
  }

  // username: optional string
  if (config.username !== undefined && typeof config.username !== 'string') {
    errors.push(invalidType('config.username', 'a string'));
  }

  // password: optional string
  if (config.password !== undefined && typeof config.password !== 'string') {
    errors.push(invalidType('config.password', 'a string'));
  }

  // version: optional, must be '2.0' | '2.1' | '3.0' | '3.1.1'
  const validVersions = ['2.0', '2.1', '3.0', '3.1.1'];
  if (config.version !== undefined && !validVersions.includes(config.version)) {
    errors.push(invalidOption('config.version', validVersions));
  }

  // encryption: optional boolean
  if (config.encryption !== undefined && typeof config.encryption !== 'boolean') {
    errors.push(invalidType('config.encryption', 'a boolean'));
  }

  return errors;
}

// ============================================================================
// Google Drive Profile Validation
// ============================================================================

/**
 * Validate Google Drive-specific profile fields
 */
function validateGoogleDriveProfile(profile: GoogleDriveProfile): ValidationError[] {
  const errors: ValidationError[] = [];

  // config: required object
  if (!profile.config || typeof profile.config !== 'object') {
    errors.push(required('config'));
    return errors;
  }

  const config = profile.config;

  // clientId: required string
  if (!config.clientId) {
    errors.push(required('config.clientId'));
  } else if (typeof config.clientId !== 'string') {
    errors.push(invalidType('config.clientId', 'a string'));
  }

  // clientSecret: required string
  if (!config.clientSecret) {
    errors.push(required('config.clientSecret'));
  } else if (typeof config.clientSecret !== 'string') {
    errors.push(invalidType('config.clientSecret', 'a string'));
  }

  // refreshToken: optional string
  if (config.refreshToken !== undefined && typeof config.refreshToken !== 'string') {
    errors.push(invalidType('config.refreshToken', 'a string'));
  }

  // keyFilePath: optional string
  if (config.keyFilePath !== undefined && typeof config.keyFilePath !== 'string') {
    errors.push(invalidType('config.keyFilePath', 'a string'));
  }

  // impersonateEmail: optional string
  if (config.impersonateEmail !== undefined && typeof config.impersonateEmail !== 'string') {
    errors.push(invalidType('config.impersonateEmail', 'a string'));
  }

  // rootFolderId: optional string
  if (config.rootFolderId !== undefined && typeof config.rootFolderId !== 'string') {
    errors.push(invalidType('config.rootFolderId', 'a string'));
  }

  // includeSharedDrives: optional boolean
  if (config.includeSharedDrives !== undefined && typeof config.includeSharedDrives !== 'boolean') {
    errors.push(invalidType('config.includeSharedDrives', 'a boolean'));
  }

  // exportFormat: optional, must be 'pdf' | 'docx' | 'txt'
  const validExportFormats = ['pdf', 'docx', 'txt'];
  if (config.exportFormat !== undefined && !validExportFormats.includes(config.exportFormat)) {
    errors.push(invalidOption('config.exportFormat', validExportFormats));
  }

  // cacheTtlMs: optional number (positive)
  if (config.cacheTtlMs !== undefined) {
    if (typeof config.cacheTtlMs !== 'number') {
      errors.push(invalidType('config.cacheTtlMs', 'a number'));
    } else if (config.cacheTtlMs < 0) {
      errors.push(invalidRange('config.cacheTtlMs', 0, Number.MAX_SAFE_INTEGER));
    }
  }

  return errors;
}

// ============================================================================
// Local Profile Validation
// ============================================================================

/**
 * Validate Local-specific profile fields
 */
function validateLocalProfile(profile: LocalProfile): ValidationError[] {
  const errors: ValidationError[] = [];

  // config: required object
  if (!profile.config || typeof profile.config !== 'object') {
    errors.push(required('config'));
    return errors;
  }

  const config = profile.config;

  // basePath: required string
  if (!config.basePath) {
    errors.push(required('config.basePath'));
  } else if (typeof config.basePath !== 'string') {
    errors.push(invalidType('config.basePath', 'a string'));
  }

  return errors;
}

// ============================================================================
// Main Validation Function
// ============================================================================

/**
 * Validate a profile
 *
 * Performs structural validation:
 * - Base fields (id, displayName, provider)
 * - Provider-specific fields
 *
 * Does NOT validate:
 * - Connection/credentials (use createProviderFromProfile with testConnection)
 * - File existence (keyFilePath, privateKeyPath)
 *
 * @param profile - Profile to validate
 * @returns ValidationResult with any errors found
 */
export function validateProfile(profile: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate base fields
  const baseErrors = validateBaseProfile(profile);
  errors.push(...baseErrors);

  // If base validation failed severely, return early
  if (typeof profile !== 'object' || profile === null) {
    return { valid: false, errors };
  }

  const obj = profile as Record<string, unknown>;

  // If provider is invalid, we can't do provider-specific validation
  if (!obj.provider || !VALID_PROVIDER_TYPES.includes(obj.provider as ProviderType)) {
    return { valid: errors.length === 0, errors };
  }

  // Provider-specific validation
  switch (obj.provider as ProviderType) {
    case 's3':
      errors.push(...validateS3Profile(profile as S3Profile));
      break;
    case 'gcs':
      errors.push(...validateGCSProfile(profile as GCSProfile));
      break;
    case 'sftp':
      errors.push(...validateSFTPProfile(profile as SFTPProfile));
      break;
    case 'ftp':
      errors.push(...validateFTPProfile(profile as FTPProfile));
      break;
    case 'smb':
      errors.push(...validateSMBProfile(profile as SMBProfile));
      break;
    case 'gdrive':
      errors.push(...validateGoogleDriveProfile(profile as GoogleDriveProfile));
      break;
    case 'local':
      errors.push(...validateLocalProfile(profile as LocalProfile));
      break;
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if a profile ID is valid
 *
 * @param id - ID to check
 * @returns true if ID is valid
 */
export function isValidProfileId(id: string): boolean {
  return typeof id === 'string' && id.trim() !== '' && VALID_ID_PATTERN.test(id);
}
