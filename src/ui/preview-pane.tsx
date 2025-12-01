/**
 * PreviewPane React component
 *
 * Displays a preview of the currently selected file
 */

import { Theme } from './theme.js';

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
  filename: _filename = '',
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
        borderColor={Theme.getInfoColor()}
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

  const totalLines = content.split('\n').length;

  return (
    <box
      flexGrow={flexGrow}
      flexShrink={flexShrink}
      flexBasis={flexBasis}
      borderStyle="rounded"
      borderColor={Theme.getInfoColor()}
      title={`Preview (${totalLines} lines)`}
      flexDirection="column"
      paddingLeft={1}
      paddingRight={1}
      overflow="hidden"
    >
      <text fg={Theme.getTextColor()}>{content}</text>
    </box>
  );
}
