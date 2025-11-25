/**
 * AdapterContext
 *
 * React Context for dependency injection of storage adapters.
 * Provides a clean way to access adapters in React components without
 * relying on global singletons.
 *
 * Features:
 * - Type-safe adapter access
 * - Testable in isolation (wrap with mock adapter in tests)
 * - No global mutable state in React tree
 * - Support for multiple adapter types via registry
 */

import { createContext, useContext, ReactNode, useMemo } from 'react';
import type { Adapter, ReadableStorageAdapter } from '../adapters/adapter.js';
import { AdapterRegistry, createAdapterRegistry } from '../adapters/registry.js';

// ============================================================================
// Context Types
// ============================================================================

/**
 * Value provided by AdapterContext
 */
interface AdapterContextValue {
  /** The primary adapter for storage operations */
  adapter: Adapter;

  /** Optional registry for multi-adapter scenarios */
  registry?: AdapterRegistry;
}

// ============================================================================
// Context
// ============================================================================

const AdapterContext = createContext<AdapterContextValue | null>(null);

// ============================================================================
// Provider Props
// ============================================================================

/**
 * Props for AdapterProvider
 */
interface AdapterProviderProps {
  /** Child components */
  children: ReactNode;

  /** The adapter to provide */
  adapter: Adapter;

  /**
   * Optional registry for multi-adapter scenarios
   * If provided, enables useAdapterRegistry hook
   */
  registry?: AdapterRegistry;
}

// ============================================================================
// Provider Component
// ============================================================================

/**
 * AdapterProvider component
 *
 * Wraps the application to provide adapter access via context.
 * This is the recommended way to make adapters available to React components.
 *
 * @example
 * ```tsx
 * // Basic usage with a single adapter
 * function App() {
 *   const adapter = new S3Adapter({ region: 'us-east-1' });
 *
 *   return (
 *     <AdapterProvider adapter={adapter}>
 *       <S3Explorer />
 *     </AdapterProvider>
 *   );
 * }
 *
 * // With registry for multiple adapters
 * function App() {
 *   const registry = createAdapterRegistry();
 *   registry.registerS3({ region: 'us-east-1' });
 *   const adapter = registry.getAdapter('s3');
 *
 *   return (
 *     <AdapterProvider adapter={adapter} registry={registry}>
 *       <S3Explorer />
 *     </AdapterProvider>
 *   );
 * }
 * ```
 */
export function AdapterProvider({ children, adapter, registry }: AdapterProviderProps) {
  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo<AdapterContextValue>(
    () => ({
      adapter,
      registry,
    }),
    [adapter, registry]
  );

  return <AdapterContext.Provider value={value}>{children}</AdapterContext.Provider>;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to access the adapter from context
 *
 * @throws Error if used outside AdapterProvider
 *
 * @example
 * ```tsx
 * function FileList() {
 *   const adapter = useAdapter();
 *
 *   useEffect(() => {
 *     adapter.list('/').then(setFiles);
 *   }, [adapter]);
 *
 *   return <div>...</div>;
 * }
 * ```
 */
export function useAdapter(): Adapter {
  const context = useContext(AdapterContext);
  if (!context) {
    throw new Error('useAdapter must be used within an AdapterProvider');
  }
  return context.adapter;
}

/**
 * Hook to access the adapter with a specific interface type
 *
 * Use this when you need type narrowing for specific adapter capabilities.
 *
 * @throws Error if used outside AdapterProvider
 *
 * @example
 * ```tsx
 * function FileViewer() {
 *   const adapter = useTypedAdapter<ReadableStorageAdapter>();
 *   // adapter is typed as ReadableStorageAdapter
 * }
 * ```
 */
export function useTypedAdapter<T extends ReadableStorageAdapter>(): T {
  const adapter = useAdapter();
  return adapter as unknown as T;
}

/**
 * Hook to access the adapter registry from context
 *
 * Only available if a registry was provided to AdapterProvider.
 *
 * @returns The registry, or undefined if not provided
 *
 * @example
 * ```tsx
 * function AdapterSwitcher() {
 *   const registry = useAdapterRegistry();
 *
 *   if (!registry) {
 *     return <div>Single adapter mode</div>;
 *   }
 *
 *   return (
 *     <select>
 *       {registry.listAdapters().map(name => (
 *         <option key={name}>{name}</option>
 *       ))}
 *     </select>
 *   );
 * }
 * ```
 */
export function useAdapterRegistry(): AdapterRegistry | undefined {
  const context = useContext(AdapterContext);
  if (!context) {
    throw new Error('useAdapterRegistry must be used within an AdapterProvider');
  }
  return context.registry;
}

/**
 * Hook to check if we're inside an AdapterProvider
 *
 * Useful for optional adapter usage or graceful degradation.
 *
 * @example
 * ```tsx
 * function OptionalFeature() {
 *   const hasAdapter = useHasAdapter();
 *
 *   if (!hasAdapter) {
 *     return <div>Feature unavailable</div>;
 *   }
 *
 *   return <FeatureWithAdapter />;
 * }
 * ```
 */
export function useHasAdapter(): boolean {
  const context = useContext(AdapterContext);
  return context !== null;
}
