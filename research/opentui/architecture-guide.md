# OpenTUI Architecture Guide

## Rendering Pipeline

### 1. Renderable Tree Structure

OpenTUI uses a hierarchical tree of renderables:

```
CliRenderer (root)
  └── GroupRenderable (layout container)
      ├── BoxRenderable (panel)
      │   ├── TextRenderable (title)
      │   └── TextRenderable (content)
      ├── InputRenderable (form field)
      └── SelectRenderable (menu)
```

**Tree Operations:**
```typescript
// Add to tree
parent.add(child)

// Remove from tree
parent.remove(child.id)

// Remove all children
parent.removeAll()

// Access children
const children = parent.children
```

### 2. Rendering Phases

1. **Update Phase** - Update component state
2. **Layout Phase** - Calculate positions using Yoga
3. **Render Phase** - Convert to terminal output
4. **Buffer Phase** - Optimization and dirty tracking
5. **Output Phase** - Write to terminal

### 3. Live vs. Passive Rendering

**Passive Mode (Default):**
```typescript
const renderer = await createCliRenderer()
// Renders only when tree/layout changes
// CPU efficient, no animation support
// Perfect for static UIs and forms
```

**Live Mode:**
```typescript
const renderer = await createCliRenderer({ targetFps: 60 })
await renderer.start()
// Continuous rendering loop
// Enables animations and smooth updates
// Higher CPU usage
```

**When to use each:**
- **Passive**: File browsers, menus, forms, settings
- **Live**: Animations, progress bars, live dashboards, games

---

## Component Lifecycle

### 1. Component States

```
UNMOUNTED
    ↓
  CREATE
    ↓
 MOUNTED (RenderableEvents.MOUNTED)
    ↓
  VISIBLE
    ↓
 FOCUSED (RenderableEvents.FOCUSED)
    ↓
  EVENT HANDLING
    ↓
 BLURRED (RenderableEvents.BLURRED)
    ↓
  UNMOUNT (RenderableEvents.UNMOUNTED)
    ↓
 DESTROYED
```

### 2. Lifecycle Events

```typescript
component.on(RenderableEvents.MOUNTED, () => {
  // Component added to tree
  // Perform initialization
})

component.on(RenderableEvents.FOCUSED, () => {
  // Component received focus
  // Update visual indicators
})

component.on(RenderableEvents.BLURRED, () => {
  // Component lost focus
  // Cleanup visual indicators
})

component.on(RenderableEvents.UNMOUNTED, () => {
  // Component removed from tree
  // Cleanup resources
})

component.on(RenderableEvents.VISIBILITY_CHANGED, () => {
  // Component visibility toggled
})
```

### 3. Proper Cleanup

```typescript
class Component {
  private listeners: Array<() => void> = []

  constructor(renderer: any) {
    this.renderer = renderer
    this.setupListeners()
  }

  private setupListeners() {
    const handler = () => this.onEvent()
    this.renderer.keyInput.on("keypress", handler)
    this.listeners.push(() => {
      this.renderer.keyInput.off("keypress", handler)
    })
  }

  destroy() {
    // Clean up all listeners
    this.listeners.forEach(fn => fn())
    this.listeners = []
  }
}
```

---

## Layout System (Yoga)

### 1. Flexbox Concepts

```typescript
// Container with flex layout
const container = new GroupRenderable(renderer, {
  id: "flex-container",
  flexDirection: "row",      // Main axis direction
  justifyContent: "center",  // Align along main axis
  alignItems: "center",      // Align along cross axis
  gap: 2,                    // Space between children
  flexWrap: "wrap",          // Wrap to next line
})

// Child with flex properties
const child = new BoxRenderable(renderer, {
  id: "flex-child",
  flexGrow: 1,              // Grow to fill space
  flexShrink: 1,            // Shrink if needed
  flexBasis: 100,           // Base size
})
```

### 2. Layout Modes

**Flex Layout (Default):**
```typescript
{
  flexDirection: "row" | "column" | "row-reverse" | "column-reverse"
  justifyContent: "flex-start" | "center" | "flex-end" | "space-between" | "space-around" | "space-evenly"
  alignItems: "flex-start" | "center" | "flex-end" | "stretch"
  alignContent: "flex-start" | "center" | "flex-end" | "stretch" | "space-between" | "space-around"
  gap: number
  rowGap: number
  columnGap: number
}
```

**Absolute Positioning:**
```typescript
{
  position: "absolute",
  left: 10,
  top: 5,
  right: 20,
  bottom: 10,
  width: 40,
  height: 15,
}
```

### 3. Sizing

```typescript
// Absolute sizing
{ width: 40, height: 10 }

// Percentage sizing (within parent)
{ width: "100%", height: "50%" }

// Flex sizing
{ flexGrow: 1, flexShrink: 0 }

// Min/max sizing
{ minWidth: 10, maxWidth: 50, minHeight: 5, maxHeight: 20 }
```

---

## Event Architecture

### 1. Event Flow

```
Terminal Input
     ↓
KeyInput EventEmitter
     ↓
Global Keyboard Handlers
     ↓
Focused Component Handler
     ↓
Component-Specific Logic
```

### 2. Event Bubbling (Custom Implementation)

```typescript
class EventBubbler {
  private focusedComponent: any = null

  dispatchKeyEvent(key: KeyEvent) {
    // Check if focused component wants to handle
    if (this.focusedComponent?.handleKeyPress) {
      const handled = this.focusedComponent.handleKeyPress(key)
      if (handled) return
    }

    // Bubble to parent
    if (this.focusedComponent?.parent?.handleKeyPress) {
      const handled = this.focusedComponent.parent.handleKeyPress(key)
      if (handled) return
    }

    // Global handlers
    this.handleGlobalKeyPress(key)
  }

  private handleGlobalKeyPress(key: KeyEvent) {
    // Handle global shortcuts
  }
}
```

### 3. Event Filtering

```typescript
class InputFilter {
  static isNavigationKey(key: KeyEvent): boolean {
    return ["up", "down", "left", "right", "tab"].includes(key.name)
  }

  static isEditingKey(key: KeyEvent): boolean {
    return !this.isNavigationKey(key) && !key.ctrl && !key.meta
  }

  static isShortcut(key: KeyEvent): boolean {
    return key.ctrl || key.meta
  }
}

// Usage
renderer.keyInput.on("keypress", (key: KeyEvent) => {
  if (InputFilter.isShortcut(key)) {
    handleShortcut(key)
  } else if (InputFilter.isNavigationKey(key)) {
    handleNavigation(key)
  }
})
```

---

## State Management Architecture

### 1. Centralized State Store

```typescript
type StateListener = (state: AppState) => void

class StateStore {
  private state: AppState = {
    currentScreen: "home",
    data: [],
    selectedItem: 0,
    loading: false,
    error: null,
  }

  private listeners: StateListener[] = []

  subscribe(listener: StateListener): () => void {
    this.listeners.push(listener)
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  setState(updates: Partial<AppState>) {
    this.state = { ...this.state, ...updates }
    this.notifyListeners()
  }

  getState(): AppState {
    return { ...this.state }
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.getState()))
  }
}

// Usage
const store = new StateStore()

const unsubscribe = store.subscribe((state) => {
  console.log("State changed:", state)
  rerender()
})

// Update state
store.setState({ currentScreen: "settings" })

// Cleanup
unsubscribe()
```

### 2. Actions Pattern

```typescript
type Action =
  | { type: "NAVIGATE"; payload: string }
  | { type: "SELECT_ITEM"; payload: number }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "NAVIGATE":
      return { ...state, currentScreen: action.payload }
    case "SELECT_ITEM":
      return { ...state, selectedItem: action.payload }
    case "SET_LOADING":
      return { ...state, loading: action.payload }
    case "SET_ERROR":
      return { ...state, error: action.payload }
    default:
      return state
  }
}

class Store {
  private state: AppState
  private listeners: StateListener[] = []

  constructor(initialState: AppState) {
    this.state = initialState
  }

  dispatch(action: Action) {
    this.state = reducer(this.state, action)
    this.notifyListeners()
  }

  subscribe(listener: StateListener) {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.state))
  }
}
```

---

## Performance Optimization Techniques

### 1. Memoization

```typescript
class Component {
  private lastProps: any = null
  private lastRendered: string = ""

  render(props: any): string {
    if (this.shouldSkipRender(props)) {
      return this.lastRendered
    }

    this.lastProps = props
    this.lastRendered = this.computeRender(props)
    return this.lastRendered
  }

  private shouldSkipRender(props: any): boolean {
    if (!this.lastProps) return false
    return JSON.stringify(this.lastProps) === JSON.stringify(props)
  }

  private computeRender(props: any): string {
    // Expensive computation
    return "rendered"
  }
}
```

### 2. Lazy Loading

```typescript
class LazyRenderer {
  private visibleItems: Set<string> = new Set()
  private allItems: any[] = []

  setViewport(start: number, end: number) {
    this.visibleItems.clear()
    for (let i = start; i < end; i++) {
      this.visibleItems.add(String(i))
    }
  }

  shouldRender(index: number): boolean {
    return this.visibleItems.has(String(index))
  }

  render() {
    const visible = this.allItems.filter((_, i) => this.shouldRender(i))
    return visible // Only render visible items
  }
}
```

### 3. Debouncing Updates

```typescript
class DebouncedRenderer {
  private renderTimer: NodeJS.Timeout | null = null
  private pendingUpdates = false

  scheduleRender() {
    this.pendingUpdates = true

    if (this.renderTimer) {
      clearTimeout(this.renderTimer)
    }

    this.renderTimer = setTimeout(() => {
      if (this.pendingUpdates) {
        this.performRender()
        this.pendingUpdates = false
      }
    }, 16) // ~60fps
  }

  private performRender() {
    // Actual rendering
  }
}
```

---

## Testing Strategies

### 1. Component Testing

```typescript
import { createCliRenderer } from "@opentui/core"

async function testComponent() {
  const renderer = await createCliRenderer({
    targetFps: 60,
  })

  const component = new InputRenderable(renderer, {
    id: "test-input",
    placeholder: "Test",
  })

  renderer.root.add(component)

  // Test initial state
  console.assert(component.focused === false, "Should not be focused initially")
  console.assert(component.value === "", "Should be empty initially")

  // Test focus
  component.focus()
  console.assert(component.focused === true, "Should be focused after focus()")

  // Test input
  component.value = "test"
  console.assert(component.value === "test", "Should update value")

  // Cleanup
  component.blur()
  renderer.root.remove(component.id)
}

testComponent().catch(console.error)
```

### 2. Event Testing

```typescript
function testKeyboardHandler() {
  const events: KeyEvent[] = []

  const mockRenderer = {
    keyInput: {
      on: (eventName: string, handler: (key: KeyEvent) => void) => {
        // Simulate keypress
        handler({ name: "a", sequence: "a", ctrl: false, shift: false })
      },
    },
  }

  mockRenderer.keyInput.on("keypress", (key) => {
    events.push(key)
  })

  console.assert(events.length === 1, "Should have captured one event")
  console.assert(events[0].name === "a", "Should capture 'a' key")
}

testKeyboardHandler()
```

---

## Memory Management

### 1. Component Disposal

```typescript
class ComponentManager {
  private components: Map<string, any> = new Map()

  register(id: string, component: any) {
    this.components.set(id, component)
  }

  dispose(id: string) {
    const component = this.components.get(id)
    if (component) {
      // Call cleanup
      if (component.destroy) {
        component.destroy()
      }
      // Remove listeners
      if (component.removeAllListeners) {
        component.removeAllListeners()
      }
      // Delete reference
      this.components.delete(id)
    }
  }

  disposeAll() {
    for (const [id] of this.components) {
      this.dispose(id)
    }
  }
}
```

### 2. Reference Cycles Prevention

```typescript
class Parent {
  private children: Child[] = []

  addChild(child: Child) {
    this.children.push(child)
    child.setParent(null) // Use weak reference if possible
  }

  destroy() {
    this.children.forEach(child => child.destroy())
    this.children = []
  }
}

class Child {
  private parent: Parent | null = null

  setParent(parent: Parent | null) {
    this.parent = parent
  }

  destroy() {
    this.parent = null
  }
}
```

---

## Debugging Techniques

### 1. Console Overlay

```typescript
const renderer = await createCliRenderer({
  consoleOptions: {
    position: "bottom",
    sizePercent: 30,
    startInDebugMode: true,
  },
})

// All console.* calls are captured
console.log("Debug info")
console.error("Error message")
console.warn("Warning")

// Toggle with console.toggle()
renderer.console.toggle()
```

### 2. Debug Logging

```typescript
class Logger {
  private prefix = "[DEBUG]"

  log(message: string, data?: any) {
    if (process.env.DEBUG) {
      console.log(`${this.prefix} ${message}`, data || "")
    }
  }

  error(message: string, error?: Error) {
    console.error(`${this.prefix} ERROR: ${message}`, error || "")
  }

  trace(message: string) {
    if (process.env.TRACE) {
      console.trace(`${this.prefix} ${message}`)
    }
  }
}

// Usage
const logger = new Logger()
logger.log("Component rendered", { id: "my-component" })
```

### 3. State Inspection

```typescript
function inspectState(state: any, depth: number = 0): string {
  const indent = "  ".repeat(depth)
  let output = ""

  for (const [key, value] of Object.entries(state)) {
    if (typeof value === "object" && value !== null) {
      output += `${indent}${key}:\n${inspectState(value, depth + 1)}`
    } else {
      output += `${indent}${key}: ${value}\n`
    }
  }

  return output
}

// Debug output
console.log(inspectState(appState))
```

---

## Best Practices Summary

1. **Separate concerns**: Keep rendering, state, and event handling separate
2. **Use composition**: Build complex UIs from simple components
3. **Manage lifecycle**: Properly initialize and cleanup components
4. **Optimize rendering**: Use passive mode when possible, batch updates
5. **Handle errors**: Gracefully handle and display errors
6. **Test thoroughly**: Write tests for components and event handlers
7. **Memory management**: Clean up references and listeners
8. **Document APIs**: Keep component interfaces clear and documented
9. **Use TypeScript**: Leverage type safety throughout
10. **Profile performance**: Monitor CPU and memory usage

---

**Last Updated:** November 2025
