/**
 * useProgressState Hook
 *
 * Consolidates all progress tracking state into a single reducer-based hook.
 * Replaces 8 separate useState calls in s3-explorer.tsx with a unified state management approach.
 */

import { createSignal } from 'solid-js';
import {
  ProgressState,
  ProgressAction,
  ShowProgressOptions,
  FileProgressPayload,
} from '../types/progress.js';

/**
 * Initial state for progress tracking
 */
export const initialProgressState: ProgressState = {
  visible: false,
  title: 'Operation in Progress',
  description: 'Processing...',
  value: 0,
  currentFile: '',
  currentNum: 0,
  totalNum: 0,
  cancellable: true,
  cancelled: false,
};

/**
 * Progress state reducer
 * Handles all progress-related state transitions
 */
export function progressReducer(state: ProgressState, action: ProgressAction): ProgressState {
  switch (action.type) {
    case 'SHOW':
      return {
        ...initialProgressState,
        visible: true,
        title: action.payload.title,
        description: action.payload.description ?? initialProgressState.description,
        totalNum: action.payload.totalNum ?? 0,
        cancellable: action.payload.cancellable ?? true,
        cancelled: false,
      };

    case 'UPDATE':
      return { ...state, ...action.payload };

    case 'SET_FILE': {
      const { file, num } = action.payload;
      const value = state.totalNum > 0 ? (num / state.totalNum) * 100 : 0;
      return {
        ...state,
        currentFile: file,
        currentNum: num,
        value,
      };
    }

    case 'INCREMENT': {
      const newNum = state.currentNum + 1;
      const value = state.totalNum > 0 ? (newNum / state.totalNum) * 100 : 0;
      return {
        ...state,
        currentNum: newNum,
        value,
      };
    }

    case 'CANCEL':
      return { ...state, cancelled: true };

    case 'HIDE':
      return { ...state, visible: false };

    case 'RESET':
      return initialProgressState;

    default:
      return state;
  }
}

/**
 * Return type for the useProgressState hook
 */
export interface UseProgressStateReturn {
  /** Current progress state (call as function in Solid) */
  progress: () => ProgressState;
  /** Show the progress window with specified options */
  showProgress: (options: ShowProgressOptions) => void;
  /** Update the current file being processed */
  updateFile: (file: string, num: number) => void;
  /** Update progress value directly (0-100) */
  updateProgress: (value: number) => void;
  /** Update description text */
  updateDescription: (description: string) => void;
  /** Hide the progress window */
  hideProgress: () => void;
  /** Mark the operation as cancelled */
  cancelOperation: () => void;
  /** Reset progress to initial state */
  resetProgress: () => void;
  /** Direct dispatch for advanced use cases */
  dispatch: (action: ProgressAction) => void;
}

/**
 * Hook for managing progress state
 *
 * Consolidates 8 separate useState calls into a single reducer:
 * - showProgress
 * - progressTitle
 * - progressDescription
 * - progressValue
 * - progressCurrentFile
 * - progressCurrentNum
 * - progressTotalNum
 * - progressCancellable
 *
 * @example
 * ```tsx
 * const { progress, showProgress, hideProgress } = useProgressState();
 *
 * // Show progress window
 * showProgress({
 *   title: 'Uploading Files',
 *   description: 'Starting upload...',
 *   totalNum: 10,
 *   cancellable: true
 * });
 *
 * // Update file progress
 * updateFile('file1.txt', 1);
 *
 * // Hide when done
 * hideProgress();
 * ```
 */
export function useProgressState(): UseProgressStateReturn {
  const [state, setState] = createSignal<ProgressState>(initialProgressState);

  const dispatch = (action: ProgressAction) => {
    setState(prev => progressReducer(prev, action));
  };

  const showProgress = (options: ShowProgressOptions) => {
    dispatch({ type: 'SHOW', payload: options });
  };

  const updateFile = (file: string, num: number) => {
    const payload: FileProgressPayload = { file, num };
    dispatch({ type: 'SET_FILE', payload });
  };

  const updateProgress = (value: number) => {
    dispatch({ type: 'UPDATE', payload: { value } });
  };

  const updateDescription = (description: string) => {
    dispatch({ type: 'UPDATE', payload: { description } });
  };

  const hideProgress = () => {
    dispatch({ type: 'HIDE' });
  };

  const cancelOperation = () => {
    dispatch({ type: 'CANCEL' });
  };

  const resetProgress = () => {
    dispatch({ type: 'RESET' });
  };

  return {
    progress: state,
    showProgress,
    updateFile,
    updateProgress,
    updateDescription,
    hideProgress,
    cancelOperation,
    resetProgress,
    dispatch,
  };
}
