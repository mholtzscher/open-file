/**
 * ProfileManager Interface
 *
 * Manages storage provider profiles - named configurations that define
 * how to connect to a storage backend. Profiles can be created, updated,
 * validated, and used to instantiate StorageProvider instances.
 */

import type { Profile, ProviderType } from '../types/profile.js';
import type { StorageProvider } from '../provider.js';

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Validation error with field-level context
 */
export interface ValidationError {
  /** The field that failed validation */
  field: string;
  /** Human-readable error message */
  message: string;
  /** Error code for programmatic handling */
  code: ValidationErrorCode;
}

/**
 * Validation error codes for programmatic handling
 */
export type ValidationErrorCode =
  | 'required' // Required field is missing
  | 'invalid_type' // Field has wrong type
  | 'invalid_format' // Field value doesn't match expected format
  | 'invalid_range' // Numeric value out of range
  | 'invalid_option' // Value not in allowed options
  | 'duplicate_id' // Profile ID already exists
  | 'invalid_id' // Profile ID contains invalid characters
  | 'connection_failed' // Validation via test connection failed
  | 'unknown'; // Catch-all for unexpected errors

/**
 * Result of profile validation
 */
export interface ValidationResult {
  /** Whether the profile is valid */
  valid: boolean;
  /** List of validation errors (empty if valid) */
  errors: ValidationError[];
}

// ============================================================================
// ProfileManager Interface
// ============================================================================

/**
 * Options for listing profiles
 */
export interface ListProfilesOptions {
  /** Filter by provider type */
  providerType?: ProviderType;
}

/**
 * Options for saving a profile
 */
export interface SaveProfileOptions {
  /** Skip validation before saving (use with caution) */
  skipValidation?: boolean;
  /** Overwrite existing profile with same ID */
  overwrite?: boolean;
}

/**
 * Options for creating a provider from a profile
 */
export interface CreateProviderOptions {
  /** Test connection after creating provider */
  testConnection?: boolean;
}

/**
 * ProfileManager manages the lifecycle of storage provider profiles.
 *
 * Responsibilities:
 * - CRUD operations for profiles
 * - Profile validation
 * - Creating StorageProvider instances from profiles
 * - Credential resolution (delegated to credential providers)
 *
 * Implementations may store profiles in:
 * - Local filesystem (JSON file)
 * - Encrypted config file
 * - System keychain (for credentials)
 * - Cloud sync (future)
 */
export interface ProfileManager {
  // ==========================================================================
  // Query Operations
  // ==========================================================================

  /**
   * List all profiles, optionally filtered by provider type
   * @param options - Filter options
   * @returns Array of profiles
   */
  listProfiles(options?: ListProfilesOptions): Promise<Profile[]>;

  /**
   * Get a profile by ID
   * @param id - Profile ID
   * @returns Profile if found, undefined otherwise
   */
  getProfile(id: string): Promise<Profile | undefined>;

  // ==========================================================================
  // Mutation Operations
  // ==========================================================================

  /**
   * Save a profile (create or update)
   *
   * By default, validates the profile before saving.
   * If a profile with the same ID exists, requires overwrite: true.
   *
   * @param profile - Profile to save
   * @param options - Save options
   * @returns ValidationResult - check valid field for success
   */
  saveProfile(profile: Profile, options?: SaveProfileOptions): Promise<ValidationResult>;

  /**
   * Delete a profile by ID
   * @param id - Profile ID to delete
   * @returns true if deleted, false if not found
   */
  deleteProfile(id: string): Promise<boolean>;

  // ==========================================================================
  // Validation
  // ==========================================================================

  /**
   * Validate a profile without saving it
   *
   * Performs structural validation:
   * - Required fields present
   * - Field types correct
   * - Field values in valid ranges
   * - Provider-specific validation rules
   *
   * Does NOT test the connection - use createProviderFromProfile with
   * testConnection: true for that.
   *
   * @param profile - Profile to validate
   * @returns ValidationResult with any errors found
   */
  validateProfile(profile: Profile): Promise<ValidationResult>;

  // ==========================================================================
  // Provider Creation
  // ==========================================================================

  /**
   * Create a StorageProvider instance from a profile
   *
   * This method:
   * 1. Validates the profile
   * 2. Resolves credentials via the credential provider chain
   * 3. Instantiates the appropriate StorageProvider implementation
   * 4. Optionally tests the connection
   *
   * @param profileId - ID of the profile to use
   * @param options - Provider creation options
   * @returns StorageProvider instance
   * @throws Error if profile not found, validation fails, or credentials cannot be resolved
   */
  createProviderFromProfile(
    profileId: string,
    options?: CreateProviderOptions
  ): Promise<StorageProvider>;

  // ==========================================================================
  // Refresh Operations
  // ==========================================================================

  /**
   * Reload profiles from the underlying storage
   *
   * Forces a fresh read from disk/storage, discarding the in-memory cache.
   * Useful after external modifications to the profiles file.
   *
   * @returns Promise that resolves when reload is complete
   */
  reload(): Promise<void>;
}
