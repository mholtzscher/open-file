/**
 * Provider Factory
 *
 * Factory functions for creating storage provider instances from profiles.
 * Supports lazy loading of provider implementations to minimize bundle size.
 */

import type { Profile } from './types/profile.js';
import type { StorageProvider } from './provider.js';

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
      return new S3Provider(profile);
    }

    case 'gcs': {
      const { GCSProvider } = await import('./gcs/gcs-provider.js');
      return new GCSProvider(profile);
    }

    case 'sftp': {
      const { SFTPProvider } = await import('./sftp/sftp-provider.js');
      return new SFTPProvider(profile);
    }

    case 'ftp': {
      const { FTPProvider } = await import('./ftp/ftp-provider.js');
      return new FTPProvider(profile);
    }

    case 'nfs':
      // Phase 4E: NFS Provider
      // const { NFSProvider } = await import('./nfs/nfs-provider.js');
      // return new NFSProvider(profile);
      throw new Error('NFSProvider not yet implemented');

    case 'smb': {
      const { SMBProvider } = await import('./smb/smb-provider.js');
      return new SMBProvider(profile);
    }

    case 'gdrive': {
      const { GoogleDriveProvider } = await import('./gdrive/gdrive-provider.js');
      return new GoogleDriveProvider(profile);
    }

    case 'local': {
      const { LocalProvider } = await import('./local/local-provider.js');
      return new LocalProvider(profile);
    }

    default: {
      // TypeScript exhaustive check - this should never happen
      const _exhaustiveCheck: never = profile;
      throw new Error(`Unknown provider type: ${(_exhaustiveCheck as Profile).provider}`);
    }
  }
}
