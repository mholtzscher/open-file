/**
 * QuitDialog tests
 */

import { describe, it, expect } from 'bun:test';
import { testRender } from '@opentui/react/test-utils';
import { KeyboardProvider } from '../../contexts/KeyboardContext.js';
import { QuitDialog } from './quit.js';

const WrappedQuitDialog = (props: any) => (
  <KeyboardProvider>
    <QuitDialog {...props} />
  </KeyboardProvider>
);

describe('QuitDialog', () => {
  describe('visibility', () => {
    it('renders when visible is true', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedQuitDialog visible={true} pendingChangesCount={3} />,
        { width: 80, height: 24 }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('Unsaved Changes');
    });

    it('renders by default (visible defaults to true)', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedQuitDialog pendingChangesCount={3} />,
        {
          width: 80,
          height: 24,
        }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('Unsaved Changes');
    });

    it('renders nothing when visible is false', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedQuitDialog visible={false} pendingChangesCount={3} />,
        { width: 80, height: 24 }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).not.toContain('Unsaved Changes');
      expect(frame).not.toContain('unsaved');
    });
  });

  describe('pending changes display', () => {
    it('displays singular "change" for 1 pending change', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedQuitDialog visible={true} pendingChangesCount={1} />,
        { width: 80, height: 24 }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('1 unsaved change.');
    });

    it('displays plural "changes" for multiple pending changes', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedQuitDialog visible={true} pendingChangesCount={5} />,
        { width: 80, height: 24 }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('5 unsaved changes.');
    });

    it('displays plural "changes" for 0 pending changes', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedQuitDialog visible={true} pendingChangesCount={0} />,
        { width: 80, height: 24 }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('0 unsaved changes.');
    });
  });

  describe('action options', () => {
    it('displays quit option', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedQuitDialog visible={true} pendingChangesCount={3} />,
        { width: 80, height: 24 }
      );
      await renderOnce();

      const frame = captureCharFrame();
      // Uses standardized HelpBar format
      expect(frame).toContain('q');
      expect(frame).toContain('quit without saving');
    });

    it('displays save option', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedQuitDialog visible={true} pendingChangesCount={3} />,
        { width: 80, height: 24 }
      );
      await renderOnce();

      const frame = captureCharFrame();
      // Uses standardized HelpBar format
      expect(frame).toContain('w');
      expect(frame).toContain('save');
    });

    it('displays cancel option', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedQuitDialog visible={true} pendingChangesCount={3} />,
        { width: 80, height: 30 }
      );
      await renderOnce();

      const frame = captureCharFrame();
      // Uses standardized HelpBar format
      expect(frame).toContain('Esc');
      expect(frame).toContain('cancel');
    });
  });

  describe('exports', () => {
    it('exports QuitDialog component', async () => {
      const module = await import('./quit.js');
      expect(module.QuitDialog).toBeDefined();
      expect(typeof module.QuitDialog).toBe('function');
    });
  });
});
