# Keybinding System: Configuration, Parsing, and Matching

## Overview

OpenCode implements a keybinding system with three main components:

1. **Configuration** (`KeybindsConfig`) - Type-safe keybinding declarations
2. **Parsing** (`Keybind.parse()`) - Convert config strings to structured info
3. **Matching** (`Keybind.match()`) - Compare events against bindings

## KeybindsConfig Type

From `packages/sdk/js/src/gen/types.gen.ts`:

```typescript
export type KeybindsConfig = {
  // Leader key for keybind combinations
  leader?: string;

  // Navigation
  app_exit?: string;
  editor_open?: string;
  theme_list?: string;
  sidebar_toggle?: string;
  status_view?: string;

  // Session management
  session_export?: string;
  session_new?: string;
  session_list?: string;
  session_timeline?: string;
  session_share?: string;
  session_unshare?: string;

  // ... many more keybinds

  input_clear?: string;
  input_forward_delete?: string;
  history_previous?: string;
  history_next?: string;

  // ...and more
};
```

Each value is an optional string containing keybinding syntax.

## Keybinding Data Structure

### Keybind.Info

```typescript
// From packages/opencode/src/util/keybind.ts

export namespace Keybind {
  export type Info = {
    ctrl: boolean; // Ctrl modifier
    meta: boolean; // Alt/Option/Meta modifier
    shift: boolean; // Shift modifier
    leader: boolean; // Leader key modifier (vim-like)
    name: string; // Key name: 'a', 'escape', 'f1', etc.
  };
}
```

## Parsing Keybinding Strings

### Input Format

```typescript
// Single key:
"a"                     // Just the letter a

// With modifiers:
"ctrl+x"                // Ctrl+X
"alt+v"                 // Alt+V (meta: true)
"shift+return"          // Shift+Enter
"ctrl+alt+shift+g"      // Multiple modifiers

// Leader syntax (vim-style):
"<leader>f"             // Leader key + f
"<leader>"              // Just the leader key
"<leader>ctrl+x"        // Leader + Ctrl+X

// Multiple bindings (comma-separated):
"ctrl+c,<leader>q"      // Either Ctrl+C or Leader+Q

// Special:
"none"                  // No keybinding (empty array)

// Special keys:
"esc"  → "escape"       // Escape key
"del"  → "delete"       // Delete key
```

### Keybind.parse() Implementation

```typescript
export function parse(key: string): Info[] {
  if (key === 'none') return [];

  return key.split(',').map(combo => {
    // Handle <leader> syntax by replacing with leader+
    const normalized = combo.replace(/<leader>/g, 'leader+');
    const parts = normalized.toLowerCase().split('+');

    const info: Info = {
      ctrl: false,
      meta: false,
      shift: false,
      leader: false,
      name: '',
    };

    for (const part of parts) {
      switch (part) {
        case 'ctrl':
          info.ctrl = true;
          break;
        case 'alt':
        case 'meta':
        case 'option':
          info.meta = true; // All map to meta
          break;
        case 'shift':
          info.shift = true;
          break;
        case 'leader':
          info.leader = true;
          break;
        case 'esc':
          info.name = 'escape'; // Normalize "esc" to "escape"
          break;
        default:
          info.name = part;
          break;
      }
    }

    return info;
  });
}
```

### Parse Examples

```typescript
Keybind.parse('ctrl+x');
// → [{ ctrl: true, meta: false, shift: false, leader: false, name: "x" }]

Keybind.parse('<leader>f');
// → [{ ctrl: false, meta: false, shift: false, leader: true, name: "f" }]

Keybind.parse('ctrl+c,<leader>q');
// → [
//     { ctrl: true, meta: false, shift: false, leader: false, name: "c" },
//     { ctrl: false, meta: false, shift: false, leader: true, name: "q" }
//   ]

Keybind.parse('shift+alt+g');
// → [{ ctrl: false, meta: true, shift: true, leader: false, name: "g" }]

Keybind.parse('none');
// → []
```

## Converting Keybind.Info to String

### Keybind.toString()

```typescript
export function toString(info: Info): string {
  const parts: string[] = [];

  if (info.ctrl) parts.push('ctrl');
  if (info.meta) parts.push('alt');
  if (info.shift) parts.push('shift');
  if (info.name) {
    if (info.name === 'delete')
      parts.push('del'); // Normalize "delete" to "del"
    else parts.push(info.name);
  }

  let result = parts.join('+');

  if (info.leader) {
    result = result ? `<leader> ${result}` : `<leader>`;
  }

  return result;
}
```

### toString Examples

```typescript
Keybind.toString({
  ctrl: true,
  meta: false,
  shift: false,
  leader: false,
  name: 'x',
});
// → "ctrl+x"

Keybind.toString({
  ctrl: false,
  meta: false,
  shift: false,
  leader: true,
  name: 'f',
});
// → "<leader> f"

Keybind.toString({
  ctrl: true,
  meta: true,
  shift: false,
  leader: false,
  name: 'g',
});
// → "ctrl+alt+g"
```

## Matching Keybindings

### Keybind.match()

```typescript
export function match(a: Info, b: Info): boolean {
  return isDeepEqual(a, b); // Uses remeda's deep equality
}

// Compares all fields:
// a.ctrl === b.ctrl
// a.meta === b.meta
// a.shift === b.shift
// a.leader === b.leader
// a.name === b.name
```

## Keybinding Context

The keybind context provides high-level matching against config:

```typescript
// From packages/opencode/src/cli/cmd/tui/context/keybind.tsx

export const { use: useKeybind, provider: KeybindProvider } = createSimpleContext({
  name: "Keybind",
  init: () => {
    const sync = useSync()

    // Parse all keybinds from config (memoized)
    const keybinds = createMemo(() => {
      return pipe(
        sync.data.config.keybinds ?? {},
        mapValues((value) => Keybind.parse(value))  // Parse each string to Info[]
      )
    })

    const [store, setStore] = createStore({
      leader: false  // Track leader mode state
    })

    const result = {
      // Get all parsed keybinds
      get all() {
        return keybinds()
      }

      // Get leader mode state
      get leader() {
        return store.leader
      }

      // Convert ParsedKey to Keybind.Info
      parse(evt: ParsedKey): Keybind.Info {
        return {
          ctrl: evt.ctrl,
          name: evt.name,
          shift: evt.shift,
          leader: store.leader,  // Include current leader state
          meta: evt.meta,
        }
      }

      // Match against a keybind config key
      match(key: keyof KeybindsConfig, evt: ParsedKey) {
        const keybind = keybinds()[key]
        if (!keybind) return false

        const parsed: Keybind.Info = result.parse(evt)

        // Try matching against each possible binding
        for (const configKey of keybind) {
          if (Keybind.match(configKey, parsed)) {
            return true
          }
        }
      }

      // Get printable string for a keybind
      print(key: keyof KeybindsConfig) {
        const first = keybinds()[key]?.at(0)
        if (!first) return ""

        const result = Keybind.toString(first)
        // Replace <leader> placeholder with actual leader keybind
        return result.replace("<leader>", Keybind.toString(keybinds().leader![0]!))
      }
    }

    return result
  }
})
```

## Leader Key System (Vim-Style)

### Leader Mode State Machine

```typescript
const [store, setStore] = createStore({
  leader: false, // Whether we're in leader mode
});

let focus: Renderable | null; // Focus to restore
let timeout: NodeJS.Timeout;

function leader(active: boolean) {
  if (active) {
    setStore('leader', true);
    focus = renderer.currentFocusedRenderable;
    focus?.blur(); // Blur current renderable

    // Auto-exit leader mode after 2 seconds
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      if (!store.leader) return;
      leader(false);
      if (focus) {
        focus.focus();
      }
    }, 2000);

    return;
  }

  if (!active) {
    if (focus && !renderer.currentFocusedRenderable) {
      focus.focus(); // Restore focus
    }
    setStore('leader', false);
  }
}

// When leader key pressed:
useKeyboard(async evt => {
  if (!store.leader && result.match('leader', evt)) {
    leader(true);
    return;
  }

  // After leader pressed, next key has leader=true
  if (store.leader && evt.name) {
    setImmediate(() => {
      if (focus && renderer.currentFocusedRenderable === focus) {
        focus.focus();
      }
      leader(false); // Exit leader mode
    });
  }
});
```

### Leader Key Timeline

```
t0: User presses space (the leader key)
    └─ leader(true) called
    └─ store.leader = true
    └─ 2-second timeout started

t1: User presses 'f' (within 2 seconds)
    └─ parse(evt) includes leader: true
    └─ Can match against "<leader>f" keybinds

t2: User presses another key OR timeout expires
    └─ leader(false) called
    └─ store.leader = false
```

## Component Usage Pattern

```typescript
// In a component using keybindings:

import { useKeybind } from '@tui/context/keybind';
import { useKeyboard } from '@opentui/solid';
import { Keybind } from '@/util/keybind';

export function MyComponent() {
  const keybind = useKeybind();

  useKeyboard(evt => {
    // Option 1: Match against config keybind
    if (keybind.match('app_exit', evt)) {
      handleExit();
    }

    // Option 2: Direct keybind object comparison
    const customKeyMap = {
      copy: Keybind.parse('ctrl+c')[0],
      paste: Keybind.parse('ctrl+v')[0],
    };

    const parsed = keybind.parse(evt);
    if (Keybind.match(customKeyMap.copy, parsed)) {
      handleCopy();
    }

    // Option 3: Handle keybind options (array of possibilities)
    for (const item of props.keybinds ?? []) {
      if (Keybind.match(item.keybind, keybind.parse(evt))) {
        item.onTrigger();
      }
    }
  });
}
```

---

**See also:** [PRACTICAL_EXAMPLES.md](PRACTICAL_EXAMPLES.md) for real usage patterns
