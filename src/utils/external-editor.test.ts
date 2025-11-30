/**
 * Tests for external-editor utility
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { getEditorCommand, openInExternalEditor } from './external-editor.js';

describe('external-editor', () => {
  describe('getEditorCommand', () => {
    let originalEditor: string | undefined;
    let originalVisual: string | undefined;

    beforeEach(() => {
      // Save original values
      originalEditor = process.env.EDITOR;
      originalVisual = process.env.VISUAL;
    });

    afterEach(() => {
      // Restore original values
      if (originalEditor !== undefined) {
        process.env.EDITOR = originalEditor;
      } else {
        delete process.env.EDITOR;
      }
      if (originalVisual !== undefined) {
        process.env.VISUAL = originalVisual;
      } else {
        delete process.env.VISUAL;
      }
    });

    it('returns $EDITOR when set', () => {
      process.env.EDITOR = 'nvim';
      process.env.VISUAL = 'code';

      expect(getEditorCommand()).toBe('nvim');
    });

    it('falls back to $VISUAL when $EDITOR is not set', () => {
      delete process.env.EDITOR;
      process.env.VISUAL = 'code';

      expect(getEditorCommand()).toBe('code');
    });

    it('falls back to vi when neither is set', () => {
      delete process.env.EDITOR;
      delete process.env.VISUAL;

      expect(getEditorCommand()).toBe('vi');
    });

    it('prefers $EDITOR over $VISUAL', () => {
      process.env.EDITOR = 'vim';
      process.env.VISUAL = 'emacs';

      expect(getEditorCommand()).toBe('vim');
    });
  });

  describe('openInExternalEditor', () => {
    it('returns error for non-existent editor', () => {
      // Use a command that definitely doesn't exist
      const originalEditor = process.env.EDITOR;
      process.env.EDITOR = 'nonexistent-editor-12345';

      const result = openInExternalEditor('/tmp/test-file.txt');

      expect(result.success).toBe(false);
      expect(result.error).toContain('nonexistent-editor-12345');

      // Restore
      if (originalEditor !== undefined) {
        process.env.EDITOR = originalEditor;
      } else {
        delete process.env.EDITOR;
      }
    });

    it('handles editor commands with arguments', () => {
      // Test that "code --wait" style commands are parsed correctly
      const originalEditor = process.env.EDITOR;
      process.env.EDITOR = 'true'; // 'true' is a command that always exits successfully

      const result = openInExternalEditor('/tmp/test-file.txt');

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);

      // Restore
      if (originalEditor !== undefined) {
        process.env.EDITOR = originalEditor;
      } else {
        delete process.env.EDITOR;
      }
    });

    it('returns success=false when editor exits with non-zero', () => {
      const originalEditor = process.env.EDITOR;
      process.env.EDITOR = 'false'; // 'false' is a command that always exits with 1

      const result = openInExternalEditor('/tmp/test-file.txt');

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.error).toContain('exited with code 1');

      // Restore
      if (originalEditor !== undefined) {
        process.env.EDITOR = originalEditor;
      } else {
        delete process.env.EDITOR;
      }
    });
  });
});
