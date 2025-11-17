# OpenTUI Framework Research Documentation

This directory contains comprehensive research and documentation on the **OpenTUI** framework for building terminal user interfaces (TUIs).

## Contents

### 1. **comprehensive-guide.md** - Main Reference

The complete guide covering:

- Core architecture (CliRenderer, rendering system, layout engine)
- Available UI components (Text, Box, Input, Select, TabSelect, Group, ASCIIFont, FrameBuffer)
- Event handling & keybinding system
- Building interactive TUI applications
- Framework integrations (SolidJS, React)
- Best practices & patterns
- Environment variables
- Quick reference

**Start here for:** Understanding OpenTUI fundamentals and component APIs

### 2. **implementation-patterns.md** - Practical Patterns

Real-world implementation patterns including:

- Application Shell Pattern
- Screen Manager Pattern
- Focus Navigation Pattern
- Modal Dialog Pattern
- Form Handling Pattern
- List Rendering Pattern
- Async Loading Pattern
- Keyboard Shortcut Manager
- Complete Todo CLI example

**Start here for:** Implementing common TUI patterns and solving typical problems

### 3. **architecture-guide.md** - Deep Dives

Advanced architectural topics:

- Rendering pipeline phases
- Component lifecycle and events
- Layout system (Yoga/Flexbox)
- Event architecture & bubbling
- State management patterns
- Performance optimization
- Testing strategies
- Memory management
- Debugging techniques

**Start here for:** Building scalable, maintainable applications

## Quick Start

### Installation

```bash
bun install @opentui/core
```

### Minimal Example

```typescript
import { createCliRenderer, TextRenderable } from '@opentui/core';

const renderer = await createCliRenderer();
const text = new TextRenderable(renderer, {
  id: 'hello',
  content: 'Hello, OpenTUI!',
  fg: '#00FF00',
});
renderer.root.add(text);
renderer.start();
```

### Run Examples

```bash
# From OpenTUI repo
bun create tui        # Quick start
cd packages/core
bun run src/examples/input-demo.ts
```

## Key Concepts

### Renderables

Low-level building blocks that can be positioned, styled, and nested:

- **TextRenderable** - Display text
- **BoxRenderable** - Containers with borders
- **InputRenderable** - Text input fields
- **SelectRenderable** - Dropdown menus
- **GroupRenderable** - Layout containers
- **FrameBufferRenderable** - Custom graphics

### Layout System

Uses Yoga (CSS Flexbox-like):

- Flex layouts with direction, justify, align
- Absolute positioning
- Responsive sizing with percentages
- Gap and padding support

### Event System

EventEmitter-based architecture:

- Global keyboard input: `renderer.keyInput.on("keypress", ...)`
- Component events: `component.on(RenderableEvents.FOCUSED, ...)`
- Custom events on any component

### Rendering Modes

- **Passive** (default) - Only render when tree changes, CPU efficient
- **Live** - Continuous rendering loop via `renderer.start()`

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│         CliRenderer (Central Hub)           │
├─────────────────────────────────────────────┤
│ • Terminal Output Management                │
│ • Rendering Loop (optional)                 │
│ • Event Distribution                        │
│ • Focus Management                          │
└─────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────┐
│     Renderable Tree (Hierarchical)          │
├─────────────────────────────────────────────┤
│ • Root GroupRenderable                      │
│ • Parent/Child relationships                │
│ • Event bubbling                            │
│ • Lifecycle management                      │
└─────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────┐
│      Layout Engine (Yoga)                   │
├─────────────────────────────────────────────┤
│ • Calculate positions                       │
│ • Apply flexbox rules                       │
│ • Handle responsive sizing                  │
└─────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────┐
│     FrameBuffer (Rendering)                 │
├─────────────────────────────────────────────┤
│ • Terminal cells (2D array)                 │
│ • Color & styling                           │
│ • Alpha blending                            │
│ • Performance optimization                  │
└─────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────┐
│     Terminal Output (ANSI)                  │
├─────────────────────────────────────────────┤
│ • ANSI escape sequences                     │
│ • Dirty cell tracking                       │
│ • Efficient diffs                           │
└─────────────────────────────────────────────┘
```

## Common Patterns

### Multi-Screen Application

```typescript
class ScreenManager {
  navigateTo(screen: ScreenName) {
    this.currentScreen = screen;
    renderer.root.removeAll();
    this.renderScreen();
  }
}
```

### Form with Validation

```typescript
class Form {
  setValue(field: string, value: any) {
    this.values[field] = value;
    const error = this.validate(field, value);
    this.errors[field] = error;
  }
}
```

### Focus Navigation

```typescript
class FocusManager {
  nextFocus() {
    this.components[current]?.blur();
    this.components[next]?.focus();
  }
}
```

### Async Data Loading

```typescript
class DataLoader {
  async load() {
    this.loading = true
    this.data = await fetch(...)
    this.loading = false
  }
}
```

## Performance Tips

1. **Use passive rendering** (no `start()` call) for static UIs
2. **Batch DOM updates** - Add multiple items to container first
3. **Debounce frequent updates** - Use timers for rapid changes
4. **Lower target FPS** - Set `targetFps: 24` for less CPU
5. **Lazy render visible items** - Only render items in viewport
6. **Memoize expensive computations** - Cache computed values

## Framework Support

- **@opentui/core** - Imperative API (pure TypeScript)
- **@opentui/solid** - SolidJS integration (reactive)
- **@opentui/react** - React integration (hooks)

Choose based on your preference:

- **Core** - Maximum control, minimal overhead
- **Solid** - Reactive, lightweight
- **React** - Familiar patterns, larger bundle

## Resources

- **Official Repo**: https://github.com/sst/opentui
- **Homepage**: https://opentui.com
- **Package**: `@opentui/core` on npm
- **Examples**: In repo at `packages/core/src/examples/`
- **Community**: https://github.com/msmps/awesome-opentui

## Quick Reference

### Component Creation

```typescript
// Text
new TextRenderable(renderer, { id: "text", content: "Hello" })

// Box
new BoxRenderable(renderer, { id: "box", width: 40, height: 10 })

// Input
new InputRenderable(renderer, { id: "input", placeholder: "Enter..." })

// Select
new SelectRenderable(renderer, { id: "select", options: [...] })

// Group
new GroupRenderable(renderer, { id: "group", flexDirection: "column" })
```

### Styling

```typescript
{
  fg: "#FFFFFF",                    // Text color
  backgroundColor: "#000000",        // Background
  borderStyle: "rounded",            // Border
  borderColor: "#FFFFFF",            // Border color
  position: "absolute",              // Positioning
  left: 10, top: 5,                 // Coordinates
  width: 30, height: 10,            // Size
}
```

### Event Handling

```typescript
// Keyboard
renderer.keyInput.on('keypress', key => {
  if (key.name === 'escape') exit();
});

// Component
component.on(RenderableEvents.FOCUSED, () => {});
component.on(InputRenderableEvents.CHANGE, value => {});
```

## Comparison: OpenTUI vs Other TUI Frameworks

| Feature                | OpenTUI             | Ink (React)        | Blessed     | Oclif       |
| ---------------------- | ------------------- | ------------------ | ----------- | ----------- |
| **Language**           | TypeScript          | TypeScript         | JavaScript  | TypeScript  |
| **API Style**          | Imperative/Reactive | React              | jQuery-like | CLI focused |
| **Layout System**      | Yoga Flexbox        | Flexbox            | Manual      | Table-based |
| **Animation**          | Yes                 | Yes                | Limited     | No          |
| **State Mgmt**         | Custom/External     | React hooks        | Manual      | Custom      |
| **Learning Curve**     | Moderate            | Shallow (if React) | Steep       | Shallow     |
| **Performance**        | Excellent           | Good               | Good        | Very Good   |
| **Active Development** | Yes                 | Moderate           | Low         | Moderate    |

## Development Tips

1. **Use TypeScript** - Full type safety is a major advantage
2. **Separate concerns** - Keep rendering, state, and events separate
3. **Test components** - Write unit tests for complex components
4. **Profile performance** - Check CPU/memory usage
5. **Start simple** - Build incrementally, start with passive rendering
6. **Leverage Yoga** - Learn flexbox for complex layouts
7. **Event delegation** - Use event bubbling for cleaner code
8. **Component composition** - Build reusable component libraries

## Known Limitations

- **In development** - Not production-ready (v0.1.44)
- **Terminal compatibility** - Requires modern terminal with ANSI support
- **Input handling** - Limited to keyboard, no mouse support yet
- **Rendering performance** - Heavy animations may struggle on slow systems
- **Mobile support** - Terminal-only, not suitable for mobile

## Version Information

- **Current Version**: 0.1.44
- **Release Date**: November 2025
- **Status**: Active Development
- **License**: MIT
- **Repository**: https://github.com/sst/opentui

---

## How to Use This Documentation

1. **New to OpenTUI?** Start with `comprehensive-guide.md`
2. **Building something specific?** Check `implementation-patterns.md` for your use case
3. **Optimizing performance?** Review `architecture-guide.md`
4. **Need examples?** All documents include code samples
5. **Looking for quick answers?** Use the Quick Reference sections

---

**Last Updated:** November 2025  
**Status:** Complete and Comprehensive  
**Accuracy:** Based on OpenTUI v0.1.44 (Latest as of Nov 2025)
