/**
 * Custom React hook for tracking terminal size
 *
 * Monitors terminal resize events and provides reactive dimensions.
 * Helps create responsive layouts that adapt to terminal size changes.
 */

import { useState, useEffect, useCallback } from 'react';

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
 * Custom hook for terminal size tracking
 *
 * Provides reactive terminal dimensions that update on resize events.
 * Works with OpenTUI and Bun's terminal APIs.
 */
export function useTerminalSize(): UseTerminalSizeReturn {
  const [size, setSize] = useState<TerminalSize>(DEFAULT_SIZE);

  // Get current terminal size - tries multiple APIs for compatibility
  const getCurrentSize = useCallback((): TerminalSize => {
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
  }, []);

  // Initialize with current size
  useEffect(() => {
    setSize(getCurrentSize());
  }, [getCurrentSize]);

  // Setup resize listener
  useEffect(() => {
    const handleResize = () => {
      const newSize = getCurrentSize();
      setSize(newSize);
    };

    // Listen for SIGWINCH (terminal resize signal) on Unix systems
    if (process.platform !== 'win32') {
      process.on('SIGWINCH', handleResize);
      return () => {
        process.removeListener('SIGWINCH', handleResize);
      };
    }

    // For Windows or other platforms, poll periodically
    const interval = setInterval(handleResize, 1000);
    return () => clearInterval(interval);
  }, [getCurrentSize]);

  const width = size.width;
  const height = size.height;
  const isSmall = width < 60 || height < 10;
  const isMedium = width < 100 || height < 20;

  return {
    size,
    width,
    height,
    isSmall,
    isMedium,
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
