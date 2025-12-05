/**
 * Tokyo Night Theme
 *
 * A dark, modern theme inspired by the official Tokyo Night
 * VS Code theme. Colors are adapted for our generic ThemePalette
 * while keeping the overall look and feel.
 */

import type {
  ThemeDefinition,
  ThemePalette,
  ThemeSemanticColors,
  ThemeSyntax,
} from '../types/theme.js';

/**
 * Tokyo Night color palette
 */
const palette: ThemePalette = {
  // Base colors
  base: '#1a1b26',
  mantle: '#16161e',
  crust: '#0f0f19',

  // Surface colors
  surface0: '#24283b',
  surface1: '#292e42',
  surface2: '#3b4261',

  // Text colors
  text: '#c0caf5',
  subtext1: '#a9b1d6',
  subtext0: '#9aa5ce',
  overlay2: '#737aa2',
  overlay1: '#565f89',
  overlay0: '#414868',

  // Accent colors (approximate mappings from Tokyo Night)
  red: '#f7768e',
  maroon: '#ff5370',
  peach: '#ff9e64',
  yellow: '#e0af68',
  green: '#9ece6a',
  teal: '#73daca',
  sky: '#7dcfff',
  sapphire: '#2ac3de',
  blue: '#7aa2f7',
  lavender: '#bb9af7',
  mauve: '#c0caf5',
  pink: '#ff79c6',
  flamingo: '#f4b8e4',
  rosewater: '#f2d5cf',
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
  modeVisual: palette.lavender,
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
  accent: palette.sky,
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
  tag: { fg: palette.lavender },
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
 * Complete Tokyo Night theme definition
 */
export const TokyoNightTheme: ThemeDefinition = {
  id: 'tokyo-night',
  name: 'Tokyo Night',
  variant: 'dark',
  palette,
  semantic,
  syntax,
};
