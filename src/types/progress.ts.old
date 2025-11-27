/**
 * Progress State Types
 *
 * Defines the state and actions for progress tracking during operations
 * like uploads, downloads, deletions, etc.
 */

/**
 * State for progress tracking UI
 */
export interface ProgressState {
  /** Whether the progress window is visible */
  visible: boolean;
  /** Title displayed at the top of the progress window */
  title: string;
  /** Description of the current operation */
  description: string;
  /** Progress percentage (0-100) */
  value: number;
  /** Currently processing file name */
  currentFile: string;
  /** Current file number (1-based) */
  currentNum: number;
  /** Total number of files being processed */
  totalNum: number;
  /** Whether the operation can be cancelled */
  cancellable: boolean;
  /** Whether the operation has been cancelled by the user */
  cancelled: boolean;
}

/**
 * Options for showing the progress window
 */
export interface ShowProgressOptions {
  title: string;
  description?: string;
  totalNum?: number;
  cancellable?: boolean;
}

/**
 * Options for updating file progress
 */
export interface FileProgressPayload {
  file: string;
  num: number;
}

/**
 * Actions that can be dispatched to the progress reducer
 */
export type ProgressAction =
  | { type: 'SHOW'; payload: ShowProgressOptions }
  | { type: 'UPDATE'; payload: Partial<ProgressState> }
  | { type: 'SET_FILE'; payload: FileProgressPayload }
  | { type: 'INCREMENT' }
  | { type: 'CANCEL' }
  | { type: 'HIDE' }
  | { type: 'RESET' };
