/**
 * Provider Factory
 *
 * Factory functions for creating storage provider instances from profiles.
 * Uses a registry pattern for extensibility and testability.
 */

import type { Profile, ProviderType } from './types/profile.js';
import type { StorageProvider } from './provider.js';

import { S3Provider } from './s3/s3-provider.js';
import { GCSProvider } from './gcs/gcs-provider.js';
import { SFTPProvider } from './sftp/sftp-provider.js';
import { FTPProvider } from './ftp/ftp-provider.js';
import { SMBProvider } from './smb/smb-provider.js';
import { GoogleDriveProvider } from './gdrive/gdrive-provider.js';
import { LocalProvider } from './local/local-provider.js';

// Provider constructor type - uses 'any' for profile to allow specific profile types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ProviderConstructor = new (profile: any) => StorageProvider;

// Registry: map from provider type to constructor
const providerRegistry = new Map<ProviderType, ProviderConstructor>([
  ['s3', S3Provider],
  ['gcs', GCSProvider],
  ['sftp', SFTPProvider],
  ['ftp', FTPProvider],
  ['smb', SMBProvider],
  ['gdrive', GoogleDriveProvider],
  ['local', LocalProvider],
  // 'nfs' intentionally not registered (not yet implemented)
]);

/**
 * Create a storage provider instance from a profile
 *
 * @param profile - Profile configuration for the provider
 * @returns Storage provider instance
 * @throws Error if provider type is not supported or not yet implemented
 */
export function createProvider(profile: Profile): StorageProvider {
  const ProviderClass = providerRegistry.get(profile.provider);

  if (!ProviderClass) {
    throw new Error(`Provider '${profile.provider}' is not yet implemented`);
  }

  return new ProviderClass(profile);
}

/**
 * Check if a provider type is available (implemented and registered)
 */
export function isProviderAvailable(type: ProviderType): boolean {
  return providerRegistry.has(type);
}

/**
 * Get all available provider types
 */
export function getAvailableProviders(): ProviderType[] {
  return Array.from(providerRegistry.keys());
}

/**
 * Register a provider (for testing or plugins)
 * @internal
 */
export function _registerProvider(type: ProviderType, ctor: ProviderConstructor): void {
  providerRegistry.set(type, ctor);
}

/**
 * Unregister a provider (for testing)
 * @internal
 */
export function _unregisterProvider(type: ProviderType): void {
  providerRegistry.delete(type);
}
