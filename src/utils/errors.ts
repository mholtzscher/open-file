/**
 * Error handling utilities
 * 
 * Custom error types for adapter operations
 */

/**
 * Base adapter error class
 */
export class AdapterError extends Error {
  readonly code: string;
  readonly isRetryable: boolean;

  constructor(
    message: string,
    code: string = 'ADAPTER_ERROR',
    isRetryable: boolean = false
  ) {
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
    super(
      `Permission denied: cannot ${operation} ${path}`,
      'PERMISSION_DENIED',
      false
    );
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
    super(
      `Invalid path: ${path} (${reason})`,
      'INVALID_PATH',
      false
    );
    this.name = 'InvalidPathError';
  }
}

/**
 * Conflict error (e.g., file already exists)
 */
export class ConflictError extends AdapterError {
  constructor(path: string, reason: string = 'already exists') {
    super(
      `Conflict: ${path} ${reason}`,
      'CONFLICT',
      false
    );
    this.name = 'ConflictError';
  }
}

/**
 * Operation failed error
 */
export class OperationFailedError extends AdapterError {
  readonly originalError: Error;

  constructor(operation: string, originalError: Error) {
    super(
      `${operation} failed: ${originalError.message}`,
      'OPERATION_FAILED',
      false
    );
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

  // Check for specific AWS error codes
  if ('code' in error) {
    const awsCode = (error as any).code;
    
    switch (awsCode) {
      case 'NoSuchKey':
      case 'NoSuchBucket':
        return new NotFoundError((error as any).$metadata?.httpStatusCode === 404 ? 'S3 object' : 'bucket');
      
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
  if (message.includes('not found') || message.includes('NoSuchKey') || message.includes('NoSuchBucket')) {
    return new NotFoundError('S3 object');
  }

  // Default to generic operation failed
  return new OperationFailedError(operation, error);
}

/**
 * Create a user-friendly error message
 */
export function formatErrorForDisplay(error: AdapterError | Error): string {
  if (error instanceof AdapterError) {
    return `❌ ${error.message}`;
  }
  return `❌ Error: ${error.message}`;
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
