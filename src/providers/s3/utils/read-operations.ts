/**
 * Read Operations Module
 *
 * Handles reading/downloading S3 objects with progress tracking.
 * Supports multiple body types: Buffer, ReadableStream, Node.js stream.
 */

import { S3Client, HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { ProgressCallback } from '../../../types/progress.js';
import { retryWithBackoff, getS3RetryConfig } from '../../../utils/retry.js';
import { reportProgress } from './progress-adapter.js';

/**
 * Logger interface for read operations
 */
export interface ReadOperationsLogger {
  error(message: string, error?: unknown): void;
}

/**
 * Options for reading an S3 object
 */
export interface ReadObjectOptions {
  /** S3 client instance */
  client: S3Client;
  /** Bucket name */
  bucket: string;
  /** Object key */
  key: string;
  /** Optional progress callback */
  onProgress?: ProgressCallback;
  /** Optional logger */
  logger?: ReadOperationsLogger;
}

/**
 * Read chunks from a ReadableStream with getReader()
 */
async function readFromReadableStream(
  body: { getReader(): { read(): Promise<{ done: boolean; value?: Uint8Array }> } },
  onProgress: ProgressCallback | undefined,
  totalBytes: number,
  key: string
): Promise<{ chunks: Uint8Array[]; bytesTransferred: number }> {
  const chunks: Uint8Array[] = [];
  let bytesTransferred = 0;

  const reader = body.getReader();
  let done = false;

  while (!done) {
    const result = await reader.read();
    done = result.done;

    if (result.value) {
      chunks.push(result.value);
      bytesTransferred += result.value.length;

      reportProgress(onProgress, 'Downloading file', bytesTransferred, totalBytes, key);
    }
  }

  return { chunks, bytesTransferred };
}

/**
 * Read chunks from a Node.js stream
 */
async function readFromNodeStream(
  stream: NodeJS.ReadableStream,
  onProgress: ProgressCallback | undefined,
  totalBytes: number,
  key: string
): Promise<{ chunks: Uint8Array[]; bytesTransferred: number }> {
  const chunks: Uint8Array[] = [];
  let bytesTransferred = 0;

  return new Promise((resolve, reject) => {
    stream.on('data', (chunk: Uint8Array) => {
      chunks.push(chunk);
      bytesTransferred += chunk.length;

      reportProgress(onProgress, 'Downloading file', bytesTransferred, totalBytes, key);
    });

    stream.on('end', () => resolve({ chunks, bytesTransferred }));
    stream.on('error', reject);
  });
}

/**
 * Read an S3 object and return its contents as a Buffer
 *
 * Handles multiple body types returned by S3:
 * - Buffer (direct)
 * - ReadableStream (browser/web)
 * - Node.js stream
 * - Buffer-like objects
 *
 * @param options - Read options including client, bucket, key, and callbacks
 * @returns Buffer containing the object contents
 * @throws Error if the object cannot be read or has no body
 *
 * @example
 * ```typescript
 * const buffer = await readObject({
 *   client: s3Client,
 *   bucket: 'my-bucket',
 *   key: 'path/to/file.txt',
 *   onProgress: (event) => console.log(`${event.percentage}% complete`),
 * });
 * ```
 */
export async function readObject(options: ReadObjectOptions): Promise<Buffer> {
  const { client, bucket, key, onProgress, logger } = options;

  try {
    // First, get the file size via HeadObject
    const headResponse = await retryWithBackoff(() => {
      const command = new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      });
      return client.send(command);
    }, getS3RetryConfig());

    const totalBytes = headResponse.ContentLength || 0;

    // Report initial progress
    reportProgress(onProgress, 'Downloading file', 0, totalBytes, key);

    // Download the file
    const getResponse = await retryWithBackoff(() => {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });
      return client.send(command);
    }, getS3RetryConfig());

    // Validate response body
    if (!getResponse.Body) {
      throw new Error('No body in response');
    }

    let chunks: Uint8Array[] = [];
    let bytesTransferred = 0;

    // Handle different body types
    if (getResponse.Body instanceof Buffer) {
      // Direct buffer
      bytesTransferred = getResponse.Body.length;
      chunks.push(getResponse.Body);
    } else if (typeof getResponse.Body === 'object' && 'getReader' in getResponse.Body) {
      // ReadableStream with getReader (browser/web style)
      const result = await readFromReadableStream(
        getResponse.Body as {
          getReader(): { read(): Promise<{ done: boolean; value?: Uint8Array }> };
        },
        onProgress,
        totalBytes,
        key
      );
      chunks = result.chunks;
      bytesTransferred = result.bytesTransferred;
    } else if (typeof getResponse.Body === 'object' && 'on' in getResponse.Body) {
      // Node.js stream
      const result = await readFromNodeStream(
        getResponse.Body as NodeJS.ReadableStream,
        onProgress,
        totalBytes,
        key
      );
      chunks = result.chunks;
      bytesTransferred = result.bytesTransferred;
    } else {
      // Try to use as buffer-like object (fallback)
      const bodyBuffer = Buffer.from(getResponse.Body as unknown as ArrayBuffer);
      chunks.push(bodyBuffer);
      bytesTransferred = bodyBuffer.length;
    }

    // Report completion
    reportProgress(onProgress, 'Downloaded file', bytesTransferred, totalBytes, key);

    // Combine chunks into single buffer
    return Buffer.concat(chunks);
  } catch (error) {
    logger?.error('Failed to read file from S3', error);
    throw error;
  }
}
