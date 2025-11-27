/**
 * Tests for Read Operations Module
 */

import { describe, it, expect, mock } from 'bun:test';
import { readObject, ReadOperationsLogger } from './read-operations.js';
import { ProgressEvent } from '../../../types/progress.js';

// Mock S3Client - returns responses in order (HeadObject first, then GetObject)
function createMockClient(headResponse: any, getResponse: any) {
  let callIndex = 0;
  const responses = [headResponse, getResponse];
  return {
    send: mock(async () => {
      const response = responses[callIndex] || responses[responses.length - 1];
      callIndex++;
      return response;
    }),
  } as any;
}

// Create a mock ReadableStream with getReader
function createMockReadableStream(chunks: Uint8Array[]): any {
  let index = 0;
  return {
    getReader: () => ({
      read: async () => {
        if (index >= chunks.length) {
          return { done: true, value: undefined };
        }
        return { done: false, value: chunks[index++] };
      },
    }),
  };
}

// Create a mock Node.js stream
function createMockNodeStream(chunks: Uint8Array[], error?: Error): any {
  const handlers: Record<string, Function> = {};
  return {
    on: (event: string, handler: Function) => {
      handlers[event] = handler;
      // Simulate async emission after registration
      if (event === 'end' && !error) {
        setTimeout(() => {
          chunks.forEach(chunk => handlers['data']?.(chunk));
          handlers['end']?.();
        }, 0);
      }
      if (event === 'error' && error) {
        setTimeout(() => {
          handlers['error']?.(error);
        }, 0);
      }
      return { on: (e: string, h: Function) => (handlers[e] = h) };
    },
  };
}

describe('readObject', () => {
  describe('with Buffer body', () => {
    it('returns the buffer directly', async () => {
      const content = Buffer.from('Hello, World!');
      const client = createMockClient({ ContentLength: content.length }, { Body: content });

      const result = await readObject({
        client,
        bucket: 'test-bucket',
        key: 'test-key.txt',
      });

      expect(result).toEqual(content);
      expect(result.toString()).toBe('Hello, World!');
    });

    it('reports progress for buffer body', async () => {
      const content = Buffer.from('Test content');
      const client = createMockClient({ ContentLength: content.length }, { Body: content });

      const events: ProgressEvent[] = [];
      const onProgress = mock((event: ProgressEvent) => {
        events.push({ ...event });
      });

      await readObject({
        client,
        bucket: 'test-bucket',
        key: 'test-key.txt',
        onProgress,
      });

      // Should have initial (0%) and completion (100%) events
      expect(events.length).toBeGreaterThanOrEqual(2);
      expect(events[0].percentage).toBe(0);
      expect(events[events.length - 1].percentage).toBe(100);
      expect(events[events.length - 1].operation).toBe('Downloaded file');
    });
  });

  describe('with ReadableStream body', () => {
    it('reads chunks from stream', async () => {
      const chunk1 = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      const chunk2 = new Uint8Array([44, 32]); // ", "
      const chunk3 = new Uint8Array([87, 111, 114, 108, 100]); // "World"
      const totalLength = chunk1.length + chunk2.length + chunk3.length;

      const client = createMockClient(
        { ContentLength: totalLength },
        { Body: createMockReadableStream([chunk1, chunk2, chunk3]) }
      );

      const result = await readObject({
        client,
        bucket: 'test-bucket',
        key: 'test-key.txt',
      });

      expect(result.toString()).toBe('Hello, World');
    });

    it('reports progress for each chunk', async () => {
      const chunk1 = new Uint8Array([1, 2, 3, 4, 5]);
      const chunk2 = new Uint8Array([6, 7, 8, 9, 10]);
      const totalLength = 10;

      const client = createMockClient(
        { ContentLength: totalLength },
        { Body: createMockReadableStream([chunk1, chunk2]) }
      );

      const events: ProgressEvent[] = [];
      const onProgress = mock((event: ProgressEvent) => {
        events.push({ ...event });
      });

      await readObject({
        client,
        bucket: 'test-bucket',
        key: 'test-key.txt',
        onProgress,
      });

      // Initial + 2 chunk events + completion
      expect(events.length).toBe(4);
      expect(events[0].percentage).toBe(0); // Initial
      expect(events[1].percentage).toBe(50); // After chunk1 (5/10)
      expect(events[2].percentage).toBe(100); // After chunk2 (10/10)
      expect(events[3].percentage).toBe(100); // Completion
    });
  });

  describe('with Node.js stream body', () => {
    it('reads chunks from node stream', async () => {
      const chunk1 = new Uint8Array([84, 101, 115, 116]); // "Test"
      const totalLength = chunk1.length;

      const client = createMockClient(
        { ContentLength: totalLength },
        { Body: createMockNodeStream([chunk1]) }
      );

      const result = await readObject({
        client,
        bucket: 'test-bucket',
        key: 'test-key.txt',
      });

      expect(result.toString()).toBe('Test');
    });
  });

  describe('progress callback', () => {
    it('does not call progress when callback is undefined', async () => {
      const content = Buffer.from('Test');
      const client = createMockClient({ ContentLength: content.length }, { Body: content });

      // Should not throw
      const result = await readObject({
        client,
        bucket: 'test-bucket',
        key: 'test-key.txt',
        onProgress: undefined,
      });

      expect(result.toString()).toBe('Test');
    });

    it('includes correct file key in progress events', async () => {
      const content = Buffer.from('Test');
      const client = createMockClient({ ContentLength: content.length }, { Body: content });

      let capturedKey: string | undefined = '';
      const onProgress = mock((event: ProgressEvent) => {
        capturedKey = event.currentFile;
      });

      await readObject({
        client,
        bucket: 'test-bucket',
        key: 'path/to/my-file.txt',
        onProgress,
      });

      expect(capturedKey).toBe('path/to/my-file.txt');
    });
  });

  describe('error handling', () => {
    it('throws when body is missing', async () => {
      const client = createMockClient({ ContentLength: 100 }, { Body: undefined });

      await expect(
        readObject({
          client,
          bucket: 'test-bucket',
          key: 'test-key.txt',
        })
      ).rejects.toThrow('No body in response');
    });

    it('logs errors when logger is provided', async () => {
      const client = createMockClient({ ContentLength: 100 }, { Body: undefined });

      const logger: ReadOperationsLogger = {
        error: mock(() => {}),
      };

      await expect(
        readObject({
          client,
          bucket: 'test-bucket',
          key: 'test-key.txt',
          logger,
        })
      ).rejects.toThrow();

      expect(logger.error).toHaveBeenCalledWith('Failed to read file from S3', expect.any(Error));
    });

    it('does not log when logger is not provided', async () => {
      const client = createMockClient({ ContentLength: 100 }, { Body: undefined });

      // Should throw but not crash due to missing logger
      await expect(
        readObject({
          client,
          bucket: 'test-bucket',
          key: 'test-key.txt',
        })
      ).rejects.toThrow();
    });
  });

  describe('percentage calculation edge cases', () => {
    it('handles zero content length', async () => {
      const content = Buffer.from('');
      const client = createMockClient({ ContentLength: 0 }, { Body: content });

      const events: ProgressEvent[] = [];
      const onProgress = mock((event: ProgressEvent) => {
        events.push({ ...event });
      });

      await readObject({
        client,
        bucket: 'test-bucket',
        key: 'test-key.txt',
        onProgress,
      });

      // All percentages should be 0 when total is 0
      events.forEach(event => {
        expect(event.percentage).toBe(0);
      });
    });

    it('handles missing content length', async () => {
      const content = Buffer.from('Test');
      const client = createMockClient({ ContentLength: undefined }, { Body: content });

      const events: ProgressEvent[] = [];
      const onProgress = mock((event: ProgressEvent) => {
        events.push({ ...event });
      });

      await readObject({
        client,
        bucket: 'test-bucket',
        key: 'test-key.txt',
        onProgress,
      });

      // Should handle gracefully with 0 total
      expect(events[0].totalBytes).toBe(0);
    });
  });

  describe('S3 command calls', () => {
    it('makes two S3 calls (HeadObject then GetObject)', async () => {
      const content = Buffer.from('Test');
      const client = createMockClient({ ContentLength: content.length }, { Body: content });

      await readObject({
        client,
        bucket: 'my-bucket',
        key: 'my-key.txt',
      });

      // Should make exactly 2 calls: HeadObject for size, GetObject for content
      expect(client.send).toHaveBeenCalledTimes(2);
    });
  });
});
