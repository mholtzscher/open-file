/**
 * Tests for useKeyboardDispatcher
 *
 * Tests the action-based keyboard dispatch system.
 */

import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { EditMode } from '../types/edit-mode';
import { KeyboardKey, KeyAction } from '../types/keyboard';
import { KeybindingMap } from './keybindingDefaults';

// Helper to create a KeyboardKey
function createKey(name: string, modifiers: Partial<KeyboardKey> = {}): KeyboardKey {
  return {
    name,
    ctrl: false,
    shift: false,
    meta: false,
    ...modifiers,
  };
}

/**
 * Simplified dispatcher for testing without React hooks
 * Mirrors the logic in useKeyboardDispatcher
 */
class TestKeyboardDispatcher {
  private handlers = new Map<KeyAction, (key?: KeyboardKey) => void>();
  private keySequence: string[] = [];
  private mode: EditMode;
  private isDialogOpen: boolean;
  private keybindings: KeybindingMap;

  private static SEQUENCE_STARTERS = new Set(['g', 'd', 'y']);
  private static VALID_SEQUENCES: Record<string, KeyAction> = {
    gg: 'cursor:top',
    dd: 'entry:delete',
    yy: 'entry:copy',
    'g?': 'dialog:help',
  };

  constructor(
    mode: EditMode = EditMode.Normal,
    isDialogOpen: boolean = false,
    keybindings?: KeybindingMap
  ) {
    this.mode = mode;
    this.isDialogOpen = isDialogOpen;
    this.keybindings = keybindings || this.createTestKeybindings();
  }

  private createTestKeybindings(): KeybindingMap {
    const map: KeybindingMap = new Map();

    // Normal mode
    const normal = new Map<string, KeyAction>([
      ['j', 'cursor:down'],
      ['k', 'cursor:up'],
      ['l', 'entry:open'],
      ['h', 'entry:back'],
      ['return', 'entry:open'],
      ['v', 'mode:visual'],
      ['/', 'mode:search'],
      [':', 'mode:command'],
      ['i', 'mode:insert'],
      ['a', 'mode:edit'],
      ['q', 'app:quit'],
      ['w', 'buffer:save'],
      ['p', 'entry:paste'],
      ['?', 'dialog:help'],
      ['ctrl+n', 'cursor:pageDown'],
      ['ctrl+p', 'cursor:pageUp'],
      // Shifted sequence starter keys (should NOT be treated as sequence starters)
      ['shift+d', 'entry:download'],
      ['shift+y', 'entry:copy'], // Different from yy which also copies - this is direct copy
    ]);
    map.set(EditMode.Normal, normal);

    // Visual mode
    const visual = new Map<string, KeyAction>([
      ['escape', 'mode:normal'],
      ['j', 'select:extend:down'],
      ['k', 'select:extend:up'],
      ['d', 'entry:delete'],
    ]);
    map.set(EditMode.Visual, visual);

    // Global
    const global = new Map<string, KeyAction>([['ctrl+s', 'buffer:save']]);
    map.set('global' as EditMode, global);

    // Empty maps for other modes
    map.set(EditMode.Search, new Map());
    map.set(EditMode.Command, new Map());
    map.set(EditMode.Insert, new Map());
    map.set(EditMode.Edit, new Map());

    return map;
  }

  setMode(mode: EditMode): void {
    this.mode = mode;
  }

  setDialogOpen(open: boolean): void {
    this.isDialogOpen = open;
  }

  registerAction(action: KeyAction, handler: (key?: KeyboardKey) => void): () => void {
    this.handlers.set(action, handler);
    return () => this.handlers.delete(action);
  }

  registerActions(handlers: Partial<Record<KeyAction, (key?: KeyboardKey) => void>>): () => void {
    const cleanups: (() => void)[] = [];
    for (const [action, handler] of Object.entries(handlers)) {
      if (handler) {
        cleanups.push(this.registerAction(action as KeyAction, handler));
      }
    }
    return () => cleanups.forEach(c => c());
  }

  private executeAction(action: KeyAction, key?: KeyboardKey): boolean {
    const handler = this.handlers.get(action);
    if (handler) {
      handler(key);
      return true;
    }
    return false;
  }

  private keyToString(key: KeyboardKey): string {
    const parts: string[] = [];
    if (key.ctrl) parts.push('ctrl');
    if (key.meta) parts.push('meta');
    if (key.shift) parts.push('shift');
    parts.push(key.name);
    return parts.join('+');
  }

  private handleSequence(key: KeyboardKey): {
    handled: boolean;
    action?: KeyAction;
    waitingForMore?: boolean;
  } {
    const keyName = key.name;

    // If this is a shifted key for a sequence starter (e.g., D = shift+d, Y = shift+y),
    // don't treat it as a sequence - let it fall through to keybinding lookup
    // Exception: G (shift+g) for cursor:bottom is handled as a valid action
    if (key.shift && TestKeyboardDispatcher.SEQUENCE_STARTERS.has(keyName) && keyName !== 'g') {
      this.keySequence = [];
      return { handled: false, waitingForMore: false };
    }

    this.keySequence.push(keyName);

    const sequence = this.keySequence.join('');

    if (TestKeyboardDispatcher.VALID_SEQUENCES[sequence]) {
      const action = TestKeyboardDispatcher.VALID_SEQUENCES[sequence];
      this.keySequence = [];
      return { handled: true, action };
    }

    // Single G goes to bottom
    if (sequence === 'G' || (this.keySequence.length === 1 && key.shift && keyName === 'g')) {
      this.keySequence = [];
      return { handled: true, action: 'cursor:bottom' };
    }

    // Waiting for sequence continuation
    if (this.keySequence.length === 1 && TestKeyboardDispatcher.SEQUENCE_STARTERS.has(keyName)) {
      return { handled: false, waitingForMore: true };
    }

    // Unrecognized sequence
    if (this.keySequence.length > 1) {
      this.keySequence = [];
    }

    return { handled: false, waitingForMore: false };
  }

  dispatch(key: KeyboardKey): boolean {
    // Dialog blocks normal keybindings
    if (this.isDialogOpen) {
      return false;
    }

    // Text input modes
    const isTextInputMode = [
      EditMode.Search,
      EditMode.Command,
      EditMode.Insert,
      EditMode.Edit,
    ].includes(this.mode);

    if (isTextInputMode) {
      if (key.name === 'escape') {
        return this.executeAction('input:cancel', key);
      }
      if (key.name === 'return' || key.name === 'enter') {
        return this.executeAction('input:confirm', key);
      }
      if (key.name === 'backspace') {
        return this.executeAction('input:backspace', key);
      }
      if (key.name === 'tab') {
        return this.executeAction('input:tab', key);
      }
      if (key.char && key.char.length === 1) {
        return this.executeAction('input:char', key);
      }
      if (this.mode === EditMode.Search) {
        if (key.name === 'n') return this.executeAction('cursor:down', key);
        if (key.name === 'N' || (key.shift && key.name === 'n'))
          return this.executeAction('cursor:up', key);
      }
      return false;
    }

    // Normal mode only - check sequences (gg, dd, yy)
    // Visual mode skips sequences - d/y work directly on selection
    if (this.mode === EditMode.Normal) {
      const seqResult = this.handleSequence(key);
      if (seqResult.handled && seqResult.action) {
        return this.executeAction(seqResult.action, key);
      }
      // If sequence is in progress (waiting for more keys), don't process further
      if (seqResult.waitingForMore) {
        return true; // Waiting for sequence
      }
    }

    // Look up keybinding
    const keyStr = this.keyToString(key);
    const modeBindings = this.keybindings.get(this.mode);
    const action = modeBindings?.get(keyStr);

    if (action) {
      return this.executeAction(action, key);
    }

    // Global bindings
    const globalBindings = this.keybindings.get('global' as EditMode);
    const globalAction = globalBindings?.get(keyStr);

    if (globalAction) {
      return this.executeAction(globalAction, key);
    }

    return false;
  }

  clearKeySequence(): void {
    this.keySequence = [];
  }

  getKeySequence(): string[] {
    return [...this.keySequence];
  }
}

describe('useKeyboardDispatcher', () => {
  let dispatcher: TestKeyboardDispatcher;

  beforeEach(() => {
    dispatcher = new TestKeyboardDispatcher();
  });

  describe('action registration', () => {
    it('registers and calls action handler', () => {
      const handler = mock(() => {});
      dispatcher.registerAction('cursor:down', handler);

      dispatcher.dispatch(createKey('j'));

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('unregisters handler when cleanup is called', () => {
      const handler = mock(() => {});
      const cleanup = dispatcher.registerAction('cursor:down', handler);

      dispatcher.dispatch(createKey('j'));
      expect(handler).toHaveBeenCalledTimes(1);

      cleanup();

      dispatcher.dispatch(createKey('j'));
      expect(handler).toHaveBeenCalledTimes(1); // Still 1
    });

    it('registers multiple actions at once', () => {
      const upHandler = mock(() => {});
      const downHandler = mock(() => {});

      dispatcher.registerActions({
        'cursor:up': upHandler,
        'cursor:down': downHandler,
      });

      dispatcher.dispatch(createKey('j'));
      dispatcher.dispatch(createKey('k'));

      expect(downHandler).toHaveBeenCalledTimes(1);
      expect(upHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('normal mode keybindings', () => {
    it('dispatches navigation keys', () => {
      const downHandler = mock(() => {});
      const upHandler = mock(() => {});
      dispatcher.registerActions({
        'cursor:down': downHandler,
        'cursor:up': upHandler,
      });

      dispatcher.dispatch(createKey('j'));
      dispatcher.dispatch(createKey('k'));

      expect(downHandler).toHaveBeenCalledTimes(1);
      expect(upHandler).toHaveBeenCalledTimes(1);
    });

    it('dispatches entry operations', () => {
      const openHandler = mock(() => {});
      const backHandler = mock(() => {});
      dispatcher.registerActions({
        'entry:open': openHandler,
        'entry:back': backHandler,
      });

      dispatcher.dispatch(createKey('l'));
      dispatcher.dispatch(createKey('h'));

      expect(openHandler).toHaveBeenCalledTimes(1);
      expect(backHandler).toHaveBeenCalledTimes(1);
    });

    it('dispatches mode change keys', () => {
      const visualHandler = mock(() => {});
      const searchHandler = mock(() => {});
      dispatcher.registerActions({
        'mode:visual': visualHandler,
        'mode:search': searchHandler,
      });

      dispatcher.dispatch(createKey('v'));
      dispatcher.dispatch(createKey('/'));

      expect(visualHandler).toHaveBeenCalledTimes(1);
      expect(searchHandler).toHaveBeenCalledTimes(1);
    });

    it('returns true when key is handled', () => {
      dispatcher.registerAction('cursor:down', () => {});

      const result = dispatcher.dispatch(createKey('j'));

      expect(result).toBe(true);
    });

    it('returns false when key is not handled', () => {
      const result = dispatcher.dispatch(createKey('x')); // Not bound

      expect(result).toBe(false);
    });
  });

  describe('multi-key sequences', () => {
    it('handles gg sequence for cursor:top', () => {
      const topHandler = mock(() => {});
      dispatcher.registerAction('cursor:top', topHandler);

      dispatcher.dispatch(createKey('g'));
      expect(topHandler).not.toHaveBeenCalled();

      dispatcher.dispatch(createKey('g'));
      expect(topHandler).toHaveBeenCalledTimes(1);
    });

    it('handles dd sequence for entry:delete', () => {
      const deleteHandler = mock(() => {});
      dispatcher.registerAction('entry:delete', deleteHandler);

      dispatcher.dispatch(createKey('d'));
      expect(deleteHandler).not.toHaveBeenCalled();

      dispatcher.dispatch(createKey('d'));
      expect(deleteHandler).toHaveBeenCalledTimes(1);
    });

    it('handles yy sequence for entry:copy', () => {
      const copyHandler = mock(() => {});
      dispatcher.registerAction('entry:copy', copyHandler);

      dispatcher.dispatch(createKey('y'));
      expect(copyHandler).not.toHaveBeenCalled();

      dispatcher.dispatch(createKey('y'));
      expect(copyHandler).toHaveBeenCalledTimes(1);
    });

    it('handles G (shift+g) for cursor:bottom', () => {
      const bottomHandler = mock(() => {});
      dispatcher.registerAction('cursor:bottom', bottomHandler);

      dispatcher.dispatch(createKey('G'));

      expect(bottomHandler).toHaveBeenCalledTimes(1);
    });

    it('handles g? sequence for dialog:help', () => {
      const helpHandler = mock(() => {});
      dispatcher.registerAction('dialog:help', helpHandler);

      dispatcher.dispatch(createKey('g'));
      dispatcher.dispatch(createKey('?'));

      expect(helpHandler).toHaveBeenCalledTimes(1);
    });

    it('clears sequence on unrecognized second key', () => {
      const downHandler = mock(() => {});
      dispatcher.registerAction('cursor:down', downHandler);

      dispatcher.dispatch(createKey('g'));
      dispatcher.dispatch(createKey('x')); // Invalid sequence
      dispatcher.dispatch(createKey('j')); // Should work normally

      expect(downHandler).toHaveBeenCalledTimes(1);
    });

    it('handles shift+d (D) as entry:download, not as start of dd sequence', () => {
      const downloadHandler = mock(() => {});
      const deleteHandler = mock(() => {});
      dispatcher.registerActions({
        'entry:download': downloadHandler,
        'entry:delete': deleteHandler,
      });

      // Pressing D (shift+d) should immediately trigger download
      // It should NOT wait for a second 'd' like the dd sequence does
      dispatcher.dispatch(createKey('d', { shift: true }));

      expect(downloadHandler).toHaveBeenCalledTimes(1);
      expect(deleteHandler).not.toHaveBeenCalled();
      // Key sequence should be clear (not waiting for more keys)
      expect(dispatcher.getKeySequence()).toEqual([]);
    });

    it('handles shift+y (Y) as direct action, not as start of yy sequence', () => {
      const copyHandler = mock(() => {});
      dispatcher.registerAction('entry:copy', copyHandler);

      // Pressing Y (shift+y) should immediately trigger the shift+y binding
      // It should NOT wait for a second 'y' like the yy sequence does
      dispatcher.dispatch(createKey('y', { shift: true }));

      expect(copyHandler).toHaveBeenCalledTimes(1);
      // Key sequence should be clear (not waiting for more keys)
      expect(dispatcher.getKeySequence()).toEqual([]);
    });

    it('still handles dd sequence correctly after D is pressed', () => {
      const downloadHandler = mock(() => {});
      const deleteHandler = mock(() => {});
      dispatcher.registerActions({
        'entry:download': downloadHandler,
        'entry:delete': deleteHandler,
      });

      // First press D (shift+d) for download
      dispatcher.dispatch(createKey('d', { shift: true }));
      expect(downloadHandler).toHaveBeenCalledTimes(1);

      // Then press dd for delete - should still work
      dispatcher.dispatch(createKey('d'));
      dispatcher.dispatch(createKey('d'));
      expect(deleteHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('visual mode', () => {
    beforeEach(() => {
      dispatcher.setMode(EditMode.Visual);
    });

    it('dispatches visual mode specific keys', () => {
      const extendDownHandler = mock(() => {});
      const extendUpHandler = mock(() => {});
      dispatcher.registerActions({
        'select:extend:down': extendDownHandler,
        'select:extend:up': extendUpHandler,
      });

      dispatcher.dispatch(createKey('j'));
      dispatcher.dispatch(createKey('k'));

      expect(extendDownHandler).toHaveBeenCalledTimes(1);
      expect(extendUpHandler).toHaveBeenCalledTimes(1);
    });

    it('dispatches escape to exit visual mode', () => {
      const normalHandler = mock(() => {});
      dispatcher.registerAction('mode:normal', normalHandler);

      dispatcher.dispatch(createKey('escape'));

      expect(normalHandler).toHaveBeenCalledTimes(1);
    });

    it('handles d as single delete in visual mode (no dd sequence)', () => {
      const deleteHandler = mock(() => {});
      dispatcher.registerAction('entry:delete', deleteHandler);

      // In visual mode, single 'd' deletes selection immediately
      // No need for dd sequence since we're operating on visual selection
      dispatcher.dispatch(createKey('d'));

      expect(deleteHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('text input modes', () => {
    it('handles escape in search mode', () => {
      dispatcher.setMode(EditMode.Search);
      const cancelHandler = mock(() => {});
      dispatcher.registerAction('input:cancel', cancelHandler);

      dispatcher.dispatch(createKey('escape'));

      expect(cancelHandler).toHaveBeenCalledTimes(1);
    });

    it('handles enter in command mode', () => {
      dispatcher.setMode(EditMode.Command);
      const confirmHandler = mock(() => {});
      dispatcher.registerAction('input:confirm', confirmHandler);

      dispatcher.dispatch(createKey('return'));

      expect(confirmHandler).toHaveBeenCalledTimes(1);
    });

    it('handles character input', () => {
      dispatcher.setMode(EditMode.Search);
      const charHandler = mock(() => {});
      dispatcher.registerAction('input:char', charHandler);

      dispatcher.dispatch(createKey('a', { char: 'a' }));

      expect(charHandler).toHaveBeenCalledTimes(1);
    });

    it('handles backspace', () => {
      dispatcher.setMode(EditMode.Insert);
      const backspaceHandler = mock(() => {});
      dispatcher.registerAction('input:backspace', backspaceHandler);

      dispatcher.dispatch(createKey('backspace'));

      expect(backspaceHandler).toHaveBeenCalledTimes(1);
    });

    it('handles n/N in search mode for navigation', () => {
      dispatcher.setMode(EditMode.Search);
      const downHandler = mock(() => {});
      const upHandler = mock(() => {});
      dispatcher.registerActions({
        'cursor:down': downHandler,
        'cursor:up': upHandler,
      });

      dispatcher.dispatch(createKey('n'));
      dispatcher.dispatch(createKey('N'));

      expect(downHandler).toHaveBeenCalledTimes(1);
      expect(upHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('dialog blocking', () => {
    it('blocks keybindings when dialog is open', () => {
      dispatcher.setDialogOpen(true);
      const handler = mock(() => {});
      dispatcher.registerAction('cursor:down', handler);

      const result = dispatcher.dispatch(createKey('j'));

      expect(result).toBe(false);
      expect(handler).not.toHaveBeenCalled();
    });

    it('resumes keybindings when dialog closes', () => {
      const handler = mock(() => {});
      dispatcher.registerAction('cursor:down', handler);

      dispatcher.setDialogOpen(true);
      dispatcher.dispatch(createKey('j'));
      expect(handler).not.toHaveBeenCalled();

      dispatcher.setDialogOpen(false);
      dispatcher.dispatch(createKey('j'));
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('global keybindings', () => {
    it('handles global keybindings in any mode', () => {
      const saveHandler = mock(() => {});
      dispatcher.registerAction('buffer:save', saveHandler);

      // Should work in normal mode
      dispatcher.dispatch(createKey('s', { ctrl: true }));
      expect(saveHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('modifier keys', () => {
    it('handles ctrl+key combinations', () => {
      const pageDownHandler = mock(() => {});
      dispatcher.registerAction('cursor:pageDown', pageDownHandler);

      dispatcher.dispatch(createKey('n', { ctrl: true }));

      expect(pageDownHandler).toHaveBeenCalledTimes(1);
    });

    it('distinguishes between key and ctrl+key', () => {
      const downHandler = mock(() => {});
      const pageDownHandler = mock(() => {});
      dispatcher.registerActions({
        'cursor:down': downHandler,
        'cursor:pageDown': pageDownHandler,
      });

      dispatcher.dispatch(createKey('n', { ctrl: true }));
      expect(pageDownHandler).toHaveBeenCalledTimes(1);
      expect(downHandler).toHaveBeenCalledTimes(0);
    });
  });

  describe('key sequence state', () => {
    it('returns current key sequence', () => {
      dispatcher.dispatch(createKey('g'));

      expect(dispatcher.getKeySequence()).toEqual(['g']);
    });

    it('clears key sequence', () => {
      dispatcher.dispatch(createKey('g'));
      dispatcher.clearKeySequence();

      expect(dispatcher.getKeySequence()).toEqual([]);
    });

    it('clears sequence after complete sequence', () => {
      dispatcher.registerAction('cursor:top', () => {});

      dispatcher.dispatch(createKey('g'));
      dispatcher.dispatch(createKey('g'));

      expect(dispatcher.getKeySequence()).toEqual([]);
    });
  });
});

describe('keybindingDefaults', () => {
  it('exports defaultKeybindings', async () => {
    const { defaultKeybindings } = await import('./keybindingDefaults');
    expect(defaultKeybindings).toBeDefined();
    expect(defaultKeybindings instanceof Map).toBe(true);
  });

  it('has normal mode keybindings', async () => {
    const { defaultKeybindings } = await import('./keybindingDefaults');
    const normalBindings = defaultKeybindings.get(EditMode.Normal);
    expect(normalBindings).toBeDefined();
    expect(normalBindings?.get('j')).toBe('cursor:down');
    expect(normalBindings?.get('k')).toBe('cursor:up');
  });

  it('has visual mode keybindings', async () => {
    const { defaultKeybindings } = await import('./keybindingDefaults');
    const visualBindings = defaultKeybindings.get(EditMode.Visual);
    expect(visualBindings).toBeDefined();
    expect(visualBindings?.get('escape')).toBe('mode:normal');
  });
});
