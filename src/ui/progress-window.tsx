/**
 * ProgressWindow React component
 *
 * Displays progress for long-running S3 operations with progress bar and cancellation
 */

import { CatppuccinMocha } from './theme.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import { BaseDialog, getContentWidth } from './base-dialog.js';

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
      borderColor={CatppuccinMocha.blue}
      showOverlay={true}
    >
      {/* Description */}
      <text fg={CatppuccinMocha.text} width={contentWidth}>
        {description.substring(0, contentWidth)}
      </text>

      {/* Current file info */}
      {currentFile && (
        <text fg={CatppuccinMocha.subtext0} width={contentWidth}>
          {(fileInfo + currentFile).substring(0, contentWidth)}
        </text>
      )}

      {/* Progress bar */}
      <text fg={CatppuccinMocha.sky} width={contentWidth}>
        {progressBar}
      </text>

      {/* Progress percentage */}
      <text fg={CatppuccinMocha.yellow} width={contentWidth}>
        {clampedProgress}% complete
      </text>

      {/* Cancellation hint */}
      <text fg={CatppuccinMocha.overlay0} width={contentWidth}>
        Press Ctrl+C to cancel
      </text>
    </BaseDialog>
  );
}
