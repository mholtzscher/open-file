/**
 * StatusBar React component
 *
 * Displays current path, mode, and status messages at the bottom of the screen
 */

import { EditMode } from '../types/edit-mode.js';
import { Theme } from './theme.js';
import { HelpBar, type HelpItem } from './help-bar.js';

interface StatusBarProps {
  path: string;
  mode: EditMode;
  message?: string;
  messageColor?: string;
  searchQuery?: string;
  commandBuffer?: string;
  bucket?: string;
}

/**
 * Get mode string
 */
function getModeString(mode: EditMode): string {
  switch (mode) {
    case EditMode.Normal:
      return 'NORMAL';
    case EditMode.Visual:
      return 'VISUAL';
    case EditMode.Edit:
      return 'EDIT';
    case EditMode.Insert:
      return 'INSERT';
    case EditMode.Search:
      return 'SEARCH';
    case EditMode.Command:
      return 'COMMAND';
    default:
      return 'UNKNOWN';
  }
}

/**
 * Format breadcrumb path showing current location
 * - If no bucket: shows "Buckets (root)"
 * - If bucket with no path: shows "bucket-name/"
 * - If bucket with path: shows "bucket-name/path/to/dir"
 */
function formatBreadcrumb(bucket: string | undefined, path: string): string {
  if (!bucket) {
    return 'Buckets (root)';
  }

  // Build the full path with bucket name
  const fullPath = path ? `${bucket}/${path}` : `${bucket}/`;
  return fullPath;
}

/**
 * StatusBar React component
 */
export function StatusBar({
  path,
  mode,
  message,
  messageColor = Theme.getMutedColor(),
  searchQuery = '',
  commandBuffer = '',
  bucket,
}: StatusBarProps) {
  // Left side: path and mode
  const breadcrumb = formatBreadcrumb(bucket, path);
  const pathText = `📂 ${breadcrumb}`;
  const modeText = `[${getModeString(mode)}]`;
  const searchText = mode === EditMode.Search ? ` /${searchQuery}` : '';
  const editText = mode === EditMode.Edit ? ` ${commandBuffer}` : '';
  const commandText = mode === EditMode.Command ? ` ${commandBuffer}` : '';
  const leftContent = `${pathText} ${modeText}${searchText}${editText}${commandText}`;

  // Right side: message or help bar
  const searchHelpItems: HelpItem[] = [
    { key: 'Enter', description: 'confirm' },
    { key: 'Esc', description: 'clear' },
  ];

  const editHelpItems: HelpItem[] = [
    { key: 'Enter', description: 'confirm' },
    { key: 'Esc', description: 'cancel' },
  ];

  const normalHelpItems: HelpItem[] = [
    { key: 'j/k', description: 'nav' },
    { key: 'v', description: 'select' },
    { key: 'i', description: 'insert' },
    { key: 'dd', description: 'delete' },
    { key: 'p', description: 'paste' },
    { key: 'Ctrl+N/P', description: 'page' },
    { key: '?', description: 'help' },
  ];

  // Determine which help items to show based on mode
  let helpItems: HelpItem[];
  if (mode === EditMode.Search) {
    helpItems = searchHelpItems;
  } else if (mode === EditMode.Edit) {
    helpItems = editHelpItems;
  } else {
    helpItems = normalHelpItems;
  }

  // Render as a flex row status bar
  return (
    <box
      flexDirection="row"
      width="100%"
      justifyContent="space-between"
      paddingLeft={2}
      paddingRight={2}
    >
      <text fg={Theme.getWarningColor()}>{leftContent}</text>
      <box flexDirection="row" gap={2}>
        {message && <text fg={messageColor}>{message}</text>}
        <HelpBar items={helpItems} />
      </box>
    </box>
  );
}
