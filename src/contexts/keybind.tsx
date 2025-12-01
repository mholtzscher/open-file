/**
 * Keybind Context
 *
 * Manages keyboard shortcuts and keybinding state following the SST/OpenCode pattern.
 * Handles vim-style keybindings with leader key support.
 */

import { createStore } from 'solid-js/store';
import { useKeyboard } from '@opentui/solid';
import { createSimpleContext } from './helper.js';
import { useLocal } from './local.js';
import { useDialog } from './DialogContext.js';
import { EditMode } from '../types/edit-mode.js';
import { KeyAction, KeyboardKey } from '../types/keyboard.js';
import { defaultKeybindings } from '../hooks/keybindingDefaults.js';
import type { ParsedKey } from '@opentui/core';

// Leader key configuration
const LEADER_KEY = 'space';
const LEADER_TIMEOUT = 2000;

// ============================================================================
// Types
// ============================================================================

export interface KeySequenceState {
  buffer: string[];
  isLeaderActive: boolean;
  lastKeyTime: number;
}

export type ActionHandler = (key?: KeyboardKey) => void | Promise<void>;
export type ActionHandlers = Partial<Record<KeyAction, ActionHandler>>;

// ============================================================================
// Context
// ============================================================================

export const { use: useKeybind, Provider: KeybindProvider } = createSimpleContext({
  name: 'Keybind',
  init: () => {
    const local = useLocal();
    const dialog = useDialog();

    const [store, setStore] = createStore<KeySequenceState>({
      buffer: [],
      isLeaderActive: false,
      lastKeyTime: 0,
    });

    let leaderTimeout: ReturnType<typeof setTimeout> | null = null;
    let actionHandlers: ActionHandlers = {};

    // Clear leader state
    const clearLeader = () => {
      setStore('isLeaderActive', false);
      setStore('buffer', []);
      if (leaderTimeout) {
        clearTimeout(leaderTimeout);
        leaderTimeout = null;
      }
    };

    // Start leader sequence
    const startLeader = () => {
      setStore('isLeaderActive', true);
      setStore('buffer', []);
      setStore('lastKeyTime', Date.now());

      // Set timeout to auto-clear leader
      if (leaderTimeout) clearTimeout(leaderTimeout);
      leaderTimeout = setTimeout(() => {
        clearLeader();
      }, LEADER_TIMEOUT);
    };

    // Get key signature for matching
    const getKeySignature = (evt: ParsedKey): string => {
      const parts: string[] = [];
      if (evt.ctrl) parts.push('ctrl');
      if (evt.meta) parts.push('meta');
      if (evt.shift && evt.name.length === 1) parts.push('shift');
      parts.push(evt.name.toLowerCase());
      return parts.join('+');
    };

    // Match key signature (simple string comparison)
    const matchSignature = (signature: string, expected: string): boolean => {
      return signature.toLowerCase() === expected.toLowerCase();
    };

    // Find action for key
    const findAction = (signature: string): KeyAction | null => {
      const mode = local.data.mode;

      // Check mode-specific bindings (Map structure: key -> action)
      const modeBindings = defaultKeybindings.get(mode);
      if (modeBindings) {
        const action = modeBindings.get(signature);
        if (action) return action;
      }

      // Check global bindings
      const globalBindings = defaultKeybindings.get('global' as EditMode);
      if (globalBindings) {
        const action = globalBindings.get(signature);
        if (action) return action;
      }

      return null;
    };

    // Handle keyboard input
    useKeyboard(async (evt: ParsedKey) => {
      // Skip if any dialog is open
      if (dialog.hasDialog) return;

      const signature = getKeySignature(evt);

      // Check for leader key
      if (signature === LEADER_KEY.toLowerCase() && !store.isLeaderActive) {
        startLeader();
        return;
      }

      // Find and execute action
      const action = findAction(signature);

      if (action) {
        // Clear leader state after action
        if (store.isLeaderActive) {
          clearLeader();
        }

        // Execute action handler
        const handler = actionHandlers[action];
        if (handler) {
          await handler({
            name: evt.name,
            ctrl: evt.ctrl,
            meta: evt.meta,
            shift: evt.shift,
          });
        }
      } else if (store.isLeaderActive) {
        // Invalid key after leader - clear
        clearLeader();
      }

      // Handle text input in edit modes
      if (
        (local.data.mode === EditMode.Search ||
          local.data.mode === EditMode.Edit ||
          local.data.mode === EditMode.Command) &&
        !evt.ctrl &&
        !evt.meta &&
        evt.name.length === 1
      ) {
        local.buffer.insertAtEditCursor(evt.name);
      }
    });

    return {
      /** Current key sequence state */
      data: store,

      /** Whether leader key is active */
      get isLeaderActive() {
        return store.isLeaderActive;
      },

      /** Register action handlers */
      setActionHandlers: (handlers: ActionHandlers) => {
        actionHandlers = handlers;
      },

      /** Manually trigger an action */
      triggerAction: async (action: KeyAction, key?: KeyboardKey) => {
        const handler = actionHandlers[action];
        if (handler) {
          await handler(key);
        }
      },

      /** Clear leader state */
      clearLeader,

      /** Get key signature from event */
      getKeySignature,

      /** Check if a key matches a signature */
      matchSignature,
    };
  },
});
