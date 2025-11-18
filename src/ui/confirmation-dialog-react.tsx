/**
 * ConfirmationDialog React component
 *
 * Displays a modal dialog for confirming operations using flexbox layout
 */

import { CatppuccinMocha } from './theme.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';

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
  if (!visible) return null;

  const terminalSize = useTerminalSize();
  const dialogWidth = 70;
  const maxOperationsDisplay = 11; // Account for title, header, footer, and padding
  const dialogHeight = Math.min(20, operations.length + 8);
  const centerLeft = Math.floor((terminalSize.width - dialogWidth) / 2);
  const centerTop = Math.max(2, Math.floor((terminalSize.height - dialogHeight) / 2));

  return (
    <box
      position="absolute"
      left={centerLeft}
      top={centerTop}
      width={dialogWidth}
      height={dialogHeight}
      borderStyle="rounded"
      borderColor={CatppuccinMocha.yellow}
      backgroundColor={CatppuccinMocha.base}
      title={title}
      flexDirection="column"
      paddingLeft={2}
      paddingTop={1}
      paddingBottom={1}
    >
      <text fg={CatppuccinMocha.text} width={66}>
        The following operations will be performed:
      </text>

      {operations.slice(0, maxOperationsDisplay).map(op => (
        <text
          key={op.id}
          fg={op.type === 'delete' ? CatppuccinMocha.red : CatppuccinMocha.green}
          width={64}
        >
          • {formatOperation(op, 60)}
        </text>
      ))}

      {operations.length > maxOperationsDisplay && (
        <text fg={CatppuccinMocha.overlay0} width={66}>
          ... and {operations.length - maxOperationsDisplay} more
        </text>
      )}

      <text fg={CatppuccinMocha.overlay0} width={66}>
        Press y to confirm, n to cancel
      </text>
    </box>
  );
}
