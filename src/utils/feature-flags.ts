/**
 * Feature Flag System for open-file
 *
 * Manages feature flags for progressive migration and experimental features.
 * Flags can be set via:
 * 1. Environment variables (highest priority)
 * 2. Default values (lowest priority)
 *
 * This enables safe, gradual rollout of new features like the provider system.
 */

// ============================================================================
// Feature Flag Definitions
// ============================================================================

/**
 * Available feature flags
 */
export enum FeatureFlag {
  /**
   * Use the new provider system instead of legacy adapters
   *
   * Environment: OPEN_FILE_USE_PROVIDERS=true|false
   * Config: featureFlags.useProviders
   * Default: true (as of 2025-11-27 cutover)
   *
   * ROLLBACK: Set OPEN_FILE_USE_LEGACY=true to revert to legacy adapter system
   */
  USE_NEW_PROVIDER_SYSTEM = 'USE_NEW_PROVIDER_SYSTEM',

  /**
   * Enable multi-provider support (switching between different storage backends)
   * Environment: OPEN_FILE_MULTI_PROVIDER=true|false
   * Config: featureFlags.multiProvider
   * Default: false
   */
  MULTI_PROVIDER = 'MULTI_PROVIDER',

  /**
   * Enable experimental features
   * Environment: OPEN_FILE_EXPERIMENTAL=true|false
   * Config: featureFlags.experimental
   * Default: false
   */
  EXPERIMENTAL = 'EXPERIMENTAL',

  /**
   * Enable debug mode (verbose logging, diagnostics)
   * Environment: OPEN_FILE_DEBUG=true|false
   * Config: featureFlags.debug
   * Default: false
   */
  DEBUG = 'DEBUG',
}

/**
 * Environment variable names for feature flags
 */
const ENV_VAR_MAP: Record<FeatureFlag, string> = {
  [FeatureFlag.USE_NEW_PROVIDER_SYSTEM]: 'OPEN_FILE_USE_PROVIDERS',
  [FeatureFlag.MULTI_PROVIDER]: 'OPEN_FILE_MULTI_PROVIDER',
  [FeatureFlag.EXPERIMENTAL]: 'OPEN_FILE_EXPERIMENTAL',
  [FeatureFlag.DEBUG]: 'OPEN_FILE_DEBUG',
};

/**
 * Legacy escape hatch environment variable
 * Set OPEN_FILE_USE_LEGACY=true to revert to the legacy adapter system
 */
const LEGACY_ESCAPE_HATCH = 'OPEN_FILE_USE_LEGACY';

/**
 * Config file keys for feature flags
 */
const _CONFIG_KEY_MAP: Record<FeatureFlag, string> = {
  [FeatureFlag.USE_NEW_PROVIDER_SYSTEM]: 'useProviders',
  [FeatureFlag.MULTI_PROVIDER]: 'multiProvider',
  [FeatureFlag.EXPERIMENTAL]: 'experimental',
  [FeatureFlag.DEBUG]: 'debug',
};

/**
 * Default values for feature flags
 *
 * NOTE: USE_NEW_PROVIDER_SYSTEM defaults to TRUE as of 2025-11-27 cutover.
 * To use the legacy system, set OPEN_FILE_USE_LEGACY=true
 */
const DEFAULT_VALUES: Record<FeatureFlag, boolean> = {
  [FeatureFlag.USE_NEW_PROVIDER_SYSTEM]: true, // CUTOVER: New provider system is now the default
  [FeatureFlag.MULTI_PROVIDER]: false,
  [FeatureFlag.EXPERIMENTAL]: false,
  [FeatureFlag.DEBUG]: false,
};

// ============================================================================
// Feature Flags Interface
// ============================================================================

/**
 * Feature flags configuration in config file
 */
export interface FeatureFlagsConfig {
  /** Use new provider system instead of legacy adapters */
  useProviders?: boolean;
  /** Enable multi-provider support */
  multiProvider?: boolean;
  /** Enable experimental features */
  experimental?: boolean;
  /** Enable debug mode */
  debug?: boolean;
}

// ============================================================================
// Feature Flag Manager
// ============================================================================

/**
 * Feature flag manager
 *
 * Resolves feature flag values from environment variables and defaults.
 */
export class FeatureFlagManager {
  private cache: Map<FeatureFlag, boolean> = new Map();

  /**
   * Create a new feature flag manager
   */
  constructor() {
    // No-op constructor
  }

  /**
   * Check if a feature flag is enabled
   *
   * Resolution order:
   * 1. Legacy escape hatch (OPEN_FILE_USE_LEGACY=true disables new provider system)
   * 2. Environment variable
   * 3. Default value
   *
   * @param flag - The feature flag to check
   * @returns true if the flag is enabled
   */
  isEnabled(flag: FeatureFlag): boolean {
    // Check cache first
    if (this.cache.has(flag)) {
      return this.cache.get(flag)!;
    }

    // 0. Check legacy escape hatch for USE_NEW_PROVIDER_SYSTEM
    // This allows users to rollback to legacy system with OPEN_FILE_USE_LEGACY=true
    if (flag === FeatureFlag.USE_NEW_PROVIDER_SYSTEM) {
      const legacyEscapeValue = process.env[LEGACY_ESCAPE_HATCH];
      if (legacyEscapeValue !== undefined && this.parseBoolean(legacyEscapeValue)) {
        // Legacy mode requested - disable new provider system
        this.cache.set(flag, false);
        return false;
      }
    }

    // 1. Check environment variable
    const envVar = ENV_VAR_MAP[flag];
    const envValue = process.env[envVar];
    if (envValue !== undefined) {
      const enabled = this.parseBoolean(envValue);
      this.cache.set(flag, enabled);
      return enabled;
    }

    // 2. Use default value
    const enabled = DEFAULT_VALUES[flag];
    this.cache.set(flag, enabled);
    return enabled;
  }

  /**
   * Clear the cache
   * Call this after changing environment variables or config to pick up new values
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get all feature flags and their current values
   * Useful for debugging and diagnostics
   */
  getAllFlags(): Record<string, boolean> {
    const result: Record<string, boolean> = {};
    for (const flag of Object.values(FeatureFlag)) {
      result[flag] = this.isEnabled(flag as FeatureFlag);
    }
    return result;
  }

  /**
   * Parse a string value to boolean
   * Accepts: true, false, 1, 0, yes, no, on, off (case-insensitive)
   */
  private parseBoolean(value: string): boolean {
    const normalized = value.toLowerCase().trim();
    return (
      normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on'
    );
  }
}

// ============================================================================
// Global Instance (Convenience)
// ============================================================================

/**
 * Global feature flag manager instance
 * Used by convenience functions
 */
let globalManager: FeatureFlagManager | null = null;

/**
 * Initialize the global feature flag manager
 */
export function initializeFeatureFlags(): void {
  globalManager = new FeatureFlagManager();
}

/**
 * Get the global feature flag manager
 * Creates one if it doesn't exist
 */
export function getFeatureFlagManager(): FeatureFlagManager {
  if (!globalManager) {
    globalManager = new FeatureFlagManager();
  }
  return globalManager;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Check if a feature flag is enabled
 * Uses the global feature flag manager
 *
 * @param flag - The feature flag to check
 * @returns true if the flag is enabled
 */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return getFeatureFlagManager().isEnabled(flag);
}

/**
 * Check if the new provider system is enabled
 * Convenience wrapper for the most important flag during migration
 *
 * @returns true if new provider system should be used
 */
export function isNewProviderSystemEnabled(): boolean {
  return isFeatureEnabled(FeatureFlag.USE_NEW_PROVIDER_SYSTEM);
}

/**
 * Check if multi-provider support is enabled
 *
 * @returns true if multi-provider support is enabled
 */
export function isMultiProviderEnabled(): boolean {
  return isFeatureEnabled(FeatureFlag.MULTI_PROVIDER);
}

/**
 * Check if experimental features are enabled
 *
 * @returns true if experimental features are enabled
 */
export function isExperimentalEnabled(): boolean {
  return isFeatureEnabled(FeatureFlag.EXPERIMENTAL);
}

/**
 * Check if debug mode is enabled
 *
 * @returns true if debug mode is enabled
 */
export function isDebugEnabled(): boolean {
  return isFeatureEnabled(FeatureFlag.DEBUG);
}

/**
 * Get all feature flags and their current values
 * Useful for diagnostics
 *
 * @returns Object mapping flag names to their values
 */
export function getAllFeatureFlags(): Record<string, boolean> {
  return getFeatureFlagManager().getAllFlags();
}
