/**
 * KeyboardContext
 *
 * SolidJS Context for centralized keyboard event handling.
 *
 * Features:
 * - Priority-based handler registration (dialogs > main UI)
 * - Type-safe keyboard events
 * - Testable in isolation (mock context in tests)
 * - Optional external key source integration (CLI renderer)
 */

import { onMount, onCleanup } from 'solid-js';
import type { KeyboardKey, KeyboardDispatcher } from '../types/keyboard.js';
import { createSimpleContext } from './helper.js';

/**
 * Handler priority levels
 * Higher numbers = higher priority (handled first)
 */
export const KeyboardPriority = {
  /** Lowest priority - default handlers */
  Low: 0,
  /** Normal priority - main UI handlers */
  Normal: 50,
  /** High priority - dialogs and overlays */
  High: 100,
  /** Highest priority - system-level handlers */
  Critical: 200,
} as const;

export type KeyboardPriorityLevel = (typeof KeyboardPriority)[keyof typeof KeyboardPriority];

/**
 * Handler registration with priority
 */
interface HandlerRegistration {
  /** Unique identifier for this handler */
  id: string;
  /** The handler function - returns true if key was consumed */
  handler: (key: KeyboardKey) => boolean;
  /** Priority level */
  priority: KeyboardPriorityLevel;
}

/**
 * Keyboard context value
 */
interface KeyboardContextValue {
  /**
   * Register a keyboard handler
   * @param handler - Function that handles keyboard events, returns true if consumed
   * @param priority - Handler priority (higher = handled first)
   * @returns Cleanup function to unregister the handler
   */
  registerHandler: (
    handler: (key: KeyboardKey) => boolean,
    priority?: KeyboardPriorityLevel
  ) => () => void;

  /**
   * Dispatch a keyboard event to all registered handlers
   * Handlers are called in priority order (highest first)
   * Stops when a handler returns true (consumed)
   */
  dispatch: KeyboardDispatcher;
}

/**
 * Props for KeyboardProvider
 */
interface KeyboardProviderProps {
  /**
   * Callback when dispatch function is ready
   * Used to bridge external key sources (e.g., CLI renderer) to the context
   */
  onDispatchReady?: (dispatch: KeyboardDispatcher | null) => void;
}

/**
 * Generate a unique handler ID
 */
let handlerIdCounter = 0;
function generateHandlerId(): string {
  return `keyboard-handler-${++handlerIdCounter}`;
}

/**
 * KeyboardProvider using the SST createSimpleContext pattern
 */
const { Provider: KeyboardProvider, use: useKeyboard } = createSimpleContext<
  KeyboardContextValue,
  KeyboardProviderProps
>({
  name: 'Keyboard',
  init: props => {
    // Use a plain array for handlers (not reactive - we manage this manually)
    let handlers: HandlerRegistration[] = [];

    const registerHandler = (
      handler: (key: KeyboardKey) => boolean,
      priority: KeyboardPriorityLevel = KeyboardPriority.Normal
    ) => {
      const id = generateHandlerId();
      const registration: HandlerRegistration = { id, handler, priority };

      // Add handler and sort by priority (descending - highest first)
      handlers.push(registration);
      handlers.sort((a, b) => b.priority - a.priority);

      // Return cleanup function
      return () => {
        handlers = handlers.filter(r => r.id !== id);
      };
    };

    const dispatch: KeyboardDispatcher = (key: KeyboardKey) => {
      // Call handlers in priority order until one consumes the key
      for (const registration of handlers) {
        try {
          const consumed = registration.handler(key);
          if (consumed) {
            return; // Key was consumed, stop processing
          }
        } catch (error) {
          // Log error but continue to next handler
          console.error('Keyboard handler error:', error);
        }
      }
    };

    // Notify parent when dispatch is ready (for bridging external key sources)
    onMount(() => {
      props.onDispatchReady?.(dispatch);
    });

    onCleanup(() => {
      props.onDispatchReady?.(null);
    });

    return { registerHandler, dispatch };
  },
});

/**
 * Hook to register a keyboard handler
 *
 * @param handler - Handler function (no need for useCallback in Solid)
 * @param priority - Handler priority (higher = handled first)
 *
 * @example
 * ```tsx
 * // Main UI handler
 * useKeyboardHandler((key) => {
 *   if (key.name === 'j') {
 *     moveCursorDown();
 *     return true;
 *   }
 *   return false;
 * });
 *
 * // Dialog handler with high priority
 * useKeyboardHandler((key) => {
 *   if (key.name === 'escape') {
 *     closeDialog();
 *     return true;
 *   }
 *   return false;
 * }, KeyboardPriority.High);
 * ```
 */
export function useKeyboardHandler(
  handler: (key: KeyboardKey) => boolean,
  priority: KeyboardPriorityLevel = KeyboardPriority.Normal
): void {
  const { registerHandler } = useKeyboard();

  // In Solid, we register on mount and clean up automatically
  onMount(() => {
    const cleanup = registerHandler(handler, priority);
    onCleanup(cleanup);
  });
}

export { KeyboardProvider, useKeyboard };
