/**
 * ErrorDialog tests
 */

import { describe, it, expect, mock } from 'bun:test';
import { ErrorDialog } from './error-dialog-react.js';

// Mock the useTerminalSize hook
mock.module('../hooks/useTerminalSize.js', () => ({
  useTerminalSize: () => ({
    size: { width: 80, height: 24 },
    width: 80,
    height: 24,
    isSmall: false,
    isMedium: true,
  }),
}));

describe('ErrorDialog', () => {
  it('returns null when not visible', () => {
    const result = ErrorDialog({ visible: false, message: 'Error' });
    expect(result).toBeNull();
  });

  it('does not throw when visible with a message', () => {
    expect(() => {
      ErrorDialog({ visible: true, message: 'Something went wrong' });
    }).not.toThrow();
  });

  it('does not throw when visible with an empty message', () => {
    expect(() => {
      ErrorDialog({ visible: true, message: '' });
    }).not.toThrow();
  });

  it('does not throw when visible with a long message', () => {
    const longMessage =
      'This is a very long error message that should still render properly in the dialog without causing any issues';
    expect(() => {
      ErrorDialog({ visible: true, message: longMessage });
    }).not.toThrow();
  });
});
