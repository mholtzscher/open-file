/**
 * Credential Resolvers - Public API
 *
 * Provider-specific credential resolvers with appropriate priority chains.
 */

import type { ProviderType } from '../../types/profile.js';
import type { CredentialProvider } from '../types.js';
import { CredentialChain } from '../credential-chain.js';

// GCS resolvers
export {
  GCSAdcCredentialProvider,
  GCSKeyFileCredentialProvider,
  GCSInlineCredentialProvider,
  createGCSCredentialProviders,
} from './gcs-credential-resolver.js';

// SFTP resolvers
export {
  SFTPAgentCredentialProvider,
  SFTPEnvironmentCredentialProvider,
  SFTPKeyFileCredentialProvider,
  SFTPInlineCredentialProvider,
  createSFTPCredentialProviders,
} from './sftp-credential-resolver.js';

// FTP resolvers
export {
  FTPEnvironmentCredentialProvider,
  FTPInlineCredentialProvider,
  FTPAnonymousCredentialProvider,
  createFTPCredentialProviders,
} from './ftp-credential-resolver.js';

// SMB resolvers
export {
  SMBEnvironmentCredentialProvider,
  SMBInlineCredentialProvider,
  SMBGuestCredentialProvider,
  createSMBCredentialProviders,
} from './smb-credential-resolver.js';

// Google Drive resolvers
export {
  GDriveServiceAccountCredentialProvider,
  GDriveOAuthCredentialProvider,
  GDriveInlineCredentialProvider,
  createGDriveCredentialProviders,
} from './gdrive-credential-resolver.js';

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create credential providers for a specific provider type
 *
 * @param providerType - The storage provider type
 * @returns Array of credential providers in priority order
 */
export function createCredentialProvidersForType(providerType: ProviderType): CredentialProvider[] {
  const { createGCSCredentialProviders } = require('./gcs-credential-resolver.js');
  const { createSFTPCredentialProviders } = require('./sftp-credential-resolver.js');
  const { createFTPCredentialProviders } = require('./ftp-credential-resolver.js');
  const { createSMBCredentialProviders } = require('./smb-credential-resolver.js');
  const { createGDriveCredentialProviders } = require('./gdrive-credential-resolver.js');

  switch (providerType) {
    case 's3':
      return [];
    case 'gcs':
      return createGCSCredentialProviders();
    case 'sftp':
      return createSFTPCredentialProviders();
    case 'ftp':
      return createFTPCredentialProviders();
    case 'smb':
      return createSMBCredentialProviders();
    case 'gdrive':
      return createGDriveCredentialProviders();
    case 'nfs':
    case 'local':
      // NFS and Local typically don't need credentials
      return [];
    default:
      return [];
  }
}

/**
 * Create a credential chain pre-configured for a specific provider type
 *
 * @param providerType - The storage provider type
 * @returns Configured CredentialChain
 */
export function createCredentialChainForType(providerType: ProviderType): CredentialChain {
  const chain = new CredentialChain();
  const providers = createCredentialProvidersForType(providerType);

  for (const provider of providers) {
    chain.register(provider);
  }

  return chain;
}

/**
 * Create a credential chain with all providers for all types
 *
 * Useful when the provider type is not known in advance.
 * Providers will filter themselves based on context.
 *
 * @returns CredentialChain with all providers
 */
export function createUniversalCredentialChain(): CredentialChain {
  const chain = new CredentialChain();
  const providerTypes: ProviderType[] = ['gcs', 'sftp', 'ftp', 'smb', 'gdrive'];

  for (const type of providerTypes) {
    const providers = createCredentialProvidersForType(type);
    for (const provider of providers) {
      chain.register(provider);
    }
  }

  return chain;
}
