/**
 * Profile Storage Utilities
 *
 * Platform-aware storage for provider profiles.
 * Handles reading/writing profiles to disk with proper error handling.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'fs';
import { homedir, platform } from 'os';
import { join, dirname } from 'path';
import { parse as parseJsonc, ParseError, printParseErrorCode } from 'jsonc-parser';
import type { Profile, LocalProfile } from '../types/profile.js';

// ============================================================================
// Constants
// ============================================================================

/** Application name for config directories */
const APP_NAME = 'open-file';

/** Profile storage filename (JSONC format for comment support) */
const PROFILES_FILENAME = 'profiles.jsonc';

/**
 * Template for new profiles.jsonc file with helpful comments
 *
 * This template is written when the file doesn't exist, giving users
 * guidance on how to configure their profiles.
 */
const PROFILES_TEMPLATE = `// Open-File Profiles Configuration
// ================================
// Add your storage provider profiles here. Press 'e' in the profile
// selector to edit this file. The "Local Filesystem" profile is
// built-in and always available.
//
// Supported providers: s3, gcs, sftp, ftp, smb, gdrive, local
// (nfs coming soon)
//
// Documentation: https://github.com/mikea/open-file#profiles
{
  "$schema": "https://raw.githubusercontent.com/mholtzscher/open-file/refs/heads/main/profiles.schema.json",
  "profiles": [
    // ============================================================
    // AWS S3 Example
    // ============================================================
    // {
    //   "id": "my-s3-bucket",
    //   "displayName": "My S3 Bucket",
    //   "provider": "s3",
    //   "config": {
    //     "region": "us-east-1",
    //     // Option 1: Use AWS CLI profile (recommended)
    //     "profile": "default",
    //     // Option 2: Use explicit credentials (not recommended for security)
    //     // "accessKeyId": "AKIA...",
    //     // "secretAccessKey": "...",
    //     // Optional: Custom endpoint for MinIO, LocalStack, etc.
    //     // "endpoint": "http://localhost:9000",
    //     // "forcePathStyle": true
    //   }
    // },

    // ============================================================
    // Google Cloud Storage Example
    // ============================================================
    // {
    //   "id": "my-gcs-bucket",
    //   "displayName": "My GCS Bucket",
    //   "provider": "gcs",
    //   "config": {
    //     "projectId": "my-project-id",
    //     // Option 1: Use Application Default Credentials (recommended)
    //     "useApplicationDefault": true,
    //     // Option 2: Use service account key file
    //     // "keyFilePath": "/path/to/service-account.json"
    //   }
    // },

    // ============================================================
    // SFTP Example
    // ============================================================
    // {
    //   "id": "my-sftp-server",
    //   "displayName": "My SFTP Server",
    //   "provider": "sftp",
    //   "config": {
    //     "host": "sftp.example.com",
    //     "port": 22,
    //     "username": "myuser",
    //     // Authentication: "password", "key", or "agent"
    //     "authMethod": "key",
    //     // For password auth:
    //     // "password": "...",
    //     // For key auth:
    //     "privateKeyPath": "~/.ssh/id_rsa",
    //     // "passphrase": "...",  // if key is encrypted
    //     // Starting directory (optional):
    //     "basePath": "/home/myuser"
    //   }
    // },

    // ============================================================
    // FTP Example
    // ============================================================
    // {
    //   "id": "my-ftp-server",
    //   "displayName": "My FTP Server",
    //   "provider": "ftp",
    //   "config": {
    //     "host": "ftp.example.com",
    //     "port": 21,
    //     "username": "anonymous",
    //     "password": "anonymous@",
    //     // For FTPS: true (explicit) or "implicit"
    //     // "secure": true
    //   }
    // },

    // ============================================================
    // Google Drive Example
    // ============================================================
    // First, run: open-file auth gdrive my-gdrive --client-id <id> --client-secret <secret>
    // This will populate the refreshToken automatically.
    // {
    //   "id": "my-gdrive",
    //   "displayName": "My Google Drive",
    //   "provider": "gdrive",
    //   "config": {
    //     "clientId": "123456789.apps.googleusercontent.com",
    //     "clientSecret": "GOCSPX-...",
    //     "refreshToken": "1//...",  // Set by 'open-file auth gdrive'
    //     // Optional: Include Shared Drives
    //     "includeSharedDrives": true,
    //     // Optional: Cache TTL in milliseconds (default: 60000)
    //     "cacheTtlMs": 60000
    //   }
    // }
  ]
}
`;

/** ID for the default local filesystem profile */
export const DEFAULT_LOCAL_PROFILE_ID = 'local-filesystem';

/**
 * Default local filesystem profile
 *
 * This profile is always present and always first in the list.
 * It provides access to the local filesystem starting from the user's home directory.
 */
export const DEFAULT_LOCAL_PROFILE: LocalProfile = {
  id: DEFAULT_LOCAL_PROFILE_ID,
  displayName: 'Local Filesystem',
  provider: 'local',
  config: {
    basePath: process.cwd(),
  },
};

/**
 * Check if a profile is the default local profile
 *
 * @param profile - Profile or profile ID to check
 * @returns true if this is the default local profile
 */
export function isDefaultProfile(profile: Profile | string): boolean {
  const id = typeof profile === 'string' ? profile : profile.id;
  return id === DEFAULT_LOCAL_PROFILE_ID;
}

// ============================================================================
// Path Utilities
// ============================================================================

/**
 * Get the platform-appropriate configuration directory
 *
 * Follows platform conventions:
 * - macOS: ~/.config/open-file (XDG_CONFIG_HOME)
 * - Linux: ~/.config/open-file (XDG_CONFIG_HOME)
 * - Windows: %APPDATA%/open-file
 *
 * @returns Absolute path to config directory
 */
export function getConfigDir(): string {
  const home = homedir();
  const plat = platform();

  switch (plat) {
    case 'win32': {
      // Windows: %APPDATA%/open-file
      const appData = process.env.APPDATA || join(home, 'AppData', 'Roaming');
      return join(appData, APP_NAME);
    }

    default: {
      // macOS, Linux and others: ~/.config/open-file (XDG Base Directory spec)
      const xdgConfig = process.env.XDG_CONFIG_HOME || join(home, '.config');
      return join(xdgConfig, APP_NAME);
    }
  }
}

/**
 * Get the full path to the profiles storage file
 *
 * @returns Absolute path to profiles.json
 */
export function getProfilesPath(): string {
  return join(getConfigDir(), PROFILES_FILENAME);
}

// ============================================================================
// Storage Result Types
// ============================================================================

/**
 * Result of loading profiles from disk
 */
export type LoadProfilesResult =
  | { success: true; profiles: Profile[] }
  | { success: false; error: ProfileStorageError };

/**
 * Result of saving profiles to disk
 */
export type SaveProfilesResult = { success: true } | { success: false; error: ProfileStorageError };

/**
 * Profile storage error with context
 */
export interface ProfileStorageError {
  /** Error code for programmatic handling */
  code: ProfileStorageErrorCode;
  /** Human-readable error message */
  message: string;
  /** Original error if available */
  cause?: Error;
}

/**
 * Storage error codes
 */
export type ProfileStorageErrorCode =
  | 'file_not_found' // Profiles file doesn't exist (not an error for initial load)
  | 'permission_denied' // Cannot read/write file
  | 'corrupted_json' // File exists but contains invalid JSON
  | 'invalid_schema' // JSON is valid but doesn't match expected schema
  | 'io_error' // Generic I/O error
  | 'directory_error'; // Cannot create config directory

// ============================================================================
// Storage Operations
// ============================================================================

/**
 * Ensure the configuration directory exists
 *
 * Creates the directory and any parent directories if needed.
 *
 * @returns true if directory exists or was created, false on error
 */
export function ensureConfigDir(): boolean {
  const configDir = getConfigDir();
  try {
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Create the profiles template file with helpful comments
 *
 * Called when the profiles file doesn't exist on first load.
 * Creates the config directory if needed and writes the template.
 *
 * @returns true if template was created successfully
 */
export function createProfilesTemplate(): boolean {
  const profilesPath = getProfilesPath();
  const configDir = dirname(profilesPath);

  try {
    // Ensure directory exists
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }

    // Write template file
    writeFileSync(profilesPath, PROFILES_TEMPLATE, 'utf-8');
    return true;
  } catch {
    // Silently fail - we'll still return the default profile
    return false;
  }
}

/**
 * Load profiles from disk
 *
 * Handles:
 * - Missing file (returns empty array, not an error)
 * - Missing directory (returns empty array)
 * - Corrupted JSON (returns error)
 * - Invalid schema (returns error)
 *
 * @returns LoadProfilesResult with profiles or error
 */
export function loadProfilesFromDisk(): LoadProfilesResult {
  const profilesPath = getProfilesPath();

  // File doesn't exist - create template and return default profile
  if (!existsSync(profilesPath)) {
    createProfilesTemplate();
    return { success: true, profiles: [DEFAULT_LOCAL_PROFILE] };
  }

  // Try to read and parse the file
  let content: string;
  try {
    content = readFileSync(profilesPath, 'utf-8');
  } catch (err) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === 'EACCES') {
      return {
        success: false,
        error: {
          code: 'permission_denied',
          message: `Cannot read profiles file: ${profilesPath}`,
          cause: error,
        },
      };
    }
    return {
      success: false,
      error: {
        code: 'io_error',
        message: `Failed to read profiles file: ${error.message}`,
        cause: error,
      },
    };
  }

  // Handle empty file - return just the default profile
  if (!content.trim()) {
    return { success: true, profiles: [DEFAULT_LOCAL_PROFILE] };
  }

  // Parse JSONC (JSON with comments)
  const parseErrors: ParseError[] = [];
  const parsed = parseJsonc(content, parseErrors, { allowTrailingComma: true });

  if (parseErrors.length > 0) {
    const errorMessages = parseErrors
      .map(e => `${printParseErrorCode(e.error)} at offset ${e.offset}`)
      .join(', ');
    return {
      success: false,
      error: {
        code: 'corrupted_json',
        message: `Profiles file contains invalid JSONC: ${errorMessages}`,
      },
    };
  }

  // Validate schema
  if (!isValidProfilesSchema(parsed)) {
    return {
      success: false,
      error: {
        code: 'invalid_schema',
        message: `Profiles file has invalid schema: expected { profiles: Profile[] }`,
      },
    };
  }

  // Filter out the default profile from disk (it's auto-generated)
  // and prepend the current default profile
  const userProfiles = parsed.profiles.filter(p => !isDefaultProfile(p));
  return { success: true, profiles: [DEFAULT_LOCAL_PROFILE, ...userProfiles] };
}

/**
 * Save profiles to disk
 *
 * Uses atomic write (write to temp file, then rename) to prevent corruption.
 * Creates config directory if it doesn't exist.
 *
 * Note: The default local profile is automatically filtered out since it's
 * auto-generated and should not be persisted to disk.
 *
 * @param profiles - Array of profiles to save
 * @returns SaveProfilesResult indicating success or error
 */
export function saveProfilesToDisk(profiles: Profile[]): SaveProfilesResult {
  const profilesPath = getProfilesPath();
  const configDir = dirname(profilesPath);

  // Ensure config directory exists
  try {
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }
  } catch (err) {
    return {
      success: false,
      error: {
        code: 'directory_error',
        message: `Cannot create config directory: ${configDir}`,
        cause: err as Error,
      },
    };
  }

  // Filter out the default profile - it's auto-generated and shouldn't be persisted
  const profilesToSave = profiles.filter(p => !isDefaultProfile(p));

  // Serialize to JSON with pretty printing
  const data: ProfilesFile = { profiles: profilesToSave };
  const content = JSON.stringify(data, null, 2);

  // Atomic write: write to temp file, then rename
  const tempPath = `${profilesPath}.tmp`;

  try {
    writeFileSync(tempPath, content, 'utf-8');
  } catch (err) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === 'EACCES') {
      return {
        success: false,
        error: {
          code: 'permission_denied',
          message: `Cannot write to profiles file: ${profilesPath}`,
          cause: error,
        },
      };
    }
    return {
      success: false,
      error: {
        code: 'io_error',
        message: `Failed to write profiles file: ${error.message}`,
        cause: error,
      },
    };
  }

  // Rename temp file to actual file (atomic on most filesystems)
  try {
    renameSync(tempPath, profilesPath);
  } catch (err) {
    return {
      success: false,
      error: {
        code: 'io_error',
        message: `Failed to finalize profiles file: ${(err as Error).message}`,
        cause: err as Error,
      },
    };
  }

  return { success: true };
}

// ============================================================================
// Schema Validation
// ============================================================================

/**
 * Schema for profiles storage file
 */
interface ProfilesFile {
  profiles: Profile[];
}

/**
 * Validate that parsed JSON matches expected schema
 *
 * @param data - Parsed JSON data
 * @returns true if data matches ProfilesFile schema
 */
function isValidProfilesSchema(data: unknown): data is ProfilesFile {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;

  if (!('profiles' in obj)) {
    return false;
  }

  if (!Array.isArray(obj.profiles)) {
    return false;
  }

  // Validate each profile has minimum required fields
  for (const profile of obj.profiles) {
    if (!isValidProfile(profile)) {
      return false;
    }
  }

  return true;
}

/**
 * Validate that an object is a valid Profile
 *
 * Only validates presence of required base fields.
 * Full provider-specific validation is done by ProfileValidator.
 *
 * @param data - Object to validate
 * @returns true if data has required Profile fields
 */
function isValidProfile(data: unknown): data is Profile {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;

  // Check required base fields
  if (typeof obj.id !== 'string' || !obj.id) {
    return false;
  }

  if (typeof obj.displayName !== 'string') {
    return false;
  }

  if (typeof obj.provider !== 'string' || !obj.provider) {
    return false;
  }

  return true;
}
