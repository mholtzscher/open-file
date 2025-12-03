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

export interface BufferState {
  entries: Entry[];
  currentPath: string;
  mode: EditMode;
  selection: SelectionState;
  sortConfig: SortConfig;
  showHiddenFiles: boolean;
  searchQuery: string;
  editBuffer: string;
  editBufferCursor: number;
}

export const INITIAL_BUFFER_STATE: BufferState = {
  entries: [],
  currentPath: '',
  mode: EditMode.Normal,
  selection: { cursorIndex: 0, isActive: false },
  sortConfig: DEFAULT_SORT_CONFIG,
  showHiddenFiles: false,
  searchQuery: '',
  editBuffer: '',
  editBufferCursor: 0,
};

// ============================================================================
// Actions
// ============================================================================

export type BufferAction =
  | { type: 'SET_ENTRIES'; entries: Entry[] }
  | { type: 'SET_CURRENT_PATH'; path: string }
  | { type: 'MOVE_CURSOR'; amount: number }
  | { type: 'CURSOR_TO_TOP' }
  | { type: 'CURSOR_TO_BOTTOM' }
  | { type: 'START_VISUAL_SELECTION' }
  | { type: 'EXTEND_VISUAL_SELECTION'; direction: 'up' | 'down' }
  | { type: 'EXIT_VISUAL_SELECTION' }
  | { type: 'SET_MODE'; mode: EditMode; initialEditBuffer?: string }
  | { type: 'CONFIRM_SEARCH_MODE' }
  | { type: 'SET_SORT_CONFIG'; config: SortConfig }
  | { type: 'UPDATE_SEARCH_QUERY'; query: string }
  | { type: 'TOGGLE_HIDDEN_FILES' }
  | { type: 'SET_EDIT_BUFFER'; text: string }
  | { type: 'INSERT_AT_EDIT_CURSOR'; char: string }
  | { type: 'BACKSPACE_EDIT_BUFFER' }
  | { type: 'DELETE_AT_EDIT_CURSOR' }
  | { type: 'CLEAR_EDIT_BUFFER' }
  | { type: 'MOVE_EDIT_CURSOR'; direction: 'left' | 'right' }
  | { type: 'MOVE_EDIT_CURSOR_TO_START' }
  | { type: 'MOVE_EDIT_CURSOR_TO_END' };

// ============================================================================
// Helpers
// ============================================================================

function constrainCursor(index: number, length: number): number {
  if (length === 0) return 0;
  return Math.max(0, Math.min(index, length - 1));
}

export function getFilteredEntries(state: BufferState): Entry[] {
  if (!state.searchQuery) {
    return state.entries;
  }
  const query = state.searchQuery.toLowerCase();
  return state.entries.filter(entry => entry.name.toLowerCase().includes(query));
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

      return {
        ...state,
        entries: sortedEntries,
        // Clear search query when navigating to new directory
        searchQuery: '',
        // Reset selection to avoid stale indices referencing old filtered list
        selection: {
          cursorIndex: newCursorIndex,
          isActive: false,
          selectionStart: undefined,
          selectionEnd: undefined,
        },
      };
    }

    case 'SET_CURRENT_PATH':
      return {
        ...state,
        currentPath: action.path,
      };

    case 'MOVE_CURSOR': {
      const filteredEntries = getFilteredEntries(state);
      const newIndex = constrainCursor(
        state.selection.cursorIndex + action.amount,
        filteredEntries.length
      );

      return {
        ...state,
        selection: {
          ...state.selection,
          cursorIndex: newIndex,
        },
      };
    }

    case 'CURSOR_TO_TOP':
      return {
        ...state,
        selection: {
          ...state.selection,
          cursorIndex: 0,
        },
      };

    case 'CURSOR_TO_BOTTOM': {
      const filteredEntries = getFilteredEntries(state);
      const newIndex = Math.max(0, filteredEntries.length - 1);
      return {
        ...state,
        selection: {
          ...state.selection,
          cursorIndex: newIndex,
        },
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
      const filteredEntries = getFilteredEntries(state);
      const newEnd =
        action.direction === 'up'
          ? state.selection.cursorIndex - 1
          : state.selection.cursorIndex + 1;
      const newIndex = constrainCursor(newEnd, filteredEntries.length);

      return {
        ...state,
        selection: {
          ...state.selection,
          cursorIndex: newIndex,
          selectionEnd: newIndex,
        },
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
      };

    case 'SET_MODE': {
      // Determine edit buffer based on mode
      let editBuffer: string;
      let editBufferCursor: number;
      if (action.mode === EditMode.Command) {
        editBuffer = ':';
        editBufferCursor = 1;
      } else if (action.mode === EditMode.Edit) {
        editBuffer = action.initialEditBuffer ?? '';
        editBufferCursor = editBuffer.length; // Cursor at end
      } else if (action.mode === EditMode.Normal) {
        editBuffer = '';
        editBufferCursor = 0;
      } else {
        editBuffer = state.editBuffer;
        editBufferCursor = state.editBufferCursor;
      }

      return {
        ...state,
        mode: action.mode,
        editBuffer,
        editBufferCursor,
        searchQuery:
          action.mode === EditMode.Normal && state.mode === EditMode.Search
            ? ''
            : state.searchQuery,
      };
    }

    case 'CONFIRM_SEARCH_MODE':
      // Keep search query when confirming search mode
      return {
        ...state,
        mode: EditMode.Normal,
        editBuffer: '',
        // searchQuery is preserved
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
        // Reset cursor to beginning when search query changes to avoid out-of-bounds
        selection: {
          ...state.selection,
          cursorIndex: 0,
          isActive: false,
          selectionStart: undefined,
          selectionEnd: undefined,
        },
      };

    case 'TOGGLE_HIDDEN_FILES':
      return {
        ...state,
        showHiddenFiles: !state.showHiddenFiles,
      };

    case 'SET_EDIT_BUFFER':
      return {
        ...state,
        editBuffer: action.text,
        editBufferCursor: action.text.length,
      };

    case 'INSERT_AT_EDIT_CURSOR': {
      const before = state.editBuffer.slice(0, state.editBufferCursor);
      const after = state.editBuffer.slice(state.editBufferCursor);
      return {
        ...state,
        editBuffer: before + action.char + after,
        editBufferCursor: state.editBufferCursor + 1,
      };
    }

    case 'BACKSPACE_EDIT_BUFFER': {
      if (state.editBufferCursor === 0) return state;
      const before = state.editBuffer.slice(0, state.editBufferCursor - 1);
      const after = state.editBuffer.slice(state.editBufferCursor);
      return {
        ...state,
        editBuffer: before + after,
        editBufferCursor: state.editBufferCursor - 1,
      };
    }

    case 'DELETE_AT_EDIT_CURSOR': {
      if (state.editBufferCursor >= state.editBuffer.length) return state;
      const before = state.editBuffer.slice(0, state.editBufferCursor);
      const after = state.editBuffer.slice(state.editBufferCursor + 1);
      return {
        ...state,
        editBuffer: before + after,
      };
    }

    case 'CLEAR_EDIT_BUFFER':
      return {
        ...state,
        editBuffer: '',
        editBufferCursor: 0,
      };

    case 'MOVE_EDIT_CURSOR':
      if (action.direction === 'left') {
        return {
          ...state,
          editBufferCursor: Math.max(0, state.editBufferCursor - 1),
        };
      } else {
        return {
          ...state,
          editBufferCursor: Math.min(state.editBuffer.length, state.editBufferCursor + 1),
        };
      }

    case 'MOVE_EDIT_CURSOR_TO_START':
      return {
        ...state,
        editBufferCursor: 0,
      };

    case 'MOVE_EDIT_CURSOR_TO_END':
      return {
        ...state,
        editBufferCursor: state.editBuffer.length,
      };

    default:
      return state;
  }
}
