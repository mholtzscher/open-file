/**
 * ErrorDialog React component
 * Floating dialog displaying an error message.
 * Dismissible via Enter (handled by parent keyboard flow).
 */

import { CatppuccinMocha } from './theme.js';
import { BaseDialog, getContentWidth } from './base-dialog.js';

interface ErrorDialogProps {
  visible: boolean;
  message: string;
}

const DIALOG_WIDTH = 70;

export function ErrorDialog({ visible, message }: ErrorDialogProps) {
  const contentWidth = getContentWidth(DIALOG_WIDTH);

  return (
    <BaseDialog
      visible={visible}
      title="Error"
      width={DIALOG_WIDTH}
      borderColor={CatppuccinMocha.red}
      top={1}
      paddingRight={0}
    >
      <text fg={CatppuccinMocha.red} width={contentWidth}>
        {message}
      </text>
      <text fg={CatppuccinMocha.overlay0} width={contentWidth}>
        Press Escape to dismiss
      </text>
    </BaseDialog>
  );
}
