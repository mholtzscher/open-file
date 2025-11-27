/**
 * Tests for Cancellation Token Support
 */

import { describe, test, expect, mock } from 'bun:test';
import {
  CancellationTokenSource,
  CancellationError,
  NeverCancelledToken,
  AlreadyCancelledToken,
  fromAbortSignal,
  toAbortController,
} from './cancellation.js';

describe('CancellationTokenSource', () => {
  test('should start as not cancelled', () => {
    const source = new CancellationTokenSource();
    expect(source.isCancelled).toBe(false);
    expect(source.token.isCancelled).toBe(false);
  });

  test('should be cancellable', () => {
    const source = new CancellationTokenSource();
    source.cancel();
    expect(source.isCancelled).toBe(true);
    expect(source.token.isCancelled).toBe(true);
  });

  test('should only cancel once', () => {
    const source = new CancellationTokenSource();
    const callback = mock(() => {});
    source.token.onCancel(callback);

    source.cancel();
    source.cancel();
    source.cancel();

    expect(callback).toHaveBeenCalledTimes(1);
  });

  test('should call registered callbacks on cancel', () => {
    const source = new CancellationTokenSource();
    const callback1 = mock(() => {});
    const callback2 = mock(() => {});

    source.token.onCancel(callback1);
    source.token.onCancel(callback2);
    source.cancel();

    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(1);
  });

  test('should allow unsubscribing callbacks', () => {
    const source = new CancellationTokenSource();
    const callback = mock(() => {});

    const unsubscribe = source.token.onCancel(callback);
    unsubscribe();
    source.cancel();

    expect(callback).not.toHaveBeenCalled();
  });

  test('should ignore errors in callbacks', () => {
    const source = new CancellationTokenSource();
    const errorCallback = mock(() => {
      throw new Error('callback error');
    });
    const normalCallback = mock(() => {});

    source.token.onCancel(errorCallback);
    source.token.onCancel(normalCallback);

    // Should not throw
    expect(() => source.cancel()).not.toThrow();
    expect(normalCallback).toHaveBeenCalled();
  });
});

describe('CancellationToken.throwIfCancelled', () => {
  test('should not throw when not cancelled', () => {
    const source = new CancellationTokenSource();
    expect(() => source.token.throwIfCancelled()).not.toThrow();
  });

  test('should throw CancellationError when cancelled', () => {
    const source = new CancellationTokenSource();
    source.cancel();
    expect(() => source.token.throwIfCancelled()).toThrow(CancellationError);
  });
});

describe('Linked sources', () => {
  test('should cancel linked source when parent is cancelled', () => {
    const parent = new CancellationTokenSource();
    const child = parent.createLinkedSource();

    expect(child.isCancelled).toBe(false);
    parent.cancel();
    expect(child.isCancelled).toBe(true);
  });

  test('should not cancel parent when child is cancelled', () => {
    const parent = new CancellationTokenSource();
    const child = parent.createLinkedSource();

    child.cancel();
    expect(child.isCancelled).toBe(true);
    expect(parent.isCancelled).toBe(false);
  });

  test('should create already-cancelled linked source if parent is cancelled', () => {
    const parent = new CancellationTokenSource();
    parent.cancel();
    const child = parent.createLinkedSource();

    expect(child.isCancelled).toBe(true);
  });
});

describe('NeverCancelledToken', () => {
  test('should never be cancelled', () => {
    expect(NeverCancelledToken.isCancelled).toBe(false);
  });

  test('should not throw on throwIfCancelled', () => {
    expect(() => NeverCancelledToken.throwIfCancelled()).not.toThrow();
  });

  test('should accept callbacks but never call them', () => {
    const callback = mock(() => {});
    const unsubscribe = NeverCancelledToken.onCancel(callback);

    // Should return a valid unsubscribe function
    expect(typeof unsubscribe).toBe('function');
    expect(callback).not.toHaveBeenCalled();
  });
});

describe('AlreadyCancelledToken', () => {
  test('should always be cancelled', () => {
    expect(AlreadyCancelledToken.isCancelled).toBe(true);
  });

  test('should throw on throwIfCancelled', () => {
    expect(() => AlreadyCancelledToken.throwIfCancelled()).toThrow(CancellationError);
  });

  test('should call callbacks immediately', () => {
    const callback = mock(() => {});
    AlreadyCancelledToken.onCancel(callback);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});

describe('CancellationError', () => {
  test('should have correct name', () => {
    const error = new CancellationError();
    expect(error.name).toBe('CancellationError');
  });

  test('should have default message', () => {
    const error = new CancellationError();
    expect(error.message).toBe('Operation was cancelled');
  });

  test('should accept custom message', () => {
    const error = new CancellationError('Custom message');
    expect(error.message).toBe('Custom message');
  });

  test('should be instanceof Error', () => {
    const error = new CancellationError();
    expect(error).toBeInstanceOf(Error);
  });
});

describe('AbortSignal integration', () => {
  test('fromAbortSignal should create token from signal', () => {
    const controller = new AbortController();
    const token = fromAbortSignal(controller.signal);

    expect(token.isCancelled).toBe(false);
    controller.abort();
    expect(token.isCancelled).toBe(true);
  });

  test('fromAbortSignal should handle already-aborted signal', () => {
    const controller = new AbortController();
    controller.abort();
    const token = fromAbortSignal(controller.signal);

    expect(token.isCancelled).toBe(true);
  });

  test('toAbortController should create controller from token', () => {
    const source = new CancellationTokenSource();
    const controller = toAbortController(source.token);

    expect(controller.signal.aborted).toBe(false);
    source.cancel();
    expect(controller.signal.aborted).toBe(true);
  });

  test('toAbortController should handle already-cancelled token', () => {
    const source = new CancellationTokenSource();
    source.cancel();
    const controller = toAbortController(source.token);

    expect(controller.signal.aborted).toBe(true);
  });
});
