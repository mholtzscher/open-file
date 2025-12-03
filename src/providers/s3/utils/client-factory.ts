/**
 * S3 Client Factory - Creates configured S3Client instances
 */

import { S3Client, S3ClientConfig } from '@aws-sdk/client-s3';
import { fromIni } from '@aws-sdk/credential-provider-ini';
import { getLogger } from '../../../utils/logger.js';

export interface S3ClientOptions {
  /** AWS region (defaults to AWS_REGION or us-east-1) */
  region?: string;
  /** AWS profile name */
  profile?: string;
  /** Custom S3 endpoint (for LocalStack/MinIO/etc.) */
  endpoint?: string;
  /** Force path style (required for MinIO and some S3-compatible services) */
  forcePathStyle?: boolean;
}

export interface S3ClientResult {
  client: S3Client;
  region: string;
}

/**
 * Create an S3 client with the given options
 */
export function createS3Client(options: S3ClientOptions): S3ClientResult {
  const logger = getLogger();
  const clientConfig: S3ClientConfig = {};

  logger.debug('Creating S3 client', {
    region: options.region,
    profile: options.profile,
    endpoint: options.endpoint,
  });

  const resolvedRegion = options.region ?? process.env.AWS_REGION ?? 'us-east-1';
  clientConfig.region = resolvedRegion;
  logger.debug('Resolved region', { region: resolvedRegion });

  if (options.endpoint) {
    clientConfig.endpoint = options.endpoint;
    clientConfig.forcePathStyle = options.forcePathStyle ?? true;
    logger.debug('Using custom endpoint', {
      endpoint: options.endpoint,
      forcePathStyle: clientConfig.forcePathStyle,
    });
  }

  if (options.profile) {
    clientConfig.credentials = fromIni({ profile: options.profile });
    logger.debug('Using AWS profile', { profile: options.profile });
  } else {
    logger.debug('Using default credential chain');
  }

  const client = new S3Client(clientConfig);
  logger.info('S3 client created', {
    region: resolvedRegion,
    profile: options.profile,
  });

  return { client, region: resolvedRegion };
}
