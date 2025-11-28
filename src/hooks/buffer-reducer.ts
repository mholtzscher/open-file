import { Entry } from '../types/entry.js';
import { EditMode } from '../types/edit-mode.js';
import { SortConfig, DEFAULT_SORT_CONFIG, sortEntries } from '../utils/sorting.js';

// ============================================================================
// State Types
// ============================================================================

export interface SelectionState {
  cursorIndex: number;
  selectionStart?: number;
  selectionEnd?: number;
  isActive: boolean;
}

export type BufferSnapshot = {
  entries: Entry[];
  deletedIds: Set<string>;
};

export interface BufferState {
  entries: Entry[];
  originalEntries: Entry[];
  currentPath: string;
  mode: EditMode;
  selection: SelectionState;
  sortConfig: SortConfig;
  showHiddenFiles: boolean;
  searchQuery: string;
  scrollOffset: number;
  copyRegister: Entry[];
  viewportHeight: number;
  editBuffer: string;
  undoHistory: BufferSnapshot[];
  redoHistory: BufferSnapshot[];
  deletedEntryIds: Set<string>;
}

export const INITIAL_BUFFER_STATE: BufferState = {
  entries: [],
  originalEntries: [],
  currentPath: '',
  mode: EditMode.Normal,
  selection: { cursorIndex: 0, isActive: false },
  sortConfig: DEFAULT_SORT_CONFIG,
  showHiddenFiles: false,
  searchQuery: '',
  scrollOffset: 0,
  copyRegister: [],
  viewportHeight: 20,
  editBuffer: '',
  undoHistory: [],
  redoHistory: [],
  deletedEntryIds: new Set(),
};

// ============================================================================
// Actions
// ============================================================================

export type BufferAction =
  | { type: 'SET_ENTRIES'; entries: Entry[] }
  | { type: 'SET_CURRENT_PATH'; path: string }
  | { type: 'SET_VIEWPORT_HEIGHT'; height: number }
  | { type: 'MOVE_CURSOR'; amount: number }
  | { type: 'CURSOR_TO_TOP' }
  | { type: 'CURSOR_TO_BOTTOM' }
  | { type: 'START_VISUAL_SELECTION' }
  | { type: 'EXTEND_VISUAL_SELECTION'; direction: 'up' | 'down' }
  | { type: 'EXIT_VISUAL_SELECTION' }
  | { type: 'SET_MODE'; mode: EditMode }
  | { type: 'SET_SORT_CONFIG'; config: SortConfig }
  | { type: 'UPDATE_SEARCH_QUERY'; query: string }
  | { type: 'TOGGLE_HIDDEN_FILES' }
  | { type: 'COPY_SELECTION' }
  | { type: 'PASTE_AFTER_CURSOR' }
  | { type: 'SET_EDIT_BUFFER'; text: string }
  | { type: 'APPEND_TO_EDIT_BUFFER'; char: string }
  | { type: 'BACKSPACE_EDIT_BUFFER' }
  | { type: 'CLEAR_EDIT_BUFFER' }
  | { type: 'MARK_FOR_DELETION'; entryId: string }
  | { type: 'UNMARK_FOR_DELETION'; entryId: string }
  | { type: 'CLEAR_DELETION_MARKS' }
  | { type: 'SAVE_SNAPSHOT' }
  | { type: 'UNDO' }
  | { type: 'REDO' };

// ============================================================================
// Helpers
// ============================================================================

function constrainCursor(index: number, length: number): number {
  if (length === 0) return 0;
  return Math.max(0, Math.min(index, length - 1));
}

function calculateScrollOffset(
  currentOffset: number,
  cursorIndex: number,
  viewportHeight: number
): number {
  // If cursor is above viewport, scroll up
  if (cursorIndex < currentOffset) {
    return cursorIndex;
  }
  // If cursor is below viewport, scroll down
  if (cursorIndex >= currentOffset + viewportHeight) {
    return cursorIndex - viewportHeight + 1;
  }
  // Cursor is visible, no scroll needed
  return currentOffset;
}

function getSelectedEntries(state: BufferState): Entry[] {
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
}

// ============================================================================
// Reducer
// ============================================================================

export function bufferReducer(state: BufferState, action: BufferAction): BufferState {
  switch (action.type) {
    case 'SET_ENTRIES': {
      // When entries change, re-sort them based on current config
      const sortedEntries = sortEntries([...action.entries], state.sortConfig);
      // Ensure cursor is still valid
      const newCursorIndex = constrainCursor(state.selection.cursorIndex, sortedEntries.length);
      const newScrollOffset = calculateScrollOffset(
        state.scrollOffset,
        newCursorIndex,
        state.viewportHeight
      );

      return {
        ...state,
        entries: sortedEntries,
        selection: {
          ...state.selection,
          cursorIndex: newCursorIndex,
        },
        scrollOffset: newScrollOffset,
      };
    }

    case 'SET_CURRENT_PATH':
      return {
        ...state,
        currentPath: action.path,
      };

    case 'SET_VIEWPORT_HEIGHT':
      return {
        ...state,
        viewportHeight: action.height,
        // Re-calculate scroll offset with new height
        scrollOffset: calculateScrollOffset(
          state.scrollOffset,
          state.selection.cursorIndex,
          action.height
        ),
      };

    case 'MOVE_CURSOR': {
      const newIndex = constrainCursor(
        state.selection.cursorIndex + action.amount,
        state.entries.length
      );
      const newScrollOffset = calculateScrollOffset(
        state.scrollOffset,
        newIndex,
        state.viewportHeight
      );

      return {
        ...state,
        selection: {
          ...state.selection,
          cursorIndex: newIndex,
          // Update selection end if in visual mode?
          // The original code uses a separate `extendVisualSelection` method.
          // But `moveCursor` updates `cursorIndex` which might affect visualization.
          // In original code `moveCursor` just updates cursorIndex and calls `setSelection`.
          // Wait, `moveCursorDown` in original code:
          // setSelection(prev => { ... cursorIndex: newIndex })
          // It implies visual selection end is NOT automatically updated by simple move,
          // unless we are "extending".
        },
        scrollOffset: newScrollOffset,
      };
    }

    case 'CURSOR_TO_TOP':
      return {
        ...state,
        selection: {
          ...state.selection,
          cursorIndex: 0,
        },
        scrollOffset: 0,
      };

    case 'CURSOR_TO_BOTTOM': {
      const newIndex = Math.max(0, state.entries.length - 1);
      const newScrollOffset = calculateScrollOffset(
        state.scrollOffset,
        newIndex,
        state.viewportHeight
      );
      return {
        ...state,
        selection: {
          ...state.selection,
          cursorIndex: newIndex,
        },
        scrollOffset: newScrollOffset,
      };
    }

    case 'START_VISUAL_SELECTION':
      return {
        ...state,
        mode: EditMode.Visual,
        selection: {
          ...state.selection,
          isActive: true,
          selectionStart: state.selection.cursorIndex,
          selectionEnd: state.selection.cursorIndex,
        },
      };

    case 'EXTEND_VISUAL_SELECTION': {
      if (!state.selection.isActive || state.selection.selectionStart === undefined) {
        return state;
      }
      const newEnd =
        action.direction === 'up'
          ? state.selection.cursorIndex - 1
          : state.selection.cursorIndex + 1;
      const newIndex = constrainCursor(newEnd, state.entries.length);
      const newScrollOffset = calculateScrollOffset(
        state.scrollOffset,
        newIndex,
        state.viewportHeight
      );

      return {
        ...state,
        selection: {
          ...state.selection,
          cursorIndex: newIndex,
          selectionEnd: newIndex,
        },
        scrollOffset: newScrollOffset,
      };
    }

    case 'EXIT_VISUAL_SELECTION':
      return {
        ...state,
        selection: {
          ...state.selection,
          isActive: false,
          selectionStart: undefined,
          selectionEnd: undefined,
        },
        // Don't necessarily change mode here, the caller usually does SET_MODE(Normal)
        // But original code `exitVisualSelection` didn't change mode, the caller `mode:normal` handler did.
        // Actually `exitVisualSelection` just reset selection state.
      };

    case 'SET_MODE':
      return {
        ...state,
        mode: action.mode,
        // Reset edit buffer on mode changes if needed?
        // Original code:
        // enterCommandMode -> setEditBuffer(':')
        // exitCommandMode -> setEditBuffer('')
        // exitSearchMode -> setSearchQuery('')
        // Let's handle side effects here or in dispatch call sites.
        // Better to handle state consistency here.
        editBuffer:
          action.mode === EditMode.Command
            ? ':'
            : action.mode === EditMode.Normal
              ? ''
              : state.editBuffer,
        searchQuery:
          action.mode === EditMode.Normal && state.mode === EditMode.Search
            ? ''
            : state.searchQuery,
      };

    case 'SET_SORT_CONFIG': {
      const sortedEntries = sortEntries([...state.entries], action.config);
      return {
        ...state,
        sortConfig: action.config,
        entries: sortedEntries,
      };
    }

    case 'UPDATE_SEARCH_QUERY':
      return {
        ...state,
        searchQuery: action.query,
      };

    case 'TOGGLE_HIDDEN_FILES':
      return {
        ...state,
        showHiddenFiles: !state.showHiddenFiles,
      };

    case 'COPY_SELECTION': {
      const selected = getSelectedEntries(state);
      // Clone entries to copy register
      const toCopy = structuredClone(selected);
      return {
        ...state,
        copyRegister: toCopy,
      };
    }

    case 'PASTE_AFTER_CURSOR': {
      if (state.copyRegister.length === 0) return state;

      const insertIndex = state.selection.cursorIndex + 1;
      const newEntries = [...state.entries];
      // We need deep clones of registered entries to avoid reference issues
      const entriesToPaste = structuredClone(state.copyRegister);
      newEntries.splice(insertIndex, 0, ...entriesToPaste);

      return {
        ...state,
        entries: newEntries,
      };
    }

    case 'SET_EDIT_BUFFER':
      return {
        ...state,
        editBuffer: action.text,
      };

    case 'APPEND_TO_EDIT_BUFFER':
      return {
        ...state,
        editBuffer: state.editBuffer + action.char,
      };

    case 'BACKSPACE_EDIT_BUFFER':
      return {
        ...state,
        editBuffer: state.editBuffer.slice(0, -1),
      };

    case 'CLEAR_EDIT_BUFFER':
      return {
        ...state,
        editBuffer: '',
      };

    case 'MARK_FOR_DELETION': {
      const newDeletedIds = new Set(state.deletedEntryIds);
      newDeletedIds.add(action.entryId);
      return {
        ...state,
        deletedEntryIds: newDeletedIds,
      };
    }

    case 'UNMARK_FOR_DELETION': {
      const newDeletedIds = new Set(state.deletedEntryIds);
      newDeletedIds.delete(action.entryId);
      return {
        ...state,
        deletedEntryIds: newDeletedIds,
      };
    }

    case 'CLEAR_DELETION_MARKS':
      return {
        ...state,
        deletedEntryIds: new Set(),
      };

    case 'SAVE_SNAPSHOT': {
      const snapshot: BufferSnapshot = {
        entries: structuredClone(state.entries),
        deletedIds: new Set(state.deletedEntryIds),
      };
      return {
        ...state,
        undoHistory: [...state.undoHistory, snapshot],
        redoHistory: [], // Clear redo history on new action
      };
    }

    case 'UNDO': {
      if (state.undoHistory.length === 0) return state;

      // Save current state to redo
      const currentSnapshot: BufferSnapshot = {
        entries: structuredClone(state.entries),
        deletedIds: new Set(state.deletedEntryIds),
      };

      // Get previous state
      const previousSnapshot = state.undoHistory[state.undoHistory.length - 1];

      return {
        ...state,
        entries: previousSnapshot.entries,
        deletedEntryIds: previousSnapshot.deletedIds,
        undoHistory: state.undoHistory.slice(0, -1),
        redoHistory: [...state.redoHistory, currentSnapshot],
      };
    }

    case 'REDO': {
      if (state.redoHistory.length === 0) return state;

      // Save current state to undo
      const currentSnapshot: BufferSnapshot = {
        entries: structuredClone(state.entries),
        deletedIds: new Set(state.deletedEntryIds),
      };

      // Get next state
      const nextSnapshot = state.redoHistory[state.redoHistory.length - 1];

      return {
        ...state,
        entries: nextSnapshot.entries,
        deletedEntryIds: nextSnapshot.deletedIds,
        redoHistory: state.redoHistory.slice(0, -1),
        undoHistory: [...state.undoHistory, currentSnapshot],
      };
    }

    default:
      return state;
  }
}
