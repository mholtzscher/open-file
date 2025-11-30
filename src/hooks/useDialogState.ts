/**
 * useDialogState Hook
 *
 * Consolidates dialog visibility state into a single reducer-based hook.
 * Replaces separate useState calls for each dialog with unified state management.
 * Only one dialog can be active at a time, preventing conflicting states.
 */

import { createSignal, createMemo } from 'solid-js';
import { DialogState, DialogAction, PendingOperation } from '../types/dialog.js';

/**
 * Initial state for dialog management
 */
export const initialDialogState: DialogState = {
  activeDialog: null,
  pendingOperations: [],
  quitPendingChanges: 0,
};

/**
 * Dialog state reducer
 * Handles all dialog-related state transitions
 */
export function dialogReducer(state: DialogState, action: DialogAction): DialogState {
  switch (action.type) {
    case 'SHOW_CONFIRM':
      return {
        ...state,
        activeDialog: 'confirm',
        pendingOperations: action.payload.operations,
      };

    case 'SHOW_HELP':
      return {
        ...state,
        activeDialog: 'help',
      };

    case 'SHOW_SORT':
      return {
        ...state,
        activeDialog: 'sort',
      };

    case 'SHOW_UPLOAD':
      return {
        ...state,
        activeDialog: 'upload',
      };

    case 'SHOW_QUIT':
      return {
        ...state,
        activeDialog: 'quit',
        quitPendingChanges: action.payload.pendingChanges,
      };

    case 'SHOW_PROFILE_SELECTOR':
      return {
        ...state,
        activeDialog: 'profileSelector',
      };

    case 'SHOW_THEME_SELECTOR':
      return {
        ...state,
        activeDialog: 'themeSelector',
      };

    case 'CLOSE':
      return {
        ...state,
        activeDialog: null,
      };

    case 'CLEAR_OPERATIONS':
      return {
        ...state,
        pendingOperations: [],
      };

    default:
      return state;
  }
}

/**
 * Return type for the useDialogState hook
 */
export interface UseDialogStateReturn {
  /** Current dialog state (call as function in Solid) */
  dialog: () => DialogState;
  /** Whether any dialog is currently open (call as function) */
  isDialogOpen: () => boolean;
  /** Whether the confirm dialog is open (call as function) */
  isConfirmOpen: () => boolean;
  /** Whether the help dialog is open (call as function) */
  isHelpOpen: () => boolean;
  /** Whether the sort menu is open (call as function) */
  isSortOpen: () => boolean;
  /** Whether the upload dialog is open (call as function) */
  isUploadOpen: () => boolean;
  /** Whether the quit confirmation dialog is open (call as function) */
  isQuitOpen: () => boolean;
  /** Whether the profile selector dialog is open (call as function) */
  isProfileSelectorOpen: () => boolean;
  /** Whether the theme selector dialog is open (call as function) */
  isThemeSelectorOpen: () => boolean;
  /** Show the confirm dialog with pending operations */
  showConfirm: (operations: PendingOperation[]) => void;
  /** Show the help dialog */
  showHelp: () => void;
  /** Toggle the help dialog */
  toggleHelp: () => void;
  /** Show the sort menu */
  showSort: () => void;
  /** Toggle the sort menu */
  toggleSort: () => void;
  /** Show the upload dialog */
  showUpload: () => void;
  /** Show the quit confirmation dialog */
  showQuit: (pendingChanges: number) => void;
  /** Show the profile selector dialog */
  showProfileSelector: () => void;
  /** Show the theme selector dialog */
  showThemeSelector: () => void;
  /** Close any open dialog */
  closeDialog: () => void;
  /** Close dialog and clear pending operations */
  closeAndClearOperations: () => void;
  /** Direct dispatch for advanced use cases */
  dispatch: (action: DialogAction) => void;
}

/**
 * Hook for managing dialog state
 *
 * Consolidates 4 separate useState calls into a single reducer:
 * - showConfirmDialog
 * - showHelpDialog
 * - showSortMenu
 * - showUploadDialog
 *
 * Also manages pendingOperations which are associated with confirm dialog.
 *
 * @example
 * ```tsx
 * const { isHelpOpen, showHelp, closeDialog } = useDialogState();
 *
 * // Show help dialog
 * showHelp();
 *
 * // Show confirm with operations
 * showConfirm([{ id: '1', type: 'delete', path: '/file.txt' }]);
 *
 * // Close any open dialog
 * closeDialog();
 * ```
 */
export function useDialogState(): UseDialogStateReturn {
  const [state, setState] = createSignal<DialogState>(initialDialogState);

  const dispatch = (action: DialogAction) => {
    setState(prev => dialogReducer(prev, action));
  };

  const showConfirm = (operations: PendingOperation[]) => {
    dispatch({ type: 'SHOW_CONFIRM', payload: { operations } });
  };

  const showHelp = () => {
    dispatch({ type: 'SHOW_HELP' });
  };

  const toggleHelp = () => {
    if (state().activeDialog === 'help') {
      dispatch({ type: 'CLOSE' });
    } else {
      dispatch({ type: 'SHOW_HELP' });
    }
  };

  const showSort = () => {
    dispatch({ type: 'SHOW_SORT' });
  };

  const toggleSort = () => {
    if (state().activeDialog === 'sort') {
      dispatch({ type: 'CLOSE' });
    } else {
      dispatch({ type: 'SHOW_SORT' });
    }
  };

  const showUpload = () => {
    dispatch({ type: 'SHOW_UPLOAD' });
  };

  const showQuit = (pendingChanges: number) => {
    dispatch({ type: 'SHOW_QUIT', payload: { pendingChanges } });
  };

  const showProfileSelector = () => {
    dispatch({ type: 'SHOW_PROFILE_SELECTOR' });
  };

  const showThemeSelector = () => {
    dispatch({ type: 'SHOW_THEME_SELECTOR' });
  };

  const closeDialog = () => {
    dispatch({ type: 'CLOSE' });
  };

  const closeAndClearOperations = () => {
    dispatch({ type: 'CLOSE' });
    dispatch({ type: 'CLEAR_OPERATIONS' });
  };

  // Computed properties using createMemo
  const isDialogOpen = createMemo(() => state().activeDialog !== null);
  const isConfirmOpen = createMemo(() => state().activeDialog === 'confirm');
  const isHelpOpen = createMemo(() => state().activeDialog === 'help');
  const isSortOpen = createMemo(() => state().activeDialog === 'sort');
  const isUploadOpen = createMemo(() => state().activeDialog === 'upload');
  const isQuitOpen = createMemo(() => state().activeDialog === 'quit');
  const isProfileSelectorOpen = createMemo(() => state().activeDialog === 'profileSelector');
  const isThemeSelectorOpen = createMemo(() => state().activeDialog === 'themeSelector');

  return {
    dialog: state,
    isDialogOpen,
    isConfirmOpen,
    isHelpOpen,
    isSortOpen,
    isUploadOpen,
    isQuitOpen,
    isProfileSelectorOpen,
    isThemeSelectorOpen,
    showConfirm,
    showHelp,
    toggleHelp,
    showSort,
    toggleSort,
    showUpload,
    showQuit,
    showProfileSelector,
    showThemeSelector,
    closeDialog,
    closeAndClearOperations,
    dispatch,
  };
}
