/**
 * ConfirmationDialog SolidJS component
 *
 * Displays a modal dialog for confirming operations using flexbox layout
 */

import { For, Show } from 'solid-js';
import { useKeyboard } from '@opentui/solid';
import { Theme } from '../theme.js';
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
 * ConfirmationDialog SolidJS component
 */
export function ConfirmationDialog(props: ConfirmationDialogProps) {
  const title = () => props.title ?? 'Confirm Operation';
  const operations = () => props.operations ?? [];
  const visible = () => props.visible ?? true;

  useKeyboard(evt => {
    if (!visible()) return;

    if (evt.name === 'y') {
      props.onConfirm?.();
      return;
    }

    if (evt.name === 'escape') {
      props.onCancel?.();
    }
  });

  return (
    <BaseDialog visible={visible()} title={title()} borderColor={Theme.getWarningColor()}>
      <box flexDirection="column">
        <text fg={Theme.getTextColor()}>The following operations will be performed:</text>

        <For each={operations().slice(0, MAX_OPERATIONS_DISPLAY)}>
          {op => (
            <text fg={op.type === 'delete' ? Theme.getErrorColor() : Theme.getSuccessColor()}>
              {'• '}
              {formatOperation(op, 60)}
            </text>
          )}
        </For>

        <Show when={operations().length > MAX_OPERATIONS_DISPLAY}>
          <text fg={Theme.getDimColor()}>
            ... and {operations().length - MAX_OPERATIONS_DISPLAY} more
          </text>
        </Show>

        <HelpBar
          items={[
            { key: 'y', description: 'confirm' },
            { key: 'Esc', description: 'cancel' },
          ]}
        />
      </box>
    </BaseDialog>
  );
}
