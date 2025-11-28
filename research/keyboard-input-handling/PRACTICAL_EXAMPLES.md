# Practical Examples: Real Code from Both Projects

## Example 1: OpenCode Dialog Select Component

Complete real-world example showing keyboard handling with keybindings:

```typescript
// From: packages/opencode/src/cli/cmd/tui/ui/dialog-select.tsx

import { InputRenderable, ScrollBoxRenderable } from '@opentui/core';
import { useKeyboard, useTerminalDimensions } from '@opentui/solid';
import { useKeybind } from '@tui/context/keybind';
import { Keybind } from '@/util/keybind';
import { createStore } from 'solid-js/store';
import { createMemo } from 'solid-js';

export interface DialogSelectProps<T> {
  title: string;
  options: DialogSelectOption<T>[];
  keybind?: {
    keybind: Keybind.Info;
    title: string;
    disabled?: boolean;
    onTrigger: (option: DialogSelectOption<T>) => void;
  }[];
  current?: T;
}

export function DialogSelect<T>(props: DialogSelectProps<T>) {
  const keybind = useKeybind();
  const [store, setStore] = createStore({
    selected: 0,
    filter: '',
  });

  const filtered = createMemo(() => {
    const needle = store.filter.toLowerCase();
    // ... filtering logic
    return result;
  });

  function move(direction: number) {
    let next = store.selected + direction;
    if (next < 0) next = flat().length - 1;
    if (next >= flat().length) next = 0;
    moveTo(next);
  }

  function moveTo(next: number) {
    setStore('selected', next);
    props.onMove?.(selected()!);
    // ... scroll handling
  }

  // KEYBOARD HANDLING
  useKeyboard(evt => {
    // Built-in navigation
    if (evt.name === 'up' || (evt.ctrl && evt.name === 'p')) move(-1);
    if (evt.name === 'down' || (evt.ctrl && evt.name === 'n')) move(1);
    if (evt.name === 'pageup') move(-10);
    if (evt.name === 'pagedown') move(10);

    // Selection on Enter
    if (evt.name === 'return') {
      const option = selected();
      if (option) {
        if (option.onSelect) option.onSelect(dialog);
        props.onSelect?.(option);
      }
    }

    // Custom keybinds passed as props
    for (const item of props.keybind ?? []) {
      if (item.disabled) continue;
      // Match keybind against parsed event
      if (Keybind.match(item.keybind, keybind.parse(evt))) {
        const s = selected();
        if (s) {
          evt.preventDefault(); // Stop other handlers
          item.onTrigger(s);
        }
      }
    }
  });

  // Render UI...
}
```

**Key Patterns:**

- Use `useKeyboard()` for raw key events
- Use `keybind.parse(evt)` to convert ParsedKey to Keybind.Info
- Use `Keybind.match()` to check against keybinds
- Call `evt.preventDefault()` to stop propagation
- Mix direct event checking (`evt.name === "up"`) with keybind matching

## Example 2: OpenCode Prompt Input Component

Input field with history navigation and keybinding support:

```typescript
// From: opencode/src/cli/cmd/tui/component/prompt/index.tsx
// (Simplified version)

import { useKeyboard } from "@opentui/solid"
import { useKeybind } from "@tui/context/keybind"
import { InputRenderable } from "@opentui/core"

interface PromptProps {
  // ...
}

export function Prompt(props: PromptProps) {
  const keybind = useKeybind()
  const [store, setStore] = createStore({
    prompt: {
      input: "",
    },
    history: {
      index: -1,
      offset: 0,
    },
  })

  let input: InputRenderable

  useKeyboard((e) => {
    // Clear input (Ctrl+U or configured keybind)
    if (keybind.match("input_clear", e) && store.prompt.input !== "") {
      input.clear()
      return
    }

    // Delete forward (Ctrl+D or configured keybind)
    if (keybind.match("input_forward_delete", e) && store.prompt.input !== "") {
      input.deleteCharForward()
      return
    }

    // Exit app (Ctrl+C or configured keybind)
    if (keybind.match("app_exit", e)) {
      // Handle exit
      return
    }

    // History navigation
    const canGoBack =
      (keybind.match("history_previous", e) && input.cursorOffset === 0) ||
      (keybind.match("history_next", e) && input.cursorOffset === input.plainText.length)

    if (canGoBack) {
      const direction = keybind.match("history_previous", e) ? -1 : 1
      // Navigate history
    }
  })

  return <input ref={(r) => (input = r)} />
}
```

**Key Patterns:**

- Check multiple keybinds with `keybind.match()`
- Coordinate with renderable properties (cursor position)
- Early return to prevent further processing
- No preventDefault() needed (consuming the event by handling it)

## Example 3: Keybinding Tests from OpenCode

Test patterns for keybinding logic:

```typescript
// From: packages/opencode/test/keybind.test.ts

import { describe, test, expect } from 'bun:test';
import { Keybind } from '../src/util/keybind';

describe('Keybind.parse', () => {
  test('should parse simple key', () => {
    const result = Keybind.parse('f');
    expect(result).toEqual([
      {
        ctrl: false,
        meta: false,
        shift: false,
        leader: false,
        name: 'f',
      },
    ]);
  });

  test('should parse leader key syntax', () => {
    const result = Keybind.parse('<leader>f');
    expect(result).toEqual([
      {
        ctrl: false,
        meta: false,
        shift: false,
        leader: true,
        name: 'f',
      },
    ]);
  });

  test('should parse multiple keybinds separated by comma', () => {
    const result = Keybind.parse('ctrl+c,<leader>q');
    expect(result).toEqual([
      {
        ctrl: true,
        meta: false,
        shift: false,
        leader: false,
        name: 'c',
      },
      {
        ctrl: false,
        meta: false,
        shift: false,
        leader: true,
        name: 'q',
      },
    ]);
  });
});

describe('Keybind.match', () => {
  test('should match identical keybinds', () => {
    const a: Keybind.Info = { ctrl: true, meta: false, shift: false, leader: false, name: 'x' };
    const b: Keybind.Info = { ctrl: true, meta: false, shift: false, leader: false, name: 'x' };
    expect(Keybind.match(a, b)).toBe(true);
  });

  test('should not match leader vs non-leader', () => {
    const a: Keybind.Info = { ctrl: false, meta: false, shift: false, leader: true, name: 'f' };
    const b: Keybind.Info = { ctrl: false, meta: false, shift: false, leader: false, name: 'f' };
    expect(Keybind.match(a, b)).toBe(false);
  });
});
```

**Key Patterns:**

- Test parsing round-trip behavior
- Verify modifier combination handling
- Test leader key variants separately
- Use deep equality for comparison

## Example 4: Keyboard Handler Context Setup

How OpenCode sets up the keybind context:

```typescript
// From: opencode/src/cli/cmd/tui/context/keybind.tsx
// (Simplified)

import { createSimpleContext } from './helper';
import { useKeyboard } from '@opentui/solid';
import { Keybind } from '@/util/keybind';
import { mapValues, pipe } from 'remeda';
import type { KeybindsConfig } from '@opencode-ai/sdk';

export const { use: useKeybind, provider: KeybindProvider } = createSimpleContext({
  name: 'Keybind',
  init: () => {
    const sync = useSync();

    // Parse all keybinds from config (memoized)
    const keybinds = createMemo(() => {
      return pipe(
        sync.data.config.keybinds ?? {},
        mapValues(value => Keybind.parse(value)) // "ctrl+c" → [{ctrl: true, name: "c"}]
      );
    });

    const [store, setStore] = createStore({
      leader: false, // Track leader key mode
    });

    // Leader key timeout handler
    let focus: Renderable | null;
    let timeout: NodeJS.Timeout;

    function leader(active: boolean) {
      if (active) {
        setStore('leader', true);
        focus = renderer.currentFocusedRenderable;
        focus?.blur();

        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => {
          if (!store.leader) return;
          leader(false);
          if (focus) focus.focus();
        }, 2000); // Auto-exit after 2 seconds
        return;
      }

      if (!active) {
        if (focus && !renderer.currentFocusedRenderable) {
          focus.focus();
        }
        setStore('leader', false);
      }
    }

    // Global keyboard handler for leader key
    useKeyboard(async evt => {
      if (!store.leader && result.match('leader', evt)) {
        leader(true);
        return;
      }

      if (store.leader && evt.name) {
        setImmediate(() => {
          if (focus && renderer.currentFocusedRenderable === focus) {
            focus.focus();
          }
          leader(false);
        });
      }
    });

    // Public API
    const result = {
      get all() {
        return keybinds();
      },

      get leader() {
        return store.leader;
      },

      // Convert ParsedKey to Keybind.Info
      parse(evt: ParsedKey): Keybind.Info {
        return {
          ctrl: evt.ctrl,
          name: evt.name,
          shift: evt.shift,
          leader: store.leader, // Include current leader state!
          meta: evt.meta,
        };
      },

      // Match against config keybind
      match(key: keyof KeybindsConfig, evt: ParsedKey) {
        const keybind = keybinds()[key];
        if (!keybind) return false;
        const parsed: Keybind.Info = result.parse(evt);
        for (const k of keybind) {
          if (Keybind.match(k, parsed)) {
            return true;
          }
        }
      },

      // Get printable representation
      print(key: keyof KeybindsConfig) {
        const first = keybinds()[key]?.at(0);
        if (!first) return '';
        const result = Keybind.toString(first);
        return result.replace('<leader>', Keybind.toString(keybinds().leader![0]!));
      },
    };

    return result;
  },
});
```

**Key Patterns:**

- Use Solid.js context for application-wide state
- Memoize parsed keybinds to avoid repeated parsing
- Implement leader key as state machine
- Convert ParsedKey to Keybind.Info with current leader state
- Provide high-level API (match, parse, print)

## Example 5: Component Using Keybinds

Simple component showing the full pattern:

```typescript
// Typical component usage pattern

import { useKeyboard } from '@opentui/solid';
import { useKeybind } from '@tui/context/keybind';
import { Keybind } from '@/util/keybind';
import type { KeyEvent } from '@opentui/core';

interface MyComponentProps {
  customKeybinds?: Array<{
    keybind: Keybind.Info;
    action: () => void;
  }>;
}

export function MyComponent(props: MyComponentProps) {
  const keybind = useKeybind();
  const [state, setState] = createStore({
    value: '',
  });

  useKeyboard((evt: KeyEvent) => {
    // Option 1: Check built-in keybinds from config
    if (keybind.match('app_exit', evt)) {
      handleExit();
      return;
    }

    // Option 2: Direct event checks for common keys
    if (evt.name === 'escape') {
      handleEscape();
      return;
    }

    // Option 3: Match custom keybinds passed in
    for (const { keybind: kb, action } of props.customKeybinds ?? []) {
      if (Keybind.match(kb, keybind.parse(evt))) {
        evt.preventDefault();
        action();
        return;
      }
    }

    // Option 4: Regular character input
    if (!evt.ctrl && !evt.meta && !evt.shift && evt.name.length === 1) {
      setState('value', state.value + evt.name);
    }
  });
}
```

## Testing Pattern with Mock Keys

```typescript
// From: opentui test utilities

import { describe, it, expect } from "bun:test"
import { testRender, createMockKeys } from "@opentui/react/test-utils"
import { MyComponent } from "./MyComponent"

describe("MyComponent Keyboard", () => {
  it("handles keyboard input", async () => {
    const { renderOnce, captureCharFrame, mockInput } = await testRender(
      <MyComponent />,
      { width: 80, height: 24 }
    )

    await renderOnce()

    // Simulate typing
    mockInput.pressKey("h")
    mockInput.pressKey("i")
    await renderOnce()

    expect(captureCharFrame()).toContain("hi")

    // Simulate Ctrl+X
    mockInput.pressKey("x", { ctrl: true })
    await renderOnce()

    expect(captureCharFrame()).toContain("cleared")
  })
})
```

---

**See also:** [KEYBINDING_SYSTEM.md](KEYBINDING_SYSTEM.md) for data structure details
