/**
 * QuitDialog React component
 *
 * Displays a modal dialog warning about unsaved changes when quitting
 */

import { useKeyboard } from '@opentui/solid';
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
  useKeyboard(evt => {
    if (!visible) return;

    if (evt.name === 'q') {
      onQuitWithoutSave?.();
      return;
    }

    if (evt.name === 'w') {
      onSaveAndQuit?.();
      return;
    }

    if (evt.name === 'escape') {
      onCancel?.();
    }
  });

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
          { key: 'Esc', description: 'cancel' },
        ]}
      />
    </BaseDialog>
  );
}
