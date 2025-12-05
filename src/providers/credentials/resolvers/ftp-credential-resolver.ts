/**
 * FTP Credential Resolver
 *
 * Resolves FTP credentials from multiple sources:
 * 1. Environment variables (FTP_USERNAME, FTP_PASSWORD)
 * 2. Inline credentials in profile config
 * 3. Anonymous (no credentials needed)
 */

import type {
  CredentialProvider,
  CredentialContext,
  CredentialResult,
  FTPCredentials,
} from '../types.js';

// ============================================================================
// Environment Credential Provider for FTP
// ============================================================================

/**
 * Resolves FTP credentials from environment variables
 */
export class FTPEnvironmentCredentialProvider implements CredentialProvider {
  readonly name = 'ftp-environment';
  readonly description = 'Resolve FTP credentials from environment variables';
  readonly priority = 100;

  canHandle(context: CredentialContext): boolean {
    return context.providerType === 'ftp';
  }

  resolve(_context: CredentialContext): Promise<CredentialResult<FTPCredentials>> {
    const username = process.env.FTP_USERNAME;
    const password = process.env.FTP_PASSWORD;

    // At least password must be set for this provider to succeed
    if (!password) {
      return Promise.resolve({
        success: false,
        error: {
          code: 'not_found',
          message: 'FTP_PASSWORD not set in environment',
        },
      });
    }

    return Promise.resolve({
      success: true,
      credentials: {
        type: 'ftp',
        source: 'environment',
        username,
        password,
      },
    });
  }
}

// ============================================================================
// Inline Credential Provider for FTP
// ============================================================================

/**
 * Resolves FTP credentials from inline profile configuration
 */
export class FTPInlineCredentialProvider implements CredentialProvider {
  readonly name = 'ftp-inline';
  readonly description = 'Resolve FTP credentials from profile configuration';
  readonly priority = 200;

  private config?: Record<string, unknown>;

  /**
   * Set the profile configuration to extract credentials from
   */
  setConfig(config: Record<string, unknown>): void {
    this.config = config;
  }

  canHandle(context: CredentialContext): boolean {
    return context.providerType === 'ftp' && this.config !== undefined;
  }

  resolve(_context: CredentialContext): Promise<CredentialResult<FTPCredentials>> {
    if (!this.config) {
      return Promise.resolve({
        success: false,
        error: {
          code: 'not_found',
          message: 'No profile configuration provided',
        },
      });
    }

    const username = this.config.username as string | undefined;
    const password = this.config.password as string | undefined;

    // FTP can work with just username (or anonymous)
    return Promise.resolve({
      success: true,
      credentials: {
        type: 'ftp',
        source: 'inline',
        username,
        password,
      },
    });
  }
}

// ============================================================================
// Anonymous Credential Provider for FTP
// ============================================================================

/**
 * Provides anonymous FTP credentials
 */
export class FTPAnonymousCredentialProvider implements CredentialProvider {
  readonly name = 'ftp-anonymous';
  readonly description = 'Provide anonymous FTP credentials';
  readonly priority = 1000; // Low priority - fallback

  canHandle(context: CredentialContext): boolean {
    return context.providerType === 'ftp';
  }

  resolve(_context: CredentialContext): Promise<CredentialResult<FTPCredentials>> {
    // Anonymous FTP typically uses "anonymous" as username
    // and an email address as password
    return Promise.resolve({
      success: true,
      credentials: {
        type: 'ftp',
        source: 'inline',
        username: 'anonymous',
        password: 'anonymous@',
      },
    });
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create an array of FTP credential providers in priority order
 */
export function createFTPCredentialProviders(): CredentialProvider[] {
  return [
    new FTPEnvironmentCredentialProvider(),
    new FTPInlineCredentialProvider(),
    new FTPAnonymousCredentialProvider(),
  ];
}
