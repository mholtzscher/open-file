/**
 * ErrorDialog tests
 */

import { describe, it, expect } from 'bun:test';
import { testRender } from '@opentui/react/test-utils';
import { ErrorDialog } from './error.js';

describe('ErrorDialog', () => {
  describe('visibility', () => {
    it('renders when visible is true', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <ErrorDialog visible={true} message="Something went wrong" />,
        { width: 80, height: 24 }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('Error');
      expect(frame).toContain('Something went wrong');
    });

    it('renders nothing when visible is false', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <ErrorDialog visible={false} message="Hidden error" />,
        { width: 80, height: 24 }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).not.toContain('Error');
      expect(frame).not.toContain('Hidden error');
    });
  });

  describe('content', () => {
    it('displays the error message', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <ErrorDialog visible={true} message="Connection failed" />,
        { width: 80, height: 24 }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('Connection failed');
    });

    it('displays dismiss instructions', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <ErrorDialog visible={true} message="Test error" />,
        { width: 80, height: 24 }
      );
      await renderOnce();

      const frame = captureCharFrame();
      // Uses standardized HelpBar format: "Esc dismiss"
      expect(frame).toContain('Esc');
      expect(frame).toContain('dismiss');
    });

    it('displays the Error title', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <ErrorDialog visible={true} message="Test error" />,
        { width: 80, height: 24 }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('Error');
    });
  });

  describe('message handling', () => {
    it('handles empty message', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <ErrorDialog visible={true} message="" />,
        { width: 80, height: 24 }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('Error');
      // Uses standardized HelpBar format: "Esc dismiss"
      expect(frame).toContain('Esc');
      expect(frame).toContain('dismiss');
    });

    it('handles long error messages', async () => {
      const longMessage =
        'This is a very long error message that might need to wrap across multiple lines in the dialog';
      const { renderOnce, captureCharFrame } = await testRender(
        <ErrorDialog visible={true} message={longMessage} />,
        { width: 80, height: 24 }
      );
      await renderOnce();

      const frame = captureCharFrame();
      // Should contain at least the beginning of the message
      expect(frame).toContain('This is a very long error');
    });

    it('handles messages with special characters', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <ErrorDialog visible={true} message="Error code: 404" />,
        { width: 80, height: 24 }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('404');
    });
  });

  describe('centering', () => {
    it('renders centered in the terminal', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <ErrorDialog visible={true} message="Centered error" />,
        { width: 80, height: 24 }
      );
      await renderOnce();

      const frame = captureCharFrame();
      const lines = frame.split('\n');

      // Dialog should not be at the very top (row 0 or 1)
      // Find first line with content
      const firstContentLine = lines.findIndex(line => line.includes('Error'));
      expect(firstContentLine).toBeGreaterThan(2);
    });
  });

  describe('exports', () => {
    it('exports ErrorDialog component', async () => {
      const module = await import('./error.js');
      expect(module.ErrorDialog).toBeDefined();
      expect(typeof module.ErrorDialog).toBe('function');
    });
  });
});
