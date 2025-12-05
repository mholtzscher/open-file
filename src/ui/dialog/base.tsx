/**
 * BaseDialog React component
 *
 * Provides common dialog functionality including:
 * - Automatic centering with terminal size awareness
 * - Consistent border/box styling
 * - Flexible width/height with sensible defaults
 */

import { ReactNode } from 'react';
import { Theme } from '../theme.js';
import { useTerminalSize } from '../../hooks/useTerminalSize.js';

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
  borderColor = Theme.getInfoColor(),
  children,
}: BaseDialogProps) {
  const terminalSize = useTerminalSize();

  if (!visible) return null;

  // Calculate dialog width
  const dialogWidth = Math.min(width, terminalSize.width - 4);

  return (
    <box
      // @ts-expect-error - OpenTUI position prop not yet in types
      position="absolute"
      left={0}
      top={0}
      width={terminalSize.width}
      height={terminalSize.height}
      justifyContent="center"
      alignItems="center"
    >
      <box
        width={dialogWidth}
        height={height}
        borderStyle="rounded"
        borderColor={borderColor}
        backgroundColor={Theme.getBgBase()}
        title={title}
        flexDirection="column"
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
      >
        {children}
      </box>
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
