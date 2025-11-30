/**
 * Tests for ThemeRegistry
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { ThemeRegistry } from './theme-registry.js';
import type { ThemeDefinition } from '../types/theme.js';
import { CatppuccinMochaTheme } from '../themes/catppuccin-mocha.js';

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

describe('ThemeRegistry', () => {
  beforeEach(() => {
    // Clear and reset to default state
    ThemeRegistry.clear();
    ThemeRegistry.register(CatppuccinMochaTheme);
  });

  describe('register', () => {
    it('should register a new theme', () => {
      const mockTheme = createMockTheme('test-theme', 'Test Theme');
      ThemeRegistry.register(mockTheme);

      expect(ThemeRegistry.has('test-theme')).toBe(true);
      expect(ThemeRegistry.get('test-theme')).toBe(mockTheme);
    });

    it('should throw when registering duplicate theme ID', () => {
      const mockTheme1 = createMockTheme('duplicate', 'Theme 1');
      const mockTheme2 = createMockTheme('duplicate', 'Theme 2');

      ThemeRegistry.register(mockTheme1);
      expect(() => ThemeRegistry.register(mockTheme2)).toThrow();
    });

    it('should set first registered theme as active', () => {
      ThemeRegistry.clear();
      const mockTheme = createMockTheme('first', 'First Theme');
      ThemeRegistry.register(mockTheme);

      expect(ThemeRegistry.getActiveId()).toBe('first');
      expect(ThemeRegistry.getActive()).toBe(mockTheme);
    });
  });

  describe('get', () => {
    it('should return theme by ID', () => {
      expect(ThemeRegistry.get('catppuccin-mocha')).toBe(CatppuccinMochaTheme);
    });

    it('should return undefined for non-existent theme', () => {
      expect(ThemeRegistry.get('non-existent')).toBeUndefined();
    });
  });

  describe('setActive', () => {
    it('should set active theme', () => {
      const mockTheme = createMockTheme('new-active', 'New Active');
      ThemeRegistry.register(mockTheme);
      ThemeRegistry.setActive('new-active');

      expect(ThemeRegistry.getActiveId()).toBe('new-active');
      expect(ThemeRegistry.getActive()).toBe(mockTheme);
    });

    it('should throw when setting non-existent theme as active', () => {
      expect(() => ThemeRegistry.setActive('non-existent')).toThrow();
    });

    it('should not notify if theme is already active', () => {
      let callCount = 0;
      const unsubscribe = ThemeRegistry.subscribe(() => {
        callCount++;
      });

      ThemeRegistry.setActive('catppuccin-mocha');
      ThemeRegistry.setActive('catppuccin-mocha');

      // Should only notify once (or zero times if already active)
      expect(callCount).toBeLessThanOrEqual(1);
      unsubscribe();
    });
  });

  describe('getActive', () => {
    it('should return active theme', () => {
      expect(ThemeRegistry.getActive()).toBe(CatppuccinMochaTheme);
    });

    it('should throw when no themes registered', () => {
      ThemeRegistry.clear();
      expect(() => ThemeRegistry.getActive()).toThrow();
    });
  });

  describe('has', () => {
    it('should return true for registered theme', () => {
      expect(ThemeRegistry.has('catppuccin-mocha')).toBe(true);
    });

    it('should return false for non-existent theme', () => {
      expect(ThemeRegistry.has('non-existent')).toBe(false);
    });
  });

  describe('list', () => {
    it('should return array of theme IDs', () => {
      const ids = ThemeRegistry.list();
      expect(ids).toContain('catppuccin-mocha');
    });

    it('should include newly registered themes', () => {
      const mockTheme = createMockTheme('listed-theme', 'Listed Theme');
      ThemeRegistry.register(mockTheme);

      const ids = ThemeRegistry.list();
      expect(ids).toContain('listed-theme');
    });
  });

  describe('listThemes', () => {
    it('should return theme metadata', () => {
      const themes = ThemeRegistry.listThemes();
      const mocha = themes.find(t => t.id === 'catppuccin-mocha');

      expect(mocha).toBeDefined();
      expect(mocha?.name).toBe('Catppuccin Mocha');
      expect(mocha?.variant).toBe('dark');
    });
  });

  describe('subscribe', () => {
    it('should notify on theme change', () => {
      const mockTheme = createMockTheme('notify-test', 'Notify Test');
      ThemeRegistry.register(mockTheme);

      let notifiedThemeId = '';
      const unsubscribe = ThemeRegistry.subscribe(theme => {
        notifiedThemeId = theme.id;
      });

      ThemeRegistry.setActive('notify-test');

      expect(notifiedThemeId).toBe('notify-test');
      unsubscribe();
    });

    it('should allow unsubscribe', () => {
      const mockTheme = createMockTheme('unsub-test', 'Unsub Test');
      ThemeRegistry.register(mockTheme);

      let callCount = 0;
      const unsubscribe = ThemeRegistry.subscribe(() => {
        callCount++;
      });

      ThemeRegistry.setActive('unsub-test');
      expect(callCount).toBe(1);

      unsubscribe();

      // Register another theme and switch to it
      const anotherTheme = createMockTheme('another', 'Another');
      ThemeRegistry.register(anotherTheme);
      ThemeRegistry.setActive('another');

      // Should not have been called again
      expect(callCount).toBe(1);
    });
  });

  describe('unregister', () => {
    it('should remove theme from registry', () => {
      const mockTheme = createMockTheme('removable', 'Removable');
      ThemeRegistry.register(mockTheme);
      expect(ThemeRegistry.has('removable')).toBe(true);

      ThemeRegistry.unregister('removable');
      expect(ThemeRegistry.has('removable')).toBe(false);
    });

    it('should return true when theme was removed', () => {
      const mockTheme = createMockTheme('removable2', 'Removable 2');
      ThemeRegistry.register(mockTheme);

      expect(ThemeRegistry.unregister('removable2')).toBe(true);
    });

    it('should return false when theme did not exist', () => {
      expect(ThemeRegistry.unregister('non-existent')).toBe(false);
    });

    it('should switch to another theme when active theme is removed', () => {
      const mockTheme = createMockTheme('will-remove', 'Will Remove');
      ThemeRegistry.register(mockTheme);
      ThemeRegistry.setActive('will-remove');

      ThemeRegistry.unregister('will-remove');

      // Should fall back to catppuccin-mocha
      expect(ThemeRegistry.getActiveId()).toBe('catppuccin-mocha');
    });
  });

  describe('clear', () => {
    it('should remove all themes', () => {
      ThemeRegistry.clear();

      expect(ThemeRegistry.list()).toHaveLength(0);
      expect(ThemeRegistry.getActiveId()).toBeNull();
    });
  });
});
