/**
 * useKeySequence hook
 *
 * Encapsulates multi-key sequence handling (e.g., gg, dd, yy).
 * Returns a handler that tracks key sequences and reports when a
 * sequence has completed, is in progress, or was not recognized.
 */

import { useCallback, useEffect, useRef } from 'react';
import type { KeyboardKey, KeyAction } from '../types/keyboard.js';

interface UseKeySequenceOptions {
  /** Timeout (ms) after which an incomplete sequence is cleared */
  timeout?: number;
  /** Keys that can start a multi-key sequence (e.g., ['g', 'd', 'y']) */
  sequenceStarters: string[];
  /** Map of complete sequence strings to actions (e.g., { gg: 'cursor:top' }) */
  sequences: Record<string, KeyAction>;
  /**
   * Optional action for a single "bottom" key sequence.
   * For vi-style navigation this is typically used for G / Shift+g.
   */
  bottomAction?: KeyAction;
}

interface SequenceResult {
  handled: boolean;
  action?: KeyAction;
  waitingForMore?: boolean;
}

export function useKeySequence(options: UseKeySequenceOptions) {
  const { timeout = 500, sequenceStarters, sequences, bottomAction } = options;

  const keySequenceRef = useRef<string[]>([]);
  const sequenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startersRef = useRef<Set<string>>(new Set(sequenceStarters));
  const sequencesRef = useRef<Record<string, KeyAction>>(sequences);

  const clearSequence = useCallback(() => {
    if (sequenceTimeoutRef.current) {
      clearTimeout(sequenceTimeoutRef.current);
      sequenceTimeoutRef.current = null;
    }
    keySequenceRef.current = [];
  }, []);

  const handleSequence = useCallback(
    (key: KeyboardKey): SequenceResult => {
      const keyName = key.name;

      // If this is a shifted key for a sequence starter (e.g., D = shift+d, Y = shift+y),
      // don't treat it as a sequence - let it fall through to keybinding lookup
      // Exception: G (shift+g) for cursor:bottom is handled separately below
      if (key.shift && startersRef.current.has(keyName) && keyName !== 'g') {
        keySequenceRef.current = [];
        return { handled: false, waitingForMore: false };
      }

      // Add to sequence
      keySequenceRef.current.push(keyName);

      // Clear existing timeout
      if (sequenceTimeoutRef.current) {
        clearTimeout(sequenceTimeoutRef.current);
      }

      // Set new timeout to clear sequence
      sequenceTimeoutRef.current = setTimeout(() => {
        keySequenceRef.current = [];
      }, timeout);

      // Check for complete sequence
      const sequence = keySequenceRef.current.join('');

      if (sequencesRef.current[sequence]) {
        const action = sequencesRef.current[sequence];
        keySequenceRef.current = [];
        return { handled: true, action };
      }

      // Optional special case: single G (shift+g) for bottom-of-list
      if (
        bottomAction &&
        (sequence === 'G' || (keySequenceRef.current.length === 1 && key.shift && keyName === 'g'))
      ) {
        keySequenceRef.current = [];
        return { handled: true, action: bottomAction };
      }

      // If waiting for sequence continuation
      if (keySequenceRef.current.length === 1 && startersRef.current.has(keyName)) {
        return { handled: false, waitingForMore: true };
      }

      // Unrecognized sequence - clear and don't handle
      if (keySequenceRef.current.length > 1) {
        keySequenceRef.current = [];
      }

      return { handled: false, waitingForMore: false };
    },
    [timeout, bottomAction]
  );

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (sequenceTimeoutRef.current) {
        clearTimeout(sequenceTimeoutRef.current);
      }
    };
  }, []);

  return { handleSequence, clearSequence };
}
