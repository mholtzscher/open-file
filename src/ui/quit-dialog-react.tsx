/**
 * QuitDialog React component
 *
 * Displays a modal dialog warning about unsaved changes when quitting
 */

import { CatppuccinMocha } from './theme.js';
import { BaseDialog, getContentWidth } from './base-dialog-react.js';

export interface QuitDialogProps {
  pendingChanges: number;
  visible?: boolean;
}

const DIALOG_WIDTH = 50;
const DIALOG_HEIGHT = 9;

/**
 * QuitDialog React component
 */
export function QuitDialog({ pendingChanges, visible = true }: QuitDialogProps) {
  const contentWidth = getContentWidth(DIALOG_WIDTH);
  const changeText = pendingChanges === 1 ? 'change' : 'changes';

  return (
    <BaseDialog
      visible={visible}
      title="Unsaved Changes"
      width={DIALOG_WIDTH}
      height={DIALOG_HEIGHT}
      borderColor={CatppuccinMocha.yellow}
    >
      <text fg={CatppuccinMocha.yellow} width={contentWidth}>
        {`You have ${pendingChanges} unsaved ${changeText}.`}
      </text>

      <text fg={CatppuccinMocha.text} width={contentWidth}>
        {' '}
      </text>

      <text fg={CatppuccinMocha.green} width={contentWidth}>
        {'q - Quit without saving'}
      </text>

      <text fg={CatppuccinMocha.blue} width={contentWidth}>
        {'w - Save changes first'}
      </text>

      <text fg={CatppuccinMocha.overlay0} width={contentWidth}>
        {'n/Esc - Cancel'}
      </text>
    </BaseDialog>
  );
}
