/**
 * QuitDialog React component
 *
 * Displays a modal dialog warning about unsaved changes when quitting
 */

import { useCallback } from 'react';
import { useKeyboardHandler, KeyboardPriority } from '../../contexts/KeyboardContext.js';
import { CatppuccinMocha } from '../theme.js';
import { BaseDialog } from './base.js';

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

  useKeyboardHandler(handleKey, [handleKey], KeyboardPriority.High);

  const changeText = pendingChanges === 1 ? 'change' : 'changes';

  return (
    <BaseDialog visible={visible} title="Unsaved Changes" borderColor={CatppuccinMocha.yellow}>
      <text fg={CatppuccinMocha.yellow}>{`You have ${pendingChanges} unsaved ${changeText}.`}</text>

      <text fg={CatppuccinMocha.text}> </text>

      <text fg={CatppuccinMocha.green}>{'q - Quit without saving'}</text>

      <text fg={CatppuccinMocha.blue}>{'w - Save changes first'}</text>

      <text fg={CatppuccinMocha.overlay0}>{'n/Esc - Cancel'}</text>
    </BaseDialog>
  );
}
