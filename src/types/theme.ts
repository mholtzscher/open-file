/**
 * Theme type definitions for the theming system
 *
 * This module defines the interfaces for theme definitions, allowing
 * the application to support multiple color themes.
 */

/**
 * Color palette - raw color values that make up a theme
 *
 * These are the building blocks that semantic colors reference.
 * Named generically to work across different theme families.
 */
export interface ThemePalette {
  // Base/background colors (darkest to lightest for dark themes, reversed for light)
  base: string;
  mantle: string;
  crust: string;

  // Surface colors for layered UI elements
  surface0: string;
  surface1: string;
  surface2: string;

  // Text colors (brightest to dimmest)
  text: string;
  subtext1: string;
  subtext0: string;
  overlay2: string;
  overlay1: string;
  overlay0: string;

  // Accent colors
  red: string;
  maroon: string;
  peach: string;
  yellow: string;
  green: string;
  teal: string;
  sky: string;
  sapphire: string;
  blue: string;
  lavender: string;
  mauve: string;
  pink: string;
  flamingo: string;
  rosewater: string;
}

/**
 * Semantic colors - colors by their purpose/meaning
 *
 * Components should use these instead of raw palette colors
 * to ensure consistent meaning across themes.
 */
export interface ThemeSemanticColors {
  // Text hierarchy
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textDisabled: string;

  // Backgrounds
  bgBase: string;
  bgSurface: string;
  bgHighlight: string;
  bgSelection: string;

  // Status colors
  success: string;
  error: string;
  warning: string;
  info: string;

  // File browser entries
  directory: string;
  directorySelected: string;
  file: string;
  fileSelected: string;

  // Editor modes (vim-style)
  modeNormal: string;
  modeInsert: string;
  modeVisual: string;
  modeSearch: string;
  modeEdit: string;

  // Cursor and selection
  cursor: string;
  cursorLine: string;
  visualSelection: string;

  // Dialog borders
  dialogBorderNeutral: string;
  dialogBorderWarning: string;
  dialogBorderError: string;
  dialogBorderInfo: string;
  dialogBorderSuccess: string;

  // Accents
  accent: string;
  accentSecondary: string;

  // Provider-specific colors
  providerS3: string;
  providerGcs: string;
  providerSftp: string;
  providerFtp: string;
  providerLocal: string;
  providerNfs: string;
  providerSmb: string;
  providerGdrive: string;
}

/**
 * Syntax highlighting token style
 */
export interface SyntaxTokenStyle {
  fg?: string;
  bg?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

/**
 * Syntax highlighting theme for code display
 *
 * Maps tree-sitter token types to styles.
 * Uses dot notation for nested token types (e.g., 'keyword.control').
 */
export interface ThemeSyntax {
  // Keywords
  keyword: SyntaxTokenStyle;
  'keyword.control': SyntaxTokenStyle;
  'keyword.function': SyntaxTokenStyle;
  'keyword.return': SyntaxTokenStyle;
  'keyword.operator': SyntaxTokenStyle;

  // Functions
  function: SyntaxTokenStyle;
  'function.call': SyntaxTokenStyle;
  'function.method': SyntaxTokenStyle;
  'function.builtin': SyntaxTokenStyle;
  method: SyntaxTokenStyle;

  // Variables
  variable: SyntaxTokenStyle;
  'variable.builtin': SyntaxTokenStyle;
  'variable.parameter': SyntaxTokenStyle;
  parameter: SyntaxTokenStyle;
  property: SyntaxTokenStyle;

  // Types
  type: SyntaxTokenStyle;
  'type.builtin': SyntaxTokenStyle;
  class: SyntaxTokenStyle;
  interface: SyntaxTokenStyle;
  struct: SyntaxTokenStyle;
  enum: SyntaxTokenStyle;

  // Constants and literals
  constant: SyntaxTokenStyle;
  'constant.builtin': SyntaxTokenStyle;
  'constant.numeric': SyntaxTokenStyle;
  number: SyntaxTokenStyle;
  boolean: SyntaxTokenStyle;
  float: SyntaxTokenStyle;

  // Strings
  string: SyntaxTokenStyle;
  'string.special': SyntaxTokenStyle;
  'string.escape': SyntaxTokenStyle;
  'string.regex': SyntaxTokenStyle;
  character: SyntaxTokenStyle;

  // Comments
  comment: SyntaxTokenStyle;
  'comment.documentation': SyntaxTokenStyle;

  // Operators and punctuation
  operator: SyntaxTokenStyle;
  punctuation: SyntaxTokenStyle;
  'punctuation.bracket': SyntaxTokenStyle;
  'punctuation.delimiter': SyntaxTokenStyle;

  // Tags (HTML/XML/JSX)
  tag: SyntaxTokenStyle;
  'tag.attribute': SyntaxTokenStyle;
  'tag.delimiter': SyntaxTokenStyle;
  attribute: SyntaxTokenStyle;

  // Namespace and modules
  namespace: SyntaxTokenStyle;
  module: SyntaxTokenStyle;

  // Labels
  label: SyntaxTokenStyle;

  // Macros and preprocessor
  macro: SyntaxTokenStyle;
  'macro.builtin': SyntaxTokenStyle;

  // Special constructs
  constructor: SyntaxTokenStyle;
  decorator: SyntaxTokenStyle;
  annotation: SyntaxTokenStyle;

  // Markup (Markdown, etc.)
  'markup.heading': SyntaxTokenStyle;
  'markup.bold': SyntaxTokenStyle;
  'markup.italic': SyntaxTokenStyle;
  'markup.link': SyntaxTokenStyle;
  'markup.quote': SyntaxTokenStyle;
  'markup.raw': SyntaxTokenStyle;
  'markup.list': SyntaxTokenStyle;

  // Embedded code
  embedded: SyntaxTokenStyle;

  // Errors and warnings
  error: SyntaxTokenStyle;
  warning: SyntaxTokenStyle;

  // Special text styles
  text: SyntaxTokenStyle;
  emphasis: SyntaxTokenStyle;
  strong: SyntaxTokenStyle;
  underline: SyntaxTokenStyle;

  // Git diff
  'diff.plus': SyntaxTokenStyle;
  'diff.minus': SyntaxTokenStyle;
  'diff.delta': SyntaxTokenStyle;
}

/**
 * Complete theme definition
 *
 * A theme provides all colors needed by the application,
 * organized into palette (raw colors), semantic (by purpose),
 * and syntax (code highlighting) sections.
 */
export interface ThemeDefinition {
  /** Unique identifier for the theme */
  id: string;

  /** Display name for the theme */
  name: string;

  /** Theme variant - affects some UI decisions */
  variant: 'dark' | 'light';

  /** Raw color palette */
  palette: ThemePalette;

  /** Semantic colors by purpose */
  semantic: ThemeSemanticColors;

  /** Syntax highlighting colors */
  syntax: ThemeSyntax;
}

/**
 * Status message types for semantic color lookup
 */
export type StatusType = 'success' | 'error' | 'warning' | 'info' | 'normal';

/**
 * Dialog border types for semantic color lookup
 */
export type DialogBorderType = 'neutral' | 'warning' | 'error' | 'info' | 'success';

/**
 * Provider types for color lookup
 */
export type ProviderType = 's3' | 'gcs' | 'sftp' | 'ftp' | 'local' | 'nfs' | 'smb' | 'gdrive';
