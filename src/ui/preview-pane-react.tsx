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

  // Reserve space for border (2 chars) and padding (2 chars)
  const maxLineWidth = width - 4;
  const maxLines = height - 2; // Reserve space for top/bottom border

  const lines = content.split('\n').slice(0, maxLines);
  const totalLines = content.split('\n').length;
  const truncated = totalLines > maxLines;

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
      title={truncated ? `Preview (${totalLines} lines)` : 'Preview'}
      flexDirection="column"
      paddingLeft={1}
      paddingTop={1}
    >
      {lines.map((line, idx) => (
        <text key={idx} fg={CatppuccinMocha.text}>
          {line.substring(0, maxLineWidth)}
        </text>
      ))}
    </box>
  );
}
