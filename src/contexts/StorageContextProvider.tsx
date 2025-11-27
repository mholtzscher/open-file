/**
 * StorageContextProvider Implementation
 *
 * Provides the unified storage context to the application.
 *
 * Key responsibilities:
 * - Manage storage provider lifecycle
 * - Provide StorageContextValue to children
 * - Handle initialization and cleanup
 */

import { useMemo, useEffect, ReactNode } from 'react';
import { StorageContext, StorageContextValue, StorageProviderProps } from './StorageContext.js';
import { ProviderStorageAdapter } from './ProviderStorageAdapter.js';
import { StorageProvider } from '../providers/provider.js';
import type { ProfileManager } from '../providers/services/profile-manager.js';

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
   * Storage provider (optional - can start without a provider for profile selection)
   */
  provider?: StorageProvider;

  /**
   * Optional ProfileManager for profile switching
   */
  profileManager?: ProfileManager;
}

// ============================================================================
// Provider Component
// ============================================================================

/**
 * StorageContextProvider component
 *
 * Provides unified storage access to all child components.
 *
 * @example
 * ```tsx
 * function App() {
 *   const provider = new S3StorageProvider({ region: 'us-east-1' });
 *
 *   return (
 *     <StorageContextProvider provider={provider}>
 *       <S3Explorer />
 *     </StorageContextProvider>
 *   );
 * }
 * ```
 */
export function StorageContextProvider({
  children,
  provider,
  profileManager,
  initialPath = '/',
  initialContainer,
}: StorageContextProviderProps) {
  // Create the storage adapter wrapper (or null if no provider)
  const storageAdapter = useMemo<StorageContextValue | null>(() => {
    if (!provider) {
      return null;
    }
    return new ProviderStorageAdapter(provider, initialPath, initialContainer, profileManager);
  }, [provider, initialPath, initialContainer, profileManager]);

  // Initialize on mount (only if we have a provider)
  useEffect(() => {
    if (!storageAdapter) {
      return;
    }

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
export { useStorage, useHasStorage, useOptionalStorage } from './StorageContext.js';

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
