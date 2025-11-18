/**
 * PreviewPane React component
 *
 * Displays a preview of the currently selected file
 */

import { CatppuccinMocha, Theme } from './theme.js';
import { highlightCode } from '../utils/syntax-highlighting.js';

export interface PreviewPaneProps {
  content?: string;
  filename?: string;
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
  filename = '',
  visible = true,
  flexGrow = 1,
  flexShrink = 1,
  flexBasis = 0,
}: PreviewPaneProps) {
  if (!visible) return null;

  // If no content, show empty indicator
  if (!content) {
    return (
      <box
        flexGrow={flexGrow}
        flexShrink={flexShrink}
        flexBasis={flexBasis}
        borderStyle="rounded"
        borderColor={CatppuccinMocha.blue}
        title="Preview (0 lines)"
        flexDirection="column"
        paddingLeft={1}
        paddingRight={1}
        overflow="hidden"
      >
        <text fg={Theme.getEmptyStateColor()}>&lt;empty&gt;</text>
      </box>
    );
  }

  // Apply syntax highlighting if filename is available
  let lines: Array<{ text: string; color?: string }>;
  if (filename) {
    lines = highlightCode(content, filename);
  } else {
    lines = content.split('\n').map(text => ({ text }));
  }

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
        <text key={idx} fg={line.color || CatppuccinMocha.text}>
          {line.text}
        </text>
      ))}
    </box>
  );
}
