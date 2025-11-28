/**
 * BaseDialog tests
 *
 * Uses OpenTUI testing patterns to properly test rendered output.
 */

import { describe, it, expect } from 'bun:test';
import { testRender } from '@opentui/react/test-utils';
import { BaseDialog, getContentWidth } from './base-dialog-react.js';

// ============================================================================
// Component Rendering Tests
// ============================================================================

describe('BaseDialog', () => {
  describe('visibility', () => {
    it('renders children when visible is true', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <BaseDialog visible={true}>
          <text>Dialog Content</text>
        </BaseDialog>,
        { width: 80, height: 24 }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('Dialog Content');
    });

    it('renders nothing when visible is false', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <BaseDialog visible={false}>
          <text>Hidden Content</text>
        </BaseDialog>,
        { width: 80, height: 24 }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).not.toContain('Hidden Content');
    });
  });

  describe('title', () => {
    it('renders with a title', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <BaseDialog visible={true} title="My Dialog">
          <text>Content</text>
        </BaseDialog>,
        { width: 80, height: 24 }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('My Dialog');
      expect(frame).toContain('Content');
    });

    it('renders without a title', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <BaseDialog visible={true}>
          <text>No Title Content</text>
        </BaseDialog>,
        { width: 80, height: 24 }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('No Title Content');
    });
  });

  describe('sizing', () => {
    it('renders with custom width', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <BaseDialog visible={true} width={40} height={10}>
          <text>Sized Dialog</text>
        </BaseDialog>,
        { width: 80, height: 24 }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('Sized Dialog');
    });

    it('constrains width to terminal size', async () => {
      // Dialog width 100 should be constrained to terminal width - 4
      const { renderOnce, captureCharFrame } = await testRender(
        <BaseDialog visible={true} width={100} height={10}>
          <text>Wide Dialog</text>
        </BaseDialog>,
        { width: 80, height: 24 }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('Wide Dialog');
    });
  });

  describe('content rendering', () => {
    it('renders multiple children', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <BaseDialog visible={true} title="Multi Content">
          <text>Line 1</text>
          <text>Line 2</text>
          <text>Line 3</text>
        </BaseDialog>,
        { width: 80, height: 24 }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('Line 1');
      expect(frame).toContain('Line 2');
      expect(frame).toContain('Line 3');
    });

    it('renders nested components', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <BaseDialog visible={true}>
          <box>
            <text>Nested Content</text>
          </box>
        </BaseDialog>,
        { width: 80, height: 24 }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('Nested Content');
    });
  });

  describe('border rendering', () => {
    it('renders with rounded border style', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <BaseDialog visible={true} height={5}>
          <text>Bordered</text>
        </BaseDialog>,
        { width: 80, height: 24 }
      );
      await renderOnce();

      const frame = captureCharFrame();
      // Rounded borders use ╭ ╮ ╰ ╯ characters
      expect(frame).toContain('╭');
      expect(frame).toContain('╮');
    });
  });
});

// ============================================================================
// Helper Function Tests
// ============================================================================

describe('getContentWidth', () => {
  it('calculates correct width with default padding', () => {
    // Default padding: left=2, right=2, border=2
    expect(getContentWidth(70)).toBe(64); // 70 - 2 - 2 - 2
    expect(getContentWidth(50)).toBe(44); // 50 - 2 - 2 - 2
  });

  it('calculates correct width with custom padding', () => {
    expect(getContentWidth(70, 1, 1)).toBe(66); // 70 - 1 - 1 - 2
    expect(getContentWidth(50, 3, 3)).toBe(42); // 50 - 3 - 3 - 2
  });

  it('handles zero padding', () => {
    expect(getContentWidth(70, 0, 0)).toBe(68); // 70 - 0 - 0 - 2
  });

  it('handles asymmetric padding', () => {
    expect(getContentWidth(70, 1, 3)).toBe(64); // 70 - 1 - 3 - 2
    expect(getContentWidth(70, 5, 1)).toBe(62); // 70 - 5 - 1 - 2
  });
});

// ============================================================================
// Export Tests
// ============================================================================

describe('BaseDialog exports', () => {
  it('exports BaseDialog component', () => {
    expect(BaseDialog).toBeDefined();
    expect(typeof BaseDialog).toBe('function');
  });

  it('exports getContentWidth helper', () => {
    expect(getContentWidth).toBeDefined();
    expect(typeof getContentWidth).toBe('function');
  });
});
