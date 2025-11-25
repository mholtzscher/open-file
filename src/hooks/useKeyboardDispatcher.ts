/**
 * useKeyboardDispatcher Hook
 *
 * Centralized keyboard handling with action-based dispatch.
 * Maps keyboard events to semantic actions based on current mode.
 *
 * Features:
 * - Mode-aware keybinding resolution
 * - Multi-key sequence support (gg, dd, yy)
 * - Action handler registration
 * - Customizable keybindings
 */

import { useCallback, useRef, useEffect } from 'react';
import { EditMode } from '../types/edit-mode.js';
import { KeyboardKey, KeyAction, keyToString } from '../types/keyboard.js';
import { defaultKeybindings, KeybindingMap } from './keybindingDefaults.js';

/**
 * Options for the keyboard dispatcher
 */
export interface KeyboardDispatcherOptions {
  /** Current edit mode */
  mode: EditMode;
  /** Whether a dialog is currently open (blocks normal keybindings) */
  isDialogOpen?: boolean;
  /** Custom keybindings (defaults to defaultKeybindings) */
  keybindings?: KeybindingMap;
  /** Timeout for multi-key sequences in ms (default: 500) */
  sequenceTimeout?: number;
}

/**
 * Action handler function type
 */
export type ActionHandler = (key?: KeyboardKey) => void;

/**
 * Return type for useKeyboardDispatcher
 */
export interface UseKeyboardDispatcherReturn {
  /**
   * Process a keyboard event and dispatch to registered handlers
   * @returns true if the key was handled, false otherwise
   */
  dispatch: (key: KeyboardKey) => boolean;

  /**
   * Register a handler for a specific action
   * @returns cleanup function to unregister
   */
  registerAction: (action: KeyAction, handler: ActionHandler) => () => void;

  /**
   * Register multiple action handlers at once
   * @returns cleanup function to unregister all
   */
  registerActions: (handlers: Partial<Record<KeyAction, ActionHandler>>) => () => void;

  /**
   * Get the current key sequence (for display purposes)
   */
  getKeySequence: () => string[];

  /**
   * Clear the current key sequence
   */
  clearKeySequence: () => void;
}

/**
 * Multi-key sequences that require special handling
 */
const SEQUENCE_STARTERS = new Set(['g', 'd', 'y']);
const VALID_SEQUENCES: Record<string, KeyAction> = {
  gg: 'cursor:top',
  dd: 'entry:delete',
  yy: 'entry:copy',
  'g?': 'dialog:help',
};

/**
 * Hook for centralized keyboard handling with action dispatch
 */
export function useKeyboardDispatcher(
  options: KeyboardDispatcherOptions
): UseKeyboardDispatcherReturn {
  const {
    mode,
    isDialogOpen = false,
    keybindings = defaultKeybindings,
    sequenceTimeout = 500,
  } = options;

  // Action handlers registry
  const handlersRef = useRef<Map<KeyAction, ActionHandler>>(new Map());

  // Multi-key sequence state
  const keySequenceRef = useRef<string[]>([]);
  const sequenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear key sequence
  const clearKeySequence = useCallback(() => {
    if (sequenceTimeoutRef.current) {
      clearTimeout(sequenceTimeoutRef.current);
      sequenceTimeoutRef.current = null;
    }
    keySequenceRef.current = [];
  }, []);

  // Get current key sequence
  const getKeySequence = useCallback(() => {
    return [...keySequenceRef.current];
  }, []);

  // Register a single action handler
  const registerAction = useCallback((action: KeyAction, handler: ActionHandler): (() => void) => {
    handlersRef.current.set(action, handler);
    return () => {
      handlersRef.current.delete(action);
    };
  }, []);

  // Register multiple action handlers
  const registerActions = useCallback(
    (handlers: Partial<Record<KeyAction, ActionHandler>>): (() => void) => {
      const cleanups: (() => void)[] = [];
      for (const [action, handler] of Object.entries(handlers)) {
        if (handler) {
          cleanups.push(registerAction(action as KeyAction, handler));
        }
      }
      return () => {
        cleanups.forEach(cleanup => cleanup());
      };
    },
    [registerAction]
  );

  // Execute an action
  const executeAction = useCallback((action: KeyAction, key?: KeyboardKey): boolean => {
    const handler = handlersRef.current.get(action);
    if (handler) {
      handler(key);
      return true;
    }
    return false;
  }, []);

  // Handle multi-key sequences
  const handleSequence = useCallback(
    (key: KeyboardKey): { handled: boolean; action?: KeyAction } => {
      const keyName = key.name;

      // Add to sequence
      keySequenceRef.current.push(keyName);

      // Clear existing timeout
      if (sequenceTimeoutRef.current) {
        clearTimeout(sequenceTimeoutRef.current);
      }

      // Set new timeout to clear sequence
      sequenceTimeoutRef.current = setTimeout(() => {
        keySequenceRef.current = [];
      }, sequenceTimeout);

      // Check for complete sequence
      const sequence = keySequenceRef.current.join('');

      if (VALID_SEQUENCES[sequence]) {
        const action = VALID_SEQUENCES[sequence];
        keySequenceRef.current = [];
        return { handled: true, action };
      }

      // Special case: single G (shift+g) goes to bottom
      if (
        sequence === 'G' ||
        (keySequenceRef.current.length === 1 && key.shift && keyName === 'g')
      ) {
        keySequenceRef.current = [];
        return { handled: true, action: 'cursor:bottom' };
      }

      // If waiting for sequence continuation
      if (keySequenceRef.current.length === 1 && SEQUENCE_STARTERS.has(keyName)) {
        return { handled: false }; // Wait for next key
      }

      // Unrecognized sequence - clear and don't handle
      if (keySequenceRef.current.length > 1) {
        keySequenceRef.current = [];
      }

      return { handled: false };
    },
    [sequenceTimeout]
  );

  // Main dispatch function
  const dispatch = useCallback(
    (key: KeyboardKey): boolean => {
      // If dialog is open, don't process normal keybindings
      // Dialogs should handle their own keys via high-priority context handlers
      if (isDialogOpen) {
        return false;
      }

      // In text input modes (Search, Command, Insert, Edit), handle text input specially
      const isTextInputMode = [
        EditMode.Search,
        EditMode.Command,
        EditMode.Insert,
        EditMode.Edit,
      ].includes(mode);

      if (isTextInputMode) {
        // Handle escape to exit mode
        if (key.name === 'escape') {
          return executeAction('input:cancel', key);
        }

        // Handle enter to confirm
        if (key.name === 'return' || key.name === 'enter') {
          return executeAction('input:confirm', key);
        }

        // Handle backspace
        if (key.name === 'backspace') {
          return executeAction('input:backspace', key);
        }

        // Handle tab (for completion)
        if (key.name === 'tab') {
          return executeAction('input:tab', key);
        }

        // Handle printable characters
        if (key.char && key.char.length === 1) {
          return executeAction('input:char', key);
        }

        // Handle n/N in search mode for next/prev match
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

      // Normal mode - check for multi-key sequences (gg, dd, yy)
      // Visual mode skips sequences - d/y work directly on selection
      if (mode === EditMode.Normal) {
        const seqResult = handleSequence(key);
        if (seqResult.handled && seqResult.action) {
          return executeAction(seqResult.action, key);
        }
        // If sequence is in progress (waiting for more keys), don't process further
        if (keySequenceRef.current.length > 0 && SEQUENCE_STARTERS.has(keySequenceRef.current[0])) {
          return true; // Consumed, waiting for sequence
        }
      }

      // Look up keybinding for current mode
      const keyStr = keyToString(key);
      const modeBindings = keybindings.get(mode);
      const action = modeBindings?.get(keyStr);

      if (action) {
        return executeAction(action, key);
      }

      // Check for global bindings (mode-independent)
      const globalBindings = keybindings.get('global' as EditMode);
      const globalAction = globalBindings?.get(keyStr);

      if (globalAction) {
        return executeAction(globalAction, key);
      }

      return false;
    },
    [mode, isDialogOpen, keybindings, handleSequence, executeAction]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sequenceTimeoutRef.current) {
        clearTimeout(sequenceTimeoutRef.current);
      }
    };
  }, []);

  return {
    dispatch,
    registerAction,
    registerActions,
    getKeySequence,
    clearKeySequence,
  };
}
