/**
 * Default Keybindings
 *
 * Maps key combinations to actions for each edit mode.
 * These can be customized by users in the future.
 */

import { EditMode } from '../types/edit-mode.js';
import { KeyAction } from '../types/keyboard.js';

/**
 * Map of key string to action for a specific mode
 * Key format: "ctrl+shift+key" or just "key"
 */
export type ModeKeybindings = Map<string, KeyAction>;

/**
 * Complete keybinding map for all modes
 * Also supports a 'global' pseudo-mode for mode-independent bindings
 */
export type KeybindingMap = Map<EditMode | 'global', ModeKeybindings>;

/**
 * Create the default keybinding map
 */
function createDefaultKeybindings(): KeybindingMap {
  const map: KeybindingMap = new Map();

  // ============================================
  // Global keybindings (work in any mode)
  // ============================================
  const global: ModeKeybindings = new Map([
    ['ctrl+n', 'cursor:pageDown'],
    ['ctrl+p', 'cursor:pageUp'],
    ['ctrl+s', 'buffer:save'],
    ['ctrl+r', 'buffer:redo'],
  ]);
  map.set('global' as EditMode, global);

  // ============================================
  // Normal mode keybindings
  // ============================================
  const normal: ModeKeybindings = new Map([
    // Navigation
    ['j', 'cursor:down'],
    ['k', 'cursor:up'],
    // Note: gg, G handled as sequences in the dispatcher
    // ['g', 'cursor:top'], // Part of gg sequence
    // ['G', 'cursor:bottom'], // Handled as sequence

    // Entry operations
    ['l', 'entry:open'],
    ['return', 'entry:open'],
    ['h', 'entry:back'],
    ['-', 'entry:back'],
    ['backspace', 'entry:back'],
    // Note: dd, yy handled as sequences
    // ['d', 'entry:delete'], // Part of dd sequence
    // ['y', 'entry:copy'], // Part of yy sequence
    ['p', 'entry:paste'],
    ['x', 'entry:cut'],
    ['shift+d', 'entry:download'],
    ['D', 'entry:download'],
    ['shift+u', 'entry:upload'],
    ['U', 'entry:upload'],

    // Mode changes
    ['i', 'mode:insert'],
    ['a', 'mode:edit'],
    ['/', 'mode:search'],
    [':', 'mode:command'],
    ['v', 'mode:visual'],

    // Dialogs
    ['?', 'dialog:help'],
    ['o', 'dialog:sort'],
    ['shift+p', 'dialog:profileSelector'],
    ['P', 'dialog:profileSelector'],

    // Buffer operations
    ['w', 'buffer:save'],
    ['r', 'buffer:refresh'],
    ['u', 'buffer:undo'],

    // Connection operations (for connection-oriented providers)
    ['shift+r', 'connection:reconnect'],
    ['R', 'connection:reconnect'],

    // Application
    ['q', 'app:quit'],
    ['shift+h', 'app:toggleHidden'],
    ['H', 'app:toggleHidden'],

    // Multi-pane (future)
    // ['ctrl+w', 'pane:toggle'],
    // ['tab', 'pane:switch'],
  ]);
  map.set(EditMode.Normal, normal);

  // ============================================
  // Visual mode keybindings
  // ============================================
  const visual: ModeKeybindings = new Map([
    ['escape', 'mode:normal'],
    ['j', 'select:extend:down'],
    ['k', 'select:extend:up'],
    // Note: d in visual mode deletes selection (handled as single key, not dd)
    ['d', 'entry:delete'],
    ['x', 'entry:cut'],
    ['y', 'entry:copy'],
  ]);
  map.set(EditMode.Visual, visual);

  // ============================================
  // Insert mode keybindings
  // Text input is handled specially by the dispatcher
  // ============================================
  const insert: ModeKeybindings = new Map([
    // Most keys handled as text input
    // escape, enter, backspace, tab handled specially
  ]);
  map.set(EditMode.Insert, insert);

  // ============================================
  // Edit mode keybindings (rename)
  // Text input is handled specially by the dispatcher
  // ============================================
  const edit: ModeKeybindings = new Map([
    // Most keys handled as text input
  ]);
  map.set(EditMode.Edit, edit);

  // ============================================
  // Search mode keybindings
  // Text input is handled specially by the dispatcher
  // ============================================
  const search: ModeKeybindings = new Map([
    // Most keys handled as text input
    // n/N for next/prev handled specially in dispatcher
  ]);
  map.set(EditMode.Search, search);

  // ============================================
  // Command mode keybindings
  // Text input is handled specially by the dispatcher
  // ============================================
  const command: ModeKeybindings = new Map([
    // Most keys handled as text input
  ]);
  map.set(EditMode.Command, command);

  return map;
}

/**
 * Default keybindings instance
 */
export const defaultKeybindings = createDefaultKeybindings();

/**
 * Get a description of a keybinding for help text
 */
export const keybindingDescriptions: Partial<Record<KeyAction, string>> = {
  // Navigation
  'cursor:up': 'Move cursor up',
  'cursor:down': 'Move cursor down',
  'cursor:top': 'Go to top (gg)',
  'cursor:bottom': 'Go to bottom (G)',
  'cursor:pageUp': 'Page up',
  'cursor:pageDown': 'Page down',

  // Entry operations
  'entry:open': 'Open directory/file',
  'entry:back': 'Go to parent directory',
  'entry:delete': 'Delete entry (dd)',
  'entry:rename': 'Rename entry',
  'entry:cut': 'Cut entry (x)',
  'entry:copy': 'Copy entry (yy)',
  'entry:paste': 'Paste entry',
  'entry:download': 'Download to local',
  'entry:upload': 'Upload from local',

  // Mode changes
  'mode:insert': 'Create new entry',
  'mode:edit': 'Edit/rename entry',
  'mode:search': 'Search mode',
  'mode:command': 'Command mode',
  'mode:visual': 'Visual selection mode',
  'mode:normal': 'Exit to normal mode',

  // Dialogs
  'dialog:help': 'Show help',
  'dialog:sort': 'Sort menu',
  'dialog:upload': 'Upload dialog',
  'dialog:profileSelector': 'Profile selector',

  // Buffer operations
  'buffer:save': 'Save changes',
  'buffer:refresh': 'Refresh listing',
  'buffer:undo': 'Undo',
  'buffer:redo': 'Redo',

  // Application
  'app:quit': 'Quit',
  'app:toggleHidden': 'Toggle hidden files',

  // Multi-pane
  'pane:toggle': 'Toggle multi-pane',
  'pane:switch': 'Switch panes',

  // Connection
  'connection:reconnect': 'Reconnect to provider',
};
