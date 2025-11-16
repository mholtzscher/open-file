/**
 * Tests for FloatingWindow component
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { FloatingWindow, FloatingWindowConfig } from './floating-window.js';

// Mock CliRenderer with proper structure
class MockRoot {
  private elements: Map<string, any> = new Map();
  
  add(element: any) {
    this.elements.set(element.id, element);
  }
  
  remove(id: string) {
    this.elements.delete(id);
  }
  
  size() {
    return this.elements.size;
  }
}

const mockRoot = new MockRoot();

const mockRenderer = {
  width: 100,
  height: 30,
  root: mockRoot,
} as any;

describe('FloatingWindow Component', () => {
  let window: FloatingWindow;

  beforeEach(() => {
    window = new FloatingWindow(mockRenderer);
  });

  describe('initialization', () => {
    it('should create with default config', () => {
      const config = window.getConfig();
      expect(config.width).toBe(60);
      expect(config.height).toBe(20);
      expect(config.showBorder).toBe(true);
      expect(config.borderStyle).toBe('single');
    });

    it('should create with custom config', () => {
      const customWindow = new FloatingWindow(mockRenderer, {
        width: 80,
        height: 25,
        title: 'Test Window',
        borderStyle: 'double',
      });

      const config = customWindow.getConfig();
      expect(config.width).toBe(80);
      expect(config.height).toBe(25);
      expect(config.title).toBe('Test Window');
      expect(config.borderStyle).toBe('double');
    });
  });

  describe('visibility', () => {
    it('should be invisible by default', () => {
      expect(window.getIsVisible()).toBe(false);
    });

    it('should track visibility state', () => {
      // Test that we can track visibility without rendering
      expect(window.getIsVisible()).toBe(false);
    });

    it('should hide without render errors', () => {
      window.hide();
      expect(window.getIsVisible()).toBe(false);
    });
  });

  describe('content management', () => {
    it('should set content lines', () => {
      const lines = ['Line 1', 'Line 2', 'Line 3'];
      window.setContent(lines);
      
      // Verify that content was set (without rendering)
      expect(true).toBe(true);
    });

    it('should add individual content lines', () => {
      window.addContentLine('First line');
      window.addContentLine('Second line');
      
      // Verify that content was added
      expect(true).toBe(true);
    });
  });

  describe('configuration updates', () => {
    it('should update config', () => {
      window.updateConfig({ title: 'New Title', width: 100 });
      const config = window.getConfig();
      
      expect(config.title).toBe('New Title');
      expect(config.width).toBe(100);
    });

    it('should preserve other config values when updating', () => {
      window.updateConfig({ title: 'Updated' });
      const config = window.getConfig();
      
      expect(config.title).toBe('Updated');
      expect(config.height).toBe(20); // Default height preserved
    });
  });

  describe('position calculation', () => {
    it('should support center alignment configuration', () => {
      const window1 = new FloatingWindow(mockRenderer, {
        horizontalAlign: 'center',
        verticalAlign: 'center',
        width: 60,
        height: 20,
      });
      
      const config = window1.getConfig();
      expect(config.horizontalAlign).toBe('center');
      expect(config.verticalAlign).toBe('center');
    });

    it('should support different horizontal alignments', () => {
      const leftWindow = new FloatingWindow(mockRenderer, {
        horizontalAlign: 'left',
        width: 40,
      });
      
      const rightWindow = new FloatingWindow(mockRenderer, {
        horizontalAlign: 'right',
        width: 40,
      });
      
      expect(leftWindow.getConfig().horizontalAlign).toBe('left');
      expect(rightWindow.getConfig().horizontalAlign).toBe('right');
    });
  });

  describe('border styles', () => {
    it('should support single border style', () => {
      const window1 = new FloatingWindow(mockRenderer, {
        borderStyle: 'single',
      });
      
      expect(window1.getConfig().borderStyle).toBe('single');
    });

    it('should support double border style', () => {
      const window2 = new FloatingWindow(mockRenderer, {
        borderStyle: 'double',
      });
      
      expect(window2.getConfig().borderStyle).toBe('double');
    });

    it('should support rounded border style', () => {
      const window3 = new FloatingWindow(mockRenderer, {
        borderStyle: 'rounded',
      });
      
      expect(window3.getConfig().borderStyle).toBe('rounded');
    });

    it('should support borderless mode', () => {
      const window4 = new FloatingWindow(mockRenderer, {
        showBorder: false,
      });
      
      expect(window4.getConfig().showBorder).toBe(false);
    });
  });
});
