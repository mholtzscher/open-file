/**
 * HelpDialog React component
 *
 * Displays comprehensive help dialog with keybindings using absolute positioning
 */

import { CatppuccinMocha } from './theme.js';
import { BaseDialog, getContentWidth } from './base-dialog.js';

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

const DIALOG_WIDTH = 70;

const keybindings: HelpItem[] = [
  { section: 'NAVIGATION' },
  { keys: 'j/k', description: 'Move cursor down/up' },
  { keys: 'gg/G', description: 'Go to top/bottom' },
  { keys: 'Ctrl+N/P', description: 'Page down/up' },
  { keys: 'h/-', description: 'Navigate to parent / Close preview' },
  { keys: 'l/Enter', description: 'Open directory/file preview' },
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
  { keys: 'D', description: 'Download to local' },
  { keys: 'U', description: 'Upload from local' },
  { keys: 'w', description: 'Save changes' },
  { section: '' },
  { section: 'SEARCH & COMMANDS' },
  { keys: '/', description: 'Search mode' },
  { keys: 'n/N', description: 'Next/prev match' },
  { keys: ':', description: 'Command mode' },
  { section: '' },
  { section: 'OTHER' },
  { keys: 'o', description: 'Sort menu' },
  { keys: '?/g?/q', description: 'Toggle/close help' },
  { keys: 'q', description: 'Quit' },
];

/**
 * HelpDialog component - displays all keybindings with absolute positioning
 */
export function HelpDialog({ visible }: HelpDialogProps) {
  const dialogHeight = keybindings.length + 4; // Add padding for border and title
  const contentWidth = getContentWidth(DIALOG_WIDTH);

  return (
    <BaseDialog
      visible={visible}
      title="Help"
      width={DIALOG_WIDTH}
      height={dialogHeight}
      borderColor={CatppuccinMocha.yellow}
    >
      <box flexDirection="column">
        {keybindings.map((item, idx) => {
          if ('section' in item) {
            return (
              <text key={idx} fg={CatppuccinMocha.text} width={contentWidth}>
                {item.section}
              </text>
            );
          }
          const keyText = `  ${item.keys}`.padEnd(12);
          const fullText = `${keyText}${item.description}`;
          return (
            <text key={idx} fg={CatppuccinMocha.subtext0} width={contentWidth}>
              {fullText}
            </text>
          );
        })}
      </box>
    </BaseDialog>
  );
}
