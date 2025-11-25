# OpenTUI Code Blocks - Quick Reference

## TL;DR

- **No dedicated CodeBlock component** ✗
- **Use TextRenderable + Box container** ✓
- **Syntax highlighting via highlight.js** ✓
- **Manual scrolling implementation needed** ✓

---

## Component Names & Imports

```typescript
import {
  TextRenderable, // For text display
  BoxRenderable, // For containers with borders
  GroupRenderable, // For flex layout
  TextAttributes, // Text styling flags
} from '@opentui/core';
```

---

## API Quick Reference

### TextRenderable Props

```typescript
{
  id: string;                           // Required
  content: string;                      // Text to display
  fg?: string;                          // Color: '#RRGGBB'
  backgroundColor?: string;            // Background color
  attributes?: number;                 // BOLD | UNDERLINE | etc
  width?: number;                       // In columns
  height?: number;                      // In rows
  flexGrow?: number;                    // Flex sizing
  position?: 'absolute' | 'relative';  // Positioning
  left?: number;                        // X position
  top?: number;                         // Y position
}
```

### BoxRenderable Props (Key for Code)

```typescript
{
  id: string;
  overflow?: 'hidden' | 'scroll' | 'visible';  // 👈 IMPORTANT
  borderStyle?: 'rounded' | 'single' | 'double' | 'ascii';
  borderColor?: string;
  title?: string;                       // Box title
  flexDirection?: 'row' | 'column';
  gap?: number;                         // Space between items
  padding?: { top, left, right, bottom };
  backgroundColor?: string;
  width?: number | string;              // Columns or '%'
  height?: number | string;             // Rows or '%'
  flexGrow?: number;                    // Grow factor
}
```

### TextAttributes Flags

```typescript
TextAttributes.BOLD; // 0x01
TextAttributes.DIM; // 0x02
TextAttributes.ITALIC; // 0x04
TextAttributes.UNDERLINE; // 0x08
TextAttributes.BLINK; // 0x10
TextAttributes.INVERT; // 0x20
TextAttributes.HIDDEN; // 0x40
TextAttributes.STRIKETHROUGH; // 0x80

// Usage: combine with bitwise OR
attributes: TextAttributes.BOLD | TextAttributes.UNDERLINE;
```

---

## Code Patterns

### 1. Basic Code Display

```typescript
const text = new TextRenderable(renderer, {
  id: 'code',
  content: `function hello() {
  console.log('Hello');
}`,
  fg: '#FFFFFF',
});

const box = new BoxRenderable(renderer, {
  id: 'code-box',
  borderStyle: 'rounded',
  title: 'hello.js',
  overflow: 'hidden',
});

box.add(text);
renderer.root.add(box);
```

### 2. Syntax-Highlighted Code

```typescript
import { highlightCode } from './syntax-highlighting';

const lines = highlightCode(content, 'script.js');

const container = new BoxRenderable(renderer, {
  id: 'code',
  flexDirection: 'column',
  overflow: 'hidden',
});

lines.forEach((line, idx) => {
  const lineBox = new BoxRenderable(renderer, {
    id: `line-${idx}`,
    flexDirection: 'row',
    height: 1,
  });

  line.segments.forEach((seg, segIdx) => {
    const text = new TextRenderable(renderer, {
      id: `seg-${idx}-${segIdx}`,
      content: seg.text,
      fg: seg.color,
    });
    lineBox.add(text);
  });

  container.add(lineBox);
});

renderer.root.add(container);
```

### 3. With Line Numbers

```typescript
const lineContainer = new BoxRenderable(renderer, {
  id: 'lines',
  flexDirection: 'row',
  overflow: 'hidden',
});

// Line numbers column (fixed width)
const numbers = new GroupRenderable(renderer, {
  id: 'numbers',
  flexDirection: 'column',
  width: 5,
  backgroundColor: '#1a1a1a',
});

// Code column (flex grow)
const code = new GroupRenderable(renderer, {
  id: 'code',
  flexDirection: 'column',
  flexGrow: 1,
});

lines.forEach((line, idx) => {
  // Add line number
  numbers.add(
    new TextRenderable(renderer, {
      id: `num-${idx}`,
      content: `${idx + 1}`.padStart(4),
      fg: '#666666',
    })
  );

  // Add code line (simplified)
  const codeLine = new BoxRenderable(renderer, {
    id: `code-${idx}`,
    flexDirection: 'row',
    height: 1,
  });

  line.segments.forEach((seg, segIdx) => {
    codeLine.add(
      new TextRenderable(renderer, {
        id: `seg-${idx}-${segIdx}`,
        content: seg.text,
        fg: seg.color,
      })
    );
  });

  code.add(codeLine);
});

lineContainer.add(numbers);
lineContainer.add(code);
renderer.root.add(lineContainer);
```

### 4. Virtual Scrolling (Large Files)

```typescript
class CodeScroller {
  constructor(renderer, lines, visibleHeight) {
    this.renderer = renderer;
    this.lines = lines;
    this.visibleHeight = visibleHeight;
    this.offset = 0;

    this.container = new GroupRenderable(renderer, {
      id: 'code-scroll',
      flexDirection: 'column',
      height: visibleHeight,
      overflow: 'hidden',
    });
  }

  render() {
    this.container.removeAll();
    const end = Math.min(this.offset + this.visibleHeight, this.lines.length);

    for (let i = this.offset; i < end; i++) {
      const line = this.lines[i];
      const box = new BoxRenderable(this.renderer, {
        id: `line-${i}`,
        flexDirection: 'row',
        height: 1,
      });

      line.segments.forEach((seg, j) => {
        box.add(
          new TextRenderable(this.renderer, {
            id: `seg-${i}-${j}`,
            content: seg.text,
            fg: seg.color,
          })
        );
      });

      this.container.add(box);
    }
  }

  scroll(dir, amount = 1) {
    if (dir === 'down') {
      this.offset = Math.min(this.offset + amount, this.lines.length - this.visibleHeight);
    } else {
      this.offset = Math.max(0, this.offset - amount);
    }
    this.render();
  }
}

// Usage
const scroller = new CodeScroller(renderer, lines, 30);
scroller.render();
renderer.root.add(scroller.container);

renderer.keyInput.on('keypress', key => {
  if (key.name === 'down') scroller.scroll('down', 1);
  if (key.name === 'up') scroller.scroll('up', 1);
  if (key.name === 'pagedown') scroller.scroll('down', 10);
  if (key.name === 'pageup') scroller.scroll('up', 10);
});
```

---

## Syntax Highlighting

### Quick Setup

```bash
bun install highlight.js
```

### detectLanguage()

```typescript
function detectLanguage(filename: string): string | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  const map = {
    js: 'javascript',
    ts: 'typescript',
    py: 'python',
    go: 'go',
    rs: 'rust',
    java: 'java',
    json: 'json',
    yaml: 'yaml',
    html: 'html',
  };
  return map[ext] || null;
}
```

### highlightCode()

```typescript
import hljs from 'highlight.js';

interface TextSegment {
  text: string;
  color?: string;
}
interface HighlightedLine {
  segments: TextSegment[];
}

function highlightCode(code: string, filename: string): HighlightedLine[] {
  const lang = detectLanguage(filename);
  if (!lang) {
    return code.split('\n').map(line => ({
      segments: [{ text: line }],
    }));
  }

  const html = hljs.highlight(code, { language: lang }).value;

  // Parse HTML spans to get colored segments
  // (See full implementation in README.md)
  return lines;
}
```

### Color Mapping

```typescript
function mapColor(hlToken: string): string {
  if (hlToken.includes('string')) return '#a6e3a1'; // Green
  if (hlToken.includes('keyword')) return '#cba6f7'; // Purple
  if (hlToken.includes('number')) return '#f8b88b'; // Orange
  if (hlToken.includes('comment')) return '#6c7086'; // Gray
  if (hlToken.includes('function')) return '#89b4fa'; // Blue
  return '#cdd6f4'; // Default
}
```

---

## Performance Tiers

| Size          | Lines      | Approach       | CPU | Memory |
| ------------- | ---------- | -------------- | --- | ------ |
| < 100 KB      | < 1K       | Direct         | ✅  | ✅     |
| 100 KB - 1 MB | 1K - 10K   | Direct/Virtual | ⚠️  | ⚠️     |
| 1 - 10 MB     | 10K - 100K | Virtual        | ❌  | ⚠️     |
| > 10 MB       | > 100K     | Chunked        | ❌  | ❌     |

---

## Common Mistakes

| ❌ Wrong                                | ✅ Right                        |
| --------------------------------------- | ------------------------------- |
| Create Text for each char               | Create Text per segment         |
| Render entire 100MB file                | Use virtual scrolling           |
| Call `renderer.start()` for static code | Use passive rendering           |
| Forget `overflow: 'hidden'`             | Set overflow to contain content |
| Highlight entire file sync              | Highlight incrementally/chunked |
| Add items one by one                    | Batch in container, add once    |

---

## Limitations

❌ No built-in scrolling  
❌ No line wrapping  
❌ No text selection  
❌ No copy-to-clipboard  
❌ Single rendering layer  
❌ No search/find

**But:** All are solvable with custom code!

---

## Real-World Example Path

1. **See:** `/home/michael/code/open-s3/src/utils/syntax-highlighting.ts`
2. **See:** `/home/michael/code/open-s3/src/ui/preview-pane-react.tsx`
3. **Learn:** Full implementation in `README.md` section 7

---

## More Info

- **Full guide:** `README.md`
- **Advanced patterns:** See section 4 (Virtual Scrolling) in README
- **Gotchas:** See section 8 in README
- **Best practices:** See section 9 in README
