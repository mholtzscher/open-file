/**
 * QuitDialog React component
 *
 * Displays a modal dialog warning about unsaved changes when quitting
 */

import { useCallback } from 'react';
import { useKeyboardHandler, KeyboardPriority } from '../../contexts/KeyboardContext.js';
import { Theme } from '../theme.js';
import { BaseDialog } from './base.js';
import { HelpBar } from '../help-bar.js';

export interface QuitDialogProps {
  pendingChangesCount: number;
  visible?: boolean;
  onQuitWithoutSave?: () => void;
  onSaveAndQuit?: () => void;
  onCancel?: () => void;
}
/**
 * QuitDialog React component
 */
export function QuitDialog({
  pendingChangesCount: pendingChanges,
  visible = true,
  onQuitWithoutSave,
  onSaveAndQuit,
  onCancel,
}: QuitDialogProps) {
  const handleKey = useCallback<Parameters<typeof useKeyboardHandler>[0]>(
    key => {
      if (!visible) return false;

      if (key.name === 'q') {
        onQuitWithoutSave?.();
        return true;
      }

      if (key.name === 'w') {
        onSaveAndQuit?.();
        return true;
      }

      if (key.name === 'n' || key.name === 'escape') {
        onCancel?.();
        return true;
      }

      return true; // Block all other keys when quit dialog is open
    },
    [visible, onQuitWithoutSave, onSaveAndQuit, onCancel]
  );

  useKeyboardHandler(handleKey, KeyboardPriority.High);

  const changeText = pendingChanges === 1 ? 'change' : 'changes';

  return (
    <BaseDialog visible={visible} title="Unsaved Changes" borderColor={Theme.getWarningColor()}>
      <text
        fg={Theme.getWarningColor()}
      >{`You have ${pendingChanges} unsaved ${changeText}.`}</text>

      <text fg={Theme.getTextColor()}> </text>

      <HelpBar
        items={[
          { key: 'q', description: 'quit without saving' },
          { key: 'w', description: 'save first' },
          { key: 'n/Esc', description: 'cancel' },
        ]}
      />
    </BaseDialog>
  );
}
