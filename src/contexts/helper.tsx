/**
 * Context Helper Utilities
 *
 * Provides factory functions for creating SolidJS contexts following the SST/OpenCode pattern.
 * This enables consistent context creation with automatic ready-gating and typed access.
 */

import { createContext, useContext, Show, type ParentProps, type JSX } from 'solid-js';

/**
 * Configuration for creating a simple context
 */
export interface SimpleContextConfig<T, Props extends object = object> {
  /** Name of the context (used for error messages) */
  name: string;
  /** Initialization function that creates the context value */
  init: (props: Props) => T & { ready?: boolean };
}

/**
 * Return type from createSimpleContext
 */
export interface SimpleContextResult<T, Props extends object = object> {
  /** Provider component that wraps children with the context */
  Provider: (props: ParentProps<Props>) => JSX.Element;
  /** Hook to access the context value (throws if used outside provider) */
  use: () => T;
}

/**
 * Creates a typed context with provider and hook following the SST/OpenCode pattern.
 *
 * Features:
 * - Automatic ready-gating: Children only render when `ready` is true (or undefined)
 * - Type-safe context access via the `use` hook
 * - Clear error messages when used outside provider
 *
 * @example
 * ```typescript
 * const { Provider: ThemeProvider, use: useTheme } = createSimpleContext({
 *   name: "Theme",
 *   init: (props: { defaultTheme: string }) => {
 *     const [theme, setTheme] = createSignal(props.defaultTheme);
 *     return { theme, setTheme };
 *   },
 * });
 *
 * // Usage:
 * <ThemeProvider defaultTheme="dark">
 *   <App />
 * </ThemeProvider>
 *
 * // In a component:
 * const { theme, setTheme } = useTheme();
 * ```
 */
export function createSimpleContext<T, Props extends object = object>(
  config: SimpleContextConfig<T, Props>
): SimpleContextResult<T, Props> {
  const ctx = createContext<T>();

  return {
    Provider: (props: ParentProps<Props>) => {
      const init = config.init(props);

      // Extract ready state (default to true if not provided)
      const isReady = () => (init as { ready?: boolean }).ready !== false;

      return (
        <Show when={isReady()}>
          <ctx.Provider value={init}>{props.children}</ctx.Provider>
        </Show>
      );
    },

    use: () => {
      const value = useContext(ctx);
      if (value === undefined) {
        throw new Error(`${config.name} context must be used within its Provider`);
      }
      return value;
    },
  };
}

/**
 * Immediately-invoked function expression helper for scoped initialization.
 * Useful for creating module-like scopes within context init functions.
 *
 * @example
 * ```typescript
 * const model = iife(() => {
 *   const [store, setStore] = createStore({ ... });
 *   return {
 *     get current() { return store.value },
 *     set(value) { setStore('value', value) },
 *   };
 * });
 * ```
 */
export const iife = <T,>(fn: () => T): T => fn();
