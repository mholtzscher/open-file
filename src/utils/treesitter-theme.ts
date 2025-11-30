/**
 * Tree-sitter syntax style configuration for CodeRenderable
 *
 * Creates syntax highlighting styles from the active theme's syntax definition.
 */

import { SyntaxStyle, parseColor } from '@opentui/core';
import { Theme } from '../ui/theme.js';
import type { ThemeSyntax, SyntaxTokenStyle } from '../types/theme.js';

/**
 * Helper to convert hex color strings to RGBA for Tree-sitter
 */
const c = (hex: string) => parseColor(hex);

/**
 * Convert a SyntaxTokenStyle to OpenTUI's style format
 */
function convertStyle(style: SyntaxTokenStyle): {
  fg?: ReturnType<typeof parseColor>;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
} {
  return {
    ...(style.fg && { fg: c(style.fg) }),
    ...(style.bold && { bold: true }),
    ...(style.italic && { italic: true }),
    ...(style.underline && { underline: true }),
  };
}

/**
 * Create a SyntaxStyle for Tree-sitter from the active theme
 *
 * Tree-sitter uses semantic token types like "keyword", "function", "string", etc.
 * These are different from highlight.js class names.
 *
 * @see https://tree-sitter.github.io/tree-sitter/syntax-highlighting
 */
export function createTreeSitterStyle(): SyntaxStyle {
  const syntax: ThemeSyntax = Theme.syntax;

  return SyntaxStyle.fromStyles({
    // Keywords and control flow
    keyword: convertStyle(syntax.keyword),
    'keyword.control': convertStyle(syntax['keyword.control']),
    'keyword.function': convertStyle(syntax['keyword.function']),
    'keyword.return': convertStyle(syntax['keyword.return']),
    'keyword.operator': convertStyle(syntax['keyword.operator']),

    // Functions and methods
    function: convertStyle(syntax.function),
    'function.call': convertStyle(syntax['function.call']),
    'function.method': convertStyle(syntax['function.method']),
    'function.builtin': convertStyle(syntax['function.builtin']),
    method: convertStyle(syntax.method),

    // Variables and identifiers
    variable: convertStyle(syntax.variable),
    'variable.builtin': convertStyle(syntax['variable.builtin']),
    'variable.parameter': convertStyle(syntax['variable.parameter']),
    parameter: convertStyle(syntax.parameter),
    property: convertStyle(syntax.property),

    // Types and classes
    type: convertStyle(syntax.type),
    'type.builtin': convertStyle(syntax['type.builtin']),
    class: convertStyle(syntax.class),
    interface: convertStyle(syntax.interface),
    struct: convertStyle(syntax.struct),
    enum: convertStyle(syntax.enum),

    // Constants and literals
    constant: convertStyle(syntax.constant),
    'constant.builtin': convertStyle(syntax['constant.builtin']),
    'constant.numeric': convertStyle(syntax['constant.numeric']),
    number: convertStyle(syntax.number),
    boolean: convertStyle(syntax.boolean),
    float: convertStyle(syntax.float),

    // Strings
    string: convertStyle(syntax.string),
    'string.special': convertStyle(syntax['string.special']),
    'string.escape': convertStyle(syntax['string.escape']),
    'string.regex': convertStyle(syntax['string.regex']),
    character: convertStyle(syntax.character),

    // Comments
    comment: convertStyle(syntax.comment),
    'comment.documentation': convertStyle(syntax['comment.documentation']),

    // Operators and punctuation
    operator: convertStyle(syntax.operator),
    punctuation: convertStyle(syntax.punctuation),
    'punctuation.bracket': convertStyle(syntax['punctuation.bracket']),
    'punctuation.delimiter': convertStyle(syntax['punctuation.delimiter']),

    // Tags (HTML/XML/JSX)
    tag: convertStyle(syntax.tag),
    'tag.attribute': convertStyle(syntax['tag.attribute']),
    'tag.delimiter': convertStyle(syntax['tag.delimiter']),

    // Attributes
    attribute: convertStyle(syntax.attribute),

    // Namespace and modules
    namespace: convertStyle(syntax.namespace),
    module: convertStyle(syntax.module),

    // Labels
    label: convertStyle(syntax.label),

    // Macros and preprocessor
    macro: convertStyle(syntax.macro),
    'macro.builtin': convertStyle(syntax['macro.builtin']),

    // Special constructs
    constructor: convertStyle(syntax.constructor),
    decorator: convertStyle(syntax.decorator),
    annotation: convertStyle(syntax.annotation),

    // Markup (Markdown, etc.)
    'markup.heading': convertStyle(syntax['markup.heading']),
    'markup.bold': convertStyle(syntax['markup.bold']),
    'markup.italic': convertStyle(syntax['markup.italic']),
    'markup.link': convertStyle(syntax['markup.link']),
    'markup.quote': convertStyle(syntax['markup.quote']),
    'markup.raw': convertStyle(syntax['markup.raw']),
    'markup.list': convertStyle(syntax['markup.list']),

    // Embedded code
    embedded: convertStyle(syntax.embedded),

    // Errors and warnings
    error: convertStyle(syntax.error),
    warning: convertStyle(syntax.warning),

    // Special
    text: convertStyle(syntax.text),
    emphasis: convertStyle(syntax.emphasis),
    strong: convertStyle(syntax.strong),
    underline: convertStyle(syntax.underline),

    // Git diff
    'diff.plus': convertStyle(syntax['diff.plus']),
    'diff.minus': convertStyle(syntax['diff.minus']),
    'diff.delta': convertStyle(syntax['diff.delta']),
  });
}

/**
 * Detect Tree-sitter filetype from filename
 *
 * IMPORTANT: OpenTUI v0.1.44 only ships with Tree-sitter grammars for:
 * - javascript
 * - typescript
 * - markdown
 * - markdown_inline
 * - zig
 *
 * All other languages will fall back to plain text with no syntax highlighting.
 * This is a limitation of the current OpenTUI release.
 *
 * @see node_modules/@opentui/core/assets/ for available grammars
 */
export function detectTreeSitterFiletype(filename: string): string | undefined {
  const ext = filename.toLowerCase().split('.').pop();
  if (!ext) return undefined;

  // Only return filetypes that OpenTUI actually has grammars for
  const filetypeMap: Record<string, string> = {
    // JavaScript (supported)
    js: 'javascript',
    jsx: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',

    // TypeScript (supported)
    ts: 'typescript',
    tsx: 'typescript',
    mts: 'typescript',
    cts: 'typescript',

    // Markdown (supported)
    md: 'markdown',
    markdown: 'markdown',
    mdx: 'markdown',

    // Zig (supported)
    zig: 'zig',

    // All other languages: return undefined so CodeRenderable shows plain text
    // This includes: Python, Rust, Go, Java, C/C++, JSON, YAML, etc.
    // They will be rendered as plain text with no syntax highlighting.
  };

  return filetypeMap[ext];
}
