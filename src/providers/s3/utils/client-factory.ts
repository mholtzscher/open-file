/**
 * S3 Client Factory - Creates configured S3Client instances
 *
 * Handles AWS credentials, region resolution, and custom endpoints.
 */

import { S3Client, S3ClientConfig } from '@aws-sdk/client-s3';
import { loadAwsProfile } from './aws-profile.js';
import { getLogger } from '../../../utils/logger.js';

/**
 * Configuration for S3 client creation
 */
export interface S3ClientOptions {
  /** AWS region (defaults to AWS_REGION or us-east-1) */
  region?: string;
  /** Access key (optional - uses AWS credentials from environment if not provided) */
  accessKeyId?: string;
  /** Secret access key (optional) */
  secretAccessKey?: string;
  /** Session token (optional - for temporary credentials) */
  sessionToken?: string;
  /** AWS profile name (optional - uses AWS_PROFILE if not provided) */
  profile?: string;
  /** Custom S3 endpoint (for LocalStack/MinIO/etc.) */
  endpoint?: string;
  /** Force path style (required for MinIO and some S3-compatible services) */
  forcePathStyle?: boolean;
}

/**
 * Result of creating an S3 client, includes resolved region
 */
export interface S3ClientResult {
  client: S3Client;
  region: string;
}

/**
 * Create an S3 client with the given options
 *
 * Credential resolution order:
 * 1. Explicit credentials in options
 * 2. Profile credentials from ~/.aws/credentials
 * 3. AWS SDK default chain (env vars, instance metadata, etc.)
 *
 * Region resolution order:
 * 1. Explicit region in options
 * 2. Profile region from ~/.aws/config
 * 3. AWS_REGION environment variable
 * 4. Default to us-east-1
 */
export function createS3Client(options: S3ClientOptions): S3ClientResult {
  const logger = getLogger();
  const clientConfig: S3ClientConfig = {};

  logger.debug('Creating S3 client', {
    region: options.region,
    profile: options.profile,
    endpoint: options.endpoint,
    hasAccessKey: !!options.accessKeyId,
    hasSecretKey: !!options.secretAccessKey,
  });

  // Load AWS profile configuration only if explicitly specified in options
  // Otherwise, let the AWS SDK handle credential resolution via its default chain
  let profileConfig = undefined;
  if (options.profile) {
    profileConfig = loadAwsProfile(options.profile);
    logger.debug('Loaded AWS profile config', {
      profile: profileConfig?.profile,
      region: profileConfig?.region,
      hasCredentials: !!profileConfig?.accessKeyId,
    });
  }

  // Region priority: explicit config > profile region > AWS_REGION env > us-east-1
  let resolvedRegion: string;
  if (options.region) {
    clientConfig.region = options.region;
    resolvedRegion = options.region;
    logger.debug('Using explicit region from options', { region: options.region });
  } else if (profileConfig?.region) {
    clientConfig.region = profileConfig.region;
    resolvedRegion = profileConfig.region;
    logger.debug('Using region from profile', { region: profileConfig.region });
  } else if (process.env.AWS_REGION) {
    clientConfig.region = process.env.AWS_REGION;
    resolvedRegion = process.env.AWS_REGION;
    logger.debug('Using region from AWS_REGION env', { region: process.env.AWS_REGION });
  } else {
    // Default to us-east-1 if no region specified
    resolvedRegion = 'us-east-1';
    clientConfig.region = resolvedRegion;
    logger.debug('Using default region', { region: resolvedRegion });
  }

  // Custom endpoint (for LocalStack, MinIO, etc.)
  if (options.endpoint) {
    clientConfig.endpoint = options.endpoint;
    clientConfig.forcePathStyle = options.forcePathStyle ?? true;
    logger.debug('Using custom endpoint', {
      endpoint: options.endpoint,
      forcePathStyle: clientConfig.forcePathStyle,
    });
  }

  // Credentials priority:
  // 1. Explicit credentials in options
  // 2. Profile credentials
  // 3. AWS SDK default chain (env vars, instance metadata, etc.)
  if (options.accessKeyId && options.secretAccessKey) {
    clientConfig.credentials = {
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
      ...(options.sessionToken && { sessionToken: options.sessionToken }),
    };
    logger.debug('Using explicit credentials from options');
  } else if (profileConfig?.accessKeyId && profileConfig?.secretAccessKey) {
    clientConfig.credentials = {
      accessKeyId: profileConfig.accessKeyId,
      secretAccessKey: profileConfig.secretAccessKey,
      ...(profileConfig.sessionToken && { sessionToken: profileConfig.sessionToken }),
    };
    logger.debug('Using credentials from AWS profile', { profile: options.profile });
  } else {
    logger.debug('Using AWS SDK default credential chain');
  }

  logger.debug('S3Client configuration', {
    region: clientConfig.region,
    endpoint: clientConfig.endpoint,
    hasCredentials: !!clientConfig.credentials,
  });

  const client = new S3Client(clientConfig);
  logger.info('S3 client created', {
    region: resolvedRegion,
    profile: options.profile,
  });

  return { client, region: resolvedRegion };
}
