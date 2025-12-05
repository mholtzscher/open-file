/**
 * Unit tests for S3Provider
 *
 * Tests the S3Provider implementation using dependency injection for mocking.
 */

import { describe, it, expect } from 'bun:test';
import { S3Provider, S3ProviderLogger, S3ClientFactory } from './s3-provider.js';
import type { S3Profile } from '../types/profile.js';
import { S3Client } from '@aws-sdk/client-s3';
import { Capability } from '../types/capabilities.js';
import { OperationStatus, isSuccess, isError } from '../types/result.js';

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Create a mock logger that tracks all calls
 */
function createMockLogger() {
  const calls: { method: string; args: unknown[] }[] = [];
  return {
    logger: {
      debug: (...args: unknown[]) => calls.push({ method: 'debug', args }),
      info: (...args: unknown[]) => calls.push({ method: 'info', args }),
      warn: (...args: unknown[]) => calls.push({ method: 'warn', args }),
      error: (...args: unknown[]) => calls.push({ method: 'error', args }),
    } as S3ProviderLogger,
    calls,
  };
}

/**
 * Create a mock S3 client with configurable responses
 */
function createMockS3Client(responses?: {
  listBuckets?: { Buckets: Array<{ Name: string; CreationDate?: Date }> };
  listObjects?: {
    Contents?: Array<{ Key: string; Size: number }>;
    CommonPrefixes?: Array<{ Prefix: string }>;
  };
  headObject?: { ContentLength?: number; ContentType?: string; LastModified?: Date };
  getObject?: { Body: { transformToByteArray: () => Promise<Uint8Array> } };
  error?: Error;
}) {
  const sendCalls: unknown[] = [];
  const client = {
    send: (command: unknown) => {
      sendCalls.push(command);

      if (responses?.error) {
        throw responses.error;
      }

      const cmd = command as { input?: Record<string, unknown>; constructor?: { name: string } };
      const input = cmd.input || {};

      // Detect command type by properties
      if (!('Bucket' in input)) {
        // ListBucketsCommand
        return responses?.listBuckets ?? { Buckets: [] };
      }
      if ('Prefix' in input) {
        // ListObjectsV2Command
        return responses?.listObjects ?? { Contents: [], CommonPrefixes: [] };
      }
      if ('Key' in input && !('Body' in input) && !('CopySource' in input)) {
        // HeadObjectCommand or GetObjectCommand
        if (responses?.getObject) {
          return responses.getObject;
        }
        return (
          responses?.headObject ?? { ContentLength: 100, ContentType: 'application/octet-stream' }
        );
      }

      return {};
    },
  } as unknown as S3Client;

  return { client, sendCalls };
}

/**
 * Create a mock client factory
 */
function createMockClientFactory(mockClient: S3Client, region = 'us-east-1') {
  const factoryCalls: unknown[] = [];
  const factory: S3ClientFactory = options => {
    factoryCalls.push({ type: 'create', options });
    return { client: mockClient, region };
  };
  return { factory, factoryCalls };
}

/**
 * Create a test S3 profile
 */
function createTestProfile(overrides?: Partial<S3Profile>): S3Profile {
  return {
    id: 'test-profile',
    displayName: 'Test S3 Profile',
    provider: 's3',
    config: {
      region: 'us-east-1',
    },
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('S3Provider', () => {
  describe('constructor', () => {
    it('should create provider with profile configuration', () => {
      const { client } = createMockS3Client();
      const { factory } = createMockClientFactory(client);
      const { logger } = createMockLogger();

      const provider = new S3Provider(createTestProfile(), {
        clientFactory: factory,
        logger,
      });

      expect(provider.name).toBe('s3');
      expect(provider.displayName).toBe('Amazon S3');
    });

    it('should set up all S3 capabilities', () => {
      const { client } = createMockS3Client();
      const { factory } = createMockClientFactory(client);
      const { logger } = createMockLogger();

      const provider = new S3Provider(createTestProfile(), {
        clientFactory: factory,
        logger,
      });

      const caps = provider.getCapabilities();
      expect(caps.has(Capability.List)).toBe(true);
      expect(caps.has(Capability.Read)).toBe(true);
      expect(caps.has(Capability.Write)).toBe(true);
      expect(caps.has(Capability.Delete)).toBe(true);
      expect(caps.has(Capability.Mkdir)).toBe(true);
      expect(caps.has(Capability.Copy)).toBe(true);
      expect(caps.has(Capability.Move)).toBe(true);
      expect(caps.has(Capability.ServerSideCopy)).toBe(true);
      expect(caps.has(Capability.Download)).toBe(true);
      expect(caps.has(Capability.Upload)).toBe(true);
      expect(caps.has(Capability.Metadata)).toBe(true);
      expect(caps.has(Capability.Containers)).toBe(true);
      expect(caps.has(Capability.PresignedUrls)).toBe(true);
      expect(caps.has(Capability.BatchDelete)).toBe(true);
    });

    it('should use injected logger', () => {
      const { client } = createMockS3Client();
      const { factory } = createMockClientFactory(client);
      const { logger, calls } = createMockLogger();

      new S3Provider(createTestProfile(), {
        clientFactory: factory,
        logger,
      });

      const debugCalls = calls.filter(c => c.method === 'debug');
      const infoCalls = calls.filter(c => c.method === 'info');

      expect(debugCalls.length).toBeGreaterThan(0);
      expect(infoCalls.length).toBeGreaterThan(0);
    });

    it('should use injected client factory', () => {
      const { client } = createMockS3Client();
      const { factory, factoryCalls } = createMockClientFactory(client, 'eu-west-1');
      const { logger } = createMockLogger();

      new S3Provider(createTestProfile(), {
        clientFactory: factory,
        logger,
      });

      expect(factoryCalls.length).toBe(1);
    });
  });

  describe('container operations', () => {
    it('should list containers (buckets)', async () => {
      const { client } = createMockS3Client({
        listBuckets: {
          Buckets: [
            { Name: 'bucket-1', CreationDate: new Date('2023-01-01') },
            { Name: 'bucket-2', CreationDate: new Date('2023-06-01') },
          ],
        },
      });
      const { factory } = createMockClientFactory(client);
      const { logger } = createMockLogger();

      const provider = new S3Provider(createTestProfile(), {
        clientFactory: factory,
        logger,
      });

      const result = await provider.listContainers();

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.length).toBe(2);
        // Buckets are sorted by creation date (newest first)
        const names = result.data.map(b => b.name).sort();
        expect(names).toContain('bucket-1');
        expect(names).toContain('bucket-2');
      }
    });

    it('should set and get container', () => {
      const { client } = createMockS3Client();
      const { factory } = createMockClientFactory(client);
      const { logger } = createMockLogger();

      const provider = new S3Provider(createTestProfile(), {
        clientFactory: factory,
        logger,
      });

      expect(provider.getContainer()).toBeUndefined();

      provider.setContainer('my-bucket');
      expect(provider.getContainer()).toBe('my-bucket');
    });

    it('should reinitialize client when region changes', () => {
      const { client } = createMockS3Client();
      const { factory, factoryCalls } = createMockClientFactory(client);
      const { logger } = createMockLogger();

      const provider = new S3Provider(createTestProfile(), {
        clientFactory: factory,
        logger,
      });

      factoryCalls.length = 0;
      provider.setRegion('eu-west-1');

      expect(factoryCalls.length).toBe(1);
      expect((factoryCalls[0] as { options: { region: string } }).options.region).toBe('eu-west-1');
    });

    it('should not reinitialize client when region is same', () => {
      const { client } = createMockS3Client();
      const { factory, factoryCalls } = createMockClientFactory(client, 'us-east-1');
      const { logger } = createMockLogger();

      const provider = new S3Provider(createTestProfile(), {
        clientFactory: factory,
        logger,
      });

      factoryCalls.length = 0;
      provider.setRegion('us-east-1');

      expect(factoryCalls.length).toBe(0);
    });
  });

  describe('operations without bucket', () => {
    it('should return error for list without bucket', async () => {
      const { client } = createMockS3Client();
      const { factory } = createMockClientFactory(client);
      const { logger } = createMockLogger();

      const provider = new S3Provider(createTestProfile(), {
        clientFactory: factory,
        logger,
      });

      const result = await provider.list('/');

      expect(isError(result)).toBe(true);
      expect(result.error?.code).toBe('BUCKET_NOT_CONFIGURED');
    });

    it('should return error for read without bucket', async () => {
      const { client } = createMockS3Client();
      const { factory } = createMockClientFactory(client);
      const { logger } = createMockLogger();

      const provider = new S3Provider(createTestProfile(), {
        clientFactory: factory,
        logger,
      });

      const result = await provider.read('file.txt');

      expect(isError(result)).toBe(true);
      expect(result.error?.code).toBe('BUCKET_NOT_CONFIGURED');
    });

    it('should return error for write without bucket', async () => {
      const { client } = createMockS3Client();
      const { factory } = createMockClientFactory(client);
      const { logger } = createMockLogger();

      const provider = new S3Provider(createTestProfile(), {
        clientFactory: factory,
        logger,
      });

      const result = await provider.write('file.txt', 'content');

      expect(isError(result)).toBe(true);
      expect(result.error?.code).toBe('BUCKET_NOT_CONFIGURED');
    });

    it('should return error for delete without bucket', async () => {
      const { client } = createMockS3Client();
      const { factory } = createMockClientFactory(client);
      const { logger } = createMockLogger();

      const provider = new S3Provider(createTestProfile(), {
        clientFactory: factory,
        logger,
      });

      const result = await provider.delete('file.txt');

      expect(isError(result)).toBe(true);
      expect(result.error?.code).toBe('BUCKET_NOT_CONFIGURED');
    });
  });

  describe('error mapping', () => {
    it('should map NoSuchKey to NotFound', async () => {
      const error = new Error('The specified key does not exist.');
      error.name = 'NoSuchKey';

      const { client } = createMockS3Client({ error });
      const { factory } = createMockClientFactory(client);
      const { logger } = createMockLogger();

      const provider = new S3Provider(createTestProfile(), {
        clientFactory: factory,
        logger,
      });
      provider.setContainer('test-bucket');

      const result = await provider.getMetadata('nonexistent.txt');

      expect(result.status).toBe(OperationStatus.NotFound);
    });

    it('should map AccessDenied to PermissionDenied', async () => {
      const error = new Error('Access Denied');
      error.name = 'AccessDenied';

      const { client } = createMockS3Client({ error });
      const { factory } = createMockClientFactory(client);
      const { logger } = createMockLogger();

      const provider = new S3Provider(createTestProfile(), {
        clientFactory: factory,
        logger,
      });
      provider.setContainer('test-bucket');

      const result = await provider.list('/');

      expect(result.status).toBe(OperationStatus.PermissionDenied);
    });

    it('should map ServiceUnavailable to ConnectionFailed', async () => {
      const error = new Error('Service Unavailable');
      error.name = 'ServiceUnavailable';

      const { client } = createMockS3Client({ error });
      const { factory } = createMockClientFactory(client);
      const { logger } = createMockLogger();

      const provider = new S3Provider(createTestProfile(), {
        clientFactory: factory,
        logger,
      });
      provider.setContainer('test-bucket');

      const result = await provider.list('/');

      expect(result.status).toBe(OperationStatus.ConnectionFailed);
    });
  });

  describe('exists', () => {
    it('should return true when object exists', async () => {
      const { client } = createMockS3Client({
        headObject: { ContentLength: 100 },
      });
      const { factory } = createMockClientFactory(client);
      const { logger } = createMockLogger();

      const provider = new S3Provider(createTestProfile(), {
        clientFactory: factory,
        logger,
      });
      provider.setContainer('test-bucket');

      const result = await provider.exists('existing-file.txt');

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data).toBe(true);
      }
    });

    it('should return false when object does not exist', async () => {
      const error = new Error('Not Found');
      error.name = 'NotFound';

      const { client } = createMockS3Client({ error });
      const { factory } = createMockClientFactory(client);
      const { logger } = createMockLogger();

      const provider = new S3Provider(createTestProfile(), {
        clientFactory: factory,
        logger,
      });
      provider.setContainer('test-bucket');

      const result = await provider.exists('nonexistent-file.txt');

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data).toBe(false);
      }
    });
  });

  describe('hasCapability', () => {
    it('should return true for supported capabilities', () => {
      const { client } = createMockS3Client();
      const { factory } = createMockClientFactory(client);
      const { logger } = createMockLogger();

      const provider = new S3Provider(createTestProfile(), {
        clientFactory: factory,
        logger,
      });

      expect(provider.hasCapability(Capability.List)).toBe(true);
      expect(provider.hasCapability(Capability.Read)).toBe(true);
      expect(provider.hasCapability(Capability.Write)).toBe(true);
      expect(provider.hasCapability(Capability.Delete)).toBe(true);
    });

    it('should return false for unsupported capabilities', () => {
      const { client } = createMockS3Client();
      const { factory } = createMockClientFactory(client);
      const { logger } = createMockLogger();

      const provider = new S3Provider(createTestProfile(), {
        clientFactory: factory,
        logger,
      });

      // S3 doesn't support POSIX permissions or symlinks
      expect(provider.hasCapability(Capability.Permissions)).toBe(false);
      expect(provider.hasCapability(Capability.Symlinks)).toBe(false);
    });
  });
});

describe('S3Provider factory integration', () => {
  it('should be creatable from factory', async () => {
    const { createProvider, isProviderImplemented } = await import('../factory.js');

    expect(isProviderImplemented('s3')).toBe(true);

    const profile = createTestProfile();
    const provider = await createProvider(profile);

    expect(provider.name).toBe('s3');
    expect(provider.displayName).toBe('Amazon S3');
  });
});
