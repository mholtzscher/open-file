/**
 * Keyboard Types
 *
 * Type definitions for keyboard event handling.
 */

/**
 * Keyboard key event from the terminal
 */
export interface KeyboardKey {
  /** Key name (e.g., 'a', 'return', 'escape', 'up') */
  name: string;
  /** Whether Ctrl key was pressed */
  ctrl: boolean;
  /** Whether Shift key was pressed */
  shift: boolean;
  /** Whether Meta/Cmd key was pressed */
  meta: boolean;
  /** Raw character if available */
  char?: string;
}

/**
 * Keyboard event dispatcher function type
 */
export type KeyboardDispatcher = (key: KeyboardKey) => void;
