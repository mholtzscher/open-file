# Key Event Architecture: Data Flow and Types

## KeyEvent Class & ParsedKey Interface

### Core Types (from opentui)

```typescript
// From packages/core/src/lib/KeyHandler.ts

export type KeyEventType = 'press' | 'repeat' | 'release';

export interface ParsedKey {
  name: string; // 'a', 'return', 'up', 'f1', etc.
  ctrl: boolean;
  meta: boolean; // Alt/Option/Meta on different platforms
  shift: boolean;
  option: boolean; // Mac-specific Option key
  sequence: string; // Raw escape sequence that produced this key
  number: boolean; // Whether the key is a number
  raw: string; // Raw input bytes
  eventType: KeyEventType;
  source: 'raw' | 'kitty'; // Parsing protocol used
  code?: string; // Terminal-specific key code
  super?: boolean; // Super/Windows key
  hyper?: boolean; // Hyper key
  capsLock?: boolean; // CapsLock state
  numLock?: boolean; // NumLock state
  baseCode?: number; // Base character code
}

export class KeyEvent implements ParsedKey {
  // All ParsedKey properties plus:

  private _defaultPrevented: boolean = false;

  preventDefault(): void;
  get defaultPrevented(): boolean;
}
```

### Key Name Constants

Common key names found in the codebase:

```typescript
// Function keys
'f1', 'f2', ..., 'f12'

// Control keys
'return'          // Enter key
'escape'          // ESC
'tab'             // Tab
'backspace'       // Backspace
'delete'          // Delete

// Navigation
'up', 'down', 'left', 'right'
'home', 'end'
'pageup', 'pagedown'
'insert'

// Special
'return' (not 'enter')
'escape' (not 'esc' after parsing)
'null' (Ctrl+Space, Ctrl+@)
'_' (Ctrl+_, from \x1F sequence)
```

## KeyHandler: Event Emission System

### KeyHandler Class

```typescript
// From packages/core/src/lib/KeyHandler.ts

export class KeyHandler extends EventEmitter<KeyHandlerEventMap> {
  protected useKittyKeyboard: boolean;

  constructor(useKittyKeyboard: boolean = false);

  // Process raw input data from stdin
  public processInput(data: string): boolean;

  // Process paste events
  public processPaste(data: string): void;
}

export type KeyHandlerEventMap = {
  keypress: [KeyEvent];
  keyrepeat: [KeyEvent];
  keyrelease: [KeyEvent];
  paste: [PasteEvent];
};
```

### InternalKeyHandler: Priority-Based Event Emission

The renderer uses `InternalKeyHandler` to handle global vs renderable handlers:

```typescript
export class InternalKeyHandler extends KeyHandler {
  private renderableHandlers: Map<keyof KeyHandlerEventMap, Set<Function>> = new Map();

  // Global handlers (preventDefault can block renderable handlers)
  // Renderable handlers (only if event not prevented)

  public onInternal<K extends keyof KeyHandlerEventMap>(
    event: K,
    handler: (...args: KeyHandlerEventMap[K]) => void
  ): void;

  public offInternal<K extends keyof KeyHandlerEventMap>(
    event: K,
    handler: (...args: KeyHandlerEventMap[K]) => void
  ): void;
}
```

**Event Dispatch Priority:**

1. Global handlers execute first
2. If event.preventDefault() called → stop
3. Otherwise, renderable handlers execute
4. Return if any handlers were registered

## Data Flow: From Input to Event

### Step 1: Raw Terminal Input

```
Raw bytes from stdin:
  "a"              → ASCII 97
  "\x1b[A"         → ANSI escape for arrow up
  "\x1b[27;5;120~" → Ctrl+X with modifyOtherKeys protocol
  "\x1b[120;5u"    → Ctrl+X with Kitty protocol
```

### Step 2: KeyHandler.processInput()

```typescript
public processInput(data: string): boolean {
  // 1. Parse using parseKeypress() - handles ANSI & Kitty protocols
  const parsedKey = parseKeypress(data, { useKittyKeyboard: this.useKittyKeyboard })

  if (!parsedKey) {
    return false  // Not a key event (e.g., mouse, terminal response)
  }

  // 2. Create KeyEvent wrapper
  const event = new KeyEvent(parsedKey)

  // 3. Emit based on event type
  switch (parsedKey.eventType) {
    case "press":   this.emit("keypress", event); break
    case "repeat":  this.emit("keyrepeat", event); break
    case "release": this.emit("keyrelease", event); break
  }

  return true
}
```

### Step 3: Component Handler via useKeyboard Hook

```typescript
// In React:
useKeyboard((keyEvent: KeyEvent) => {
  // Handle the key event
  console.log(keyEvent.name, keyEvent.ctrl, keyEvent.shift);
});

// In Solid.js:
useKeyboard((keyEvent: KeyEvent) => {
  // Same interface
});
```

## preventDefault() Mechanism

Used to stop event propagation through the handler chain:

```typescript
// In a component's useKeyboard handler:
useKeyboard((evt: KeyEvent) => {
  if (evt.name === 'c' && evt.ctrl) {
    evt.preventDefault()  // Stop further handling
    // Handle Ctrl+C specially instead of default behavior
  }
})

// In InternalKeyHandler, preventDefault is checked:
if (event === "keypress" || ...) {
  const keyEvent = args[0]
  if (keyEvent.defaultPrevented) return  // Stop here
}
```

## Key Name Parsing Rules

From `parse.keypress.ts`:

```typescript
// Function key mapping
const keyName: Record<string, string> = {
  OP: 'f1', // xterm/gnome ESC O letter
  '[11~': 'f1', // xterm/rxvt ESC [ number ~
  // ... many more mappings
  '[A': 'up',
  '[B': 'down',
  '[C': 'right',
  '[D': 'left',
  '[H': 'home',
  '[F': 'end',
  // etc.
};

// Shift key detection from escape sequence
const isShiftKey = (code: string) => {
  return ['[a', '[b', '[c', '[d', '[e', '[2$', '[3$', '[5$', '[6$', '[7$', '[8$', '[Z'].includes(
    code
  );
};

// Ctrl key detection
const isCtrlKey = (code: string) => {
  return ['Oa', 'Ob', 'Oc', 'Od', 'Oe', '[2^', '[3^', '[5^', '[6^', '[7^', '[8^'].includes(code);
};
```

## Special Key Handling

### Ctrl+Underscore Special Case

```typescript
// In keybind.tsx context:
parse(evt: ParsedKey): Keybind.Info {
  if (evt.name === "\x1F") {  // ASCII 31, Ctrl+_
    return {
      ctrl: true,
      name: "_",
      shift: false,
      leader: false,
      meta: false,
    }
  }
  // ... normal parsing
}
```

### Meta/Alt Handling

Different platforms represent alt differently:

- `meta: true` in ParsedKey represents Alt/Option/Meta
- Can be triggered by Alt, Option (Mac), or Meta keys
- Aliases: "alt", "meta", "option" all map to `meta: true`

## PasteEvent

For handling pasted text:

```typescript
export class PasteEvent {
  text: string;
  private _defaultPrevented: boolean = false;

  get defaultPrevented(): boolean;
  preventDefault(): void;
}

// Usage:
renderer.keyInput.on('paste', (event: PasteEvent) => {
  const cleanedText = event.text;
  // process pasted text
});
```

---

**See also:** [PARSING_PROTOCOLS.md](PARSING_PROTOCOLS.md) for how raw input becomes ParsedKey
