/**
 * ErrorDialog React component
 * Floating dialog displaying an error message.
 * Handles its own dismissal via Escape key.
 */

import { useKeyboard } from '@opentui/solid';
import { Theme } from '../theme.js';
import { BaseDialog, getContentWidth } from './base.js';
import { HelpBar } from '../help-bar.js';

interface ErrorDialogProps {
  visible: boolean;
  message: string;
  onDismiss?: () => void;
}

const DIALOG_WIDTH = 70;

export function ErrorDialog({ visible, message, onDismiss }: ErrorDialogProps) {
  const contentWidth = getContentWidth(DIALOG_WIDTH);

  useKeyboard(evt => {
    if (!visible) return;

    if (evt.name === 'escape') {
      onDismiss?.();
    }
  });

  return (
    <BaseDialog visible={visible} title="Error" borderColor={Theme.getErrorColor()}>
      <text fg={Theme.getErrorColor()} width={contentWidth}>
        {message}
      </text>
      <HelpBar items={[{ key: 'Esc', description: 'dismiss' }]} />
    </BaseDialog>
  );
}
