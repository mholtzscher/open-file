/**
 * SMB Credential Resolver
 *
 * Resolves SMB/CIFS credentials from multiple sources:
 * 1. Environment variables (SMB_USERNAME, SMB_PASSWORD, SMB_DOMAIN)
 * 2. Inline credentials in profile config
 */

import type {
  CredentialProvider,
  CredentialContext,
  CredentialResult,
  SMBCredentials,
} from '../types.js';

// ============================================================================
// Environment Credential Provider for SMB
// ============================================================================

/**
 * Resolves SMB credentials from environment variables
 */
export class SMBEnvironmentCredentialProvider implements CredentialProvider {
  readonly name = 'smb-environment';
  readonly description = 'Resolve SMB credentials from environment variables';
  readonly priority = 100;

  canHandle(context: CredentialContext): boolean {
    return context.providerType === 'smb';
  }

  resolve(_context: CredentialContext): Promise<CredentialResult<SMBCredentials>> {
    const username = process.env.SMB_USERNAME;
    const password = process.env.SMB_PASSWORD;
    const domain = process.env.SMB_DOMAIN;

    // At least password must be set for this provider to succeed
    if (!password) {
      return Promise.resolve({
        success: false,
        error: {
          code: 'not_found',
          message: 'SMB_PASSWORD not set in environment',
        },
      });
    }

    return Promise.resolve({
      success: true,
      credentials: {
        type: 'smb',
        source: 'environment',
        username,
        password,
        domain,
      },
    });
  }
}

// ============================================================================
// Inline Credential Provider for SMB
// ============================================================================

/**
 * Resolves SMB credentials from inline profile configuration
 */
export class SMBInlineCredentialProvider implements CredentialProvider {
  readonly name = 'smb-inline';
  readonly description = 'Resolve SMB credentials from profile configuration';
  readonly priority = 200;

  private config?: Record<string, unknown>;

  /**
   * Set the profile configuration to extract credentials from
   */
  setConfig(config: Record<string, unknown>): void {
    this.config = config;
  }

  canHandle(context: CredentialContext): boolean {
    return context.providerType === 'smb' && this.config !== undefined;
  }

  resolve(_context: CredentialContext): Promise<CredentialResult<SMBCredentials>> {
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
    const domain = this.config.domain as string | undefined;

    // SMB can work with username only (for guest shares) but typically needs password
    return Promise.resolve({
      success: true,
      credentials: {
        type: 'smb',
        source: 'inline',
        username,
        password,
        domain,
      },
    });
  }
}

// ============================================================================
// Guest Credential Provider for SMB
// ============================================================================

/**
 * Provides guest SMB credentials for anonymous shares
 */
export class SMBGuestCredentialProvider implements CredentialProvider {
  readonly name = 'smb-guest';
  readonly description = 'Provide guest SMB credentials';
  readonly priority = 1000; // Low priority - fallback

  canHandle(context: CredentialContext): boolean {
    return context.providerType === 'smb';
  }

  resolve(_context: CredentialContext): Promise<CredentialResult<SMBCredentials>> {
    // Guest access typically uses empty credentials
    return Promise.resolve({
      success: true,
      credentials: {
        type: 'smb',
        source: 'inline',
        username: 'guest',
        password: '',
      },
    });
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create an array of SMB credential providers in priority order
 */
export function createSMBCredentialProviders(): CredentialProvider[] {
  return [
    new SMBEnvironmentCredentialProvider(),
    new SMBInlineCredentialProvider(),
    new SMBGuestCredentialProvider(),
  ];
}
