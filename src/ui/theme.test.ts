/**
 * Tests for theme and syntax highlighting
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { Theme, CatppuccinMocha } from './theme.js';
import { ThemeRegistry } from './theme-registry.js';
import { CatppuccinMochaTheme } from '../themes/catppuccin-mocha.js';

beforeEach(() => {
  ThemeRegistry.clear();
  ThemeRegistry.register(CatppuccinMochaTheme);
});

describe('Theme', () => {
  describe('Directory colors', () => {
    it('should return blue for unselected directories', () => {
      const color = Theme.getDirectoryColor(false);
      expect(color).toBe(CatppuccinMocha.blue);
    });

    it('should return sapphire for selected directories', () => {
      const color = Theme.getDirectoryColor(true);
      expect(color).toBe(CatppuccinMocha.sapphire);
    });
  });

  describe('File colors', () => {
    it('should return text color for unselected files', () => {
      const color = Theme.getFileColor(false);
      expect(color).toBe(CatppuccinMocha.text);
    });

    it('should return lavender for selected files', () => {
      const color = Theme.getFileColor(true);
      expect(color).toBe(CatppuccinMocha.lavender);
    });
  });

  describe('Directory styles', () => {
    it('should have bold enabled for directories', () => {
      const style = Theme.getDirectoryStyle(false);
      expect(style.bold).toBe(true);
    });

    it('should use blue color for unselected directories', () => {
      const style = Theme.getDirectoryStyle(false);
      expect(style.fg).toBe(CatppuccinMocha.blue);
    });

    it('should use sapphire color for selected directories', () => {
      const style = Theme.getDirectoryStyle(true);
      expect(style.fg).toBe(CatppuccinMocha.sapphire);
    });
  });

  describe('File styles', () => {
    it('should not have bold enabled for files', () => {
      const style = Theme.getFileStyle(false);
      expect(style.bold).toBeUndefined();
    });

    it('should use text color for unselected files', () => {
      const style = Theme.getFileStyle(false);
      expect(style.fg).toBe(CatppuccinMocha.text);
    });

    it('should use lavender for selected files', () => {
      const style = Theme.getFileStyle(true);
      expect(style.fg).toBe(CatppuccinMocha.lavender);
    });
  });

  describe('Entry styles', () => {
    it('should apply directory style', () => {
      const style = Theme.getEntryStyle('directory', false, false);
      expect(style.bold).toBe(true);
      expect(style.fg).toBe(CatppuccinMocha.blue);
    });

    it('should apply file style', () => {
      const style = Theme.getEntryStyle('file', false, false);
      expect(style.bold).toBeUndefined();
      expect(style.fg).toBe(CatppuccinMocha.text);
    });

    it('should add background for visual selection', () => {
      const style = Theme.getEntryStyle('file', false, true);
      expect(style.bg).toBe(CatppuccinMocha.surface1);
    });

    it('should apply selection color when selected', () => {
      const style = Theme.getEntryStyle('directory', true, false);
      expect(style.fg).toBe(CatppuccinMocha.sapphire);
    });

    it('should combine selection and visual selection', () => {
      const style = Theme.getEntryStyle('file', true, true);
      expect(style.fg).toBe(CatppuccinMocha.lavender);
      expect(style.bg).toBe(CatppuccinMocha.surface1);
    });
  });

  describe('Mode colors', () => {
    it('should return green for normal mode', () => {
      expect(Theme.getNormalModeColor()).toBe(CatppuccinMocha.green);
    });

    it('should return peach for insert mode', () => {
      expect(Theme.getInsertModeColor()).toBe(CatppuccinMocha.peach);
    });

    it('should return mauve for visual mode', () => {
      expect(Theme.getVisualModeColor()).toBe(CatppuccinMocha.mauve);
    });
  });

  describe('Background colors', () => {
    it('should return surface0 for cursor line', () => {
      expect(Theme.getCursorLineBackground()).toBe(CatppuccinMocha.surface0);
    });

    it('should return surface1 for visual selection', () => {
      expect(Theme.getVisualSelectionBackground()).toBe(CatppuccinMocha.surface1);
    });
  });

  describe('Message colors', () => {
    it('should return green for success', () => {
      expect(Theme.getSuccessColor()).toBe(CatppuccinMocha.green);
    });

    it('should return red for error', () => {
      expect(Theme.getErrorColor()).toBe(CatppuccinMocha.red);
    });

    it('should return sapphire for info', () => {
      expect(Theme.getInfoColor()).toBe(CatppuccinMocha.sapphire);
    });
  });
});
