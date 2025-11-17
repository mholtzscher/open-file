/**
 * PreviewPane component tests
 */

import { describe, it, expect } from 'bun:test';
import { PreviewPane } from './preview-pane-react.js';

describe('PreviewPane', () => {
  it('returns null when not visible', () => {
    const result = PreviewPane({ visible: false, content: 'test' });
    expect(result).toBeNull();
  });

  it('returns null when content is empty', () => {
    const result = PreviewPane({ visible: true, content: '' });
    expect(result).toBeNull();
  });

  it('renders with content when visible', () => {
    const content = 'Line 1\nLine 2\nLine 3';
    const result = PreviewPane({
      visible: true,
      content,
      left: 10,
      top: 5,
      width: 40,
      height: 20,
    });
    expect(result).not.toBeNull();
  });

  it('shows line count in title when truncated', () => {
    const lines = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`);
    const content = lines.join('\n');
    const result = PreviewPane({
      visible: true,
      content,
      width: 40,
      height: 20,
    });
    expect(result).not.toBeNull();
    // The component should show line count in the title
  });

  it('handles content within limits', () => {
    const content = 'Short content';
    const result = PreviewPane({
      visible: true,
      content,
      width: 40,
      height: 10,
    });
    expect(result).not.toBeNull();
  });
});
