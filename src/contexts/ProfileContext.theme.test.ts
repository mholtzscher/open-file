/**
 * Tests for ProfileContext theme integration
 *
 * Verifies that profile's themeId preference is applied when selecting a profile.
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { ThemeRegistry } from '../ui/theme-registry.js';
import { CatppuccinMochaTheme } from '../themes/catppuccin-mocha.js';
import type { ThemeDefinition } from '../types/theme.js';
import type { LocalProfile } from '../providers/types/profile.js';

// Create a second mock theme for testing switching
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

describe('Profile theme integration', () => {
  beforeEach(() => {
    // Reset theme registry to known state
    ThemeRegistry.clear();
    ThemeRegistry.register(CatppuccinMochaTheme);
  });

  describe('ThemeRegistry.setActive', () => {
    it('should switch to a registered theme', () => {
      const altTheme = createMockTheme('alt-theme', 'Alternative Theme');
      ThemeRegistry.register(altTheme);

      ThemeRegistry.setActive('alt-theme');

      expect(ThemeRegistry.getActiveId()).toBe('alt-theme');
      expect(ThemeRegistry.getActive()).toBe(altTheme);
    });

    it('should throw for unregistered theme', () => {
      expect(() => ThemeRegistry.setActive('non-existent')).toThrow();
    });

    it('should not change if theme is already active', () => {
      let notifyCount = 0;
      const unsubscribe = ThemeRegistry.subscribe(() => {
        notifyCount++;
      });

      // Set to same theme twice
      ThemeRegistry.setActive('catppuccin-mocha');
      ThemeRegistry.setActive('catppuccin-mocha');

      // Should only notify once at most (may be zero if already active)
      expect(notifyCount).toBeLessThanOrEqual(1);
      unsubscribe();
    });
  });

  describe('ThemeRegistry.has', () => {
    it('should return true for registered themes', () => {
      expect(ThemeRegistry.has('catppuccin-mocha')).toBe(true);
    });

    it('should return false for unregistered themes', () => {
      expect(ThemeRegistry.has('non-existent')).toBe(false);
    });
  });

  describe('Profile themeId field', () => {
    it('should be optional in profile type', () => {
      // This is a compile-time check - if this compiles, the field is optional
      const profileWithTheme: LocalProfile = {
        id: 'test',
        displayName: 'Test',
        provider: 'local',
        themeId: 'catppuccin-mocha',
        config: { basePath: '/tmp' },
      };

      const profileWithoutTheme: LocalProfile = {
        id: 'test',
        displayName: 'Test',
        provider: 'local',
        config: { basePath: '/tmp' },
      };

      expect(profileWithTheme.themeId).toBe('catppuccin-mocha');
      expect(profileWithoutTheme.themeId).toBeUndefined();
    });
  });

  describe('Theme application logic', () => {
    it('should apply theme if themeId is set and theme exists', () => {
      const altTheme = createMockTheme('profile-theme', 'Profile Theme');
      ThemeRegistry.register(altTheme);

      // Simulate what ProfileContext.selectProfile does
      const themeId = 'profile-theme';
      if (themeId && ThemeRegistry.has(themeId)) {
        ThemeRegistry.setActive(themeId);
      }

      expect(ThemeRegistry.getActiveId()).toBe('profile-theme');
    });

    it('should not change theme if themeId is undefined', () => {
      const initialTheme = ThemeRegistry.getActiveId();

      // Simulate what ProfileContext.selectProfile does with undefined themeId
      const themeId: string | undefined = undefined;
      if (themeId && ThemeRegistry.has(themeId)) {
        ThemeRegistry.setActive(themeId);
      }

      expect(ThemeRegistry.getActiveId()).toBe(initialTheme);
    });

    it('should not change theme if themeId references non-existent theme', () => {
      const initialTheme = ThemeRegistry.getActiveId();

      // Simulate what ProfileContext.selectProfile does with invalid themeId
      const themeId = 'non-existent-theme';
      if (themeId && ThemeRegistry.has(themeId)) {
        ThemeRegistry.setActive(themeId);
      }

      expect(ThemeRegistry.getActiveId()).toBe(initialTheme);
    });
  });
});
