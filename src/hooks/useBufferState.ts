/**
 * Custom React hook for managing buffer state
 *
 * Replaces the BufferState class with React hooks for state management.
 * This hook manages entries, cursor, selection, and edit modes.
 */

import { useReducer, useCallback } from 'react';
import { Entry } from '../types/entry.js';
import { EditMode } from '../types/edit-mode.js';
import { SortConfig } from '../utils/sorting.js';
import { bufferReducer, INITIAL_BUFFER_STATE, SelectionState } from './buffer-reducer.js';

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
  deletedEntryIds: Set<string>; // Entries marked for deletion

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
  getFilteredEntries: () => Entry[];

  // Deletion marking (oil.nvim style)
  markForDeletion: (entryId: string) => void;
  unmarkForDeletion: (entryId: string) => void;
  isMarkedForDeletion: (entryId: string) => boolean;
  getMarkedForDeletion: () => Entry[];
  clearDeletionMarks: () => void;

  // Undo/redo
  undo: () => boolean;
  redo: () => boolean;
  canUndo: () => boolean;
  canRedo: () => boolean;
  saveSnapshot: () => void;
}

/**
 * Custom hook for buffer state management
 */
export function useBufferState(
  initialEntries: Entry[] = [],
  initialPath: string = ''
): UseBufferStateReturn {
  // Use structuredClone for deep copy of initial entries
  const [state, dispatch] = useReducer(bufferReducer, {
    ...INITIAL_BUFFER_STATE,
    entries: initialEntries,
    originalEntries: structuredClone(initialEntries),
    currentPath: initialPath,
  });

  // Helper to dispatch actions
  const setEntries = useCallback((entries: Entry[]) => {
    dispatch({ type: 'SET_ENTRIES', entries });
  }, []);

  const setCurrentPath = useCallback((path: string) => {
    dispatch({ type: 'SET_CURRENT_PATH', path });
  }, []);

  const setViewportHeight = useCallback((height: number) => {
    dispatch({ type: 'SET_VIEWPORT_HEIGHT', height });
  }, []);

  // Edit buffer operations
  const getEditBuffer = useCallback(() => state.editBuffer, [state.editBuffer]);

  const setEditBuffer = useCallback((text: string) => {
    dispatch({ type: 'SET_EDIT_BUFFER', text });
  }, []);

  const appendToEditBuffer = useCallback((char: string) => {
    dispatch({ type: 'APPEND_TO_EDIT_BUFFER', char });
  }, []);

  const backspaceEditBuffer = useCallback(() => {
    dispatch({ type: 'BACKSPACE_EDIT_BUFFER' });
  }, []);

  const clearEditBuffer = useCallback(() => {
    dispatch({ type: 'CLEAR_EDIT_BUFFER' });
  }, []);

  // Cursor/Selection operations
  const moveCursorDown = useCallback((amount: number = 1) => {
    dispatch({ type: 'MOVE_CURSOR', amount });
  }, []);

  const moveCursorUp = useCallback((amount: number = 1) => {
    dispatch({ type: 'MOVE_CURSOR', amount: -amount });
  }, []);

  const cursorToTop = useCallback(() => {
    dispatch({ type: 'CURSOR_TO_TOP' });
  }, []);

  const cursorToBottom = useCallback(() => {
    dispatch({ type: 'CURSOR_TO_BOTTOM' });
  }, []);

  const startVisualSelection = useCallback(() => {
    dispatch({ type: 'START_VISUAL_SELECTION' });
  }, []);

  const extendVisualSelection = useCallback((direction: 'up' | 'down') => {
    dispatch({ type: 'EXTEND_VISUAL_SELECTION', direction });
  }, []);

  const exitVisualSelection = useCallback(() => {
    dispatch({ type: 'EXIT_VISUAL_SELECTION' });
  }, []);

  // Mode operations
  const setMode = useCallback((mode: EditMode) => {
    dispatch({ type: 'SET_MODE', mode });
  }, []);

  const enterInsertMode = useCallback(() => {
    dispatch({ type: 'SET_MODE', mode: EditMode.Insert });
  }, []);

  const exitInsertMode = useCallback(() => {
    dispatch({ type: 'SET_MODE', mode: EditMode.Normal });
  }, []);

  const enterEditMode = useCallback(() => {
    dispatch({ type: 'SET_MODE', mode: EditMode.Edit });
  }, []);

  const exitEditMode = useCallback(() => {
    dispatch({ type: 'SET_MODE', mode: EditMode.Normal });
  }, []);

  const enterSearchMode = useCallback(() => {
    dispatch({ type: 'SET_MODE', mode: EditMode.Search });
  }, []);

  const exitSearchMode = useCallback(() => {
    dispatch({ type: 'SET_MODE', mode: EditMode.Normal });
  }, []);

  const enterCommandMode = useCallback(() => {
    dispatch({ type: 'SET_MODE', mode: EditMode.Command });
  }, []);

  const exitCommandMode = useCallback(() => {
    dispatch({ type: 'SET_MODE', mode: EditMode.Normal });
  }, []);

  // Sorting
  const setSortConfig = useCallback((config: SortConfig) => {
    dispatch({ type: 'SET_SORT_CONFIG', config });
  }, []);

  // Search
  const updateSearchQuery = useCallback((query: string) => {
    dispatch({ type: 'UPDATE_SEARCH_QUERY', query });
  }, []);

  // Display options
  const toggleHiddenFiles = useCallback(() => {
    dispatch({ type: 'TOGGLE_HIDDEN_FILES' });
  }, []);

  // Copy/paste
  const copySelection = useCallback(() => {
    dispatch({ type: 'COPY_SELECTION' });
  }, []);

  const hasClipboardContent = useCallback(() => {
    return state.copyRegister.length > 0;
  }, [state.copyRegister.length]);

  const pasteAfterCursor = useCallback(() => {
    if (state.copyRegister.length === 0) return [];
    dispatch({ type: 'PASTE_AFTER_CURSOR' });
    return state.copyRegister;
  }, [state.copyRegister]);

  // Getting data
  const getSelectedEntry = useCallback((): Entry | undefined => {
    return state.entries[state.selection.cursorIndex];
  }, [state.entries, state.selection.cursorIndex]);

  const getSelectedEntries = useCallback((): Entry[] => {
    if (!state.selection.isActive || state.selection.selectionStart === undefined) {
      const entry = state.entries[state.selection.cursorIndex];
      return entry ? [entry] : [];
    }

    const start = Math.min(
      state.selection.selectionStart,
      state.selection.selectionEnd ?? state.selection.selectionStart
    );
    const end = Math.max(
      state.selection.selectionStart,
      state.selection.selectionEnd ?? state.selection.selectionStart
    );
    return state.entries.slice(start, end + 1);
  }, [state.selection, state.entries]);

  const getFilteredEntries = useCallback((): Entry[] => {
    if (!state.searchQuery) {
      return state.entries;
    }

    const query = state.searchQuery.toLowerCase();
    return state.entries.filter(entry => entry.name.toLowerCase().includes(query));
  }, [state.entries, state.searchQuery]);

  // Deletion marking (oil.nvim style)
  const markForDeletion = useCallback((entryId: string): void => {
    dispatch({ type: 'MARK_FOR_DELETION', entryId });
  }, []);

  const unmarkForDeletion = useCallback((entryId: string): void => {
    dispatch({ type: 'UNMARK_FOR_DELETION', entryId });
  }, []);

  const isMarkedForDeletion = useCallback(
    (entryId: string): boolean => {
      return state.deletedEntryIds.has(entryId);
    },
    [state.deletedEntryIds]
  );

  const getMarkedForDeletion = useCallback((): Entry[] => {
    return state.entries.filter(e => state.deletedEntryIds.has(e.id));
  }, [state.entries, state.deletedEntryIds]);

  const clearDeletionMarks = useCallback((): void => {
    dispatch({ type: 'CLEAR_DELETION_MARKS' });
  }, []);

  // Undo/redo
  const canUndo = useCallback((): boolean => {
    return state.undoHistory.length > 0;
  }, [state.undoHistory.length]);

  const canRedo = useCallback((): boolean => {
    return state.redoHistory.length > 0;
  }, [state.redoHistory.length]);

  const undo = useCallback((): boolean => {
    if (!canUndo()) return false;
    dispatch({ type: 'UNDO' });
    return true;
  }, [canUndo]);

  const redo = useCallback((): boolean => {
    if (!canRedo()) return false;
    dispatch({ type: 'REDO' });
    return true;
  }, [canRedo]);

  const saveSnapshot = useCallback((): void => {
    dispatch({ type: 'SAVE_SNAPSHOT' });
  }, []);

  return {
    ...state,
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
    setMode,
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
    getFilteredEntries,
    markForDeletion,
    unmarkForDeletion,
    isMarkedForDeletion,
    getMarkedForDeletion,
    clearDeletionMarks,
    undo,
    redo,
    canUndo,
    canRedo,
    saveSnapshot,
  };
}
