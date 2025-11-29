/**
 * Profile Storage Utilities
 *
 * Platform-aware storage for provider profiles.
 * Handles reading/writing profiles to disk with proper error handling.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'fs';
import { homedir, platform } from 'os';
import { join, dirname } from 'path';
import type { Profile } from '../types/profile.js';

// ============================================================================
// Constants
// ============================================================================

/** Application name for config directories */
const APP_NAME = 'open-file';

/** Profile storage filename */
const PROFILES_FILENAME = 'profiles.json';

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

  // File doesn't exist - return empty array (not an error)
  if (!existsSync(profilesPath)) {
    return { success: true, profiles: [] };
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

  // Handle empty file
  if (!content.trim()) {
    return { success: true, profiles: [] };
  }

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    return {
      success: false,
      error: {
        code: 'corrupted_json',
        message: `Profiles file contains invalid JSON: ${profilesPath}`,
        cause: err as Error,
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

  return { success: true, profiles: parsed.profiles };
}

/**
 * Save profiles to disk
 *
 * Uses atomic write (write to temp file, then rename) to prevent corruption.
 * Creates config directory if it doesn't exist.
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

  // Serialize to JSON with pretty printing
  const data: ProfilesFile = { profiles };
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
