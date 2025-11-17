/**
 * ErrorDialog React component
 * Floating dialog displaying an error message.
 * Dismissible via Enter (handled by parent keyboard flow).
 */

import { CatppuccinMocha } from './theme.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';

interface ErrorDialogProps {
  visible: boolean;
  message: string;
}

export function ErrorDialog({ visible, message }: ErrorDialogProps) {
  if (!visible) return null;

  // Use terminal size if available, otherwise use defaults
  let terminalWidth = 80;
  try {
    const terminalSize = useTerminalSize();
    terminalWidth = terminalSize.width;
  } catch {
    // Fallback for test environments where hooks aren't available
    terminalWidth = 80;
  }

  const width = 70;
  const left = Math.max(2, Math.floor((terminalWidth - width) / 2));
  const top = 1;

  return (
    <box
      position="absolute"
      left={left}
      top={top}
      width={width}
      height={6}
      borderStyle="rounded"
      borderColor={CatppuccinMocha.red}
      backgroundColor={CatppuccinMocha.base}
      title="Error"
    >
      <text position="absolute" left={2} top={1} fg={CatppuccinMocha.red}>
        {message}
      </text>
      <text position="absolute" left={2} bottom={1} fg={CatppuccinMocha.overlay0}>
        Press Enter to dismiss
      </text>
    </box>
  );
}
