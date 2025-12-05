/**
 * Catppuccin Mocha Theme
 *
 * A warm, fluffy dark theme based on Catppuccin's Mocha variant.
 * https://github.com/catppuccin/catppuccin
 *
 * This is the default theme for the application.
 */

import type {
  ThemeDefinition,
  ThemePalette,
  ThemeSemanticColors,
  ThemeSyntax,
} from '../types/theme.js';

/**
 * Catppuccin Mocha color palette
 */
const palette: ThemePalette = {
  // Base colors
  base: '#1e1e2e',
  mantle: '#181825',
  crust: '#11111b',

  // Surface colors
  surface0: '#313244',
  surface1: '#45475a',
  surface2: '#585b70',

  // Text colors
  text: '#cdd6f4',
  subtext1: '#bac2de',
  subtext0: '#a6adc8',
  overlay2: '#9399b2',
  overlay1: '#7f849c',
  overlay0: '#6c7086',

  // Accent colors
  red: '#f38ba8',
  maroon: '#eba0ac',
  peach: '#fab387',
  yellow: '#f9e2af',
  green: '#a6e3a1',
  teal: '#94e2d5',
  sky: '#89dceb',
  sapphire: '#74c7ec',
  blue: '#89b4fa',
  lavender: '#b4befe',
  mauve: '#cba6f7',
  pink: '#f5c2e7',
  flamingo: '#f2cdcd',
  rosewater: '#f5e0dc',
};

/**
 * Semantic colors mapped from palette
 */
const semantic: ThemeSemanticColors = {
  // Text hierarchy
  textPrimary: palette.text,
  textSecondary: palette.subtext1,
  textMuted: palette.overlay2,
  textDisabled: palette.overlay0,

  // Backgrounds
  bgBase: palette.base,
  bgSurface: palette.surface0,
  bgHighlight: palette.surface1,
  bgSelection: palette.surface1,

  // Status colors
  success: palette.green,
  error: palette.red,
  warning: palette.yellow,
  info: palette.sapphire,

  // File browser entries
  directory: palette.blue,
  directorySelected: palette.sapphire,
  file: palette.text,
  fileSelected: palette.lavender,

  // Editor modes
  modeNormal: palette.green,
  modeInsert: palette.peach,
  modeVisual: palette.mauve,
  modeSearch: palette.sapphire,
  modeEdit: palette.peach,

  // Cursor and selection
  cursor: palette.yellow,
  cursorLine: palette.surface0,
  visualSelection: palette.surface1,

  // Dialog borders
  dialogBorderNeutral: palette.blue,
  dialogBorderWarning: palette.yellow,
  dialogBorderError: palette.red,
  dialogBorderInfo: palette.sapphire,
  dialogBorderSuccess: palette.green,

  // Accents
  accent: palette.flamingo,
  accentSecondary: palette.lavender,

  // Provider-specific colors
  providerS3: palette.yellow,
  providerGcs: palette.blue,
  providerSftp: palette.green,
  providerFtp: palette.peach,
  providerLocal: palette.lavender,
  providerSmb: palette.mauve,
  providerGdrive: palette.red,
};

/**
 * Syntax highlighting theme
 */
const syntax: ThemeSyntax = {
  // Keywords
  keyword: { fg: palette.mauve, bold: true },
  'keyword.control': { fg: palette.mauve, bold: true },
  'keyword.function': { fg: palette.mauve, bold: true },
  'keyword.return': { fg: palette.mauve, bold: true },
  'keyword.operator': { fg: palette.sky },

  // Functions
  function: { fg: palette.blue },
  'function.call': { fg: palette.blue },
  'function.method': { fg: palette.blue },
  'function.builtin': { fg: palette.yellow },
  method: { fg: palette.blue },

  // Variables
  variable: { fg: palette.text },
  'variable.builtin': { fg: palette.red },
  'variable.parameter': { fg: palette.maroon },
  parameter: { fg: palette.maroon },
  property: { fg: palette.text },

  // Types
  type: { fg: palette.yellow },
  'type.builtin': { fg: palette.yellow },
  class: { fg: palette.yellow },
  interface: { fg: palette.yellow },
  struct: { fg: palette.yellow },
  enum: { fg: palette.yellow },

  // Constants and literals
  constant: { fg: palette.peach },
  'constant.builtin': { fg: palette.peach },
  'constant.numeric': { fg: palette.peach },
  number: { fg: palette.peach },
  boolean: { fg: palette.peach },
  float: { fg: palette.peach },

  // Strings
  string: { fg: palette.green },
  'string.special': { fg: palette.teal },
  'string.escape': { fg: palette.pink },
  'string.regex': { fg: palette.pink },
  character: { fg: palette.green },

  // Comments
  comment: { fg: palette.overlay0, italic: true },
  'comment.documentation': { fg: palette.overlay1, italic: true },

  // Operators and punctuation
  operator: { fg: palette.sky },
  punctuation: { fg: palette.overlay2 },
  'punctuation.bracket': { fg: palette.overlay2 },
  'punctuation.delimiter': { fg: palette.overlay2 },

  // Tags
  tag: { fg: palette.mauve },
  'tag.attribute': { fg: palette.yellow },
  'tag.delimiter': { fg: palette.overlay2 },
  attribute: { fg: palette.yellow },

  // Namespace and modules
  namespace: { fg: palette.yellow },
  module: { fg: palette.yellow },

  // Labels
  label: { fg: palette.sapphire },

  // Macros
  macro: { fg: palette.mauve },
  'macro.builtin': { fg: palette.red },

  // Special constructs
  constructor: { fg: palette.sapphire },
  decorator: { fg: palette.pink },
  annotation: { fg: palette.pink },

  // Markup
  'markup.heading': { fg: palette.blue, bold: true },
  'markup.bold': { bold: true },
  'markup.italic': { italic: true },
  'markup.link': { fg: palette.blue, underline: true },
  'markup.quote': { fg: palette.overlay1, italic: true },
  'markup.raw': { fg: palette.green },
  'markup.list': { fg: palette.mauve },

  // Embedded
  embedded: { fg: palette.text },

  // Errors and warnings
  error: { fg: palette.red, bold: true },
  warning: { fg: palette.yellow, bold: true },

  // Special text
  text: { fg: palette.text },
  emphasis: { italic: true },
  strong: { bold: true },
  underline: { underline: true },

  // Git diff
  'diff.plus': { fg: palette.green },
  'diff.minus': { fg: palette.red },
  'diff.delta': { fg: palette.blue },
};

/**
 * Complete Catppuccin Mocha theme definition
 */
export const CatppuccinMochaTheme: ThemeDefinition = {
  id: 'catppuccin-mocha',
  name: 'Catppuccin Mocha',
  variant: 'dark',
  palette,
  semantic,
  syntax,
};

/**
 * Export palette separately for backward compatibility
 * @deprecated Use Theme.semantic or useTheme() instead
 */
export { palette as CatppuccinMochaPalette };
