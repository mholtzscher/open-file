/**
 * Dialog State Types
 *
 * Defines the state and actions for dialog management.
 * Consolidates multiple dialog boolean states into a single state object.
 */

/**
 * Types of dialogs available in the application.
 * Only one dialog can be active at a time.
 */
export type DialogType = 'confirm' | 'help' | 'sort' | 'upload' | 'quit' | 'profileSelector' | null;

/**
 * State for the dialog system
 */
export interface DialogState {
  /** Currently active dialog type, or null if no dialog is open */
  activeDialog: DialogType;
  /** Pending operations for the confirm dialog */
  pendingOperations: PendingOperation[];
  /** Number of pending changes for quit dialog */
  quitPendingChanges: number;
}

/**
 * Pending operation for confirm dialog
 */
export interface PendingOperation {
  id: string;
  type: 'create' | 'delete' | 'move' | 'copy' | 'rename' | 'download' | 'upload';
  path?: string;
  source?: string;
  destination?: string;
  /** New name for rename operations */
  newName?: string;
  /** Entry associated with this operation (uses the Entry type from entry.ts) */
  entry?: import('./entry.js').Entry;
  entryType?: 'file' | 'directory';
  recursive?: boolean;
}

/**
 * Options for showing a confirm dialog
 */
export interface ShowConfirmOptions {
  operations: PendingOperation[];
}

/**
 * Options for showing a quit confirmation dialog
 */
export interface ShowQuitOptions {
  pendingChanges: number;
}

/**
 * Actions that can be dispatched to the dialog reducer
 */
export type DialogAction =
  | { type: 'SHOW_CONFIRM'; payload: ShowConfirmOptions }
  | { type: 'SHOW_HELP' }
  | { type: 'SHOW_SORT' }
  | { type: 'SHOW_UPLOAD' }
  | { type: 'SHOW_QUIT'; payload: ShowQuitOptions }
  | { type: 'SHOW_PROFILE_SELECTOR' }
  | { type: 'CLOSE' }
  | { type: 'CLEAR_OPERATIONS' };
