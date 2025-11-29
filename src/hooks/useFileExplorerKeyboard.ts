/**
 * useFileExplorerKeyboard Hook
 *
 * Handles keyboard input for the FileExplorer component.
 * Implements mode-aware keybindings with support for:
 * - Text input modes (Search, Command, Insert, Edit)
 * - Multi-key sequences (gg, dd, yy, g?)
 * - Mode-specific and global keybindings
 */

import { useCallback } from 'react';
import { useKeyboardHandler } from '../contexts/KeyboardContext.js';
import { EditMode } from '../types/edit-mode.js';
import { keyToString, type KeyboardKey, type KeyAction } from '../types/keyboard.js';
import { defaultKeybindings } from './keybindingDefaults.js';
import { useKeySequence } from './useKeySequence.js';

/**
 * Action handlers map type (from useS3Actions)
 */
export type ActionHandlers = Partial<
  Record<KeyAction, (key?: KeyboardKey) => void | Promise<void>>
>;

/**
 * Props for the useFileExplorerKeyboard hook
 */
export interface UseFileExplorerKeyboardProps {
  /** Current edit mode from buffer state */
  mode: EditMode;
  /** Action handlers from useS3Actions */
  actionHandlers: ActionHandlers;
  /** Whether any dialog is currently open */
  isAnyDialogOpen: boolean;
}

/**
 * Key sequence configuration for vim-style multi-key commands
 */
const KEY_SEQUENCE_CONFIG = {
  timeout: 500,
  sequenceStarters: ['g', 'd', 'y'],
  sequences: {
    gg: 'cursor:top' as KeyAction,
    dd: 'entry:delete' as KeyAction,
    yy: 'entry:copy' as KeyAction,
    'g?': 'dialog:help' as KeyAction,
  },
  bottomAction: 'cursor:bottom' as KeyAction,
};

/**
 * Hook that manages keyboard input for the FileExplorer
 *
 * This hook:
 * 1. Sets up multi-key sequence handling (gg, dd, yy, g?)
 * 2. Creates a keyboard handler callback
 * 3. Registers the handler with the KeyboardContext
 *
 * @example
 * ```tsx
 * useFileExplorerKeyboard({
 *   mode: bufferState.mode,
 *   actionHandlers,
 *   isAnyDialogOpen,
 * });
 * ```
 */
export function useFileExplorerKeyboard({
  mode,
  actionHandlers,
  isAnyDialogOpen,
}: UseFileExplorerKeyboardProps): void {
  // Multi-key sequence handling (gg, dd, yy, g?)
  const { handleSequence } = useKeySequence(KEY_SEQUENCE_CONFIG);

  // Main keyboard handler
  const keyboardHandlerCallback = useCallback(
    (key: KeyboardKey): boolean => {
      // If a dialog is open, let dialog handlers process the key
      if (isAnyDialogOpen) {
        return false;
      }

      // Helper to execute an action via actionHandlers map
      const executeAction = (action: KeyAction, event?: KeyboardKey): boolean => {
        const handler = actionHandlers[action];
        if (handler) {
          handler(event);
          return true;
        }
        return false;
      };

      // Text input modes: Search, Command, Insert, Edit
      const isTextInputMode =
        mode === EditMode.Search ||
        mode === EditMode.Command ||
        mode === EditMode.Insert ||
        mode === EditMode.Edit;

      if (isTextInputMode) {
        if (key.name === 'escape') {
          return executeAction('input:cancel', key);
        }
        if (key.name === 'return' || key.name === 'enter') {
          return executeAction('input:confirm', key);
        }
        if (key.name === 'backspace') {
          return executeAction('input:backspace', key);
        }
        if (key.name === 'tab') {
          return executeAction('input:tab', key);
        }
        if (key.char && key.char.length === 1) {
          return executeAction('input:char', key);
        }
        // Search mode: n/N for next/prev match
        if (mode === EditMode.Search) {
          if (key.name === 'n') {
            return executeAction('cursor:down', key);
          }
          if (key.name === 'N' || (key.shift && key.name === 'n')) {
            return executeAction('cursor:up', key);
          }
        }
        return false;
      }

      // Normal mode: handle multi-key sequences (gg, dd, yy, g?)
      if (mode === EditMode.Normal) {
        const seqResult = handleSequence(key);
        if (seqResult.handled && seqResult.action) {
          return executeAction(seqResult.action, key);
        }
        if (seqResult.waitingForMore) {
          return true; // waiting for more keys in sequence
        }
      }

      // Keybinding lookup: mode-specific first
      const keyStr = keyToString(key);
      const modeBindings = defaultKeybindings.get(mode);
      const action = modeBindings?.get(keyStr);

      if (action) {
        return executeAction(action, key);
      }

      // Global bindings
      const globalBindings = defaultKeybindings.get('global');
      const globalAction = globalBindings?.get(keyStr);

      if (globalAction) {
        return executeAction(globalAction, key);
      }

      return false;
    },
    [isAnyDialogOpen, mode, actionHandlers, handleSequence]
  );

  // Register keyboard handler with context at normal priority
  useKeyboardHandler(keyboardHandlerCallback);
}
