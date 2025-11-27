/**
 * Provider Profile Types
 *
 * Profiles are named configurations for storage providers.
 * Each provider type has its own configuration schema.
 */

/**
 * Supported provider types
 */
export type ProviderType = 's3' | 'gcs' | 'sftp' | 'ftp' | 'nfs' | 'smb' | 'gdrive' | 'local';

/**
 * Base profile that all providers share
 */
export interface BaseProfile {
  /** Unique identifier for this profile */
  id: string;
  /** Human-readable name for UI display */
  displayName: string;
  /** Provider type */
  provider: ProviderType;
}

/**
 * S3-specific profile configuration
 *
 * Authentication must be provided via one of:
 * - AWS CLI profile name (`profile` field)
 * - Explicit credentials (`accessKeyId` + `secretAccessKey`)
 */
export interface S3Profile extends BaseProfile {
  provider: 's3';
  config: S3ProfileConfig;
}

/**
 * S3 configuration options
 *
 * Must provide either:
 * - `profile` (AWS CLI profile name for credential lookup), OR
 * - `accessKeyId` + `secretAccessKey` (explicit credentials)
 */
export interface S3ProfileConfig {
  /** AWS region */
  region?: string;
  /** AWS CLI profile name for credential lookup */
  profile?: string;
  /** Direct credentials (alternative to profile) */
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  /** Custom endpoint for MinIO, LocalStack, etc. */
  endpoint?: string;
  /** Use path-style addressing instead of virtual-hosted-style */
  forcePathStyle?: boolean;
}

/**
 * Check if S3 config uses AWS CLI profile authentication
 */
export function isS3ProfileAuth(config: S3ProfileConfig): boolean {
  return typeof config.profile === 'string' && config.profile.length > 0;
}

/**
 * Check if S3 config uses explicit credentials
 */
export function isS3ExplicitAuth(config: S3ProfileConfig): boolean {
  return (
    typeof config.accessKeyId === 'string' &&
    config.accessKeyId.length > 0 &&
    typeof config.secretAccessKey === 'string' &&
    config.secretAccessKey.length > 0
  );
}

/**
 * Validate that S3 config has valid authentication
 */
export function hasValidS3Auth(config: S3ProfileConfig): boolean {
  return isS3ProfileAuth(config) || isS3ExplicitAuth(config);
}

/**
 * GCS-specific profile configuration
 */
export interface GCSProfile extends BaseProfile {
  provider: 'gcs';
  config: {
    /** Google Cloud project ID */
    projectId?: string;
    /** Path to service account JSON key file */
    keyFilePath?: string;
    /** Use Application Default Credentials */
    useApplicationDefault?: boolean;
  };
}

/**
 * SFTP-specific profile configuration
 */
export interface SFTPProfile extends BaseProfile {
  provider: 'sftp';
  config: {
    /** SSH server hostname */
    host: string;
    /** SSH port (default: 22) */
    port?: number;
    /** SSH username */
    username: string;
    /** Authentication method */
    authMethod: 'password' | 'key' | 'agent';
    /** Password for password auth */
    password?: string;
    /** Path to private key file */
    privateKeyPath?: string;
    /** Passphrase for encrypted private key */
    passphrase?: string;
    /** Starting directory on remote */
    basePath?: string;
  };
}

/**
 * FTP-specific profile configuration
 */
export interface FTPProfile extends BaseProfile {
  provider: 'ftp';
  config: {
    /** FTP server hostname */
    host: string;
    /** FTP port (default: 21) */
    port?: number;
    /** Username (optional for anonymous) */
    username?: string;
    /** Password */
    password?: string;
    /** FTPS mode: false = plain, true = explicit, 'implicit' = implicit */
    secure?: boolean | 'implicit';
    /** Starting directory */
    basePath?: string;
  };
}

/**
 * NFS-specific profile configuration
 */
export interface NFSProfile extends BaseProfile {
  provider: 'nfs';
  config: {
    /** NFS server hostname */
    host: string;
    /** Server export path (e.g., /exports/data) */
    exportPath: string;
    /** NFS version (default: auto-negotiate) */
    version?: 3 | 4 | 4.1 | 4.2;
    /** NFS port (default: 2049) */
    port?: number;
    /** Override local UID */
    uid?: number;
    /** Override local GID */
    gid?: number;
    /** Authentication method */
    authMethod?: 'sys' | 'krb5' | 'krb5i' | 'krb5p';
    /** Additional mount options */
    mountOptions?: string[];
    /** Local mount point (required for OS mount approach) */
    mountPoint?: string;
  };
}

/**
 * SMB/CIFS-specific profile configuration
 */
export interface SMBProfile extends BaseProfile {
  provider: 'smb';
  config: {
    /** SMB server hostname */
    host: string;
    /** Share name (e.g., "documents") */
    share: string;
    /** SMB port (default: 445) */
    port?: number;
    /** AD domain or WORKGROUP */
    domain?: string;
    /** Username */
    username?: string;
    /** Password */
    password?: string;
    /** SMB protocol version */
    version?: '2.0' | '2.1' | '3.0' | '3.1.1';
    /** Enable SMB 3.0+ encryption */
    encryption?: boolean;
  };
}

/**
 * Google Drive-specific profile configuration
 */
export interface GoogleDriveProfile extends BaseProfile {
  provider: 'gdrive';
  config: {
    /** OAuth client ID */
    clientId: string;
    /** OAuth client secret */
    clientSecret: string;
    /** Refresh token (obtained after OAuth flow) */
    refreshToken?: string;
    /** Path to service account JSON key file */
    keyFilePath?: string;
    /** Email to impersonate (for service accounts) */
    impersonateEmail?: string;
    /** Starting folder ID (default: 'root') */
    rootFolderId?: string;
    /** Include shared drives as containers */
    includeSharedDrives?: boolean;
    /** Export format for Google Workspace docs */
    exportFormat?: 'pdf' | 'docx' | 'txt';
    /** Path cache TTL in milliseconds (default: 60000) */
    cacheTtlMs?: number;
  };
}

/**
 * Local filesystem profile (for testing and completeness)
 */
export interface LocalProfile extends BaseProfile {
  provider: 'local';
  config: {
    /** Base path on local filesystem */
    basePath: string;
  };
}

/**
 * Union type of all profile types
 */
export type Profile =
  | S3Profile
  | GCSProfile
  | SFTPProfile
  | FTPProfile
  | NFSProfile
  | SMBProfile
  | GoogleDriveProfile
  | LocalProfile;

/**
 * Credential source types for secure credential management
 *
 * Profiles should reference credentials rather than storing them inline.
 * The credential provider chain resolves these at runtime.
 */
export type CredentialSource =
  | { type: 'encryptedConfig' }
  | { type: 'keychain'; service: string; account: string }
  | { type: 'environment'; variable: string }
  | { type: 'sshAgent' }
  | { type: 'awsProfile'; profileName: string }
  | { type: 'gcpAdc' }
  | { type: 'file'; path: string }
  | { type: 'prompt' };
