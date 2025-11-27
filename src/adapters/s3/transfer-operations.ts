/**
 * S3 Transfer Operations
 *
 * Functions for transferring files between S3 and the local filesystem.
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { retryWithBackoff, getS3RetryConfig } from '../../utils/retry.js';
import { listAllObjects } from './batch-operations.js';
import { uploadLargeFile, shouldUseMultipartUpload, OperationOptions } from './multipart-upload.js';

/**
 * Progress callback for transfer operations
 */
export type TransferProgressCallback = (
  transferred: number,
  total: number,
  currentFile: string
) => void;

/**
 * Function type for reading an S3 object to a buffer
 */
export type S3ReadFunction = (key: string, options?: OperationOptions) => Promise<Buffer>;

/**
 * Options for downloading a single file
 */
export interface DownloadFileOptions {
  /** Function to read from S3 */
  readFromS3: S3ReadFunction;
  /** S3 object key */
  s3Key: string;
  /** Local file path */
  localPath: string;
  /** Optional operation options */
  options?: OperationOptions;
}

/**
 * Download a single S3 file to local filesystem
 *
 * @param opts - Download options
 */
export async function downloadFileToLocal(opts: DownloadFileOptions): Promise<void> {
  const { readFromS3, s3Key, localPath, options } = opts;

  // Ensure parent directory exists
  const parentDir = dirname(localPath);
  await fs.mkdir(parentDir, { recursive: true });

  // Download the file
  const fileBuffer = await readFromS3(s3Key, options);

  // Write to local filesystem
  await fs.writeFile(localPath, fileBuffer);
}

/**
 * Options for downloading a directory
 */
export interface DownloadDirectoryOptions {
  /** S3 client to use */
  client: S3Client;
  /** Bucket name */
  bucket: string;
  /** Function to read from S3 */
  readFromS3: S3ReadFunction;
  /** S3 prefix (directory path) */
  s3Prefix: string;
  /** Local directory path */
  localPath: string;
  /** Optional progress callback */
  onProgress?: TransferProgressCallback;
  /** Optional operation options for individual file reads */
  options?: OperationOptions;
}

/**
 * Download all files under an S3 prefix to local filesystem
 *
 * @param opts - Download directory options
 */
export async function downloadDirectoryToLocal(opts: DownloadDirectoryOptions): Promise<void> {
  const { client, bucket, readFromS3, s3Prefix, localPath, onProgress, options } = opts;

  // List all files (exclude directory markers and the prefix itself)
  const objectsToDownload = await listAllObjects({
    client,
    bucket,
    prefix: s3Prefix,
    excludeKey: s3Prefix,
    excludeDirectoryMarkers: true,
  });

  // Download each file
  for (let i = 0; i < objectsToDownload.length; i++) {
    const s3Key = objectsToDownload[i];
    const relativePath = s3Key.substring(s3Prefix.length);
    const localFilePath = join(localPath, relativePath);

    await downloadFileToLocal({
      readFromS3,
      s3Key,
      localPath: localFilePath,
      options,
    });

    // Report progress
    if (onProgress) {
      onProgress(i + 1, objectsToDownload.length, s3Key);
    }
  }
}

/**
 * Options for uploading a single file
 */
export interface UploadFileOptions {
  /** S3 client to use */
  client: S3Client;
  /** Bucket name */
  bucket: string;
  /** Local file path */
  localPath: string;
  /** S3 object key */
  s3Key: string;
  /** Optional operation options */
  options?: OperationOptions;
}

/**
 * Upload a single local file to S3
 *
 * @param opts - Upload options
 */
export async function uploadFileToS3(opts: UploadFileOptions): Promise<void> {
  const { client, bucket, localPath, s3Key, options } = opts;

  // Read the file
  const fileBuffer = await fs.readFile(localPath);
  const totalBytes = fileBuffer.length;

  if (options?.onProgress) {
    options.onProgress({
      operation: 'Uploading file',
      bytesTransferred: 0,
      totalBytes,
      percentage: 0,
      currentFile: s3Key,
    });
  }

  // Use multipart upload for large files
  if (shouldUseMultipartUpload(totalBytes)) {
    await uploadLargeFile(client, bucket, s3Key, fileBuffer, options);
  } else {
    // Use regular PutObject for small files
    await retryWithBackoff(() => {
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: s3Key,
        Body: fileBuffer,
      });
      return client.send(command);
    }, getS3RetryConfig());
  }

  if (options?.onProgress) {
    options.onProgress({
      operation: 'Uploaded file',
      bytesTransferred: totalBytes,
      totalBytes,
      percentage: 100,
      currentFile: s3Key,
    });
  }
}

/**
 * Options for uploading a directory
 */
export interface UploadDirectoryOptions {
  /** S3 client to use */
  client: S3Client;
  /** Bucket name */
  bucket: string;
  /** Local directory path */
  localPath: string;
  /** S3 prefix (directory path) */
  s3Prefix: string;
  /** Optional progress callback */
  onProgress?: TransferProgressCallback;
  /** Optional operation options for individual file uploads */
  options?: OperationOptions;
}

/**
 * Collect all files in a directory recursively
 */
async function collectLocalFiles(
  dir: string,
  prefix: string
): Promise<{ localPath: string; s3Key: string }[]> {
  const files: { localPath: string; s3Key: string }[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const s3Key = prefix + entry.name;

    if (entry.isDirectory()) {
      // Recursively collect from subdirectory
      const subFiles = await collectLocalFiles(fullPath, s3Key + '/');
      files.push(...subFiles);
    } else if (entry.isFile()) {
      files.push({ localPath: fullPath, s3Key });
    }
  }

  return files;
}

/**
 * Upload a local directory to S3 recursively
 *
 * @param opts - Upload directory options
 */
export async function uploadDirectoryToS3(opts: UploadDirectoryOptions): Promise<void> {
  const { client, bucket, localPath, s3Prefix, onProgress, options } = opts;

  // Collect all files
  const filesToUpload = await collectLocalFiles(localPath, s3Prefix);

  // Upload each file
  for (let i = 0; i < filesToUpload.length; i++) {
    const { localPath: filePath, s3Key } = filesToUpload[i];

    await uploadFileToS3({
      client,
      bucket,
      localPath: filePath,
      s3Key,
      options,
    });

    // Report progress
    if (onProgress) {
      onProgress(i + 1, filesToUpload.length, s3Key);
    }
  }
}
