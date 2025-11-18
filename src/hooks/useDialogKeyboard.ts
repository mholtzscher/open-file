/**
 * Hook for dialog components to register keyboard handlers
 */

import { useEffect } from 'react';

let registeredHandlers: Map<string, (key: string) => void> = new Map();

/**
 * Register a keyboard handler for a dialog
 */
export function registerDialogHandler(dialogId: string, handler: (key: string) => void): void {
  registeredHandlers.set(dialogId, handler);
}

/**
 * Get a keyboard handler for a dialog
 */
export function getDialogHandler(dialogId: string): ((key: string) => void) | undefined {
  return registeredHandlers.get(dialogId);
}

/**
 * Hook to register dialog keyboard handler
 */
export function useDialogKeyboard(
  dialogId: string,
  handler: (key: string) => void,
  enabled: boolean = true
): void {
  useEffect(() => {
    if (enabled) {
      registerDialogHandler(dialogId, handler);
      return () => {
        registeredHandlers.delete(dialogId);
      };
    }
  }, [dialogId, handler, enabled]);
}
