/**
 * Error handling utilities
 *
 * Custom error types for adapter operations
 */

/**
 * Interface for AWS SDK-like errors with code and metadata
 */
export interface AwsLikeError extends Error {
  code?: string;
  $metadata?: {
    httpStatusCode?: number;
  };
}

/**
 * Base adapter error class
 */
export class AdapterError extends Error {
  readonly code: string;
  readonly isRetryable: boolean;

  constructor(message: string, code: string = 'ADAPTER_ERROR', isRetryable: boolean = false) {
    super(message);
    this.name = 'AdapterError';
    this.code = code;
    this.isRetryable = isRetryable;
  }

  /**
   * Convert to display string
   */
  toString(): string {
    return `${this.name}: ${this.message}`;
  }
}

/**
 * File or directory not found error
 */
export class NotFoundError extends AdapterError {
  constructor(path: string) {
    super(`Path not found: ${path}`, 'NOT_FOUND', false);
    this.name = 'NotFoundError';
  }
}

/**
 * Permission denied error
 */
export class PermissionError extends AdapterError {
  constructor(path: string, operation: string = 'access') {
    super(`Permission denied: cannot ${operation} ${path}`, 'PERMISSION_DENIED', false);
    this.name = 'PermissionError';
  }
}

/**
 * Network or connectivity error
 */
export class NetworkError extends AdapterError {
  constructor(message: string) {
    super(
      `Network error: ${message}`,
      'NETWORK_ERROR',
      true // Retryable
    );
    this.name = 'NetworkError';
  }
}

/**
 * Timeout error
 */
export class TimeoutError extends AdapterError {
  constructor(operation: string) {
    super(
      `Operation timeout: ${operation}`,
      'TIMEOUT',
      true // Retryable
    );
    this.name = 'TimeoutError';
  }
}

/**
 * Invalid path error
 */
export class InvalidPathError extends AdapterError {
  constructor(path: string, reason: string = 'invalid format') {
    super(`Invalid path: ${path} (${reason})`, 'INVALID_PATH', false);
    this.name = 'InvalidPathError';
  }
}

/**
 * Conflict error (e.g., file already exists)
 */
export class ConflictError extends AdapterError {
  constructor(path: string, reason: string = 'already exists') {
    super(`Conflict: ${path} ${reason}`, 'CONFLICT', false);
    this.name = 'ConflictError';
  }
}

/**
 * Operation failed error
 */
export class OperationFailedError extends AdapterError {
  readonly originalError: Error;

  constructor(operation: string, originalError: Error) {
    super(`${operation} failed: ${originalError.message}`, 'OPERATION_FAILED', false);
    this.name = 'OperationFailedError';
    this.originalError = originalError;
  }
}

/**
 * Parse AWS SDK error to AdapterError
 */
export function parseAwsError(error: unknown, operation: string = 'operation'): AdapterError {
  if (error instanceof AdapterError) {
    return error;
  }

  if (!(error instanceof Error)) {
    return new OperationFailedError(operation, new Error(String(error)));
  }

  const message = error.message || error.toString();

  // Check for region mismatch error (very common issue)
  if (
    message.includes('bucket must be addressed using specified endpoint') ||
    message.includes('PermanentRedirect') ||
    message.includes('moved permanently') ||
    (message.includes('region') &&
      (message.includes('but client configured') || message.includes('Bucket in')))
  ) {
    // Extract region from error message if available
    let suggestion = 'Bucket may be in a different region. ';

    // Try to extract the correct region from error metadata (multiple patterns)
    const regionMatch =
      message.match(/region[:\s]+([a-z0-9-]+)/i) ||
      message.match(/Bucket in region[:\s]+([a-z0-9-]+)/i);
    if (regionMatch && regionMatch[1]) {
      suggestion += `Try: --region ${regionMatch[1]}`;
    } else {
      suggestion +=
        'Try specifying the correct region with --region flag (e.g., us-west-2, eu-west-1)';
    }

    return new AdapterError(`Region mismatch: ${suggestion}`, 'REGION_MISMATCH', false);
  }

  // Check for specific AWS error codes
  if ('code' in error) {
    const awsError = error as AwsLikeError;
    const awsCode = awsError.code;

    switch (awsCode) {
      case 'NoSuchKey':
      case 'NoSuchBucket':
        return new NotFoundError(
          awsError.$metadata?.httpStatusCode === 404 ? 'S3 object' : 'bucket'
        );

      case 'AccessDenied':
      case 'Forbidden':
        return new PermissionError('S3 resource', operation);

      case 'ServiceUnavailable':
      case 'RequestTimeout':
      case 'SlowDown':
        return new NetworkError(awsCode);

      case 'NetworkingError':
      case 'TimeoutError':
        return new NetworkError(message);

      default:
        return new OperationFailedError(operation, error);
    }
  }

  // Check for timeout patterns
  if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
    return new TimeoutError(operation);
  }

  // Check for not found patterns
  if (
    message.includes('not found') ||
    message.includes('NoSuchKey') ||
    message.includes('NoSuchBucket')
  ) {
    return new NotFoundError('S3 object');
  }

  // Default to generic operation failed
  return new OperationFailedError(operation, error);
}

/**
 * Create a user-friendly error message
 * Wraps long messages for better readability
 */
export function formatErrorForDisplay(error: AdapterError | Error, maxLength: number = 80): string {
  const message = error instanceof AdapterError ? error.message : `Error: ${error.message}`;

  // For shorter messages, just prefix with emoji
  if (message.length <= maxLength) {
    return `❌ ${message}`;
  }

  // For longer messages, try to wrap at word boundaries
  const words = message.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).length > maxLength) {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
    } else {
      currentLine = currentLine ? `${currentLine} ${word}` : word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  // Return first line with emoji, rest indented
  return lines.map((line, i) => (i === 0 ? `❌ ${line}` : `   ${line}`)).join('\n');
}

/**
 * Check if error is retryable
 */
export function isRetryable(error: AdapterError | Error): boolean {
  if (error instanceof AdapterError) {
    return error.isRetryable;
  }
  return false;
}
