/**
 * Local Context
 *
 * Manages all UI-only state following the SST/OpenCode pattern.
 * This context handles:
 * - Buffer state (selection, mode, edit buffer)
 * - Progress state
 * - Status messages
 * - Preview state
 * - Sorting and filtering
 *
 * Note: Dialog state is managed by DialogContext, not here.
 */

import { createStore, produce } from 'solid-js/store';
import { batch, createMemo, createEffect, on } from 'solid-js';
import { createSimpleContext, iife } from './helper.js';
import { useSync } from './sync.js';
import { EditMode } from '../types/edit-mode.js';
import {
  SortConfig,
  DEFAULT_SORT_CONFIG,
  sortEntries,
  SortField,
  SortOrder,
} from '../utils/sorting.js';
import type { Entry } from '../types/entry.js';
import type { ProgressState } from '../types/progress.js';

// ============================================================================
// Store Types
// ============================================================================

export interface SelectionState {
  cursorIndex: number;
  selectionStart?: number;
  selectionEnd?: number;
  isActive: boolean;
}

export interface LocalStore {
  // Buffer state
  mode: EditMode;
  selection: SelectionState;
  sortConfig: SortConfig;
  showHiddenFiles: boolean;
  searchQuery: string;
  scrollOffset: number;
  copyRegister: Entry[];
  viewportHeight: number;
  editBuffer: string;
  editBufferCursor: number;

  // Progress state
  progress: ProgressState;

  // Status message
  statusMessage: string;
  statusMessageColor: string;
  statusIsError: boolean;

  // Preview state
  previewEnabled: boolean;
  previewContent: string | null;
  previewFilename: string;
  previewLoading: boolean;
  previewError: string | null;
}

const INITIAL_LOCAL_STORE: LocalStore = {
  // Buffer state
  mode: EditMode.Normal,
  selection: { cursorIndex: 0, isActive: false },
  sortConfig: DEFAULT_SORT_CONFIG,
  showHiddenFiles: false,
  searchQuery: '',
  scrollOffset: 0,
  copyRegister: [],
  viewportHeight: 20,
  editBuffer: '',
  editBufferCursor: 0,

  // Progress state
  progress: {
    visible: false,
    title: '',
    description: '',
    value: 0,
    currentFile: '',
    currentNum: 0,
    totalNum: 0,
    cancellable: true,
    cancelled: false,
  },

  // Status message
  statusMessage: '',
  statusMessageColor: '',
  statusIsError: false,

  // Preview state
  previewEnabled: false,
  previewContent: null,
  previewFilename: '',
  previewLoading: false,
  previewError: null,
};

// ============================================================================
// Context
// ============================================================================

export const { use: useLocal, Provider: LocalProvider } = createSimpleContext({
  name: 'Local',
  init: () => {
    const sync = useSync();
    const [store, setStore] = createStore<LocalStore>(INITIAL_LOCAL_STORE);

    // Helper to constrain cursor
    const constrainCursor = (index: number, length: number): number => {
      if (length === 0) return 0;
      return Math.max(0, Math.min(index, length - 1));
    };

    // Adjust cursor when entries change
    createEffect(
      on(
        () => sync.data.entries.length,
        length => {
          if (store.selection.cursorIndex >= length) {
            setStore(
              'selection',
              'cursorIndex',
              constrainCursor(store.selection.cursorIndex, length)
            );
          }
        }
      )
    );

    // ========================================================================
    // Buffer Actions
    // ========================================================================
    const buffer = iife(() => ({
      setViewportHeight: (height: number) => {
        setStore('viewportHeight', height);
      },

      // Cursor movement
      moveCursorDown: (amount: number = 1) => {
        const newIndex = constrainCursor(
          store.selection.cursorIndex + amount,
          sync.data.entries.length
        );
        setStore('selection', 'cursorIndex', newIndex);
      },

      moveCursorUp: (amount: number = 1) => {
        const newIndex = constrainCursor(
          store.selection.cursorIndex - amount,
          sync.data.entries.length
        );
        setStore('selection', 'cursorIndex', newIndex);
      },

      cursorToTop: () => {
        setStore('selection', 'cursorIndex', 0);
      },

      cursorToBottom: () => {
        setStore('selection', 'cursorIndex', Math.max(0, sync.data.entries.length - 1));
      },

      // Visual selection
      startVisualSelection: () => {
        setStore(
          'selection',
          produce(sel => {
            sel.isActive = true;
            sel.selectionStart = sel.cursorIndex;
            sel.selectionEnd = sel.cursorIndex;
          })
        );
      },

      extendVisualSelection: (direction: 'up' | 'down') => {
        const newIndex = constrainCursor(
          store.selection.cursorIndex + (direction === 'down' ? 1 : -1),
          sync.data.entries.length
        );
        setStore(
          'selection',
          produce(sel => {
            sel.cursorIndex = newIndex;
            sel.selectionEnd = newIndex;
          })
        );
      },

      exitVisualSelection: () => {
        setStore(
          'selection',
          produce(sel => {
            sel.isActive = false;
            sel.selectionStart = undefined;
            sel.selectionEnd = undefined;
          })
        );
      },

      // Mode operations
      setMode: (mode: EditMode, initialEditBuffer?: string) => {
        batch(() => {
          setStore('mode', mode);
          if (initialEditBuffer !== undefined) {
            setStore('editBuffer', initialEditBuffer);
            setStore('editBufferCursor', initialEditBuffer.length);
          } else if (mode === EditMode.Normal) {
            setStore('editBuffer', '');
            setStore('editBufferCursor', 0);
          }
        });
      },

      enterInsertMode: () => buffer.setMode(EditMode.Insert),
      exitInsertMode: () => buffer.setMode(EditMode.Normal),
      enterEditMode: (initialValue?: string) => buffer.setMode(EditMode.Edit, initialValue),
      exitEditMode: () => buffer.setMode(EditMode.Normal),
      enterSearchMode: () => buffer.setMode(EditMode.Search),
      exitSearchMode: () => buffer.setMode(EditMode.Normal),
      enterCommandMode: () => buffer.setMode(EditMode.Command),
      exitCommandMode: () => buffer.setMode(EditMode.Normal),

      // Edit buffer
      setEditBuffer: (text: string) => {
        setStore('editBuffer', text);
        setStore('editBufferCursor', text.length);
      },

      insertAtEditCursor: (char: string) => {
        const pos = store.editBufferCursor;
        const newBuffer = store.editBuffer.slice(0, pos) + char + store.editBuffer.slice(pos);
        setStore('editBuffer', newBuffer);
        setStore('editBufferCursor', pos + char.length);
      },

      backspaceEditBuffer: () => {
        if (store.editBufferCursor > 0) {
          const pos = store.editBufferCursor;
          const newBuffer = store.editBuffer.slice(0, pos - 1) + store.editBuffer.slice(pos);
          setStore('editBuffer', newBuffer);
          setStore('editBufferCursor', pos - 1);
        }
      },

      deleteAtEditCursor: () => {
        if (store.editBufferCursor < store.editBuffer.length) {
          const pos = store.editBufferCursor;
          const newBuffer = store.editBuffer.slice(0, pos) + store.editBuffer.slice(pos + 1);
          setStore('editBuffer', newBuffer);
        }
      },

      clearEditBuffer: () => {
        setStore('editBuffer', '');
        setStore('editBufferCursor', 0);
      },

      moveEditCursor: (direction: 'left' | 'right') => {
        const newPos =
          direction === 'left'
            ? Math.max(0, store.editBufferCursor - 1)
            : Math.min(store.editBuffer.length, store.editBufferCursor + 1);
        setStore('editBufferCursor', newPos);
      },

      moveEditCursorToStart: () => setStore('editBufferCursor', 0),
      moveEditCursorToEnd: () => setStore('editBufferCursor', store.editBuffer.length),

      // Sorting
      setSortConfig: (config: SortConfig) => {
        setStore('sortConfig', config);
      },

      setSortField: (field: SortField) => {
        setStore('sortConfig', 'field', field);
      },

      toggleSortOrder: () => {
        setStore(
          'sortConfig',
          'order',
          store.sortConfig.order === SortOrder.Ascending
            ? SortOrder.Descending
            : SortOrder.Ascending
        );
      },

      // Search
      updateSearchQuery: (query: string) => {
        setStore('searchQuery', query);
      },

      // Display options
      toggleHiddenFiles: () => {
        setStore('showHiddenFiles', !store.showHiddenFiles);
      },

      // Copy/paste
      copySelection: () => {
        const entries = buffer.getSelectedEntries();
        setStore('copyRegister', [...entries]);
      },

      hasClipboardContent: () => store.copyRegister.length > 0,

      // Getters
      getSelectedEntry: (): Entry | undefined => {
        return sync.data.entries[store.selection.cursorIndex];
      },

      getSelectedEntries: (): Entry[] => {
        const entries = sync.data.entries;
        if (!store.selection.isActive || store.selection.selectionStart === undefined) {
          const entry = entries[store.selection.cursorIndex];
          return entry ? [entry] : [];
        }
        const start = Math.min(
          store.selection.selectionStart,
          store.selection.selectionEnd ?? store.selection.selectionStart
        );
        const end = Math.max(
          store.selection.selectionStart,
          store.selection.selectionEnd ?? store.selection.selectionStart
        );
        return entries.slice(start, end + 1);
      },

      getSortedEntries: (): Entry[] => {
        return sortEntries(sync.data.entries, store.sortConfig);
      },

      getFilteredEntries: (): Entry[] => {
        let entries = sync.data.entries;
        if (store.searchQuery) {
          const query = store.searchQuery.toLowerCase();
          entries = entries.filter(e => e.name.toLowerCase().includes(query));
        }
        if (!store.showHiddenFiles) {
          entries = entries.filter(e => !e.name.startsWith('.'));
        }
        return sortEntries(entries, store.sortConfig);
      },
    }));

    // ========================================================================
    // Progress Actions
    // ========================================================================
    const progress = iife(() => ({
      show: (options: {
        title: string;
        description?: string;
        totalNum?: number;
        cancellable?: boolean;
      }) => {
        setStore('progress', {
          visible: true,
          title: options.title,
          description: options.description || '',
          value: 0,
          currentFile: '',
          currentNum: 0,
          totalNum: options.totalNum || 0,
          cancellable: options.cancellable ?? true,
          cancelled: false,
        });
      },

      update: (updates: Partial<ProgressState>) => {
        setStore(
          'progress',
          produce(p => Object.assign(p, updates))
        );
      },

      setFile: (file: string, num: number) => {
        const value = store.progress.totalNum > 0 ? (num / store.progress.totalNum) * 100 : 0;
        setStore(
          'progress',
          produce(p => {
            p.currentFile = file;
            p.currentNum = num;
            p.value = value;
          })
        );
      },

      hide: () => setStore('progress', 'visible', false),
      cancel: () => setStore('progress', 'cancelled', true),
      reset: () => setStore('progress', INITIAL_LOCAL_STORE.progress),
    }));

    // ========================================================================
    // Status Actions
    // ========================================================================
    const status = iife(() => ({
      setMessage: (message: string, color?: string, isError?: boolean) => {
        batch(() => {
          setStore('statusMessage', message);
          if (color) setStore('statusMessageColor', color);
          if (isError !== undefined) setStore('statusIsError', isError);
        });
      },

      setSuccess: (message: string, color: string) => {
        status.setMessage(message, color, false);
      },

      setError: (message: string, color: string) => {
        status.setMessage(message, color, true);
      },

      clear: () => {
        batch(() => {
          setStore('statusMessage', '');
          setStore('statusIsError', false);
        });
      },
    }));

    // ========================================================================
    // Preview Actions
    // ========================================================================
    const preview = iife(() => ({
      setEnabled: (enabled: boolean) => {
        setStore('previewEnabled', enabled);
      },

      toggle: () => {
        setStore('previewEnabled', !store.previewEnabled);
      },

      setContent: (content: string | null, filename: string) => {
        batch(() => {
          setStore('previewContent', content);
          setStore('previewFilename', filename);
          setStore('previewLoading', false);
          setStore('previewError', null);
        });
      },

      setLoading: (loading: boolean) => {
        setStore('previewLoading', loading);
      },

      setError: (error: string | null) => {
        setStore('previewError', error);
      },

      clear: () => {
        batch(() => {
          setStore('previewContent', null);
          setStore('previewFilename', '');
          setStore('previewError', null);
        });
      },
    }));

    // ========================================================================
    // Computed Values
    // ========================================================================
    const selectedEntry = createMemo(() => sync.data.entries[store.selection.cursorIndex]);

    return {
      /** Reactive store data */
      data: store,
      /** Selected entry (computed) */
      selectedEntry,
      /** Buffer actions */
      buffer,
      /** Progress actions */
      progress,
      /** Status message actions */
      status,
      /** Preview actions */
      preview,
    };
  },
});
