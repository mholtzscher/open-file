/**
 * BufferContext - Provides buffer state to the component tree
 *
 * This context eliminates prop drilling of the large bufferState object
 * through multiple component layers.
 */

import { createContext, useContext, ReactNode } from 'react';
import { UseBufferStateReturn } from '../hooks/useBufferState.js';

const BufferContext = createContext<UseBufferStateReturn | null>(null);

export interface BufferProviderProps {
  children: ReactNode;
  /** The buffer state to provide - created by useBufferState() in the parent */
  value: UseBufferStateReturn;
}

/**
 * Provider component that wraps children with buffer state
 *
 * The buffer state should be created by the parent using useBufferState(),
 * then passed here to make it available to the component tree via useBuffer().
 */
export function BufferProvider({ children, value }: BufferProviderProps) {
  return <BufferContext.Provider value={value}>{children}</BufferContext.Provider>;
}

/**
 * Hook to access buffer state - throws if used outside BufferProvider
 */
export function useBuffer(): UseBufferStateReturn {
  const context = useContext(BufferContext);
  if (!context) {
    throw new Error('useBuffer must be used within a BufferProvider');
  }
  return context;
}

/**
 * Hook to optionally access buffer state - returns null if outside provider
 */
export function useOptionalBuffer(): UseBufferStateReturn | null {
  return useContext(BufferContext);
}
