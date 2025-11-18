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
  let lines: Array<{ segments: Array<{ text: string; color?: string }> }>;
  if (filename) {
    lines = highlightCode(content, filename);
  } else {
    lines = content.split('\n').map(text => ({ segments: [{ text }] }));
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
      {lines.map((line, lineIdx) => (
        <box key={lineIdx} flexDirection="row">
          {line.segments.map((segment, segIdx) => (
            <text key={segIdx} fg={segment.color || CatppuccinMocha.text}>
              {segment.text}
            </text>
          ))}
        </box>
      ))}
    </box>
  );
}
