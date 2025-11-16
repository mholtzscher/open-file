/**
 * Tests for multi-pane layout management
 */

import { describe, it, expect } from 'bun:test';
import { PaneManager, PaneOrientation } from './pane-manager.js';
import { BufferState } from './buffer-state.js';

describe('PaneManager', () => {
  describe('Basic Pane Operations', () => {
    it('should create initial pane', () => {
      const manager = new PaneManager();
      expect(manager.getPaneCount()).toBe(1);
      expect(manager.getFocusedPaneId()).not.toBeNull();
    });

    it('should create new pane', () => {
      const manager = new PaneManager();
      const paneId = manager.createPane();
      
      expect(manager.getPaneCount()).toBe(2);
      expect(paneId).toBeDefined();
    });

    it('should not close last pane', () => {
      const manager = new PaneManager();
      const paneId = manager.getFocusedPaneId();
      
      const result = manager.closePane(paneId!);
      expect(result).toBe(false);
      expect(manager.getPaneCount()).toBe(1);
    });

    it('should close pane when multiple panes exist', () => {
      const manager = new PaneManager();
      const firstPaneId = manager.getFocusedPaneId()!;
      const secondPaneId = manager.createPane();
      
      expect(manager.getPaneCount()).toBe(2);
      
      const result = manager.closePane(secondPaneId);
      expect(result).toBe(true);
      expect(manager.getPaneCount()).toBe(1);
    });
  });

  describe('Pane Focus', () => {
    it('should focus a specific pane', () => {
      const manager = new PaneManager();
      const firstPaneId = manager.getFocusedPaneId()!;
      const secondPaneId = manager.createPane();
      
      manager.focusPane(secondPaneId);
      expect(manager.getFocusedPaneId()).toBe(secondPaneId);
    });

    it('should focus next pane', () => {
      const manager = new PaneManager();
      const firstPaneId = manager.getFocusedPaneId()!;
      const secondPaneId = manager.createPane();
      
      expect(manager.getFocusedPaneId()).toBe(firstPaneId);
      manager.focusNextPane();
      expect(manager.getFocusedPaneId()).toBe(secondPaneId);
    });

    it('should focus previous pane', () => {
      const manager = new PaneManager();
      const firstPaneId = manager.getFocusedPaneId()!;
      const secondPaneId = manager.createPane();
      
      manager.focusNextPane(); // Focus second pane
      manager.focusPreviousPane();
      expect(manager.getFocusedPaneId()).toBe(firstPaneId);
    });

    it('should wrap around when focusing next pane', () => {
      const manager = new PaneManager();
      const firstPaneId = manager.getFocusedPaneId()!;
      manager.createPane();
      
      manager.focusNextPane(); // Go to second
      manager.focusNextPane(); // Wrap around to first
      expect(manager.getFocusedPaneId()).toBe(firstPaneId);
    });
  });

  describe('Pane Orientation', () => {
    it('should set vertical orientation', () => {
      const manager = new PaneManager();
      manager.setOrientation(PaneOrientation.Vertical);
      expect(manager.getOrientation()).toBe(PaneOrientation.Vertical);
    });

    it('should set horizontal orientation', () => {
      const manager = new PaneManager();
      manager.setOrientation(PaneOrientation.Horizontal);
      expect(manager.getOrientation()).toBe(PaneOrientation.Horizontal);
    });
  });

  describe('Pane Access', () => {
    it('should get pane by ID', () => {
      const manager = new PaneManager();
      const paneId = manager.createPane();
      
      const pane = manager.getPane(paneId);
      expect(pane).toBeDefined();
      expect(pane?.id).toBe(paneId);
    });

    it('should get focused pane', () => {
      const manager = new PaneManager();
      const focusedPane = manager.getFocusedPane();
      
      expect(focusedPane).toBeDefined();
      expect(focusedPane?.isFocused).toBe(true);
    });

    it('should get all panes', () => {
      const manager = new PaneManager();
      manager.createPane();
      manager.createPane();
      
      const panes = manager.getPanes();
      expect(panes.length).toBe(3);
    });

    it('should return undefined for non-existent pane', () => {
      const manager = new PaneManager();
      const pane = manager.getPane('non-existent-pane');
      expect(pane).toBeUndefined();
    });
  });

  describe('Split Operations', () => {
    it('should split pane', () => {
      const manager = new PaneManager();
      const bufferState = new BufferState();
      
      manager.splitPane(bufferState);
      expect(manager.getPaneCount()).toBe(2);
    });

    it('should close other panes', () => {
      const manager = new PaneManager();
      manager.createPane();
      manager.createPane();
      const focusedId = manager.getFocusedPaneId();
      
      expect(manager.getPaneCount()).toBe(3);
      manager.closeOtherPanes();
      expect(manager.getPaneCount()).toBe(1);
      expect(manager.getFocusedPaneId()).toBe(focusedId);
    });
  });

  describe('Pane Buffer State', () => {
    it('should have independent buffer state for each pane', () => {
      const manager = new PaneManager();
      const firstPaneId = manager.getFocusedPaneId()!;
      const secondPaneId = manager.createPane();
      
      const firstPane = manager.getPane(firstPaneId)!;
      const secondPane = manager.getPane(secondPaneId)!;
      
      expect(firstPane.bufferState).not.toBe(secondPane.bufferState);
    });

    it('should support custom buffer state', () => {
      const manager = new PaneManager();
      const customState = new BufferState();
      const paneId = manager.createPane(customState);
      
      const pane = manager.getPane(paneId)!;
      expect(pane.bufferState).toBe(customState);
    });
  });
});
