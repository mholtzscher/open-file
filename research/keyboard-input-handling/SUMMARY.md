# Keyboard Input & Keybindings Summary

## Architecture Overview

### Three-Layer Model

```
Layer 1: Raw Terminal Input
  └─ ANSI escape sequences, Kitty protocol, control characters
  
Layer 2: Key Parsing & Events (OpenTUI)
  ├─ parseKeypress() - Parse ANSI/Kitty protocols
  ├─ KeyHandler - Emit keypress/keyrepeat/keyrelease events
  └─ KeyEvent - Structured event with modifiers & meta info
  
Layer 3: Component Handlers (Framework Integration)
  ├─ useKeyboard() hook (React/Solid.js)
  ├─ Component receives KeyEvent
  └─ Keybinding context (OpenCode-specific)
  
Layer 4: Keybinding System (OpenCode)
  ├─ KeybindsConfig - Configuration type
  ├─ Keybind.parse() - Convert config strings
  ├─ Keybind.match() - Compare events
  └─ Leader key system - Vim-style mode
```

## Key Components

### Core Types

```typescript
// ParsedKey - internal parsing result
interface ParsedKey {
  name: string                 // Key name
  ctrl/meta/shift/option: boolean
  sequence: string            // Raw escape sequence
  raw: string                 // Raw input
  eventType: "press" | "repeat" | "release"
  source: "raw" | "kitty"     // Protocol used
  // ... more properties
}

// KeyEvent - public API
class KeyEvent implements ParsedKey {
  preventDefault()            // Stop propagation
  get defaultPrevented()
}

// Keybind.Info - keybinding structure
type Info = {
  ctrl: boolean
  meta: boolean
  shift: boolean
  leader: boolean             // Vim-style leader key
  name: string                // 'a', 'escape', 'f1', etc.
}

// KeybindsConfig - configuration
type KeybindsConfig = {
  leader?: string             // e.g., "space"
  app_exit?: string           // e.g., "ctrl+c,<leader>q"
  // ... many more
}
```

## Key Parsing

### Supported Formats

```typescript
"a"                           // Simple key
"ctrl+x"                      // Modifier + key
"alt+v", "meta+v", "option+v" // All map to meta: true
"shift+return"                // Shift + special key
"<leader>f"                   // Vim-style leader + key
"ctrl+c,<leader>q"            // Multiple alternatives (OR)
"none"                        // Empty (no binding)

// Special parsing
"esc" → "escape" (normalized)
"del" → "delete" (normalized)
```

### Parse Flow

```
Input string
  ↓
Split by comma (multiple alternatives)
  ↓
For each alternative:
  Replace <leader> with leader+
  Split by + to get parts
  Process each part:
    "ctrl" → ctrl: true
    "alt|meta|option" → meta: true
    "shift" → shift: true
    "leader" → leader: true
    "esc" → name: "escape"
    otherwise → name: part
  ↓
Return Info[]
```

## Component Usage Pattern

### Basic Pattern

```typescript
// 1. Import
import { useKeyboard } from "@opentui/solid"
import { useKeybind } from "@tui/context/keybind"
import { Keybind } from "@/util/keybind"

// 2. Get context
const keybind = useKeybind()

// 3. Register handler
useKeyboard((evt: KeyEvent) => {
  // Option A: Match config keybind
  if (keybind.match("app_exit", evt)) {
    // Handle
  }
  
  // Option B: Direct event check
  if (evt.name === "escape") {
    // Handle
  }
  
  // Option C: Custom keybind
  const custom = Keybind.parse("ctrl+x")[0]
  if (Keybind.match(custom, keybind.parse(evt))) {
    evt.preventDefault()
    // Handle
  }
})
```

### Leader Key Pattern

```typescript
// In context setup (one-time)
useKeyboard((evt) => {
  if (!store.leader && result.match("leader", evt)) {
    store.leader = true    // Enter leader mode
    timeout = 2000ms       // Auto-exit after 2s
    return
  }
  
  if (store.leader && evt.name) {
    store.leader = false   // Exit leader mode
  }
})

// In components
useKeyboard((evt) => {
  const parsed = keybind.parse(evt)  // Includes leader state
  
  if (Keybind.match({
    ctrl: false, meta: false, shift: false,
    leader: true,  // Only matches if in leader mode
    name: "f"
  }, parsed)) {
    // Matched "<leader>f"
  }
})
```

## Testing

### Mock Keys Utilities

```typescript
import { createMockKeys } from "@opentui/core"

const { pressKey, typeText, pressKeys } = createMockKeys(renderer)

// Single key
pressKey("a")                      // Character
pressKey("RETURN")                 // Special key
pressKey("ARROW_UP")               // Navigation

// Modifiers
pressKey("x", { ctrl: true })      // Ctrl+X
pressKey("a", { shift: true })     // Shift+A
pressKey("c", { meta: true })      // Alt+C

// Multiple keys (async)
await typeText("hello")
await pressKeys(["j", "j", "k"])

// Protocols
createMockKeys(renderer, {
  kittyKeyboard: true            // Use Kitty protocol
  otherModifiersMode: true       // Use modifyOtherKeys
})
```

## Known Key Names

```
Function keys:   f1, f2, ..., f12
Control:         return, escape, tab, backspace, delete
Navigation:      up, down, left, right, home, end, pageup, pagedown
Special:         insert, null (Ctrl+Space)
```

## Notable Design Decisions

### 1. Keybind String Format
- Uses `<leader>` not `leader` for readability
- Supports comma-separated alternatives (OR logic)
- Case-insensitive parsing (normalized to lowercase)

### 2. Meta/Alt Unification
- Different platforms represent Alt differently (alt, meta, option)
- All map to single `meta: boolean` field
- Simplifies cross-platform matching

### 3. Leader Key Implementation
- State machine approach (enter/exit leader mode)
- 2-second timeout for auto-exit
- Blurs focused renderable to indicate mode
- Restores focus on exit

### 4. Event Propagation
- `preventDefault()` prevents renderable handlers
- Global handlers always execute first
- Renderable handlers only if not prevented

### 5. Config-Driven
- All keybinds defined in `KeybindsConfig` type
- Type-safe keybind matching
- String format in config files
- Parsed at runtime (memoized)

## Performance Considerations

### Memoization
```typescript
// Keybinds parsed once per config change
const keybinds = createMemo(() => {
  return mapValues(config.keybinds, Keybind.parse)
})

// Avoids repeated parsing
keybind.match("key", evt)  // Uses memoized parsed value
```

### Event Handler Deregistration
```typescript
// Always clean up
useKeyboard((evt) => { /* ... */ })  // Auto-registers
// On component unmount, automatically unregisters
```

## Open-S3 Integration Opportunities

For the open-s3 project, consider:

1. **Adopt OpenCode's Keybinding System**
   - Type-safe config-driven keybindings
   - Leader key support for complex command sequences
   - Consistent keybind format across app

2. **Use Keybind Context Pattern**
   - Single source of truth for keybinds
   - Memoized parsing
   - Easy to display help text

3. **Keyboard Testing**
   - Use OpenTUI's mock key utilities
   - Test keybind matching logic separately
   - Parameterized tests for multiple bindings

4. **Leader Key for S3 Operations**
   - `<leader>c` - Copy object
   - `<leader>m` - Move object
   - `<leader>d` - Delete object
   - etc.

---

**See detailed documentation in:** [00_START_HERE.md](00_START_HERE.md)
