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
  width?: number;
  terminalWidth?: number;
}

export function ErrorDialog({ visible, message, width: propWidth, terminalWidth: propTerminalWidth }: ErrorDialogProps) {
  if (!visible) return null;

  const terminalSize = useTerminalSize();
  const dialogWidth = propWidth ?? 70;
  const termWidth = propTerminalWidth ?? terminalSize.width;
  const centerLeft = Math.floor((termWidth - dialogWidth) / 2);

  return (
    <box
      position="absolute"
      left={centerLeft}
      top={1}
      width={dialogWidth}
      borderStyle="rounded"
      borderColor={CatppuccinMocha.red}
      backgroundColor={CatppuccinMocha.base}
      title="Error"
      flexDirection="column"
      paddingLeft={2}
      paddingTop={1}
      paddingBottom={1}
    >
      <text fg={CatppuccinMocha.red} width={66}>
        {message}
      </text>
      <text fg={CatppuccinMocha.overlay0} width={66}>
        Press Escape to dismiss
      </text>
    </box>
  );
}
