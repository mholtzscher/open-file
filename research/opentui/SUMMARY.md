# OpenTUI Framework: Executive Summary

## What is OpenTUI?

**OpenTUI** is a modern, TypeScript-first framework for building terminal user interfaces (TUIs). It's designed to be the foundational framework for building sophisticated command-line applications with a component-based architecture, flexible layouts, and interactive features.

**Quick Facts:**

- Created by: SST (Serverless Stack Toolkit)
- Language: TypeScript + Zig (performance-critical parts)
- Status: Active development (v0.1.44, November 2025)
- License: MIT
- GitHub: https://github.com/sst/opentui
- Stars: 5.1k+
- Package: `@opentui/core` on npm

---

## Core Strengths

### 1. Modern Architecture

- **Component-based** - Build UIs from reusable components
- **Declarative options** - Use React/SolidJS or imperative API
- **TypeScript-first** - Full type safety throughout
- **Flexbox layout** - CSS-like responsive layouts via Yoga

### 2. High Performance

- **Zig-powered rendering** - Native performance for terminal output
- **Passive rendering mode** - Only render when state changes
- **Optimized framebuffer** - Dirty cell tracking, minimal terminal writes
- **Alpha blending support** - Advanced visual effects

### 3. Comprehensive Components

- **Text** - Styled text with colors and attributes
- **Box** - Bordered containers
- **Input** - Text input with cursor support
- **Select** - Dropdown menus with descriptions
- **TabSelect** - Horizontal tabs
- **Group** - Layout containers
- **FrameBuffer** - Custom graphics
- **ASCIIFont** - ASCII art text

### 4. Flexible Event System

- **Keyboard input** - Full keyboard event handling
- **Component events** - Focus, blur, mount/unmount
- **EventEmitter pattern** - Familiar event architecture
- **Keyboard shortcut management** - Global and component-specific

### 5. Multiple Rendering Options

- **Passive mode** (default) - CPU efficient, render on change only
- **Live mode** - Continuous rendering for animations
- **Configurable FPS** - Adjustable rendering target
- **Console overlay** - Built-in debugging console

---

## Architecture Overview

```
┌──────────────────────────────────────────┐
│         CliRenderer                      │
│  (Central hub for rendering & events)    │
└──────────────────────────────────────────┘
              ↓
┌──────────────────────────────────────────┐
│      Renderable Tree                     │
│  (Hierarchical component structure)      │
└──────────────────────────────────────────┘
              ↓
┌──────────────────────────────────────────┐
│      Yoga Layout Engine                  │
│  (Flexbox positioning & sizing)          │
└──────────────────────────────────────────┘
              ↓
┌──────────────────────────────────────────┐
│      FrameBuffer                         │
│  (Terminal cell rendering)               │
└──────────────────────────────────────────┘
              ↓
┌──────────────────────────────────────────┐
│      Terminal Output                     │
│  (ANSI escape sequences)                 │
└──────────────────────────────────────────┘
```

---

## When to Use OpenTUI

### Ideal Use Cases

✅ Interactive CLI tools with complex UIs
✅ Dashboard applications
✅ File managers and editors
✅ Admin dashboards and configuration tools
✅ Development tools and CLIs
✅ Terminal games and demos
✅ Data visualization in terminal
✅ Monitoring and observability tools

### Not Ideal For

❌ Simple command-line scripts (use Commander or similar)
❌ Text-only output (use plain console.log)
❌ Web applications (not its purpose)
❌ Mobile applications
❌ Production-critical systems (still in development)

---

## Getting Started

### 1. Installation

```bash
bun install @opentui/core
```

### 2. Minimal Application

```typescript
import { createCliRenderer, TextRenderable } from '@opentui/core';

async function main() {
  const renderer = await createCliRenderer();

  const text = new TextRenderable(renderer, {
    id: 'hello',
    content: 'Hello, OpenTUI!',
    fg: '#00FF00',
    position: 'absolute',
    left: 5,
    top: 2,
  });

  renderer.root.add(text);
  renderer.start();
}

main();
```

### 3. Run with Bun

```bash
bun main.ts
```

---

## Key Patterns

### Application Shell

```typescript
class Application {
  async start() {
    this.renderer = await createCliRenderer();
    this.setupEventHandlers();
    this.render();
  }

  private setupEventHandlers() {
    this.renderer.keyInput.on('keypress', key => {
      this.handleKeyPress(key);
    });
  }

  private render() {
    // Build UI
  }
}
```

### Screen Navigation

```typescript
class ScreenManager {
  navigateTo(screen: string) {
    this.currentScreen = screen;
    this.renderer.root.removeAll();
    this.renderScreen();
  }
}
```

### Focus Management

```typescript
class FocusNavigator {
  nextFocus() {
    this.components[current]?.blur();
    this.components[next]?.focus();
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

---

## Component Examples

### Text Display

```typescript
const text = new TextRenderable(renderer, {
  id: 'title',
  content: 'Welcome',
  fg: '#00FF00',
  attributes: TextAttributes.BOLD,
});
```

### Form Input

```typescript
const input = new InputRenderable(renderer, {
  id: 'email',
  placeholder: 'Enter email...',
  backgroundColor: '#1a1a2e',
  focusedBackgroundColor: '#2d3748',
  cursorColor: '#FFFF00',
});

input.on(InputRenderableEvents.CHANGE, value => {
  console.log('Email:', value);
});

input.focus();
```

### Menu Selection

```typescript
const menu = new SelectRenderable(renderer, {
  id: 'main-menu',
  options: [
    { name: 'New File', description: 'Create new', value: 'new' },
    { name: 'Open File', description: 'Open existing', value: 'open' },
    { name: 'Exit', description: 'Exit app', value: 'exit' },
  ],
  showDescription: true,
  width: 40,
  height: 12,
});

menu.on(SelectRenderableEvents.ITEM_SELECTED, (index, option) => {
  console.log('Selected:', option.value);
});
```

### Flex Layout

```typescript
const container = new GroupRenderable(renderer, {
  id: 'layout',
  flexDirection: 'column',
  width: '100%',
  height: '100%',
  gap: 1,
});

const header = new BoxRenderable(renderer, { id: 'header', height: 3 });
const content = new BoxRenderable(renderer, { id: 'content', flexGrow: 1 });
const footer = new BoxRenderable(renderer, { id: 'footer', height: 2 });

container.add(header);
container.add(content);
container.add(footer);
```

---

## Event Handling

### Keyboard Events

```typescript
renderer.keyInput.on('keypress', key => {
  // key.name: "a", "escape", "up", "f1", etc.
  // key.ctrl: boolean
  // key.shift: boolean
  // key.meta: boolean (Alt/Option)
  // key.sequence: raw sequence

  if (key.name === 'escape') {
    process.exit(0);
  }

  if (key.ctrl && key.name === 's') {
    save();
  }
});
```

### Component Events

```typescript
// Universal events
component.on(RenderableEvents.FOCUSED, () => {});
component.on(RenderableEvents.BLURRED, () => {});
component.on(RenderableEvents.MOUNTED, () => {});
component.on(RenderableEvents.UNMOUNTED, () => {});

// Input events
input.on(InputRenderableEvents.INPUT, value => {}); // Real-time
input.on(InputRenderableEvents.CHANGE, value => {}); // On submit
input.on(InputRenderableEvents.ENTER, value => {}); // On Enter

// Select events
select.on(SelectRenderableEvents.ITEM_SELECTED, (idx, opt) => {});
select.on(SelectRenderableEvents.SELECTION_CHANGED, (idx, opt) => {});
```

---

## Performance Tips

1. **Use passive rendering** for static interfaces (default mode)
2. **Call `renderer.start()`** only for animations/live updates
3. **Batch DOM updates** - Add multiple items to container first
4. **Lower FPS** for less CPU: `targetFps: 24`
5. **Lazy render** - Only render visible items in large lists
6. **Debounce** frequent updates with timers
7. **Memoize** expensive computations

---

## Framework Integrations

### Pure TypeScript (@opentui/core)

Best for: Maximum control, minimal overhead

```typescript
import { createCliRenderer, TextRenderable } from '@opentui/core';
```

### SolidJS (@opentui/solid)

Best for: Reactive, fine-grained updates

```typescript
import { render } from "@opentui/solid"
render(() => <box>Hello</box>)
```

### React (@opentui/react)

Best for: Familiar patterns if you know React

```typescript
import { render } from "@opentui/react"
render(<Box>Hello</Box>)
```

---

## Layout System

OpenTUI uses **Yoga** for CSS Flexbox-like layouts:

```typescript
{
  // Direction
  flexDirection: "row" | "column",

  // Main axis alignment
  justifyContent: "flex-start" | "center" | "flex-end" |
                  "space-between" | "space-around",

  // Cross axis alignment
  alignItems: "flex-start" | "center" | "flex-end" | "stretch",

  // Spacing
  gap: 2,
  padding: { top: 1, left: 2, right: 2, bottom: 1 },

  // Sizing
  width: 40 | "100%",
  height: 10,
  flexGrow: 1,      // Grow to fill space

  // Positioning
  position: "absolute",
  left: 10,
  top: 5,
}
```

---

## State Management

Common pattern for managing application state:

```typescript
class Store {
  private state: AppState;
  private listeners: Array<(state: AppState) => void> = [];

  dispatch(action: Action) {
    this.state = reduce(this.state, action);
    this.notifyListeners();
  }

  subscribe(listener: (state: AppState) => void) {
    this.listeners.push(listener);
  }

  private notifyListeners() {
    this.listeners.forEach(l => l(this.state));
  }
}
```

---

## Best Practices

1. **Separate concerns** - Keep rendering, state, and events separate
2. **Use composition** - Build complex UIs from simple components
3. **Manage lifecycle** - Properly initialize and cleanup
4. **Handle errors** - Gracefully handle and display errors
5. **Test thoroughly** - Write unit tests for components
6. **Document APIs** - Keep component interfaces clear
7. **Profile performance** - Monitor CPU and memory
8. **Use TypeScript** - Leverage type safety throughout

---

## Comparison with Alternatives

| Feature        | OpenTUI      | Ink            | Blessed      | Oclif        |
| -------------- | ------------ | -------------- | ------------ | ------------ |
| Layout System  | Yoga Flexbox | Flexbox        | Manual       | Table        |
| TypeScript     | First-class  | Yes            | No           | Yes          |
| Learning Curve | Moderate     | Low            | High         | Low          |
| Performance    | Excellent    | Good           | Good         | Very Good    |
| Animations     | Yes          | Yes            | Limited      | No           |
| Active Dev     | Yes          | Moderate       | Low          | Moderate     |
| Use Case       | Complex UIs  | React patterns | Full control | CLI commands |

---

## Common Mistakes to Avoid

❌ **Calling `start()` for every render** - Use passive mode instead
❌ **Not cleaning up event listeners** - Always remove listeners on destroy
❌ **Adding items individually to renderer** - Batch in containers first
❌ **Over-complicating state management** - Use simple patterns
❌ **Ignoring component lifecycle** - Properly handle mount/unmount
❌ **Not using TypeScript** - Leverage type safety
❌ **Forgetting about z-index** - Set proper layering for overlays

---

## Resources

### Official

- **Repository**: https://github.com/sst/opentui
- **Homepage**: https://opentui.com
- **Examples**: In repo at `packages/core/src/examples/`

### Community

- **Awesome OpenTUI**: https://github.com/msmps/awesome-opentui
- **Create-TUI**: https://github.com/msmps/create-tui (Quick start template)

### Related Projects

- **opencode**: https://opencode.ai (IDE built with OpenTUI)
- **terminal.shop**: https://terminal.shop (Commerce built with OpenTUI)

---

## Getting Help

1. **Documentation**: Check research docs or official docs
2. **Examples**: Run examples from repo
3. **GitHub Issues**: File issues or search existing ones
4. **Community**: Check awesome-opentui for community projects

---

## Quick Decision Tree

```
Do you want to build a TUI app?
├─ Yes, interactive with forms/menus → Use OpenTUI
├─ Yes, but just simple CLI commands → Use Commander/oclif
├─ Yes, and I know React → Use Ink
├─ Yes, and I need full control → Use OpenTUI Core
└─ No, it's text output only → Use console.log
```

---

## Next Steps

1. **Read** `comprehensive-guide.md` for full API reference
2. **Study** `implementation-patterns.md` for common patterns
3. **Review** `architecture-guide.md` for deep dives
4. **Try** the examples from the official repo
5. **Build** your first OpenTUI application
6. **Optimize** performance using best practices

---

## Key Takeaways

✅ OpenTUI is a modern, well-designed TUI framework
✅ Perfect for complex, interactive CLI applications
✅ Strong TypeScript support and type safety
✅ Excellent performance with optional passive rendering
✅ Component-based architecture enables code reuse
✅ Multiple integration options (Core, React, Solid)
✅ Active development and growing community
✅ MIT licensed and open source

---

**Version**: OpenTUI v0.1.44  
**Last Updated**: November 2025  
**Documentation Status**: Complete and Comprehensive  
**Ready for**: Learning, experimentation, production-ready apps
