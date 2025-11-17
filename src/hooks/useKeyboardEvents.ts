/**
 * Custom React hook for handling keyboard events
 *
 * Provides React-native keyboard event handling that integrates with buffer state.
 * Handles:
 * - Single key presses (j, k, q, etc.)
 * - Multi-key sequences (gg, dd, yy)
 * - Mode-aware key handling (normal, insert, edit, search)
 * - Modifier keys (Ctrl, Shift, Meta)
 */

import { useCallback, useRef, useEffect } from 'react';
import { EditMode } from '../types/edit-mode.js';
import { EntryType } from '../types/entry.js';
import { UseBufferStateReturn } from './useBufferState.js';

export interface KeyboardEvent {
  name: string;
  ctrl?: boolean;
  shift?: boolean;
  meta?: boolean;
  char?: string;
}

export interface KeyboardHandlers {
  onNavigateDown?: () => void;
  onNavigateUp?: () => void;
  onNavigateInto?: () => void;
  onStartVisualSelection?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onDelete?: () => void;
  onEnterInsertMode?: () => void;
  onEnterEditMode?: () => void;
  onEnterSearchMode?: () => void;
  onSearch?: (query: string) => void;
  onPageDown?: () => void;
  onPageUp?: () => void;
  onSave?: () => void;
  onQuit?: () => void;
  onShowHelp?: () => void;
}

export interface UseKeyboardEventsReturn {
  handleKeyDown: (event: KeyboardEvent) => void;
  clearKeySequence: () => void;
}

/**
 * Custom hook for React keyboard event handling
 */
export function useKeyboardEvents(
  bufferState: UseBufferStateReturn,
  handlers: Partial<KeyboardHandlers>
): UseKeyboardEventsReturn {
  const keySequenceRef = useRef<string[]>([]);
  const sequenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear key sequence
  const clearKeySequence = useCallback(() => {
    if (sequenceTimeoutRef.current) {
      clearTimeout(sequenceTimeoutRef.current);
    }
    keySequenceRef.current = [];
  }, []);

  // Handle multi-key sequences (gg, dd, yy, etc.)
  const handleKeySequence = useCallback(
    (key: string, shift: boolean = false): { handled: boolean; sequence: string[] } => {
      keySequenceRef.current.push(key);

      // Clear existing timeout
      if (sequenceTimeoutRef.current) {
        clearTimeout(sequenceTimeoutRef.current);
      }

      // Set new timeout to clear sequence after 500ms
      sequenceTimeoutRef.current = setTimeout(() => {
        keySequenceRef.current = [];
      }, 500);

      const sequence = keySequenceRef.current.join('');
      let handled = false;

      // Check for multi-key sequences
      if (sequence === 'gg') {
        bufferState.cursorToTop();
        keySequenceRef.current = [];
        handled = true;
      } else if (
        sequence === 'G' ||
        (keySequenceRef.current.length === 1 && keySequenceRef.current[0] === 'G')
      ) {
        bufferState.cursorToBottom();
        keySequenceRef.current = [];
        handled = true;
      } else if (shift && key === 'g' && keySequenceRef.current.length === 1) {
        // Handle Shift+g (when terminal sends 'g' with shift modifier instead of 'G')
        bufferState.cursorToBottom();
        keySequenceRef.current = [];
        handled = true;
      } else if (sequence === 'dd') {
        // Delete line - handled by buffer state or caller
        keySequenceRef.current = [];
        handled = true;
      } else if (sequence === 'yy') {
        // Copy line - handled by buffer state or caller
        bufferState.copySelection();
        keySequenceRef.current = [];
        handled = true;
      } else if (sequence === 'g?') {
        // Show help
        if (handlers.onShowHelp) {
          handlers.onShowHelp();
        }
        keySequenceRef.current = [];
        handled = true;
      } else if (keySequenceRef.current.length === 1 && keySequenceRef.current[0] === 'g') {
        // g followed by something else - wait for next key
        handled = false;
      } else if (keySequenceRef.current.length === 1 && keySequenceRef.current[0] === 'd') {
        // d followed by something else - wait for next key
        handled = false;
      } else if (keySequenceRef.current.length === 1 && keySequenceRef.current[0] === 'y') {
        // y followed by something else - wait for next key
        handled = false;
      } else if (keySequenceRef.current.length > 1) {
        // Clear sequence if we have unrecognized multi-key
        keySequenceRef.current = [];
        handled = false;
      }

      return { handled, sequence: [...keySequenceRef.current] };
    },
    [bufferState, handlers]
  );

  // Handle keyboard events in normal mode
  const handleNormalMode = useCallback(
    (key: string, shift: boolean = false) => {
      const seqResult = handleKeySequence(key, shift);

      // If sequence was handled, don't process further
      if (seqResult.handled) {
        return;
      }

      // Single keys (only if not waiting for sequence continuation)
      if (
        keySequenceRef.current.length === 0 ||
        (keySequenceRef.current.length === 1 &&
          keySequenceRef.current[0] !== 'g' &&
          keySequenceRef.current[0] !== 'd' &&
          keySequenceRef.current[0] !== 'y')
      ) {
        switch (key) {
          case 'j':
            bufferState.moveCursorDown(1);
            break;
          case 'k':
            bufferState.moveCursorUp(1);
            break;
          case 'h':
            if (handlers.onNavigateUp) handlers.onNavigateUp();
            break;
          case 'l':
          case 'enter':
          case 'return':
            if (handlers.onNavigateInto) handlers.onNavigateInto();
            break;
          case 'v':
            bufferState.startVisualSelection();
            break;
          case 'y':
            // yy sequence - wait for second y
            break;
          case 'd':
            // dd sequence - wait for second d
            break;
          case 'g':
            // gg sequence - wait for second g
            break;
          case 'G':
            // Shift+G - go to bottom (handled in sequence but add here as fallback)
            bufferState.cursorToBottom();
            keySequenceRef.current = [];
            break;
          case 'p':
            if (handlers.onPaste) handlers.onPaste();
            break;
          case 'i':
            bufferState.enterInsertMode();
            if (handlers.onEnterInsertMode) handlers.onEnterInsertMode();
            break;
          case 'a':
            bufferState.enterEditMode();
            if (handlers.onEnterEditMode) handlers.onEnterEditMode();
            break;
          case '/':
            bufferState.enterSearchMode();
            if (handlers.onEnterSearchMode) handlers.onEnterSearchMode();
            break;
          case ':':
            bufferState.enterCommandMode();
            break;
          case 'w':
            if (handlers.onSave) handlers.onSave();
            break;
          case 'q':
            if (handlers.onQuit) handlers.onQuit();
            break;
        }
      }
    },
    [bufferState, handleKeySequence, handlers]
  );

  // Handle keyboard events in insert mode
  const handleInsertMode = useCallback(
    (key: string, char?: string) => {
      switch (key) {
        case 'escape':
          bufferState.clearEditBuffer();
          bufferState.exitInsertMode();
          break;
        case 'enter': {
          // Confirm entry creation
          const entryName = bufferState.getEditBuffer().trim();
          if (entryName) {
            // Create new entry with the name
            const currentPath = bufferState.currentPath;
            const entryPath = currentPath ? `${currentPath}${entryName}` : entryName;
            const isDirectory = entryName.endsWith('/');

            // Add new entry to buffer
            const newEntry = {
              id: Math.random().toString(36),
              name: entryName.replace(/\/$/, ''),
              type: isDirectory ? EntryType.Directory : EntryType.File,
              path: entryPath,
              modified: new Date(),
            };

            const currentEntries = bufferState.entries;
            bufferState.setEntries([...currentEntries, newEntry]);
            bufferState.clearEditBuffer();
            bufferState.exitInsertMode();
          }
          break;
        }
        case 'tab':
          // Apply first matching completion (if any)
          // For now, just accept what's in the buffer
          break;
        case 'backspace':
          bufferState.backspaceEditBuffer();
          break;
        default:
          // Add character to entry name if printable
          if (char && char.length === 1 && char.match(/[a-zA-Z0-9._\-\s/]/)) {
            bufferState.appendToEditBuffer(char);
          }
          break;
      }
    },
    [bufferState]
  );

  // Handle keyboard events in search mode
  const handleSearchMode = useCallback(
    (key: string, char?: string) => {
      switch (key) {
        case 'escape':
          bufferState.exitSearchMode();
          break;
        case 'backspace':
          if (handlers.onSearch) {
            const currentQuery = bufferState.searchQuery || '';
            handlers.onSearch(currentQuery.slice(0, -1));
          }
          break;
        case 'n':
          // Find next - handled by buffer state
          break;
        case 'N':
          // Find previous - handled by buffer state
          break;
        default:
          // Add character to search query if printable
          if (char && char.length === 1) {
            const currentQuery = bufferState.searchQuery || '';
            if (handlers.onSearch) {
              handlers.onSearch(currentQuery + char);
            }
          }
          break;
      }
    },
    [bufferState, handlers]
  );

  // Handle keyboard events in command mode
  const handleCommandMode = useCallback(
    (key: string, char?: string) => {
      switch (key) {
        case 'escape':
          bufferState.exitCommandMode();
          break;
        case 'enter': {
          // Execute command
          const command = bufferState.getEditBuffer().trim();
          if (command === ':w') {
            if (handlers.onSave) handlers.onSave();
          } else if (command === ':q') {
            if (handlers.onQuit) handlers.onQuit();
          }
          // Exit command mode after execution
          bufferState.exitCommandMode();
          break;
        }
        case 'backspace':
          bufferState.backspaceEditBuffer();
          break;
        default:
          // Add character to command buffer if printable
          if (char && char.length === 1) {
            bufferState.appendToEditBuffer(char);
          }
          break;
      }
    },
    [bufferState, handlers]
  );

  // Main keyboard event handler
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const key = event.name;

      // Handle Ctrl+N (page down) and Ctrl+P (page up) in all modes
      if (event.ctrl && (key === 'n' || key === 'N')) {
        if (handlers.onPageDown) handlers.onPageDown();
        return;
      }
      if (event.ctrl && (key === 'p' || key === 'P')) {
        if (handlers.onPageUp) handlers.onPageUp();
        return;
      }
      // Handle Ctrl+S (save) in all modes
      if (event.ctrl && (key === 's' || key === 'S')) {
        if (handlers.onSave) handlers.onSave();
        return;
      }

      // Route to appropriate mode handler
      switch (bufferState.mode) {
        case EditMode.Normal:
          handleNormalMode(key, event.shift);
          break;
        case EditMode.Insert:
          handleInsertMode(key, event.char);
          break;
        case EditMode.Search:
          handleSearchMode(key, event.char);
          break;
        case EditMode.Command:
          handleCommandMode(key, event.char);
          break;
        case EditMode.Edit: {
          // Edit mode - edit the current entry name
          switch (key) {
            case 'escape':
              bufferState.clearEditBuffer();
              bufferState.exitEditMode();
              break;
            case 'enter': {
              // Confirm entry edit/rename
              const newName = bufferState.getEditBuffer().trim();
              if (newName && newName.length > 0) {
                const currentEntry = bufferState.getSelectedEntry();
                if (currentEntry) {
                  // Update the entry with the new name
                  const currentEntries = bufferState.entries;
                  const updatedEntries = currentEntries.map(entry => {
                    if (entry.id === currentEntry.id) {
                      const isDirectory = newName.endsWith('/');
                      const cleanName = newName.replace(/\/$/, '');
                      const currentPath = bufferState.currentPath;
                      const newPath = currentPath ? `${currentPath}${cleanName}` : cleanName;

                      return {
                        ...entry,
                        name: cleanName,
                        path: newPath,
                        type: isDirectory ? EntryType.Directory : EntryType.File,
                      };
                    }
                    return entry;
                  });
                  bufferState.setEntries(updatedEntries);
                }
              }
              bufferState.clearEditBuffer();
              bufferState.exitEditMode();
              break;
            }
            case 'backspace':
              bufferState.backspaceEditBuffer();
              break;
            default:
              // Add character to edit buffer if printable
              if (event.char && event.char.length === 1 && event.char.match(/[a-zA-Z0-9._\-\s/]/)) {
                bufferState.appendToEditBuffer(event.char);
              }
              break;
          }
          break;
        }
        case EditMode.Visual:
          // Visual mode - handle selection extension
          if (key === 'escape') {
            bufferState.exitVisualSelection();
          } else if (key === 'j') {
            bufferState.extendVisualSelection('down');
          } else if (key === 'k') {
            bufferState.extendVisualSelection('up');
          }
          break;
      }
    },
    [bufferState, handleNormalMode, handleInsertMode, handleSearchMode, handleCommandMode, handlers]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sequenceTimeoutRef.current) {
        clearTimeout(sequenceTimeoutRef.current);
      }
    };
  }, []);

  return {
    handleKeyDown,
    clearKeySequence,
  };
}
