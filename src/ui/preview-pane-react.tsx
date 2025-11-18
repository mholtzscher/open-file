/**
 * PreviewPane React component
 *
 * Displays a preview of the currently selected file using Tree-sitter syntax highlighting
 */

import { useMemo } from 'react';
import { CatppuccinMocha, Theme } from './theme.js';
import { createTreeSitterStyle, detectTreeSitterFiletype } from '../utils/treesitter-theme.js';

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
  // Create syntax style once (memoized to avoid recreating on every render)
  const syntaxStyle = useMemo(() => createTreeSitterStyle(), []);

  // Detect filetype from filename
  const filetype = useMemo(() => {
    return filename ? detectTreeSitterFiletype(filename) : undefined;
  }, [filename]);

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

  const totalLines = content.split('\n').length;

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
      <code
        content={content}
        filetype={filetype}
        syntaxStyle={syntaxStyle}
        flexGrow={1}
        selectable={true}
        wrapMode="none"
        fg={CatppuccinMocha.text}
      />
    </box>
  );
}
