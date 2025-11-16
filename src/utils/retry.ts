/**
 * Retry logic utilities with exponential backoff
 */

export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxAttempts?: number;
  /** Initial delay in milliseconds */
  initialDelayMs?: number;
  /** Maximum delay in milliseconds */
  maxDelayMs?: number;
  /** Exponential backoff multiplier */
  backoffMultiplier?: number;
  /** Function to determine if error is retryable */
  isRetryable?: (error: any) => boolean;
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 100,
    maxDelayMs = 30000,
    backoffMultiplier = 2,
    isRetryable = defaultIsRetryable,
  } = options;

  let lastError: Error | null = null;
  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // If not retryable or last attempt, throw
      if (!isRetryable(error) || attempt === maxAttempts) {
        throw error;
      }

      // Wait before retrying
      console.debug(
        `Retry attempt ${attempt}/${maxAttempts} after ${delay}ms: ${
          (error as any)?.message || String(error)
        }`
      );
      await new Promise(resolve => setTimeout(resolve, delay));

      // Increase delay for next attempt
      delay = Math.min(delay * backoffMultiplier, maxDelayMs);
    }
  }

  throw lastError;
}

/**
 * Default function to check if error is retryable
 */
function defaultIsRetryable(error: any): boolean {
  if (!error) return false;

  const code = error.code || error.$fault || error.name;
  const statusCode = error.$metadata?.httpStatusCode;

  // Retryable status codes: 429 (throttle), 500, 502, 503, 504
  if (statusCode && [429, 500, 502, 503, 504].includes(statusCode)) {
    return true;
  }

  // Retryable AWS error codes
  const retryableAwsCodes = [
    'SlowDown',
    'RequestTimeout',
    'ServiceUnavailable',
    'RequestLimitExceeded',
    'ThrottlingException',
    'ProvisionedThroughputExceededException',
    'NetworkingError',
    'TimeoutError',
    'ECONNRESET',
    'EHOSTUNREACH',
    'ETIMEDOUT',
  ];

  return retryableAwsCodes.includes(code);
}

/**
 * Get a retry function configured for S3 operations (more aggressive retries for throttling)
 */
export function getS3RetryConfig(): RetryOptions {
  return {
    maxAttempts: 5, // More attempts for S3 throttling
    initialDelayMs: 50, // Start with shorter delay
    maxDelayMs: 60000, // Allow up to 1 minute of backoff
    backoffMultiplier: 1.5, // Gentler backoff multiplier
  };
}
