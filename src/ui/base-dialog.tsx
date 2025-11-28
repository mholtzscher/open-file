/**
 * BaseDialog React component
 *
 * Provides common dialog functionality including:
 * - Automatic centering with terminal size awareness
 * - Consistent border/box styling
 * - Flexible width/height with sensible defaults
 */

import { ReactNode } from 'react';
import { CatppuccinMocha } from './theme.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';

export interface BaseDialogProps {
  /** Controls dialog visibility - returns null when false */
  visible: boolean;
  /** Dialog title shown in the border */
  title?: string;
  /** Dialog width (default: 70) */
  width?: number;
  /** Dialog height - auto-calculated if not provided */
  height?: number;
  /** Border color (default: CatppuccinMocha.blue) */
  borderColor?: string;
  /** Dialog content */
  children: ReactNode;
}

/**
 * BaseDialog component - provides consistent dialog styling and positioning
 *
 * @example
 * ```tsx
 * <BaseDialog visible={true} title="My Dialog" width={50}>
 *   <text>Dialog content here</text>
 * </BaseDialog>
 * ```
 */
export function BaseDialog({
  visible,
  title,
  width = 70,
  height,
  borderColor = CatppuccinMocha.blue,
  children,
}: BaseDialogProps) {
  const terminalSize = useTerminalSize();

  if (!visible) return null;

  // Calculate centered position
  const dialogWidth = Math.min(width, terminalSize.width - 4);
  const centerLeft = Math.floor((terminalSize.width - dialogWidth) / 2);

  // Calculate top position - vertically centered if height provided, otherwise top
  const dialogTop =
    height !== undefined ? Math.max(1, Math.floor((terminalSize.height - height) / 2)) : 1;

  return (
    <box
      position="absolute"
      left={centerLeft}
      top={dialogTop}
      width={dialogWidth}
      height={height}
      borderStyle="rounded"
      borderColor={borderColor}
      backgroundColor={CatppuccinMocha.base}
      title={title}
      flexDirection="column"
      paddingLeft={2}
      paddingRight={2}
      paddingTop={1}
      paddingBottom={1}
    >
      {children}
    </box>
  );
}

/**
 * Helper to calculate content width based on dialog width
 * Uses fixed padding of 2 on each side plus 2 for border
 */
export function getContentWidth(dialogWidth: number): number {
  return dialogWidth - 6; // -2 padding left, -2 padding right, -2 for border
}
