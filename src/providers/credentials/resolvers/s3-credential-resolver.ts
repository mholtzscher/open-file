/**
 * S3 Credential Resolver
 *
 * Resolves AWS/S3 credentials from multiple sources in priority order:
 * 1. Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
 * 2. AWS profile (~/.aws/credentials)
 * 3. Inline credentials in profile config
 * 4. IAM instance role (when running on EC2/ECS)
 */

import type {
  CredentialProvider,
  CredentialContext,
  CredentialResult,
  S3Credentials,
} from '../types.js';
import { loadAwsProfile } from '../../s3/utils/aws-profile.js';

// ============================================================================
// Environment Credential Provider for S3
// ============================================================================

/**
 * Resolves S3 credentials from environment variables
 */
export class S3EnvironmentCredentialProvider implements CredentialProvider {
  readonly name = 's3-environment';
  readonly description = 'Resolve S3 credentials from AWS environment variables';
  readonly priority = 100;

  canHandle(context: CredentialContext): boolean {
    return context.providerType === 's3';
  }

  async resolve(_context: CredentialContext): Promise<CredentialResult<S3Credentials>> {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    if (!accessKeyId || !secretAccessKey) {
      return {
        success: false,
        error: {
          code: 'not_found',
          message: 'AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY not set in environment',
        },
      };
    }

    return {
      success: true,
      credentials: {
        type: 's3',
        source: 'environment',
        accessKeyId,
        secretAccessKey,
        sessionToken: process.env.AWS_SESSION_TOKEN,
      },
    };
  }
}

// ============================================================================
// AWS Profile Credential Provider
// ============================================================================

/**
 * Resolves S3 credentials from AWS CLI profile (~/.aws/credentials)
 */
export class S3ProfileCredentialProvider implements CredentialProvider {
  readonly name = 's3-aws-profile';
  readonly description = 'Resolve S3 credentials from AWS CLI profile';
  readonly priority = 200;

  private profileName?: string;

  /**
   * Set the AWS profile name to use
   */
  setProfileName(name: string): void {
    this.profileName = name;
  }

  canHandle(context: CredentialContext): boolean {
    return context.providerType === 's3';
  }

  async resolve(context: CredentialContext): Promise<CredentialResult<S3Credentials>> {
    // Get profile name from context source hint, or use configured name, or default
    let profileName = this.profileName || 'default';

    if (context.source?.type === 'awsProfile') {
      profileName = context.source.profileName;
    }

    const awsProfile = loadAwsProfile(profileName);

    if (!awsProfile?.accessKeyId || !awsProfile?.secretAccessKey) {
      return {
        success: false,
        error: {
          code: 'not_found',
          message: `No credentials found in AWS profile: ${profileName}`,
        },
      };
    }

    return {
      success: true,
      credentials: {
        type: 's3',
        source: 'awsProfile',
        accessKeyId: awsProfile.accessKeyId,
        secretAccessKey: awsProfile.secretAccessKey,
        sessionToken: awsProfile.sessionToken,
      },
    };
  }
}

// ============================================================================
// Inline Credential Provider for S3
// ============================================================================

/**
 * Resolves S3 credentials from inline profile configuration
 */
export class S3InlineCredentialProvider implements CredentialProvider {
  readonly name = 's3-inline';
  readonly description = 'Resolve S3 credentials from profile configuration';
  readonly priority = 500;

  private config?: Record<string, unknown>;

  /**
   * Set the profile configuration to extract credentials from
   */
  setConfig(config: Record<string, unknown>): void {
    this.config = config;
  }

  canHandle(context: CredentialContext): boolean {
    return context.providerType === 's3' && this.config !== undefined;
  }

  async resolve(_context: CredentialContext): Promise<CredentialResult<S3Credentials>> {
    if (!this.config) {
      return {
        success: false,
        error: {
          code: 'not_found',
          message: 'No profile configuration provided',
        },
      };
    }

    const accessKeyId = this.config.accessKeyId as string | undefined;
    const secretAccessKey = this.config.secretAccessKey as string | undefined;

    if (!accessKeyId || !secretAccessKey) {
      return {
        success: false,
        error: {
          code: 'not_found',
          message: 'accessKeyId or secretAccessKey not found in profile config',
        },
      };
    }

    return {
      success: true,
      credentials: {
        type: 's3',
        source: 'inline',
        accessKeyId,
        secretAccessKey,
        sessionToken: this.config.sessionToken as string | undefined,
      },
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create an array of S3 credential providers in priority order
 */
export function createS3CredentialProviders(): CredentialProvider[] {
  return [
    new S3EnvironmentCredentialProvider(),
    new S3ProfileCredentialProvider(),
    new S3InlineCredentialProvider(),
  ];
}
