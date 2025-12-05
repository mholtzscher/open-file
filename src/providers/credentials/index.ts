/**
 * Credentials Module - Public API
 *
 * This module provides credential resolution for storage providers.
 */

// Types
export type {
  CredentialSource,
  CredentialSourceType,
  BaseCredentials,
  S3Credentials,
  GCSCredentials,
  SFTPCredentials,
  FTPCredentials,
  SMBCredentials,
  GoogleDriveCredentials,
  NFSCredentials,
  LocalCredentials,
  Credentials,
  CredentialResult,
  CredentialError,
  CredentialErrorCode,
  CredentialContext,
  CredentialProvider,
} from './types.js';

// Credential Chain
export {
  CredentialChain,
  CredentialChainError,
  createDefaultCredentialChain,
  type CredentialChainOptions,
  type ChainResolutionResult,
} from './credential-chain.js';

// Built-in Providers
export { EnvironmentCredentialProvider, InlineCredentialProvider } from './credential-chain.js';

// Sensitive Data Sanitizer
export {
  isSensitiveFieldName,
  hasSensitiveData,
  getSensitiveFieldPaths,
  maskValue,
  maskSensitiveFields,
  sanitizeForLogging,
  safeStringify,
  checkForSensitiveDataWarnings,
  type MaskOptions,
  type SensitiveDataWarning,
} from './sanitizer.js';

// Provider-specific resolvers
export * from './resolvers/index.js';
