# OpenTUI Testing Framework - Comprehensive Summary

## Executive Summary

OpenTUI uses a **comprehensive in-process testing framework** for terminal UI components with:

- **Bun test runner** (native, similar to Jest/Vitest API)
- **Custom `TestRenderer`** that simulates terminal rendering
- **Mock input system** for keyboard and mouse events
- **Low-level buffer access** for pixel-perfect testing
- **Framework-agnostic core** with React and SolidJS wrappers

This research provides complete patterns for testing our own TUI components.

---

## Key Technologies

| Component | Technology | File Path |
|-----------|-----------|-----------|
| **Test Runner** | Bun's native test runner | `bun:test` |
| **Core Testing** | Custom TestRenderer | `@opentui/core/testing` |
| **React Integration** | React reconciler wrapper | `@opentui/react/test-utils` |
| **SolidJS Integration** | SolidJS reconciler wrapper | `@opentui/solid` |
| **Keyboard Mocking** | ANSI/Kitty/modifyOtherKeys | `testing/mock-keys.ts` |
| **Mouse Mocking** | SGR mouse protocol | `testing/mock-mouse.ts` |

---

## Architecture

```
┌─────────────────────────────────────────┐
│      Test Runner (bun:test)             │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────────────────────────────┐   │
│  │  React/SolidJS Test Wrapper      │   │
│  │  (testRender)                    │   │
│  └──────────┬───────────────────────┘   │
│             │                           │
│  ┌──────────▼───────────────────────┐   │
│  │  Core Testing Module              │   │
│  │  (createTestRenderer)             │   │
│  └──────────┬───────────────────────┘   │
│             │                           │
│  ┌──────────▼───────────────────────┐   │
│  │  CliRenderer                      │   │
│  │  - Render Buffer (chars, colors)  │   │
│  │  - Input Streams (stdin)          │   │
│  │  - Output Capture                 │   │
│  └──────────┬───────────────────────┘   │
│             │                           │
│  ┌──────────▼────────┬─────────────┐   │
│  │ Mock Input System  │ Zig Library │   │
│  ├────────────────────┼─────────────┤   │
│  │ - Keyboard mocks   │ - Renderer  │   │
│  │ - Mouse mocks      │ - Parser    │   │
│  └────────────────────┴─────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

---

## Core Concepts

### 1. Test Renderer Lifecycle

```typescript
// Create
const testSetup = await createTestRenderer({ width: 80, height: 24 })

// Setup (add components to root)
testSetup.renderer.root.add(myComponent)

// Render (executes one frame)
await testSetup.renderOnce()

// Assert (capture rendered output)
const frame = testSetup.captureCharFrame()
expect(frame).toContain("expected")

// Cleanup
testSetup.renderer.destroy()
```

### 2. Render Buffer Structure

```typescript
const buffer = renderer.currentRenderBuffer

// Character layer (Unicode codepoints)
buffer.buffers.char: Uint32Array  // charAt(y*width+x) = Unicode

// Color layers (RGBA)
buffer.buffers.fg: Uint8ClampedArray  // (y*width+x)*4 = [r,g,b,a]
buffer.buffers.bg: Uint8ClampedArray  // (y*width+x)*4 = [r,g,b,a]

// Style flags (bold, italic, etc.)
buffer.buffers.flags: Uint16Array     // (y*width+x) = flags
```

### 3. Input Mocking Pattern

```typescript
// Keyboard
mockInput.typeText("hello")
mockInput.pressKey("a", { ctrl: true })
mockInput.pressArrow("down")

// Mouse
await mockMouse.click(10, 5)
await mockMouse.drag(0, 0, 10, 10)
await mockMouse.scroll(5, 5, "down")
```

---

## File Structure Reference

```
packages/
├── core/src/
│   ├── testing.ts                         # Main exports
│   ├── testing/
│   │   ├── test-renderer.ts               # createTestRenderer()
│   │   ├── mock-keys.ts                   # createMockKeys()
│   │   ├── mock-mouse.ts                  # createMockMouse()
│   │   └── mock-tree-sitter-client.ts     # MockTreeSitterClient
│   ├── renderables/__tests__/             # Component tests
│   │   ├── LineNumberRenderable.test.ts
│   │   ├── Textarea.error-handling.test.ts
│   │   └── MultiRenderable.selection.test.ts
│   └── tests/                             # Core tests
│       ├── renderer.palette.test.ts
│       └── scrollbox.test.ts
├── react/src/
│   ├── test-utils.ts                      # testRender() for React
│   └── src/
│       ├── components/                    # React components
│       ├── hooks/                         # React hooks
│       └── reconciler/                    # React reconciler
└── solid/
    ├── index.ts                           # testRender() for SolidJS
    └── src/
        ├── elements/                      # SolidJS elements
        └── reconciler/                    # SolidJS reconciler
```

---

## API Quick Reference

### createTestRenderer()

```typescript
const {
  renderer,           // Main CliRenderer instance
  mockInput,          // Keyboard input mock
  mockMouse,          // Mouse input mock
  renderOnce,         // Render one frame async
  captureCharFrame,   // Get frame as string
  resize,             // Resize terminal
} = await createTestRenderer({
  width: 80,                    // Terminal width
  height: 24,                   // Terminal height
  kittyKeyboard: false,         // Kitty protocol support
  otherModifiersMode: false,    // modifyOtherKeys protocol
})
```

### React testRender()

```typescript
const testSetup = await testRender(
  <MyComponent />,           // React component
  { width: 80, height: 24 }  // Options
)
// Returns same as createTestRenderer()
```

### mockInput API

```typescript
// Character input
mockInput.typeText("hello", 100)        // 100ms delay per char
mockInput.pressKeys(["a", "b"], 50)     // Multiple keys with delay

// Named keys
mockInput.pressKey("RETURN")
mockInput.pressKey("ARROW_UP")
mockInput.pressKey("F1")

// With modifiers
mockInput.pressKey("a", { shift: true })      // Shift+A
mockInput.pressKey("c", { ctrl: true })       // Ctrl+C
mockInput.pressKey("l", { meta: true })       // Meta+L
mockInput.pressKey("s", { ctrl: true, shift: true })  // Ctrl+Shift+S

// Helpers
mockInput.pressEnter()
mockInput.pressEscape()
mockInput.pressTab()
mockInput.pressBackspace()
mockInput.pressCtrlC()
mockInput.pressArrow("up", { shift: true })
mockInput.pasteBracketedText("multi\nline")
```

### mockMouse API

```typescript
// Clicking
await mockMouse.click(x, y)
await mockMouse.click(x, y, MouseButtons.RIGHT)
await mockMouse.doubleClick(x, y)

// Positioning
await mockMouse.moveTo(x, y)
await mockMouse.drag(x1, y1, x2, y2)

// Scrolling
await mockMouse.scroll(x, y, "up")
await mockMouse.scroll(x, y, "down")

// Low-level
await mockMouse.pressDown(x, y)
await mockMouse.release(x, y)
mockMouse.getCurrentPosition()
mockMouse.getPressedButtons()
```

---

## Testing Patterns

### Pattern 1: Basic Component Test

```typescript
import { describe, test, expect } from "bun:test"
import { createTestRenderer } from "@opentui/core/testing"

describe("MyComponent", () => {
  test("renders correctly", async () => {
    const { renderer, renderOnce, captureCharFrame } = 
      await createTestRenderer({ width: 80, height: 24 })
    
    renderer.root.add(myComponent)
    await renderOnce()
    
    expect(captureCharFrame()).toContain("expected text")
  })
})
```

### Pattern 2: Setup/Teardown

```typescript
import { describe, test, expect, beforeEach, afterEach } from "bun:test"

describe("MyComponent", () => {
  let renderer: TestRenderer
  let renderOnce: () => Promise<void>
  let captureCharFrame: () => string

  beforeEach(async () => {
    ;({ renderer, renderOnce, captureCharFrame } = 
      await createTestRenderer({ width: 80, height: 24 }))
  })

  afterEach(() => {
    renderer.destroy()
  })

  test("test case", async () => {
    // Use renderer, renderOnce, captureCharFrame
  })
})
```

### Pattern 3: Keyboard Input

```typescript
test("keyboard input", async () => {
  const { renderOnce, captureCharFrame, mockInput } = 
    await createTestRenderer({ width: 80, height: 24 })
  
  renderer.root.add(textarea)
  
  mockInput.typeText("hello")
  mockInput.pressArrow("left")
  mockInput.pressArrow("left")
  mockInput.typeText("!")
  
  await renderOnce()
  
  expect(captureCharFrame()).toContain("he!lo")
})
```

### Pattern 4: Mouse Input

```typescript
test("mouse input", async () => {
  const { renderOnce, captureCharFrame, mockMouse } = 
    await createTestRenderer({ width: 80, height: 24 })
  
  renderer.root.add(listComponent)
  
  await mockMouse.click(10, 5)
  await renderOnce()
  
  expect(captureCharFrame()).toContain("selected")
})
```

### Pattern 5: Color/Style Testing

```typescript
test("color rendering", async () => {
  const { renderer, renderOnce } = 
    await createTestRenderer({ width: 80, height: 24 })
  
  renderer.root.add(component)
  await renderOnce()
  
  const buffer = renderer.currentRenderBuffer
  const bgBuffer = buffer.buffers.bg
  
  const offset = (y * buffer.width + x) * 4
  const color = {
    r: bgBuffer[offset] / 255,
    g: bgBuffer[offset + 1] / 255,
    b: bgBuffer[offset + 2] / 255,
  }
  
  expect(color.r).toBeCloseTo(1.0, 2)  // Red channel
})
```

### Pattern 6: Snapshot Testing

```typescript
test("matches snapshot", async () => {
  const { renderer, renderOnce, captureCharFrame } = 
    await createTestRenderer({ width: 80, height: 24 })
  
  renderer.root.add(complexComponent)
  await renderOnce()
  
  expect(captureCharFrame()).toMatchSnapshot()
})
```

### Pattern 7: React Component

```typescript
import { testRender } from "@opentui/react/test-utils"

test("React component", async () => {
  const { renderOnce, captureCharFrame, mockInput } = 
    await testRender(
      <MyComponent />,
      { width: 80, height: 24 }
    )
  
  await renderOnce()
  mockInput.typeText("test")
  await renderOnce()
  
  expect(captureCharFrame()).toContain("test")
})
```

---

## Important Implementation Details

### 1. Async/Await Pattern
All rendering operations are async:
```typescript
await renderOnce()  // Must await
const frame = captureCharFrame()  // Sync after render
```

### 2. Keyboard Protocol Support
- **Standard ANSI** (default): `\x1bOA` for arrow up
- **Kitty Protocol** (`kittyKeyboard: true`): `\x1b[57352u` for arrow up
- **modifyOtherKeys** (`otherModifiersMode: true`): `\x1b[27;5;97~` for Ctrl+A

### 3. Mouse SGR Format
```
\x1b<button;x;y[M|m]
button = 0 (left), 1 (middle), 2 (right), 64+ (scroll/motion)
x, y = 1-based coordinates
M = press, m = release
```

### 4. Buffer Coordinate System
- Characters indexed as: `char[y * width + x]`
- Colors indexed as: `color[(y * width + x) * 4 + channel]` (RGBA)
- Coordinates are 0-based

### 5. Stream Handling
```typescript
// Default: Uses Node.js process streams
// Custom: Provide mock streams
await createTestRenderer({
  stdin: customReadableStream,
  stdout: customWritableStream,
})
```

---

## Real-World Examples

All examples in [example-tests.md](./example-tests.md) are from actual OpenTUI test files:

1. **LineNumberRenderable.test.ts** - Line number rendering with colors
2. **scrollbox.test.ts** - Mouse wheel scrolling
3. **MultiRenderable.selection.test.ts** - Text selection with drag
4. **Textarea.error-handling.test.ts** - Text input and keyboard shortcuts
5. **renderer.palette.test.ts** - Renderer configuration and resizing

---

## Recommendations for Our Implementation

### Immediate Applicability
1. ✅ Use Bun test runner (already in our project)
2. ✅ Implement similar TestRenderer pattern
3. ✅ Create keyboard/mouse mocking utilities
4. ✅ Support React component testing with `testRender()`

### Testing Strategy
1. **Unit Tests** - Test individual renderables directly
2. **Integration Tests** - Test UI flows with keyboard/mouse
3. **Snapshot Tests** - Verify visual output
4. **Color Tests** - Use buffer access for color verification

### Next Steps
1. Examine our existing component structure
2. Identify which patterns map to our components
3. Implement TestRenderer similar to OpenTUI's
4. Create mock input utilities
5. Write comprehensive tests for key components

---

## References

**OpenTUI Repository**: https://github.com/sst/opentui
- Core Testing: `packages/core/src/testing/`
- React Testing: `packages/react/src/test-utils.ts`
- Test Examples: `packages/core/src/renderables/__tests__/`

**OpenCode Repository**: https://github.com/sst/opencode
- Uses OpenTUI for terminal UI
- Custom TUI components built with @opentui/solid

**Documentation**:
- [Testing Utilities Overview](./testing-utilities.md)
- [Mock Input Setup](./mock-input-patterns.md)
- [Example Tests](./example-tests.md)
- [React Testing Guide](./react-testing-guide.md)

