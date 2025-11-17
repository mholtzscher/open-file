/**
 * StatusBar React component
 *
 * Displays current path, mode, and status messages at the bottom of the screen
 */

import { EditMode } from '../types/edit-mode.js';
import { CatppuccinMocha } from './theme.js';

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
  messageColor = CatppuccinMocha.overlay1,
  searchQuery = '',
  commandBuffer = '',
  bucket,
}: StatusBarProps) {
  // Left side: path and mode
  const breadcrumb = formatBreadcrumb(bucket, path);
  const pathText = `📂 ${breadcrumb}`;
  const modeText = `[${getModeString(mode)}]`;
  const searchText = mode === EditMode.Search ? ` /${searchQuery}` : '';
  const commandText = mode === EditMode.Command ? ` ${commandBuffer}` : '';
  const leftContent = `${pathText} ${modeText}${searchText}${commandText}`;

  // Right side: message or help text
  const helpText =
    mode === EditMode.Search
      ? 'n:next  N:prev  Ctrl+C:toggle-case  Ctrl+R:regex  ESC:exit'
      : 'q:quit  j/k:nav  v:select  i:insert  dd:delete  w:save  p:paste  Ctrl+N/P:page  g?:help';
  const rightContent = message || helpText;

  // Render as a simplified text status bar
  return (
    <>
      <text position="absolute" left={2} bottom={0} fg={CatppuccinMocha.yellow}>
        {leftContent}
      </text>
      <text
        position="absolute"
        right={2}
        bottom={0}
        fg={message ? messageColor : CatppuccinMocha.overlay0}
      >
        {rightContent}
      </text>
    </>
  );
}
