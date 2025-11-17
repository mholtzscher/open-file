/**
 * PreviewPane React component
 *
 * Displays a preview of the currently selected file
 */

import { CatppuccinMocha } from './theme.js';

export interface PreviewPaneProps {
  content?: string;
  visible?: boolean;
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: number;
}

/**
 * PreviewPane React component
 */
export function PreviewPane({
  content = '',
  visible = true,
  flexGrow = 1,
  flexShrink = 1,
  flexBasis = 0,
}: PreviewPaneProps) {
  if (!visible || !content) return null;

  const lines = content.split('\n');
  const totalLines = lines.length;

  return (
    <box
      flexGrow={flexGrow}
      flexShrink={flexShrink}
      flexBasis={flexBasis}
      borderStyle="rounded"
      borderColor={CatppuccinMocha.blue}
      title={`Preview (${totalLines} lines)`}
      flexDirection="column"
      paddingLeft={1}
      paddingRight={1}
      overflow="hidden"
    >
      {lines.map((line, idx) => (
        <text key={idx} fg={CatppuccinMocha.text}>
          {line}
        </text>
      ))}
    </box>
  );
}
