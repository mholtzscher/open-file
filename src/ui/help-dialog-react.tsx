/**
 * HelpDialog React component
 *
 * Displays comprehensive help dialog with keybindings
 */

import { FloatingWindow } from './floating-window-react.js';
import { CatppuccinMocha } from './theme.js';

interface KeybindingProps {
  keys: string | string[];
  description: string;
}

interface HelpDialogProps {
  visible: boolean;
}

/**
 * Keybinding component - formats a keybinding with its description
 */
function Keybinding({ keys, description }: KeybindingProps) {
  const keyText = Array.isArray(keys) ? keys.join('/') : keys;
  // Pad key to 10 chars for alignment
  const paddedKey = `  ${keyText}`.padEnd(12);
  return `${paddedKey}${description}`;
}

/**
 * HelpDialog component - displays all keybindings
 */
export function HelpDialog({ visible }: HelpDialogProps) {
  const keybindings = [
    { section: 'NAVIGATION' },
    { keys: 'j/k', description: 'Move cursor down/up' },
    { keys: 'gg/G', description: 'Go to top/bottom' },
    { keys: 'Ctrl+N/P', description: 'Page down/up' },
    { keys: 'h/-', description: 'Navigate to parent' },
    { keys: 'l/Enter', description: 'Open directory/bucket' },
    { section: '' },
    { section: 'SELECTION & EDIT' },
    { keys: 'v', description: 'Visual selection mode' },
    { keys: 'i', description: 'Insert (create entry)' },
    { keys: 'a', description: 'Edit (rename entry)' },
    { keys: 'ESC', description: 'Exit mode' },
    { section: '' },
    { section: 'OPERATIONS' },
    { keys: 'dd', description: 'Delete' },
    { keys: 'yy', description: 'Copy' },
    { keys: 'p', description: 'Paste' },
    { keys: 'w', description: 'Save changes' },
    { section: '' },
    { section: 'SEARCH & COMMANDS' },
    { keys: '/', description: 'Search mode' },
    { keys: 'n/N', description: 'Next/prev match' },
    { keys: ':', description: 'Command mode' },
    { section: '' },
    { keys: '?/g?', description: 'Toggle help  |  q  Quit' },
  ];

  const content = keybindings.map(item => {
    if ('section' in item && item.section !== undefined) {
      return item.section;
    }
    if ('keys' in item && 'description' in item) {
      return Keybinding({ keys: item.keys, description: item.description });
    }
    return '';
  });

  return (
    <FloatingWindow
      title="Help"
      width={70}
      height={23}
      left={5}
      top={1}
      borderColor={CatppuccinMocha.yellow}
      textColor={CatppuccinMocha.text}
      visible={visible}
      content={content}
    />
  );
}
