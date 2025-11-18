/**
 * ProgressWindow React component
 *
 * Displays progress for long-running S3 operations with progress bar and cancellation
 */

import { CatppuccinMocha } from './theme.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';

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
  onCancel,
  canCancel = true,
}: ProgressWindowProps) {
  if (!visible) return null;

  const terminalSize = useTerminalSize();
  const windowWidth = Math.min(70, terminalSize.width - 4);
  const windowHeight = 12;
  const centerLeft = Math.floor((terminalSize.width - windowWidth) / 2);
  const centerTop = Math.max(2, Math.floor((terminalSize.height - windowHeight) / 2));

  // Clamp progress to 0-100
  const clampedProgress = Math.max(0, Math.min(100, progress));
  const progressBar = createProgressBar(clampedProgress, Math.max(20, windowWidth - 10));

  // Format file info if available
  const fileInfo = currentFileNumber && totalFiles ? `[${currentFileNumber}/${totalFiles}] ` : '';

  return (
    <>
      {/* Background overlay to block content behind */}
      <box
        position="absolute"
        left={centerLeft}
        top={centerTop}
        width={windowWidth}
        height={windowHeight}
        backgroundColor={CatppuccinMocha.base}
        zIndex={999}
      />

      {/* Progress window with border */}
      <box
        position="absolute"
        left={centerLeft}
        top={centerTop}
        width={windowWidth}
        height={windowHeight}
        borderStyle="rounded"
        borderColor={CatppuccinMocha.blue}
        title={title}
        flexDirection="column"
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
        zIndex={1000}
      >
        {/* Description */}
        <text fg={CatppuccinMocha.text} width={Math.max(20, windowWidth - 6)}>
          {description.substring(0, Math.max(20, windowWidth - 6))}
        </text>

        {/* Current file info */}
        {currentFile && (
          <text fg={CatppuccinMocha.subtext0} width={Math.max(20, windowWidth - 6)}>
            {(fileInfo + currentFile).substring(0, Math.max(20, windowWidth - 6))}
          </text>
        )}

        {/* Progress bar */}
        <text fg={CatppuccinMocha.sky} width={Math.max(20, windowWidth - 6)}>
          {progressBar}
        </text>

        {/* Progress percentage */}
        <text fg={CatppuccinMocha.yellow} width={Math.max(20, windowWidth - 6)}>
          {clampedProgress}% complete
        </text>

        {/* Cancellation hint */}
        <text fg={CatppuccinMocha.overlay0} width={Math.max(20, windowWidth - 6)}>
          Press Ctrl+C to cancel
        </text>
      </box>
    </>
  );
}
