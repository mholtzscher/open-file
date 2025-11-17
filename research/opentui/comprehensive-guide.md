# OpenTUI Framework: Comprehensive Guide

## Overview

**OpenTUI** is a modern TypeScript library for building terminal user interfaces (TUIs). It's currently in active development and serves as the foundational framework for both [opencode](https://opencode.ai) and [terminal.shop](https://terminal.shop).

**Repository:** https://github.com/sst/opentui  
**Package:** `@opentui/core` (v0.1.44+)  
**Homepage:** https://opentui.com  
**License:** MIT

### Key Characteristics

- **TypeScript-first** with full type safety
- **Component-based architecture** using Yoga layout engine
- **Multiple renderers**: React, SolidJS, and imperative API
- **Built with Zig** for performance-critical rendering
- **Active development** with 5.1k+ GitHub stars
- **Production-ready for experimental use**

---

## 1. Core Architecture

### System Components

#### 1.1 CliRenderer (Central Hub)

The `CliRenderer` is the heart of OpenTUI - it orchestrates the entire application.

```typescript
import { createCliRenderer } from '@opentui/core';

const renderer = await createCliRenderer({
  targetFps: 60,
  consoleOptions: {
    position: 'bottom',
    sizePercent: 30,
  },
  exitOnCtrlC: true,
});

// Optional: Start rendering loop
renderer.start();
```

**Responsibilities:**

- Manages terminal output and rendering
- Handles input events and keyboard input
- Orchestrates rendering loop (optional live mode)
- Manages focus and event distribution
- Provides framebuffer for custom rendering

#### 1.2 Rendering System

**Three-tier architecture:**

1. **Renderables** - Low-level visual components
2. **Constructs** - Component constructors (like React)
3. **Reconcilers** - Framework integrations (React/Solid)

**Live vs. Passive Rendering:**

```typescript
// Live mode - continuous rendering loop
await renderer.start();

// Passive mode - only render on changes
// The renderer works standalone without calling start()
// Re-renders when renderable tree or layout changes
```

#### 1.3 Layout Engine

OpenTUI uses **Yoga** (Facebook's layout engine) providing CSS Flexbox-like capabilities.

```typescript
import { GroupRenderable, BoxRenderable } from '@opentui/core';

const container = new GroupRenderable(renderer, {
  id: 'container',
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  width: '100%',
  height: 10,
  gap: 2,
});

const child1 = new BoxRenderable(renderer, {
  flexGrow: 1,
  height: '100%',
  backgroundColor: '#444',
});

const child2 = new BoxRenderable(renderer, {
  width: 20,
  height: '100%',
  backgroundColor: '#666',
});

container.add(child1);
container.add(child2);
renderer.root.add(container);
```

#### 1.4 Color System (RGBA)

Consistent color handling throughout the framework.

```typescript
import { RGBA, parseColor } from '@opentui/core';

// Multiple ways to specify colors
const red1 = RGBA.fromInts(255, 0, 0, 255);
const blue1 = RGBA.fromValues(0.0, 0.0, 1.0, 1.0);
const green1 = RGBA.fromHex('#00FF00');
const transparent = RGBA.fromValues(1, 1, 1, 0.5);

// Use parseColor for flexible input
const color = parseColor('#FF0000');
```

#### 1.5 Event System

EventEmitter-based architecture for keyboard input and component events.

```typescript
import { type KeyEvent } from '@opentui/core';

renderer.keyInput.on('keypress', (key: KeyEvent) => {
  console.log('Key:', key.name);
  console.log('Ctrl:', key.ctrl);
  console.log('Shift:', key.shift);
  console.log('Alt:', key.meta);
  console.log('Option:', key.option);
});

renderer.keyInput.on('paste', (text: string) => {
  console.log('Pasted:', text);
});
```

---

## 2. Available UI Components

### 2.1 Text (TextRenderable)

Display styled text with colors, attributes, and formatting.

```typescript
import { TextRenderable, TextAttributes, t, bold, underline, fg } from '@opentui/core';

// Simple text
const simple = new TextRenderable(renderer, {
  id: 'simple-text',
  content: 'Hello, World!',
  fg: '#00FF00',
  attributes: TextAttributes.BOLD | TextAttributes.UNDERLINE,
  position: 'absolute',
  left: 5,
  top: 2,
});

// Styled text using template literals
const styled = new TextRenderable(renderer, {
  id: 'styled-text',
  content: t`${bold('Bold')} ${underline('Underlined')} ${fg('#FF0000')('Red')}`,
  position: 'absolute',
  left: 5,
  top: 5,
});

renderer.root.add(simple);
renderer.root.add(styled);
```

### 2.2 Box (BoxRenderable)

Container with borders, backgrounds, and titles.

```typescript
import { BoxRenderable } from '@opentui/core';

const panel = new BoxRenderable(renderer, {
  id: 'settings-panel',
  width: 40,
  height: 15,
  backgroundColor: '#1a1a2e',
  borderStyle: 'double',
  borderColor: '#00FF00',
  title: 'Settings',
  titleAlignment: 'center',
  padding: { top: 1, left: 2, right: 2, bottom: 1 },
  position: 'absolute',
  left: 10,
  top: 5,
});

renderer.root.add(panel);
```

### 2.3 Input (InputRenderable)

Text input field with cursor and validation support.

```typescript
import { InputRenderable, InputRenderableEvents } from '@opentui/core';

const nameInput = new InputRenderable(renderer, {
  id: 'name-input',
  position: 'absolute',
  left: 5,
  top: 2,
  width: 40,
  height: 3,
  backgroundColor: '#001122',
  textColor: '#FFFFFF',
  placeholder: 'Enter your name...',
  placeholderColor: '#666666',
  cursorColor: '#FFFF00',
  value: '',
  maxLength: 50,
});

nameInput.on(InputRenderableEvents.INPUT, (value: string) => {
  console.log('Input:', value);
});

nameInput.on(InputRenderableEvents.CHANGE, (value: string) => {
  console.log('Submitted:', value);
});

nameInput.focus();
renderer.root.add(nameInput);
```

### 2.4 Select (SelectRenderable)

List selection component with descriptions and navigation.

```typescript
import { SelectRenderable, SelectRenderableEvents, type SelectOption } from '@opentui/core';

const options: SelectOption[] = [
  { name: 'New File', description: 'Create a new file', value: 'new' },
  { name: 'Open File', description: 'Open an existing file', value: 'open' },
  { name: 'Exit', description: 'Exit the application', value: 'exit' },
];

const menu = new SelectRenderable(renderer, {
  id: 'main-menu',
  position: 'absolute',
  left: 5,
  top: 3,
  width: 40,
  height: 12,
  options: options,
  backgroundColor: '#1e293b',
  selectedBackgroundColor: '#3b82f6',
  textColor: '#e2e8f0',
  descriptionColor: '#94a3b8',
  showDescription: true,
  showScrollIndicator: true,
  wrapSelection: true,
});

menu.on(SelectRenderableEvents.ITEM_SELECTED, (index: number, option: SelectOption) => {
  console.log('Selected:', option.name);
});

menu.focus();
renderer.root.add(menu);
```

### 2.5 TabSelect (TabSelectRenderable)

Horizontal tab-based selection component.

```typescript
import { TabSelectRenderable, TabSelectRenderableEvents } from '@opentui/core';

const tabs = new TabSelectRenderable(renderer, {
  id: 'main-tabs',
  position: 'absolute',
  left: 2,
  top: 1,
  width: 60,
  options: [
    { name: 'Home', description: 'Dashboard', value: 'home' },
    { name: 'Files', description: 'File management', value: 'files' },
    { name: 'Settings', description: 'Settings', value: 'settings' },
  ],
  tabWidth: 20,
  backgroundColor: '#2d3748',
  selectedBackgroundColor: '#3b82f6',
});

tabs.on(TabSelectRenderableEvents.ITEM_SELECTED, (index, option) => {
  console.log('Tab selected:', option.name);
});

tabs.focus();
renderer.root.add(tabs);
```

### 2.6 Group (GroupRenderable)

Container for layout composition using Yoga flexbox.

```typescript
import { GroupRenderable } from '@opentui/core';

const mainLayout = new GroupRenderable(renderer, {
  id: 'main-layout',
  flexDirection: 'column',
  width: '100%',
  height: '100%',
  gap: 1,
});

const header = new BoxRenderable(renderer, { id: 'header', height: 3 });
const content = new BoxRenderable(renderer, { id: 'content', flexGrow: 1 });
const footer = new BoxRenderable(renderer, { id: 'footer', height: 2 });

mainLayout.add(header);
mainLayout.add(content);
mainLayout.add(footer);
renderer.root.add(mainLayout);
```

### 2.7 ASCIIFont (ASCIIFontRenderable)

Display text using ASCII art fonts.

```typescript
import { ASCIIFontRenderable } from '@opentui/core';

const title = new ASCIIFontRenderable(renderer, {
  id: 'title',
  text: 'OPENTUI',
  font: 'tiny',
  color: RGBA.fromHex('#00FF00'),
  position: 'absolute',
  left: 10,
  top: 2,
});

renderer.root.add(title);
```

### 2.8 FrameBuffer (FrameBufferRenderable)

Low-level rendering surface for custom graphics.

```typescript
import { FrameBufferRenderable, RGBA } from '@opentui/core';

const canvas = new FrameBufferRenderable(renderer, {
  id: 'canvas',
  position: 'absolute',
  left: 5,
  top: 5,
  width: 50,
  height: 20,
});

const buffer = canvas.frameBuffer;
buffer.fillRect(10, 5, 20, 8, RGBA.fromHex('#FF0000'));
buffer.drawText('Graphics', 12, 7, RGBA.fromHex('#FFFFFF'));

renderer.root.add(canvas);
```

---

## 3. Event Handling & Keybinding

### 3.1 Keyboard Input

```typescript
renderer.keyInput.on('keypress', (key: KeyEvent) => {
  if (key.name === 'escape') {
    console.log('ESC pressed');
  }
  if (key.ctrl && key.name === 'c') {
    console.log('Ctrl+C pressed');
  }
  if (key.shift && key.name === 'up') {
    console.log('Shift+Up pressed');
  }
});
```

### 3.2 Component Events

```typescript
import { RenderableEvents } from '@opentui/core';

component.on(RenderableEvents.FOCUSED, () => {
  console.log('Component focused');
});

component.on(RenderableEvents.BLURRED, () => {
  console.log('Component lost focus');
});

component.on(RenderableEvents.MOUNTED, () => {
  console.log('Component added');
});

component.on(RenderableEvents.UNMOUNTED, () => {
  console.log('Component removed');
});
```

### 3.3 Focus Management

```typescript
// Check and set focus
console.log(input.focused);
input.focus();
input.blur();
```

---

## 4. Building Interactive Applications

### 4.1 Basic Structure

```typescript
import { createCliRenderer, BoxRenderable, TextRenderable } from '@opentui/core';

async function main() {
  const renderer = await createCliRenderer({
    targetFps: 60,
    exitOnCtrlC: true,
  });

  // Build UI
  const text = new TextRenderable(renderer, {
    id: 'hello',
    content: 'Hello, OpenTUI!',
    position: 'absolute',
    left: 5,
    top: 2,
  });
  renderer.root.add(text);

  // Setup event handlers
  renderer.keyInput.on('keypress', key => {
    if (key.name === 'escape') process.exit(0);
  });

  // Start rendering
  renderer.start();
}

main();
```

### 4.2 Complete Todo App Example

See input-demo.ts for a full example with:

- Multiple input fields with validation
- Navigation between fields (Tab/Shift+Tab)
- Real-time input events and validation feedback
- Complex event handling and state management

### 4.3 State Management

```typescript
class AppState {
  private state = {
    data: [],
    selectedIndex: 0,
    loading: false,
  };

  private listeners: Array<(state: any) => void> = [];

  subscribe(listener: (state: any) => void) {
    this.listeners.push(listener);
  }

  dispatch(action: any) {
    switch (action.type) {
      case 'SET_DATA':
        this.state.data = action.payload;
        break;
      case 'SET_SELECTED':
        this.state.selectedIndex = action.payload;
        break;
    }
    this.listeners.forEach(l => l(this.state));
  }

  getState() {
    return this.state;
  }
}
```

---

## 5. Framework Integrations

### 5.1 SolidJS (@opentui/solid)

```bash
bun install solid-js @opentui/solid
```

**tsconfig.json:**

```json
{
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "@opentui/solid"
  }
}
```

**bunfig.toml:**

```toml
preload = ["@opentui/solid/preload"]
```

**Usage:**

```tsx
import { render } from '@opentui/solid';
import { createSignal } from 'solid-js';

render(() => {
  const [count, setCount] = createSignal(0);

  return (
    <box border="rounded" title="Counter">
      <text>Count: {count()}</text>
    </box>
  );
});
```

### 5.2 React (@opentui/react)

```typescript
import { render } from "@opentui/react"
import { useState } from "react"

const App = () => {
  const [count, setCount] = useState(0)

  return (
    <box border="rounded">
      <text>Count: {count}</text>
    </box>
  )
}

render(<App />)
```

---

## 6. Best Practices

### 6.1 Performance

```typescript
// Use passive rendering (no start()) for minimal CPU
// Only call renderer.start() for animations/live updates

// Batch updates in containers
const container = new GroupRenderable(renderer, { id: 'batch' });
container.add(item1);
container.add(item2);
renderer.root.add(container);

// Lower FPS for slower systems
const renderer = await createCliRenderer({ targetFps: 24 });
```

### 6.2 Cleanup

```typescript
process.on('SIGINT', () => {
  renderer.root.removeAll();
  renderer.keyInput.removeAllListeners();
  process.exit(0);
});
```

### 6.3 Component Composition

```typescript
function createPanel(renderer: any, config: any) {
  const panel = new BoxRenderable(renderer, {
    id: config.id,
    width: config.width,
    height: config.height,
    ...config.style,
  });

  if (config.title) {
    const title = new TextRenderable(renderer, {
      id: `${config.id}-title`,
      content: config.title,
    });
    panel.add(title);
  }

  return panel;
}
```

### 6.4 Focus Management

```typescript
class FocusManager {
  private components: any[] = [];
  private currentIndex = 0;

  register(component: any) {
    this.components.push(component);
  }

  nextFocus() {
    this.components[this.currentIndex]?.blur();
    this.currentIndex = (this.currentIndex + 1) % this.components.length;
    this.components[this.currentIndex]?.focus();
  }
}
```

---

## 7. Environment Variables

- `OTUI_DEBUG_FFI` - Enable FFI debug logging
- `OTUI_TRACE_FFI` - Enable FFI tracing
- `OTUI_USE_CONSOLE` - Capture console output (default: true)
- `SHOW_CONSOLE` - Show console at startup
- `OTUI_NO_NATIVE_RENDER` - Disable actual rendering
- `OTUI_USE_ALTERNATE_SCREEN` - Use alternate screen buffer

---

## 8. Resources

- **GitHub**: https://github.com/sst/opentui
- **Homepage**: https://opentui.com
- **Awesome OpenTUI**: https://github.com/msmps/awesome-opentui
- **Create-TUI**: https://github.com/msmps/create-tui

---

## 9. Quick Reference

### Create Components

```typescript
new TextRenderable(renderer, { id: "text", content: "Hello" })
new BoxRenderable(renderer, { id: "box", width: 40, height: 10 })
new InputRenderable(renderer, { id: "input", placeholder: "Enter..." })
new SelectRenderable(renderer, { id: "select", options: [...] })
new GroupRenderable(renderer, { id: "group", flexDirection: "column" })
```

### Event Handling

```typescript
renderer.keyInput.on('keypress', key => {});
component.on(RenderableEvents.FOCUSED, () => {});
component.on(InputRenderableEvents.CHANGE, value => {});
```

### Styling

```typescript
{
  fg: "#FFFFFF",
  backgroundColor: "#000000",
  borderStyle: "rounded",
  position: "absolute",
  left: 10, top: 5,
  width: 30, height: 10,
}
```

---

**Last Updated:** November 2025  
**OpenTUI Version:** 0.1.44+  
**Status:** Active Development
