# Keyboard Input & Keybindings Research: sst/opencode & sst/opentui

## Quick Overview

This research document covers how **sst/opencode** and **sst/opentui** handle keyboard input and keybindings. These are two complementary projects:

- **sst/opentui**: Terminal UI framework - provides low-level key event handling
- **sst/opencode**: IDE-like terminal application - uses opentui and adds high-level keybinding configuration

## Key Findings

### Architecture Pattern: Three-Layer Keyboard Handling

```
Raw Terminal Input
       ↓
KeyHandler (Parse ANSI/Kitty protocols)
       ↓
KeyEvent (Structured key with modifiers)
       ↓
Component Handlers (useKeyboard hook)
       ↓
Keybinding System (Match against config)
       ↓
Action Dispatch
```

### Critical Files Reference

**OpenTUI (Framework):**
- `packages/core/src/lib/KeyHandler.ts` - Key event emission & preventDefault
- `packages/core/src/lib/parse.keypress.ts` - ANSI escape sequence parsing
- `packages/react/src/hooks/use-keyboard.ts` - React hook wrapper
- `packages/solid/src/elements/hooks.ts` - Solid.js hook wrapper

**OpenCode (Application):**
- `packages/opencode/src/util/keybind.ts` - Keybinding data structures & matching
- `packages/opencode/src/cli/cmd/tui/context/keybind.tsx` - Keybinding context & leader key
- `packages/opencode/test/keybind.test.ts` - Comprehensive keybinding tests

## Document Contents

1. **[KEY_EVENT_ARCHITECTURE.md](KEY_EVENT_ARCHITECTURE.md)** - KeyEvent types, flow, and properties
2. **[KEYBINDING_SYSTEM.md](KEYBINDING_SYSTEM.md)** - How keybindings are defined, parsed, and matched
3. **[KEYBOARD_HOOKS.md](KEYBOARD_HOOKS.md)** - useKeyboard hooks in React and Solid.js
4. **[PARSING_PROTOCOLS.md](PARSING_PROTOCOLS.md)** - ANSI escape sequences, Kitty protocol, parsing
5. **[PRACTICAL_EXAMPLES.md](PRACTICAL_EXAMPLES.md)** - Real code examples from both projects
6. **[KEYBINDING_PATTERNS.md](KEYBINDING_PATTERNS.md)** - Design patterns for keybinding handling

## Quick Reference: Keybinding Matching

```typescript
// In component:
const keybind = useKeybind()
useKeyboard((evt) => {
  if (keybind.match("app_exit", evt)) {
    // Handle exit
  }
})

// How it works:
// 1. KeybindsConfig has: app_exit?: "ctrl+c,<leader>q"
// 2. Keybind.parse() converts string to Keybind.Info[] array
// 3. Keybind.match() compares parsed event against each Keybind.Info
// 4. Returns true if any match found
```

## Quick Reference: Key Event Properties

```typescript
interface KeyEvent {
  name: string           // 'a', 'up', 'escape', 'f1', etc.
  ctrl: boolean          // Ctrl modifier
  meta: boolean          // Alt/Option/Meta modifier
  shift: boolean         // Shift modifier
  option: boolean        // Option key (Mac)
  sequence: string       // Raw escape sequence
  raw: string            // Raw input
  eventType: "press" | "repeat" | "release"
  source: "raw" | "kitty"
  super?: boolean
  hyper?: boolean
  capsLock?: boolean
  numLock?: boolean
  code?: string
  baseCode?: number
  
  // Methods:
  preventDefault()       // Stop default handling
  defaultPrevented: boolean
}
```

## Leader Key System (OpenCode Feature)

OpenCode extends keyboard handling with a **leader key** pattern (vim-like):

```typescript
// In keybinds config:
leader: "<leader>"      // The leader key sequence (e.g., "space")
// Then other bindings can use: "<leader>f", "<leader>x", etc.

// In code:
useKeyboard((evt) => {
  if (!store.leader && result.match("leader", evt)) {
    leader(true)        // Enter leader mode (2s timeout)
  }
  // After leader pressed, next key is matched with leader=true
})
```

---

For complete details, see individual documents linked above.
