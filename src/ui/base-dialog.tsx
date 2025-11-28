/**
 * BaseDialog React component
 *
 * Provides common dialog functionality including:
 * - Automatic centering with terminal size awareness
 * - Consistent border/box styling
 * - Optional overlay for blocking content behind
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
  /** Show background overlay to block content behind (default: false) */
  showOverlay?: boolean;
  /** Custom top position - if not provided, dialog is vertically centered */
  top?: number;
  /** z-index for the dialog (default: 1000) */
  zIndex?: number;
  /** Padding on left side (default: 2) */
  paddingLeft?: number;
  /** Padding on right side (default: 2) */
  paddingRight?: number;
  /** Padding on top (default: 1) */
  paddingTop?: number;
  /** Padding on bottom (default: 1) */
  paddingBottom?: number;
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
  showOverlay = false,
  top,
  zIndex = 1000,
  paddingLeft = 2,
  paddingRight = 2,
  paddingTop = 1,
  paddingBottom = 1,
  children,
}: BaseDialogProps) {
  const terminalSize = useTerminalSize();

  if (!visible) return null;

  // Calculate centered position
  const dialogWidth = Math.min(width, terminalSize.width - 4);
  const centerLeft = Math.floor((terminalSize.width - dialogWidth) / 2);

  // Calculate top position - either centered or fixed at provided value
  let dialogTop: number;
  if (top !== undefined) {
    dialogTop = top;
  } else if (height !== undefined) {
    dialogTop = Math.max(1, Math.floor((terminalSize.height - height) / 2));
  } else {
    // Default to top=1 if height is dynamic
    dialogTop = 1;
  }

  const overlayZIndex = zIndex - 1;

  return (
    <>
      {/* Optional solid background layer behind the bordered dialog */}
      {showOverlay && (
        <box
          position="absolute"
          left={centerLeft}
          top={dialogTop}
          width={dialogWidth}
          height={height}
          backgroundColor={CatppuccinMocha.base}
          zIndex={overlayZIndex}
        />
      )}

      {/* Dialog box with border */}
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
        paddingLeft={paddingLeft}
        paddingRight={paddingRight}
        paddingTop={paddingTop}
        paddingBottom={paddingBottom}
        zIndex={zIndex}
      >
        {children}
      </box>
    </>
  );
}

/**
 * Helper to calculate content width based on dialog width and padding
 */
export function getContentWidth(dialogWidth: number, paddingLeft = 2, paddingRight = 2): number {
  return dialogWidth - paddingLeft - paddingRight - 2; // -2 for border
}
