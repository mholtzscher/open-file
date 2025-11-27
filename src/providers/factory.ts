/**
 * Provider Factory
 *
 * Factory functions for creating storage provider instances from profiles.
 * Supports lazy loading of provider implementations to minimize bundle size.
 */

import type { Profile, ProviderType, S3Profile } from './types/profile.js';
import type { StorageProvider } from './provider.js';

/**
 * All supported provider types
 */
const SUPPORTED_PROVIDERS: ProviderType[] = [
  's3',
  'gcs',
  'sftp',
  'ftp',
  'nfs',
  'smb',
  'gdrive',
  'local',
];

/**
 * Create a storage provider instance from a profile
 *
 * Uses lazy loading to minimize bundle size - providers are only loaded
 * when needed.
 *
 * @param profile - Profile configuration for the provider
 * @returns Storage provider instance
 * @throws Error if provider type is not supported or not yet implemented
 */
export async function createProvider(profile: Profile): Promise<StorageProvider> {
  switch (profile.provider) {
    case 's3': {
      const { S3Provider } = await import('./s3/s3-provider.js');
      return new S3Provider(profile as S3Profile);
    }

    case 'gcs':
      // Phase 4A: GCS Provider
      // const { GCSProvider } = await import('./gcs/gcs-provider.js');
      // return new GCSProvider(profile);
      throw new Error('GCSProvider not yet implemented');

    case 'sftp':
      // Phase 4B: SFTP Provider
      // const { SFTPProvider } = await import('./sftp/sftp-provider.js');
      // return new SFTPProvider(profile);
      throw new Error('SFTPProvider not yet implemented');

    case 'ftp':
      // Phase 4C: FTP Provider
      // const { FTPProvider } = await import('./ftp/ftp-provider.js');
      // return new FTPProvider(profile);
      throw new Error('FTPProvider not yet implemented');

    case 'nfs':
      // Phase 4E: NFS Provider
      // const { NFSProvider } = await import('./nfs/nfs-provider.js');
      // return new NFSProvider(profile);
      throw new Error('NFSProvider not yet implemented');

    case 'smb':
      // Phase 4D: SMB Provider
      // const { SMBProvider } = await import('./smb/smb-provider.js');
      // return new SMBProvider(profile);
      throw new Error('SMBProvider not yet implemented');

    case 'gdrive':
      // Phase 4G: Google Drive Provider
      // const { GoogleDriveProvider } = await import('./gdrive/gdrive-provider.js');
      // return new GoogleDriveProvider(profile);
      throw new Error('GoogleDriveProvider not yet implemented');

    case 'local':
      // Phase 4F: Local Filesystem Provider
      // const { LocalProvider } = await import('./local/local-provider.js');
      // return new LocalProvider(profile);
      throw new Error('LocalProvider not yet implemented');

    default:
      // TypeScript exhaustive check - this should never happen
      const _exhaustiveCheck: never = profile;
      throw new Error(`Unknown provider type: ${(_exhaustiveCheck as Profile).provider}`);
  }
}

/**
 * Get list of all supported provider types
 *
 * @returns Array of supported provider type identifiers
 */
export function getSupportedProviders(): ProviderType[] {
  return [...SUPPORTED_PROVIDERS];
}

/**
 * Check if a provider type is supported
 *
 * @param providerType - Provider type to check
 * @returns true if the provider type is supported
 */
export function isProviderSupported(providerType: string): providerType is ProviderType {
  return SUPPORTED_PROVIDERS.includes(providerType as ProviderType);
}

/**
 * Check if a provider implementation is available
 *
 * @param providerType - Provider type to check
 * @returns true if the provider implementation is available
 */
export function isProviderImplemented(providerType: ProviderType): boolean {
  switch (providerType) {
    case 's3':
      return true; // S3Provider implemented
    case 'gcs':
    case 'sftp':
    case 'ftp':
    case 'nfs':
    case 'smb':
    case 'gdrive':
    case 'local':
      return false;
    default:
      return false;
  }
}

/**
 * Get list of currently implemented provider types
 *
 * @returns Array of implemented provider type identifiers
 */
export function getImplementedProviders(): ProviderType[] {
  return SUPPORTED_PROVIDERS.filter(isProviderImplemented);
}
