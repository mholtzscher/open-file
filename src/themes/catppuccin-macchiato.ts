/**
 * Catppuccin Macchiato Theme
 *
 * A warm, fluffy dark theme based on Catppuccin's Macchiato variant.
 * https://github.com/catppuccin/catppuccin
 */

import type {
  ThemeDefinition,
  ThemePalette,
  ThemeSemanticColors,
  ThemeSyntax,
} from '../types/theme.js';

/**
 * Catppuccin Macchiato color palette
 */
const palette: ThemePalette = {
  // Base colors
  base: '#24273a',
  mantle: '#1e2030',
  crust: '#181926',

  // Surface colors
  surface0: '#363a4f',
  surface1: '#494d64',
  surface2: '#5b6078',

  // Text colors
  text: '#cad3f5',
  subtext1: '#b8c0e0',
  subtext0: '#a5adcb',
  overlay2: '#939ab7',
  overlay1: '#8087a2',
  overlay0: '#6e738d',

  // Accent colors
  red: '#ed8796',
  maroon: '#ee99a0',
  peach: '#f5a97f',
  yellow: '#eed49f',
  green: '#a6da95',
  teal: '#8bd5ca',
  sky: '#91d7e3',
  sapphire: '#7dc4e4',
  blue: '#8aadf4',
  lavender: '#b7bdf8',
  mauve: '#c6a0f6',
  pink: '#f5bde6',
  flamingo: '#f0c6c6',
  rosewater: '#f4dbd6',
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
  cursor: palette.rosewater,
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
 * Complete Catppuccin Macchiato theme definition
 */
export const CatppuccinMacchiatoTheme: ThemeDefinition = {
  id: 'catppuccin-macchiato',
  name: 'Catppuccin Macchiato',
  variant: 'dark',
  palette,
  semantic,
  syntax,
};
