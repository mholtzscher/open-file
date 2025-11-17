/**
 * useMultiPaneLayout hook
 *
 * Manages multi-pane layout state for the S3 Explorer.
 * Handles pane creation, activation, and layout calculations.
 */

import { useState, useCallback, useMemo } from 'react';
import type { UseBufferStateReturn } from './useBufferState.js';
import type { LayoutDimensions, TerminalSize } from './useTerminalSize.js';

export interface Pane {
  id: string;
  bufferState: UseBufferStateReturn;
  isActive: boolean;
}

export interface PaneDimensions {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface MultiPaneLayout {
  panes: Pane[];
  activePaneId: string | null;
  isMultiPaneMode: boolean;
  paneDimensions: PaneDimensions[];
  addPane: (bufferState: UseBufferStateReturn) => void;
  removePane: (paneId: string) => void;
  activatePane: (paneId: string) => void;
  toggleMultiPaneMode: () => void;
  getActiveBufferState: () => UseBufferStateReturn | null;
}

/**
 * Hook to manage multi-pane layout state
 */
export function useMultiPaneLayout(
  terminalSize: TerminalSize,
  layout: LayoutDimensions
): MultiPaneLayout {
  const [panes, setPanes] = useState<Pane[]>([]);
  const [activePaneId, setActivePaneId] = useState<string | null>(null);
  const [isMultiPaneMode, setIsMultiPaneMode] = useState(false);

  // Calculate pane dimensions based on terminal size and number of panes
  const paneDimensions = useMemo((): PaneDimensions[] => {
    if (!isMultiPaneMode || panes.length <= 1) {
      // Single pane mode - use full width
      return [
        {
          left: 2,
          top: layout.headerHeight,
          width: Math.max(terminalSize.width - 4, 40),
          height: layout.contentHeight,
        },
      ];
    }

    // Multi-pane mode - split horizontally
    const paneWidth = Math.floor((terminalSize.width - 4) / panes.length);
    return panes.map((_, index) => ({
      left: 2 + index * paneWidth,
      top: layout.headerHeight,
      width: paneWidth - 1, // Account for border
      height: layout.contentHeight,
    }));
  }, [
    isMultiPaneMode,
    panes.length,
    terminalSize.width,
    layout.headerHeight,
    layout.contentHeight,
  ]);

  // Add a new pane
  const addPane = useCallback((bufferState: UseBufferStateReturn) => {
    const newPaneId = `pane-${Date.now()}`;
    const newPane: Pane = {
      id: newPaneId,
      bufferState,
      isActive: true,
    };

    setPanes(prevPanes => {
      // Deactivate all existing panes
      const updatedPanes = prevPanes.map((p: Pane) => ({ ...p, isActive: false }));
      return [...updatedPanes, newPane];
    });

    setActivePaneId(newPaneId);
  }, []);

  // Remove a pane
  const removePane = useCallback(
    (paneId: string) => {
      setPanes(prevPanes => {
        const filtered = prevPanes.filter((p: Pane) => p.id !== paneId);

        // If we removed the active pane, activate the first remaining pane
        if (paneId === activePaneId && filtered.length > 0) {
          const updatedPanes = filtered.map((p: Pane, idx: number) => ({
            ...p,
            isActive: idx === 0,
          }));
          setActivePaneId(updatedPanes[0].id);
          return updatedPanes;
        }

        return filtered;
      });
    },
    [activePaneId]
  );

  // Activate a specific pane
  const activatePane = useCallback((paneId: string) => {
    setPanes(prevPanes =>
      prevPanes.map((p: Pane) => ({
        ...p,
        isActive: p.id === paneId,
      }))
    );
    setActivePaneId(paneId);
  }, []);

  // Toggle multi-pane mode
  const toggleMultiPaneMode = useCallback(() => {
    setIsMultiPaneMode(prev => !prev);
  }, []);

  // Get the active buffer state
  const getActiveBufferState = useCallback((): UseBufferStateReturn | null => {
    const activePane = panes.find((p: Pane) => p.id === activePaneId);
    return activePane?.bufferState || null;
  }, [panes, activePaneId]);

  return {
    panes: panes.map((p: Pane) => ({
      ...p,
      isActive: p.id === activePaneId,
    })),
    activePaneId,
    isMultiPaneMode,
    paneDimensions,
    addPane,
    removePane,
    activatePane,
    toggleMultiPaneMode,
    getActiveBufferState,
  };
}
