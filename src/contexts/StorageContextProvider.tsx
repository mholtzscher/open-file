/**
 * StorageContextProvider Implementation
 *
 * Provides the unified storage context to the application.
 * Uses feature flags to determine whether to use the legacy adapter system
 * or the new provider system.
 *
 * Key responsibilities:
 * - Select appropriate storage adapter (Legacy vs Provider)
 * - Manage storage adapter lifecycle
 * - Provide StorageContextValue to children
 * - Handle initialization and cleanup
 */

import { useMemo, useEffect, ReactNode } from 'react';
import { StorageContext, StorageContextValue, StorageProviderProps } from './StorageContext.js';
import { LegacyStorageAdapter } from './LegacyStorageAdapter.js';
import { ProviderStorageAdapter } from './ProviderStorageAdapter.js';
import { Adapter } from '../adapters/adapter.js';
import { StorageProvider } from '../providers/provider.js';
import { isNewProviderSystemEnabled } from '../utils/feature-flags.js';

// ============================================================================
// Provider Props (Extended)
// ============================================================================

/**
 * Props for StorageContextProvider
 */
export interface StorageContextProviderProps extends Omit<StorageProviderProps, 'children'> {
  /** Child components */
  children: ReactNode;

  /**
   * Legacy adapter (for backward compatibility)
   * Required if not using new provider system
   */
  adapter?: Adapter;

  /**
   * New storage provider
   * Required if using new provider system
   */
  provider?: StorageProvider;

  /**
   * Override feature flag detection
   * If true, forces use of new provider system
   * If false, forces use of legacy adapter system
   */
  useProviderSystem?: boolean;
}

// ============================================================================
// Provider Component
// ============================================================================

/**
 * StorageContextProvider component
 *
 * Provides unified storage access to all child components.
 * Automatically selects between legacy and new systems based on feature flags.
 *
 * @example
 * ```tsx
 * // Legacy mode (default)
 * function App() {
 *   const adapter = new S3Adapter({ region: 'us-east-1' });
 *
 *   return (
 *     <StorageContextProvider adapter={adapter}>
 *       <S3Explorer />
 *     </StorageContextProvider>
 *   );
 * }
 *
 * // New provider mode (with feature flag)
 * function App() {
 *   const provider = new S3StorageProvider({ region: 'us-east-1' });
 *
 *   return (
 *     <StorageContextProvider provider={provider} useProviderSystem={true}>
 *       <S3Explorer />
 *     </StorageContextProvider>
 *   );
 * }
 * ```
 */
export function StorageContextProvider({
  children,
  adapter,
  provider,
  useProviderSystem,
  initialPath = '/',
  initialContainer,
}: StorageContextProviderProps) {
  // Determine which system to use
  const shouldUseProviderSystem =
    useProviderSystem !== undefined ? useProviderSystem : isNewProviderSystemEnabled();

  // Validate that we have the required adapter/provider
  if (shouldUseProviderSystem && !provider) {
    throw new Error('StorageContextProvider: provider is required when useProviderSystem is true');
  }

  if (!shouldUseProviderSystem && !adapter) {
    throw new Error(
      'StorageContextProvider: adapter is required when useProviderSystem is false (legacy mode)'
    );
  }

  // Create the storage adapter wrapper
  const storageAdapter = useMemo<StorageContextValue>(() => {
    if (shouldUseProviderSystem && provider) {
      return new ProviderStorageAdapter(provider, initialPath, initialContainer);
    } else if (adapter) {
      return new LegacyStorageAdapter(adapter, initialPath, initialContainer);
    }

    // This should never happen due to validation above, but TypeScript needs it
    throw new Error('StorageContextProvider: no adapter or provider available');
  }, [shouldUseProviderSystem, provider, adapter, initialPath, initialContainer]);

  // Initialize on mount
  useEffect(() => {
    // Perform initial navigation to load entries
    storageAdapter.navigate(initialPath).catch(error => {
      console.error('StorageContextProvider: Failed to initialize:', error);
    });

    // Cleanup on unmount
    return () => {
      // Disconnect if provider supports it
      storageAdapter.disconnect().catch(error => {
        console.error('StorageContextProvider: Failed to disconnect:', error);
      });
    };
  }, [storageAdapter, initialPath]);

  return <StorageContext.Provider value={storageAdapter}>{children}</StorageContext.Provider>;
}

// ============================================================================
// Convenience Re-exports
// ============================================================================

// Re-export hooks for convenience
export { useStorage, useHasStorage } from './StorageContext.js';

// Re-export types for convenience
export type {
  StorageContextValue,
  StorageState,
  StorageError,
  StorageOperationOptions,
  StorageListOptions,
  StorageReadOptions,
  StorageWriteOptions,
} from './StorageContext.js';
