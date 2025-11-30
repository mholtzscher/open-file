/**
 * useKeySequence hook
 *
 * Encapsulates multi-key sequence handling (e.g., gg, dd, yy).
 * Returns a handler that tracks key sequences and reports when a
 * sequence has completed, is in progress, or was not recognized.
 */

import { onCleanup } from 'solid-js';
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

  // In Solid, regular variables persist across renders (no need for useRef)
  let keySequence: string[] = [];
  let sequenceTimeout: ReturnType<typeof setTimeout> | null = null;
  const starters = new Set(sequenceStarters);

  const clearSequence = () => {
    if (sequenceTimeout) {
      clearTimeout(sequenceTimeout);
      sequenceTimeout = null;
    }
    keySequence = [];
  };

  const handleSequence = (key: KeyboardKey): SequenceResult => {
    const keyName = key.name;

    // If this is a shifted key for a sequence starter (e.g., D = shift+d, Y = shift+y),
    // don't treat it as a sequence - let it fall through to keybinding lookup
    // Exception: G (shift+g) for cursor:bottom is handled separately below
    if (key.shift && starters.has(keyName) && keyName !== 'g') {
      keySequence = [];
      return { handled: false, waitingForMore: false };
    }

    // Add to sequence
    keySequence.push(keyName);

    // Clear existing timeout
    if (sequenceTimeout) {
      clearTimeout(sequenceTimeout);
    }

    // Set new timeout to clear sequence
    sequenceTimeout = setTimeout(() => {
      keySequence = [];
    }, timeout);

    // Check for complete sequence
    const sequence = keySequence.join('');

    if (sequences[sequence]) {
      const action = sequences[sequence];
      keySequence = [];
      return { handled: true, action };
    }

    // Optional special case: single G (shift+g) for bottom-of-list
    if (
      bottomAction &&
      (sequence === 'G' || (keySequence.length === 1 && key.shift && keyName === 'g'))
    ) {
      keySequence = [];
      return { handled: true, action: bottomAction };
    }

    // If waiting for sequence continuation
    if (keySequence.length === 1 && starters.has(keyName)) {
      return { handled: false, waitingForMore: true };
    }

    // Unrecognized sequence - clear and don't handle
    if (keySequence.length > 1) {
      keySequence = [];
    }

    return { handled: false, waitingForMore: false };
  };

  // Clear timeout on cleanup
  onCleanup(() => {
    if (sequenceTimeout) {
      clearTimeout(sequenceTimeout);
    }
  });

  return { handleSequence, clearSequence };
}
