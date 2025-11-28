# OpenTUI Testing Framework Research

Complete documentation on how sst/opentui handles testing their React/SolidJS terminal UI components.

## 📋 Table of Contents

1. **[00_START_HERE.md](./00_START_HERE.md)** - Overview and quick reference
2. **[SUMMARY.md](./SUMMARY.md)** - Comprehensive technical summary
3. **[testing-utilities.md](./testing-utilities.md)** - Core testing APIs
4. **[mock-input-patterns.md](./mock-input-patterns.md)** - Keyboard and mouse mocking
5. **[example-tests.md](./example-tests.md)** - Real test examples from OpenTUI
6. **[react-testing-guide.md](./react-testing-guide.md)** - React-specific patterns

## 🚀 Quick Start

**TL;DR:** OpenTUI tests use:
- **Bun test runner** (`bun:test`)
- **Custom TestRenderer** for in-process terminal rendering
- **Mock input system** for keyboard/mouse simulation
- **Low-level buffer access** for pixel-perfect testing

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

## 📚 Documentation Structure

### For Quick Understanding
- Start with: **00_START_HERE.md**
- Then read: **SUMMARY.md** (architecture overview)
- Reference: **mock-input-patterns.md** (APIs)

### For Implementation
- Deep dive: **testing-utilities.md** (all APIs)
- Learn by example: **example-tests.md** (6+ real examples)
- Framework-specific: **react-testing-guide.md** (if using React)

### For Development
- Copy patterns from **example-tests.md**
- Reference **mock-input-patterns.md** for complex interactions
- Check **testing-utilities.md** for buffer/renderer internals

## 🎯 Key Concepts

### 1. Test Renderer
An in-process renderer that simulates a terminal. No actual output - everything happens in memory.

```typescript
const testSetup = await createTestRenderer({
  width: 80,
  height: 24,
  kittyKeyboard: false,
  otherModifiersMode: false,
})
```

### 2. Render Buffer
Direct access to rendered characters and colors as typed arrays.

```typescript
const buffer = renderer.currentRenderBuffer
const charAt = (x, y) => String.fromCodePoint(
  buffer.buffers.char[y * buffer.width + x]
)
const colorAt = (x, y) => {
  const offset = (y * buffer.width + x) * 4
  return [
    buffer.buffers.fg[offset],     // Red
    buffer.buffers.fg[offset + 1], // Green
    buffer.buffers.fg[offset + 2], // Blue
    buffer.buffers.fg[offset + 3], // Alpha
  ]
}
```

### 3. Input Mocking
Simulate user keyboard and mouse input.

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

### 4. Character Frame
Capture the entire rendered output as a string for assertions.

```typescript
const frame = captureCharFrame()
// Returns:
// "┌─ Title ────────────────┐\n│ Content here            │\n└─────────────────────────┘"
```

## 🔧 Common Patterns

### Pattern 1: Basic Test
```typescript
test("renders correctly", async () => {
  const { renderer, renderOnce, captureCharFrame } = 
    await createTestRenderer({ width: 80, height: 24 })
  renderer.root.add(myComponent)
  await renderOnce()
  expect(captureCharFrame()).toContain("expected")
})
```

### Pattern 2: Setup/Teardown
```typescript
describe("MyComponent", () => {
  let renderer: TestRenderer

  beforeEach(async () => {
    ;({ renderer } = await createTestRenderer({ width: 80, height: 24 }))
  })

  afterEach(() => {
    renderer.destroy()
  })

  test("...", async () => {
    // Use renderer
  })
})
```

### Pattern 3: User Interaction
```typescript
test("user interaction", async () => {
  const { renderOnce, captureCharFrame, mockInput } = 
    await createTestRenderer({ width: 80, height: 24 })
  renderer.root.add(form)
  
  mockInput.typeText("John")
  mockInput.pressTab()
  mockInput.typeText("john@example.com")
  await renderOnce()
  
  expect(captureCharFrame()).toContain("John")
  expect(captureCharFrame()).toContain("john@example.com")
})
```

### Pattern 4: React Component
```typescript
import { testRender } from "@opentui/react/test-utils"

test("React component", async () => {
  const { renderOnce, captureCharFrame, mockInput } = 
    await testRender(<MyComponent />, { width: 80, height: 24 })
  
  mockInput.typeText("test")
  await renderOnce()
  expect(captureCharFrame()).toContain("test")
})
```

## 📖 API Quick Reference

### createTestRenderer()
```typescript
{
  renderer,           // CliRenderer instance
  mockInput,          // Keyboard mocking
  mockMouse,          // Mouse mocking
  renderOnce,         // () => Promise<void> - render one frame
  captureCharFrame,   // () => string - get rendered output
  resize,             // (w, h) => void - resize terminal
} = await createTestRenderer({
  width: 80,
  height: 24,
  kittyKeyboard: false,
  otherModifiersMode: false,
})
```

### mockInput
```typescript
mockInput.typeText(text, delayMs?)
mockInput.pressKeys(keys, delayMs?)
mockInput.pressKey(key, modifiers?)
mockInput.pressEnter()
mockInput.pressEscape()
mockInput.pressTab()
mockInput.pressBackspace()
mockInput.pressCtrlC()
mockInput.pressArrow(direction, modifiers?)
await mockInput.pasteBracketedText(text)
```

### mockMouse
```typescript
await mockMouse.click(x, y, button?, options?)
await mockMouse.doubleClick(x, y, button?, options?)
await mockMouse.moveTo(x, y, options?)
await mockMouse.drag(x1, y1, x2, y2, button?, options?)
await mockMouse.scroll(x, y, direction, options?)
await mockMouse.pressDown(x, y, button?, options?)
await mockMouse.release(x, y, button?, options?)
mockMouse.getCurrentPosition()
mockMouse.getPressedButtons()
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│      Test Runner (bun:test)             │
├─────────────────────────────────────────┤
│  React/SolidJS Wrapper (testRender)     │
│              ↓                          │
│  Core Testing Module (createTestRenderer)
│              ↓                          │
│  CliRenderer                            │
│  - Render Buffer (chars, colors)        │
│  - Input Streams                        │
│  - Output Capture                       │
│              ↓                          │
│  Mock Input System + Zig Library        │
└─────────────────────────────────────────┘
```

## 🎓 Learning Path

1. **Understand the concept** → Read [00_START_HERE.md](./00_START_HERE.md)
2. **Learn the architecture** → Read [SUMMARY.md](./SUMMARY.md)
3. **Study the APIs** → Read [testing-utilities.md](./testing-utilities.md)
4. **See examples** → Read [example-tests.md](./example-tests.md)
5. **For React** → Read [react-testing-guide.md](./react-testing-guide.md)
6. **For keyboard/mouse** → Read [mock-input-patterns.md](./mock-input-patterns.md)

## 💡 Key Insights

### Testing Approach
- **In-process**: Render happens in memory, no terminal output
- **Imperative**: Direct control over rendering, input, and frame capture
- **Low-level**: Access to character and color buffers for pixel-perfect testing
- **Modular**: Core utilities work with any reconciler (React, SolidJS, etc.)

### Protocol Support
OpenTUI supports multiple keyboard protocols:
- **Standard ANSI** (default) - Widest compatibility
- **Kitty Protocol** - Modern terminals (Kitty, WezTerm)
- **modifyOtherKeys** - xterm, iTerm2, Ghostty

### Mouse Events
Uses SGR (Select Graphic Rendition) protocol for mouse events.

## 🔗 Source References

**OpenTUI Repo**: https://github.com/sst/opentui
- Core Testing: `packages/core/src/testing/`
- React Testing: `packages/react/src/test-utils.ts`
- SolidJS Testing: `packages/solid/index.ts`
- Test Examples: `packages/core/src/renderables/__tests__/`

**OpenCode Repo**: https://github.com/sst/opencode
- Uses OpenTUI + SolidJS for TUI

## ✅ Checklist for Our Implementation

- [ ] Study this research (start with 00_START_HERE.md)
- [ ] Understand existing component structure
- [ ] Implement TestRenderer similar to OpenTUI
- [ ] Create keyboard/mouse mocking utilities
- [ ] Set up Bun test runner integration
- [ ] Write tests for key components
- [ ] Document testing patterns

## 📝 Notes

- All examples are from actual OpenTUI test files
- Code patterns are production-tested
- Research is applicable to our React TUI components
- Documentation includes 2350+ lines of detailed information

---

**Research completed**: November 27, 2025
**Source repositories**: sst/opentui, sst/opencode
**Documentation files**: 6 markdown files with code examples
