/**
 * Storage Error Handling Utilities
 *
 * Standardizes error handling across the UI for both legacy adapters
 * and new provider system. Maps OperationResult errors to user-friendly
 * messages and provides helpers for common error scenarios.
 *
 * Features:
 * - User-friendly error messages
 * - Graceful handling of unimplemented operations
 * - Retry suggestions for connection errors
 * - Consistent error display across UI
 */

import {
  OperationResult,
  OperationStatus,
  OperationError,
  isError,
  isUnimplemented,
} from '../providers/types/result.js';

// ============================================================================
// Types
// ============================================================================

/**
 * User-facing error information
 */
export interface UserError {
  /** Short error title */
  title: string;

  /** Detailed error message */
  message: string;

  /** Whether the operation can be retried */
  canRetry: boolean;

  /** Whether this is an unsupported operation */
  isUnsupported: boolean;

  /** Suggested action for the user */
  action?: string;

  /** Original error code for debugging */
  code?: string;
}

/**
 * Error display options
 */
export interface ErrorDisplayOptions {
  /** Maximum message length (will truncate if longer) */
  maxLength?: number;

  /** Whether to include technical details */
  includeTechnical?: boolean;

  /** Whether to include suggested actions */
  includeActions?: boolean;
}

// ============================================================================
// Error Message Mapping
// ============================================================================

/**
 * Map OperationStatus to user-friendly titles
 */
const ERROR_TITLES: Record<OperationStatus, string> = {
  [OperationStatus.Success]: 'Success',
  [OperationStatus.NotFound]: 'Not Found',
  [OperationStatus.PermissionDenied]: 'Access Denied',
  [OperationStatus.Unimplemented]: 'Not Supported',
  [OperationStatus.ConnectionFailed]: 'Connection Failed',
  [OperationStatus.Cancelled]: 'Cancelled',
  [OperationStatus.Error]: 'Error',
};

/**
 * Default user-friendly messages for each status
 */
const DEFAULT_MESSAGES: Record<OperationStatus, string> = {
  [OperationStatus.Success]: 'Operation completed successfully',
  [OperationStatus.NotFound]: 'The requested file or directory could not be found',
  [OperationStatus.PermissionDenied]: 'You do not have permission to perform this operation',
  [OperationStatus.Unimplemented]:
    'This operation is not supported by the current storage provider',
  [OperationStatus.ConnectionFailed]: 'Failed to connect to the storage provider',
  [OperationStatus.Cancelled]: 'The operation was cancelled',
  [OperationStatus.Error]: 'An unexpected error occurred',
};

/**
 * Suggested actions for each error type
 */
const SUGGESTED_ACTIONS: Partial<Record<OperationStatus, string>> = {
  [OperationStatus.NotFound]: 'Check that the path is correct and try again',
  [OperationStatus.PermissionDenied]: 'Verify your credentials and access permissions',
  [OperationStatus.Unimplemented]: 'This feature is not available for this storage type',
  [OperationStatus.ConnectionFailed]: 'Check your network connection and try again',
  [OperationStatus.Cancelled]: 'Start a new operation if needed',
};

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Convert OperationResult to user-friendly error
 *
 * @param result - The operation result to convert
 * @returns User-friendly error information
 *
 * @example
 * ```ts
 * const result = await storage.read('/file.txt');
 * if (isError(result)) {
 *   const userError = toUserError(result);
 *   showErrorDialog(userError.title, userError.message);
 * }
 * ```
 */
export function toUserError<T = void>(result: OperationResult<T>): UserError {
  const status = result.status;
  const error = result.error;

  return {
    title: ERROR_TITLES[status] || 'Error',
    message: error?.message || DEFAULT_MESSAGES[status],
    canRetry: error?.retryable ?? false,
    isUnsupported: status === OperationStatus.Unimplemented,
    action: SUGGESTED_ACTIONS[status],
    code: error?.code,
  };
}

/**
 * Format error for display with optional truncation
 *
 * @param result - The operation result
 * @param options - Display options
 * @returns Formatted error string
 *
 * @example
 * ```ts
 * const result = await storage.delete('/file.txt');
 * if (isError(result)) {
 *   const message = formatErrorForDisplay(result, { maxLength: 80 });
 *   setStatusMessage(message);
 * }
 * ```
 */
export function formatErrorForDisplay<T = void>(
  result: OperationResult<T>,
  options: ErrorDisplayOptions = {}
): string {
  const { maxLength = 120, includeTechnical = false, includeActions = true } = options;

  const userError = toUserError(result);
  let display = userError.message;

  // Add technical details if requested
  if (includeTechnical && userError.code) {
    display += ` (${userError.code})`;
  }

  // Add suggested action if requested
  if (includeActions && userError.action) {
    display += `. ${userError.action}`;
  }

  // Truncate if needed
  if (display.length > maxLength) {
    display = display.substring(0, maxLength - 3) + '...';
  }

  return display;
}

/**
 * Check if an error is retryable
 *
 * @param result - The operation result
 * @returns True if the operation can be retried
 *
 * @example
 * ```ts
 * const result = await storage.list('/');
 * if (isError(result) && isRetryable(result)) {
 *   showRetryButton();
 * }
 * ```
 */
export function isRetryable<T = void>(result: OperationResult<T>): boolean {
  return result.error?.retryable ?? false;
}

/**
 * Check if an error is a connection error
 *
 * @param result - The operation result
 * @returns True if this is a connection error
 */
export function isConnectionError<T = void>(result: OperationResult<T>): boolean {
  return result.status === OperationStatus.ConnectionFailed;
}

/**
 * Check if an error is a permission error
 */
export function isPermissionError<T = void>(result: OperationResult<T>): boolean {
  return result.status === OperationStatus.PermissionDenied;
}

/**
 * Check if an error is a not found error
 */
export function isNotFoundError<T = void>(result: OperationResult<T>): boolean {
  return result.status === OperationStatus.NotFound;
}

// ============================================================================
// Special Error Handlers
// ============================================================================

/**
 * Handle unimplemented operation gracefully
 *
 * Returns a friendly message indicating the feature is not supported.
 * Use this for providers that don't implement certain capabilities.
 *
 * @param operation - Name of the operation
 * @param providerName - Name of the storage provider
 * @returns User-friendly message
 *
 * @example
 * ```ts
 * const result = await storage.copy(source, dest);
 * if (isUnimplemented(result)) {
 *   const message = handleUnsupportedOperation('copy', 'FTP');
 *   showToast(message, 'warning');
 * }
 * ```
 */
export function handleUnsupportedOperation(operation: string, providerName?: string): string {
  const provider = providerName ? ` by ${providerName}` : '';
  return `${operation} is not supported${provider}. This feature is unavailable for this storage type.`;
}

/**
 * Handle connection error with retry suggestion
 *
 * Returns a message with retry instructions for connection failures.
 *
 * @param result - The operation result
 * @param attemptNumber - Current retry attempt (optional)
 * @returns User-friendly message with retry suggestion
 *
 * @example
 * ```ts
 * let attempt = 0;
 * while (attempt < 3) {
 *   const result = await storage.connect();
 *   if (isConnectionError(result)) {
 *     const message = handleConnectionError(result, attempt + 1);
 *     showError(message);
 *     attempt++;
 *     await sleep(1000 * attempt); // Exponential backoff
 *   } else {
 *     break;
 *   }
 * }
 * ```
 */
export function handleConnectionError(result: OperationResult, attemptNumber?: number): string {
  const userError = toUserError(result);
  let message = userError.message;

  if (attemptNumber && attemptNumber > 1) {
    message += ` (Attempt ${attemptNumber})`;
  }

  message += '. Please check your network connection and try again.';

  return message;
}

/**
 * Create error message with context
 *
 * Adds contextual information to make errors more helpful.
 *
 * @param result - The operation result
 * @param context - Additional context (e.g., file path, operation details)
 * @returns Contextualized error message
 *
 * @example
 * ```ts
 * const result = await storage.write('/protected/file.txt', content);
 * if (isError(result)) {
 *   const message = createContextualError(result, {
 *     path: '/protected/file.txt',
 *     operation: 'write',
 *   });
 *   showError(message);
 * }
 * ```
 */
export function createContextualError(
  result: OperationResult,
  context: { path?: string; operation?: string; [key: string]: unknown }
): string {
  const userError = toUserError(result);
  let message = userError.message;

  // Add operation context
  if (context.operation) {
    message = `Failed to ${context.operation}: ${message}`;
  }

  // Add path context
  if (context.path) {
    message += ` (${context.path})`;
  }

  return message;
}

// ============================================================================
// Batch Error Handling
// ============================================================================

/**
 * Summarize multiple operation results
 *
 * Useful for batch operations that may have mixed success/failure.
 *
 * @param results - Array of operation results
 * @returns Summary of successes and failures
 *
 * @example
 * ```ts
 * const results = await Promise.all(
 *   files.map(f => storage.delete(f))
 * );
 * const summary = summarizeResults(results);
 * showMessage(`${summary.successCount} deleted, ${summary.failureCount} failed`);
 * ```
 */
export function summarizeResults<T = void>(
  results: OperationResult<T>[]
): {
  successCount: number;
  failureCount: number;
  unsupportedCount: number;
  errors: UserError[];
} {
  let successCount = 0;
  let failureCount = 0;
  let unsupportedCount = 0;
  const errors: UserError[] = [];

  for (const result of results) {
    if (result.status === OperationStatus.Success) {
      successCount++;
    } else {
      if (isUnimplemented(result)) {
        unsupportedCount++;
      }
      failureCount++;
      errors.push(toUserError(result));
    }
  }

  return { successCount, failureCount, unsupportedCount, errors };
}

/**
 * Get most severe error from multiple results
 *
 * Prioritizes errors by severity to show the most important one.
 *
 * @param results - Array of operation results
 * @returns The most severe error, or null if all succeeded
 */
export function getMostSevereError<T = void>(results: OperationResult<T>[]): UserError | null {
  // Priority order (most to least severe)
  const priorities = [
    OperationStatus.PermissionDenied,
    OperationStatus.ConnectionFailed,
    OperationStatus.Error,
    OperationStatus.NotFound,
    OperationStatus.Unimplemented,
    OperationStatus.Cancelled,
  ];

  for (const priority of priorities) {
    const match = results.find(r => r.status === priority);
    if (match) {
      return toUserError(match);
    }
  }

  return null;
}
