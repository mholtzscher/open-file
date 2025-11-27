/**
 * S3 Multipart Upload - Handles large file uploads using S3 multipart API
 *
 * AWS recommends multipart upload for files larger than 100MB,
 * but it can be used for files as small as 5MB.
 */

import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { retryWithBackoff, getS3RetryConfig } from '../../utils/retry.js';
import { ProgressCallback } from '../../types/progress.js';
import { getLogger } from '../../utils/logger.js';

/** Threshold above which to use multipart upload (5MB) */
export const MULTIPART_THRESHOLD = 5 * 1024 * 1024;

/** Size of each part in multipart upload (5MB - minimum allowed by S3) */
export const PART_SIZE = 5 * 1024 * 1024;

/**
 * Options for operations with progress callbacks
 */
export interface OperationOptions {
  /** Optional progress callback for tracking operation progress */
  onProgress?: ProgressCallback;
}

/**
 * Options for multipart upload
 */
export interface MultipartUploadOptions extends OperationOptions {
  /** Content type for the uploaded file */
  contentType?: string;
}

/**
 * Upload a large file using S3 multipart upload API
 *
 * @param client - S3 client instance
 * @param bucket - Target bucket name
 * @param key - S3 object key (path)
 * @param body - File content as Buffer
 * @param options - Upload options including progress callback
 */
export async function uploadLargeFile(
  client: S3Client,
  bucket: string,
  key: string,
  body: Buffer,
  options?: MultipartUploadOptions
): Promise<void> {
  const logger = getLogger();
  const totalBytes = body.length;
  const parts: { ETag: string; PartNumber: number }[] = [];
  let uploadId: string | undefined;

  logger.debug('Starting multipart upload', {
    bucket,
    key,
    totalBytes,
    partSize: PART_SIZE,
    numParts: Math.ceil(totalBytes / PART_SIZE),
  });

  try {
    // Initiate multipart upload
    const createResponse = await retryWithBackoff(() => {
      const command = new CreateMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        ...(options?.contentType && { ContentType: options.contentType }),
      });
      return client.send(command);
    }, getS3RetryConfig());

    uploadId = createResponse.UploadId;
    if (!uploadId) {
      throw new Error('Failed to initiate multipart upload: no UploadId returned');
    }

    logger.debug('Multipart upload initiated', { uploadId });

    // Upload parts
    const numParts = Math.ceil(totalBytes / PART_SIZE);
    for (let partNumber = 1; partNumber <= numParts; partNumber++) {
      const start = (partNumber - 1) * PART_SIZE;
      const end = Math.min(start + PART_SIZE, totalBytes);
      const partBody = body.subarray(start, end);

      logger.debug('Uploading part', {
        partNumber,
        numParts,
        start,
        end,
        partSize: partBody.length,
      });

      const uploadResponse = await retryWithBackoff(() => {
        const command = new UploadPartCommand({
          Bucket: bucket,
          Key: key,
          PartNumber: partNumber,
          UploadId: uploadId,
          Body: partBody,
        });
        return client.send(command);
      }, getS3RetryConfig());

      if (uploadResponse.ETag) {
        parts.push({
          ETag: uploadResponse.ETag,
          PartNumber: partNumber,
        });
      }

      // Report progress
      if (options?.onProgress) {
        options.onProgress({
          operation: 'Uploading file',
          bytesTransferred: end,
          totalBytes,
          percentage: Math.round((end / totalBytes) * 100),
          currentFile: key,
        });
      }
    }

    // Complete multipart upload
    logger.debug('Completing multipart upload', {
      uploadId,
      numParts: parts.length,
    });

    await retryWithBackoff(() => {
      const command = new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: { Parts: parts },
      });
      return client.send(command);
    }, getS3RetryConfig());

    logger.debug('Multipart upload completed', { key });
  } catch (error) {
    logger.error('Multipart upload failed', { key, uploadId, error });

    // Abort multipart upload on error
    if (uploadId) {
      await abortMultipartUpload(client, bucket, key, uploadId);
    }
    throw error;
  }
}

/**
 * Abort a multipart upload in progress
 *
 * Called automatically on failure to clean up incomplete uploads.
 */
export async function abortMultipartUpload(
  client: S3Client,
  bucket: string,
  key: string,
  uploadId: string
): Promise<void> {
  const logger = getLogger();

  try {
    logger.debug('Aborting multipart upload', { uploadId });

    await client.send(
      new AbortMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
      })
    );

    logger.debug('Multipart upload aborted', { uploadId });
  } catch (abortError) {
    logger.error('Failed to abort multipart upload', { uploadId, error: abortError });
  }
}

/**
 * Check if a file should use multipart upload based on size
 */
export function shouldUseMultipartUpload(size: number): boolean {
  return size > MULTIPART_THRESHOLD;
}
