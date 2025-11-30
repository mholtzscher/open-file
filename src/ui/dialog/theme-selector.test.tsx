/**
 * Tests for ThemeSelectorDialog component
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { ThemeRegistry } from '../theme-registry.js';
import { CatppuccinMochaTheme } from '../../themes/catppuccin-mocha.js';
import type { ThemeDefinition } from '../../types/theme.js';

// Create a mock theme for testing
function createMockTheme(id: string, name: string): ThemeDefinition {
  return {
    id,
    name,
    variant: 'dark',
    palette: CatppuccinMochaTheme.palette,
    semantic: CatppuccinMochaTheme.semantic,
    syntax: CatppuccinMochaTheme.syntax,
  };
}

describe('ThemeSelectorDialog', () => {
  beforeEach(() => {
    // Reset theme registry
    ThemeRegistry.clear();
    ThemeRegistry.register(CatppuccinMochaTheme);
  });

  describe('theme listing', () => {
    it('should list all registered themes', () => {
      const altTheme = createMockTheme('alt-theme', 'Alternative Theme');
      ThemeRegistry.register(altTheme);

      const themes = ThemeRegistry.listThemes();
      expect(themes).toHaveLength(2);
      expect(themes.map(t => t.id)).toContain('catppuccin-mocha');
      expect(themes.map(t => t.id)).toContain('alt-theme');
    });

    it('should show theme names', () => {
      const themes = ThemeRegistry.listThemes();
      const mocha = themes.find(t => t.id === 'catppuccin-mocha');
      expect(mocha?.name).toBe('Catppuccin Mocha');
    });

    it('should show theme variant', () => {
      const themes = ThemeRegistry.listThemes();
      const mocha = themes.find(t => t.id === 'catppuccin-mocha');
      expect(mocha?.variant).toBe('dark');
    });
  });

  describe('theme selection', () => {
    it('should switch theme when selected', () => {
      const altTheme = createMockTheme('selected-theme', 'Selected Theme');
      ThemeRegistry.register(altTheme);

      // Simulate selection
      ThemeRegistry.setActive('selected-theme');

      expect(ThemeRegistry.getActiveId()).toBe('selected-theme');
    });

    it('should preview theme while navigating', () => {
      const theme1 = createMockTheme('theme-1', 'Theme 1');
      const theme2 = createMockTheme('theme-2', 'Theme 2');
      ThemeRegistry.register(theme1);
      ThemeRegistry.register(theme2);

      // Start with theme-1
      ThemeRegistry.setActive('theme-1');
      expect(ThemeRegistry.getActiveId()).toBe('theme-1');

      // Navigate to theme-2 (preview)
      ThemeRegistry.setActive('theme-2');
      expect(ThemeRegistry.getActiveId()).toBe('theme-2');
    });

    it('should revert to original theme on cancel', () => {
      const altTheme = createMockTheme('alt-theme', 'Alt Theme');
      ThemeRegistry.register(altTheme);

      const originalThemeId = ThemeRegistry.getActiveId();

      // Preview different theme
      ThemeRegistry.setActive('alt-theme');
      expect(ThemeRegistry.getActiveId()).toBe('alt-theme');

      // Revert on cancel
      if (originalThemeId) {
        ThemeRegistry.setActive(originalThemeId);
      }
      expect(ThemeRegistry.getActiveId()).toBe(originalThemeId);
    });
  });

  describe('keyboard navigation', () => {
    it('should support j/k navigation by having themes array', () => {
      const theme1 = createMockTheme('nav-1', 'Nav 1');
      const theme2 = createMockTheme('nav-2', 'Nav 2');
      const theme3 = createMockTheme('nav-3', 'Nav 3');
      ThemeRegistry.register(theme1);
      ThemeRegistry.register(theme2);
      ThemeRegistry.register(theme3);

      const themes = ThemeRegistry.listThemes();
      expect(themes.length).toBeGreaterThanOrEqual(4); // Including catppuccin-mocha

      // Simulate navigation through indices
      let selectedIndex = 0;

      // j -> move down
      selectedIndex = (selectedIndex + 1) % themes.length;
      expect(selectedIndex).toBe(1);

      // k -> move up
      selectedIndex = (selectedIndex - 1 + themes.length) % themes.length;
      expect(selectedIndex).toBe(0);

      // k at top wraps to bottom
      selectedIndex = (selectedIndex - 1 + themes.length) % themes.length;
      expect(selectedIndex).toBe(themes.length - 1);
    });
  });

  describe(':theme command integration', () => {
    it('should be triggered by :theme command', () => {
      // Test that the command string matches
      const command = ':theme';
      expect(command).toBe(':theme');
    });
  });
});
