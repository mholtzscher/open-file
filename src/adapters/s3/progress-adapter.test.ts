/**
 * Tests for Progress Adapter Factory
 */

import { describe, it, expect, mock } from 'bun:test';
import { createProgressAdapter, OperationProgressCallback } from './progress-adapter.js';
import { ProgressEvent } from '../adapter.js';

describe('createProgressAdapter', () => {
  describe('when onProgress is undefined', () => {
    it('returns undefined', () => {
      const result = createProgressAdapter('Test operation', undefined);
      expect(result).toBeUndefined();
    });
  });

  describe('when onProgress is provided', () => {
    it('returns a callback function', () => {
      const onProgress = mock(() => {});
      const result = createProgressAdapter('Test operation', onProgress);
      expect(result).toBeFunction();
    });

    it('transforms progress to ProgressEvent format', () => {
      const events: ProgressEvent[] = [];
      const onProgress = mock((event: ProgressEvent) => {
        events.push(event);
      });

      const adapter = createProgressAdapter('Moving objects', onProgress)!;
      adapter(5, 10, 'file.txt');

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        operation: 'Moving objects',
        bytesTransferred: 5,
        totalBytes: 10,
        percentage: 50,
        currentFile: 'file.txt',
      });
    });

    it('uses the provided operation name', () => {
      let capturedEvent: ProgressEvent | null = null;
      const onProgress = mock((event: ProgressEvent) => {
        capturedEvent = event;
      });

      const adapter = createProgressAdapter('Copying objects', onProgress)!;
      adapter(1, 5, 'test.txt');

      expect(capturedEvent!.operation).toBe('Copying objects');
    });

    it('passes currentItem as currentFile', () => {
      let capturedEvent: ProgressEvent | null = null;
      const onProgress = mock((event: ProgressEvent) => {
        capturedEvent = event;
      });

      const adapter = createProgressAdapter('Test', onProgress)!;
      adapter(1, 1, 'path/to/file.txt');

      expect(capturedEvent!.currentFile).toBe('path/to/file.txt');
    });
  });

  describe('percentage calculation', () => {
    it('calculates percentage correctly for partial progress', () => {
      let capturedEvent: ProgressEvent | null = null;
      const onProgress = mock((event: ProgressEvent) => {
        capturedEvent = event;
      });

      const adapter = createProgressAdapter('Test', onProgress)!;
      adapter(25, 100, 'file.txt');

      expect(capturedEvent!.percentage).toBe(25);
    });

    it('calculates 100% for complete progress', () => {
      let capturedEvent: ProgressEvent | null = null;
      const onProgress = mock((event: ProgressEvent) => {
        capturedEvent = event;
      });

      const adapter = createProgressAdapter('Test', onProgress)!;
      adapter(100, 100, 'file.txt');

      expect(capturedEvent!.percentage).toBe(100);
    });

    it('calculates 0% at start', () => {
      let capturedEvent: ProgressEvent | null = null;
      const onProgress = mock((event: ProgressEvent) => {
        capturedEvent = event;
      });

      const adapter = createProgressAdapter('Test', onProgress)!;
      adapter(0, 100, 'file.txt');

      expect(capturedEvent!.percentage).toBe(0);
    });

    it('returns 0% when total is 0 (edge case)', () => {
      let capturedEvent: ProgressEvent | null = null;
      const onProgress = mock((event: ProgressEvent) => {
        capturedEvent = event;
      });

      const adapter = createProgressAdapter('Test', onProgress)!;
      adapter(0, 0, 'file.txt');

      expect(capturedEvent!.percentage).toBe(0);
    });

    it('rounds percentage to nearest integer', () => {
      let capturedEvent: ProgressEvent | null = null;
      const onProgress = mock((event: ProgressEvent) => {
        capturedEvent = event;
      });

      const adapter = createProgressAdapter('Test', onProgress)!;
      // 33.333...% should round to 33%
      adapter(1, 3, 'file.txt');

      expect(capturedEvent!.percentage).toBe(33);
    });

    it('handles large numbers', () => {
      let capturedEvent: ProgressEvent | null = null;
      const onProgress = mock((event: ProgressEvent) => {
        capturedEvent = event;
      });

      const adapter = createProgressAdapter('Test', onProgress)!;
      // 5GB transferred of 10GB total
      adapter(5_000_000_000, 10_000_000_000, 'large-file.zip');

      expect(capturedEvent!.percentage).toBe(50);
      expect(capturedEvent!.bytesTransferred).toBe(5_000_000_000);
      expect(capturedEvent!.totalBytes).toBe(10_000_000_000);
    });
  });

  describe('multiple invocations', () => {
    it('calls onProgress for each invocation', () => {
      const events: ProgressEvent[] = [];
      const onProgress = mock((event: ProgressEvent) => {
        events.push(event);
      });

      const adapter = createProgressAdapter('Uploading', onProgress)!;
      adapter(1, 10, 'file1.txt');
      adapter(2, 10, 'file2.txt');
      adapter(3, 10, 'file3.txt');

      expect(events).toHaveLength(3);
      expect(events[0].percentage).toBe(10);
      expect(events[1].percentage).toBe(20);
      expect(events[2].percentage).toBe(30);
    });
  });
});
