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
  scrollOffset: number;
  viewportHeight: number;
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
  scrollOffset: 0,
  viewportHeight: 20,
  editBuffer: '',
  editBufferCursor: 0,
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
        scrollOffset: 0,
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
