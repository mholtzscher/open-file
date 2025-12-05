/**
 * GCS Credential Resolver
 *
 * Resolves Google Cloud Storage credentials from multiple sources:
 * 1. Application Default Credentials (ADC)
 * 2. Environment variable (GOOGLE_APPLICATION_CREDENTIALS)
 * 3. Service account key file
 * 4. Inline credentials in profile config
 */

import { existsSync } from 'fs';
import type {
  CredentialProvider,
  CredentialContext,
  CredentialResult,
  GCSCredentials,
} from '../types.js';

// ============================================================================
// Application Default Credentials Provider
// ============================================================================

/**
 * Resolves GCS credentials using Application Default Credentials
 *
 * ADC checks:
 * 1. GOOGLE_APPLICATION_CREDENTIALS env var
 * 2. User credentials in ~/.config/gcloud/application_default_credentials.json
 * 3. GCE metadata service (when running on GCP)
 */
export class GCSAdcCredentialProvider implements CredentialProvider {
  readonly name = 'gcs-adc';
  readonly description = 'Resolve GCS credentials using Application Default Credentials';
  readonly priority = 100;

  canHandle(context: CredentialContext): boolean {
    return context.providerType === 'gcs';
  }

  resolve(context: CredentialContext): Promise<CredentialResult<GCSCredentials>> {
    // Check if ADC is explicitly requested or if env var is set
    const useAdc = context.source?.type === 'gcpAdc' || process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (!useAdc) {
      return Promise.resolve({
        success: false,
        error: {
          code: 'not_found',
          message: 'Application Default Credentials not configured',
        },
      });
    }

    // If GOOGLE_APPLICATION_CREDENTIALS is set, verify file exists
    const keyFilePath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (keyFilePath && !existsSync(keyFilePath)) {
      return Promise.resolve({
        success: false,
        error: {
          code: 'not_found',
          message: `GOOGLE_APPLICATION_CREDENTIALS file not found: ${keyFilePath}`,
        },
      });
    }

    return Promise.resolve({
      success: true,
      credentials: {
        type: 'gcs',
        source: 'gcpAdc',
        keyFilePath,
        useApplicationDefault: true,
      },
    });
  }
}

// ============================================================================
// Key File Credential Provider
// ============================================================================

/**
 * Resolves GCS credentials from a service account key file
 */
export class GCSKeyFileCredentialProvider implements CredentialProvider {
  readonly name = 'gcs-keyfile';
  readonly description = 'Resolve GCS credentials from service account key file';
  readonly priority = 200;

  private keyFilePath?: string;

  /**
   * Set the path to the service account key file
   */
  setKeyFilePath(path: string): void {
    this.keyFilePath = path;
  }

  canHandle(context: CredentialContext): boolean {
    if (context.providerType !== 'gcs') return false;

    // Can handle if key file path is configured or provided in source
    return !!(this.keyFilePath || context.source?.type === 'file');
  }

  resolve(context: CredentialContext): Promise<CredentialResult<GCSCredentials>> {
    let keyFilePath = this.keyFilePath;

    // Get from source hint if available
    if (context.source?.type === 'file') {
      keyFilePath = context.source.path;
    }

    if (!keyFilePath) {
      return Promise.resolve({
        success: false,
        error: {
          code: 'not_found',
          message: 'No key file path configured',
        },
      });
    }

    // Verify file exists
    if (!existsSync(keyFilePath)) {
      return Promise.resolve({
        success: false,
        error: {
          code: 'not_found',
          message: `Service account key file not found: ${keyFilePath}`,
        },
      });
    }

    return Promise.resolve({
      success: true,
      credentials: {
        type: 'gcs',
        source: 'file',
        keyFilePath,
      },
    });
  }
}

// ============================================================================
// Inline Credential Provider for GCS
// ============================================================================

/**
 * Resolves GCS credentials from inline profile configuration
 */
export class GCSInlineCredentialProvider implements CredentialProvider {
  readonly name = 'gcs-inline';
  readonly description = 'Resolve GCS credentials from profile configuration';
  readonly priority = 500;

  private config?: Record<string, unknown>;

  /**
   * Set the profile configuration to extract credentials from
   */
  setConfig(config: Record<string, unknown>): void {
    this.config = config;
  }

  canHandle(context: CredentialContext): boolean {
    return context.providerType === 'gcs' && this.config !== undefined;
  }

  resolve(_context: CredentialContext): Promise<CredentialResult<GCSCredentials>> {
    if (!this.config) {
      return Promise.resolve({
        success: false,
        error: {
          code: 'not_found',
          message: 'No profile configuration provided',
        },
      });
    }

    const keyFilePath = this.config.keyFilePath as string | undefined;
    const useApplicationDefault = this.config.useApplicationDefault as boolean | undefined;

    // Check if key file exists when specified
    if (keyFilePath && !existsSync(keyFilePath)) {
      return Promise.resolve({
        success: false,
        error: {
          code: 'not_found',
          message: `Service account key file not found: ${keyFilePath}`,
        },
      });
    }

    return Promise.resolve({
      success: true,
      credentials: {
        type: 'gcs',
        source: 'inline',
        keyFilePath,
        useApplicationDefault,
      },
    });
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create an array of GCS credential providers in priority order
 */
export function createGCSCredentialProviders(): CredentialProvider[] {
  return [
    new GCSAdcCredentialProvider(),
    new GCSKeyFileCredentialProvider(),
    new GCSInlineCredentialProvider(),
  ];
}
