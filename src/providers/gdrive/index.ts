/**
 * Google Drive Provider
 *
 * Exports for the Google Drive storage provider implementation.
 */

export { GoogleDriveProvider } from './gdrive-provider.js';
export type {
  GoogleDriveProviderLogger,
  GoogleDriveProviderDependencies,
  GoogleDriveDeleteOptions,
} from './gdrive-provider.js';

// Auth utilities - export only what's needed externally
export { createDriveClient, DRIVE_SCOPE } from './utils/auth.js';
export type { OAuth2ClientType, CreateDriveClientResult } from './utils/auth.js';

// Path resolver
export { PathResolver } from './utils/path-resolver.js';
export type {
  PathResolverOptions,
  ResolveResult,
  ResolveError,
  PathResolveResult,
} from './utils/path-resolver.js';
