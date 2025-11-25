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
 */

import { createContext, useContext, ReactNode, useMemo } from 'react';
import type { Adapter, ReadableStorageAdapter } from '../adapters/adapter.js';

// ============================================================================
// Context Types
// ============================================================================

/**
 * Value provided by AdapterContext
 */
interface AdapterContextValue {
  /** The primary adapter for storage operations */
  adapter: Adapter;
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
 * function App() {
 *   const adapter = new S3Adapter({ region: 'us-east-1' });
 *
 *   return (
 *     <AdapterProvider adapter={adapter}>
 *       <S3Explorer />
 *     </AdapterProvider>
 *   );
 * }
 * ```
 */
export function AdapterProvider({ children, adapter }: AdapterProviderProps) {
  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo<AdapterContextValue>(
    () => ({
      adapter,
    }),
    [adapter]
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
