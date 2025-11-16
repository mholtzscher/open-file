/**
 * FloatingWindow React component
 * 
 * Renders a floating dialog box with border and title
 */

import { CatppuccinMocha } from './theme.js';

export interface FloatingWindowProps {
  title?: string;
  width?: number;
  height?: number;
  left?: number;
  top?: number;
  borderColor?: string;
  backgroundColor?: string;
  textColor?: string;
  content?: string[];
  visible?: boolean;
}

/**
 * FloatingWindow React component
 */
export function FloatingWindow({
  title = 'Dialog',
  width = 60,
  height = 20,
  left,
  top,
  borderColor = CatppuccinMocha.blue,
  backgroundColor = CatppuccinMocha.base,
  textColor = CatppuccinMocha.text,
  content = [],
  visible = true,
}: FloatingWindowProps) {
  if (!visible) return null;

  // Calculate centered position if not specified
  const calcLeft = left ?? Math.max(2, Math.floor((80 - width) / 2));
  const calcTop = top ?? Math.max(2, Math.floor((24 - height) / 2));

  return (
    <box
      position="absolute"
      left={calcLeft}
      top={calcTop}
      width={width}
      height={height}
      borderStyle="rounded"
      borderColor={borderColor}
      backgroundColor={backgroundColor}
      title={title}
    >
      {content.map((line, idx) => (
        <text
          key={idx}
          position="absolute"
          left={2}
          top={2 + idx}
          fg={textColor}
        >
          {line}
        </text>
      ))}
    </box>
  );
}
