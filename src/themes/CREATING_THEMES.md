# Creating Custom Themes

This guide explains how to create a new theme for the application.

## Quick Start

1. Create a new file in `src/themes/` (e.g., `my-theme.ts`)
2. Define your palette, semantic colors, and syntax highlighting
3. Export a `ThemeDefinition` object
4. Register it in `src/themes/index.ts`

## Theme Structure

A theme has three layers:

```
ThemeDefinition
├── palette      - Raw color values (hex codes)
├── semantic     - Colors by purpose (what they mean)
└── syntax       - Code syntax highlighting styles
```

## Step-by-Step Guide

### 1. Create the Theme File

```typescript
// src/themes/my-theme.ts
import type {
  ThemeDefinition,
  ThemePalette,
  ThemeSemanticColors,
  ThemeSyntax,
} from '../types/theme.js';
```

### 2. Define the Color Palette

The palette contains your raw color values. These are referenced by semantic colors.

```typescript
const palette: ThemePalette = {
  // Base/background colors
  base: '#1a1a2e', // Main background
  mantle: '#16162a', // Slightly darker
  crust: '#0f0f1a', // Darkest background

  // Surface colors (for layered UI)
  surface0: '#25253a',
  surface1: '#30304a',
  surface2: '#3b3b5a',

  // Text colors (bright to dim)
  text: '#e0e0e0',
  subtext1: '#c0c0c0',
  subtext0: '#a0a0a0',
  overlay2: '#808080',
  overlay1: '#606060',
  overlay0: '#404040',

  // Accent colors
  red: '#ff6b6b',
  maroon: '#ff8585',
  peach: '#ffaa6b',
  yellow: '#ffd93d',
  green: '#6bcb77',
  teal: '#4ecdc4',
  sky: '#72d5ff',
  sapphire: '#5fa8ff',
  blue: '#4a90d9',
  lavender: '#a29bfe',
  mauve: '#9b59b6',
  pink: '#fd79a8',
  flamingo: '#fab1a0',
  rosewater: '#ffeaa7',
};
```

### 3. Define Semantic Colors

Map your palette colors to their semantic meanings:

```typescript
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

  // File browser
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

  // Provider colors
  providerS3: palette.yellow,
  providerGcs: palette.blue,
  providerSftp: palette.green,
  providerFtp: palette.peach,
  providerLocal: palette.lavender,
  providerSmb: palette.mauve,
  providerGdrive: palette.red,
};
```

### 4. Define Syntax Highlighting

Map tree-sitter token types to styles:

```typescript
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

  // Constants
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

  // Operators
  operator: { fg: palette.sky },
  punctuation: { fg: palette.overlay2 },
  'punctuation.bracket': { fg: palette.overlay2 },
  'punctuation.delimiter': { fg: palette.overlay2 },

  // Tags (HTML/XML/JSX)
  tag: { fg: palette.mauve },
  'tag.attribute': { fg: palette.yellow },
  'tag.delimiter': { fg: palette.overlay2 },
  attribute: { fg: palette.yellow },

  // Namespace
  namespace: { fg: palette.yellow },
  module: { fg: palette.yellow },

  // Labels
  label: { fg: palette.sapphire },

  // Macros
  macro: { fg: palette.mauve },
  'macro.builtin': { fg: palette.red },

  // Special
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

  // Errors
  error: { fg: palette.red, bold: true },
  warning: { fg: palette.yellow, bold: true },

  // Text
  text: { fg: palette.text },
  emphasis: { italic: true },
  strong: { bold: true },
  underline: { underline: true },

  // Git diff
  'diff.plus': { fg: palette.green },
  'diff.minus': { fg: palette.red },
  'diff.delta': { fg: palette.blue },
};
```

### 5. Export the Theme

```typescript
export const MyTheme: ThemeDefinition = {
  id: 'my-theme', // Unique identifier
  name: 'My Custom Theme', // Display name
  variant: 'dark', // 'dark' or 'light'
  palette,
  semantic,
  syntax,
};
```

### 6. Register the Theme

In `src/themes/index.ts`, add your theme:

```typescript
export { MyTheme } from './my-theme.js';

// In initializeThemes():
import { MyTheme } from './my-theme.js';

export function initializeThemes(defaultThemeId: string = 'catppuccin-mocha'): void {
  if (!ThemeRegistry.has('catppuccin-mocha')) {
    ThemeRegistry.register(CatppuccinMochaTheme);
  }
  if (!ThemeRegistry.has('my-theme')) {
    ThemeRegistry.register(MyTheme);
  }
  // ...
}
```

## Using the Theme

### In React Components

```typescript
import { useTheme } from '../contexts/ThemeContext.js';

function MyComponent() {
  const { theme, themeId } = useTheme();

  return (
    <Box borderColor={theme.semantic.dialogBorderNeutral}>
      <Text color={theme.semantic.textPrimary}>Hello</Text>
    </Box>
  );
}
```

### Via Static Theme Class

```typescript
import { Theme } from '../ui/theme.js';

// Semantic getters (preferred)
const errorColor = Theme.getErrorColor();
const bgColor = Theme.getBgBase();

// Direct access
const theme = Theme.getActiveTheme();
const blue = theme.palette.blue;
```

## Design Guidelines

### Light vs Dark Themes

Set `variant: 'light'` or `variant: 'dark'`:

- **Dark themes**: `base` is darkest, `text` is brightest
- **Light themes**: `base` is brightest, `text` is darkest

### Color Contrast

Ensure sufficient contrast for readability:

- Primary text on background: 7:1 ratio (WCAG AAA)
- Secondary text on background: 4.5:1 ratio (WCAG AA)
- Use tools like [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)

### Semantic Consistency

Users expect certain color associations:

- **Red**: Errors, deletions, danger
- **Yellow**: Warnings, caution
- **Green**: Success, additions, safe
- **Blue**: Information, links, directories

## Testing Your Theme

1. Switch to your theme:

   ```typescript
   ThemeRegistry.setActive('my-theme');
   ```

2. Verify all UI elements render correctly:
   - File browser (files, directories, selection)
   - Dialogs (all border types)
   - Status messages (success, error, warning, info)
   - Editor modes (normal, insert, visual)
   - Code preview (syntax highlighting)

3. Run the test suite to catch any issues:
   ```bash
   bun test
   ```

## Reference

- **Catppuccin Mocha** (`src/themes/catppuccin-mocha.ts`) - Default theme, good reference
- **Theme types** (`src/types/theme.ts`) - Full interface definitions
- **Theme registry** (`src/ui/theme-registry.ts`) - Runtime theme management
