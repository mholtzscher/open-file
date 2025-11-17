/**
 * HelpDialog React component
 *
 * Displays comprehensive help dialog with keybindings using absolute positioning
 */

import { CatppuccinMocha } from './theme.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';

interface KeybindingItem {
  keys: string;
  description: string;
}

interface SectionItem {
  section: string;
}

type HelpItem = KeybindingItem | SectionItem;

interface HelpDialogProps {
  visible: boolean;
}

/**
 * HelpDialog component - displays all keybindings with absolute positioning
 */
export function HelpDialog({ visible }: HelpDialogProps) {
  if (!visible) return null;

  const terminalSize = useTerminalSize();
  const dialogWidth = 70;
  const centerLeft = Math.floor((terminalSize.width - dialogWidth) / 2);

  const keybindings: HelpItem[] = [
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

  return (
    <box
      position="absolute"
      left={centerLeft}
      top={1}
      width={dialogWidth}
      borderStyle="rounded"
      borderColor={CatppuccinMocha.yellow}
      backgroundColor={CatppuccinMocha.base}
      title="Help"
      flexDirection="column"
      paddingLeft={2}
      paddingTop={1}
      paddingBottom={1}
    >
      {keybindings.map((item, idx) => {
        if ('section' in item) {
          return (
            <text key={idx} fg={CatppuccinMocha.text} width={66}>
              {item.section}
            </text>
          );
        }
        const keyText = `  ${item.keys}`.padEnd(12);
        const fullText = `${keyText}${item.description}`;
        return (
          <text key={idx} fg={CatppuccinMocha.subtext0} width={66}>
            {fullText}
          </text>
        );
      })}
    </box>
  );
}
