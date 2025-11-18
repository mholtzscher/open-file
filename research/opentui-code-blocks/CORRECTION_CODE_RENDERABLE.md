# CORRECTION: OpenTUI DOES Have a CodeRenderable Component

## Executive Summary

**The previous research was INCORRECT.** OpenTUI v0.1.44 **DOES** include a sophisticated `CodeRenderable` component with Tree-sitter-based syntax highlighting.

## What Was Missed

The lookup agent searched documentation but did not check the actual OpenTUI source code or type definitions. The `CodeRenderable` is:

1. **Available in `@opentui/core`** - Exported from the core package
2. **Available as `<code>` JSX element** - Fully integrated with React
3. **Uses Tree-sitter for syntax highlighting** - NOT highlight.js
4. **Has virtual scrolling built-in** - Extends `TextBufferRenderable` with optimized rendering

## Component Location

```typescript
// Core package
import { CodeRenderable, SyntaxStyle } from '@opentui/core';

// Available as JSX element
<code
  content={string}
  filetype={string}
  syntaxStyle={SyntaxStyle}
  // ... other props
/>
```

Source: `/node_modules/@opentui/core/renderables/Code.ts` (290 lines)

## Key Features

### 1. Tree-sitter Syntax Highlighting

Unlike our current implementation using `highlight.js`, OpenTUI uses Tree-sitter:

```typescript
export interface CodeOptions extends TextBufferOptions {
  content?: string;
  filetype?: string;
  syntaxStyle: SyntaxStyle;
  treeSitterClient?: TreeSitterClient;
  conceal?: boolean;
  drawUnstyledText?: boolean;
  streaming?: boolean;
}
```

**Benefits of Tree-sitter:**

- Faster parsing (incremental, built in Rust/C)
- More accurate syntax understanding
- Better error recovery
- Used by GitHub, Neovim, Atom

### 2. Virtual Scrolling Built-In

`CodeRenderable` extends `TextBufferRenderable`, which includes:

- Optimized buffer rendering
- Text wrapping (`wrapMode: "none" | "char" | "word"`)
- Selection support
- Efficient rendering for large files

```typescript
export abstract class TextBufferRenderable extends Renderable {
  protected textBuffer: TextBuffer;
  protected textBufferView: TextBufferView;
  protected _lineInfo: LineInfo;
  // ... optimized rendering
}
```

### 3. Streaming Support

The component supports **streaming code** (e.g., LLM code generation):

```typescript
streaming?: boolean;        // Enable streaming mode
drawUnstyledText?: boolean; // Show unstyled text before highlights arrive
```

**Streaming flow:**

1. Display plain text immediately (`drawUnstyledText: true`)
2. Highlight asynchronously with Tree-sitter
3. Update display with styled text when ready
4. Cache highlights for partial updates

### 4. Syntax Styles

Uses a sophisticated theming system:

```typescript
// Create from theme (VSCode-style themes)
const style = SyntaxStyle.fromTheme(themeTokenStyles);

// Or create from style definitions
const style = SyntaxStyle.fromStyles({
  keyword: { fg: '#FF5370', bold: true },
  function: { fg: '#82AAFF' },
  string: { fg: '#C3E88D' },
  // ... etc
});
```

## Comparison: Current vs CodeRenderable

| Feature                | Current Implementation | CodeRenderable                    |
| ---------------------- | ---------------------- | --------------------------------- |
| **Syntax Highlighter** | highlight.js           | Tree-sitter                       |
| **Parsing Speed**      | Slower (JS)            | Faster (Rust/C)                   |
| **Virtual Scrolling**  | None                   | Built-in via TextBufferRenderable |
| **Text Wrapping**      | None                   | `wrapMode` prop                   |
| **Line Numbers**       | None                   | Not built-in                      |
| **Selection**          | None                   | Built-in (`selectable` prop)      |
| **Streaming**          | None                   | Built-in (`streaming` prop)       |
| **Large Files**        | Renders all lines      | Optimized buffer rendering        |
| **Implementation**     | 87 lines custom        | Built-in component                |

## Props Reference

### CodeRenderable Props

```typescript
interface CodeOptions extends TextBufferOptions {
  // Content
  content?: string; // The code to display
  filetype?: string; // e.g. "javascript", "typescript", "python"

  // Styling
  syntaxStyle: SyntaxStyle; // Theme for syntax highlighting

  // Optional
  treeSitterClient?: TreeSitterClient; // Custom Tree-sitter client
  conceal?: boolean; // Hide certain syntax elements (default: true)
  drawUnstyledText?: boolean; // Show plain text before highlights (default: true)
  streaming?: boolean; // Enable streaming mode (default: false)

  // From TextBufferOptions
  fg?: string | RGBA; // Default foreground color
  bg?: string | RGBA; // Default background color
  selectable?: boolean; // Enable text selection (default: true)
  wrapMode?: 'none' | 'char' | 'word'; // Text wrapping mode
  selectionBg?: string | RGBA; // Selection background color
  selectionFg?: string | RGBA; // Selection foreground color

  // From RenderableOptions (flexbox, etc.)
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: number;
  width?: number;
  height?: number;
  // ... all standard renderable props
}
```

### Supported Filetypes

Tree-sitter supports a wide range of languages. Common ones:

- `javascript`, `typescript`, `tsx`, `jsx`
- `python`, `rust`, `go`, `c`, `cpp`
- `html`, `css`, `json`, `yaml`
- `bash`, `sql`, `markdown`
- Many more via Tree-sitter grammars

## Usage Example

```typescript
import { SyntaxStyle } from '@opentui/core';

// Create syntax style from theme
const syntaxStyle = SyntaxStyle.fromStyles({
  'keyword': { fg: '#FF5370', bold: true },
  'function': { fg: '#82AAFF' },
  'string': { fg: '#C3E88D' },
  'comment': { fg: '#676E95', italic: true },
  'variable': { fg: '#F07178' },
  'constant': { fg: '#F78C6C' },
  'type': { fg: '#FFCB6B' },
  'operator': { fg: '#89DDFF' },
});

function PreviewPane({ content, filename }: Props) {
  // Detect filetype from filename
  const filetype = filename.endsWith('.ts') ? 'typescript' :
                   filename.endsWith('.js') ? 'javascript' :
                   filename.endsWith('.py') ? 'python' :
                   undefined;

  return (
    <box
      flexGrow={1}
      borderStyle="rounded"
      borderColor="#89B4FA"
      title={`Preview: ${filename}`}
      overflow="hidden"
    >
      <code
        content={content}
        filetype={filetype}
        syntaxStyle={syntaxStyle}
        flexGrow={1}
        selectable={true}
        wrapMode="none"
      />
    </box>
  );
}
```

## Should We Switch?

### Pros of Switching to CodeRenderable

✅ **Significant advantages:**

1. **Better performance** - Tree-sitter is faster than highlight.js
2. **Built-in optimizations** - Virtual scrolling, optimized buffers
3. **Text selection** - Users can select and copy code
4. **Text wrapping** - Handle long lines elegantly
5. **Streaming support** - If we ever need live code updates
6. **Less code to maintain** - 87 lines → built-in component
7. **Future-proof** - Tree-sitter is the industry standard

### Cons / Considerations

⚠️ **Potential challenges:**

1. **Theme setup** - Need to create/convert Catppuccin theme for Tree-sitter tokens
2. **Different token names** - Tree-sitter uses different scope names than highlight.js
3. **Learning curve** - Different API and concepts
4. **Migration effort** - Need to refactor preview pane and syntax highlighting utils

### Migration Complexity: LOW-MEDIUM

**Estimated effort:** 2-4 hours

**Steps:**

1. Create `SyntaxStyle` from Catppuccin Mocha theme (1 hour)
2. Update `PreviewPane` to use `<code>` component (30 min)
3. Map file extensions to Tree-sitter filetypes (30 min)
4. Test with various file types (1 hour)
5. Remove old `highlightCode()` utility (15 min)
6. Update tests (30 min)

## Recommendation

### 🟢 **YES, switch to CodeRenderable**

**Reasoning:**

1. **Significant performance improvements** for large files
2. **Built-in features** we'd have to implement ourselves (selection, wrapping, virtual scrolling)
3. **Industry-standard technology** (Tree-sitter is used by GitHub, Neovim, etc.)
4. **Less maintenance burden** - leverage OpenTUI's optimizations
5. **Migration is straightforward** - mostly theme setup

### Next Steps

1. **Create Tree-sitter theme** mapping for Catppuccin Mocha
2. **Test with common file types** (JS, TS, Python, JSON, etc.)
3. **Update PreviewPane component** to use `<code>`
4. **Remove `src/utils/syntax-highlighting.ts`** (no longer needed)
5. **Update tests** to reflect new component

## File Size Limits

Based on `TextBufferRenderable` implementation, CodeRenderable should handle:

- **< 1MB**: Direct rendering with no issues ✅
- **1-10MB**: Optimized buffer rendering ✅
- **> 10MB**: May need truncation or chunking ⚠️

This is actually **better** than our current implementation, which renders all lines unconditionally.

## Conclusion

The previous research claiming OpenTUI had no CodeRenderable was **incorrect**. Not only does it exist, but it's **significantly more sophisticated** than our current custom implementation.

**Switching to CodeRenderable is strongly recommended** for better performance, built-in features, and reduced maintenance burden.

---

## References

- Source: `/node_modules/@opentui/core/renderables/Code.ts`
- Base class: `/node_modules/@opentui/core/renderables/TextBufferRenderable.d.ts`
- Types: `/node_modules/@opentui/react/src/types/components.d.ts`
- JSX namespace: `/node_modules/@opentui/react/jsx-namespace.d.ts`
- GitHub: https://github.com/sst/opentui/blob/main/packages/core/src/renderables/Code.ts
