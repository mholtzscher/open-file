/**
 * KeyboardContext
 *
 * SolidJS Context for centralized keyboard event handling.
 * Integrates with OpenTUI's useKeyboard and provides priority-based dispatch.
 */

import { onMount, onCleanup } from 'solid-js';
import { useKeyboard as useOpenTUIKeyboard } from '@opentui/solid';
import type { KeyboardKey } from '../types/keyboard.js';
import { createSimpleContext } from './helper.js';

/** Handler priority levels - higher numbers handled first */
export const KeyboardPriority = {
  Low: 0,
  Normal: 50,
  High: 100,
  Critical: 200,
} as const;

export type KeyboardPriorityLevel = (typeof KeyboardPriority)[keyof typeof KeyboardPriority];

interface HandlerRegistration {
  id: string;
  handler: (key: KeyboardKey) => boolean;
  priority: KeyboardPriorityLevel;
}

interface KeyboardContextValue {
  registerHandler: (
    handler: (key: KeyboardKey) => boolean,
    priority?: KeyboardPriorityLevel
  ) => () => void;
}

let handlerIdCounter = 0;

const { Provider: KeyboardProvider, use: useKeyboard } = createSimpleContext<
  KeyboardContextValue,
  object
>({
  name: 'Keyboard',
  init: () => {
    let handlers: HandlerRegistration[] = [];

    const registerHandler = (
      handler: (key: KeyboardKey) => boolean,
      priority: KeyboardPriorityLevel = KeyboardPriority.Normal
    ) => {
      const id = `keyboard-handler-${++handlerIdCounter}`;
      handlers.push({ id, handler, priority });
      handlers.sort((a, b) => b.priority - a.priority);

      return () => {
        handlers = handlers.filter(r => r.id !== id);
      };
    };

    // Integrate OpenTUI keyboard directly in the provider
    useOpenTUIKeyboard(event => {
      let keyName = event.name || 'unknown';
      if (keyName === 'enter') keyName = 'return';

      // Extract printable character
      let char: string | undefined;
      if (event.sequence?.length === 1) {
        const code = event.sequence.charCodeAt(0);
        if (code >= 32 && code <= 126) char = event.sequence;
      }
      if (!char && keyName.length === 1) char = keyName;

      const key: KeyboardKey = {
        name: keyName,
        ctrl: event.ctrl || false,
        shift: event.shift || false,
        meta: event.meta || false,
        char,
      };

      // Dispatch to handlers in priority order
      for (const registration of handlers) {
        try {
          if (registration.handler(key)) return;
        } catch (error) {
          console.error('Keyboard handler error:', error);
        }
      }
    });

    return { registerHandler };
  },
});

/** Hook to register a keyboard handler with automatic cleanup */
export function useKeyboardHandler(
  handler: (key: KeyboardKey) => boolean,
  priority: KeyboardPriorityLevel = KeyboardPriority.Normal
): void {
  const { registerHandler } = useKeyboard();

  onMount(() => {
    const cleanup = registerHandler(handler, priority);
    onCleanup(cleanup);
  });
}

export { KeyboardProvider, useKeyboard };
