/**
 * useStatusMessage Hook
 *
 * Consolidates status bar state management into a single hook with semantic methods.
 * Replaces scattered setStatusMessage/setStatusMessageColor calls throughout s3-explorer.tsx.
 *
 * Features:
 * - Semantic methods: showSuccess(), showError(), showWarning(), showInfo(), clear()
 * - Auto-clear: Messages automatically clear after 5 seconds
 * - Computed isError property for error dialog detection
 * - Centralized color management using CatppuccinMocha theme
 * - Type-safe message state
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Theme } from '../ui/theme.js';

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
  success: Theme.getSuccessColor(),
  error: Theme.getErrorColor(),
  warning: Theme.getWarningColor(),
  info: Theme.getInfoColor(),
  normal: Theme.getTextColor(),
};

/** How long status messages are displayed before auto-clearing (in milliseconds) */
const STATUS_MESSAGE_TIMEOUT_MS = 3000;

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
    color: Theme.getTextColor(),
    type: 'normal',
  });

  // Ref to track the auto-clear timeout
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-clear messages after timeout
  useEffect(() => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Only set timeout if there's a message to clear
    if (state.message) {
      timeoutRef.current = setTimeout(() => {
        setState({
          message: '',
          color: STATUS_COLORS.normal,
          type: 'normal',
        });
      }, STATUS_MESSAGE_TIMEOUT_MS);
    }

    // Cleanup on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [state.message]);

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
    if (color === Theme.getErrorColor()) type = 'error';
    else if (color === Theme.getSuccessColor()) type = 'success';
    else if (color === Theme.getWarningColor()) type = 'warning';
    else if (color === Theme.getInfoColor()) type = 'info';

    setState(prev => ({ ...prev, color, type }));
  }, []);

  // Computed property for error detection
  const isError = useMemo(() => {
    return state.message !== '' && state.color === Theme.getErrorColor();
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
