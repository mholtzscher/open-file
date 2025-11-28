# Example Tests from OpenTUI

This document contains real test examples from the OpenTUI repository.

## Source Files

- `packages/core/src/renderables/__tests__/LineNumberRenderable.test.ts`
- `packages/core/src/tests/scrollbox.test.ts`
- `packages/core/src/renderables/__tests__/MultiRenderable.selection.test.ts`

---

## Example 1: Basic Renderable Test

From `LineNumberRenderable.test.ts` - Basic rendering with assertions:

```typescript
import { describe, test, expect } from "bun:test"
import { createTestRenderer } from "../../testing/test-renderer"
import { TextBufferRenderable } from "../TextBufferRenderable"
import { LineNumberRenderable } from "../LineNumberRenderable"
import { BoxRenderable } from "../Box"

class MockTextBuffer extends TextBufferRenderable {
  constructor(ctx: any, options: any) {
    super(ctx, options)
    this.textBuffer.setText(options.text || "")
  }
}

describe("LineNumberRenderable", () => {
  test("renders line numbers correctly", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({
      width: 20,
      height: 10,
    })

    const text = "Line 1\nLine 2\nLine 3"
    const textRenderable = new MockTextBuffer(renderer, {
      text,
      width: "100%",
      height: "100%",
    })

    const lineNumberRenderable = new LineNumberRenderable(renderer, {
      target: textRenderable,
      minWidth: 3,
      paddingRight: 1,
      fg: "white",
      width: "100%",
      height: "100%",
    })

    renderer.root.add(lineNumberRenderable)
    await renderOnce()

    const frame = captureCharFrame()
    expect(frame).toMatchSnapshot()
    expect(frame).toContain(" 1 Line 1")
    expect(frame).toContain(" 2 Line 2")
    expect(frame).toContain(" 3 Line 3")
  })
})
```

**Key Patterns**:
- Setup with `createTestRenderer()`
- Create components and add to `renderer.root`
- Render with `renderOnce()`
- Assert with `captureCharFrame()`
- Use both snapshots and substring checks

---

## Example 2: Color Buffer Testing

From `LineNumberRenderable.test.ts` - Testing exact color values:

```typescript
test("renders line colors for diff highlighting", async () => {
  const { renderer, renderOnce } = await createTestRenderer({
    width: 20,
    height: 10,
  })

  const text = "Line 1\nLine 2\nLine 3\nLine 4\nLine 5"
  const textRenderable = new MockTextBuffer(renderer, {
    text,
    width: "100%",
    height: "100%",
  })

  const lineColors = new Map<number, string>()
  lineColors.set(1, "#2d4a2e") // Green for line 2
  lineColors.set(3, "#4a2d2d") // Red for line 4

  const lineNumberRenderable = new LineNumberRenderable(renderer, {
    target: textRenderable,
    minWidth: 3,
    paddingRight: 1,
    fg: "#ffffff",
    bg: "#000000",
    lineColors: lineColors,
    width: "100%",
    height: "100%",
  })

  renderer.root.add(lineNumberRenderable)
  await renderOnce()

  // Access raw buffer for pixel-perfect testing
  const buffer = renderer.currentRenderBuffer
  const bgBuffer = buffer.buffers.bg

  // Helper to extract RGBA
  const getBgColor = (x: number, y: number) => {
    const offset = (y * buffer.width + x) * 4
    return {
      r: bgBuffer[offset],
      g: bgBuffer[offset + 1],
      b: bgBuffer[offset + 2],
      a: bgBuffer[offset + 3],
    }
  }

  // Check line 2 (index 1) has green background
  const line2GutterBg = getBgColor(2, 1)
  expect(line2GutterBg.r).toBeCloseTo(0x2d / 255, 2)
  expect(line2GutterBg.g).toBeCloseTo(0x4a / 255, 2)
  expect(line2GutterBg.b).toBeCloseTo(0x2e / 255, 2)

  // Check line 2 content area
  const line2ContentBg = getBgColor(10, 1)
  expect(line2ContentBg.r).toBeCloseTo(0x2d / 255, 2)
  expect(line2ContentBg.g).toBeCloseTo(0x4a / 255, 2)
  expect(line2ContentBg.b).toBeCloseTo(0x2e / 255, 2)
})
```

**Key Patterns**:
- Access `renderer.currentRenderBuffer` for low-level testing
- `buffers.fg` - foreground color (RGBA as Uint8ClampedArray)
- `buffers.bg` - background color (RGBA as Uint8ClampedArray)
- `buffers.char` - character codepoints (Uint32Array)
- Calculate offset: `(y * width + x) * 4`
- Normalize colors: divide by 255
- Use `toBeCloseTo()` for floating-point color comparisons

---

## Example 3: Setup and Teardown Pattern

From `scrollbox.test.ts` - Using beforeEach/afterEach:

```typescript
import { test, expect, beforeEach, afterEach, describe } from "bun:test"
import { createTestRenderer, type TestRenderer, type MockMouse } 
  from "../testing"

let renderer: TestRenderer
let renderOnce: () => Promise<void>
let mockMouse: MockMouse
let captureCharFrame: () => string

describe("ScrollBox", () => {
  beforeEach(async () => {
    ;({
      renderer,
      mockMouse,
      renderOnce,
      captureCharFrame,
    } = await createTestRenderer({ width: 80, height: 24 }))
  })

  afterEach(() => {
    renderer.destroy()
  })

  test("scrolls up with mouse wheel", async () => {
    // Setup component
    const scrollBox = new ScrollBoxRenderable(renderer, {
      content: largeContent,
      height: "100%",
      width: "100%",
    })
    renderer.root.add(scrollBox)

    // Initial state
    await renderOnce()
    const beforeScroll = captureCharFrame()

    // User action
    await mockMouse.scroll(40, 12, "up")
    await renderOnce()

    const afterScroll = captureCharFrame()
    expect(afterScroll).not.toEqual(beforeScroll)
  })
})
```

**Key Patterns**:
- Reusable setup in `beforeEach()`
- Cleanup with `renderer.destroy()` in `afterEach()`
- Destructure return values with semicolon-prefix
- Store in outer scope variables
- Multiple assertions on same component state

---

## Example 4: Multi-Renderable Selection Test

From `MultiRenderable.selection.test.ts` - Complex interactions:

```typescript
import { describe, expect, it, beforeEach, afterEach } from "bun:test"
import { 
  createTestRenderer, 
  type TestRenderer, 
  type MockMouse 
} from "../../testing/test-renderer"

let currentRenderer: TestRenderer
let renderOnce: () => Promise<void>
let mockMouse: MockMouse
let captureCharFrame: () => string

describe("MultiRenderable Selection", () => {
  beforeEach(async () => {
    ;({
      renderer: currentRenderer,
      renderOnce,
      mockMouse,
      captureCharFrame,
    } = await createTestRenderer({
      width: 80,
      height: 24,
    }))
  })

  afterEach(() => {
    currentRenderer.destroy()
  })

  it("selects text with mouse drag", async () => {
    const text = new TextRenderable(currentRenderer, {
      content: "Select this text carefully",
    })
    currentRenderer.root.add(text)

    await renderOnce()

    // Click and drag to select
    await mockMouse.drag(0, 0, 6, 0)  // Select "Select"
    await renderOnce()

    const frame = captureCharFrame()
    
    // Verify selection happened
    const buffer = currentRenderer.currentRenderBuffer
    const bgBuffer = buffer.buffers.bg
    
    // Selected area should have different background
    const selectedBg = bgBuffer[0]  // First character's background
    expect(selectedBg).toBeGreaterThan(0)  // Has selection color
  })

  it("handles multi-line selection", async () => {
    const text = "Line 1\nLine 2\nLine 3"
    const renderable = new TextRenderable(currentRenderer, {
      content: text,
    })
    currentRenderer.root.add(renderable)

    await renderOnce()

    // Drag from start of line 1 to end of line 2
    await mockMouse.drag(0, 0, 6, 1)
    await renderOnce()

    const frame = captureCharFrame()
    // Both lines should show selection
    expect(frame).toMatchSnapshot()
  })
})
```

**Key Patterns**:
- Complex setup with destructuring and scope management
- `it()` as alias for `test()`
- Mouse drag for complex interactions
- Buffer inspection for rendering verification
- Snapshot testing for complex layouts

---

## Example 5: Textarea with Keyboard Input

From `Textarea.error-handling.test.ts` - Input handling:

```typescript
import { describe, expect, it, beforeEach, afterEach } from "bun:test"
import { createTestRenderer, type TestRenderer } from "../../testing"
import { TextareaRenderable } from "../Textarea"

let currentRenderer: TestRenderer
let renderOnce: () => Promise<void>

describe("Textarea - Keyboard Input", () => {
  beforeEach(async () => {
    ;({ renderer: currentRenderer, renderOnce } = 
      await createTestRenderer({
        width: 80,
        height: 24,
      }))
  })

  afterEach(() => {
    currentRenderer.destroy()
  })

  it("accepts text input", async () => {
    const textarea = new TextareaRenderable(currentRenderer, {
      width: "100%",
      height: "100%",
    })
    currentRenderer.root.add(textarea)

    // Type text
    mockInput.typeText("Hello World")
    await renderOnce()

    const frame = captureCharFrame()
    expect(frame).toContain("Hello World")
  })

  it("handles cursor movement", async () => {
    const textarea = new TextareaRenderable(currentRenderer, {
      initialValue: "Hello",
      width: "100%",
      height: "100%",
    })
    currentRenderer.root.add(textarea)

    await renderOnce()

    // Move cursor to start
    mockInput.pressKey("a", { ctrl: true })  // Ctrl+A for start
    mockInput.typeText(">>> ")
    await renderOnce()

    const frame = captureCharFrame()
    expect(frame).toContain(">>> Hello")
  })

  it("handles undo/redo", async () => {
    const textarea = new TextareaRenderable(currentRenderer, {
      width: "100%",
      height: "100%",
    })
    currentRenderer.root.add(textarea)

    // Type something
    mockInput.typeText("Test")
    await renderOnce()
    expect(captureCharFrame()).toContain("Test")

    // Undo
    mockInput.pressKey("z", { ctrl: true })
    await renderOnce()
    expect(captureCharFrame()).not.toContain("Test")

    // Redo
    mockInput.pressKey("z", { ctrl: true, shift: true })
    await renderOnce()
    expect(captureCharFrame()).toContain("Test")
  })
})
```

**Key Patterns**:
- `mockInput.typeText()` for character input
- `mockInput.pressKey()` with modifiers for shortcuts
- State changes visible in `captureCharFrame()`
- Testing action-render cycles

---

## Example 6: Renderer Configuration Test

From `renderer.palette.test.ts` - Environment setup:

```typescript
import { test, expect, describe } from "bun:test"
import { createTestRenderer } from "../testing/test-renderer"
import { EventEmitter } from "events"
import { Buffer } from "node:buffer"
import { Readable } from "node:stream"

// Create mock streams for advanced testing
const createMockStreams = () => ({
  mockStdin: new Readable({ read() {} }) as NodeJS.ReadStream,
  mockStdout: new EventEmitter() as any,
})

describe("Palette Caching", () => {
  test("getPalette returns cached palette on subsequent calls", async () => {
    const { mockStdin, mockStdout } = createMockStreams()

    const { renderer } = await createTestRenderer({
      stdin: mockStdin,
      stdout: mockStdout,
    })

    // Test palette caching behavior
    const palette1 = await renderer.getPalette({ timeout: 300 })
    const palette2 = await renderer.getPalette({ timeout: 300 })

    expect(palette1).toBe(palette2)  // Same object reference
  })

  test("custom terminal size", async () => {
    const { renderer, captureCharFrame } = await createTestRenderer({
      width: 160,  // Large terminal
      height: 50,
    })

    // Verify size was applied
    expect(renderer.width).toBe(160)
    expect(renderer.height).toBe(50)

    const frame = captureCharFrame()
    const lines = frame.split("\n")
    expect(lines.length).toBeLessThanOrEqual(50)
  })

  test("resize during rendering", async () => {
    const { renderer, renderOnce, resize, captureCharFrame } =
      await createTestRenderer({
        width: 40,
        height: 10,
      })

    await renderOnce()
    const frameBefore = captureCharFrame()

    // Resize
    resize(80, 20)
    await renderOnce()

    const frameAfter = captureCharFrame()
    expect(frameAfter.length).toBeGreaterThan(frameBefore.length)
  })
})
```

**Key Patterns**:
- Custom stdin/stdout streams for testing
- Direct renderer property access for assertions
- Testing state caching
- Testing dynamic resizing
- Stream creation from Node.js modules

---

## Quick Test Template

```typescript
import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { createTestRenderer, type TestRenderer } from "@opentui/core/testing"

describe("ComponentName", () => {
  let renderer: TestRenderer
  let renderOnce: () => Promise<void>
  let captureCharFrame: () => string
  let mockInput: any
  let mockMouse: any

  beforeEach(async () => {
    ;({
      renderer,
      renderOnce,
      captureCharFrame,
      mockInput,
      mockMouse,
    } = await createTestRenderer({
      width: 80,
      height: 24,
    }))
  })

  afterEach(() => {
    renderer.destroy()
  })

  test("should render correctly", async () => {
    const component = new MyComponent(renderer, {})
    renderer.root.add(component)

    await renderOnce()

    const frame = captureCharFrame()
    expect(frame).toContain("expected text")
  })

  test("should handle user input", async () => {
    const component = new MyComponent(renderer, {})
    renderer.root.add(component)

    mockInput.typeText("user input")
    await renderOnce()

    const frame = captureCharFrame()
    expect(frame).toContain("user input")
  })
})
```

