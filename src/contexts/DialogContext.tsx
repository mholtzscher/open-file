/**
 * DialogContext - Stack-based dialog management
 *
 * Following OpenCode's pattern:
 * - Dialogs are pushed onto a stack
 * - Escape key closes the top dialog
 * - Individual dialogs use useKeyboard directly for their keys
 */

import { createContext, useContext, Show, type ParentProps, type JSX } from 'solid-js';
import { createStore } from 'solid-js/store';
import { useKeyboard } from '@opentui/solid';

// ============================================================================
// Types
// ============================================================================

interface DialogStackItem {
  element: JSX.Element;
  onClose?: () => void;
}

export interface DialogContextValue {
  /** Push a dialog onto the stack */
  push: (element: JSX.Element, onClose?: () => void) => void;
  /** Replace all dialogs with a new one */
  replace: (element: JSX.Element, onClose?: () => void) => void;
  /** Pop the top dialog */
  pop: () => void;
  /** Clear all dialogs */
  clear: () => void;
  /** Check if any dialog is open */
  readonly hasDialog: boolean;
  /** Current stack depth */
  readonly depth: number;
}

// ============================================================================
// Context
// ============================================================================

const DialogCtx = createContext<DialogContextValue>();

export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogCtx);
  if (!ctx) {
    throw new Error('useDialog must be used within DialogProvider');
  }
  return ctx;
}

// ============================================================================
// Dialog Backdrop Component
// ============================================================================

function DialogBackdrop(props: ParentProps<{ onClose: () => void }>) {
  return (
    <box
      position="absolute"
      left={0}
      top={0}
      width="100%"
      height="100%"
      alignItems="center"
      justifyContent="center"
    >
      {props.children}
    </box>
  );
}

// ============================================================================
// Provider
// ============================================================================

export function DialogProvider(props: ParentProps) {
  const [store, setStore] = createStore({
    stack: [] as DialogStackItem[],
  });

  // Handle Escape key globally for dialogs
  useKeyboard(evt => {
    if (evt.name === 'escape' && store.stack.length > 0) {
      const top = store.stack.at(-1);
      top?.onClose?.();
      setStore('stack', store.stack.slice(0, -1));
    }
  });

  const value: DialogContextValue = {
    push(element, onClose) {
      setStore('stack', [...store.stack, { element, onClose }]);
    },

    replace(element, onClose) {
      // Close all existing dialogs
      for (const item of store.stack) {
        item.onClose?.();
      }
      setStore('stack', [{ element, onClose }]);
    },

    pop() {
      if (store.stack.length > 0) {
        const top = store.stack.at(-1);
        top?.onClose?.();
        setStore('stack', store.stack.slice(0, -1));
      }
    },

    clear() {
      for (const item of store.stack) {
        item.onClose?.();
      }
      setStore('stack', []);
    },

    get hasDialog() {
      return store.stack.length > 0;
    },

    get depth() {
      return store.stack.length;
    },
  };

  return (
    <DialogCtx.Provider value={value}>
      {props.children}
      <Show when={store.stack.length > 0}>
        <DialogBackdrop onClose={() => value.clear()}>{store.stack.at(-1)?.element}</DialogBackdrop>
      </Show>
    </DialogCtx.Provider>
  );
}
