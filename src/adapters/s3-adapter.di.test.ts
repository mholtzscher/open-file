/**
 * Unit tests for S3Adapter dependency injection
 *
 * These tests demonstrate how to inject mock dependencies into S3Adapter,
 * enabling unit testing without requiring AWS SDK module mocking.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import {
  S3Adapter,
  S3AdapterConfig,
  S3AdapterDependencies,
  S3AdapterLogger,
  S3ClientFactory,
  S3ClientWithRegionFactory,
} from './s3-adapter.js';
import { S3Client } from '@aws-sdk/client-s3';
import { S3ClientResult } from './s3/client-factory.js';

describe('S3Adapter dependency injection', () => {
  // Mock logger that tracks all calls
  const createMockLogger = () => {
    const calls: { method: string; args: any[] }[] = [];
    return {
      logger: {
        debug: (...args: any[]) => calls.push({ method: 'debug', args }),
        info: (...args: any[]) => calls.push({ method: 'info', args }),
        warn: (...args: any[]) => calls.push({ method: 'warn', args }),
        error: (...args: any[]) => calls.push({ method: 'error', args }),
      } as S3AdapterLogger,
      calls,
    };
  };

  // Mock S3 client
  const createMockS3Client = () => {
    const sendCalls: any[] = [];
    const client = {
      send: async (command: any) => {
        sendCalls.push(command);
        // Return appropriate mock responses based on command input properties
        // This is more reliable than constructor.name which can be minified
        const input = command.input || {};
        if ('Bucket' in input && 'Prefix' in input) {
          // ListObjectsV2Command has Bucket and Prefix
          return { Contents: [], CommonPrefixes: [] };
        }
        if ('Bucket' in input && 'Key' in input) {
          // HeadObjectCommand has Bucket and Key
          return { ContentLength: 100 };
        }
        if (Object.keys(input).length === 0 || !('Bucket' in input)) {
          // ListBucketsCommand has no required input
          return { Buckets: [] };
        }
        return {};
      },
    } as unknown as S3Client;
    return { client, sendCalls };
  };

  // Mock client factory
  const createMockClientFactory = (mockClient: S3Client, region = 'us-east-1') => {
    const factoryCalls: any[] = [];
    const factory: S3ClientFactory = options => {
      factoryCalls.push({ type: 'create', options });
      return { client: mockClient, region };
    };
    return { factory, factoryCalls };
  };

  // Mock client with region factory
  const createMockClientWithRegionFactory = (mockClient: S3Client) => {
    const factoryCalls: any[] = [];
    const factory: S3ClientWithRegionFactory = (options, newRegion) => {
      factoryCalls.push({ type: 'createWithRegion', options, newRegion });
      return { client: mockClient, region: newRegion };
    };
    return { factory, factoryCalls };
  };

  const defaultConfig: S3AdapterConfig = {
    region: 'us-east-1',
    bucket: 'test-bucket',
    accessKeyId: 'test-key',
    secretAccessKey: 'test-secret',
  };

  describe('logger injection', () => {
    it('should use injected logger for debug messages', () => {
      const { client } = createMockS3Client();
      const { factory } = createMockClientFactory(client);
      const { logger, calls } = createMockLogger();

      new S3Adapter(defaultConfig, {
        logger,
        clientFactory: factory,
      });

      // Constructor should log debug and info messages
      const debugCalls = calls.filter(c => c.method === 'debug');
      const infoCalls = calls.filter(c => c.method === 'info');

      expect(debugCalls.length).toBeGreaterThan(0);
      expect(infoCalls.length).toBeGreaterThan(0);

      // Check that constructor debug message was logged
      const constructorDebug = debugCalls.find(c =>
        c.args[0].includes('S3Adapter constructor called')
      );
      expect(constructorDebug).toBeDefined();
    });

    it('should use injected logger for setBucket', () => {
      const { client } = createMockS3Client();
      const { factory } = createMockClientFactory(client);
      const { logger, calls } = createMockLogger();

      const adapter = new S3Adapter(defaultConfig, {
        logger,
        clientFactory: factory,
      });

      calls.length = 0; // Clear constructor calls
      adapter.setBucket('new-bucket');

      const debugCalls = calls.filter(c => c.method === 'debug');
      expect(debugCalls.length).toBe(1);
      expect(debugCalls[0].args[0]).toContain('bucket changed');
    });

    it('should use injected logger for setRegion', () => {
      const { client } = createMockS3Client();
      const { factory } = createMockClientFactory(client);
      const { factory: regionFactory } = createMockClientWithRegionFactory(client);
      const { logger, calls } = createMockLogger();

      const adapter = new S3Adapter(defaultConfig, {
        logger,
        clientFactory: factory,
        clientWithRegionFactory: regionFactory,
      });

      calls.length = 0; // Clear constructor calls
      adapter.setRegion('eu-west-1');

      const debugCalls = calls.filter(c => c.method === 'debug');
      expect(debugCalls.length).toBe(1);
      expect(debugCalls[0].args[0]).toContain('region changed');
    });
  });

  describe('client factory injection', () => {
    it('should use injected clientFactory in constructor', () => {
      const { client } = createMockS3Client();
      const { factory, factoryCalls } = createMockClientFactory(client, 'ap-southeast-2');
      const { logger } = createMockLogger();

      const adapter = new S3Adapter(defaultConfig, {
        logger,
        clientFactory: factory,
      });

      expect(factoryCalls.length).toBe(1);
      expect(factoryCalls[0].type).toBe('create');
      expect(factoryCalls[0].options.region).toBe('us-east-1');
    });

    it('should use injected clientWithRegionFactory for setRegion', () => {
      const { client } = createMockS3Client();
      const { factory } = createMockClientFactory(client);
      const { factory: regionFactory, factoryCalls } = createMockClientWithRegionFactory(client);
      const { logger } = createMockLogger();

      const adapter = new S3Adapter(defaultConfig, {
        logger,
        clientFactory: factory,
        clientWithRegionFactory: regionFactory,
      });

      adapter.setRegion('eu-west-1');

      expect(factoryCalls.length).toBe(1);
      expect(factoryCalls[0].type).toBe('createWithRegion');
      expect(factoryCalls[0].newRegion).toBe('eu-west-1');
    });

    it('should not call clientWithRegionFactory if region unchanged', () => {
      const { client } = createMockS3Client();
      const { factory } = createMockClientFactory(client, 'us-east-1');
      const { factory: regionFactory, factoryCalls } = createMockClientWithRegionFactory(client);
      const { logger } = createMockLogger();

      const adapter = new S3Adapter(defaultConfig, {
        logger,
        clientFactory: factory,
        clientWithRegionFactory: regionFactory,
      });

      adapter.setRegion('us-east-1'); // Same region

      expect(factoryCalls.length).toBe(0);
    });
  });

  describe('default behavior without dependencies', () => {
    it('should work without any injected dependencies', () => {
      // This test verifies backwards compatibility - constructor
      // should work without the second parameter
      expect(() => {
        // Note: This will create a real S3 client, which is fine for
        // testing that the code path works without injection
        new S3Adapter(defaultConfig);
      }).not.toThrow();
    });

    it('should work with partial dependencies', () => {
      const { logger } = createMockLogger();

      // Only inject logger, use default client factory
      expect(() => {
        new S3Adapter(defaultConfig, { logger });
      }).not.toThrow();
    });
  });

  describe('integration with injected mock client', () => {
    it('should use injected client for listBuckets', async () => {
      const { client, sendCalls } = createMockS3Client();
      const { factory } = createMockClientFactory(client);
      const { logger } = createMockLogger();

      const adapter = new S3Adapter(
        { ...defaultConfig, bucket: undefined },
        {
          logger,
          clientFactory: factory,
        }
      );

      const buckets = await adapter.listBuckets();

      expect(buckets).toEqual([]);
      expect(sendCalls.length).toBe(1);
      // ListBucketsCommand has no required input, verify command was called
      expect(sendCalls[0]).toBeDefined();
    });

    it('should use injected client for list', async () => {
      const { client, sendCalls } = createMockS3Client();
      const { factory } = createMockClientFactory(client);
      const { logger } = createMockLogger();

      const adapter = new S3Adapter(defaultConfig, {
        logger,
        clientFactory: factory,
      });

      const result = await adapter.list('some/path/');

      expect(result.entries).toEqual([]);
      expect(sendCalls.length).toBe(1);
      // Check command type by verifying its properties (more robust than constructor.name)
      const command = sendCalls[0];
      expect(command.input).toBeDefined();
      expect(command.input.Bucket).toBe('test-bucket');
      expect(command.input.Prefix).toBeDefined();
    });
  });
});
