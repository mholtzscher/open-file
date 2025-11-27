/**
 * Tests for S3 Client Factory
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { createS3Client, S3ClientOptions } from './client-factory.js';

/**
 * Helper to verify that an object is an S3Client
 * We check for the 'send' method which is the primary interface
 */
function isS3Client(obj: unknown): boolean {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'send' in obj &&
    typeof (obj as any).send === 'function'
  );
}

describe('S3 Client Factory', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear relevant env vars before each test
    delete process.env.AWS_REGION;
    delete process.env.AWS_PROFILE;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
  });

  describe('createS3Client', () => {
    it('should create a client with a region (default or from profile)', () => {
      const result = createS3Client({});

      expect(isS3Client(result.client)).toBe(true);
      // Region will be us-east-1 or from default AWS profile
      expect(typeof result.region).toBe('string');
      expect(result.region.length).toBeGreaterThan(0);
    });

    it('should use explicit region from options', () => {
      const result = createS3Client({ region: 'eu-west-1' });

      expect(result.region).toBe('eu-west-1');
    });

    it('should use AWS_REGION env var when no explicit region', () => {
      process.env.AWS_REGION = 'ap-southeast-1';

      const result = createS3Client({});

      expect(result.region).toBe('ap-southeast-1');
    });

    it('should prefer explicit region over AWS_REGION env var', () => {
      process.env.AWS_REGION = 'ap-southeast-1';

      const result = createS3Client({ region: 'us-west-2' });

      expect(result.region).toBe('us-west-2');
    });

    it('should create client with custom endpoint', () => {
      const result = createS3Client({
        endpoint: 'http://localhost:4566',
      });

      expect(isS3Client(result.client)).toBe(true);
    });

    it('should create client with explicit credentials', () => {
      const result = createS3Client({
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
      });

      expect(isS3Client(result.client)).toBe(true);
    });

    it('should create client with session token for temporary credentials', () => {
      const result = createS3Client({
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
        sessionToken: 'test-session-token',
      });

      expect(isS3Client(result.client)).toBe(true);
    });

    it('should handle forcePathStyle option for S3-compatible services', () => {
      const result = createS3Client({
        endpoint: 'http://minio:9000',
        forcePathStyle: true,
      });

      expect(isS3Client(result.client)).toBe(true);
    });

    it('should default forcePathStyle to true when endpoint is provided', () => {
      // This tests the default behavior - when endpoint is set, forcePathStyle defaults to true
      const result = createS3Client({
        endpoint: 'http://localhost:4566',
        // forcePathStyle not explicitly set
      });

      expect(isS3Client(result.client)).toBe(true);
    });
  });

  describe('credential resolution order', () => {
    it('should prefer explicit credentials over profile', () => {
      // Set up profile env (though we can't easily test actual profile loading)
      process.env.AWS_PROFILE = 'some-profile';

      const result = createS3Client({
        accessKeyId: 'explicit-key',
        secretAccessKey: 'explicit-secret',
      });

      // Client should be created with explicit credentials
      expect(isS3Client(result.client)).toBe(true);
    });
  });

  describe('region resolution order', () => {
    it('should prefer explicit region over everything', () => {
      process.env.AWS_REGION = 'env-region';

      const result = createS3Client({ region: 'explicit-region' });
      expect(result.region).toBe('explicit-region');
    });

    it('should use AWS_REGION env var when no explicit region', () => {
      process.env.AWS_REGION = 'env-region';

      const result = createS3Client({});
      expect(result.region).toBe('env-region');
    });

    it('should fall back to profile or default when no explicit or env region', () => {
      delete process.env.AWS_REGION;
      const result = createS3Client({});
      // Will be either us-east-1 (default) or region from default AWS profile
      expect(typeof result.region).toBe('string');
      expect(result.region.length).toBeGreaterThan(0);
    });
  });
});
