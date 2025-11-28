/**
 * ConfirmationDialog React component
 *
 * Displays a modal dialog for confirming operations using flexbox layout
 */

import { CatppuccinMocha } from '../theme.js';
import { BaseDialog, getContentWidth } from './base.js';

export interface Operation {
  id: string;
  type: 'create' | 'delete' | 'move' | 'copy' | 'download' | 'upload';
  path?: string;
  source?: string;
  destination?: string;
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
    default:
      text = `Unknown: ${op.path || 'unknown'}`;
  }
  // Truncate if needed, without the > character
  if (text.length > maxWidth) {
    return text.substring(0, maxWidth - 1);
  }
  return text;
}

const DIALOG_WIDTH = 70;
const MAX_OPERATIONS_DISPLAY = 11;

/**
 * ConfirmationDialog React component
 */
export function ConfirmationDialog({
  title = 'Confirm Operation',
  operations = [],
  visible = true,
}: ConfirmationDialogProps) {
  const dialogHeight = Math.min(20, operations.length + 8);
  const contentWidth = getContentWidth(DIALOG_WIDTH);

  return (
    <BaseDialog
      visible={visible}
      title={title}
      width={DIALOG_WIDTH}
      height={dialogHeight}
      borderColor={CatppuccinMocha.yellow}
    >
      <box flexDirection="column">
        <text fg={CatppuccinMocha.text} width={contentWidth}>
          The following operations will be performed:
        </text>

        {operations.slice(0, MAX_OPERATIONS_DISPLAY).map(op => (
          <text
            key={op.id}
            fg={op.type === 'delete' ? CatppuccinMocha.red : CatppuccinMocha.green}
            width={contentWidth - 2}
          >
            • {formatOperation(op, 60)}
          </text>
        ))}

        {operations.length > MAX_OPERATIONS_DISPLAY && (
          <text fg={CatppuccinMocha.overlay0} width={contentWidth}>
            ... and {operations.length - MAX_OPERATIONS_DISPLAY} more
          </text>
        )}

        <text fg={CatppuccinMocha.overlay0} width={contentWidth}>
          Press y to confirm, n to cancel
        </text>
      </box>
    </BaseDialog>
  );
}
