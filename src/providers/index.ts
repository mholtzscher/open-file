/**
 * Provider System - Public API
 *
 * This module provides the storage provider abstraction layer.
 * It enables support for multiple storage backends (S3, GCS, SFTP, etc.)
 * behind a unified interface.
 */

// Types
export * from './types/index.js';

// Test utilities (for consumers that need to test provider integrations)
export * from './__tests__/fixtures.js';
export * from './__tests__/test-utils.js';
export { MockStorageProvider } from './__tests__/mock-provider.js';
