/**
 * Tests for storage error handling utilities
 */

import { describe, it, expect } from 'bun:test';
import {
  toUserError,
  formatErrorForDisplay,
  isRetryable,
  isConnectionError,
  isPermissionError,
  isNotFoundError,
  handleUnsupportedOperation,
  handleConnectionError,
  createContextualError,
  summarizeResults,
  getMostSevereError,
} from './storage-errors.js';
import { Result, OperationStatus } from '../providers/types/result.js';

// ============================================================================
// toUserError Tests
// ============================================================================

describe('toUserError', () => {
  it('converts success result', () => {
    const result = Result.success();
    const userError = toUserError(result);

    expect(userError.title).toBe('Success');
    expect(userError.message).toContain('successfully');
    expect(userError.canRetry).toBe(false);
    expect(userError.isUnsupported).toBe(false);
  });

  it('converts not found result', () => {
    const result = Result.notFound('/missing/file.txt');
    const userError = toUserError(result);

    expect(userError.title).toBe('Not Found');
    expect(userError.message).toContain('/missing/file.txt');
    expect(userError.canRetry).toBe(false);
    expect(userError.isUnsupported).toBe(false);
    expect(userError.action).toBeDefined();
    expect(userError.code).toBe('NOT_FOUND');
  });

  it('converts permission denied result', () => {
    const result = Result.permissionDenied('/protected/file.txt');
    const userError = toUserError(result);

    expect(userError.title).toBe('Access Denied');
    expect(userError.message).toContain('denied');
    expect(userError.canRetry).toBe(false);
    expect(userError.isUnsupported).toBe(false);
    expect(userError.code).toBe('PERMISSION_DENIED');
  });

  it('converts unimplemented result', () => {
    const result = Result.unimplemented('copy');
    const userError = toUserError(result);

    expect(userError.title).toBe('Not Supported');
    expect(userError.message).toContain('not supported');
    expect(userError.canRetry).toBe(false);
    expect(userError.isUnsupported).toBe(true);
    expect(userError.code).toBe('UNIMPLEMENTED');
  });

  it('converts connection failed result', () => {
    const result = Result.connectionFailed('Network timeout');
    const userError = toUserError(result);

    expect(userError.title).toBe('Connection Failed');
    expect(userError.message).toContain('Network timeout');
    expect(userError.canRetry).toBe(true);
    expect(userError.isUnsupported).toBe(false);
    expect(userError.code).toBe('CONNECTION_FAILED');
  });

  it('converts cancelled result', () => {
    const result = Result.cancelled();
    const userError = toUserError(result);

    expect(userError.title).toBe('Cancelled');
    expect(userError.message).toContain('cancelled');
    expect(userError.canRetry).toBe(false);
    expect(userError.code).toBe('CANCELLED');
  });

  it('converts generic error result', () => {
    const result = Result.error('CUSTOM_ERROR', 'Something went wrong', true);
    const userError = toUserError(result);

    expect(userError.title).toBe('Error');
    expect(userError.message).toBe('Something went wrong');
    expect(userError.canRetry).toBe(true);
    expect(userError.code).toBe('CUSTOM_ERROR');
  });
});

// ============================================================================
// formatErrorForDisplay Tests
// ============================================================================

describe('formatErrorForDisplay', () => {
  it('formats error with default options', () => {
    const result = Result.notFound('/file.txt');
    const formatted = formatErrorForDisplay(result);

    expect(formatted).toContain('not found');
    expect(formatted).toContain('/file.txt');
  });

  it('truncates long messages', () => {
    const longMessage = 'A'.repeat(200);
    const result = Result.error('TEST', longMessage, false);
    const formatted = formatErrorForDisplay(result, { maxLength: 50 });

    expect(formatted.length).toBeLessThanOrEqual(50);
    expect(formatted).toContain('...');
  });

  it('includes technical details when requested', () => {
    const result = Result.notFound('/file.txt');
    const formatted = formatErrorForDisplay(result, { includeTechnical: true });

    expect(formatted).toContain('NOT_FOUND');
  });

  it('excludes actions when requested', () => {
    const result = Result.notFound('/file.txt');
    const formatted = formatErrorForDisplay(result, { includeActions: false });

    expect(formatted).not.toContain('Check that');
  });

  it('includes actions by default', () => {
    const result = Result.notFound('/file.txt');
    const formatted = formatErrorForDisplay(result);

    expect(formatted).toContain('Check that');
  });
});

// ============================================================================
// Error Type Checking Tests
// ============================================================================

describe('Error type checking', () => {
  it('isRetryable identifies retryable errors', () => {
    const retryable = Result.connectionFailed('Network error');
    const notRetryable = Result.notFound('/file.txt');

    expect(isRetryable(retryable)).toBe(true);
    expect(isRetryable(notRetryable)).toBe(false);
  });

  it('isConnectionError identifies connection errors', () => {
    const connectionError = Result.connectionFailed('Network timeout');
    const otherError = Result.notFound('/file.txt');

    expect(isConnectionError(connectionError)).toBe(true);
    expect(isConnectionError(otherError)).toBe(false);
  });

  it('isPermissionError identifies permission errors', () => {
    const permissionError = Result.permissionDenied('/protected');
    const otherError = Result.notFound('/file.txt');

    expect(isPermissionError(permissionError)).toBe(true);
    expect(isPermissionError(otherError)).toBe(false);
  });

  it('isNotFoundError identifies not found errors', () => {
    const notFoundError = Result.notFound('/missing');
    const otherError = Result.permissionDenied('/protected');

    expect(isNotFoundError(notFoundError)).toBe(true);
    expect(isNotFoundError(otherError)).toBe(false);
  });
});

// ============================================================================
// Special Handler Tests
// ============================================================================

describe('handleUnsupportedOperation', () => {
  it('creates message without provider name', () => {
    const message = handleUnsupportedOperation('copy');

    expect(message).toContain('copy');
    expect(message).toContain('not supported');
    expect(message).toContain('unavailable');
  });

  it('creates message with provider name', () => {
    const message = handleUnsupportedOperation('copy', 'FTP');

    expect(message).toContain('copy');
    expect(message).toContain('FTP');
    expect(message).toContain('not supported');
  });
});

describe('handleConnectionError', () => {
  it('creates message without attempt number', () => {
    const result = Result.connectionFailed('Network timeout');
    const message = handleConnectionError(result);

    expect(message).toContain('Network timeout');
    expect(message).toContain('network connection');
    expect(message).not.toContain('Attempt');
  });

  it('creates message with attempt number', () => {
    const result = Result.connectionFailed('Network timeout');
    const message = handleConnectionError(result, 3);

    expect(message).toContain('Attempt 3');
    expect(message).toContain('network connection');
  });
});

describe('createContextualError', () => {
  it('adds operation context', () => {
    const result = Result.permissionDenied('/protected');
    const message = createContextualError(result, { operation: 'write' });

    expect(message).toContain('Failed to write');
    expect(message).toContain('denied');
  });

  it('adds path context', () => {
    const result = Result.notFound('/missing');
    const message = createContextualError(result, { path: '/some/file.txt' });

    expect(message).toContain('/some/file.txt');
  });

  it('adds both operation and path context', () => {
    const result = Result.permissionDenied('/protected');
    const message = createContextualError(result, {
      operation: 'delete',
      path: '/protected/file.txt',
    });

    expect(message).toContain('Failed to delete');
    expect(message).toContain('/protected/file.txt');
  });
});

// ============================================================================
// Batch Error Handling Tests
// ============================================================================

describe('summarizeResults', () => {
  it('counts successes and failures', () => {
    const results = [
      Result.success(),
      Result.success(),
      Result.notFound('/file1.txt'),
      Result.permissionDenied('/file2.txt'),
      Result.unimplemented('copy'),
    ];

    const summary = summarizeResults(results);

    expect(summary.successCount).toBe(2);
    expect(summary.failureCount).toBe(3);
    expect(summary.unsupportedCount).toBe(1);
    expect(summary.errors).toHaveLength(3);
  });

  it('handles all successes', () => {
    const results = [Result.success(), Result.success(), Result.success()];

    const summary = summarizeResults(results);

    expect(summary.successCount).toBe(3);
    expect(summary.failureCount).toBe(0);
    expect(summary.unsupportedCount).toBe(0);
    expect(summary.errors).toHaveLength(0);
  });

  it('handles all failures', () => {
    const results = [
      Result.notFound('/file1.txt'),
      Result.notFound('/file2.txt'),
      Result.notFound('/file3.txt'),
    ];

    const summary = summarizeResults(results);

    expect(summary.successCount).toBe(0);
    expect(summary.failureCount).toBe(3);
    expect(summary.errors).toHaveLength(3);
  });
});

describe('getMostSevereError', () => {
  it('returns null for all successes', () => {
    const results = [Result.success(), Result.success()];
    const error = getMostSevereError(results);

    expect(error).toBeNull();
  });

  it('prioritizes permission denied over other errors', () => {
    const results = [
      Result.notFound('/file1.txt'),
      Result.permissionDenied('/file2.txt'),
      Result.unimplemented('copy'),
    ];

    const error = getMostSevereError(results);

    expect(error).not.toBeNull();
    expect(error!.code).toBe('PERMISSION_DENIED');
  });

  it('prioritizes connection failed over not found', () => {
    const results = [
      Result.notFound('/file1.txt'),
      Result.connectionFailed('Network error'),
      Result.cancelled(),
    ];

    const error = getMostSevereError(results);

    expect(error).not.toBeNull();
    expect(error!.code).toBe('CONNECTION_FAILED');
  });

  it('returns not found when it is the only error', () => {
    const results = [Result.success(), Result.notFound('/file.txt'), Result.success()];

    const error = getMostSevereError(results);

    expect(error).not.toBeNull();
    expect(error!.code).toBe('NOT_FOUND');
  });
});
