/**
 * Cancellation Token Support
 *
 * Provides a mechanism for cancelling long-running provider operations.
 * Similar to AbortController/AbortSignal pattern but provider-specific.
 *
 * Usage:
 * ```typescript
 * const tokenSource = new CancellationTokenSource();
 *
 * // Start operation with token
 * provider.download(path, localPath, {
 *   cancellationToken: tokenSource.token
 * });
 *
 * // Cancel when needed
 * tokenSource.cancel();
 * ```
 */

/**
 * Callback type for cancellation listeners
 */
export type CancellationCallback = () => void;

/**
 * Token that can be used to check for cancellation
 *
 * Pass this token to provider operations to enable cancellation.
 * Operations should periodically check `isCancelled` and abort if true.
 */
export interface CancellationToken {
  /**
   * Whether cancellation has been requested
   */
  readonly isCancelled: boolean;

  /**
   * Register a callback to be called when cancellation is requested
   * @param callback - Function to call on cancellation
   * @returns Function to unregister the callback
   */
  onCancel(callback: CancellationCallback): () => void;

  /**
   * Throw if cancellation has been requested
   * @throws CancellationError if cancelled
   */
  throwIfCancelled(): void;
}

/**
 * Error thrown when an operation is cancelled
 */
export class CancellationError extends Error {
  constructor(message = 'Operation was cancelled') {
    super(message);
    this.name = 'CancellationError';
  }
}

/**
 * Source for creating and controlling cancellation tokens
 *
 * Create one source per operation that you want to be able to cancel.
 * Pass the `token` to the operation, keep the source to call `cancel()`.
 */
export class CancellationTokenSource {
  private _isCancelled = false;
  private _callbacks: Set<CancellationCallback> = new Set();
  private _token: CancellationToken;

  constructor() {
    // Create the token with a reference to this source
    this._token = {
      get isCancelled() {
        return this._source._isCancelled;
      },
      onCancel: (callback: CancellationCallback) => {
        this._callbacks.add(callback);
        // Return unsubscribe function
        return () => {
          this._callbacks.delete(callback);
        };
      },
      throwIfCancelled: () => {
        if (this._isCancelled) {
          throw new CancellationError();
        }
      },
      _source: this,
    } as CancellationToken & { _source: CancellationTokenSource };
  }

  /**
   * The cancellation token to pass to operations
   */
  get token(): CancellationToken {
    return this._token;
  }

  /**
   * Whether cancellation has been requested
   */
  get isCancelled(): boolean {
    return this._isCancelled;
  }

  /**
   * Request cancellation of the associated operation
   *
   * This will:
   * 1. Set `isCancelled` to true on the token
   * 2. Call all registered cancellation callbacks
   *
   * Calling cancel() multiple times has no effect after the first call.
   */
  cancel(): void {
    if (this._isCancelled) return;

    this._isCancelled = true;

    // Call all registered callbacks
    for (const callback of this._callbacks) {
      try {
        callback();
      } catch {
        // Ignore errors in callbacks
      }
    }
  }

  /**
   * Create a new source that will be cancelled when this source is cancelled
   * Useful for creating child operations that should be cancelled together
   *
   * @returns A new CancellationTokenSource linked to this one
   */
  createLinkedSource(): CancellationTokenSource {
    const linked = new CancellationTokenSource();

    // If already cancelled, cancel the linked source immediately
    if (this._isCancelled) {
      linked.cancel();
    } else {
      // Otherwise, link them
      this._token.onCancel(() => linked.cancel());
    }

    return linked;
  }
}

/**
 * A cancellation token that is never cancelled
 * Useful as a default when cancellation is optional
 */
export const NeverCancelledToken: CancellationToken = {
  isCancelled: false,
  onCancel: () => () => {},
  throwIfCancelled: () => {},
};

/**
 * A cancellation token that is already cancelled
 * Useful for testing or when an operation should be cancelled immediately
 */
export const AlreadyCancelledToken: CancellationToken = {
  isCancelled: true,
  onCancel: callback => {
    // Call immediately since already cancelled
    callback();
    return () => {};
  },
  throwIfCancelled: () => {
    throw new CancellationError();
  },
};

/**
 * Create a cancellation token from an AbortSignal
 * Useful for integrating with browser/Node.js AbortController
 *
 * @param signal - The AbortSignal to wrap
 * @returns A CancellationToken that reflects the signal's state
 */
export function fromAbortSignal(signal: AbortSignal): CancellationToken {
  const source = new CancellationTokenSource();

  if (signal.aborted) {
    source.cancel();
  } else {
    signal.addEventListener('abort', () => source.cancel(), { once: true });
  }

  return source.token;
}

/**
 * Create an AbortController that will abort when the token is cancelled
 * Useful for integrating with APIs that use AbortSignal
 *
 * @param token - The cancellation token to observe
 * @returns An AbortController that aborts when the token is cancelled
 */
export function toAbortController(token: CancellationToken): AbortController {
  const controller = new AbortController();

  if (token.isCancelled) {
    controller.abort();
  } else {
    token.onCancel(() => controller.abort());
  }

  return controller;
}

/**
 * Options interface extension for operations that support cancellation
 */
export interface CancellableOptions {
  /** Token for cancelling the operation */
  cancellationToken?: CancellationToken;
}
