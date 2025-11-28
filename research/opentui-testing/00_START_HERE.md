# OpenTUI Testing Framework Research

## Overview

This research documents how **sst/opentui** tests their terminal UI (TUI) React components. The findings are directly applicable to our own TUI testing needs.

### Key Findings

1. **Test Framework**: Uses **Bun's native test runner** (`bun:test`)
2. **Testing Approach**: Imperative rendering with mock input/output
3. **Core Utilities**: Custom `TestRenderer` and mock input/output helpers
4. **Framework Support**: Both SolidJS and React reconcilers have dedicated testing utilities

### Repository Structure

- **Main OpenTUI Repo**: https://github.com/sst/opentui
- **OpenCode (uses OpenTUI)**: https://github.com/sst/opencode

### Quick Links

- [Testing Utilities Overview](./testing-utilities.md) - Core testing APIs
- [Example Tests](./example-tests.md) - Real test patterns
- [Mock Input Setup](./mock-input-patterns.md) - Keyboard and mouse testing
- [React Testing Guide](./react-testing-guide.md) - React-specific patterns

---

## At a Glance

**Test Framework**: Bun test runner
**Type System**: Full TypeScript support
**TUI Rendering**: Custom in-process renderer for testing
**Input Mocking**: Keyboard and mouse event simulation
**Snapshot Testing**: Supports character frame snapshots

**Key Packages**:
- `@opentui/core/testing` - Core testing utilities
- `@opentui/react/test-utils` - React-specific testing helpers
- `bun:test` - Test runner (similar to Jest/Vitest syntax)

---

## Quick Example

```typescript
import { describe, test, expect } from "bun:test"
import { createTestRenderer } from "@opentui/core/testing"

describe("MyComponent", () => {
  test("renders correctly", async () => {
    const { renderer, renderOnce, captureCharFrame, mockInput } = 
      await createTestRenderer({ width: 80, height: 24 })

    // Setup your component
    renderer.root.add(myComponent)

    // Render
    await renderOnce()

    // Assert
    const frame = captureCharFrame()
    expect(frame).toContain("expected text")
  })
})
```

---

## File Structure

```
packages/core/
├── src/
│   ├── testing/
│   │   ├── test-renderer.ts       # Main test setup
│   │   ├── mock-keys.ts           # Keyboard input mocking
│   │   ├── mock-mouse.ts          # Mouse input mocking
│   │   └── mock-tree-sitter-client.ts
│   ├── renderables/
│   │   └── __tests__/
│   │       ├── LineNumberRenderable.test.ts
│   │       ├── Textarea.error-handling.test.ts
│   │       └── ... more tests
│   └── tests/
│       ├── renderer.palette.test.ts
│       └── scrollbox.test.ts
└── package.json (with "test": "bun run test:js")

packages/react/
├── src/
│   ├── test-utils.ts              # React testing wrapper
│   └── ... components
└── package.json (with "test": "bun test")

packages/solid/
├── index.ts                        # Has testRender export
└── ... components
```

---

## Next Steps

1. Review [Testing Utilities Overview](./testing-utilities.md)
2. Study [Example Tests](./example-tests.md) 
3. Learn mock input patterns in [Mock Input Setup](./mock-input-patterns.md)
4. For React: [React Testing Guide](./react-testing-guide.md)

