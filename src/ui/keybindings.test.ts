/**
 * Tests for keybinding registry system
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { KeybindingRegistry, createDefaultKeybindings, KeyAction } from './keybindings.js';
import { EditMode } from './buffer-state.js';

describe('KeybindingRegistry', () => {
  let registry: KeybindingRegistry;

  beforeEach(() => {
    registry = new KeybindingRegistry();
  });

  describe('constructor', () => {
    it('should initialize with empty bindings for all modes', () => {
      expect(registry.getActionsForMode(EditMode.Normal)).toEqual([]);
      expect(registry.getActionsForMode(EditMode.Visual)).toEqual([]);
      expect(registry.getActionsForMode(EditMode.Edit)).toEqual([]);
      expect(registry.getActionsForMode(EditMode.Insert)).toEqual([]);
    });
  });

  describe('register', () => {
    it('should register a keybinding for a mode', () => {
      const action: KeyAction = {
        key: 'j',
        description: 'Move down',
        handler: () => {},
      };

      registry.register(EditMode.Normal, 'j', action);

      expect(registry.getAction(EditMode.Normal, 'j')).toBe(action);
      expect(registry.isBound(EditMode.Normal, 'j')).toBe(true);
    });

    it('should throw error for invalid mode', () => {
      const action: KeyAction = {
        key: 'x',
        description: 'Test',
        handler: () => {},
      };

      expect(() => {
        registry.register('invalid' as EditMode, 'x', action);
      }).toThrow('Invalid mode: invalid');
    });

    it('should overwrite existing keybinding', () => {
      const action1: KeyAction = {
        key: 'j',
        description: 'Move down',
        handler: () => {},
      };

      const action2: KeyAction = {
        key: 'j',
        description: 'Jump down',
        handler: () => {},
      };

      registry.register(EditMode.Normal, 'j', action1);
      registry.register(EditMode.Normal, 'j', action2);

      expect(registry.getAction(EditMode.Normal, 'j')).toBe(action2);
      expect(registry.getAction(EditMode.Normal, 'j')?.description).toBe('Jump down');
    });
  });

  describe('getAction', () => {
    it('should return undefined for unregistered key', () => {
      expect(registry.getAction(EditMode.Normal, 'x')).toBeUndefined();
    });

    it('should return undefined for key in different mode', () => {
      const action: KeyAction = {
        key: 'j',
        description: 'Move down',
        handler: () => {},
      };

      registry.register(EditMode.Normal, 'j', action);

      expect(registry.getAction(EditMode.Visual, 'j')).toBeUndefined();
    });

    it('should return correct action for registered key', () => {
      const action: KeyAction = {
        key: 'j',
        description: 'Move down',
        handler: () => {},
      };

      registry.register(EditMode.Normal, 'j', action);

      expect(registry.getAction(EditMode.Normal, 'j')).toBe(action);
    });
  });

  describe('getActionsForMode', () => {
    it('should return empty array for mode with no bindings', () => {
      expect(registry.getActionsForMode(EditMode.Normal)).toEqual([]);
    });

    it('should return all actions for mode', () => {
      const action1: KeyAction = {
        key: 'j',
        description: 'Move down',
        handler: () => {},
      };

      const action2: KeyAction = {
        key: 'k',
        description: 'Move up',
        handler: () => {},
      };

      registry.register(EditMode.Normal, 'j', action1);
      registry.register(EditMode.Normal, 'k', action2);

      const actions = registry.getActionsForMode(EditMode.Normal);
      expect(actions).toHaveLength(2);
      expect(actions).toContain(action1);
      expect(actions).toContain(action2);
    });

    it('should not return actions from other modes', () => {
      const action: KeyAction = {
        key: 'j',
        description: 'Move down',
        handler: () => {},
      };

      registry.register(EditMode.Normal, 'j', action);

      expect(registry.getActionsForMode(EditMode.Visual)).toEqual([]);
    });
  });

  describe('isBound', () => {
    it('should return false for unregistered key', () => {
      expect(registry.isBound(EditMode.Normal, 'x')).toBe(false);
    });

    it('should return false for key in different mode', () => {
      const action: KeyAction = {
        key: 'j',
        description: 'Move down',
        handler: () => {},
      };

      registry.register(EditMode.Normal, 'j', action);

      expect(registry.isBound(EditMode.Visual, 'j')).toBe(false);
    });

    it('should return true for registered key', () => {
      const action: KeyAction = {
        key: 'j',
        description: 'Move down',
        handler: () => {},
      };

      registry.register(EditMode.Normal, 'j', action);

      expect(registry.isBound(EditMode.Normal, 'j')).toBe(true);
    });
  });

  describe('clear', () => {
    it('should clear bindings for specific mode', () => {
      const action: KeyAction = {
        key: 'j',
        description: 'Move down',
        handler: () => {},
      };

      registry.register(EditMode.Normal, 'j', action);
      registry.register(EditMode.Visual, 'j', action);

      registry.clear(EditMode.Normal);

      expect(registry.isBound(EditMode.Normal, 'j')).toBe(false);
      expect(registry.isBound(EditMode.Visual, 'j')).toBe(true);
    });

    it('should handle clearing mode with no bindings', () => {
      expect(() => registry.clear(EditMode.Normal)).not.toThrow();
    });
  });

  describe('clearAll', () => {
    it('should clear all bindings', () => {
      const action: KeyAction = {
        key: 'j',
        description: 'Move down',
        handler: () => {},
      };

      registry.register(EditMode.Normal, 'j', action);
      registry.register(EditMode.Visual, 'j', action);
      registry.register(EditMode.Edit, 'j', action);
      registry.register(EditMode.Insert, 'j', action);

      registry.clearAll();

      expect(registry.isBound(EditMode.Normal, 'j')).toBe(false);
      expect(registry.isBound(EditMode.Visual, 'j')).toBe(false);
      expect(registry.isBound(EditMode.Edit, 'j')).toBe(false);
      expect(registry.isBound(EditMode.Insert, 'j')).toBe(false);
    });
  });
});

describe('createDefaultKeybindings', () => {
  it('should create registry with default bindings', () => {
    const registry = createDefaultKeybindings();

    // Check normal mode bindings
    expect(registry.isBound(EditMode.Normal, 'j')).toBe(true);
    expect(registry.isBound(EditMode.Normal, 'k')).toBe(true);
    expect(registry.isBound(EditMode.Normal, 'v')).toBe(true);
    expect(registry.isBound(EditMode.Normal, 'i')).toBe(true);
    expect(registry.isBound(EditMode.Normal, 'C-d')).toBe(true);
    expect(registry.isBound(EditMode.Normal, 'C-u')).toBe(true);

    // Check visual mode bindings
    expect(registry.isBound(EditMode.Visual, 'j')).toBe(true);
    expect(registry.isBound(EditMode.Visual, 'k')).toBe(true);
    expect(registry.isBound(EditMode.Visual, 'd')).toBe(true);
    expect(registry.isBound(EditMode.Visual, 'escape')).toBe(true);

    // Check edit mode bindings
    expect(registry.isBound(EditMode.Edit, 'escape')).toBe(true);

    // Check search mode bindings
    expect(registry.isBound(EditMode.Search, 'escape')).toBe(true);
    expect(registry.isBound(EditMode.Normal, '/')).toBe(true);
  });

  it('should have proper descriptions for default bindings', () => {
    const registry = createDefaultKeybindings();

    const jAction = registry.getAction(EditMode.Normal, 'j');
    expect(jAction?.description).toBe('Move cursor down');

    const vAction = registry.getAction(EditMode.Normal, 'v');
    expect(vAction?.description).toBe('Start visual selection');

    const escapeAction = registry.getAction(EditMode.Visual, 'escape');
    expect(escapeAction?.description).toBe('Exit visual mode');
  });

  it('should have placeholder handlers that can be replaced', () => {
    const registry = createDefaultKeybindings();

    const jAction = registry.getAction(EditMode.Normal, 'j');
    expect(typeof jAction?.handler).toBe('function');

    // Handler should be a no-op by default
    expect(() => jAction!.handler({})).not.toThrow();
  });

  it('should create separate instances for each call', () => {
    const registry1 = createDefaultKeybindings();
    const registry2 = createDefaultKeybindings();

    // Should be different instances
    expect(registry1).not.toBe(registry2);

    // But should have same bindings (compare keys and descriptions, not handlers)
    const actions1 = registry1.getActionsForMode(EditMode.Normal);
    const actions2 = registry2.getActionsForMode(EditMode.Normal);
    
    expect(actions1).toHaveLength(actions2.length);
    
    for (let i = 0; i < actions1.length; i++) {
      expect(actions1[i].key).toBe(actions2[i].key);
      expect(actions1[i].description).toBe(actions2[i].description);
      expect(typeof actions1[i].handler).toBe('function');
      expect(typeof actions2[i].handler).toBe('function');
    }
  });
});

describe('Keybinding integration', () => {
  it('should handle complex key sequences', () => {
    const registry = new KeybindingRegistry();

    // Register control keys
    registry.register(EditMode.Normal, 'C-d', {
      key: 'C-d',
      description: 'Page down',
      handler: () => {},
    });

    registry.register(EditMode.Normal, 'C-u', {
      key: 'C-u',
      description: 'Page up',
      handler: () => {},
    });

    // Register special keys
    registry.register(EditMode.Normal, 'escape', {
      key: 'escape',
      description: 'Escape',
      handler: () => {},
    });

    expect(registry.isBound(EditMode.Normal, 'C-d')).toBe(true);
    expect(registry.isBound(EditMode.Normal, 'C-u')).toBe(true);
    expect(registry.isBound(EditMode.Normal, 'escape')).toBe(true);
  });

  it('should support mode-specific keybindings', () => {
    const registry = new KeybindingRegistry();

    // Same key, different actions in different modes
    registry.register(EditMode.Normal, 'j', {
      key: 'j',
      description: 'Move cursor down',
      handler: () => {},
    });

    registry.register(EditMode.Visual, 'j', {
      key: 'j',
      description: 'Extend selection down',
      handler: () => {},
    });

    const normalAction = registry.getAction(EditMode.Normal, 'j');
    const visualAction = registry.getAction(EditMode.Visual, 'j');

    expect(normalAction?.description).toBe('Move cursor down');
    expect(visualAction?.description).toBe('Extend selection down');
  });

  it('should handle async handlers', async () => {
    const registry = new KeybindingRegistry();

    let called = false;
    registry.register(EditMode.Normal, 'x', {
      key: 'x',
      description: 'Async action',
      handler: async () => {
        called = true;
      },
    });

    const action = registry.getAction(EditMode.Normal, 'x');
    expect(action).toBeDefined();

    await action!.handler({});
    expect(called).toBe(true);
  });
});