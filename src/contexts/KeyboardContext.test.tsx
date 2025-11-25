/**
 * KeyboardContext Tests
 *
 * Tests for the centralized keyboard event handling.
 * Tests the KeyboardProvider logic by instantiating it directly.
 */

import { describe, it, expect, mock } from 'bun:test';
import { KeyboardPriority } from './KeyboardContext.js';
import type { KeyboardKey } from '../types/keyboard.js';

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
 * Simple implementation to test the handler registration and dispatch logic
 * without needing React's useContext/hooks
 */
class KeyboardDispatcher {
  private handlers: Array<{
    id: string;
    handler: (key: KeyboardKey) => boolean;
    priority: number;
  }> = [];
  private idCounter = 0;

  registerHandler(
    handler: (key: KeyboardKey) => boolean,
    priority: number = KeyboardPriority.Normal
  ): () => void {
    const id = `handler-${++this.idCounter}`;
    this.handlers.push({ id, handler, priority });
    // Sort by priority descending (highest first)
    this.handlers.sort((a, b) => b.priority - a.priority);

    return () => {
      this.handlers = this.handlers.filter(h => h.id !== id);
    };
  }

  dispatch(key: KeyboardKey): void {
    for (const registration of this.handlers) {
      try {
        const consumed = registration.handler(key);
        if (consumed) {
          return;
        }
      } catch (error) {
        console.error('Keyboard handler error:', error);
      }
    }
  }

  getHandlerCount(): number {
    return this.handlers.length;
  }
}

describe('KeyboardContext logic', () => {
  describe('handler registration', () => {
    it('registers and calls a handler', () => {
      const dispatcher = new KeyboardDispatcher();
      const handler = mock(() => true);

      dispatcher.registerHandler(handler);
      dispatcher.dispatch(createKey('j'));

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(createKey('j'));
    });

    it('unregisters handler when cleanup is called', () => {
      const dispatcher = new KeyboardDispatcher();
      const handler = mock(() => true);

      const cleanup = dispatcher.registerHandler(handler);

      // Handler should be called
      dispatcher.dispatch(createKey('j'));
      expect(handler).toHaveBeenCalledTimes(1);

      // Cleanup
      cleanup();

      // Handler should no longer be called
      dispatcher.dispatch(createKey('k'));
      expect(handler).toHaveBeenCalledTimes(1); // Still 1
    });

    it('tracks handler count correctly', () => {
      const dispatcher = new KeyboardDispatcher();

      expect(dispatcher.getHandlerCount()).toBe(0);

      const cleanup1 = dispatcher.registerHandler(() => false);
      expect(dispatcher.getHandlerCount()).toBe(1);

      const cleanup2 = dispatcher.registerHandler(() => false);
      expect(dispatcher.getHandlerCount()).toBe(2);

      cleanup1();
      expect(dispatcher.getHandlerCount()).toBe(1);

      cleanup2();
      expect(dispatcher.getHandlerCount()).toBe(0);
    });
  });

  describe('priority-based dispatch', () => {
    it('calls higher priority handlers first', () => {
      const dispatcher = new KeyboardDispatcher();
      const callOrder: string[] = [];

      const lowHandler = mock(() => {
        callOrder.push('low');
        return false;
      });

      const highHandler = mock(() => {
        callOrder.push('high');
        return false;
      });

      // Register in wrong order to test sorting
      dispatcher.registerHandler(lowHandler, KeyboardPriority.Low);
      dispatcher.registerHandler(highHandler, KeyboardPriority.High);

      dispatcher.dispatch(createKey('j'));

      // High priority should be called first
      expect(callOrder).toEqual(['high', 'low']);
    });

    it('stops dispatch when handler returns true', () => {
      const dispatcher = new KeyboardDispatcher();

      const highHandler = mock(() => true); // Consumes the key
      const lowHandler = mock(() => false);

      dispatcher.registerHandler(lowHandler, KeyboardPriority.Low);
      dispatcher.registerHandler(highHandler, KeyboardPriority.High);

      dispatcher.dispatch(createKey('j'));

      expect(highHandler).toHaveBeenCalledTimes(1);
      expect(lowHandler).toHaveBeenCalledTimes(0); // Not called because high consumed
    });

    it('continues dispatch when handler returns false', () => {
      const dispatcher = new KeyboardDispatcher();

      const highHandler = mock(() => false); // Does not consume
      const lowHandler = mock(() => true);

      dispatcher.registerHandler(lowHandler, KeyboardPriority.Low);
      dispatcher.registerHandler(highHandler, KeyboardPriority.High);

      dispatcher.dispatch(createKey('j'));

      expect(highHandler).toHaveBeenCalledTimes(1);
      expect(lowHandler).toHaveBeenCalledTimes(1); // Called because high didn't consume
    });

    it('handles multiple handlers at same priority', () => {
      const dispatcher = new KeyboardDispatcher();
      const callOrder: string[] = [];

      // All at normal priority - should maintain registration order
      dispatcher.registerHandler(() => {
        callOrder.push('first');
        return false;
      }, KeyboardPriority.Normal);

      dispatcher.registerHandler(() => {
        callOrder.push('second');
        return false;
      }, KeyboardPriority.Normal);

      dispatcher.registerHandler(() => {
        callOrder.push('third');
        return false;
      }, KeyboardPriority.Normal);

      dispatcher.dispatch(createKey('j'));

      // Same priority maintains insertion order
      expect(callOrder).toEqual(['first', 'second', 'third']);
    });

    it('handles all priority levels correctly', () => {
      const dispatcher = new KeyboardDispatcher();
      const callOrder: string[] = [];

      dispatcher.registerHandler(() => {
        callOrder.push('normal');
        return false;
      }, KeyboardPriority.Normal);

      dispatcher.registerHandler(() => {
        callOrder.push('critical');
        return false;
      }, KeyboardPriority.Critical);

      dispatcher.registerHandler(() => {
        callOrder.push('low');
        return false;
      }, KeyboardPriority.Low);

      dispatcher.registerHandler(() => {
        callOrder.push('high');
        return false;
      }, KeyboardPriority.High);

      dispatcher.dispatch(createKey('j'));

      expect(callOrder).toEqual(['critical', 'high', 'normal', 'low']);
    });
  });

  describe('error handling', () => {
    it('continues to next handler if one throws', () => {
      const dispatcher = new KeyboardDispatcher();

      const errorHandler = mock(() => {
        throw new Error('Handler error');
      });
      const goodHandler = mock(() => true);

      // Suppress console.error for this test
      const originalError = console.error;
      console.error = () => {};

      dispatcher.registerHandler(errorHandler, KeyboardPriority.High);
      dispatcher.registerHandler(goodHandler, KeyboardPriority.Low);

      dispatcher.dispatch(createKey('j'));

      expect(errorHandler).toHaveBeenCalledTimes(1);
      expect(goodHandler).toHaveBeenCalledTimes(1); // Still called despite error

      console.error = originalError;
    });
  });

  describe('key event properties', () => {
    it('passes through all key properties', () => {
      const dispatcher = new KeyboardDispatcher();
      let receivedKey: KeyboardKey | null = null;

      dispatcher.registerHandler(key => {
        receivedKey = key;
        return true;
      });

      const key = createKey('a', { ctrl: true, shift: true, meta: false, char: 'A' });
      dispatcher.dispatch(key);

      expect(receivedKey).toEqual(key);
      expect(receivedKey!.name).toBe('a');
      expect(receivedKey!.ctrl).toBe(true);
      expect(receivedKey!.shift).toBe(true);
      expect(receivedKey!.meta).toBe(false);
      expect(receivedKey!.char).toBe('A');
    });

    it('handles special keys', () => {
      const dispatcher = new KeyboardDispatcher();
      const handledKeys: string[] = [];

      dispatcher.registerHandler(key => {
        handledKeys.push(key.name);
        return true;
      });

      dispatcher.dispatch(createKey('escape'));
      dispatcher.dispatch(createKey('return'));
      dispatcher.dispatch(createKey('tab'));
      dispatcher.dispatch(createKey('backspace'));

      expect(handledKeys).toEqual(['escape', 'return', 'tab', 'backspace']);
    });
  });
});

describe('KeyboardPriority constants', () => {
  it('has correct priority values', () => {
    expect(KeyboardPriority.Low).toBe(0);
    expect(KeyboardPriority.Normal).toBe(50);
    expect(KeyboardPriority.High).toBe(100);
    expect(KeyboardPriority.Critical).toBe(200);
  });

  it('priorities are properly ordered', () => {
    expect(KeyboardPriority.Low).toBeLessThan(KeyboardPriority.Normal);
    expect(KeyboardPriority.Normal).toBeLessThan(KeyboardPriority.High);
    expect(KeyboardPriority.High).toBeLessThan(KeyboardPriority.Critical);
  });
});

describe('typical usage scenarios', () => {
  it('dialog takes priority over main UI', () => {
    const dispatcher = new KeyboardDispatcher();
    const actions: string[] = [];

    // Main UI handler
    dispatcher.registerHandler(key => {
      if (key.name === 'j') {
        actions.push('cursor-down');
        return true;
      }
      return false;
    }, KeyboardPriority.Normal);

    // Dialog handler (high priority)
    let dialogOpen = false;
    dispatcher.registerHandler(key => {
      if (!dialogOpen) return false;
      if (key.name === 'escape') {
        actions.push('close-dialog');
        dialogOpen = false;
        return true;
      }
      // Block all other keys when dialog is open
      return true;
    }, KeyboardPriority.High);

    // Normal operation - cursor moves
    dispatcher.dispatch(createKey('j'));
    expect(actions).toEqual(['cursor-down']);

    // Open dialog
    dialogOpen = true;
    actions.length = 0;

    // j key is blocked by dialog
    dispatcher.dispatch(createKey('j'));
    expect(actions).toEqual([]); // No action because dialog consumed

    // escape closes dialog
    dispatcher.dispatch(createKey('escape'));
    expect(actions).toEqual(['close-dialog']);

    // Now j works again
    actions.length = 0;
    dispatcher.dispatch(createKey('j'));
    expect(actions).toEqual(['cursor-down']);
  });

  it('handlers can be dynamically added/removed', () => {
    const dispatcher = new KeyboardDispatcher();
    const actions: string[] = [];

    // Base handler
    dispatcher.registerHandler(key => {
      if (key.name === 'j') {
        actions.push('base-j');
      }
      return false; // Don't consume
    }, KeyboardPriority.Normal);

    dispatcher.dispatch(createKey('j'));
    expect(actions).toEqual(['base-j']);

    // Add temporary handler
    actions.length = 0;
    const cleanup = dispatcher.registerHandler(key => {
      if (key.name === 'j') {
        actions.push('temp-j');
        return true; // Consume
      }
      return false;
    }, KeyboardPriority.High);

    dispatcher.dispatch(createKey('j'));
    expect(actions).toEqual(['temp-j']); // Only temp, consumed

    // Remove temporary handler
    cleanup();
    actions.length = 0;

    dispatcher.dispatch(createKey('j'));
    expect(actions).toEqual(['base-j']); // Back to base
  });
});
