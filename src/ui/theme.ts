/**
 * Catppuccin Mocha Theme
 * 
 * A warm, fluffy dark theme based on Catppuccin's Mocha variant.
 * https://github.com/catppuccin/catppuccin
 */

/**
 * Catppuccin Mocha color palette
 * All colors are in hexadecimal format
 */
export const CatppuccinMocha = {
  // Base colors
  base: '#1e1e2e',      // Dark base
  mantle: '#181825',    // Darker mantle
  crust: '#11111b',     // Darkest crust
  
  // Surface colors
  surface0: '#313244',  // Subtle backgrounds
  surface1: '#45475a',  // Default surface
  surface2: '#585b70',  // Hover/focus state
  
  // Main accent colors
  lavender: '#b4befe',  // Primary accent - bright lavender
  blue: '#89b4fa',      // Soft blue
  sapphire: '#74c7ec',  // Bright cyan-blue
  sky: '#89dceb',       // Sky cyan
  teal: '#94e2d5',      // Teal
  green: '#a6e3a1',     // Green
  yellow: '#f9e2af',    // Mellow yellow
  peach: '#fab387',     // Warm peach
  maroon: '#eba0ac',    // Deep rose
  red: '#f38ba8',       // Red
  mauve: '#cba6f7',     // Purple
  pink: '#f5c2e7',      // Pink
  flamingo: '#f2cdcd',  // Light red
  rosewater: '#f5e0dc', // Light rose
  
  // Text colors
  text: '#cdd6f4',      // Primary text - light lavender
  subtext1: '#bac2de',  // Secondary text
  subtext0: '#a6adc8',  // Tertiary text
  overlay2: '#9399b2',  // Overlay text
  overlay1: '#7f849c',  // More subtle overlay
  overlay0: '#6c7086',  // Subtle text
} as const;

/**
 * Theme utilities for UI components
 */
export class Theme {
  /**
   * Get color for directory entries
   */
  static getDirectoryColor(isSelected: boolean): string {
    return isSelected ? CatppuccinMocha.sapphire : CatppuccinMocha.blue;
  }

  /**
   * Get color for file entries
   */
  static getFileColor(isSelected: boolean): string {
    return isSelected ? CatppuccinMocha.lavender : CatppuccinMocha.text;
  }

  /**
   * Get color for edit mode
   */
  static getEditModeColor(): string {
    return CatppuccinMocha.peach;
  }

  /**
   * Get color for selection
   */
  static getSelectionColor(): string {
    return CatppuccinMocha.green;
  }

  /**
   * Get color for cursor position
   */
  static getCursorColor(): string {
    return CatppuccinMocha.yellow;
  }

  /**
   * Get color for mode indicator - Normal
   */
  static getNormalModeColor(): string {
    return CatppuccinMocha.green;
  }

  /**
   * Get color for mode indicator - Insert
   */
  static getInsertModeColor(): string {
    return CatppuccinMocha.peach;
  }

  /**
   * Get color for mode indicator - Visual
   */
  static getVisualModeColor(): string {
    return CatppuccinMocha.mauve;
  }

  /**
   * Get color for mode indicator - Search
   */
  static getSearchModeColor(): string {
    return CatppuccinMocha.sapphire;
  }

  /**
   * Get color for mode indicator - Edit
   */
  static getEditModeFgColor(): string {
    return CatppuccinMocha.yellow;
  }

  /**
   * Get success message color
   */
  static getSuccessColor(): string {
    return CatppuccinMocha.green;
  }

  /**
   * Get error message color
   */
  static getErrorColor(): string {
    return CatppuccinMocha.red;
  }

  /**
   * Get info message color
   */
  static getInfoColor(): string {
    return CatppuccinMocha.sapphire;
  }

  /**
   * Get secondary/muted text color
   */
  static getMutedColor(): string {
    return CatppuccinMocha.overlay2;
  }

  /**
   * Get dim/disabled text color
   */
  static getDimColor(): string {
    return CatppuccinMocha.overlay0;
  }

  /**
   * Get highlighted/accent color
   */
  static getAccentColor(): string {
    return CatppuccinMocha.flamingo;
  }
}
