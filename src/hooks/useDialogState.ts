/**
 * useDialogState Hook
 *
 * Consolidates dialog visibility state into a single reducer-based hook.
 * Replaces separate useState calls for each dialog with unified state management.
 * Only one dialog can be active at a time, preventing conflicting states.
 */

import { useReducer, useCallback } from 'react';
import {
  DialogState,
  DialogAction,
  DialogType,
  PendingOperation,
  ShowConfirmOptions,
  ShowQuitOptions,
} from '../types/dialog.js';

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
  /** Current dialog state */
  dialog: DialogState;
  /** Whether any dialog is currently open */
  isDialogOpen: boolean;
  /** Whether the confirm dialog is open */
  isConfirmOpen: boolean;
  /** Whether the help dialog is open */
  isHelpOpen: boolean;
  /** Whether the sort menu is open */
  isSortOpen: boolean;
  /** Whether the upload dialog is open */
  isUploadOpen: boolean;
  /** Whether the quit confirmation dialog is open */
  isQuitOpen: boolean;
  /** Whether the profile selector dialog is open */
  isProfileSelectorOpen: boolean;
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
  /** Close any open dialog */
  closeDialog: () => void;
  /** Close dialog and clear pending operations */
  closeAndClearOperations: () => void;
  /** Direct dispatch for advanced use cases */
  dispatch: React.Dispatch<DialogAction>;
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
  const [state, dispatch] = useReducer(dialogReducer, initialDialogState);

  const showConfirm = useCallback((operations: PendingOperation[]) => {
    dispatch({ type: 'SHOW_CONFIRM', payload: { operations } });
  }, []);

  const showHelp = useCallback(() => {
    dispatch({ type: 'SHOW_HELP' });
  }, []);

  const toggleHelp = useCallback(() => {
    if (state.activeDialog === 'help') {
      dispatch({ type: 'CLOSE' });
    } else {
      dispatch({ type: 'SHOW_HELP' });
    }
  }, [state.activeDialog]);

  const showSort = useCallback(() => {
    dispatch({ type: 'SHOW_SORT' });
  }, []);

  const toggleSort = useCallback(() => {
    if (state.activeDialog === 'sort') {
      dispatch({ type: 'CLOSE' });
    } else {
      dispatch({ type: 'SHOW_SORT' });
    }
  }, [state.activeDialog]);

  const showUpload = useCallback(() => {
    dispatch({ type: 'SHOW_UPLOAD' });
  }, []);

  const showQuit = useCallback((pendingChanges: number) => {
    dispatch({ type: 'SHOW_QUIT', payload: { pendingChanges } });
  }, []);

  const showProfileSelector = useCallback(() => {
    dispatch({ type: 'SHOW_PROFILE_SELECTOR' });
  }, []);

  const closeDialog = useCallback(() => {
    dispatch({ type: 'CLOSE' });
  }, []);

  const closeAndClearOperations = useCallback(() => {
    dispatch({ type: 'CLOSE' });
    dispatch({ type: 'CLEAR_OPERATIONS' });
  }, []);

  // Computed properties
  const isDialogOpen = state.activeDialog !== null;
  const isConfirmOpen = state.activeDialog === 'confirm';
  const isHelpOpen = state.activeDialog === 'help';
  const isSortOpen = state.activeDialog === 'sort';
  const isUploadOpen = state.activeDialog === 'upload';
  const isQuitOpen = state.activeDialog === 'quit';
  const isProfileSelectorOpen = state.activeDialog === 'profileSelector';

  return {
    dialog: state,
    isDialogOpen,
    isConfirmOpen,
    isHelpOpen,
    isSortOpen,
    isUploadOpen,
    isQuitOpen,
    isProfileSelectorOpen,
    showConfirm,
    showHelp,
    toggleHelp,
    showSort,
    toggleSort,
    showUpload,
    showQuit,
    showProfileSelector,
    closeDialog,
    closeAndClearOperations,
    dispatch,
  };
}
