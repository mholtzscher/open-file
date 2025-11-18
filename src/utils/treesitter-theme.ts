/**
 * Tree-sitter syntax style configuration for CodeRenderable
 *
 * Maps Catppuccin Mocha theme colors to Tree-sitter token types
 */

import { SyntaxStyle, parseColor } from '@opentui/core';
import { CatppuccinMocha } from '../ui/theme.js';

/**
 * Helper to convert hex color strings to RGBA for Tree-sitter
 */
const c = (hex: string) => parseColor(hex);

/**
 * Create a SyntaxStyle for Tree-sitter from Catppuccin Mocha theme
 *
 * Tree-sitter uses semantic token types like "keyword", "function", "string", etc.
 * These are different from highlight.js class names.
 *
 * @see https://tree-sitter.github.io/tree-sitter/syntax-highlighting
 */
export function createTreeSitterStyle(): SyntaxStyle {
  return SyntaxStyle.fromStyles({
    // Keywords and control flow
    keyword: { fg: c(CatppuccinMocha.mauve), bold: true },
    'keyword.control': { fg: c(CatppuccinMocha.mauve), bold: true },
    'keyword.function': { fg: c(CatppuccinMocha.mauve), bold: true },
    'keyword.return': { fg: c(CatppuccinMocha.mauve), bold: true },
    'keyword.operator': { fg: c(CatppuccinMocha.sky) },

    // Functions and methods
    function: { fg: c(CatppuccinMocha.blue) },
    'function.call': { fg: c(CatppuccinMocha.blue) },
    'function.method': { fg: c(CatppuccinMocha.blue) },
    'function.builtin': { fg: c(CatppuccinMocha.yellow) },
    method: { fg: c(CatppuccinMocha.blue) },

    // Variables and identifiers
    variable: { fg: c(CatppuccinMocha.text) },
    'variable.builtin': { fg: c(CatppuccinMocha.red) },
    'variable.parameter': { fg: c(CatppuccinMocha.maroon) },
    parameter: { fg: c(CatppuccinMocha.maroon) },
    property: { fg: c(CatppuccinMocha.text) },

    // Types and classes
    type: { fg: c(CatppuccinMocha.yellow) },
    'type.builtin': { fg: c(CatppuccinMocha.yellow) },
    class: { fg: c(CatppuccinMocha.yellow) },
    interface: { fg: c(CatppuccinMocha.yellow) },
    struct: { fg: c(CatppuccinMocha.yellow) },
    enum: { fg: c(CatppuccinMocha.yellow) },

    // Constants and literals
    constant: { fg: c(CatppuccinMocha.peach) },
    'constant.builtin': { fg: c(CatppuccinMocha.peach) },
    'constant.numeric': { fg: c(CatppuccinMocha.peach) },
    number: { fg: c(CatppuccinMocha.peach) },
    boolean: { fg: c(CatppuccinMocha.peach) },
    float: { fg: c(CatppuccinMocha.peach) },

    // Strings
    string: { fg: c(CatppuccinMocha.green) },
    'string.special': { fg: c(CatppuccinMocha.teal) },
    'string.escape': { fg: c(CatppuccinMocha.pink) },
    'string.regex': { fg: c(CatppuccinMocha.pink) },
    character: { fg: c(CatppuccinMocha.green) },

    // Comments
    comment: { fg: c(CatppuccinMocha.overlay0), italic: true },
    'comment.documentation': { fg: c(CatppuccinMocha.overlay1), italic: true },

    // Operators and punctuation
    operator: { fg: c(CatppuccinMocha.sky) },
    punctuation: { fg: c(CatppuccinMocha.overlay2) },
    'punctuation.bracket': { fg: c(CatppuccinMocha.overlay2) },
    'punctuation.delimiter': { fg: c(CatppuccinMocha.overlay2) },

    // Tags (HTML/XML/JSX)
    tag: { fg: c(CatppuccinMocha.mauve) },
    'tag.attribute': { fg: c(CatppuccinMocha.yellow) },
    'tag.delimiter': { fg: c(CatppuccinMocha.overlay2) },

    // Attributes
    attribute: { fg: c(CatppuccinMocha.yellow) },

    // Namespace and modules
    namespace: { fg: c(CatppuccinMocha.yellow) },
    module: { fg: c(CatppuccinMocha.yellow) },

    // Labels
    label: { fg: c(CatppuccinMocha.sapphire) },

    // Macros and preprocessor
    macro: { fg: c(CatppuccinMocha.mauve) },
    'macro.builtin': { fg: c(CatppuccinMocha.red) },

    // Special constructs
    constructor: { fg: c(CatppuccinMocha.sapphire) },
    decorator: { fg: c(CatppuccinMocha.pink) },
    annotation: { fg: c(CatppuccinMocha.pink) },

    // Markup (Markdown, etc.)
    'markup.heading': { fg: c(CatppuccinMocha.blue), bold: true },
    'markup.bold': { bold: true },
    'markup.italic': { italic: true },
    'markup.link': { fg: c(CatppuccinMocha.blue), underline: true },
    'markup.quote': { fg: c(CatppuccinMocha.overlay1), italic: true },
    'markup.raw': { fg: c(CatppuccinMocha.green) },
    'markup.list': { fg: c(CatppuccinMocha.mauve) },

    // Embedded code
    embedded: { fg: c(CatppuccinMocha.text) },

    // Errors and warnings
    error: { fg: c(CatppuccinMocha.red), bold: true },
    warning: { fg: c(CatppuccinMocha.yellow), bold: true },

    // Special
    text: { fg: c(CatppuccinMocha.text) },
    emphasis: { italic: true },
    strong: { bold: true },
    underline: { underline: true },

    // Git diff
    'diff.plus': { fg: c(CatppuccinMocha.green) },
    'diff.minus': { fg: c(CatppuccinMocha.red) },
    'diff.delta': { fg: c(CatppuccinMocha.blue) },
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
