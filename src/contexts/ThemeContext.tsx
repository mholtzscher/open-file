/**
 * Theme Context - SolidJS context for theme access
 *
 * Provides the current theme to components via context,
 * with automatic re-rendering when the theme changes.
 */

import { createSignal, onMount, onCleanup } from 'solid-js';
import type { ThemeDefinition } from '../types/theme.js';
import { ThemeRegistry } from '../ui/theme-registry.js';
import { createSimpleContext } from './helper.js';

/**
 * Theme context value
 */
interface ThemeContextValue {
  /** The current active theme (call as function in Solid) */
  theme: () => ThemeDefinition;

  /** Set the active theme by ID */
  setTheme: (themeId: string) => void;

  /** List of available theme IDs (call as function in Solid) */
  availableThemes: () => string[];
}

/**
 * Theme provider props
 */
interface ThemeProviderProps {
  /** Optional initial theme ID (defaults to registry's active theme) */
  initialThemeId?: string;
}

/**
 * Theme context created using the SST pattern
 */
const { Provider: ThemeProvider, use: useThemeContext } = createSimpleContext<
  ThemeContextValue,
  ThemeProviderProps
>({
  name: 'Theme',
  init: props => {
    // Initialize theme from registry
    if (props.initialThemeId && ThemeRegistry.has(props.initialThemeId)) {
      ThemeRegistry.setActive(props.initialThemeId);
    }

    const [theme, setThemeState] = createSignal<ThemeDefinition>(ThemeRegistry.getActive());
    const [availableThemes, setAvailableThemes] = createSignal<string[]>(ThemeRegistry.list());

    // Subscribe to theme changes from the registry
    onMount(() => {
      const unsubscribe = ThemeRegistry.subscribe(newTheme => {
        setThemeState(newTheme);
      });

      // Update available themes (in case they changed externally)
      setAvailableThemes(ThemeRegistry.list());

      onCleanup(unsubscribe);
    });

    // Function to change the theme
    const setTheme = (themeId: string) => {
      ThemeRegistry.setActive(themeId);
      // The subscription will update the state
    };

    return {
      theme,
      setTheme,
      availableThemes,
    };
  },
});

/**
 * Hook to access the current theme
 *
 * @returns The current theme definition
 * @throws Error if used outside of ThemeProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const theme = useTheme();
 *   return <text fg={theme().semantic.textPrimary}>Hello</text>;
 * }
 * ```
 */
export function useTheme(): () => ThemeDefinition {
  const context = useThemeContext();
  return context.theme;
}

export { ThemeProvider, useThemeContext };
