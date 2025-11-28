/**
 * QuitDialog React component
 *
 * Displays a modal dialog warning about unsaved changes when quitting
 */

import { CatppuccinMocha } from '../theme.js';
import { BaseDialog } from './base.js';

export interface QuitDialogProps {
  pendingChangesCount: number;
  visible?: boolean;
}
/**
 * QuitDialog React component
 */
export function QuitDialog({
  pendingChangesCount: pendingChanges,
  visible = true,
}: QuitDialogProps) {
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
