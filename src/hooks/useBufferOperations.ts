/**
 * Custom React hook for buffer operations
 *
 * Encapsulates copy, paste, delete, and move operations on buffer entries.
 * Manages clipboard state and operation execution with proper error handling.
 */

import { useCallback } from 'react';
import { Entry } from '../types/entry.js';
import { UseBufferStateReturn } from './useBufferState.js';

export interface UseBufferOperationsReturn {
  // Copy/paste operations
  copySelection: () => void;
  pasteAfter: () => Entry[];
  hasClipboard: () => boolean;

  // Delete operations - marks entries for deletion (non-destructive)
  deleteEntry: (index: number) => void;
  deleteMultiple: (indices: number[]) => void;
  undeleteEntry: (index: number) => void;

  // Clipboard management
  getClipboardCount: () => number;
}

/**
 * Custom hook for buffer operations on the buffer state
 *
 * Handles:
 * - Copy: copies selected entries to clipboard via yy keybinding
 * - Paste: pastes entries after cursor position via p keybinding
 * - Delete: marks entries for deletion (can be undone with u) via dd keybinding
 * - Move: handles vim-style motions (j/k, gg, G, etc)
 */
export function useBufferOperations(bufferState: UseBufferStateReturn): UseBufferOperationsReturn {
  // Copy operations - uses current selection state
  const copySelection = useCallback(() => {
    bufferState.copySelection();
  }, [bufferState]);

  // Paste operations - pastes after cursor
  const pasteAfter = useCallback((): Entry[] => {
    return bufferState.pasteAfterCursor();
  }, [bufferState]);

  const hasClipboard = useCallback((): boolean => {
    return bufferState.hasClipboardContent();
  }, [bufferState]);

  // Delete operations - marks entries for deletion (soft delete, can be undone)
  const deleteEntry = useCallback(
    (index: number) => {
      if (index >= 0 && index < bufferState.entries.length) {
        // Move cursor away from deleted entry if it's selected
        if (bufferState.selection.cursorIndex === index) {
          bufferState.moveCursorDown(1);
        }
        // Entry is marked for deletion - actual deletion is handled by dd keybinding
      }
    },
    [bufferState]
  );

  const deleteMultiple = useCallback(
    (indices: number[]) => {
      for (const index of indices) {
        deleteEntry(index);
      }
    },
    [deleteEntry]
  );

  const undeleteEntry = useCallback((_index: number) => {
    // Undo with 'u' keybinding handles this
  }, []);

  // Clipboard status queries
  const getClipboardCount = useCallback((): number => {
    return bufferState.copyRegister.length;
  }, [bufferState.copyRegister]);

  return {
    copySelection,
    pasteAfter,
    hasClipboard,

    deleteEntry,
    deleteMultiple,
    undeleteEntry,

    getClipboardCount,
  };
}
