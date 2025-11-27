/**
 * Provider System - Public API
 *
 * This module provides the storage provider abstraction layer.
 * It enables support for multiple storage backends (S3, GCS, SFTP, etc.)
 * behind a unified interface.
 */

// Types
export * from './types/index.js';

// Provider interface and related types
export * from './provider.js';

// Base provider abstract class
export { BaseStorageProvider } from './base-provider.js';

// Provider factory
export {
  createProvider,
  getSupportedProviders,
  isProviderSupported,
  isProviderImplemented,
  getImplementedProviders,
} from './factory.js';

// Profile management
export type {
  ProfileManager,
  ValidationError,
  ValidationErrorCode,
  ValidationResult,
  ListProfilesOptions,
  SaveProfileOptions,
  CreateProviderOptions,
} from './services/profile-manager.js';

// Profile manager implementation
export {
  FileProfileManager,
  ProfileManagerError,
  type ProfileManagerErrorCode,
  type FileProfileManagerOptions,
} from './services/file-profile-manager.js';

// Profile validation
export { validateProfile, isValidProfileId } from './services/profile-validator.js';

// Profile storage utilities
export {
  getConfigDir,
  getProfilesPath,
  loadProfilesFromDisk,
  saveProfilesToDisk,
  ensureConfigDir,
  type LoadProfilesResult,
  type SaveProfilesResult,
  type ProfileStorageError,
  type ProfileStorageErrorCode,
} from './services/profile-storage.js';

// Credential management
export * from './credentials/index.js';

// Test utilities (for consumers that need to test provider integrations)
export * from './__tests__/fixtures.js';
export * from './__tests__/test-utils.js';
export { MockStorageProvider } from './__tests__/mock-provider.js';
