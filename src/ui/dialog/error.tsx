/**
 * ErrorDialog React component
 * Floating dialog displaying an error message.
 * Handles its own dismissal via Escape key.
 */

import { useCallback } from 'react';
import { useKeyboardHandler, KeyboardPriority } from '../../contexts/KeyboardContext.js';
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

  const handleKey = useCallback<Parameters<typeof useKeyboardHandler>[0]>(
    key => {
      if (!visible) return false;

      if (key.name === 'escape') {
        onDismiss?.();
        return true;
      }

      return true; // Block all other keys when error dialog is open
    },
    [visible, onDismiss]
  );

  useKeyboardHandler(handleKey, KeyboardPriority.High);

  return (
    <BaseDialog visible={visible} title="Error" borderColor={Theme.getErrorColor()}>
      <text fg={Theme.getErrorColor()} width={contentWidth}>
        {message}
      </text>
      <HelpBar items={[{ key: 'Esc', description: 'dismiss' }]} />
    </BaseDialog>
  );
}
