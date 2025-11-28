/**
 * HelpDialog React component
 *
 * Displays comprehensive help dialog with keybindings using absolute positioning
 */

import { useCallback } from 'react';
import { useKeyboardHandler, KeyboardPriority } from '../../contexts/KeyboardContext.js';
import { CatppuccinMocha } from '../theme.js';
import { BaseDialog } from './base.js';

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
  onClose?: () => void;
}

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
export function HelpDialog({ visible, onClose }: HelpDialogProps) {
  const handleKey = useCallback<Parameters<typeof useKeyboardHandler>[0]>(
    key => {
      if (!visible) return false;

      if (key.name === '?' || key.name === 'escape' || key.name === 'q') {
        onClose?.();
        return true;
      }

      return true; // Block all other keys when help dialog is open
    },
    [visible, onClose]
  );

  useKeyboardHandler(handleKey, [handleKey], KeyboardPriority.High);

  return (
    <BaseDialog visible={visible} title="Help" borderColor={CatppuccinMocha.yellow}>
      <box flexDirection="column">
        {keybindings.map((item, idx) => {
          if ('section' in item) {
            return (
              <text key={idx} fg={CatppuccinMocha.text}>
                {item.section}
              </text>
            );
          }
          const keyText = `  ${item.keys}`.padEnd(12);
          const fullText = `${keyText}${item.description}`;
          return (
            <text key={idx} fg={CatppuccinMocha.subtext0}>
              {fullText}
            </text>
          );
        })}
      </box>
    </BaseDialog>
  );
}
