/**
 * FileProfileManager
 *
 * A ProfileManager implementation that stores profiles in a local JSON file.
 * Uses platform-appropriate config directories and atomic writes.
 */

import type { Profile, ProviderType } from '../types/profile.js';
import type { StorageProvider } from '../provider.js';
import type {
  ProfileManager,
  ListProfilesOptions,
  SaveProfileOptions,
  CreateProviderOptions,
  ValidationResult,
  ValidationError,
} from './profile-manager.js';
import {
  loadProfilesFromDisk,
  saveProfilesToDisk,
  type LoadProfilesResult,
} from './profile-storage.js';
import { validateProfile } from './profile-validator.js';
import { createProvider } from '../factory.js';
import { OperationStatus } from '../types/result.js';

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error thrown when a profile operation fails
 */
export class ProfileManagerError extends Error {
  constructor(
    message: string,
    public readonly code: ProfileManagerErrorCode,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ProfileManagerError';
  }
}

/**
 * Error codes for ProfileManager operations
 */
export type ProfileManagerErrorCode =
  | 'load_failed' // Failed to load profiles from disk
  | 'save_failed' // Failed to save profiles to disk
  | 'profile_not_found' // Profile ID not found
  | 'profile_exists' // Profile ID already exists (when overwrite: false)
  | 'validation_failed' // Profile validation failed
  | 'provider_not_implemented'; // Provider type not yet implemented

// ============================================================================
// FileProfileManager Implementation
// ============================================================================

/**
 * Options for FileProfileManager constructor
 */
export interface FileProfileManagerOptions {
  /**
   * Custom path to profiles file.
   * If not provided, uses default platform-appropriate location.
   */
  profilesPath?: string;

  /**
   * Whether to load profiles eagerly on construction.
   * Default: true
   */
  loadOnInit?: boolean;
}

/**
 * FileProfileManager stores profiles in a local JSON file.
 *
 * Features:
 * - Platform-aware config directory
 * - Atomic writes to prevent corruption
 * - In-memory cache for fast reads
 * - Lazy loading option
 */
export class FileProfileManager implements ProfileManager {
  private profiles: Map<string, Profile> = new Map();
  private loaded = false;

  constructor(options: FileProfileManagerOptions = {}) {
    // Note: options.profilesPath is reserved for future custom path support
    // Currently loadProfilesFromDisk always uses the default platform path
    void options.profilesPath;

    // Load profiles eagerly unless explicitly disabled
    if (options.loadOnInit !== false) {
      this.loadSync();
    }
  }

  // ==========================================================================
  // Internal Methods
  // ==========================================================================

  /**
   * Load profiles from disk synchronously
   * Used during construction for eager loading
   */
  private loadSync(): void {
    const result = loadProfilesFromDisk();
    this.handleLoadResult(result);
  }

  /**
   * Load profiles from disk asynchronously
   */
  private async load(): Promise<void> {
    if (this.loaded) return;

    // Currently loadProfilesFromDisk is sync, but we wrap it for future async support
    const result = loadProfilesFromDisk();
    this.handleLoadResult(result);
  }

  /**
   * Handle the result of loading profiles
   */
  private handleLoadResult(result: LoadProfilesResult): void {
    if (!result.success) {
      throw new ProfileManagerError(
        `Failed to load profiles: ${result.error.message}`,
        'load_failed',
        result.error.cause
      );
    }

    this.profiles.clear();
    for (const profile of result.profiles) {
      this.profiles.set(profile.id, profile);
    }
    this.loaded = true;
  }

  /**
   * Save profiles to disk
   */
  private async save(): Promise<void> {
    const profiles = Array.from(this.profiles.values());
    const result = saveProfilesToDisk(profiles);

    if (!result.success) {
      throw new ProfileManagerError(
        `Failed to save profiles: ${result.error.message}`,
        'save_failed',
        result.error.cause
      );
    }
  }

  /**
   * Ensure profiles are loaded before an operation
   */
  private async ensureLoaded(): Promise<void> {
    if (!this.loaded) {
      await this.load();
    }
  }

  // ==========================================================================
  // ProfileManager Implementation
  // ==========================================================================

  /**
   * List all profiles, optionally filtered by provider type
   */
  async listProfiles(options?: ListProfilesOptions): Promise<Profile[]> {
    await this.ensureLoaded();

    let profiles = Array.from(this.profiles.values());

    // Filter by provider type if specified
    if (options?.providerType) {
      profiles = profiles.filter(p => p.provider === options.providerType);
    }

    return profiles;
  }

  /**
   * Get a profile by ID
   */
  async getProfile(id: string): Promise<Profile | undefined> {
    await this.ensureLoaded();
    return this.profiles.get(id);
  }

  /**
   * Save a profile (create or update)
   */
  async saveProfile(profile: Profile, options?: SaveProfileOptions): Promise<ValidationResult> {
    await this.ensureLoaded();

    // Validate unless explicitly skipped
    if (!options?.skipValidation) {
      const validationResult = await this.validateProfile(profile);
      if (!validationResult.valid) {
        return validationResult;
      }
    }

    // Check for existing profile with same ID
    const existing = this.profiles.get(profile.id);
    if (existing && !options?.overwrite) {
      const error: ValidationError = {
        field: 'id',
        message: `Profile with ID "${profile.id}" already exists. Use overwrite: true to replace.`,
        code: 'duplicate_id',
      };
      return { valid: false, errors: [error] };
    }

    // Save to memory
    this.profiles.set(profile.id, profile);

    // Persist to disk
    try {
      await this.save();
    } catch (err) {
      // Rollback memory change
      if (existing) {
        this.profiles.set(profile.id, existing);
      } else {
        this.profiles.delete(profile.id);
      }
      throw err;
    }

    return { valid: true, errors: [] };
  }

  /**
   * Delete a profile by ID
   */
  async deleteProfile(id: string): Promise<boolean> {
    await this.ensureLoaded();

    const existing = this.profiles.get(id);
    if (!existing) {
      return false;
    }

    // Remove from memory
    this.profiles.delete(id);

    // Persist to disk
    try {
      await this.save();
    } catch (err) {
      // Rollback memory change
      this.profiles.set(id, existing);
      throw err;
    }

    return true;
  }

  /**
   * Validate a profile without saving it
   */
  async validateProfile(profile: Profile): Promise<ValidationResult> {
    return validateProfile(profile);
  }

  /**
   * Create a StorageProvider instance from a profile
   */
  async createProviderFromProfile(
    profileId: string,
    options?: CreateProviderOptions
  ): Promise<StorageProvider> {
    await this.ensureLoaded();

    // Get the profile
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new ProfileManagerError(`Profile not found: ${profileId}`, 'profile_not_found');
    }

    // Validate the profile
    const validationResult = await this.validateProfile(profile);
    if (!validationResult.valid) {
      const errorMessages = validationResult.errors.map(e => `${e.field}: ${e.message}`).join(', ');
      throw new ProfileManagerError(
        `Profile validation failed: ${errorMessages}`,
        'validation_failed'
      );
    }

    // Create the provider
    // Note: createProvider may throw if provider is not yet implemented
    let provider: StorageProvider;
    try {
      provider = await createProvider(profile);
    } catch (err) {
      const error = err as Error;
      if (error.message.includes('not yet implemented')) {
        throw new ProfileManagerError(
          `Provider "${profile.provider}" is not yet implemented`,
          'provider_not_implemented',
          error
        );
      }
      throw err;
    }

    // Test connection if requested
    if (options?.testConnection) {
      // For connection-oriented providers, call connect()
      if (provider.connect) {
        const connectResult = await provider.connect();
        if (connectResult.status !== OperationStatus.Success) {
          throw new ProfileManagerError(
            `Connection test failed: ${connectResult.error?.message || 'Unknown error'}`,
            'validation_failed'
          );
        }
      }
    }

    return provider;
  }

  // ==========================================================================
  // Additional Methods
  // ==========================================================================

  /**
   * Get count of profiles
   */
  async getProfileCount(): Promise<number> {
    await this.ensureLoaded();
    return this.profiles.size;
  }

  /**
   * Get count of profiles by provider type
   */
  async getProfileCountByProvider(): Promise<Map<ProviderType, number>> {
    await this.ensureLoaded();

    const counts = new Map<ProviderType, number>();
    for (const profile of this.profiles.values()) {
      const current = counts.get(profile.provider) || 0;
      counts.set(profile.provider, current + 1);
    }
    return counts;
  }

  /**
   * Check if a profile ID exists
   */
  async hasProfile(id: string): Promise<boolean> {
    await this.ensureLoaded();
    return this.profiles.has(id);
  }

  /**
   * Reload profiles from disk
   * Useful if the file was modified externally
   */
  async reload(): Promise<void> {
    this.loaded = false;
    await this.load();
  }
}
