/**
 * ConfirmationDialog React component
 * 
 * Displays a modal dialog for confirming operations
 */

import { CatppuccinMocha } from './theme.js';

export interface Operation {
  id: string;
  type: 'create' | 'delete' | 'move';
  path: string;
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
 * Format operation for display
 */
function formatOperation(op: Operation): string {
  switch (op.type) {
    case 'create':
      return `Create: ${op.path}`;
    case 'delete':
      return `Delete: ${op.path}`;
    case 'move':
      return `Move: ${op.source} -> ${op.destination}`;
    default:
      return `Unknown: ${op.path}`;
  }
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

  const width = 70;
  const height = Math.min(20, operations.length + 8);
  const left = Math.max(2, Math.floor((80 - width) / 2));
  const top = Math.max(2, Math.floor((24 - height) / 2));

  return (
    <box
      position="absolute"
      left={left}
      top={top}
      width={width}
      height={height}
      borderStyle="rounded"
      borderColor={CatppuccinMocha.yellow}
      backgroundColor={CatppuccinMocha.base}
      title={title}
    >
      <text
        position="absolute"
        left={2}
        top={1}
        fg={CatppuccinMocha.text}
      >
        The following operations will be performed:
      </text>

      {operations.slice(0, height - 6).map((op, idx) => (
        <text
          key={op.id}
          position="absolute"
          left={4}
          top={3 + idx}
          fg={op.type === 'delete' ? CatppuccinMocha.red : CatppuccinMocha.green}
        >
          • {formatOperation(op)}
        </text>
      ))}

      <text
        position="absolute"
        left={2}
        bottom={2}
        fg={CatppuccinMocha.overlay0}
      >
        Press y to confirm, n to cancel
      </text>
    </box>
  );
}
