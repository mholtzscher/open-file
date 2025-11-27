/**
 * Test Utilities for Provider Testing
 *
 * Provides assertion helpers and utility functions for testing
 * provider implementations and OperationResult handling.
 */

import { expect } from 'bun:test';
import {
  OperationResult,
  OperationStatus,
  OperationError,
  isSuccess,
  isError,
} from '../types/result.js';
import type { Entry } from '../../types/entry.js';

// ============================================================================
// OperationResult Assertions
// ============================================================================

/**
 * Assert that an operation result is successful
 */
export function expectSuccess<T>(
  result: OperationResult<T>
): asserts result is OperationResult<T> & {
  status: OperationStatus.Success;
  data: T;
} {
  if (!isSuccess(result)) {
    const error = result.error;
    throw new Error(
      `Expected success but got ${result.status}: ${error?.message || 'Unknown error'}`
    );
  }
}

/**
 * Assert that an operation result is successful and return the data
 */
export function expectSuccessWithData<T>(result: OperationResult<T>): T {
  expectSuccess(result);
  return result.data;
}

/**
 * Assert that an operation result is an error
 */
export function expectError(
  result: OperationResult<unknown>
): asserts result is OperationResult<unknown> & {
  error: OperationError;
} {
  if (!isError(result)) {
    throw new Error(`Expected error but got success`);
  }
}

/**
 * Assert that an operation result has a specific status
 */
export function expectStatus(result: OperationResult<unknown>, status: OperationStatus): void {
  expect(result.status).toBe(status);
}

/**
 * Assert that an operation result is a "not found" error
 */
export function expectNotFound(result: OperationResult<unknown>): void {
  expectStatus(result, OperationStatus.NotFound);
  expectError(result);
  expect(result.error.code).toBe('NOT_FOUND');
}

/**
 * Assert that an operation result is a "permission denied" error
 */
export function expectPermissionDenied(result: OperationResult<unknown>): void {
  expectStatus(result, OperationStatus.PermissionDenied);
  expectError(result);
  expect(result.error.code).toBe('PERMISSION_DENIED');
}

/**
 * Assert that an operation result is an "unimplemented" error
 */
export function expectUnimplemented(result: OperationResult<unknown>): void {
  expectStatus(result, OperationStatus.Unimplemented);
  expectError(result);
  expect(result.error.code).toBe('UNIMPLEMENTED');
}

/**
 * Assert that an operation result is a "connection failed" error
 */
export function expectConnectionFailed(result: OperationResult<unknown>): void {
  expectStatus(result, OperationStatus.ConnectionFailed);
  expectError(result);
  expect(result.error.code).toBe('CONNECTION_FAILED');
  expect(result.error.retryable).toBe(true);
}

/**
 * Assert that an operation result is a "cancelled" error
 */
export function expectCancelled(result: OperationResult<unknown>): void {
  expectStatus(result, OperationStatus.Cancelled);
  expectError(result);
  expect(result.error.code).toBe('CANCELLED');
}

/**
 * Assert that an error is retryable
 */
export function expectRetryable(result: OperationResult<unknown>): void {
  expectError(result);
  expect(result.error.retryable).toBe(true);
}

/**
 * Assert that an error is not retryable
 */
export function expectNotRetryable(result: OperationResult<unknown>): void {
  expectError(result);
  expect(result.error.retryable).toBe(false);
}

// ============================================================================
// Entry Assertions
// ============================================================================

/**
 * Assert that two entries are equal (ignoring id)
 */
export function expectEntriesEqual(actual: Entry, expected: Entry): void {
  expect(actual.name).toBe(expected.name);
  expect(actual.type).toBe(expected.type);
  expect(actual.path).toBe(expected.path);
  expect(actual.size).toBe(expected.size);
}

/**
 * Assert that an entry list contains an entry with a given name
 */
export function expectEntryInList(entries: Entry[], name: string): Entry {
  const entry = entries.find(e => e.name === name);
  if (!entry) {
    throw new Error(`Expected to find entry "${name}" in list`);
  }
  return entry;
}

/**
 * Assert that an entry list does not contain an entry with a given name
 */
export function expectEntryNotInList(entries: Entry[], name: string): void {
  const entry = entries.find(e => e.name === name);
  if (entry) {
    throw new Error(`Expected NOT to find entry "${name}" in list`);
  }
}

// ============================================================================
// Async Utilities
// ============================================================================

/**
 * Wait for a specified number of milliseconds
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wait for a condition to be true, with timeout
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 5000, interval = 100 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await delay(interval);
  }

  throw new Error(`Condition not met within ${timeout}ms`);
}

// ============================================================================
// Mock Helpers
// ============================================================================

/**
 * Create a mock progress callback that captures progress events
 */
export function createProgressCapture() {
  const events: Array<{
    operation: string;
    bytesTransferred: number;
    totalBytes?: number;
    percentage: number;
    currentFile?: string;
  }> = [];

  const callback = (event: {
    operation: string;
    bytesTransferred: number;
    totalBytes?: number;
    percentage: number;
    currentFile?: string;
  }) => {
    events.push({ ...event });
  };

  return { callback, events };
}

/**
 * Create a simple in-memory filesystem for testing
 */
export function createInMemoryFileSystem() {
  const files = new Map<string, { content: Buffer; metadata: Record<string, string> }>();
  const directories = new Set<string>(['/']);

  return {
    files,
    directories,

    /**
     * Add a file to the in-memory filesystem
     */
    addFile(path: string, content: Buffer | string, metadata: Record<string, string> = {}): void {
      const buffer = typeof content === 'string' ? Buffer.from(content) : content;
      files.set(path, { content: buffer, metadata });

      // Ensure parent directories exist
      const parts = path.split('/').slice(0, -1);
      let currentPath = '';
      for (const part of parts) {
        if (part) {
          currentPath += '/' + part;
          directories.add(currentPath + '/');
        }
      }
    },

    /**
     * Add a directory to the in-memory filesystem
     */
    addDirectory(path: string): void {
      const normalizedPath = path.endsWith('/') ? path : path + '/';
      directories.add(normalizedPath);

      // Ensure parent directories exist
      const parts = normalizedPath.split('/').slice(0, -2);
      let currentPath = '';
      for (const part of parts) {
        if (part) {
          currentPath += '/' + part;
          directories.add(currentPath + '/');
        }
      }
    },

    /**
     * Check if a path exists (file or directory)
     */
    exists(path: string): boolean {
      return files.has(path) || directories.has(path) || directories.has(path + '/');
    },

    /**
     * Get file content
     */
    getContent(path: string): Buffer | undefined {
      return files.get(path)?.content;
    },

    /**
     * Delete a path
     */
    delete(path: string): boolean {
      if (files.has(path)) {
        files.delete(path);
        return true;
      }
      const dirPath = path.endsWith('/') ? path : path + '/';
      if (directories.has(dirPath)) {
        directories.delete(dirPath);
        // Delete all children
        for (const file of files.keys()) {
          if (file.startsWith(dirPath)) {
            files.delete(file);
          }
        }
        for (const dir of directories) {
          if (dir.startsWith(dirPath) && dir !== dirPath) {
            directories.delete(dir);
          }
        }
        return true;
      }
      return false;
    },

    /**
     * List entries in a directory
     */
    list(path: string): string[] {
      const normalizedPath = path.endsWith('/') ? path : path + '/';
      const results: string[] = [];

      // Find direct children files
      for (const filePath of files.keys()) {
        if (filePath.startsWith(normalizedPath)) {
          const remaining = filePath.slice(normalizedPath.length);
          if (!remaining.includes('/')) {
            results.push(filePath);
          }
        }
      }

      // Find direct children directories
      for (const dirPath of directories) {
        if (dirPath.startsWith(normalizedPath) && dirPath !== normalizedPath) {
          const remaining = dirPath.slice(normalizedPath.length);
          const slashCount = (remaining.match(/\//g) || []).length;
          if (slashCount === 1) {
            results.push(dirPath);
          }
        }
      }

      return results;
    },

    /**
     * Clear all data
     */
    clear(): void {
      files.clear();
      directories.clear();
      directories.add('/');
    },
  };
}
