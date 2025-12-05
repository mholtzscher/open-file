/**
 * Custom React hook for handling keybindings
 *
 * Provides declarative keybinding management with support for:
 * - Multi-key sequences (gg, dd, yy, etc.)
 * - Mode-aware key handling
 * - Global and local shortcuts
 */

import { useCallback, useRef, useEffect } from 'react';
import { EditMode } from '../types/edit-mode.js';

export interface KeyEvent {
  name: string;
  ctrl?: boolean;
  shift?: boolean;
  meta?: boolean;
}

export interface KeybindingConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  meta?: boolean;
  mode?: EditMode;
  handler: () => void;
}

export interface UseKeybindingsReturn {
  registerKeybinding: (config: KeybindingConfig) => void;
  unregisterKeybinding: (key: string) => void;
  clearKeybindings: () => void;
}

/**
 * Custom hook for keybinding management
 */
export function useKeybindings(
  mode: EditMode,
  onKeyPress?: (key: KeyEvent) => void
): UseKeybindingsReturn {
  const keybindingsRef = useRef<Map<string, KeybindingConfig>>(new Map());
  const keySequenceRef = useRef<string[]>([]);
  const sequenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Build key signature for matching (reserved for future use)
  const _getKeySignature = useCallback((key: KeyEvent): string => {
    const parts: string[] = [];
    if (key.ctrl) parts.push('ctrl');
    if (key.shift) parts.push('shift');
    if (key.meta) parts.push('meta');
    parts.push(key.name);
    return parts.join('+');
  }, []);

  // Check if key matches a keybinding
  const matchesKeybinding = useCallback(
    (key: KeyEvent, config: KeybindingConfig): boolean => {
      const isCtrlMatch = (config.ctrl ?? false) === (key.ctrl ?? false);
      const isShiftMatch = (config.shift ?? false) === (key.shift ?? false);
      const isMetaMatch = (config.meta ?? false) === (key.meta ?? false);
      const isNameMatch = key.name === config.key;
      const isModeMatch = config.mode === undefined || config.mode === mode;

      return isCtrlMatch && isShiftMatch && isMetaMatch && isNameMatch && isModeMatch;
    },
    [mode]
  );

  // Handle multi-key sequences
  const handleKeySequence = useCallback(
    (key: KeyEvent): boolean => {
      keySequenceRef.current.push(key.name);

      // Clear timeout if it exists
      if (sequenceTimeoutRef.current) {
        clearTimeout(sequenceTimeoutRef.current);
      }

      // Set new timeout to clear sequence
      sequenceTimeoutRef.current = setTimeout(() => {
        keySequenceRef.current = [];
      }, 1000);

      // Check if this matches any sequence keybinding
      const sequenceKey = keySequenceRef.current.join('');
      for (const [bindKey, config] of keybindingsRef.current.entries()) {
        if (bindKey.startsWith(sequenceKey) && bindKey === sequenceKey) {
          if (matchesKeybinding(key, config)) {
            config.handler();
            keySequenceRef.current = [];
            return true;
          }
        }
      }

      return false;
    },
    [matchesKeybinding]
  );

  // Main keyboard handler (reserved for future use)
  const _handleKeyDown = useCallback(
    (key: KeyEvent) => {
      // Try sequence first
      if (handleKeySequence(key)) {
        return;
      }

      // Then try direct keybindings
      for (const config of keybindingsRef.current.values()) {
        if (matchesKeybinding(key, config)) {
          config.handler();
          keySequenceRef.current = [];
          return;
        }
      }

      // Call user handler if no keybinding matched
      if (onKeyPress) {
        onKeyPress(key);
      }
    },
    [handleKeySequence, matchesKeybinding, onKeyPress]
  );

  // Register keybinding
  const registerKeybinding = useCallback((config: KeybindingConfig) => {
    const signature = `${config.ctrl ? 'ctrl+' : ''}${config.shift ? 'shift+' : ''}${config.meta ? 'meta+' : ''}${config.key}`;
    keybindingsRef.current.set(signature, config);
  }, []);

  // Unregister keybinding
  const unregisterKeybinding = useCallback((key: string) => {
    keybindingsRef.current.delete(key);
  }, []);

  // Clear all keybindings
  const clearKeybindings = useCallback(() => {
    keybindingsRef.current.clear();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sequenceTimeoutRef.current) {
        clearTimeout(sequenceTimeoutRef.current);
      }
    };
  }, []);

  return {
    registerKeybinding,
    unregisterKeybinding,
    clearKeybindings,
  };
}
