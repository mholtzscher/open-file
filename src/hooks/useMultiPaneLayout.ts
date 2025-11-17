/**
 * useMultiPaneLayout hook
 *
 * Manages multi-pane layout state for the S3 Explorer.
 * Handles pane creation, activation, and layout calculations.
 */

import { useState, useCallback } from 'react';
import type { MutableRefObject } from 'react';
import type { UseBufferStateReturn } from './useBufferState.js';

export interface Pane {
  id: string;
  bufferState: UseBufferStateReturn;
  isActive: boolean;
}

interface InternalPane {
  id: string;
  bufferStateRef: MutableRefObject<UseBufferStateReturn>;
  isActive: boolean;
}

export interface MultiPaneLayout {
  panes: Pane[];
  activePaneId: string | null;
  isMultiPaneMode: boolean;
  addPane: (bufferStateRef: MutableRefObject<UseBufferStateReturn>) => void;
  removePane: (paneId: string) => void;
  activatePane: (paneId: string) => void;
  toggleMultiPaneMode: () => void;
  getActiveBufferState: () => UseBufferStateReturn | null;
}

/**
 * Hook to manage multi-pane layout state
 */
export function useMultiPaneLayout(): MultiPaneLayout {
  const [panes, setPanes] = useState<InternalPane[]>([]);
  const [activePaneId, setActivePaneId] = useState<string | null>(null);
  const [isMultiPaneMode, setIsMultiPaneMode] = useState(false);

  // Add a new pane
  const addPane = useCallback((bufferStateRef: MutableRefObject<UseBufferStateReturn>) => {
    const newPaneId = `pane-${Date.now()}`;
    const newPane: InternalPane = {
      id: newPaneId,
      bufferStateRef,
      isActive: true,
    };

    setPanes(prevPanes => {
      // Deactivate all existing panes
      const updatedPanes = prevPanes.map((p: InternalPane) => ({ ...p, isActive: false }));
      return [...updatedPanes, newPane];
    });

    setActivePaneId(newPaneId);
  }, []);

  // Remove a pane
  const removePane = useCallback(
    (paneId: string) => {
      setPanes(prevPanes => {
        const filtered = prevPanes.filter((p: InternalPane) => p.id !== paneId);

        // If we removed the active pane, activate the first remaining pane
        if (paneId === activePaneId && filtered.length > 0) {
          const updatedPanes = filtered.map((p: InternalPane, idx: number) => ({
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
      prevPanes.map((p: InternalPane) => ({
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
    const activePane = panes.find((p: InternalPane) => p.id === activePaneId);
    return activePane?.bufferStateRef.current || null;
  }, [panes, activePaneId]);

  return {
    panes: panes.map((p: InternalPane) => ({
      id: p.id,
      bufferState: p.bufferStateRef.current,
      isActive: p.id === activePaneId,
    })),
    activePaneId,
    isMultiPaneMode,
    addPane,
    removePane,
    activatePane,
    toggleMultiPaneMode,
    getActiveBufferState,
  };
}
