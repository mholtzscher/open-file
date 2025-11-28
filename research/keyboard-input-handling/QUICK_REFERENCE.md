# Quick Reference: Keyboard Handling

## File Locations

### OpenTUI (Framework)
```
/tmp/opentui/packages/core/src/lib/
  ├── KeyHandler.ts              # KeyEvent emission, preventDefault
  ├── parse.keypress.ts          # ANSI parsing
  ├── parse.keypress-kitty.ts    # Kitty protocol parsing
  └── keymapping.ts              # KeyBinding interface

/tmp/opentui/packages/react/src/hooks/
  └── use-keyboard.ts            # React hook

/tmp/opentui/packages/solid/src/elements/
  └── hooks.ts                   # Solid.js hooks (useKeyboard, usePaste, etc.)

/tmp/opentui/packages/core/src/testing/
  ├── mock-keys.ts               # Mock key utilities
  └── test-renderer.ts           # Test rendering
```

### OpenCode (Application)
```
/tmp/opencode/packages/opencode/src/
  ├── util/keybind.ts            # Keybind utility (parse, match, toString)
  ├── cli/cmd/tui/context/keybind.tsx  # Keybind context with leader key
  └── test/keybind.test.ts       # Comprehensive tests (318 lines)
```

## Quick Code Snippets

### Use Keyboard Hook

```typescript
// React
import { useKeyboard } from "@opentui/react"

useKeyboard((evt) => {
  if (evt.name === "escape") handleExit()
})

// Solid.js
import { useKeyboard } from "@opentui/solid"

useKeyboard((evt) => {
  if (evt.name === "escape") handleExit()
})
```

### Parse Keybinding String

```typescript
import { Keybind } from "@/util/keybind"

// String → Info[]
const parsed = Keybind.parse("ctrl+c,<leader>q")
// → [
//     {ctrl: true, meta: false, shift: false, leader: false, name: "c"},
//     {ctrl: false, meta: false, shift: false, leader: true, name: "q"}
//   ]

// Info → String
const str = Keybind.toString({ctrl: true, name: "x"})
// → "ctrl+x"
```

### Match Keybinding

```typescript
import { Keybind } from "@/util/keybind"

// Direct match
const binding: Keybind.Info = {ctrl: true, meta: false, shift: false, leader: false, name: "x"}
const parsed: Keybind.Info = keybind.parse(evt)
if (Keybind.match(binding, parsed)) {
  // Matched!
}

// Via context
const keybind = useKeybind()
if (keybind.match("app_exit", evt)) {
  // Config keybind matched
}
```

### KeyEvent Properties

```typescript
interface KeyEvent {
  name: string              // "a", "escape", "f1", "up", etc.
  ctrl: boolean
  meta: boolean             // Alt/Option/Meta
  shift: boolean
  option: boolean           // Mac-specific
  sequence: string          // Raw escape sequence
  raw: string              // Raw input
  eventType: "press" | "repeat" | "release"
  source: "raw" | "kitty"
  
  preventDefault(): void
  defaultPrevented: boolean
}
```

### Key Names Reference

```
Simple:     "a", "b", "x", "1", "!", etc.
Special:    "return", "escape", "tab", "backspace", "delete"
Navigation: "up", "down", "left", "right", "home", "end", "pageup", "pagedown"
Functions:  "f1", "f2", ..., "f12"
Modifiers:  ctrl, meta (alt), shift, option, super, hyper
```

### Keybinding String Format

```
"a"                     # Single key
"ctrl+a"                # Ctrl+A
"alt+v"                 # Alt+V (meta: true)
"meta+v"                # Same as alt+v
"option+v"              # Same as alt+v (Mac)
"shift+return"          # Shift+Enter
"ctrl+alt+x"            # Multiple modifiers
"<leader>f"             # Leader key + f
"ctrl+c,<leader>q"      # OR: Ctrl+C or Leader+Q
"none"                  # No binding (empty)
```

### Mock Keys for Testing

```typescript
import { createMockKeys } from "@opentui/core"

const { pressKey, typeText } = createMockKeys(renderer)

// Characters
pressKey("a")           // Type 'a'
pressKey("1")           # Type '1'

// Special keys (from KeyCodes)
pressKey("RETURN")      # Enter
pressKey("ESCAPE")      # ESC
pressKey("TAB")         # Tab
pressKey("BACKSPACE")   # Backspace
pressKey("DELETE")      # Delete
pressKey("ARROW_UP")    # Up arrow
pressKey("ARROW_DOWN")  # Down arrow
pressKey("F1")          # F1 key

// With modifiers
pressKey("a", { ctrl: true })       # Ctrl+A
pressKey("x", { shift: true })      # Shift+X
pressKey("c", { meta: true })       # Alt+C
pressKey("d", { ctrl: true, shift: true })  # Ctrl+Shift+D

// Multiple keys
await typeText("hello")
await pressKeys(["j", "j", "k"])
```

## Common Patterns

### Pattern 1: Config-Driven Keybinding

```typescript
// Config
const config = {
  keybinds: {
    app_exit: "ctrl+c",
    editor_open: "e",
  }
}

// Component
const keybind = useKeybind()
useKeyboard((evt) => {
  if (keybind.match("app_exit", evt)) {
    exit()
  }
})
```

### Pattern 2: Multiple Alternatives

```typescript
// Parse returns array
const bindings = Keybind.parse("ctrl+c,<leader>q,esc")
// → 3 alternatives

// All matched by keybind.match()
keybind.match("app_exit", ctrlCEvent)  // true
keybind.match("app_exit", leaderQEvent) // true
keybind.match("app_exit", escapeEvent)  // true
```

### Pattern 3: Leader Key State

```typescript
const keybind = useKeybind()

// Check leader state
console.log(keybind.leader)  // true/false

// In parse, leader state included
const parsed = keybind.parse(evt)
console.log(parsed.leader)  // true if in leader mode
```

### Pattern 4: Direct Event Check

```typescript
useKeyboard((evt) => {
  // Common keys don't need config
  if (evt.name === "escape") handleEscape()
  if (evt.name === "return") handleSelect()
  
  // But config-driven for customizable keys
  if (keybind.match("app_exit", evt)) handleExit()
})
```

### Pattern 5: Prevent Default

```typescript
useKeyboard((evt) => {
  if (evt.ctrl && evt.name === "c") {
    evt.preventDefault()  // Stop further handlers
    handleSpecialCtrlC()
  }
})
```

## Data Flow Diagram

```
User Presses Key
    ↓
Terminal sends raw bytes
    ↓
Renderer.stdin emits 'data'
    ↓
KeyHandler.processInput(data)
    ├─ parseKeypress(data) → ParsedKey
    └─ new KeyEvent(parsed) → emit('keypress', event)
    ↓
Component's useKeyboard handler
    ├─ keybind.parse(evt) → Keybind.Info with leader state
    └─ Keybind.match(binding, parsed) → boolean
    ↓
Component handles / updates state
```

## State Management

### Leader Key Timeline

```
t=0ms:  User presses space (leader key)
        → store.leader = true
        → timeout = 2000ms

t=100ms: User presses 'f'
        → keybind.parse(evt).leader = true
        → Can match "<leader>f"

t=2000ms: Timeout expires (or user presses another key)
        → store.leader = false
```

## Testing Patterns

### Test Parsing

```typescript
const result = Keybind.parse("ctrl+x")
expect(result).toEqual([
  {ctrl: true, meta: false, shift: false, leader: false, name: "x"}
])
```

### Test Matching

```typescript
const a = {ctrl: true, meta: false, shift: false, leader: false, name: "x"}
const b = {ctrl: true, meta: false, shift: false, leader: false, name: "x"}
expect(Keybind.match(a, b)).toBe(true)
```

### Test Component Keyboard

```typescript
const { renderOnce, mockInput } = await testRender(<MyComponent />)
mockInput.pressKey("j")  // Move down
await renderOnce()
expect(captureCharFrame()).toContain("selected")
```

## Troubleshooting

### Event not detected?
- Check `evt.name` (not always single character)
- Function keys are "f1", not "F1"
- "escape", not "esc" (after parsing)

### Keybind not matching?
- Verify all modifiers match (ctrl, meta, shift, leader)
- Check leader state: `keybind.leader`
- Parse both: `keybind.parse(evt)` then compare

### Modifiers not working?
- alt/meta/option all map to `meta: true`
- No separate handling per platform
- Test with mock keys that use expected protocol

### KeyEvent not reaching handler?
- Check `evt.preventDefault()` called earlier
- Global handlers execute first and can block
- Ensure handler registered after mount

---

**For full details, see:** [KEYBINDING_SYSTEM.md](KEYBINDING_SYSTEM.md)
