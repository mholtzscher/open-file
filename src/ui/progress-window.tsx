/**
 * ProgressWindow React component
 *
 * Displays progress for long-running S3 operations with progress bar and cancellation
 */

import { Theme } from './theme.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import { BaseDialog, getContentWidth } from './dialog/base.js';
import { HelpBar } from './help-bar.js';

export interface ProgressWindowProps {
  visible?: boolean;
  title?: string;
  description?: string;
  progress?: number; // 0-100
  currentFile?: string;
  totalFiles?: number;
  currentFileNumber?: number;
  onCancel?: () => void;
  canCancel?: boolean;
}

const WINDOW_HEIGHT = 12;

/**
 * Create a progress bar string
 */
function createProgressBar(progress: number, width: number = 50): string {
  const filled = Math.round((progress / 100) * width);
  const empty = width - filled;
  return '[' + '='.repeat(filled) + ' '.repeat(empty) + ']';
}

/**
 * ProgressWindow React component
 */
export function ProgressWindow({
  visible = true,
  title = 'Operation in Progress',
  description = 'Processing...',
  progress = 0,
  currentFile = '',
  totalFiles = 0,
  currentFileNumber = 0,
}: ProgressWindowProps) {
  const terminalSize = useTerminalSize();
  const windowWidth = Math.min(70, terminalSize.width - 4);
  const contentWidth = getContentWidth(windowWidth);

  // Clamp progress to 0-100
  const clampedProgress = Math.max(0, Math.min(100, progress));
  const progressBar = createProgressBar(clampedProgress, Math.max(20, windowWidth - 10));

  // Format file info if available
  const fileInfo = currentFileNumber && totalFiles ? `[${currentFileNumber}/${totalFiles}] ` : '';

  return (
    <BaseDialog
      visible={visible}
      title={title}
      width={windowWidth}
      height={WINDOW_HEIGHT}
      borderColor={Theme.getInfoColor()}
    >
      <text fg={Theme.getTextColor()} width={contentWidth}>
        {description.substring(0, contentWidth)}
      </text>

      {currentFile && (
        <text fg={Theme.getMutedColor()} width={contentWidth}>
          {(fileInfo + currentFile).substring(0, contentWidth)}
        </text>
      )}

      <text fg={Theme.getSearchModeColor()} width={contentWidth}>
        {progressBar}
      </text>

      <text fg={Theme.getWarningColor()} width={contentWidth}>
        {clampedProgress}% complete
      </text>

      <HelpBar items={[{ key: 'Ctrl+C', description: 'cancel' }]} />
    </BaseDialog>
  );
}
