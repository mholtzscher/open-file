/**
 * KeyboardContext
 *
 * React Context for centralized keyboard event handling.
 * Replaces the global mutable dispatcher with a proper React pattern.
 *
 * Features:
 * - Priority-based handler registration (dialogs > main UI)
 * - Type-safe keyboard events
 * - Testable in isolation (mock context in tests)
 * - No global mutable state
 */

import { createContext, useContext, useCallback, useRef, useEffect, ReactNode } from 'react';
import type { KeyboardKey, KeyboardDispatcher } from '../types/keyboard.js';

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

const KeyboardContext = createContext<KeyboardContextValue | null>(null);

/**
 * Props for KeyboardProvider
 */
interface KeyboardProviderProps {
  children: ReactNode;
}

/**
 * Generate a unique handler ID
 */
let handlerIdCounter = 0;
function generateHandlerId(): string {
  return `keyboard-handler-${++handlerIdCounter}`;
}

/**
 * KeyboardProvider component
 *
 * Wraps the application to provide centralized keyboard handling.
 * Handlers are called in priority order - highest priority first.
 * When a handler returns true, the key is considered consumed and
 * no further handlers are called.
 */
export function KeyboardProvider({ children }: KeyboardProviderProps) {
  const handlersRef = useRef<HandlerRegistration[]>([]);

  const registerHandler = useCallback(
    (
      handler: (key: KeyboardKey) => boolean,
      priority: KeyboardPriorityLevel = KeyboardPriority.Normal
    ) => {
      const id = generateHandlerId();
      const registration: HandlerRegistration = { id, handler, priority };

      // Add handler and sort by priority (descending - highest first)
      handlersRef.current.push(registration);
      handlersRef.current.sort((a, b) => b.priority - a.priority);

      // Return cleanup function
      return () => {
        handlersRef.current = handlersRef.current.filter(r => r.id !== id);
      };
    },
    []
  );

  const dispatch = useCallback((key: KeyboardKey) => {
    // Call handlers in priority order until one consumes the key
    for (const registration of handlersRef.current) {
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
  }, []);

  return (
    <KeyboardContext.Provider value={{ registerHandler, dispatch }}>
      {children}
    </KeyboardContext.Provider>
  );
}

/**
 * Hook to access the keyboard context
 * @throws Error if used outside KeyboardProvider
 */
export function useKeyboard(): KeyboardContextValue {
  const context = useContext(KeyboardContext);
  if (!context) {
    throw new Error('useKeyboard must be used within a KeyboardProvider');
  }
  return context;
}

/**
 * Hook to register a keyboard handler
 *
 * @param handler - Function that handles keyboard events, returns true if consumed
 * @param deps - Dependency array for the handler (like useCallback deps)
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
 * }, [moveCursorDown]);
 *
 * // Dialog handler with high priority
 * useKeyboardHandler((key) => {
 *   if (key.name === 'escape') {
 *     closeDialog();
 *     return true;
 *   }
 *   return false;
 * }, [closeDialog], KeyboardPriority.High);
 * ```
 */
export function useKeyboardHandler(
  handler: (key: KeyboardKey) => boolean,
  deps: React.DependencyList,
  priority: KeyboardPriorityLevel = KeyboardPriority.Normal
): void {
  const { registerHandler } = useKeyboard();

  useEffect(() => {
    return registerHandler(handler, priority);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerHandler, priority, ...deps]);
}

/**
 * Hook to get the dispatch function for external key sources
 * (e.g., the CLI renderer's keypress events)
 */
export function useKeyboardDispatch(): KeyboardDispatcher {
  const { dispatch } = useKeyboard();
  return dispatch;
}
