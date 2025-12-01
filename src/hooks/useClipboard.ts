/**
 * useClipboard - Simple clipboard state management for copy/paste operations
 *
 * This hook provides a minimal clipboard implementation for storing entries
 * that can be pasted to other locations. It replaces the complex clipboard
 * functionality that was previously part of the pending operations store.
 */

import { useState, useCallback, useMemo } from 'react';
import type { Entry } from '../types/entry.js';

/**
 * Clipboard state containing copied entries and their source paths
 */
export interface ClipboardState {
  /** The entries that were copied */
  entries: Entry[];
  /** The original paths of the entries (for reference) */
  sourcePaths: string[];
}

/**
 * Return type for the useClipboard hook
 */
export interface UseClipboardReturn {
  /** Current clipboard state, null if empty */
  clipboard: ClipboardState | null;
  /** Whether the clipboard has content */
  hasContent: boolean;
  /** Number of entries in clipboard */
  entryCount: number;
  /** Copy entries to clipboard */
  copy: (entries: Entry[]) => void;
  /** Clear the clipboard */
  clear: () => void;
}

/**
 * Hook for managing clipboard state for copy/paste operations
 *
 * @example
 * ```tsx
 * const { clipboard, hasContent, copy, clear } = useClipboard();
 *
 * // Copy selected entries
 * const handleCopy = () => {
 *   copy(selectedEntries);
 * };
 *
 * // Paste entries
 * const handlePaste = async () => {
 *   if (!hasContent) return;
 *   for (const entry of clipboard.entries) {
 *     await storage.copy(entry.path, `${currentPath}${entry.name}`);
 *   }
 *   // Clipboard is preserved after paste - user can paste again
 * };
 * ```
 */
export function useClipboard(): UseClipboardReturn {
  const [clipboard, setClipboard] = useState<ClipboardState | null>(null);

  const copy = useCallback((entries: Entry[]) => {
    if (entries.length === 0) {
      return;
    }
    setClipboard({
      entries: [...entries],
      sourcePaths: entries.map(e => e.path),
    });
  }, []);

  const clear = useCallback(() => {
    setClipboard(null);
  }, []);

  const hasContent = clipboard !== null && clipboard.entries.length > 0;
  const entryCount = clipboard?.entries.length ?? 0;

  return useMemo(
    () => ({
      clipboard,
      hasContent,
      entryCount,
      copy,
      clear,
    }),
    [clipboard, hasContent, entryCount, copy, clear]
  );
}
