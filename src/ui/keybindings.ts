/**
 * Keybinding registry system
 * 
 * Centralized management of keybindings for different modes
 */

import { EditMode } from './buffer-state.js';

/**
 * Key action handler
 */
export type KeyActionHandler = (key: any) => void | Promise<void>;

/**
 * Keybinding action
 */
export interface KeyAction {
  /** Key name/code */
  key: string;
  /** Description for help */
  description: string;
  /** Handler function */
  handler: KeyActionHandler;
}

/**
 * Keybinding registry
 */
export class KeybindingRegistry {
  private bindings: Map<EditMode, Map<string, KeyAction>> = new Map();

  constructor() {
    this.bindings.set(EditMode.Normal, new Map());
    this.bindings.set(EditMode.Visual, new Map());
    this.bindings.set(EditMode.Edit, new Map());
    this.bindings.set(EditMode.Insert, new Map());
  }

  /**
   * Register a keybinding
   */
  register(mode: EditMode, key: string, action: KeyAction): void {
    const modeBindings = this.bindings.get(mode);
    if (!modeBindings) {
      throw new Error(`Invalid mode: ${mode}`);
    }
    modeBindings.set(key, action);
  }

  /**
   * Get action for a key in a mode
   */
  getAction(mode: EditMode, key: string): KeyAction | undefined {
    return this.bindings.get(mode)?.get(key);
  }

  /**
   * Get all actions for a mode
   */
  getActionsForMode(mode: EditMode): KeyAction[] {
    return Array.from(this.bindings.get(mode)?.values() ?? []);
  }

  /**
   * Check if key is bound in mode
   */
  isBound(mode: EditMode, key: string): boolean {
    return this.bindings.get(mode)?.has(key) ?? false;
  }

  /**
   * Clear all bindings for a mode
   */
  clear(mode: EditMode): void {
    const modeBindings = this.bindings.get(mode);
    if (modeBindings) {
      modeBindings.clear();
    }
  }

  /**
   * Clear all bindings
   */
  clearAll(): void {
    for (const mode of [EditMode.Normal, EditMode.Visual, EditMode.Edit, EditMode.Insert]) {
      this.clear(mode);
    }
  }
}

/**
 * Default keybindings
 */
export function createDefaultKeybindings(): KeybindingRegistry {
  const registry = new KeybindingRegistry();

  // Normal mode navigation
  registry.register(EditMode.Normal, 'j', {
    key: 'j',
    description: 'Move cursor down',
    handler: () => {}, // Will be bound to actual handler
  });

  registry.register(EditMode.Normal, 'k', {
    key: 'k',
    description: 'Move cursor up',
    handler: () => {},
  });

  registry.register(EditMode.Normal, 'g', {
    key: 'g',
    description: 'Move to top',
    handler: () => {},
  });

  registry.register(EditMode.Normal, 'G', {
    key: 'G',
    description: 'Move to bottom',
    handler: () => {},
  });

  registry.register(EditMode.Normal, 'v', {
    key: 'v',
    description: 'Start visual selection',
    handler: () => {},
  });

  registry.register(EditMode.Normal, 'enter', {
    key: 'enter',
    description: 'Open directory or file',
    handler: () => {},
  });

  registry.register(EditMode.Normal, 'l', {
    key: 'l',
    description: 'Open directory or file',
    handler: () => {},
  });

  registry.register(EditMode.Normal, 'h', {
    key: 'h',
    description: 'Go to parent directory',
    handler: () => {},
  });

  registry.register(EditMode.Normal, 'backspace', {
    key: 'backspace',
    description: 'Go to parent directory',
    handler: () => {},
  });

  registry.register(EditMode.Normal, 'i', {
    key: 'i',
    description: 'Enter edit/insert mode',
    handler: () => {},
  });

  registry.register(EditMode.Normal, 'a', {
    key: 'a',
    description: 'Enter edit/insert mode',
    handler: () => {},
  });

   registry.register(EditMode.Normal, 'w', {
     key: 'w',
     description: 'Save changes',
     handler: () => {},
   });

   registry.register(EditMode.Normal, 'c', {
     key: 'c',
     description: 'Copy selected entry',
     handler: () => {},
   });

   registry.register(EditMode.Normal, 'p', {
     key: 'p',
     description: 'Paste after cursor',
     handler: () => {},
   });

   registry.register(EditMode.Normal, 'P', {
     key: 'P',
     description: 'Paste before cursor',
     handler: () => {},
   });

   registry.register(EditMode.Normal, 'q', {
     key: 'q',
     description: 'Quit application',
     handler: () => {},
   });

  // Visual mode
  registry.register(EditMode.Visual, 'j', {
    key: 'j',
    description: 'Extend selection down',
    handler: () => {},
  });

  registry.register(EditMode.Visual, 'k', {
    key: 'k',
    description: 'Extend selection up',
    handler: () => {},
  });

  registry.register(EditMode.Visual, 'd', {
    key: 'd',
    description: 'Delete selected entries',
    handler: () => {},
  });

  registry.register(EditMode.Visual, 'escape', {
    key: 'escape',
    description: 'Exit visual mode',
    handler: () => {},
  });

  // Edit mode
  registry.register(EditMode.Edit, 'escape', {
    key: 'escape',
    description: 'Exit edit mode',
    handler: () => {},
  });

  return registry;
}
