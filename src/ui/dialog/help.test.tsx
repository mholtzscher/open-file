/**
 * HelpDialog tests
 */

import { describe, it, expect } from 'bun:test';
import { testRender } from '@opentui/react/test-utils';
import { KeyboardProvider } from '../../contexts/KeyboardContext.js';
import { HelpDialog } from './help.js';

// HelpDialog has many keybindings, so we need a tall terminal
const TERMINAL_WIDTH = 80;
const TERMINAL_HEIGHT = 50;

const WrappedHelpDialog = (props: any) => (
  <KeyboardProvider>
    <HelpDialog {...props} />
  </KeyboardProvider>
);

describe('HelpDialog', () => {
  describe('visibility', () => {
    it('renders when visible is true', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedHelpDialog visible={true} />,
        {
          width: TERMINAL_WIDTH,
          height: TERMINAL_HEIGHT,
        }
      );
      await renderOnce();

      const frame = captureCharFrame();
      // Check for content that appears in the middle of the dialog
      expect(frame).toContain('OPERATIONS');
    });

    it('renders nothing when visible is false', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedHelpDialog visible={false} />,
        {
          width: TERMINAL_WIDTH,
          height: TERMINAL_HEIGHT,
        }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).not.toContain('OPERATIONS');
      expect(frame).not.toContain('NAVIGATION');
    });
  });

  describe('sections', () => {
    it('displays SELECTION & EDIT section', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedHelpDialog visible={true} />,
        {
          width: TERMINAL_WIDTH,
          height: TERMINAL_HEIGHT,
        }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('SELECTION');
    });

    it('displays OPERATIONS section', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedHelpDialog visible={true} />,
        {
          width: TERMINAL_WIDTH,
          height: TERMINAL_HEIGHT,
        }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('OPERATIONS');
    });

    it('displays OTHER section', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedHelpDialog visible={true} />,
        {
          width: TERMINAL_WIDTH,
          height: TERMINAL_HEIGHT,
        }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('OTHER');
    });

    it('displays SEARCH & COMMANDS section', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedHelpDialog visible={true} />,
        {
          width: TERMINAL_WIDTH,
          height: TERMINAL_HEIGHT,
        }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('SEARCH');
    });
  });

  describe('keybindings', () => {
    it('displays operation keybindings', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedHelpDialog visible={true} />,
        {
          width: TERMINAL_WIDTH,
          height: TERMINAL_HEIGHT,
        }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('dd');
      expect(frame).toContain('Delete');
    });

    it('displays copy/paste keybindings', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedHelpDialog visible={true} />,
        {
          width: TERMINAL_WIDTH,
          height: TERMINAL_HEIGHT,
        }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('yy');
      expect(frame).toContain('Copy');
      expect(frame).toContain('Paste');
    });

    it('displays search keybinding', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedHelpDialog visible={true} />,
        {
          width: TERMINAL_WIDTH,
          height: TERMINAL_HEIGHT,
        }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('Search mode');
    });

    it('displays visual selection keybinding', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedHelpDialog visible={true} />,
        {
          width: TERMINAL_WIDTH,
          height: TERMINAL_HEIGHT,
        }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('Visual selection');
    });

    it('displays download/upload keybindings', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedHelpDialog visible={true} />,
        {
          width: TERMINAL_WIDTH,
          height: TERMINAL_HEIGHT,
        }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('Download');
      expect(frame).toContain('Upload');
    });
  });

  describe('exports', () => {
    it('exports HelpDialog component', async () => {
      const module = await import('./help.js');
      expect(module.HelpDialog).toBeDefined();
      expect(typeof module.HelpDialog).toBe('function');
    });
  });
});
