/**
 * Custom React hook for managing buffer state
 * 
 * Replaces the BufferState class with React hooks for state management.
 * This hook manages entries, cursor, selection, and edit modes.
 */

import { useState, useCallback } from 'react';
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
export function useBufferState(initialEntries: Entry[] = [], initialPath: string = ''): UseBufferStateReturn {
  const [entries, setEntries] = useState<Entry[]>(initialEntries);
  const [originalEntries] = useState<Entry[]>(JSON.parse(JSON.stringify(initialEntries)));
  const [mode, setMode] = useState<EditMode>(EditMode.Normal);
  const [selection, setSelection] = useState<SelectionState>({ cursorIndex: 0, isActive: false });
  const [sortConfig, setSortConfigState] = useState<SortConfig>(DEFAULT_SORT_CONFIG);
  const [showHiddenFiles, setShowHiddenFiles] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [scrollOffset, setScrollOffset] = useState(0);
  const [copyRegister, setCopyRegister] = useState<Entry[]>([]);

  // Helper function to ensure cursor is within bounds
  const constrainCursor = useCallback((index: number): number => {
    return Math.max(0, Math.min(index, entries.length - 1));
  }, [entries.length]);

  // Cursor movement
  const moveCursorDown = useCallback((amount: number = 1) => {
    setSelection((prev) => ({
      ...prev,
      cursorIndex: constrainCursor(prev.cursorIndex + amount),
    }));
  }, [constrainCursor]);

  const moveCursorUp = useCallback((amount: number = 1) => {
    setSelection((prev) => ({
      ...prev,
      cursorIndex: constrainCursor(prev.cursorIndex - amount),
    }));
  }, [constrainCursor]);

  const cursorToTop = useCallback(() => {
    setSelection((prev) => ({ ...prev, cursorIndex: 0 }));
  }, []);

  const cursorToBottom = useCallback(() => {
    setSelection((prev) => ({
      ...prev,
      cursorIndex: Math.max(0, entries.length - 1),
    }));
  }, [entries.length]);

  // Visual selection
  const startVisualSelection = useCallback(() => {
    setSelection((prev) => ({
      ...prev,
      selectionStart: prev.cursorIndex,
      selectionEnd: prev.cursorIndex,
      isActive: true,
    }));
    setMode(EditMode.Visual);
  }, []);

  const extendVisualSelection = useCallback((direction: 'up' | 'down') => {
    setSelection((prev) => {
      if (!prev.isActive || prev.selectionStart === undefined) return prev;

      const newEnd = direction === 'up' ? prev.cursorIndex - 1 : prev.cursorIndex + 1;
      return {
        ...prev,
        selectionEnd: constrainCursor(newEnd),
        cursorIndex: constrainCursor(newEnd),
      };
    });
  }, [constrainCursor]);

  const exitVisualSelection = useCallback(() => {
    setSelection((prev) => ({
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

  // Sorting
  const setSortConfig = useCallback((config: SortConfig) => {
    setSortConfigState(config);
    setEntries((prev) => sortEntries([...prev], config));
  }, []);

  // Search
  const updateSearchQuery = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  // Display options
  const toggleHiddenFiles = useCallback(() => {
    setShowHiddenFiles((prev) => !prev);
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

    const start = Math.min(selection.selectionStart, selection.selectionEnd ?? selection.selectionStart);
    const end = Math.max(selection.selectionStart, selection.selectionEnd ?? selection.selectionStart);
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

  return {
    entries,
    originalEntries,
    mode,
    selection,
    currentPath: initialPath,
    sortConfig,
    showHiddenFiles,
    searchQuery,
    scrollOffset,
    copyRegister,

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
