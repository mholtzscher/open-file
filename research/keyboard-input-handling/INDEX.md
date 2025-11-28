# Keyboard Input & Keybindings Research - Complete Index

## Document Overview

This research covers how **sst/opencode** and **sst/opentui** handle keyboard input and keybindings across a complete terminal UI framework and application stack.

### Core Documents (2,230 lines total)

| File | Lines | Purpose |
|------|-------|---------|
| [00_START_HERE.md](00_START_HERE.md) | 114 | **Entry point** - Quick overview and navigation guide |
| [SUMMARY.md](SUMMARY.md) | 285 | **Big picture** - Architecture overview and key decisions |
| [KEY_EVENT_ARCHITECTURE.md](KEY_EVENT_ARCHITECTURE.md) | 276 | **Low-level** - KeyEvent types, parsing, and data flow |
| [KEYBINDING_SYSTEM.md](KEYBINDING_SYSTEM.md) | 422 | **Mid-level** - Keybind config, parsing, matching, leader key |
| [KEYBOARD_HOOKS.md](KEYBOARD_HOOKS.md) | 342 | **Integration** - React and Solid.js hooks, lifecycle |
| [PRACTICAL_EXAMPLES.md](PRACTICAL_EXAMPLES.md) | 466 | **Real code** - Complete working examples from both projects |
| [QUICK_REFERENCE.md](QUICK_REFERENCE.md) | 325 | **Cheat sheet** - File locations, code snippets, patterns |

## Reading Paths

### Path 1: First-Time Overview (20 minutes)
1. [00_START_HERE.md](00_START_HERE.md) - Quick context
2. [SUMMARY.md](SUMMARY.md) - Architecture overview
3. [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - Skim for familiar patterns

### Path 2: Deep Dive (45 minutes)
1. [00_START_HERE.md](00_START_HERE.md) - Context
2. [KEY_EVENT_ARCHITECTURE.md](KEY_EVENT_ARCHITECTURE.md) - How events work
3. [KEYBINDING_SYSTEM.md](KEYBINDING_SYSTEM.md) - Config and matching
4. [KEYBOARD_HOOKS.md](KEYBOARD_HOOKS.md) - Integration layer
5. [PRACTICAL_EXAMPLES.md](PRACTICAL_EXAMPLES.md) - See it in action

### Path 3: Implementation (1 hour)
1. [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - Get oriented
2. [PRACTICAL_EXAMPLES.md](PRACTICAL_EXAMPLES.md) - Copy patterns
3. [KEYBINDING_SYSTEM.md](KEYBINDING_SYSTEM.md) - Understand details
4. [KEYBOARD_HOOKS.md](KEYBOARD_HOOKS.md) - Framework integration
5. Reference others as needed

### Path 4: Testing (30 minutes)
1. [PRACTICAL_EXAMPLES.md](PRACTICAL_EXAMPLES.md) - Example tests
2. [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - Mock key utilities
3. [KEYBINDING_SYSTEM.md](KEYBINDING_SYSTEM.md) - Test patterns

## Key Takeaways

### Architecture (4 Layers)

```
Raw Terminal Input
    ↓
KeyHandler (parse ANSI/Kitty)
    ↓
KeyEvent (structured event)
    ↓
useKeyboard hook (component integration)
    ↓
Keybinding context (config-driven matching)
    ↓
Component handler (your app logic)
```

### Core Types at a Glance

```typescript
// Event from keyboard
KeyEvent {
  name: string                 // "a", "escape", "up", etc.
  ctrl, meta, shift: boolean   // Modifiers
  eventType: "press" | "repeat" | "release"
  preventDefault(): void
}

// Keybinding in config
KeybindsConfig {
  leader?: string              // "space"
  app_exit?: string            // "ctrl+c,<leader>q"
  // ... many more
}

// Parsed keybinding
Keybind.Info {
  name: string
  ctrl, meta, shift, leader: boolean
}
```

### Common Pattern

```typescript
import { useKeyboard } from "@opentui/solid"
import { useKeybind } from "@tui/context/keybind"

const keybind = useKeybind()
useKeyboard((evt) => {
  if (keybind.match("app_exit", evt)) {
    handleExit()
  }
})
```

## Repository Structure

### sst/opentui
```
packages/core/src/
  ├── lib/
  │   ├── KeyHandler.ts         ← Event emission
  │   ├── parse.keypress.ts     ← ANSI parsing
  │   └── keymapping.ts         ← KeyBinding interface
  ├── testing/
  │   ├── mock-keys.ts          ← Mock utilities
  │   └── test-renderer.ts      ← Test rendering
  └── renderables/
      └── Input.ts              ← Input component

packages/react/src/hooks/
  └── use-keyboard.ts           ← React hook

packages/solid/src/elements/
  └── hooks.ts                  ← Solid.js hooks
```

### sst/opencode
```
packages/opencode/src/
  ├── util/
  │   └── keybind.ts            ← Parse, match, toString
  ├── cli/cmd/tui/
  │   ├── context/
  │   │   └── keybind.tsx       ← Context with leader key
  │   └── ui/
  │       ├── dialog-select.tsx ← Real example
  │       └── ...other components
  └── test/
      └── keybind.test.ts       ← Comprehensive tests
```

## Key Resources

### Files to Reference
- `packages/opencode/src/util/keybind.ts` (80 lines)
  - Keybind.parse(), match(), toString()
  
- `packages/opencode/src/cli/cmd/tui/context/keybind.tsx` (112 lines)
  - Context implementation, leader key logic

- `packages/opencode/test/keybind.test.ts` (318 lines)
  - Test patterns and edge cases

- `packages/core/src/lib/KeyHandler.ts` (195 lines)
  - Event emission, preventDefault, priority handling

- `packages/core/src/lib/parse.keypress.ts` (500+ lines)
  - ANSI escape sequence parsing

- `packages/react/src/hooks/use-keyboard.ts` (18 lines)
  - React integration

- `packages/solid/src/elements/hooks.ts` (110 lines)
  - Solid.js integration

### Test Examples
- Keybind parsing tests: 100+ test cases
- Component keyboard tests: Real-world patterns
- Mock key utilities: Comprehensive mock setup

## Quick Links

### By Topic
- **Events**: [KEY_EVENT_ARCHITECTURE.md](KEY_EVENT_ARCHITECTURE.md)
- **Keybindings**: [KEYBINDING_SYSTEM.md](KEYBINDING_SYSTEM.md)
- **Hooks**: [KEYBOARD_HOOKS.md](KEYBOARD_HOOKS.md)
- **Examples**: [PRACTICAL_EXAMPLES.md](PRACTICAL_EXAMPLES.md)
- **Reference**: [QUICK_REFERENCE.md](QUICK_REFERENCE.md)

### By Audience
- **First-timer**: Start with [00_START_HERE.md](00_START_HERE.md)
- **Architect**: Read [SUMMARY.md](SUMMARY.md)
- **Implementer**: Use [QUICK_REFERENCE.md](QUICK_REFERENCE.md)
- **Tester**: See [PRACTICAL_EXAMPLES.md](PRACTICAL_EXAMPLES.md)

## Integration for open-s3

### Recommendations

1. **Adopt the Keybinding Pattern**
   ```typescript
   // Define config
   type S3KeybindsConfig = KeybindsConfig & {
     object_copy?: string
     object_move?: string
     object_delete?: string
     object_download?: string
   }
   ```

2. **Use Leader Key for Complex Operations**
   ```
   <leader>c - Copy object
   <leader>m - Move object
   <leader>d - Delete object
   <leader>u - Upload
   <leader>x - Export
   ```

3. **Leverage Keybind Context**
   - Single source of truth
   - Type-safe configuration
   - Easy help text generation

4. **Testing Strategy**
   - Mock keys for keyboard tests
   - Keybind matching tests
   - Component integration tests

## Summary Statistics

- **Total Documentation**: 2,230 lines
- **Code Examples**: 40+ real examples
- **Test Patterns**: 8+ patterns
- **Key Concepts**: 15+ core concepts
- **Architecture Layers**: 4 distinct layers
- **Projects Covered**: 2 (opentui + opencode)

---

**Start reading:** [00_START_HERE.md](00_START_HERE.md)
