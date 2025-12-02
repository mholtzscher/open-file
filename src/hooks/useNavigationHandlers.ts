/**
 * Custom React hook for navigation handlers
 *
 * Encapsulates navigation logic (navigate into directory, go to parent, etc.)
 * and provides callbacks that can be used with React components.
 *
 * Handles:
 * - Navigate into selected directory
 * - Navigate to parent directory
 * - Path tracking and updates
 */

import { useCallback } from 'react';
import { Entry, EntryType } from '../types/entry.js';
import { UseBufferStateReturn } from './useBufferState.js';
import type { StorageContextValue } from '../contexts/StorageContext.js';

export interface NavigationState {
  currentPath: string;
  isLoading: boolean;
  error?: string;
}

export interface UseNavigationHandlersReturn {
  // Navigation actions
  navigateInto: () => Promise<void>;
  navigateUp: () => void;
  navigateToPath: (path: string) => Promise<void>;

  // State queries
  getCurrentPath: () => string;
  getSelectedEntry: () => Entry | undefined;
  canNavigateUp: () => boolean;

  // Status
  isNavigating: boolean;
  navigationError?: string;
}

/**
 * Callback-based configuration (legacy interface)
 */
interface NavigationConfig {
  onLoadBuffer?: (path: string) => Promise<void>;
  onErrorOccurred?: (error: string) => void;
  onNavigationComplete?: () => void;
  onBucketSelected?: (bucketName: string) => void;
}

/**
 * Direct dependencies interface (preferred)
 * Provides storage and status functions directly instead of callbacks
 */
export interface NavigationDependencies {
  storage: StorageContextValue;
  setStatusMessage: (message: string) => void;
  setStatusMessageColor: (color: string) => void;
  successColor: string;
  errorColor: string;
  onBucketSelected?: (bucketName: string) => void;
  onNavigationComplete?: () => void;
}

/**
 * Build NavigationConfig from NavigationDependencies
 */
function buildConfigFromDependencies(
  bufferState: UseBufferStateReturn,
  deps: NavigationDependencies
): NavigationConfig {
  return {
    onLoadBuffer: async (path: string) => {
      try {
        const entries = await deps.storage.list(path);
        bufferState.setEntries([...entries]);
        bufferState.setCurrentPath(path);
        bufferState.cursorToTop();
        deps.setStatusMessage(`Navigated to ${path}`);
        deps.setStatusMessageColor(deps.successColor);
      } catch (err) {
        deps.setStatusMessage(
          `Navigation failed: ${err instanceof Error ? err.message : String(err)}`
        );
        deps.setStatusMessageColor(deps.errorColor);
      }
    },
    onErrorOccurred: (error: string) => {
      deps.setStatusMessage(error);
      deps.setStatusMessageColor(deps.errorColor);
    },
    onNavigationComplete: deps.onNavigationComplete,
    onBucketSelected: deps.onBucketSelected,
  };
}

/**
 * Custom hook for navigation handling
 *
 * @overload With NavigationDependencies (preferred) - provides storage and status directly
 * @overload With NavigationConfig (legacy) - uses callbacks
 */
export function useNavigationHandlers(
  bufferState: UseBufferStateReturn,
  configOrDeps: NavigationConfig | NavigationDependencies = {}
): UseNavigationHandlersReturn {
  // Determine if we received dependencies or config
  const isDependencies = 'storage' in configOrDeps;
  const config: NavigationConfig = isDependencies
    ? buildConfigFromDependencies(bufferState, configOrDeps)
    : configOrDeps;
  // Navigate into selected directory or bucket
  const navigateInto = useCallback(async () => {
    const selected = bufferState.getSelectedEntry();

    if (!selected) {
      if (config.onErrorOccurred) {
        config.onErrorOccurred('No entry selected');
      }
      return;
    }

    // Handle bucket entry selection
    if (selected.type === EntryType.Bucket) {
      if (config.onBucketSelected) {
        config.onBucketSelected(selected.name);
      }
      if (config.onNavigationComplete) {
        config.onNavigationComplete();
      }
      return;
    }

    // Check if entry is a directory
    if (selected.type !== EntryType.Directory) {
      if (config.onErrorOccurred) {
        config.onErrorOccurred('Selected entry is not a directory or bucket');
      }
      return;
    }

    try {
      // Load the buffer for this directory
      if (config.onLoadBuffer) {
        await config.onLoadBuffer(selected.path);
      }

      if (config.onNavigationComplete) {
        config.onNavigationComplete();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (config.onErrorOccurred) {
        config.onErrorOccurred(`Failed to navigate: ${message}`);
      }
    }
  }, [bufferState, config]);

  // Navigate to parent directory
  const navigateUp = useCallback(() => {
    const currentPath = bufferState.currentPath;
    const parts = currentPath.split('/').filter(p => p);

    if (parts.length > 1) {
      // Remove last part to go up one level
      parts.pop();
      // New path calculation - actual loading handled by component
    } else if (parts.length === 1) {
      // At root level of bucket - don't navigate further
      if (config.onErrorOccurred) {
        config.onErrorOccurred('Already at root level');
      }
    }
  }, [bufferState.currentPath, config]);

  // Navigate to a specific path
  const navigateToPath = useCallback(
    async (path: string) => {
      try {
        if (config.onLoadBuffer) {
          await config.onLoadBuffer(path);
        }

        if (config.onNavigationComplete) {
          config.onNavigationComplete();
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (config.onErrorOccurred) {
          config.onErrorOccurred(`Failed to navigate to path: ${message}`);
        }
      }
    },
    [config]
  );

  // Get current path
  const getCurrentPath = useCallback((): string => {
    return bufferState.currentPath;
  }, [bufferState.currentPath]);

  // Get selected entry
  const getSelectedEntry = useCallback((): Entry | undefined => {
    return bufferState.getSelectedEntry();
  }, [bufferState]);

  // Check if can navigate up
  const canNavigateUp = useCallback((): boolean => {
    const currentPath = bufferState.currentPath;
    const parts = currentPath.split('/').filter(p => p);
    return parts.length > 1;
  }, [bufferState.currentPath]);

  return {
    navigateInto,
    navigateUp,
    navigateToPath,
    getCurrentPath,
    getSelectedEntry,
    canNavigateUp,
    isNavigating: false,
    navigationError: undefined,
  };
}
