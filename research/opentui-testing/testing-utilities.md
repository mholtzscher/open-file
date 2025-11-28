# OpenTUI Testing Utilities

## Core Testing Module

OpenTUI provides a dedicated testing module exported from `@opentui/core/testing`.

### File: `packages/core/src/testing.ts`

```typescript
// Testing utilities module exports
export * from './testing/test-renderer';
export * from './testing/mock-keys';
export * from './testing/mock-mouse';
export * from './testing/mock-tree-sitter-client';
export * from './testing/spy';
```

---

## TestRenderer - Main Testing API

### Source: `packages/core/src/testing/test-renderer.ts`

The `createTestRenderer()` function is the entry point for all TUI tests.

### API Signature

```typescript
export async function createTestRenderer(options: TestRendererOptions): Promise<{
  renderer: TestRenderer;
  mockInput: MockInput;
  mockMouse: MockMouse;
  renderOnce: () => Promise<void>;
  captureCharFrame: () => string;
  resize: (width: number, height: number) => void;
}>;
```

### Configuration

```typescript
export interface TestRendererOptions extends CliRendererConfig {
  width?: number; // Terminal width (default: 80)
  height?: number; // Terminal height (default: 24)
  kittyKeyboard?: boolean; // Kitty keyboard protocol support
  otherModifiersMode?: boolean; // modifyOtherKeys protocol
}
```

### Return Values

#### 1. `renderer: TestRenderer`

- Main renderer instance
- Attach components to `renderer.root.add(component)`
- Access render buffers: `renderer.currentRenderBuffer`
- Methods:
  - `destroy()` - Cleanup
  - `setFrameCallback(fn)` - On each frame
  - `addPostProcessFn(fn)` - Post-processing

#### 2. `mockInput: MockInput`

Mock keyboard input handler. See [Mock Input Setup](./mock-input-patterns.md).

#### 3. `mockMouse: MockMouse`

Mock mouse input handler. See [Mock Input Setup](./mock-input-patterns.md).

#### 4. `renderOnce: () => Promise<void>`

Triggers a single render frame.

```typescript
await renderOnce(); // Executes one frame
```

#### 5. `captureCharFrame: () => string`

Captures the current frame as a string of characters.

```typescript
const frame = captureCharFrame();
// Returns something like:
// "┌─ Title ────────────────┐\n│ Content here            │\n└─────────────────────────┘"
```

#### 6. `resize: (width: number, height: number) => void`

Resizes the terminal.

```typescript
resize(100, 30); // Change to 100x30 terminal
```

---

## Render Buffer Access

The `TestRenderer` exposes the current render buffer for pixel-perfect testing:

```typescript
const buffer = renderer.currentRenderBuffer;

// Buffer structure
interface RenderBuffer {
  width: number;
  height: number;
  buffers: {
    char: Uint32Array; // Unicode codepoints
    fg: Uint8ClampedArray; // Foreground RGBA
    bg: Uint8ClampedArray; // Background RGBA
    flags: Uint16Array; // Style flags (bold, italic, etc.)
  };
}

// Access individual pixels
const getColorAt = (x: number, y: number) => {
  const offset = (y * buffer.width + x) * 4;
  return {
    r: buffer.buffers.fg[offset] / 255,
    g: buffer.buffers.fg[offset + 1] / 255,
    b: buffer.buffers.fg[offset + 2] / 255,
    a: buffer.buffers.fg[offset + 3] / 255,
  };
};

// Get character at position
const getCharAt = (x: number, y: number) => {
  return String.fromCodePoint(buffer.buffers.char[y * buffer.width + x]);
};
```

---

## React Testing Wrapper

### File: `packages/react/src/test-utils.ts`

For React components, OpenTUI provides a wrapper that integrates `React.act()`:

```typescript
import { testRender } from '@opentui/react/test-utils';

async function testRender(
  node: ReactNode,
  testRendererOptions: TestRendererOptions
): Promise<ReturnType<typeof createTestRenderer>>;
```

#### Usage Example

```typescript
const testSetup = await testRender(
  <MyComponent />,
  { width: 80, height: 24 }
)

const { renderer, mockInput, renderOnce, captureCharFrame } = testSetup

await renderOnce()
const frame = captureCharFrame()
expect(frame).toContain("expected text")
```

**Key Differences**:

- Automatically manages React root
- Wraps updates in `React.act()`
- Proper component lifecycle handling
- Cleanup on destroy

---

## SolidJS Testing Wrapper

### File: `packages/solid/index.ts`

For SolidJS components:

```typescript
import { testRender } from "@opentui/solid"

export const testRender = async (
  node: () => JSX.Element,
  renderConfig: TestRendererOptions = {}
): Promise<ReturnType<typeof createTestRenderer>>
```

#### Usage Example

```typescript
const testSetup = await testRender(
  () => <MyComponent />,
  { width: 80, height: 24 }
)
```

---

## Typical Test Structure

```typescript
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { createTestRenderer, type TestRenderer } from '@opentui/core/testing';

describe('MyComponent', () => {
  let testRenderer: TestRenderer;
  let renderOnce: () => Promise<void>;
  let captureCharFrame: () => string;

  beforeEach(async () => {
    ({
      renderer: testRenderer,
      renderOnce,
      captureCharFrame,
    } = await createTestRenderer({
      width: 80,
      height: 24,
    }));
  });

  afterEach(() => {
    testRenderer.destroy();
  });

  test('basic rendering', async () => {
    // Setup
    testRenderer.root.add(myComponent);

    // Execute
    await renderOnce();

    // Assert
    const frame = captureCharFrame();
    expect(frame).toContain('expected text');
  });

  test('snapshot test', async () => {
    testRenderer.root.add(myComponent);
    await renderOnce();
    const frame = captureCharFrame();
    expect(frame).toMatchSnapshot();
  });
});
```

---

## Key Exports

From `@opentui/core/testing`:

| Export                     | Purpose                       |
| -------------------------- | ----------------------------- |
| `createTestRenderer()`     | Main setup function           |
| `type TestRenderer`        | Renderer instance type        |
| `type TestRendererOptions` | Configuration options         |
| `type MockInput`           | Keyboard mock return type     |
| `type MockMouse`           | Mouse mock return type        |
| `KeyCodes`                 | Keyboard key code constants   |
| `MouseButtons`             | Mouse button constants        |
| `MockTreeSitterClient`     | Syntax highlighting mock      |
| `createMockKeys()`         | Direct keyboard mock creation |
| `createMockMouse()`        | Direct mouse mock creation    |

---

## Advanced: Direct Component Testing

You can test renderables directly without going through a reconciler:

```typescript
import { TextRenderable } from '@opentui/core/renderables';
import { createTestRenderer } from '@opentui/core/testing';

test('TextRenderable', async () => {
  const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({
    width: 40,
    height: 10,
  });

  // Create renderable directly
  const text = new TextRenderable(renderer, {
    content: 'Hello, World!',
    fg: '#FFFFFF',
  });

  renderer.root.add(text);
  await renderOnce();

  const frame = captureCharFrame();
  expect(frame).toContain('Hello, World!');
});
```

This is useful for unit testing individual renderables without a UI framework.
