/**
 * Theme exports
 *
 * This module exports all available themes and provides
 * initialization functions for the theme system.
 */

export { CatppuccinMochaTheme, CatppuccinMochaPalette } from './catppuccin-mocha.js';
export { CatppuccinLatteTheme } from './catppuccin-latte.js';
export { CatppuccinFrappeTheme } from './catppuccin-frappe.js';
export { CatppuccinMacchiatoTheme } from './catppuccin-macchiato.js';
export { TokyoNightTheme } from './tokyo-night.js';

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
export { ThemeProvider, useTheme, useThemeContext } from '../contexts/ThemeContext.js';

import { CatppuccinMochaTheme } from './catppuccin-mocha.js';
import { CatppuccinLatteTheme } from './catppuccin-latte.js';
import { CatppuccinFrappeTheme } from './catppuccin-frappe.js';
import { CatppuccinMacchiatoTheme } from './catppuccin-macchiato.js';
import { TokyoNightTheme } from './tokyo-night.js';
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
  if (!ThemeRegistry.has('catppuccin-latte')) {
    ThemeRegistry.register(CatppuccinLatteTheme);
  }
  if (!ThemeRegistry.has('catppuccin-frappe')) {
    ThemeRegistry.register(CatppuccinFrappeTheme);
  }
  if (!ThemeRegistry.has('catppuccin-macchiato')) {
    ThemeRegistry.register(CatppuccinMacchiatoTheme);
  }
  if (!ThemeRegistry.has('tokyo-night')) {
    ThemeRegistry.register(TokyoNightTheme);
  }

  // Set the default theme
  if (ThemeRegistry.has(defaultThemeId)) {
    ThemeRegistry.setActive(defaultThemeId);
  }
}
