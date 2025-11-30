/**
 * Custom SolidJS hook for tracking terminal size
 *
 * Monitors terminal resize events and provides reactive dimensions.
 * Helps create responsive layouts that adapt to terminal size changes.
 */

import { createSignal, onMount, onCleanup } from 'solid-js';

export interface TerminalSize {
  width: number;
  height: number;
}

export interface UseTerminalSizeReturn {
  size: TerminalSize;
  width: number;
  height: number;
  isSmall: boolean; // width < 60 or height < 10
  isMedium: boolean; // width < 100 or height < 20
}

/**
 * Default terminal size for headless environments
 */
const DEFAULT_SIZE: TerminalSize = {
  width: 80,
  height: 24,
};

/**
 * Get current terminal size - tries multiple APIs for compatibility
 */
function getCurrentSize(): TerminalSize {
  // For tests, use a stable default size to avoid environment-dependent behavior
  if (process.env.NODE_ENV === 'test') {
    return DEFAULT_SIZE;
  }

  try {
    // Try process.stdout (Node.js/Bun standard)
    if (process.stdout && process.stdout.isTTY && process.stdout.columns && process.stdout.rows) {
      return {
        width: process.stdout.columns,
        height: process.stdout.rows,
      };
    }

    // Fallback to environment variables set by some terminal emulators
    const width = process.env.COLUMNS ? parseInt(process.env.COLUMNS, 10) : DEFAULT_SIZE.width;
    const height = process.env.LINES ? parseInt(process.env.LINES, 10) : DEFAULT_SIZE.height;

    if (width > 0 && height > 0) {
      return { width, height };
    }
  } catch {
    // Silently fall back to default
  }

  return DEFAULT_SIZE;
}

/**
 * Custom hook for terminal size tracking (SolidJS version)
 *
 * Provides reactive terminal dimensions that update on resize events.
 * Works with OpenTUI and Bun's terminal APIs.
 */
export function useTerminalSize(): UseTerminalSizeReturn {
  const [size, setSize] = createSignal<TerminalSize>(getCurrentSize());

  onMount(() => {
    // Update with current size
    setSize(getCurrentSize());

    // Setup resize listener
    const handleResize = () => {
      setSize(getCurrentSize());
    };

    // Listen for SIGWINCH (terminal resize signal) on Unix systems
    if (process.platform !== 'win32') {
      process.on('SIGWINCH', handleResize);
      onCleanup(() => {
        process.removeListener('SIGWINCH', handleResize);
      });
    } else {
      // For Windows or other platforms, poll periodically
      const interval = setInterval(handleResize, 1000);
      onCleanup(() => clearInterval(interval));
    }
  });

  // Return values - in Solid we compute derived values inline
  // These are called as getters, so they'll be reactive
  return {
    get size() {
      return size();
    },
    get width() {
      return size().width;
    },
    get height() {
      return size().height;
    },
    get isSmall() {
      const s = size();
      return s.width < 60 || s.height < 10;
    },
    get isMedium() {
      const s = size();
      return s.width < 100 || s.height < 20;
    },
  };
}

/**
 * Helper hook to calculate layout dimensions
 *
 * Provides precalculated dimensions for common layout patterns
 */
export interface LayoutDimensions {
  headerHeight: number;
  footerHeight: number;
  contentHeight: number;
  contentWidth: number;
  maxWidth: number;
  minContentHeight: number;
}

export function useLayoutDimensions(terminalSize: TerminalSize): LayoutDimensions {
  const headerHeight = 2;
  const footerHeight = 1;
  const reservedHeight = headerHeight + footerHeight;
  const contentHeight = Math.max(terminalSize.height - reservedHeight, 10);

  return {
    headerHeight,
    footerHeight,
    contentHeight,
    contentWidth: Math.max(terminalSize.width - 4, 40), // 2 chars padding on each side
    maxWidth: terminalSize.width,
    minContentHeight: 10,
  };
}
