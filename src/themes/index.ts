/**
 * Theme exports
 *
 * This module exports all available themes and provides
 * initialization functions for the theme system.
 */

export { CatppuccinMochaTheme, CatppuccinMochaPalette } from './catppuccin-mocha.js';

// Re-export theme types for convenience
export type {
  ThemeDefinition,
  ThemePalette,
  ThemeSemanticColors,
  ThemeSyntax,
  SyntaxTokenStyle,
  StatusType,
  DialogBorderType,
  ProviderType,
} from '../types/theme.js';

// Re-export registry and context
export { ThemeRegistry } from '../ui/theme-registry.js';
export {
  ThemeProvider,
  useTheme,
  useThemeContext,
  ThemeContext,
} from '../contexts/ThemeContext.js';

import { CatppuccinMochaTheme } from './catppuccin-mocha.js';
import { ThemeRegistry } from '../ui/theme-registry.js';

/**
 * Initialize the theme system with default themes
 *
 * This should be called once at app startup, before rendering.
 * It registers all built-in themes and sets the default.
 *
 * @param defaultThemeId - Optional theme ID to use as default (defaults to 'catppuccin-mocha')
 */
export function initializeThemes(defaultThemeId: string = 'catppuccin-mocha'): void {
  // Register built-in themes
  if (!ThemeRegistry.has('catppuccin-mocha')) {
    ThemeRegistry.register(CatppuccinMochaTheme);
  }

  // Set the default theme
  if (ThemeRegistry.has(defaultThemeId)) {
    ThemeRegistry.setActive(defaultThemeId);
  }
}
