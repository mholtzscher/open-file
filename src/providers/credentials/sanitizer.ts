/**
 * Sensitive Data Sanitizer
 *
 * Utilities for detecting and masking sensitive data in profiles and objects.
 * Used for:
 * - Safe logging (don't log passwords)
 * - UI display (mask sensitive fields)
 * - Security warnings (detect plaintext credentials)
 */

// ============================================================================
// Sensitive Field Patterns
// ============================================================================

/**
 * Field name patterns that indicate sensitive data
 * Case-insensitive matching
 */
const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /key/i,
  /pass/i,
  /credential/i,
  /refreshtoken/i,
  /accesstoken/i,
  /apikey/i,
  /privatekey/i,
  /passphrase/i,
  /auth/i,
];

/**
 * Field names that are explicitly NOT sensitive despite matching patterns
 * (e.g., "accessKeyId" matches "key" but is not the secret part)
 */
const SAFE_FIELD_NAMES = new Set([
  'accesskeyid', // AWS access key ID is not secret (secret access key is)
  'keyfilepath', // Path to key file, not the key itself
  'publickey', // Public keys are not sensitive
  'authmethod', // The method name, not credentials
]);

/**
 * Default mask string
 */
const DEFAULT_MASK = '********';

/**
 * Short mask for display
 */
const SHORT_MASK = '***';

// ============================================================================
// Detection Functions
// ============================================================================

/**
 * Check if a field name indicates sensitive data
 *
 * @param fieldName - Name of the field to check
 * @returns true if field name suggests sensitive data
 */
export function isSensitiveFieldName(fieldName: string): boolean {
  const lowerName = fieldName.toLowerCase();

  // Check safe list first
  if (SAFE_FIELD_NAMES.has(lowerName)) {
    return false;
  }

  // Check against sensitive patterns
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(fieldName));
}

/**
 * Check if an object contains any sensitive data
 *
 * Recursively checks all fields in the object.
 *
 * @param obj - Object to check
 * @returns true if any sensitive fields are found with non-empty values
 */
export function hasSensitiveData(obj: unknown): boolean {
  if (obj === null || obj === undefined) {
    return false;
  }

  if (typeof obj !== 'object') {
    return false;
  }

  if (Array.isArray(obj)) {
    return obj.some(item => hasSensitiveData(item));
  }

  const record = obj as Record<string, unknown>;

  for (const [key, value] of Object.entries(record)) {
    // Check if this field name is sensitive and has a value
    if (isSensitiveFieldName(key) && value !== undefined && value !== null && value !== '') {
      return true;
    }

    // Recursively check nested objects
    if (typeof value === 'object' && value !== null) {
      if (hasSensitiveData(value)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Get a list of sensitive field paths in an object
 *
 * @param obj - Object to check
 * @param prefix - Path prefix for nested objects
 * @returns Array of field paths that contain sensitive data
 */
export function getSensitiveFieldPaths(obj: unknown, prefix = ''): string[] {
  const paths: string[] = [];

  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return paths;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      paths.push(...getSensitiveFieldPaths(item, `${prefix}[${index}]`));
    });
    return paths;
  }

  const record = obj as Record<string, unknown>;

  for (const [key, value] of Object.entries(record)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (isSensitiveFieldName(key) && value !== undefined && value !== null && value !== '') {
      paths.push(path);
    }

    if (typeof value === 'object' && value !== null) {
      paths.push(...getSensitiveFieldPaths(value, path));
    }
  }

  return paths;
}

// ============================================================================
// Masking Functions
// ============================================================================

/**
 * Options for masking sensitive fields
 */
export interface MaskOptions {
  /** Mask string to use (default: "********") */
  mask?: string;
  /** Show partial value (e.g., "sk-****1234") */
  showPartial?: boolean;
  /** Number of characters to show at start when showPartial is true */
  showStart?: number;
  /** Number of characters to show at end when showPartial is true */
  showEnd?: number;
}

/**
 * Mask a sensitive value
 *
 * @param value - Value to mask
 * @param options - Masking options
 * @returns Masked value
 */
export function maskValue(value: unknown, options: MaskOptions = {}): string {
  const { mask = DEFAULT_MASK, showPartial = false, showStart = 3, showEnd = 4 } = options;

  if (value === null || value === undefined) {
    return '';
  }

  // Handle objects by masking them directly
  if (typeof value === 'object') {
    return mask;
  }

  const str = String(value as string | number | boolean | bigint | symbol);

  if (!showPartial || str.length <= showStart + showEnd + 4) {
    return mask;
  }

  const start = str.slice(0, showStart);
  const end = str.slice(-showEnd);
  return `${start}${SHORT_MASK}${end}`;
}

/**
 * Mask sensitive fields in an object
 *
 * Returns a deep copy with sensitive fields masked.
 *
 * @param obj - Object to mask
 * @param options - Masking options
 * @returns New object with sensitive fields masked
 */
export function maskSensitiveFields<T>(obj: T, options: MaskOptions = {}): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return obj.map(item => maskSensitiveFields(item, options)) as unknown as T;
  }

  const record = obj as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    if (isSensitiveFieldName(key) && value !== undefined && value !== null && value !== '') {
      result[key] = maskValue(value, options);
    } else if (typeof value === 'object' && value !== null) {
      result[key] = maskSensitiveFields(value, options);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

// ============================================================================
// Logging Utilities
// ============================================================================

/**
 * Sanitize an object for safe logging
 *
 * - Masks all sensitive fields
 * - Truncates very long strings
 * - Removes circular references
 *
 * @param obj - Object to sanitize
 * @param maxStringLength - Maximum length for string values (default: 100)
 * @returns Sanitized object safe for logging
 */
export function sanitizeForLogging(obj: unknown, maxStringLength = 100): unknown {
  const seen = new WeakSet();

  function sanitize(value: unknown, key?: string): unknown {
    // Handle null/undefined
    if (value === null || value === undefined) {
      return value;
    }

    // Handle primitives
    if (typeof value !== 'object') {
      // Mask sensitive values
      if (key && isSensitiveFieldName(key) && value !== '') {
        return maskValue(value);
      }

      // Truncate long strings
      if (typeof value === 'string' && value.length > maxStringLength) {
        return `${value.slice(0, maxStringLength)}... (${value.length} chars)`;
      }

      return value;
    }

    // Handle circular references
    if (seen.has(value)) {
      return '[Circular]';
    }
    seen.add(value);

    // Handle arrays
    if (Array.isArray(value)) {
      return value.map((item, index) => sanitize(item, String(index)));
    }

    // Handle objects
    const record = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};

    for (const [k, v] of Object.entries(record)) {
      result[k] = sanitize(v, k);
    }

    return result;
  }

  return sanitize(obj);
}

/**
 * Create a JSON string safe for logging
 *
 * @param obj - Object to stringify
 * @param indent - Indentation (default: 2)
 * @returns JSON string with sensitive data masked
 */
export function safeStringify(obj: unknown, indent = 2): string {
  try {
    const sanitized = sanitizeForLogging(obj);
    return JSON.stringify(sanitized, null, indent);
  } catch {
    return '[Unable to stringify]';
  }
}

// ============================================================================
// Warning Functions
// ============================================================================

/**
 * Warning about sensitive data in profiles
 */
export interface SensitiveDataWarning {
  /** Warning severity */
  severity: 'info' | 'warning' | 'error';
  /** Warning message */
  message: string;
  /** Field path that triggered the warning */
  field?: string;
}

/**
 * Check a profile for security issues and return warnings
 *
 * @param profile - Profile to check
 * @returns Array of warnings
 */
export function checkForSensitiveDataWarnings(profile: unknown): SensitiveDataWarning[] {
  const warnings: SensitiveDataWarning[] = [];

  if (!profile || typeof profile !== 'object') {
    return warnings;
  }

  const sensitiveFields = getSensitiveFieldPaths(profile);

  if (sensitiveFields.length > 0) {
    // Check for plaintext passwords in config
    const passwordFields = sensitiveFields.filter(
      f => /password/i.test(f) || /secret/i.test(f) || /passphrase/i.test(f)
    );

    if (passwordFields.length > 0) {
      warnings.push({
        severity: 'warning',
        message:
          'Profile contains plaintext credentials. Consider using environment variables or encrypted config.',
        field: passwordFields[0],
      });
    }

    // Check for inline access keys
    const keyFields = sensitiveFields.filter(
      f => /secretaccesskey/i.test(f) || /privatekey/i.test(f)
    );

    if (keyFields.length > 0) {
      warnings.push({
        severity: 'warning',
        message: 'Profile contains inline secret keys. Consider using AWS profiles or key files.',
        field: keyFields[0],
      });
    }

    // Check for tokens
    const tokenFields = sensitiveFields.filter(f => /token/i.test(f));

    if (tokenFields.length > 0) {
      warnings.push({
        severity: 'info',
        message: 'Profile contains tokens that may expire. Ensure refresh mechanism is in place.',
        field: tokenFields[0],
      });
    }
  }

  return warnings;
}
