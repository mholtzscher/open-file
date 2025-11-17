/**
 * Custom React hook for managing buffer state
 *
 * Replaces the BufferState class with React hooks for state management.
 * This hook manages entries, cursor, selection, and edit modes.
 */

import { useState, useCallback, useEffect } from 'react';
import { Entry } from '../types/entry.js';
import { EditMode } from '../types/edit-mode.js';
import { SortConfig, DEFAULT_SORT_CONFIG, sortEntries } from '../utils/sorting.js';

export interface SelectionState {
  cursorIndex: number;
  selectionStart?: number;
  selectionEnd?: number;
  isActive: boolean;
}

export interface UseBufferStateReturn {
  entries: Entry[];
  originalEntries: Entry[];
  mode: EditMode;
  selection: SelectionState;
  currentPath: string;
  sortConfig: SortConfig;
  showHiddenFiles: boolean;
  searchQuery: string;
  scrollOffset: number;
  copyRegister: Entry[];
  viewportHeight: number;
  editBuffer: string; // Buffer for edit/insert mode

  // Buffer data operations
  setEntries: (entries: Entry[]) => void;
  setCurrentPath: (path: string) => void;
  setViewportHeight: (height: number) => void;

  // Edit buffer operations
  getEditBuffer: () => string;
  setEditBuffer: (text: string) => void;
  appendToEditBuffer: (char: string) => void;
  backspaceEditBuffer: () => void;
  clearEditBuffer: () => void;

  // Cursor/Selection operations
  moveCursorDown: (amount: number) => void;
  moveCursorUp: (amount: number) => void;
  cursorToTop: () => void;
  cursorToBottom: () => void;
  startVisualSelection: () => void;
  extendVisualSelection: (direction: 'up' | 'down') => void;
  exitVisualSelection: () => void;

  // Mode operations
  setMode: (mode: EditMode) => void;
  enterInsertMode: () => void;
  exitInsertMode: () => void;
  enterEditMode: () => void;
  exitEditMode: () => void;
  enterSearchMode: () => void;
  exitSearchMode: () => void;
  enterCommandMode: () => void;
  exitCommandMode: () => void;

  // Sorting
  setSortConfig: (config: SortConfig) => void;

  // Search
  updateSearchQuery: (query: string) => void;

  // Display options
  toggleHiddenFiles: () => void;

  // Copy/paste
  copySelection: () => void;
  hasClipboardContent: () => boolean;
  pasteAfterCursor: () => Entry[];

  // Getting data
  getSelectedEntry: () => Entry | undefined;
  getSelectedEntries: () => Entry[];
}

/**
 * Custom hook for buffer state management
 */
export function useBufferState(
  initialEntries: Entry[] = [],
  initialPath: string = ''
): UseBufferStateReturn {
  const [entries, setEntries] = useState<Entry[]>(initialEntries);
  const [originalEntries] = useState<Entry[]>(JSON.parse(JSON.stringify(initialEntries)));
  const [currentPath, setCurrentPath] = useState<string>(initialPath);
  const [mode, setMode] = useState<EditMode>(EditMode.Normal);
  const [selection, setSelection] = useState<SelectionState>({ cursorIndex: 0, isActive: false });
  const [sortConfig, setSortConfigState] = useState<SortConfig>(DEFAULT_SORT_CONFIG);
  const [showHiddenFiles, setShowHiddenFiles] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [scrollOffset, setScrollOffset] = useState(0);
  const [copyRegister, setCopyRegister] = useState<Entry[]>([]);
  const [viewportHeight, setViewportHeight] = useState(20);
  const [editBuffer, setEditBuffer] = useState<string>('');

  // Helper function to ensure cursor is within bounds
  const constrainCursor = useCallback(
    (index: number): number => {
      return Math.max(0, Math.min(index, entries.length - 1));
    },
    [entries.length]
  );

  // Update scroll offset to keep cursor visible
  const updateScrollOffset = useCallback(
    (cursorIndex: number) => {
      setScrollOffset(prevOffset => {
        // If cursor is above viewport, scroll up
        if (cursorIndex < prevOffset) {
          return cursorIndex;
        }
        // If cursor is below viewport, scroll down
        if (cursorIndex >= prevOffset + viewportHeight) {
          return cursorIndex - viewportHeight + 1;
        }
        // Cursor is visible, no scroll needed
        return prevOffset;
      });
    },
    [viewportHeight]
  );

  // Cursor movement
  const moveCursorDown = useCallback(
    (amount: number = 1) => {
      setSelection(prev => {
        const newIndex = constrainCursor(prev.cursorIndex + amount);
        updateScrollOffset(newIndex);
        return {
          ...prev,
          cursorIndex: newIndex,
        };
      });
    },
    [constrainCursor, updateScrollOffset]
  );

  const moveCursorUp = useCallback(
    (amount: number = 1) => {
      setSelection(prev => {
        const newIndex = constrainCursor(prev.cursorIndex - amount);
        updateScrollOffset(newIndex);
        return {
          ...prev,
          cursorIndex: newIndex,
        };
      });
    },
    [constrainCursor, updateScrollOffset]
  );

  const cursorToTop = useCallback(() => {
    setSelection(prev => ({ ...prev, cursorIndex: 0 }));
    setScrollOffset(0);
  }, []);

  const cursorToBottom = useCallback(() => {
    const newIndex = Math.max(0, entries.length - 1);
    setSelection(prev => ({
      ...prev,
      cursorIndex: newIndex,
    }));
    updateScrollOffset(newIndex);
  }, [entries.length, updateScrollOffset]);

  // Visual selection
  const startVisualSelection = useCallback(() => {
    setSelection(prev => ({
      ...prev,
      selectionStart: prev.cursorIndex,
      selectionEnd: prev.cursorIndex,
      isActive: true,
    }));
    setMode(EditMode.Visual);
  }, []);

  const extendVisualSelection = useCallback(
    (direction: 'up' | 'down') => {
      setSelection(prev => {
        if (!prev.isActive || prev.selectionStart === undefined) return prev;

        const newEnd = direction === 'up' ? prev.cursorIndex - 1 : prev.cursorIndex + 1;
        const newIndex = constrainCursor(newEnd);
        updateScrollOffset(newIndex);
        return {
          ...prev,
          selectionEnd: newIndex,
          cursorIndex: newIndex,
        };
      });
    },
    [constrainCursor, updateScrollOffset]
  );

  const exitVisualSelection = useCallback(() => {
    setSelection(prev => ({
      ...prev,
      isActive: false,
      selectionStart: undefined,
      selectionEnd: undefined,
    }));
  }, []);

  // Mode management
  const setModeState = useCallback((newMode: EditMode) => {
    setMode(newMode);
  }, []);

  const enterInsertMode = useCallback(() => {
    setMode(EditMode.Insert);
  }, []);

  const exitInsertMode = useCallback(() => {
    setMode(EditMode.Normal);
  }, []);

  const enterEditMode = useCallback(() => {
    setMode(EditMode.Edit);
  }, []);

  const exitEditMode = useCallback(() => {
    setMode(EditMode.Normal);
  }, []);

  const enterSearchMode = useCallback(() => {
    setMode(EditMode.Search);
  }, []);

  const exitSearchMode = useCallback(() => {
    setMode(EditMode.Normal);
    setSearchQuery('');
  }, []);

  const enterCommandMode = useCallback(() => {
    setMode(EditMode.Command);
    setEditBuffer(':');
  }, []);

  const exitCommandMode = useCallback(() => {
    setMode(EditMode.Normal);
    setEditBuffer('');
  }, []);

  // Sorting
  const setSortConfig = useCallback((config: SortConfig) => {
    setSortConfigState(config);
    setEntries(prev => sortEntries([...prev], config));
  }, []);

  // Search
  const updateSearchQuery = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  // Display options
  const toggleHiddenFiles = useCallback(() => {
    setShowHiddenFiles(prev => !prev);
  }, []);

  // Getting data
  const getSelectedEntry = useCallback((): Entry | undefined => {
    return entries[selection.cursorIndex];
  }, [entries, selection.cursorIndex]);

  const getSelectedEntries = useCallback((): Entry[] => {
    if (!selection.isActive || selection.selectionStart === undefined) {
      const entry = entries[selection.cursorIndex];
      return entry ? [entry] : [];
    }

    const start = Math.min(
      selection.selectionStart,
      selection.selectionEnd ?? selection.selectionStart
    );
    const end = Math.max(
      selection.selectionStart,
      selection.selectionEnd ?? selection.selectionStart
    );
    return entries.slice(start, end + 1);
  }, [selection, entries]);

  // Copy/paste
  const copySelection = useCallback(() => {
    const selected = selection.isActive ? getSelectedEntries() : getSelectedEntry();
    const toCopy = Array.isArray(selected) ? selected : selected ? [selected] : [];
    setCopyRegister([...toCopy]);
  }, [selection, getSelectedEntries, getSelectedEntry]);

  const hasClipboardContent = useCallback(() => {
    return copyRegister.length > 0;
  }, [copyRegister.length]);

  const pasteAfterCursor = useCallback(() => {
    if (copyRegister.length === 0) return [];

    const insertIndex = selection.cursorIndex + 1;
    const newEntries = [...entries];
    newEntries.splice(insertIndex, 0, ...copyRegister);
    setEntries(newEntries);

    return copyRegister;
  }, [copyRegister, selection.cursorIndex, entries]);

  // Edit buffer operations
  const getEditBuffer = useCallback(() => editBuffer, [editBuffer]);

  const appendToEditBuffer = useCallback((char: string) => {
    setEditBuffer(prev => prev + char);
  }, []);

  const backspaceEditBuffer = useCallback(() => {
    setEditBuffer(prev => prev.slice(0, -1));
  }, []);

  const clearEditBuffer = useCallback(() => {
    setEditBuffer('');
  }, []);

  return {
    entries,
    originalEntries,
    mode,
    selection,
    currentPath,
    sortConfig,
    showHiddenFiles,
    searchQuery,
    scrollOffset,
    copyRegister,
    viewportHeight,
    editBuffer,

    setEntries,
    setCurrentPath,
    setViewportHeight,

    getEditBuffer,
    setEditBuffer,
    appendToEditBuffer,
    backspaceEditBuffer,
    clearEditBuffer,

    moveCursorDown,
    moveCursorUp,
    cursorToTop,
    cursorToBottom,
    startVisualSelection,
    extendVisualSelection,
    exitVisualSelection,

    setMode: setModeState,
    enterInsertMode,
    exitInsertMode,
    enterEditMode,
    exitEditMode,
    enterSearchMode,
    exitSearchMode,
    enterCommandMode,
    exitCommandMode,

    setSortConfig,
    updateSearchQuery,
    toggleHiddenFiles,

    copySelection,
    hasClipboardContent,
    pasteAfterCursor,

    getSelectedEntry,
    getSelectedEntries,
  };
}
