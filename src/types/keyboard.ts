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

/**
 * Keyboard action identifiers
 *
 * Actions are semantic names for keyboard operations.
 * This decouples key bindings from their implementations.
 */
export type KeyAction =
  // Navigation
  | 'cursor:up'
  | 'cursor:down'
  | 'cursor:top'
  | 'cursor:bottom'
  | 'cursor:pageUp'
  | 'cursor:pageDown'
  // Entry operations
  | 'entry:open'
  | 'entry:back'
  | 'entry:delete'
  | 'entry:rename'
  | 'entry:copy'
  | 'entry:paste'
  | 'entry:download'
  | 'entry:upload'
  // Mode changes
  | 'mode:insert'
  | 'mode:edit'
  | 'mode:search'
  | 'mode:command'
  | 'mode:visual'
  | 'mode:normal'
  // Dialogs
  | 'dialog:help'
  | 'dialog:sort'
  | 'dialog:upload'
  | 'dialog:profileSelector'
  // Buffer operations
  | 'buffer:save'
  | 'buffer:refresh'
  | 'buffer:undo'
  | 'buffer:redo'
  // Selection
  | 'select:toggle'
  | 'select:extend:up'
  | 'select:extend:down'
  // Application
  | 'app:quit'
  | 'app:toggleHidden'
  // Multi-pane
  | 'pane:toggle'
  | 'pane:switch'
  // Special - for text input in modes like search/command/insert
  | 'input:char'
  | 'input:backspace'
  | 'input:confirm'
  | 'input:cancel'
  | 'input:tab';

/**
 * Keybinding definition
 */
export interface Keybinding {
  /** The key (e.g., 'j', 'return', 'escape') */
  key: string;
  /** Modifier keys */
  ctrl?: boolean;
  shift?: boolean;
  meta?: boolean;
  /** The action to trigger */
  action: KeyAction;
  /** Description for help text */
  description?: string;
}

/**
 * Convert a KeyboardKey to a string representation for keybinding lookup
 */
export function keyToString(key: KeyboardKey): string {
  const parts: string[] = [];
  if (key.ctrl) parts.push('ctrl');
  if (key.meta) parts.push('meta');
  if (key.shift) parts.push('shift');
  parts.push(key.name);
  return parts.join('+');
}
