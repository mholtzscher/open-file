/**
 * ErrorDialog React component
 * Floating dialog displaying an error message.
 * Handles its own dismissal via Escape key.
 */

import { useCallback } from 'react';
import { useKeyboardHandler, KeyboardPriority } from '../../contexts/KeyboardContext.js';
import { CatppuccinMocha } from '../theme.js';
import { BaseDialog, getContentWidth } from './base.js';

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

  useKeyboardHandler(handleKey, [handleKey], KeyboardPriority.High);

  return (
    <BaseDialog visible={visible} title="Error" borderColor={CatppuccinMocha.red}>
      <text fg={CatppuccinMocha.red} width={contentWidth}>
        {message}
      </text>
      <text fg={CatppuccinMocha.overlay0} width={contentWidth}>
        Press Escape to dismiss
      </text>
    </BaseDialog>
  );
}
