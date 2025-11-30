/**
 * ConfirmationDialog React component
 *
 * Displays a modal dialog for confirming operations using flexbox layout
 */

import { useCallback } from 'react';
import { useKeyboardHandler, KeyboardPriority } from '../../contexts/KeyboardContext.js';
import { CatppuccinMocha } from '../theme.js';
import { BaseDialog } from './base.js';
import { HelpBar } from '../help-bar.js';

export interface Operation {
  id: string;
  type: 'create' | 'delete' | 'move' | 'copy' | 'rename' | 'download' | 'upload';
  path?: string;
  source?: string;
  destination?: string;
  newName?: string;
}

export interface ConfirmationDialogProps {
  title?: string;
  operations?: Operation[];
  visible?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
}

/**
 * Get just the filename from a path
 */
function getBasename(path: string): string {
  return path.split('/').pop() || path;
}

/**
 * Format operation for display with truncation
 */
function formatOperation(op: Operation, maxWidth: number = 50): string {
  let text = '';
  switch (op.type) {
    case 'create':
      text = `Create: ${getBasename(op.path!)}`;
      break;
    case 'delete':
      text = `Delete: ${getBasename(op.path!)}`;
      break;
    case 'move':
      text = `Move: ${getBasename(op.source!)} → ${getBasename(op.destination!)}`;
      break;
    case 'copy':
      text = `Copy: ${getBasename(op.source!)} → ${getBasename(op.destination!)}`;
      break;
    case 'download':
      text = `Download: ${getBasename(op.source!)} → ${getBasename(op.destination!)}`;
      break;
    case 'upload':
      text = `Upload: ${getBasename(op.source!)} → ${getBasename(op.destination!)}`;
      break;
    case 'rename':
      text = `Rename: ${getBasename(op.path!)} → ${op.newName}`;
      break;
    default:
      text = `Unknown: ${op.path || 'unknown'}`;
  }
  // Truncate if needed, without the > character
  if (text.length > maxWidth) {
    return text.substring(0, maxWidth - 1);
  }
  return text;
}

const MAX_OPERATIONS_DISPLAY = 15;

/**
 * ConfirmationDialog React component
 */
export function ConfirmationDialog({
  title = 'Confirm Operation',
  operations = [],
  visible = true,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  const handleKey = useCallback<Parameters<typeof useKeyboardHandler>[0]>(
    key => {
      if (!visible) return false;

      if (key.name === 'y') {
        onConfirm?.();
        return true;
      }

      if (key.name === 'n' || key.name === 'escape') {
        onCancel?.();
        return true;
      }

      return true; // Block all other keys when dialog is open
    },
    [visible, onConfirm, onCancel]
  );

  useKeyboardHandler(handleKey, KeyboardPriority.High);

  return (
    <BaseDialog visible={visible} title={title} borderColor={CatppuccinMocha.yellow}>
      <box flexDirection="column">
        <text fg={CatppuccinMocha.text}>The following operations will be performed:</text>

        {operations.slice(0, MAX_OPERATIONS_DISPLAY).map(op => (
          <text key={op.id} fg={op.type === 'delete' ? CatppuccinMocha.red : CatppuccinMocha.green}>
            • {formatOperation(op, 60)}
          </text>
        ))}

        {operations.length > MAX_OPERATIONS_DISPLAY && (
          <text fg={CatppuccinMocha.overlay0}>
            ... and {operations.length - MAX_OPERATIONS_DISPLAY} more
          </text>
        )}

        <HelpBar
          items={[
            { key: 'y', description: 'confirm' },
            { key: 'n/Esc', description: 'cancel' },
          ]}
        />
      </box>
    </BaseDialog>
  );
}
