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

import { createMemo, onMount, onCleanup, type ParentProps } from 'solid-js';
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
  /**
   * Storage provider (optional - can start without a provider for profile selection)
   */
  provider?: StorageProvider;

  /**
   * Optional ProfileManager for profile switching
   */
  profileManager?: ProfileManager;

  /**
   * Optional profile display name (shown in header)
   */
  profileName?: string;

  /**
   * Optional profile ID (unique identifier for the profile)
   */
  profileId?: string;
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
export function StorageContextProvider(props: ParentProps<StorageContextProviderProps>) {
  // Create the storage adapter wrapper (or null if no provider)
  // Note: In Solid, we use createMemo for derived values
  const storageAdapter = createMemo<StorageContextValue | null>(() => {
    if (!props.provider) {
      return null;
    }
    return new ProviderStorageAdapter(
      props.provider,
      props.initialPath ?? '/',
      props.initialContainer,
      props.profileManager,
      props.profileName,
      props.profileId
    );
  });

  // Initialize on mount (only if we have a provider)
  onMount(() => {
    const adapter = storageAdapter();
    if (!adapter) {
      return;
    }

    // Initialize: connect (if needed) then navigate
    const initialize = async () => {
      try {
        // Connect first for connection-oriented providers
        await adapter.connect();
        // Navigation is handled by useDataLoader in the UI components
        // Don't navigate here to avoid conflicts with data loading
      } catch (error) {
        console.error('StorageContextProvider: Failed to initialize:', error);
      }
    };

    initialize();
  });

  // Cleanup on unmount
  onCleanup(() => {
    const adapter = storageAdapter();
    if (adapter) {
      // Disconnect if provider supports it
      adapter.disconnect().catch(error => {
        console.error('StorageContextProvider: Failed to disconnect:', error);
      });
    }
  });

  return (
    <StorageContext.Provider value={storageAdapter()}>{props.children}</StorageContext.Provider>
  );
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
