/**
 * Custom React hook for managing buffer state
 *
 * Replaces the BufferState class with React hooks for state management.
 * This hook manages entries, cursor, selection, and edit modes.
 */

import { useReducer, useCallback, useMemo } from 'react';
import { Entry } from '../types/entry.js';
import { EditMode } from '../types/edit-mode.js';
import { SortConfig } from '../utils/sorting.js';
import { bufferReducer, INITIAL_BUFFER_STATE, SelectionState } from './buffer-reducer.js';

export interface UseBufferStateReturn {
  entries: Entry[];
  mode: EditMode;
  selection: SelectionState;
  currentPath: string;
  sortConfig: SortConfig;
  showHiddenFiles: boolean;
  searchQuery: string;
  scrollOffset: number;
  viewportHeight: number;
  editBuffer: string;
  editBufferCursor: number;

  // Buffer data operations
  setEntries: (entries: Entry[]) => void;
  setCurrentPath: (path: string) => void;
  setViewportHeight: (height: number) => void;

  // Edit buffer operations
  getEditBuffer: () => string;
  getEditBufferCursor: () => number;
  setEditBuffer: (text: string) => void;
  insertAtEditCursor: (char: string) => void;
  backspaceEditBuffer: () => void;
  deleteAtEditCursor: () => void;
  clearEditBuffer: () => void;
  moveEditCursor: (direction: 'left' | 'right') => void;
  moveEditCursorToStart: () => void;
  moveEditCursorToEnd: () => void;

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
  enterEditMode: (initialValue?: string) => void;
  exitEditMode: () => void;
  enterSearchMode: () => void;
  exitSearchMode: () => void;
  confirmSearchMode: () => void;
  enterCommandMode: () => void;
  exitCommandMode: () => void;

  // Sorting
  setSortConfig: (config: SortConfig) => void;

  // Search
  updateSearchQuery: (query: string) => void;

  // Display options
  toggleHiddenFiles: () => void;

  // Getting data
  getSelectedEntry: () => Entry | undefined;
  getSelectedEntries: () => Entry[];
  getFilteredEntries: () => Entry[];
}

/**
 * Custom hook for buffer state management
 */
export function useBufferState(
  initialEntries: Entry[] = [],
  initialPath: string = ''
): UseBufferStateReturn {
  const [state, dispatch] = useReducer(bufferReducer, {
    ...INITIAL_BUFFER_STATE,
    entries: initialEntries,
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
  const getEditBufferCursor = useCallback(() => state.editBufferCursor, [state.editBufferCursor]);

  const setEditBuffer = useCallback((text: string) => {
    dispatch({ type: 'SET_EDIT_BUFFER', text });
  }, []);

  const insertAtEditCursor = useCallback((char: string) => {
    dispatch({ type: 'INSERT_AT_EDIT_CURSOR', char });
  }, []);

  const backspaceEditBuffer = useCallback(() => {
    dispatch({ type: 'BACKSPACE_EDIT_BUFFER' });
  }, []);

  const deleteAtEditCursor = useCallback(() => {
    dispatch({ type: 'DELETE_AT_EDIT_CURSOR' });
  }, []);

  const clearEditBuffer = useCallback(() => {
    dispatch({ type: 'CLEAR_EDIT_BUFFER' });
  }, []);

  const moveEditCursor = useCallback((direction: 'left' | 'right') => {
    dispatch({ type: 'MOVE_EDIT_CURSOR', direction });
  }, []);

  const moveEditCursorToStart = useCallback(() => {
    dispatch({ type: 'MOVE_EDIT_CURSOR_TO_START' });
  }, []);

  const moveEditCursorToEnd = useCallback(() => {
    dispatch({ type: 'MOVE_EDIT_CURSOR_TO_END' });
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

  const enterEditMode = useCallback((initialValue?: string) => {
    dispatch({ type: 'SET_MODE', mode: EditMode.Edit, initialEditBuffer: initialValue });
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

  const confirmSearchMode = useCallback(() => {
    dispatch({ type: 'CONFIRM_SEARCH_MODE' });
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

  return {
    ...state,
    setEntries,
    setCurrentPath,
    setViewportHeight,
    getEditBuffer,
    getEditBufferCursor,
    setEditBuffer,
    insertAtEditCursor,
    backspaceEditBuffer,
    deleteAtEditCursor,
    clearEditBuffer,
    moveEditCursor,
    moveEditCursorToStart,
    moveEditCursorToEnd,
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
    confirmSearchMode,
    enterCommandMode,
    exitCommandMode,
    setSortConfig,
    updateSearchQuery,
    toggleHiddenFiles,
    getSelectedEntry,
    getSelectedEntries,
    getFilteredEntries,
  };
}
