# Keyboard Hooks: React and Solid.js Integration

## Overview

Both React and Solid.js provide keyboard hooks that wrap OpenTUI's `KeyHandler` event system. They follow similar patterns but use framework-specific lifecycle management.

## React Hook: useKeyboard

### Implementation

```typescript
// From packages/react/src/hooks/use-keyboard.ts

import type { KeyEvent } from "@opentui/core"
import { useEffect } from "react"
import { useAppContext } from "../components/app"
import { useEffectEvent } from "./use-event"

export const useKeyboard = (handler: (key: KeyEvent) => void) => {
  const { keyHandler } = useAppContext()
  const stableHandler = useEffectEvent(handler)
  
  useEffect(() => {
    keyHandler?.on("keypress", stableHandler)
    
    return () => {
      keyHandler?.off("keypress", stableHandler)
    }
  }, [keyHandler])
}
```

### How It Works

1. Gets `keyHandler` from AppContext
2. Wraps handler with `useEffectEvent` (stable callback reference)
3. On mount: registers handler on "keypress" event
4. On unmount: unregisters handler
5. Re-registers if keyHandler changes

### Usage

```typescript
import { useKeyboard } from "@opentui/react"

function MyComponent() {
  useKeyboard((keyEvent: KeyEvent) => {
    if (keyEvent.name === "escape") {
      // Handle escape
    }
  })
}
```

## Solid.js Hooks: Complete Set

### Implementation

```typescript
// From packages/solid/src/elements/hooks.ts

import {
  engine,
  PasteEvent,
  Selection,
  Timeline,
  type CliRenderer,
  type KeyEvent,
  type TimelineOptions,
} from "@opentui/core"
import { createContext, createSignal, onCleanup, onMount, useContext } from "solid-js"

export const RendererContext = createContext<CliRenderer>()

export const useRenderer = () => {
  const renderer = useContext(RendererContext)
  if (!renderer) {
    throw new Error("No renderer found")
  }
  return renderer
}
```

### useKeyboard Hook (Solid.js)

```typescript
export const useKeyboard = (callback: (key: KeyEvent) => void) => {
  const renderer = useRenderer()
  const keyHandler = renderer.keyInput
  
  onMount(() => {
    keyHandler.on("keypress", callback)
  })
  
  onCleanup(() => {
    keyHandler.off("keypress", callback)
  })
}
```

### usePaste Hook (Solid.js)

```typescript
export const usePaste = (callback: (event: PasteEvent) => void) => {
  const renderer = useRenderer()
  const keyHandler = renderer.keyInput
  
  onMount(() => {
    keyHandler.on("paste", callback)
  })
  
  onCleanup(() => {
    keyHandler.off("paste", callback)
  })
}
```

### Other Solid.js Hooks

```typescript
// Terminal resize events
export const onResize = (callback: (width: number, height: number) => void) => {
  const renderer = useRenderer()
  onMount(() => {
    renderer.on("resize", callback)
  })
  onCleanup(() => {
    renderer.off("resize", callback)
  })
}

// Terminal dimensions as reactive signal
export const useTerminalDimensions = () => {
  const renderer = useRenderer()
  const [terminalDimensions, setTerminalDimensions] = createSignal<{
    width: number
    height: number
  }>({ width: renderer.width, height: renderer.height })
  
  const callback = (width: number, height: number) => {
    setTerminalDimensions({ width, height })
  }
  onResize(callback)
  return terminalDimensions
}

// Mouse/Selection events
export const useSelectionHandler = (callback: (selection: Selection) => void) => {
  const renderer = useRenderer()
  onMount(() => {
    renderer.on("selection", callback)
  })
  onCleanup(() => {
    renderer.off("selection", callback)
  })
}

// Timeline/animation control
export const useTimeline = (options: TimelineOptions = {}): Timeline => {
  const timeline = new Timeline(options)
  onMount(() => {
    if (options.autoplay !== false) {
      timeline.play()
    }
    engine.register(timeline)
  })
  onCleanup(() => {
    timeline.pause()
    engine.unregister(timeline)
  })
  return timeline
}

// Deprecated alias
export const useKeyHandler = useKeyboard
```

## Key Differences: React vs Solid.js

| Aspect | React | Solid.js |
|--------|-------|----------|
| Context | `useAppContext()` | `useContext(RendererContext)` |
| Lifecycle | `useEffect` with cleanup | `onMount` + `onCleanup` |
| State | `useState` | `createSignal` |
| Callback stability | `useEffectEvent` wrapper | Direct callback (Solid stable by default) |
| Re-registration | Only if `keyHandler` changes | Always in onMount |

## Real Usage: OpenCode Dialog Select

### Complete Example

```typescript
// From opencode/src/cli/cmd/tui/ui/dialog-select.tsx

import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import { useKeybind } from "@tui/context/keybind"
import { Keybind } from "@/util/keybind"
import type { KeyEvent } from "@opentui/core"

export function DialogSelect<T>(props: DialogSelectProps<T>) {
  const keybind = useKeybind()
  const dimensions = useTerminalDimensions()
  const [store, setStore] = createStore({
    selected: 0,
    filter: "",
  })
  
  // Handle keyboard input
  useKeyboard((evt: KeyEvent) => {
    // Built-in vim-style navigation
    if (evt.name === "up" || (evt.ctrl && evt.name === "p")) move(-1)
    if (evt.name === "down" || (evt.ctrl && evt.name === "n")) move(1)
    if (evt.name === "pageup") move(-10)
    if (evt.name === "pagedown") move(10)
    
    // Return/Enter to select
    if (evt.name === "return") {
      const option = selected()
      if (option) {
        if (option.onSelect) option.onSelect(dialog)
        props.onSelect?.(option)
      }
    }
    
    // Custom keybinds
    for (const item of props.keybind ?? []) {
      if (item.disabled) continue
      if (Keybind.match(item.keybind, keybind.parse(evt))) {
        const s = selected()
        if (s) {
          evt.preventDefault()
          item.onTrigger(s)
        }
      }
    }
  })
  
  // Use terminal dimensions for layout
  const height = createMemo(() =>
    Math.min(
      flat().length + grouped().length * 2 - 1,
      Math.floor(dimensions().height / 2) - 6
    )
  )
}
```

## Event Handler Pattern

### General Flow

```
User presses key
    ↓
Terminal stdin receives bytes
    ↓
Renderer's KeyHandler.processInput() parses
    ↓
KeyEvent created (or PasteEvent)
    ↓
KeyHandler emits "keypress" (or "paste")
    ↓
Hook callback registered via useKeyboard
    ↓
Component handler function executes
    ↓
Component updates state/UI
```

## Handler Registration Lifecycle

### React
```typescript
// Mount:
useEffect(() => {
  keyHandler.on("keypress", stableHandler)  // Register
  
  // Unmount:
  return () => {
    keyHandler.off("keypress", stableHandler)  // Unregister
  }
}, [keyHandler])
```

### Solid.js
```typescript
// Mount:
onMount(() => {
  keyHandler.on("keypress", callback)  // Register
})

// Cleanup (automatic on component destroy):
onCleanup(() => {
  keyHandler.off("keypress", callback)  // Unregister
})
```

## Advanced: Preventing Default Behavior

```typescript
useKeyboard((evt: KeyEvent) => {
  if (evt.ctrl && evt.name === "c") {
    // Handle Ctrl+C specially
    evt.preventDefault()  // Prevent other handlers
    
    // Custom behavior
    handleCustomExit()
  }
})

// In InternalKeyHandler:
if (event === "keypress") {
  if (keyEvent.defaultPrevented) {
    return  // Don't emit to renderable handlers
  }
}
```

## Testing Keyboard Handlers

### Mock Keyboard Setup (for testing)

```typescript
import { createMockKeys } from "@opentui/core"

const { pressKey, typeText } = createMockKeys(renderer)

// Simulate key press:
pressKey("a")  // Single character
pressKey("ARROW_UP")  // Special key (from KeyCodes)
pressKey("a", { ctrl: true })  // Ctrl+A

// Simulate typing:
await typeText("hello world")

// Simulate modifier keys:
pressKey("x", { ctrl: true, shift: true })  // Ctrl+Shift+X
```

---

**See also:** [PRACTICAL_EXAMPLES.md](PRACTICAL_EXAMPLES.md) for complete working examples
