/**
 * Tests for error handling utilities
 */

import { describe, it, expect } from 'bun:test';
import {
  AdapterError,
  NotFoundError,
  PermissionError,
  NetworkError,
  TimeoutError,
  InvalidPathError,
  ConflictError,
  OperationFailedError,
  parseAwsError,
  formatErrorForDisplay,
  isRetryable
} from './errors.js';

describe('AdapterError', () => {
  it('should create base adapter error', () => {
    const error = new AdapterError('Test message', 'TEST_CODE', true);
    
    expect(error.message).toBe('Test message');
    expect(error.code).toBe('TEST_CODE');
    expect(error.isRetryable).toBe(true);
    expect(error.name).toBe('AdapterError');
    expect(error.toString()).toBe('AdapterError: Test message');
  });

  it('should use defaults', () => {
    const error = new AdapterError('Test message');
    
    expect(error.code).toBe('ADAPTER_ERROR');
    expect(error.isRetryable).toBe(false);
  });
});

describe('NotFoundError', () => {
  it('should create not found error', () => {
    const error = new NotFoundError('/path/to/file');
    
    expect(error.message).toBe('Path not found: /path/to/file');
    expect(error.code).toBe('NOT_FOUND');
    expect(error.isRetryable).toBe(false);
    expect(error.name).toBe('NotFoundError');
  });
});

describe('PermissionError', () => {
  it('should create permission error', () => {
    const error = new PermissionError('/path/to/file', 'read');
    
    expect(error.message).toBe('Permission denied: cannot read /path/to/file');
    expect(error.code).toBe('PERMISSION_DENIED');
    expect(error.isRetryable).toBe(false);
    expect(error.name).toBe('PermissionError');
  });

  it('should use default operation', () => {
    const error = new PermissionError('/path/to/file');
    
    expect(error.message).toBe('Permission denied: cannot access /path/to/file');
  });
});

describe('NetworkError', () => {
  it('should create network error', () => {
    const error = new NetworkError('Connection failed');
    
    expect(error.message).toBe('Network error: Connection failed');
    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.isRetryable).toBe(true);
    expect(error.name).toBe('NetworkError');
  });
});

describe('TimeoutError', () => {
  it('should create timeout error', () => {
    const error = new TimeoutError('list operation');
    
    expect(error.message).toBe('Operation timeout: list operation');
    expect(error.code).toBe('TIMEOUT');
    expect(error.isRetryable).toBe(true);
    expect(error.name).toBe('TimeoutError');
  });
});

describe('InvalidPathError', () => {
  it('should create invalid path error', () => {
    const error = new InvalidPathError('invalid//path', 'double slash');
    
    expect(error.message).toBe('Invalid path: invalid//path (double slash)');
    expect(error.code).toBe('INVALID_PATH');
    expect(error.isRetryable).toBe(false);
    expect(error.name).toBe('InvalidPathError');
  });

  it('should use default reason', () => {
    const error = new InvalidPathError('invalid//path');
    
    expect(error.message).toBe('Invalid path: invalid//path (invalid format)');
  });
});

describe('ConflictError', () => {
  it('should create conflict error', () => {
    const error = new ConflictError('/path/to/file', 'already exists');
    
    expect(error.message).toBe('Conflict: /path/to/file already exists');
    expect(error.code).toBe('CONFLICT');
    expect(error.isRetryable).toBe(false);
    expect(error.name).toBe('ConflictError');
  });

  it('should use default reason', () => {
    const error = new ConflictError('/path/to/file');
    
    expect(error.message).toBe('Conflict: /path/to/file already exists');
  });
});

describe('OperationFailedError', () => {
  it('should create operation failed error', () => {
    const originalError = new Error('Original error');
    const error = new OperationFailedError('upload', originalError);
    
    expect(error.message).toBe('upload failed: Original error');
    expect(error.code).toBe('OPERATION_FAILED');
    expect(error.isRetryable).toBe(false);
    expect(error.name).toBe('OperationFailedError');
    expect(error.originalError).toBe(originalError);
  });
});

describe('parseAwsError', () => {
  it('should return AdapterError as-is', () => {
    const adapterError = new NotFoundError('/test');
    const result = parseAwsError(adapterError, 'test');
    
    expect(result).toBe(adapterError);
  });

  it('should handle non-Error objects', () => {
    const result = parseAwsError('string error', 'test');
    
    expect(result).toBeInstanceOf(OperationFailedError);
    expect(result.message).toBe('test failed: string error');
  });

  it('should parse AWS error codes', () => {
    const awsError = new Error('Test error');
    (awsError as any).code = 'NoSuchKey';
    
    const result = parseAwsError(awsError, 'get');
    
    expect(result).toBeInstanceOf(NotFoundError);
  });

  it('should parse AccessDenied error', () => {
    const awsError = new Error('Access denied');
    (awsError as any).code = 'AccessDenied';
    
    const result = parseAwsError(awsError, 'read');
    
    expect(result).toBeInstanceOf(PermissionError);
  });

  it('should parse ServiceUnavailable error', () => {
    const awsError = new Error('Service unavailable');
    (awsError as any).code = 'ServiceUnavailable';
    
    const result = parseAwsError(awsError, 'list');
    
    expect(result).toBeInstanceOf(NetworkError);
  });

  it('should parse timeout patterns', () => {
    const timeoutError = new Error('Request timeout occurred');
    
    const result = parseAwsError(timeoutError, 'upload');
    
    expect(result).toBeInstanceOf(TimeoutError);
  });

  it('should parse not found patterns', () => {
    const notFoundError = new Error('Object not found in bucket');
    
    const result = parseAwsError(notFoundError, 'get');
    
    expect(result).toBeInstanceOf(NotFoundError);
  });

  it('should default to OperationFailedError', () => {
    const genericError = new Error('Generic error');
    
    const result = parseAwsError(genericError, 'test');
    
    expect(result).toBeInstanceOf(OperationFailedError);
    expect((result as OperationFailedError).originalError).toBe(genericError);
  });

  it('should parse region mismatch error', () => {
    const regionError = new Error('The bucket must be addressed using specified endpoint');
    
    const result = parseAwsError(regionError, 'list');
    
    expect(result).toBeInstanceOf(AdapterError);
    expect(result.code).toBe('REGION_MISMATCH');
    expect(result.message).toContain('Region mismatch');
    expect(result.message).toContain('Try specifying the correct region');
  });

  it('should extract region from error message', () => {
    const regionError = new Error('Bucket in region: us-west-2, but client configured for us-east-1');
    
    const result = parseAwsError(regionError, 'list');
    
    expect(result).toBeInstanceOf(AdapterError);
    expect(result.code).toBe('REGION_MISMATCH');
    expect(result.message).toContain('us-west-2');
  });

  it('should parse PermanentRedirect error', () => {
    const redirectError = new Error('PermanentRedirect: The bucket is in another region');
    
    const result = parseAwsError(redirectError, 'list');
    
    expect(result).toBeInstanceOf(AdapterError);
    expect(result.code).toBe('REGION_MISMATCH');
    expect(result.message).toContain('Region mismatch');
  });
});

describe('formatErrorForDisplay', () => {
  it('should format AdapterError', () => {
    const error = new NotFoundError('/test');
    const result = formatErrorForDisplay(error);
    
    expect(result).toBe('❌ Path not found: /test');
  });

  it('should format generic Error', () => {
    const error = new Error('Generic error');
    const result = formatErrorForDisplay(error);
    
    expect(result).toBe('❌ Error: Generic error');
  });

  it('should wrap long error messages', () => {
    const error = new Error('This is a very long error message that should be wrapped because it exceeds the maximum line length allowed');
    const result = formatErrorForDisplay(error, 40);
    
    expect(result).toContain('\n');
    const lines = result.split('\n');
    expect(lines[0]).toMatch(/^❌ /);
    expect(lines[1]).toMatch(/^   /);
  });

  it('should not wrap short error messages', () => {
    const error = new Error('Short error');
    const result = formatErrorForDisplay(error, 80);
    
    expect(result).not.toContain('\n');
    expect(result).toBe('❌ Error: Short error');
  });
});

describe('isRetryable', () => {
  it('should return true for retryable AdapterError', () => {
    const error = new NetworkError('Connection failed');
    expect(isRetryable(error)).toBe(true);
  });

  it('should return false for non-retryable AdapterError', () => {
    const error = new NotFoundError('/test');
    expect(isRetryable(error)).toBe(false);
  });

  it('should return false for generic Error', () => {
    const error = new Error('Generic error');
    expect(isRetryable(error)).toBe(false);
  });
});