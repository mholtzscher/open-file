/**
 * Operation Result Types
 *
 * Every operation returns an OperationResult to handle:
 * - Success with data
 * - Unimplemented (provider doesn't support this operation)
 * - Errors with context
 *
 * This replaces throwing exceptions, making error handling explicit.
 */

/**
 * Status codes for operation results
 */
export enum OperationStatus {
  /** Operation completed successfully */
  Success = 'success',
  /** Resource not found */
  NotFound = 'not_found',
  /** Permission denied */
  PermissionDenied = 'permission_denied',
  /** Operation not supported by this provider */
  Unimplemented = 'unimplemented',
  /** Connection to provider failed */
  ConnectionFailed = 'connection_failed',
  /** Operation was cancelled */
  Cancelled = 'cancelled',
  /** Generic error */
  Error = 'error',
}

/**
 * Error details for failed operations
 */
export interface OperationError {
  /** Error code for programmatic handling */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Whether the operation can be retried */
  retryable: boolean;
  /** Original error if available */
  cause?: unknown;
}

/**
 * Result of an operation, containing either success data or error details
 */
export interface OperationResult<T = void> {
  /** Status of the operation */
  status: OperationStatus;
  /** Data returned on success (for operations that return data) */
  data?: T;
  /** Error details on failure */
  error?: OperationError;
}

/**
 * Factory functions for creating OperationResult instances
 */
export const Result = {
  /**
   * Create a successful result
   */
  success: <T>(data?: T): OperationResult<T> => ({
    status: OperationStatus.Success,
    data,
  }),

  /**
   * Create a not found result
   */
  notFound: (path: string): OperationResult => ({
    status: OperationStatus.NotFound,
    error: {
      code: 'NOT_FOUND',
      message: `Path not found: ${path}`,
      retryable: false,
    },
  }),

  /**
   * Create a permission denied result
   */
  permissionDenied: (path: string): OperationResult => ({
    status: OperationStatus.PermissionDenied,
    error: {
      code: 'PERMISSION_DENIED',
      message: `Access denied: ${path}`,
      retryable: false,
    },
  }),

  /**
   * Create an unimplemented result
   */
  unimplemented: (operation: string): OperationResult => ({
    status: OperationStatus.Unimplemented,
    error: {
      code: 'UNIMPLEMENTED',
      message: `${operation} not supported by this provider`,
      retryable: false,
    },
  }),

  /**
   * Create a connection failed result
   */
  connectionFailed: (message: string): OperationResult => ({
    status: OperationStatus.ConnectionFailed,
    error: {
      code: 'CONNECTION_FAILED',
      message,
      retryable: true,
    },
  }),

  /**
   * Create a cancelled result
   */
  cancelled: (): OperationResult => ({
    status: OperationStatus.Cancelled,
    error: {
      code: 'CANCELLED',
      message: 'Operation was cancelled',
      retryable: false,
    },
  }),

  /**
   * Create a generic error result
   */
  error: (code: string, message: string, retryable = false, cause?: unknown): OperationResult => ({
    status: OperationStatus.Error,
    error: { code, message, retryable, cause },
  }),
};

/**
 * Type guard to check if a result is successful
 */
export function isSuccess<T>(
  result: OperationResult<T>
): result is OperationResult<T> & { status: OperationStatus.Success; data: T } {
  return result.status === OperationStatus.Success;
}

/**
 * Type guard to check if a result is an error
 */
export function isError<T>(
  result: OperationResult<T>
): result is OperationResult<T> & { error: OperationError } {
  return result.status !== OperationStatus.Success;
}

/**
 * Type guard to check if a result indicates the operation is not supported
 */
export function isUnimplemented<T>(result: OperationResult<T>): boolean {
  return result.status === OperationStatus.Unimplemented;
}
