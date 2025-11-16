/**
 * Multi-pane layout management
 * 
 * Manages multiple viewing panes for split view functionality.
 * Supports horizontal and vertical split layouts.
 */

import { BufferState } from './buffer-state.js';

/**
 * Pane orientation
 */
export enum PaneOrientation {
  Horizontal = 'horizontal',
  Vertical = 'vertical',
}

/**
 * Pane configuration
 */
export interface PaneConfig {
  /** Pane ID */
  id: string;
  /** Buffer state for this pane */
  bufferState: BufferState;
  /** Left position (for vertical split) or top position (for horizontal) */
  position: number;
  /** Width (for vertical) or height (for horizontal) */
  size: number;
  /** Is this pane focused */
  isFocused: boolean;
}

/**
 * Pane manager for handling multiple viewing panes
 */
export class PaneManager {
  private panes: Map<string, PaneConfig> = new Map();
  private focusedPaneId: string | null = null;
  private orientation: PaneOrientation = PaneOrientation.Vertical;
  private nextPaneId: number = 0;

  constructor() {
    // Initialize with single pane
    this.createPane();
  }

  /**
   * Create a new pane
   */
  createPane(bufferState?: BufferState): string {
    const paneId = `pane-${this.nextPaneId++}`;
    const newBufferState = bufferState || new BufferState();
    
    const paneConfig: PaneConfig = {
      id: paneId,
      bufferState: newBufferState,
      position: this.panes.size === 0 ? 0 : this.calculateNextPanePosition(),
      size: this.calculatePaneSize(),
      isFocused: this.panes.size === 0, // First pane is focused
    };

    this.panes.set(paneId, paneConfig);
    if (this.focusedPaneId === null) {
      this.focusedPaneId = paneId;
    }

    return paneId;
  }

  /**
   * Close a pane
   */
  closePane(paneId: string): boolean {
    if (this.panes.size <= 1) {
      return false; // Can't close the last pane
    }

    this.panes.delete(paneId);

    // If closed pane was focused, focus on another pane
    if (this.focusedPaneId === paneId) {
      const firstPane = this.panes.values().next().value;
      if (firstPane) {
        this.focusedPaneId = firstPane.id;
        firstPane.isFocused = true;
      }
    }

    return true;
  }

  /**
   * Switch focus to a pane
   */
  focusPane(paneId: string): boolean {
    const pane = this.panes.get(paneId);
    if (!pane) {
      return false;
    }

    if (this.focusedPaneId) {
      const oldPane = this.panes.get(this.focusedPaneId);
      if (oldPane) {
        oldPane.isFocused = false;
      }
    }

    pane.isFocused = true;
    this.focusedPaneId = paneId;
    return true;
  }

  /**
   * Focus next pane
   */
  focusNextPane(): boolean {
    if (this.panes.size <= 1) {
      return false;
    }

    const paneIds = Array.from(this.panes.keys());
    const currentIndex = paneIds.indexOf(this.focusedPaneId || '');
    const nextIndex = (currentIndex + 1) % paneIds.length;
    return this.focusPane(paneIds[nextIndex]);
  }

  /**
   * Focus previous pane
   */
  focusPreviousPane(): boolean {
    if (this.panes.size <= 1) {
      return false;
    }

    const paneIds = Array.from(this.panes.keys());
    const currentIndex = paneIds.indexOf(this.focusedPaneId || '');
    const prevIndex = (currentIndex - 1 + paneIds.length) % paneIds.length;
    return this.focusPane(paneIds[prevIndex]);
  }

  /**
   * Get a specific pane
   */
  getPane(paneId: string): PaneConfig | undefined {
    return this.panes.get(paneId);
  }

  /**
   * Get focused pane
   */
  getFocusedPane(): PaneConfig | undefined {
    return this.focusedPaneId ? this.panes.get(this.focusedPaneId) : undefined;
  }

  /**
   * Get all panes
   */
  getPanes(): PaneConfig[] {
    return Array.from(this.panes.values());
  }

  /**
   * Get focused pane ID
   */
  getFocusedPaneId(): string | null {
    return this.focusedPaneId;
  }

  /**
   * Set layout orientation
   */
  setOrientation(orientation: PaneOrientation): void {
    this.orientation = orientation;
    this.recalculatePaneLayout();
  }

  /**
   * Get layout orientation
   */
  getOrientation(): PaneOrientation {
    return this.orientation;
  }

  /**
   * Split current pane (create a new pane side-by-side or above/below)
   */
  splitPane(newBufferState?: BufferState): string {
    return this.createPane(newBufferState);
  }

  /**
   * Close all panes except the focused one
   */
  closeOtherPanes(): void {
    if (!this.focusedPaneId) {
      return;
    }

    const paneIds = Array.from(this.panes.keys());
    for (const paneId of paneIds) {
      if (paneId !== this.focusedPaneId) {
        this.closePane(paneId);
      }
    }
  }

  /**
   * Get number of panes
   */
  getPaneCount(): number {
    return this.panes.size;
  }

  /**
   * Private: Calculate position for next pane
   */
  private calculateNextPanePosition(): number {
    const paneCount = this.panes.size;
    if (this.orientation === PaneOrientation.Vertical) {
      // For vertical split, calculate left position
      return paneCount * Math.floor(80 / (paneCount + 1)); // Assuming 80 char width
    } else {
      // For horizontal split, calculate top position
      return paneCount * Math.floor(20 / (paneCount + 1)); // Assuming 20 line height
    }
  }

  /**
   * Private: Calculate size for a pane
   */
  private calculatePaneSize(): number {
    const paneCount = this.panes.size + 1;
    if (this.orientation === PaneOrientation.Vertical) {
      return Math.floor(80 / paneCount); // Assuming 80 char width
    } else {
      return Math.floor(20 / paneCount); // Assuming 20 line height
    }
  }

  /**
   * Private: Recalculate layout for all panes
   */
  private recalculatePaneLayout(): void {
    const panes = Array.from(this.panes.values());
    const paneCount = panes.length;

    for (let i = 0; i < paneCount; i++) {
      const pane = panes[i];
      if (this.orientation === PaneOrientation.Vertical) {
        pane.position = Math.floor((i * 80) / paneCount);
        pane.size = Math.floor(80 / paneCount);
      } else {
        pane.position = Math.floor((i * 20) / paneCount);
        pane.size = Math.floor(20 / paneCount);
      }
    }
  }
}
