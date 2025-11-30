/**
 * External Editor Utility
 *
 * Spawns the user's configured terminal editor ($EDITOR or $VISUAL)
 * to edit files. Designed to work with TUI applications that need
 * to temporarily suspend rendering while the editor is active.
 */

import { spawnSync } from 'node:child_process';

// ============================================================================
// Types
// ============================================================================

/**
 * Result of opening a file in an external editor
 */
export interface ExternalEditorResult {
  /** Whether the editor exited successfully (exit code 0) */
  success: boolean;
  /** Exit code from the editor process */
  exitCode: number | null;
  /** Error message if the editor failed to start or exited with error */
  error?: string;
}

// ============================================================================
// Editor Detection
// ============================================================================

/**
 * Get the user's preferred editor command
 *
 * Checks in order:
 * 1. $EDITOR environment variable
 * 2. $VISUAL environment variable
 * 3. Falls back to 'vi'
 *
 * @returns Editor command string
 */
export function getEditorCommand(): string {
  return process.env.EDITOR || process.env.VISUAL || 'vi';
}

// ============================================================================
// Editor Spawning
// ============================================================================

/**
 * Open a file in the user's configured external editor
 *
 * This function spawns the editor synchronously, blocking until the editor
 * exits. The calling code should suspend any TUI rendering before calling
 * this function and resume after it returns.
 *
 * @param filePath - Absolute path to the file to edit
 * @returns Result indicating success/failure and any error message
 */
export function openInExternalEditor(filePath: string): ExternalEditorResult {
  const editor = getEditorCommand();

  // Parse the editor command in case it includes arguments (e.g., "code --wait")
  const parts = editor.split(/\s+/);
  const command = parts[0];
  const args = [...parts.slice(1), filePath];

  try {
    const result = spawnSync(command, args, {
      stdio: 'inherit', // Connect to parent's stdin/stdout/stderr
      shell: false,
    });

    if (result.error) {
      return {
        success: false,
        exitCode: null,
        error: `Failed to start editor "${editor}": ${result.error.message}`,
      };
    }

    if (result.status !== 0) {
      return {
        success: false,
        exitCode: result.status,
        error: `Editor exited with code ${result.status}`,
      };
    }

    return {
      success: true,
      exitCode: 0,
    };
  } catch (err) {
    const error = err as Error;
    return {
      success: false,
      exitCode: null,
      error: `Failed to open editor: ${error.message}`,
    };
  }
}
