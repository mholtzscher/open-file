# OpenTUI Code Block Rendering Research

## Executive Summary

OpenTUI **does NOT have a dedicated "CodeBlock" component**. Instead, it uses a **Text + Layout composition pattern** where:

1. **TextRenderable** is the primary component for text display
2. **Syntax highlighting is handled separately** using `highlight.js`
3. **Code is rendered as multiple Text elements** within layout containers
4. **Scrolling and large files require custom implementation** using Box containers with `overflow: "hidden"`

### Key Findings

| Aspect | Details |
|--------|---------|
| **Component Name** | `TextRenderable` (core) + `Box`/`Group` (layout) |
| **Syntax Highlighting** | Via external `highlight.js` library |
| **Scrolling Support** | Manual - requires container with `overflow: "hidden"` |
| **Line Numbers** | Not built-in - must be added manually |
| **Large File Handling** | Recommended: only render visible lines (viewport-based) |
| **Performance** | Excellent for <1000 lines, may struggle with 100k+ lines |

---

## 1. Current Implementation: How Open-S3 Does It

The `open-s3` project provides an **excellent real-world example** of code rendering with syntax highlighting.

### 1.1 Architecture

```
User selects file in S3
         ↓
highlightCode() runs
         ↓
Returns HighlightedLine[]
(each line has TextSegment[] with colors)
         ↓
PreviewPane renders Box
with nested Text elements
```

### 1.2 Key Components

#### **Syntax Highlighting Module** (`syntax-highlighting.ts`)

```typescript
// Exported interfaces
export interface TextSegment {
  text: string;
  color?: string;
}

export interface HighlightedLine {
  segments: TextSegment[];
}

// Main function
export function highlightCode(code: string, filename: string): HighlightedLine[] {
  const language = detectLanguage(filename);
  // ... parse HTML from highlight.js
  // ... return array of lines with color-segmented text
}
```

**Capabilities:**
- Detects language from file extension
- Uses `highlight.js` for syntax parsing
- Maps highlight.js token classes to Catppuccin Mocha colors
- Returns structured data (not HTML strings)

**Supported Languages:**
```typescript
{
  js, jsx, ts, tsx,        // JavaScript/TypeScript
  py,                      // Python
  rb,                      // Ruby
  go, rs, c, cpp, java,   // Compiled languages
  sh, bash, zsh, fish,     // Shells
  json, yaml, yml, toml,   // Config files
  xml, html, css, scss,    // Web technologies
  md, markdown,            // Markup
  sql,                     // Database
  csv, txt, log            // Plain text formats
}
```

#### **Preview Pane Component** (`preview-pane-react.tsx`)

```typescript
export function PreviewPane({
  content = '',
  filename = '',
  visible = true,
  flexGrow = 1,
  flexShrink = 1,
  flexBasis = 0,
}: PreviewPaneProps) {
  // Highlight code if filename provided
  const lines = highlightCode(content, filename);
  
  return (
    <box overflow="hidden" title={`Preview (${totalLines} lines)`}>
      {lines.map((line, lineIdx) => (
        <box key={lineIdx} flexDirection="row">
          {line.segments.map((segment, segIdx) => (
            <text key={segIdx} fg={segment.color}>
              {segment.text}
            </text>
          ))}
        </box>
      ))}
    </box>
  );
}
```

**Key Points:**
- Each line is a Box with `flexDirection="row"`
- Each segment is a Text element with color
- Container has `overflow: "hidden"` to clip content beyond bounds
- Title shows total line count

---

## 2. Component API Details

### 2.1 TextRenderable (Core Component)

**Import:**
```typescript
import { TextRenderable, TextAttributes } from '@opentui/core';
```

**Constructor:**
```typescript
new TextRenderable(renderer, {
  id: string;                           // Unique identifier
  content: string;                      // Text content
  fg?: string;                          // Foreground color (#RRGGBB)
  backgroundColor?: string;            // Background color
  attributes?: number;                 // TextAttributes flags
  position?: 'absolute' | 'relative';  // Positioning mode
  left?: number;                        // X coordinate
  top?: number;                         // Y coordinate
  width?: number;                       // Width in columns
  height?: number;                      // Height in rows
  flexGrow?: number;                    // Flex grow factor
  flexShrink?: number;                  // Flex shrink factor
  flexBasis?: number;                   // Flex basis
})
```

**TextAttributes (Bitmask Flags):**
```typescript
enum TextAttributes {
  BOLD = 0x01,
  DIM = 0x02,
  ITALIC = 0x04,
  UNDERLINE = 0x08,
  BLINK = 0x10,
  INVERT = 0x20,
  HIDDEN = 0x40,
  STRIKETHROUGH = 0x80,
}

// Usage (bitwise OR):
attributes: TextAttributes.BOLD | TextAttributes.UNDERLINE
```

**Limitations:**
- No built-in word wrapping
- No built-in scrolling
- Content is static (no text cursor or editing)
- Line breaks are handled by OS newlines (`\n`)

### 2.2 BoxRenderable (Layout Container)

**Import:**
```typescript
import { BoxRenderable } from '@opentui/core';
```

**Key Props for Code Display:**
```typescript
{
  overflow?: 'visible' | 'hidden' | 'scroll';  // ✨ IMPORTANT
  borderStyle?: 'single' | 'double' | 'rounded' | 'ascii';
  borderColor?: string;
  title?: string;                               // Box title
  titleAlignment?: 'left' | 'center' | 'right';
  padding?: { top, left, right, bottom };
  backgroundColor?: string;
  
  // Flexbox layout
  flexDirection?: 'row' | 'column';
  gap?: number;
}
```

**Overflow Behavior:**
```typescript
// overflow: 'hidden' - clips content beyond container bounds
// overflow: 'scroll' - shows scroll indicators (visual only, no interaction)
// overflow: 'visible' - extends beyond bounds (rare, usually not desired)
```

### 2.3 GroupRenderable (Flex Container)

**Import:**
```typescript
import { GroupRenderable } from '@opentui/core';
```

Similar to Box but optimized for layout without border decoration:

```typescript
const container = new GroupRenderable(renderer, {
  id: 'code-container',
  flexDirection: 'column',
  width: '100%',
  height: '100%',
  gap: 0,  // No gap between lines
});

// Add content dynamically
container.add(lineElement);
```

---

## 3. Implementing Code Blocks

### 3.1 Basic Code Display

**Minimal Example:**
```typescript
import { createCliRenderer, TextRenderable, BoxRenderable } from '@opentui/core';

const code = `function hello() {
  console.log('Hello, World!');
}`;

const renderer = await createCliRenderer();

const codeBox = new BoxRenderable(renderer, {
  id: 'code',
  width: 60,
  height: 10,
  borderStyle: 'rounded',
  title: 'hello.js',
  overflow: 'hidden',
});

const text = new TextRenderable(renderer, {
  id: 'code-text',
  content: code,
  fg: '#FFFFFF',
});

codeBox.add(text);
renderer.root.add(codeBox);
```

### 3.2 Syntax Highlighted Code (Like Open-S3)

**Step 1: Install highlight.js**
```bash
bun install highlight.js
```

**Step 2: Create highlighting module**
```typescript
import hljs from 'highlight.js';

export interface TextSegment {
  text: string;
  color?: string;
}

export interface HighlightedLine {
  segments: TextSegment[];
}

export function highlightCode(code: string, filename: string): HighlightedLine[] {
  const language = detectLanguageFromExtension(filename);
  
  const highlighted = hljs.highlight(code, { language }).value;
  
  // Parse HTML spans into segments with colors
  // (see syntax-highlighting.ts in open-s3 for full implementation)
  return lines;
}
```

**Step 3: Render with colors**
```typescript
const lines = highlightCode(fileContent, 'script.js');

const codeBox = new BoxRenderable(renderer, {
  id: 'code-preview',
  flexGrow: 1,
  flexDirection: 'column',
  overflow: 'hidden',
});

lines.forEach((line, idx) => {
  const lineBox = new BoxRenderable(renderer, {
    id: `line-${idx}`,
    flexDirection: 'row',
    height: 1,
  });

  line.segments.forEach((segment, segIdx) => {
    const text = new TextRenderable(renderer, {
      id: `segment-${idx}-${segIdx}`,
      content: segment.text,
      fg: segment.color || '#FFFFFF',
    });
    lineBox.add(text);
  });

  codeBox.add(lineBox);
});

renderer.root.add(codeBox);
```

### 3.3 With Line Numbers

**Implementation:**
```typescript
function renderCodeWithLineNumbers(
  renderer: any,
  content: string,
  filename: string
): BoxRenderable {
  const lines = highlightCode(content, filename);
  
  const container = new BoxRenderable(renderer, {
    id: 'code-with-lines',
    flexDirection: 'row',
    overflow: 'hidden',
  });

  // Line number column
  const lineNumberCol = new GroupRenderable(renderer, {
    id: 'line-numbers',
    flexDirection: 'column',
    width: 5,  // Fixed width for line numbers
    backgroundColor: '#1a1a1a',
  });

  // Code column
  const codeCol = new GroupRenderable(renderer, {
    id: 'code-content',
    flexDirection: 'column',
    flexGrow: 1,
  });

  lines.forEach((line, idx) => {
    // Line number
    const lineNum = new TextRenderable(renderer, {
      id: `linenum-${idx}`,
      content: String(idx + 1).padStart(4, ' ') + ' ',
      fg: '#666666',
    });
    lineNumberCol.add(lineNum);

    // Code line
    const codeLine = new BoxRenderable(renderer, {
      id: `codeline-${idx}`,
      flexDirection: 'row',
      height: 1,
    });

    line.segments.forEach((segment, segIdx) => {
      const text = new TextRenderable(renderer, {
        id: `segment-${idx}-${segIdx}`,
        content: segment.text,
        fg: segment.color,
      });
      codeLine.add(text);
    });

    codeCol.add(codeLine);
  });

  container.add(lineNumberCol);
  container.add(codeCol);
  return container;
}
```

---

## 4. Scrolling and Large Files

### 4.1 Virtual Scrolling (Recommended for Large Files)

**Problem:** Rendering 100k lines would create 100k TextRenderable objects → memory explosion.

**Solution:** Only render visible lines (viewport-based rendering).

```typescript
interface ScrollViewport {
  startLine: number;
  endLine: number;
  totalLines: number;
  visibleHeight: number;  // Terminal rows
}

class VirtualCodeScroller {
  private viewport: ScrollViewport;
  private allLines: HighlightedLine[];
  private codeContainer: GroupRenderable;
  private scrollOffset = 0;

  constructor(
    renderer: any,
    lines: HighlightedLine[],
    visibleHeight: number
  ) {
    this.allLines = lines;
    this.codeContainer = new GroupRenderable(renderer, {
      id: 'virtual-code',
      flexDirection: 'column',
      height: visibleHeight,
      overflow: 'hidden',
    });
    this.updateViewport();
  }

  private updateViewport() {
    const startLine = this.scrollOffset;
    const endLine = Math.min(
      this.scrollOffset + this.viewport.visibleHeight,
      this.allLines.length
    );

    // Re-render only visible lines
    this.codeContainer.removeAll();

    for (let i = startLine; i < endLine; i++) {
      const line = this.allLines[i];
      const lineBox = this.createLineElement(i, line);
      this.codeContainer.add(lineBox);
    }
  }

  scroll(direction: 'up' | 'down', amount: number = 1) {
    if (direction === 'down') {
      this.scrollOffset = Math.min(
        this.scrollOffset + amount,
        this.allLines.length - this.viewport.visibleHeight
      );
    } else {
      this.scrollOffset = Math.max(0, this.scrollOffset - amount);
    }
    this.updateViewport();
  }

  private createLineElement(idx: number, line: HighlightedLine): BoxRenderable {
    const lineBox = new BoxRenderable(renderer, {
      id: `line-${idx}`,
      flexDirection: 'row',
      height: 1,
    });

    line.segments.forEach((segment, segIdx) => {
      const text = new TextRenderable(renderer, {
        id: `seg-${idx}-${segIdx}`,
        content: segment.text,
        fg: segment.color,
      });
      lineBox.add(text);
    });

    return lineBox;
  }
}

// Usage
const scroller = new VirtualCodeScroller(renderer, largeFileLines, 30);

renderer.keyInput.on('keypress', (key: KeyEvent) => {
  if (key.name === 'pagedown') scroller.scroll('down', 10);
  if (key.name === 'pageup') scroller.scroll('up', 10);
  if (key.name === 'down') scroller.scroll('down', 1);
  if (key.name === 'up') scroller.scroll('up', 1);
});
```

### 4.2 Chunked Loading for Massive Files

```typescript
class ChunkedCodeLoader {
  private chunkSize = 10000;  // Lines per chunk
  private loadedChunks: Map<number, HighlightedLine[]> = new Map();

  async loadChunk(chunkIndex: number) {
    if (this.loadedChunks.has(chunkIndex)) {
      return this.loadedChunks.get(chunkIndex);
    }

    // Simulate async loading
    const startLine = chunkIndex * this.chunkSize;
    const endLine = Math.min(startLine + this.chunkSize, this.totalLines);
    
    // In real scenario: read from file, process lines
    const chunk = await this.processLines(startLine, endLine);
    this.loadedChunks.set(chunkIndex, chunk);
    
    return chunk;
  }

  private async processLines(start: number, end: number) {
    // Lazy load and highlight on demand
    return [];
  }

  // Evict old chunks to save memory
  evictOldChunks(visibleChunkIndex: number) {
    for (const [idx] of this.loadedChunks) {
      if (Math.abs(idx - visibleChunkIndex) > 2) {
        this.loadedChunks.delete(idx);
      }
    }
  }
}
```

### 4.3 Scrolling UI Indicators

```typescript
function createScrollbar(
  renderer: any,
  scrollOffset: number,
  visibleLines: number,
  totalLines: number
): TextRenderable {
  const scrollPercent = scrollOffset / totalLines;
  const barHeight = Math.max(1, Math.floor((visibleLines / totalLines) * visibleLines));
  const barPosition = Math.floor(scrollPercent * visibleLines);

  let bar = '';
  for (let i = 0; i < visibleLines; i++) {
    if (i >= barPosition && i < barPosition + barHeight) {
      bar += '█';
    } else {
      bar += '░';
    }
  }

  return new TextRenderable(renderer, {
    id: 'scrollbar',
    content: bar,
    fg: '#666666',
    position: 'absolute',
    right: 0,
    top: 0,
  });
}
```

---

## 5. Performance Characteristics

### 5.1 Scaling Limits

| File Size | Lines | Components | Performance | Recommendation |
|-----------|-------|-----------|-------------|-----------------|
| < 10 KB | < 100 | 100-200 | ✅ Excellent | Direct rendering |
| 10-100 KB | 100-1K | 1K-2K | ✅ Good | Direct rendering |
| 100 KB - 1 MB | 1K-10K | 2K-20K | ⚠️ Acceptable | Consider virtual scrolling |
| 1-10 MB | 10K-100K | 20K-200K | ❌ Problematic | **MUST use virtual scrolling** |
| > 10 MB | > 100K | > 200K | ❌ Not viable | Chunked loading required |

### 5.2 Performance Tips

```typescript
// ✅ DO: Render only visible content
const visibleLines = lines.slice(scrollOffset, scrollOffset + visibleHeight);
container.removeAll();
visibleLines.forEach(line => container.add(createLineElement(line)));

// ✅ DO: Batch container operations
const batch = new GroupRenderable(renderer, { id: 'batch' });
for (const line of lines) batch.add(createLineElement(line));
renderer.root.add(batch);  // Add once

// ❌ DON'T: Add items one by one
lines.forEach(line => renderer.root.add(createLineElement(line)));

// ❌ DON'T: Render entire 10MB file
const allLines = hugeFile.split('\n');  // Creates massive array
allLines.forEach(line => container.add(createLineElement(line)));

// ✅ DO: Use passive mode for static code display
const renderer = await createCliRenderer();
// Don't call renderer.start() - re-renders on demand

// ✅ DO: Use live mode only if animating
if (showingAnimations) {
  await renderer.start();
}
```

### 5.3 Memory Usage Estimates

```typescript
// Approximate memory per TextRenderable:
// - Base object: ~100 bytes
// - Text content (string): ~2 bytes per character
// - Layout data: ~50 bytes

// Example: 10,000-line file
// Average 50 chars per line
// Segments average 3 per line (colored code)

const linesCount = 10000;
const segmentsPerLine = 3;
const charsPerSegment = 17;

const totalComponents = linesCount + (linesCount * segmentsPerLine);
const contentSize = linesCount * segmentsPerLine * charsPerSegment * 2;
const objectOverhead = totalComponents * 150;

const totalMemory = contentSize + objectOverhead;
// ≈ 5 MB total
```

---

## 6. Comparison: Manual Text vs. Dedicated Component

### 6.1 Why No Dedicated CodeBlock Component?

OpenTUI's philosophy: **composition over built-in components**

```
CodeBlock = TextRenderable + SyntaxHighlighting + Layout + Scrolling
```

**Advantages:**
✅ Flexibility - combine features as needed
✅ Lightweight core - each component does one thing
✅ Custom styling - colors, fonts, borders all configurable
✅ Easier to extend - add features incrementally

**Trade-offs:**
❌ More boilerplate initially
❌ Requires understanding multiple components
❌ Responsibility on developer for large file handling

### 6.2 Compared to Other Frameworks

| Framework | Approach | Ease | Flexibility | Performance |
|-----------|----------|------|-------------|------------|
| **OpenTUI** | Composition | Medium | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Ink** (React) | JSX + HTML | Easy | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Blessed** | jQuery-like | Hard | ⭐⭐ | ⭐⭐⭐⭐ |
| **Rich** (Python) | High-level | Easy | ⭐⭐⭐ | ⭐⭐⭐ |

---

## 7. Real-World Example: Open-S3 PreviewPane

### 7.1 Complete Implementation

**File: `src/utils/syntax-highlighting.ts`**

Core features:
- Language detection from file extension
- HTML → color segment parsing
- Support for 20+ languages
- Fallback to plaintext

**File: `src/ui/preview-pane-react.tsx`**

Features:
- React component wrapper
- Syntax highlighting integration
- Line count display
- Overflow clipping
- Flexbox responsive layout

### 7.2 Key Implementation Details

```typescript
// Syntax highlighting returns structured data:
export interface HighlightedLine {
  segments: TextSegment[];  // Not HTML strings!
}

export interface TextSegment {
  text: string;
  color?: string;  // Hex color code
}

// Rendering is straightforward:
lines.map((line, idx) => (
  <box key={idx} flexDirection="row">
    {line.segments.map((segment, segIdx) => (
      <text key={segIdx} fg={segment.color}>
        {segment.text}
      </text>
    ))}
  </box>
))
```

### 7.3 Color Mapping

```typescript
// Map highlight.js token classes to terminal colors
function mapHighlightColor(hlToken: string): string {
  if (hlToken.includes('string')) return '#a6e3a1';    // Green
  if (hlToken.includes('keyword')) return '#cba6f7';   // Purple
  if (hlToken.includes('number')) return '#f8b88b';    // Orange
  if (hlToken.includes('comment')) return '#6c7086';   // Gray
  if (hlToken.includes('function')) return '#89b4fa';  // Blue
  // ... more token types
  return '#cdd6f4';  // Default text color
}
```

---

## 8. Limitations and Gotchas

### 8.1 Known Limitations

| Issue | Workaround |
|-------|-----------|
| **No built-in text wrapping** | Split long lines manually or use Container with fixed width |
| **No text selection** | Not supported in terminal TUIs generally |
| **No copy-to-clipboard** | Implement custom keybinding |
| **Single rendering layer** | Use absolute positioning for overlays |
| **Line wrapping breaks layout** | Use monospace assumptions (1 char = 1 column) |
| **Large files freeze UI** | Use virtual scrolling |
| **No search/find** | Build custom search component |

### 8.2 Gotchas

```typescript
// ❌ WRONG: Content extends beyond container
const text = new TextRenderable(renderer, {
  content: 'Very long line ' * 100,
  width: 30,  // Doesn't wrap!
});

// ✅ CORRECT: Pre-wrap content
const lines = content
  .split('\n')
  .map(line => line.substring(0, 30))  // Truncate
  .join('\n');

// ❌ WRONG: Assuming text renders instantly
const lines = highlightCode(bigFile, 'file.js');  // Synchronous - blocks UI!

// ✅ CORRECT: Highlight in chunks
async function highlightChunked(file: string, chunkSize: number) {
  for (let i = 0; i < file.length; i += chunkSize) {
    const chunk = file.substring(i, i + chunkSize);
    await processChunk(chunk);
    await new Promise(resolve => setTimeout(resolve, 0));  // Yield
  }
}

// ❌ WRONG: Each character gets its own Text element
code.split('').forEach(char => {
  box.add(new TextRenderable(renderer, { content: char }));
});

// ✅ CORRECT: Group by color, not by character
line.segments.forEach(segment => {
  box.add(new TextRenderable(renderer, { 
    content: segment.text,  // Entire segment
    fg: segment.color 
  }));
});
```

### 8.3 Unicode and Special Characters

```typescript
// OpenTUI uses single-width characters by default
// Be careful with:
// - Emoji (multi-width)
// - CJK characters (multi-width)
// - Control characters (cause layout issues)

const cleanContent = content
  .replace(/[\x00-\x1F\x7F]/g, '')  // Remove control chars
  .replace(/[\u2000-\u200D]/g, '');  // Remove zero-width chars
```

---

## 9. Best Practices

### 9.1 Do's ✅

```typescript
// ✅ Use semantic containers
const codeBox = new BoxRenderable(renderer, {
  title: 'code.js',
  borderStyle: 'rounded',
  overflow: 'hidden',
});

// ✅ Pre-compute highlighting
const lines = highlightCode(content, filename);
// Then render incrementally

// ✅ Implement virtual scrolling for > 1000 lines
if (lines.length > 1000) {
  new VirtualScroller(renderer, lines);
}

// ✅ Show loading state for large files
showLoadingIndicator();
const lines = await highlightCodeAsync(hugeFile);
hideLoadingIndicator();

// ✅ Handle errors gracefully
try {
  const highlighted = highlightCode(content, filename);
} catch (err) {
  // Fallback to plaintext
  const lines = content.split('\n').map(text => ({
    segments: [{ text }]
  }));
}
```

### 9.2 Don'ts ❌

```typescript
// ❌ Don't highlight synchronously for huge files
const lines = highlightCode(readFileSync('100MB.txt'), 'file.txt');
// Blocks entire app!

// ❌ Don't create separate Text for each character
content.split('').forEach((char, i) => {
  box.add(new TextRenderable(renderer, { content: char }));
});

// ❌ Don't assume line length = terminal columns
// Account for ANSI codes, emoji, special chars

// ❌ Don't forget to clean up containers
renderer.root.removeAll();  // Before adding new content

// ❌ Don't use live rendering for static code
const renderer = await createCliRenderer();
await renderer.start();  // Wastes CPU if not animating!
```

---

## 10. Future Enhancements

### 10.1 Potential Improvements

1. **Built-in ScrollBoxRenderable** - for automatic scrolling
2. **VirtualListRenderable** - for efficient large lists
3. **SearchHighlighting** - search UI component
4. **LineNumberSupport** - native line numbers
5. **DiffViewRenderable** - for showing diffs
6. **FoldingGutterRenderable** - code folding UI

### 10.2 Community Packages to Watch

- [opentui-table](https://github.com/msmps/opentui-table) - tabular data
- [opentui-tree](https://github.com/msmps/opentui-tree) - tree view
- [opentui-list](https://github.com/msmps/opentui-list) - scrollable lists

---

## 11. Resources

### 11.1 Official Documentation

- **GitHub**: https://github.com/sst/opentui
- **Homepage**: https://opentui.com
- **Examples**: https://github.com/sst/opentui/tree/main/packages/core/src/examples

### 11.2 Related Projects

- **open-s3**: Reference implementation with syntax highlighting
- **opencode**: IDE built with OpenTUI
- **highlight.js**: Syntax highlighting library

### 11.3 Further Reading

See related research docs:
- `comprehensive-guide.md` - Full OpenTUI API
- `architecture-guide.md` - Deep dive on rendering pipeline
- `implementation-patterns.md` - Common patterns

---

## Quick Reference: Code Block API

```typescript
// 1. Basic text rendering
new TextRenderable(renderer, {
  content: string;
  fg: '#RRGGBB';
  attributes?: TextAttributes;
});

// 2. With syntax highlighting
highlightCode(content: string, filename: string): HighlightedLine[];

// 3. Container with scrolling
new BoxRenderable(renderer, {
  overflow: 'hidden';
  flexDirection: 'column';
});

// 4. Virtual scrolling (large files)
class VirtualCodeScroller {
  scroll(direction: 'up' | 'down', amount: number): void;
}

// 5. Keyboard navigation
renderer.keyInput.on('keypress', (key: KeyEvent) => {
  if (key.name === 'pagedown') scroller.scroll('down', 10);
});
```

---

**Last Updated:** November 2025
**Status:** Complete
**Accuracy:** Based on OpenTUI v0.1.44 and open-s3 reference implementation
