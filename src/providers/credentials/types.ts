/**
 * Credential Types
 *
 * Types for the credential provider chain architecture.
 * Credentials are resolved at runtime from various sources.
 */

import type { ProviderType, CredentialSource } from '../types/profile.js';

// Re-export CredentialSource for convenience
export type { CredentialSource };

// ============================================================================
// Credential Types
// ============================================================================

/**
 * Base credentials interface - all credential types share these
 */
export interface BaseCredentials {
  /** Source where credentials were resolved from */
  source: CredentialSourceType;
  /** When credentials expire (if applicable) */
  expiresAt?: Date;
}

/**
 * Credential source type identifiers
 */
export type CredentialSourceType =
  | 'encryptedConfig'
  | 'keychain'
  | 'environment'
  | 'sshAgent'
  | 'awsProfile'
  | 'gcpAdc'
  | 'file'
  | 'prompt'
  | 'inline'; // For credentials stored directly in profile config

/**
 * AWS/S3 credentials
 */
export interface S3Credentials extends BaseCredentials {
  type: 's3';
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

/**
 * GCS credentials
 */
export interface GCSCredentials extends BaseCredentials {
  type: 'gcs';
  /** Service account JSON key content */
  keyFileContent?: string;
  /** Path to service account JSON key file */
  keyFilePath?: string;
  /** Use Application Default Credentials */
  useApplicationDefault?: boolean;
}

/**
 * SFTP credentials
 */
export interface SFTPCredentials extends BaseCredentials {
  type: 'sftp';
  /** Password for password auth */
  password?: string;
  /** Private key content for key auth */
  privateKey?: string;
  /** Passphrase for encrypted private key */
  passphrase?: string;
  /** Use SSH agent */
  useAgent?: boolean;
}

/**
 * FTP credentials
 */
export interface FTPCredentials extends BaseCredentials {
  type: 'ftp';
  username?: string;
  password?: string;
}

/**
 * SMB credentials
 */
export interface SMBCredentials extends BaseCredentials {
  type: 'smb';
  username?: string;
  password?: string;
  domain?: string;
}

/**
 * Google Drive credentials
 */
export interface GoogleDriveCredentials extends BaseCredentials {
  type: 'gdrive';
  /** OAuth access token */
  accessToken?: string;
  /** OAuth refresh token */
  refreshToken?: string;
  /** Service account JSON key content */
  keyFileContent?: string;
}

/**
 * NFS credentials (typically system-level, may be empty)
 */
export interface NFSCredentials extends BaseCredentials {
  type: 'nfs';
  /** Kerberos principal for krb5 auth */
  kerberosPrincipal?: string;
}

/**
 * Local filesystem credentials (no credentials needed)
 */
export interface LocalCredentials extends BaseCredentials {
  type: 'local';
}

/**
 * Union type of all credential types
 */
export type Credentials =
  | S3Credentials
  | GCSCredentials
  | SFTPCredentials
  | FTPCredentials
  | SMBCredentials
  | GoogleDriveCredentials
  | NFSCredentials
  | LocalCredentials;

// ============================================================================
// Credential Provider Interface
// ============================================================================

/**
 * Result of credential resolution
 */
export type CredentialResult<T extends Credentials = Credentials> =
  | { success: true; credentials: T }
  | { success: false; error: CredentialError };

/**
 * Error from credential resolution
 */
export interface CredentialError {
  /** Error code for programmatic handling */
  code: CredentialErrorCode;
  /** Human-readable error message */
  message: string;
  /** Original error if available */
  cause?: Error;
}

/**
 * Credential error codes
 */
export type CredentialErrorCode =
  | 'not_found' // Credentials not found in this source
  | 'access_denied' // Permission denied accessing credential store
  | 'expired' // Credentials have expired
  | 'invalid_format' // Credential data is malformed
  | 'decryption_failed' // Failed to decrypt credentials
  | 'keychain_error' // System keychain error
  | 'network_error' // Network error (for remote credential stores)
  | 'cancelled' // User cancelled prompt
  | 'unsupported' // Credential source not supported for this provider
  | 'unknown'; // Unknown error

/**
 * Context for credential resolution
 */
export interface CredentialContext {
  /** Provider type requesting credentials */
  providerType: ProviderType;
  /** Profile ID (for profile-specific credentials) */
  profileId?: string;
  /** Credential source hint from profile */
  source?: CredentialSource;
  /** Whether to prompt user if credentials not found */
  allowPrompt?: boolean;
}

/**
 * A credential provider resolves credentials from a specific source
 *
 * Providers are tried in priority order by CredentialChain.
 * Each provider returns success with credentials, or failure.
 */
export interface CredentialProvider {
  /** Unique identifier for this provider */
  readonly name: string;

  /** Human-readable description */
  readonly description: string;

  /** Priority (lower = tried first) */
  readonly priority: number;

  /**
   * Check if this provider can handle the given context
   *
   * @param context - Resolution context
   * @returns true if this provider should be tried
   */
  canHandle(context: CredentialContext): boolean;

  /**
   * Attempt to resolve credentials
   *
   * @param context - Resolution context
   * @returns Credential result
   */
  resolve(context: CredentialContext): Promise<CredentialResult>;
}
