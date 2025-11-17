/**
 * PreviewPane React component
 *
 * Displays a preview of the currently selected file
 */

import { CatppuccinMocha } from './theme.js';

export interface PreviewPaneProps {
  content?: string;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  visible?: boolean;
}

/**
 * PreviewPane React component
 */
export function PreviewPane({
  content = '',
  left = 60,
  top = 4,
  width = 20,
  height = 20,
  visible = true,
}: PreviewPaneProps) {
  if (!visible || !content) return null;

  const lines = content.split('\n').slice(0, height);

  return (
    <box
      position="absolute"
      left={left}
      top={top}
      width={width}
      height={height}
      borderStyle="rounded"
      borderColor={CatppuccinMocha.blue}
      backgroundColor={CatppuccinMocha.base}
      title="Preview"
    >
      {lines.map((line, idx) => (
        <text key={idx} position="absolute" left={1} top={1 + idx} fg={CatppuccinMocha.text}>
          {line.substring(0, width - 2)}
        </text>
      ))}
    </box>
  );
}
