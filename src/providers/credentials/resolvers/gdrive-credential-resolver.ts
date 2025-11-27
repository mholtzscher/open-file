/**
 * Google Drive Credential Resolver
 *
 * Resolves Google Drive credentials from multiple sources:
 * 1. Service account key file
 * 2. OAuth refresh token
 * 3. Inline credentials in profile config
 */

import { existsSync, readFileSync } from 'fs';
import type {
  CredentialProvider,
  CredentialContext,
  CredentialResult,
  GoogleDriveCredentials,
} from '../types.js';

// ============================================================================
// Service Account Credential Provider
// ============================================================================

/**
 * Resolves Google Drive credentials from service account key file
 */
export class GDriveServiceAccountCredentialProvider implements CredentialProvider {
  readonly name = 'gdrive-service-account';
  readonly description = 'Resolve Google Drive credentials from service account key file';
  readonly priority = 100;

  private keyFilePath?: string;

  /**
   * Set the path to the service account key file
   */
  setKeyFilePath(path: string): void {
    this.keyFilePath = path;
  }

  canHandle(context: CredentialContext): boolean {
    if (context.providerType !== 'gdrive') return false;

    // Can handle if key file path is configured or provided in source
    return !!(this.keyFilePath || context.source?.type === 'file');
  }

  async resolve(context: CredentialContext): Promise<CredentialResult<GoogleDriveCredentials>> {
    let keyFilePath = this.keyFilePath;

    // Get from source hint if available
    if (context.source?.type === 'file') {
      keyFilePath = context.source.path;
    }

    if (!keyFilePath) {
      return {
        success: false,
        error: {
          code: 'not_found',
          message: 'No service account key file path configured',
        },
      };
    }

    // Verify file exists
    if (!existsSync(keyFilePath)) {
      return {
        success: false,
        error: {
          code: 'not_found',
          message: `Service account key file not found: ${keyFilePath}`,
        },
      };
    }

    // Read the key file content
    let keyFileContent: string;
    try {
      keyFileContent = readFileSync(keyFilePath, 'utf-8');
    } catch (err) {
      return {
        success: false,
        error: {
          code: 'access_denied',
          message: `Cannot read service account key file: ${keyFilePath}`,
          cause: err as Error,
        },
      };
    }

    // Validate it's valid JSON
    try {
      JSON.parse(keyFileContent);
    } catch {
      return {
        success: false,
        error: {
          code: 'invalid_format',
          message: `Invalid service account key file format: ${keyFilePath}`,
        },
      };
    }

    return {
      success: true,
      credentials: {
        type: 'gdrive',
        source: 'file',
        keyFileContent,
      },
    };
  }
}

// ============================================================================
// OAuth Credential Provider
// ============================================================================

/**
 * Resolves Google Drive credentials from OAuth tokens
 */
export class GDriveOAuthCredentialProvider implements CredentialProvider {
  readonly name = 'gdrive-oauth';
  readonly description = 'Resolve Google Drive credentials from OAuth tokens';
  readonly priority = 200;

  private refreshToken?: string;
  private accessToken?: string;

  /**
   * Set the OAuth refresh token
   */
  setRefreshToken(token: string): void {
    this.refreshToken = token;
  }

  /**
   * Set the OAuth access token
   */
  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  canHandle(context: CredentialContext): boolean {
    return context.providerType === 'gdrive';
  }

  async resolve(_context: CredentialContext): Promise<CredentialResult<GoogleDriveCredentials>> {
    if (!this.refreshToken && !this.accessToken) {
      return {
        success: false,
        error: {
          code: 'not_found',
          message: 'No OAuth tokens configured',
        },
      };
    }

    return {
      success: true,
      credentials: {
        type: 'gdrive',
        source: 'inline',
        refreshToken: this.refreshToken,
        accessToken: this.accessToken,
      },
    };
  }
}

// ============================================================================
// Inline Credential Provider for Google Drive
// ============================================================================

/**
 * Resolves Google Drive credentials from inline profile configuration
 */
export class GDriveInlineCredentialProvider implements CredentialProvider {
  readonly name = 'gdrive-inline';
  readonly description = 'Resolve Google Drive credentials from profile configuration';
  readonly priority = 500;

  private config?: Record<string, unknown>;

  /**
   * Set the profile configuration to extract credentials from
   */
  setConfig(config: Record<string, unknown>): void {
    this.config = config;
  }

  canHandle(context: CredentialContext): boolean {
    return context.providerType === 'gdrive' && this.config !== undefined;
  }

  async resolve(_context: CredentialContext): Promise<CredentialResult<GoogleDriveCredentials>> {
    if (!this.config) {
      return {
        success: false,
        error: {
          code: 'not_found',
          message: 'No profile configuration provided',
        },
      };
    }

    const refreshToken = this.config.refreshToken as string | undefined;
    const keyFilePath = this.config.keyFilePath as string | undefined;

    // Check for service account key file
    if (keyFilePath) {
      if (!existsSync(keyFilePath)) {
        return {
          success: false,
          error: {
            code: 'not_found',
            message: `Service account key file not found: ${keyFilePath}`,
          },
        };
      }

      let keyFileContent: string;
      try {
        keyFileContent = readFileSync(keyFilePath, 'utf-8');
        JSON.parse(keyFileContent); // Validate JSON
      } catch (err) {
        return {
          success: false,
          error: {
            code: 'invalid_format',
            message: `Invalid service account key file: ${keyFilePath}`,
            cause: err as Error,
          },
        };
      }

      return {
        success: true,
        credentials: {
          type: 'gdrive',
          source: 'inline',
          keyFileContent,
        },
      };
    }

    // Check for OAuth refresh token
    if (refreshToken) {
      return {
        success: true,
        credentials: {
          type: 'gdrive',
          source: 'inline',
          refreshToken,
        },
      };
    }

    return {
      success: false,
      error: {
        code: 'not_found',
        message: 'No Google Drive credentials found in profile config',
      },
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create an array of Google Drive credential providers in priority order
 */
export function createGDriveCredentialProviders(): CredentialProvider[] {
  return [
    new GDriveServiceAccountCredentialProvider(),
    new GDriveOAuthCredentialProvider(),
    new GDriveInlineCredentialProvider(),
  ];
}
