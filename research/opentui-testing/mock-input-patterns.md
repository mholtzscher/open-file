# Mock Input Patterns - Keyboard & Mouse Testing

## Mock Keyboard Input

### Source: `packages/core/src/testing/mock-keys.ts`

The `mockInput` object provides comprehensive keyboard mocking capabilities.

### Basic Key Constants

```typescript
const KeyCodes = {
  // Control keys
  RETURN: "\r",
  LINEFEED: "\n",
  TAB: "\t",
  BACKSPACE: "\b",
  DELETE: "\x1b[3~",
  HOME: "\x1b[H",
  END: "\x1b[F",
  ESCAPE: "\x1b",

  // Arrow keys
  ARROW_UP: "\x1b[A",
  ARROW_DOWN: "\x1b[B",
  ARROW_RIGHT: "\x1b[C",
  ARROW_LEFT: "\x1b[D",

  // Function keys
  F1: "\x1bOP",
  F2: "\x1bOQ",
  // ... F3-F12
}
```

### API Methods

#### 1. Single Key Press

```typescript
// Press individual keys
mockInput.pressKey("a")
mockInput.pressKey("RETURN")
mockInput.pressKey("ARROW_UP")

// With modifiers
mockInput.pressKey("a", { shift: true })        // Shift+A
mockInput.pressKey("c", { ctrl: true })         // Ctrl+C
mockInput.pressKey("l", { meta: true })         // Meta+L (Alt+L)
mockInput.pressKey("s", { ctrl: true, shift: true })  // Ctrl+Shift+S
```

#### 2. Multiple Keys

```typescript
// Press multiple keys in sequence
await mockInput.pressKeys(["ARROW_UP", "ARROW_UP", "RETURN"])

// With delay between keys
await mockInput.pressKeys(["a", "b", "c"], 50)  // 50ms delay per key
```

#### 3. Type Text

```typescript
// Type a string character by character
await mockInput.typeText("hello world")

// With delay (useful for testing animation)
await mockInput.typeText("slow typing", 100)  // 100ms per character
```

#### 4. Special Key Helpers

```typescript
// Common keys with dedicated methods
mockInput.pressEnter()              // Alias for RETURN
mockInput.pressEscape()
mockInput.pressTab()
mockInput.pressBackspace()
mockInput.pressCtrlC()              // Ctrl+C interrupt

// Arrow keys
mockInput.pressArrow("up")
mockInput.pressArrow("down")
mockInput.pressArrow("left")
mockInput.pressArrow("right")

// With modifiers on arrows
mockInput.pressArrow("up", { shift: true })     // Shift+Up
mockInput.pressArrow("right", { ctrl: true })   // Ctrl+Right
```

#### 5. Advanced: Clipboard Pasting

```typescript
// Simulate bracketed paste (terminal safe paste)
await mockInput.pasteBracketedText("multi\nline\ntext")
```

### Protocol Support

OpenTUI supports multiple keyboard protocols:

#### Standard ANSI (Default)

```typescript
mockInput.pressKey("a")                    // → "a"
mockInput.pressKey("ARROW_UP")             // → "\x1b[A"
mockInput.pressKey("RETURN", { ctrl: true }) // → "\r" (Ctrl+C → Ctrl+@)
```

#### Kitty Keyboard Protocol

```typescript
// Enable with: createTestRenderer({ kittyKeyboard: true })
// Kitty format: CSI unicode-key-code ; modifiers u
mockInput.pressKey("a", { ctrl: true })    // → "\x1b[97;5u"
mockInput.pressKey("ARROW_UP", { shift: true })  // → "\x1b[57352;2u"
```

#### modifyOtherKeys Protocol (xterm/iTerm2)

```typescript
// Enable with: createTestRenderer({ otherModifiersMode: true })
// Format: CSI 27 ; modifier ; code ~
mockInput.pressKey("a", { ctrl: true })    // → "\x1b[27;5;97~"
```

### Example Test: Keyboard Input

```typescript
import { describe, test, expect } from "bun:test"
import { createTestRenderer } from "@opentui/core/testing"

describe("Keyboard Input", () => {
  test("typing text in textarea", async () => {
    const { renderer, renderOnce, captureCharFrame, mockInput } =
      await createTestRenderer({ width: 40, height: 10 })

    // Setup textarea component
    const textarea = new TextareaRenderable(renderer, {
      width: "100%",
      height: "100%",
    })
    renderer.root.add(textarea)

    // Type some text
    await mockInput.typeText("Hello")
    await renderOnce()

    let frame = captureCharFrame()
    expect(frame).toContain("Hello")

    // Press arrow keys and add more
    mockInput.pressArrow("left")
    mockInput.pressArrow("left")
    mockInput.pressArrow("left")
    mockInput.pressArrow("left")
    mockInput.pressArrow("left")  // Move to start
    await mockInput.typeText(">> ")
    await renderOnce()

    frame = captureCharFrame()
    expect(frame).toContain(">> Hello")
  })

  test("keyboard shortcuts", async () => {
    const { mockInput } = await createTestRenderer()

    // Ctrl+C interrupt
    mockInput.pressCtrlC()

    // Ctrl+A select all
    mockInput.pressKey("a", { ctrl: true })

    // Ctrl+Z undo
    mockInput.pressKey("z", { ctrl: true })

    // Ctrl+Shift+Z redo
    mockInput.pressKey("z", { ctrl: true, shift: true })
  })
})
```

---

## Mock Mouse Input

### Source: `packages/core/src/testing/mock-mouse.ts`

The `mockMouse` object provides comprehensive mouse event simulation.

### Mouse Button Constants

```typescript
const MouseButtons = {
  LEFT: 0,
  MIDDLE: 1,
  RIGHT: 2,
  WHEEL_UP: 64,
  WHEEL_DOWN: 65,
  WHEEL_LEFT: 66,
  WHEEL_RIGHT: 67,
}
```

### API Methods

#### 1. Click Actions

```typescript
// Single click
await mockMouse.click(x, y)
await mockMouse.click(x, y, MouseButtons.RIGHT)  // Right click

// With modifiers
await mockMouse.click(x, y, MouseButtons.LEFT, {
  modifiers: { shift: true, ctrl: true }
})

// Double click
await mockMouse.doubleClick(x, y)
await mockMouse.doubleClick(x, y, MouseButtons.RIGHT)

// With timing control
await mockMouse.click(x, y, MouseButtons.LEFT, { delayMs: 50 })
```

#### 2. Mouse Position

```typescript
// Move mouse without pressing button
await mockMouse.moveTo(x, y)
await mockMouse.moveTo(x, y, { delayMs: 100 })

// With modifiers
await mockMouse.moveTo(x, y, {
  modifiers: { shift: true }
})
```

#### 3. Drag and Drop

```typescript
// Drag from start position to end position
await mockMouse.drag(startX, startY, endX, endY)

// Custom button and modifiers
await mockMouse.drag(startX, startY, endX, endY, MouseButtons.LEFT, {
  modifiers: { shift: true },
  delayMs: 50
})
```

#### 4. Scroll Events

```typescript
// Scroll at position
await mockMouse.scroll(x, y, "up")
await mockMouse.scroll(x, y, "down")
await mockMouse.scroll(x, y, "left")
await mockMouse.scroll(x, y, "right")

// With modifiers
await mockMouse.scroll(x, y, "down", {
  modifiers: { shift: true }
})
```

#### 5. Low-Level Pressure

```typescript
// Press and hold
await mockMouse.pressDown(x, y, MouseButtons.LEFT)

// Release
await mockMouse.release(x, y, MouseButtons.LEFT)

// Useful for multi-button interactions
await mockMouse.pressDown(x1, y1, MouseButtons.LEFT)
await mockMouse.moveTo(x2, y2)  // Drag while held
await mockMouse.release(x2, y2, MouseButtons.LEFT)
```

#### 6. State Inspection

```typescript
// Get current mouse position
const pos = mockMouse.getCurrentPosition()
console.log(pos)  // { x: 10, y: 5 }

// Get currently pressed buttons
const buttons = mockMouse.getPressedButtons()
console.log(buttons)  // [0, 2] means LEFT and RIGHT pressed
```

### Mouse Event Protocol (SGR Format)

OpenTUI uses the SGR (Select Graphic Rendition) mouse protocol internally:

```
CSI < b ; x ; y M|m
```

Where:
- `b` = button code + modifier flags
- `x`, `y` = 1-based coordinates
- `M` = button press
- `m` = button release

Example: `\x1b<0;10;5M` = left mouse button down at (9,4) in 0-based coords

### Example Test: Mouse Input

```typescript
import { describe, test, expect } from "bun:test"
import { createTestRenderer, MouseButtons } from "@opentui/core/testing"

describe("Mouse Input", () => {
  test("click to select item", async () => {
    const { renderer, renderOnce, captureCharFrame, mockMouse } =
      await createTestRenderer({ width: 40, height: 20 })

    // Setup list component with clickable items
    const list = new ListRenderable(renderer, {
      items: ["Option 1", "Option 2", "Option 3"],
    })
    renderer.root.add(list)

    await renderOnce()

    // Click on second item (at y=3, x=2)
    await mockMouse.click(2, 3)
    await renderOnce()

    const frame = captureCharFrame()
    expect(frame).toContain("Option 2")  // Should be highlighted
  })

  test("scroll in viewport", async () => {
    const { renderer, renderOnce, captureCharFrame, mockMouse } =
      await createTestRenderer({ width: 40, height: 10 })

    const viewport = new ScrollBoxRenderable(renderer, {
      height: "100%",
      width: "100%",
    })
    renderer.root.add(viewport)

    // Scroll down at center of screen
    await mockMouse.scroll(20, 5, "down")
    await renderOnce()

    // Verify scrolling changed view
    const frame = captureCharFrame()
    expect(frame).toMatchSnapshot("after_scroll")
  })

  test("drag to select text", async () => {
    const { renderer, renderOnce, captureCharFrame, mockMouse } =
      await createTestRenderer({ width: 80, height: 10 })

    const text = new TextRenderable(renderer, {
      content: "Select this text",
    })
    renderer.root.add(text)

    // Drag from start to end of word
    await mockMouse.drag(0, 0, 6, 0)  // "Select"
    await renderOnce()

    const frame = captureCharFrame()
    expect(frame).toContain("Select")  // Should be selected
  })
})
```

---

## Keyboard Protocol Comparison

| Protocol | When to Use | Example |
|----------|------------|---------|
| **Standard ANSI** | Default, widest support | `pressKey("a", { ctrl: true })` → `\x01` |
| **Kitty** | Modern terminals (Kitty, WezTerm) | `pressKey("a", { ctrl: true })` → `\x1b[97;5u` |
| **modifyOtherKeys** | xterm, iTerm2, Ghostty | `pressKey("a", { ctrl: true })` → `\x1b[27;5;97~` |

Enable in test:
```typescript
const test1 = await createTestRenderer({ })  // Standard
const test2 = await createTestRenderer({ kittyKeyboard: true })
const test3 = await createTestRenderer({ otherModifiersMode: true })
```

---

## Integration Pattern

```typescript
test("complete user interaction", async () => {
  const { renderer, renderOnce, captureCharFrame, mockInput, mockMouse } =
    await createTestRenderer({ width: 80, height: 24 })

  // Setup
  const form = new FormRenderable(renderer, {})
  renderer.root.add(form)

  // User interaction flow
  await mockMouse.click(10, 2)  // Click on text input
  await renderOnce()

  await mockInput.typeText("John Doe")
  await renderOnce()

  await mockInput.pressTab()  // Tab to next field
  await renderOnce()

  await mockInput.typeText("john@example.com")
  await renderOnce()

  await mockMouse.click(20, 10)  // Click submit button
  await renderOnce()

  const frame = captureCharFrame()
  expect(frame).toContain("Form submitted")
})
```

