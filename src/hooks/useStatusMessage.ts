/**
 * useStatusMessage Hook
 *
 * Consolidates status bar state management into a single hook with semantic methods.
 * Replaces scattered setStatusMessage/setStatusMessageColor calls throughout s3-explorer.tsx.
 *
 * Features:
 * - Semantic methods: showSuccess(), showError(), showWarning(), showInfo(), clear()
 * - Computed isError property for error dialog detection
 * - Centralized color management using CatppuccinMocha theme
 * - Type-safe message state
 */

import { useState, useCallback, useMemo } from 'react';
import { CatppuccinMocha } from '../ui/theme.js';

// ============================================================================
// Types
// ============================================================================

export type StatusType = 'success' | 'error' | 'warning' | 'info' | 'normal';

export interface StatusMessageState {
  /** The message to display in the status bar */
  message: string;
  /** The color of the message */
  color: string;
  /** The type of message (for programmatic use) */
  type: StatusType;
}

export interface UseStatusMessageReturn {
  /** Current status state */
  status: StatusMessageState;

  /** Show a success message (green) */
  showSuccess: (message: string) => void;

  /** Show an error message (red) */
  showError: (message: string) => void;

  /** Show a warning message (yellow) */
  showWarning: (message: string) => void;

  /** Show an info message (blue) */
  showInfo: (message: string) => void;

  /** Show a normal message (default text color) */
  showMessage: (message: string) => void;

  /** Clear the status message */
  clear: () => void;

  /** Whether the current message is an error (for error dialog detection) */
  isError: boolean;

  // Direct access for backward compatibility during migration
  /** The current message text */
  message: string;
  /** The current message color */
  messageColor: string;
  /** Set message directly (for backward compatibility) */
  setMessage: (message: string) => void;
  /** Set color directly (for backward compatibility) */
  setMessageColor: (color: string) => void;
}

// ============================================================================
// Color Mapping
// ============================================================================

const STATUS_COLORS: Record<StatusType, string> = {
  success: CatppuccinMocha.green,
  error: CatppuccinMocha.red,
  warning: CatppuccinMocha.yellow,
  info: CatppuccinMocha.blue,
  normal: CatppuccinMocha.text,
};

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for managing status bar messages
 *
 * Provides semantic methods for showing different types of messages
 * and automatically applies the correct theme colors.
 *
 * @example
 * ```tsx
 * const { showSuccess, showError, clear, isError, status } = useStatusMessage();
 *
 * // Show different message types
 * showSuccess('File uploaded successfully');
 * showError('Failed to delete file');
 * showWarning('This action cannot be undone');
 * showInfo('Press ? for help');
 *
 * // Check if error dialog should be shown
 * if (isError) {
 *   // Show error dialog
 * }
 *
 * // Clear message
 * clear();
 * ```
 */
export function useStatusMessage(): UseStatusMessageReturn {
  const [state, setState] = useState<StatusMessageState>({
    message: '',
    color: CatppuccinMocha.text,
    type: 'normal',
  });

  const showSuccess = useCallback((message: string) => {
    setState({
      message,
      color: STATUS_COLORS.success,
      type: 'success',
    });
  }, []);

  const showError = useCallback((message: string) => {
    setState({
      message,
      color: STATUS_COLORS.error,
      type: 'error',
    });
  }, []);

  const showWarning = useCallback((message: string) => {
    setState({
      message,
      color: STATUS_COLORS.warning,
      type: 'warning',
    });
  }, []);

  const showInfo = useCallback((message: string) => {
    setState({
      message,
      color: STATUS_COLORS.info,
      type: 'info',
    });
  }, []);

  const showMessage = useCallback((message: string) => {
    setState({
      message,
      color: STATUS_COLORS.normal,
      type: 'normal',
    });
  }, []);

  const clear = useCallback(() => {
    setState({
      message: '',
      color: STATUS_COLORS.normal,
      type: 'normal',
    });
  }, []);

  // Backward compatibility setters
  const setMessage = useCallback((message: string) => {
    setState(prev => ({ ...prev, message }));
  }, []);

  const setMessageColor = useCallback((color: string) => {
    // Determine type based on color for isError detection
    let type: StatusType = 'normal';
    if (color === CatppuccinMocha.red) type = 'error';
    else if (color === CatppuccinMocha.green) type = 'success';
    else if (color === CatppuccinMocha.yellow) type = 'warning';
    else if (color === CatppuccinMocha.blue) type = 'info';

    setState(prev => ({ ...prev, color, type }));
  }, []);

  // Computed property for error detection
  const isError = useMemo(() => {
    return state.message !== '' && state.color === CatppuccinMocha.red;
  }, [state.message, state.color]);

  return {
    status: state,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showMessage,
    clear,
    isError,
    // Backward compatibility
    message: state.message,
    messageColor: state.color,
    setMessage,
    setMessageColor,
  };
}
