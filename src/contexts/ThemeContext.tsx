/**
 * Theme Context - React context for theme access
 *
 * Provides the current theme to React components via context,
 * with automatic re-rendering when the theme changes.
 */

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { ThemeDefinition } from '../types/theme.js';
import { ThemeRegistry } from '../ui/theme-registry.js';

/**
 * Theme context value
 */
interface ThemeContextValue {
  /** The current active theme */
  theme: ThemeDefinition;

  /** Set the active theme by ID */
  setTheme: (themeId: string) => void;

  /** List of available theme IDs */
  availableThemes: string[];
}

/**
 * Theme context
 *
 * Provides theme access to React components. Must be used within ThemeProvider.
 */
const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Theme provider props
 */
interface ThemeProviderProps {
  /** Child components */
  children: ReactNode;

  /** Optional initial theme ID (defaults to registry's active theme) */
  initialThemeId?: string;
}

/**
 * Theme Provider component
 *
 * Wraps the app to provide theme context. Automatically syncs with ThemeRegistry
 * and re-renders children when the theme changes.
 *
 * @example
 * ```tsx
 * <ThemeProvider>
 *   <App />
 * </ThemeProvider>
 * ```
 */
export function ThemeProvider({ children, initialThemeId }: ThemeProviderProps) {
  // Initialize theme from registry
  const [theme, setThemeState] = useState<ThemeDefinition>(() => {
    if (initialThemeId && ThemeRegistry.has(initialThemeId)) {
      ThemeRegistry.setActive(initialThemeId);
    }
    return ThemeRegistry.getActive();
  });

  const [availableThemes, setAvailableThemes] = useState<string[]>(() => ThemeRegistry.list());

  // Subscribe to theme changes from the registry
  useEffect(() => {
    const unsubscribe = ThemeRegistry.subscribe(newTheme => {
      setThemeState(newTheme);
    });

    // Update available themes (in case they changed externally)
    setAvailableThemes(ThemeRegistry.list());

    return unsubscribe;
  }, []);

  // Function to change the theme
  const setTheme = (themeId: string) => {
    ThemeRegistry.setActive(themeId);
    // The subscription will update the state
  };

  const value: ThemeContextValue = {
    theme,
    setTheme,
    availableThemes,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

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
 *   return <text fg={theme.semantic.textPrimary}>Hello</text>;
 * }
 * ```
 */
export function useTheme(): ThemeDefinition {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context.theme;
}

/**
 * Hook to access the full theme context including setTheme
 *
 * @returns Theme context with theme, setTheme, and availableThemes
 * @throws Error if used outside of ThemeProvider
 *
 * @example
 * ```tsx
 * function ThemeSwitcher() {
 *   const { theme, setTheme, availableThemes } = useThemeContext();
 *   return (
 *     <select onChange={(e) => setTheme(e.target.value)}>
 *       {availableThemes.map(id => <option key={id}>{id}</option>)}
 *     </select>
 *   );
 * }
 * ```
 */
export function useThemeContext(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
}

// Export the context for advanced use cases
export { ThemeContext };
