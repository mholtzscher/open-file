/**
 * Theme utilities and backward compatibility layer
 *
 * This module provides the Theme class for UI components and maintains
 * backward compatibility with direct CatppuccinMocha references.
 *
 * For new code, prefer using:
 * - useTheme() hook in React components
 * - ThemeRegistry.getActive() for non-React code
 * - Theme.semantic.* for semantic colors
 */

import { ThemeRegistry } from './theme-registry.js';
import { CatppuccinMochaTheme } from '../themes/catppuccin-mocha.js';
import type {
  ThemeDefinition,
  StatusType,
  DialogBorderType,
  ProviderType,
} from '../types/theme.js';

// Ensure the default theme is registered
if (!ThemeRegistry.has('catppuccin-mocha')) {
  ThemeRegistry.register(CatppuccinMochaTheme);
}

/**
 * Catppuccin Mocha color palette
 *
 * @deprecated Use Theme.palette, Theme.semantic, or useTheme() instead.
 * Direct palette access will be removed in a future version.
 *
 * For semantic colors, use:
 * - Theme.getSuccessColor() instead of CatppuccinMocha.green
 * - Theme.getErrorColor() instead of CatppuccinMocha.red
 * - etc.
 */
export const CatppuccinMocha = {
  // Base colors
  base: '#1e1e2e',
  mantle: '#181825',
  crust: '#11111b',

  // Surface colors
  surface0: '#313244',
  surface1: '#45475a',
  surface2: '#585b70',

  // Main accent colors
  lavender: '#b4befe',
  blue: '#89b4fa',
  sapphire: '#74c7ec',
  sky: '#89dceb',
  teal: '#94e2d5',
  green: '#a6e3a1',
  yellow: '#f9e2af',
  peach: '#fab387',
  maroon: '#eba0ac',
  red: '#f38ba8',
  mauve: '#cba6f7',
  pink: '#f5c2e7',
  flamingo: '#f2cdcd',
  rosewater: '#f5e0dc',

  // Text colors
  text: '#cdd6f4',
  subtext1: '#bac2de',
  subtext0: '#a6adc8',
  overlay2: '#9399b2',
  overlay1: '#7f849c',
  overlay0: '#6c7086',
} as const;

/**
 * Text style configuration
 */
export interface TextStyle {
  fg?: string;
  bg?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  dim?: boolean;
}

/**
 * Get the currently active theme
 *
 * @returns The active ThemeDefinition
 */
function getTheme(): ThemeDefinition {
  return ThemeRegistry.getActive();
}

/**
 * Theme utilities for UI components
 *
 * All methods delegate to the active theme from ThemeRegistry,
 * allowing themes to be switched at runtime.
 */
export class Theme {
  /**
   * Get the current theme's palette (raw colors)
   */
  static get palette() {
    return getTheme().palette;
  }

  /**
   * Get the current theme's semantic colors
   */
  static get semantic() {
    return getTheme().semantic;
  }

  /**
   * Get the current theme's syntax highlighting colors
   */
  static get syntax() {
    return getTheme().syntax;
  }

  /**
   * Get the full theme definition
   */
  static get current(): ThemeDefinition {
    return getTheme();
  }

  // ============================================================
  // Entry colors (files and directories)
  // ============================================================

  /**
   * Get color for directory entries
   */
  static getDirectoryColor(isSelected: boolean): string {
    const theme = getTheme();
    return isSelected ? theme.semantic.directorySelected : theme.semantic.directory;
  }

  /**
   * Get style for directory entries
   */
  static getDirectoryStyle(isSelected: boolean): TextStyle {
    return {
      fg: Theme.getDirectoryColor(isSelected),
      bold: true,
    };
  }

  /**
   * Get color for file entries
   */
  static getFileColor(isSelected: boolean): string {
    const theme = getTheme();
    return isSelected ? theme.semantic.fileSelected : theme.semantic.file;
  }

  /**
   * Get style for file entries
   */
  static getFileStyle(isSelected: boolean): TextStyle {
    return {
      fg: Theme.getFileColor(isSelected),
    };
  }

  /**
   * Get style for entry based on type and selection state
   */
  static getEntryStyle(
    type: 'file' | 'directory',
    isSelected: boolean,
    isInVisualSelection: boolean
  ): TextStyle {
    const baseStyle =
      type === 'directory' ? Theme.getDirectoryStyle(isSelected) : Theme.getFileStyle(isSelected);

    if (isInVisualSelection) {
      return {
        ...baseStyle,
        bg: Theme.getVisualSelectionBackground(),
      };
    }

    return baseStyle;
  }

  // ============================================================
  // Mode colors (vim-style modes)
  // ============================================================

  /**
   * Get color for mode indicator - Normal
   */
  static getNormalModeColor(): string {
    return getTheme().semantic.modeNormal;
  }

  /**
   * Get color for mode indicator - Insert
   */
  static getInsertModeColor(): string {
    return getTheme().semantic.modeInsert;
  }

  /**
   * Get color for mode indicator - Visual
   */
  static getVisualModeColor(): string {
    return getTheme().semantic.modeVisual;
  }

  /**
   * Get color for mode indicator - Search
   */
  static getSearchModeColor(): string {
    return getTheme().semantic.modeSearch;
  }

  /**
   * Get color for edit mode
   */
  static getEditModeColor(): string {
    return getTheme().semantic.modeEdit;
  }

  /**
   * Get foreground color for edit mode indicator
   */
  static getEditModeFgColor(): string {
    return getTheme().semantic.cursor;
  }

  // ============================================================
  // Status colors
  // ============================================================

  /**
   * Get success message color
   */
  static getSuccessColor(): string {
    return getTheme().semantic.success;
  }

  /**
   * Get error message color
   */
  static getErrorColor(): string {
    return getTheme().semantic.error;
  }

  /**
   * Get warning message color
   */
  static getWarningColor(): string {
    return getTheme().semantic.warning;
  }

  /**
   * Get info message color
   */
  static getInfoColor(): string {
    return getTheme().semantic.info;
  }

  /**
   * Get color for a status type
   */
  static getStatusColor(status: StatusType): string {
    const theme = getTheme();
    const statusColors: Record<StatusType, string> = {
      success: theme.semantic.success,
      error: theme.semantic.error,
      warning: theme.semantic.warning,
      info: theme.semantic.info,
      normal: theme.semantic.textPrimary,
    };
    return statusColors[status];
  }

  // ============================================================
  // Text colors
  // ============================================================

  /**
   * Get primary text color
   */
  static getTextColor(): string {
    return getTheme().semantic.textPrimary;
  }

  /**
   * Get secondary/muted text color
   */
  static getMutedColor(): string {
    return getTheme().semantic.textMuted;
  }

  /**
   * Get dim/disabled text color
   */
  static getDimColor(): string {
    return getTheme().semantic.textDisabled;
  }

  /**
   * Get color for empty state indicator
   */
  static getEmptyStateColor(): string {
    return getTheme().semantic.textDisabled;
  }

  // ============================================================
  // Selection and cursor colors
  // ============================================================

  /**
   * Get color for selection indicator
   */
  static getSelectionColor(): string {
    return getTheme().semantic.success;
  }

  /**
   * Get color for cursor position
   */
  static getCursorColor(): string {
    return getTheme().semantic.cursor;
  }

  /**
   * Get background color for cursor line
   */
  static getCursorLineBackground(): string {
    return getTheme().semantic.cursorLine;
  }

  /**
   * Get background color for visual selection
   */
  static getVisualSelectionBackground(): string {
    return getTheme().semantic.visualSelection;
  }

  // ============================================================
  // Accent colors
  // ============================================================

  /**
   * Get highlighted/accent color
   */
  static getAccentColor(): string {
    return getTheme().semantic.accent;
  }

  // ============================================================
  // Dialog colors
  // ============================================================

  /**
   * Get dialog border color by type
   */
  static getDialogBorderColor(type: DialogBorderType): string {
    const theme = getTheme();
    const borderColors: Record<DialogBorderType, string> = {
      neutral: theme.semantic.dialogBorderNeutral,
      warning: theme.semantic.dialogBorderWarning,
      error: theme.semantic.dialogBorderError,
      info: theme.semantic.dialogBorderInfo,
      success: theme.semantic.dialogBorderSuccess,
    };
    return borderColors[type];
  }

  // ============================================================
  // Background colors
  // ============================================================

  /**
   * Get base background color
   */
  static getBgBase(): string {
    return getTheme().semantic.bgBase;
  }

  /**
   * Get surface background color
   */
  static getBgSurface(): string {
    return getTheme().semantic.bgSurface;
  }

  /**
   * Get highlight background color
   */
  static getBgHighlight(): string {
    return getTheme().semantic.bgHighlight;
  }

  // ============================================================
  // Provider colors
  // ============================================================

  /**
   * Get color for provider type
   */
  static getProviderColor(providerType: string): string {
    const theme = getTheme();
    const colors: Record<string, string> = {
      s3: theme.semantic.providerS3,
      gcs: theme.semantic.providerGcs,
      sftp: theme.semantic.providerSftp,
      ftp: theme.semantic.providerFtp,
      nfs: theme.semantic.providerNfs,
      smb: theme.semantic.providerSmb,
      gdrive: theme.semantic.providerGdrive,
      local: theme.semantic.providerLocal,
    };

    return colors[providerType] || theme.semantic.textPrimary;
  }

  /**
   * Get color for a specific provider type (type-safe version)
   */
  static getProviderColorByType(providerType: ProviderType): string {
    const theme = getTheme();
    const colors: Record<ProviderType, string> = {
      s3: theme.semantic.providerS3,
      gcs: theme.semantic.providerGcs,
      sftp: theme.semantic.providerSftp,
      ftp: theme.semantic.providerFtp,
      nfs: theme.semantic.providerNfs,
      smb: theme.semantic.providerSmb,
      gdrive: theme.semantic.providerGdrive,
      local: theme.semantic.providerLocal,
    };
    return colors[providerType];
  }
}
