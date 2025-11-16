/**
 * Async operation wrapper with loading states
 * 
 * Provides a convenient way to run async operations with automatic
 * loading state management and error handling.
 */

import { LoadingManager } from './loading-manager.js';
import { parseAwsError, isRetryable } from '../utils/errors.js';

/**
 * Options for async operation
 */
export interface AsyncOperationOptions {
  /** Operation name for display */
  name: string;
  /** Whether operation is retryable */
  retryable?: boolean;
  /** Custom retry function */
  onRetry?: () => void;
  /** Progress callback */
  onProgress?: (progress: number) => void;
}

/**
 * Result of async operation
 */
export interface AsyncOperationResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
}

/**
 * Async operation manager
 */
export class AsyncOperationManager {
  private loadingManager: LoadingManager;

  constructor(loadingManager: LoadingManager) {
    this.loadingManager = loadingManager;
  }

  /**
   * Execute an async operation with loading state management
   */
  async execute<T>(
    operation: () => Promise<T>,
    options: AsyncOperationOptions
  ): Promise<AsyncOperationResult<T>> {
    const operationId = `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Start loading
      this.loadingManager.startLoading(
        operationId,
        options.name,
        options.retryable,
        options.onRetry
      );

      // Execute operation
      const result = await operation();

      // Complete successfully
      this.loadingManager.completeSuccess(operationId);
      
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      const parsedError = error instanceof Error ? error : new Error(String(error));
      const retryable = options.retryable ?? isRetryable(parsedError);
      
      // Complete with error
      this.loadingManager.completeError(operationId, parsedError, retryable);
      
      return {
        success: false,
        error: parsedError,
      };
    }
  }

  /**
   * Execute an S3 operation with AWS error parsing
   */
  async executeS3<T>(
    operation: () => Promise<T>,
    options: AsyncOperationOptions
  ): Promise<AsyncOperationResult<T>> {
    return this.execute(operation, {
      ...options,
      retryable: options.retryable ?? true, // S3 operations are generally retryable
    });
  }

  /**
   * Execute with progress tracking
   */
  async executeWithProgress<T>(
    operation: (updateProgress: (progress: number) => void) => Promise<T>,
    options: AsyncOperationOptions
  ): Promise<AsyncOperationResult<T>> {
    const operationId = `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Start loading
      this.loadingManager.startLoading(
        operationId,
        options.name,
        options.retryable,
        options.onRetry
      );

      // Execute operation with progress tracking
      const result = await operation((progress) => {
        this.loadingManager.updateProgress(operationId, progress);
        options.onProgress?.(progress);
      });

      // Complete successfully
      this.loadingManager.completeSuccess(operationId);
      
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      const parsedError = error instanceof Error ? error : new Error(String(error));
      const retryable = options.retryable ?? isRetryable(parsedError);
      
      // Complete with error
      this.loadingManager.completeError(operationId, parsedError, retryable);
      
      return {
        success: false,
        error: parsedError,
      };
    }
  }
}

/**
 * Create a wrapped async operation function
 */
export function createAsyncOperation<T>(
  loadingManager: LoadingManager,
  operation: () => Promise<T>,
  options: AsyncOperationOptions
): () => Promise<AsyncOperationResult<T>> {
  const manager = new AsyncOperationManager(loadingManager);
  return () => manager.execute(operation, options);
}

/**
 * Create a wrapped S3 operation function
 */
export function createS3Operation<T>(
  loadingManager: LoadingManager,
  operation: () => Promise<T>,
  options: AsyncOperationOptions
): () => Promise<AsyncOperationResult<T>> {
  const manager = new AsyncOperationManager(loadingManager);
  return () => manager.executeS3(operation, options);
}