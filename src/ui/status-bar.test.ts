/**
 * Tests for StatusBar component
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { StatusBar } from './status-bar.js';
import { EditMode } from './buffer-state.js';
import { CliRenderer } from '@opentui/core';

// Mock renderer
const mockRenderer = {
  root: {
    add: () => {},
    remove: () => {},
  },
  height: 24,
} as any;

describe('StatusBar', () => {
  let statusBar: StatusBar;

  beforeEach(() => {
    statusBar = new StatusBar(mockRenderer);
  });

  describe('path management', () => {
    it('should set current path', () => {
      statusBar.setPath('test-bucket/documents/');
      expect(statusBar['currentPath']).toBe('test-bucket/documents/');
    });

    it('should handle empty path', () => {
      statusBar.setPath('');
      expect(statusBar['currentPath']).toBe('');
    });
  });

  describe('mode display', () => {
    it('should set NORMAL mode', () => {
      statusBar.setMode(EditMode.Normal);
      expect(statusBar['mode']).toBe(EditMode.Normal);
      expect(statusBar['getModeString']()).toBe('NORMAL');
    });

    it('should set VISUAL mode', () => {
      statusBar.setMode(EditMode.Visual);
      expect(statusBar['mode']).toBe(EditMode.Visual);
      expect(statusBar['getModeString']()).toBe('VISUAL');
    });

    it('should set EDIT mode', () => {
      statusBar.setMode(EditMode.Edit);
      expect(statusBar['mode']).toBe(EditMode.Edit);
      expect(statusBar['getModeString']()).toBe('EDIT');
    });

    it('should set INSERT mode', () => {
      statusBar.setMode(EditMode.Insert);
      expect(statusBar['mode']).toBe(EditMode.Insert);
      expect(statusBar['getModeString']()).toBe('INSERT');
    });

    it('should set SEARCH mode', () => {
      statusBar.setMode(EditMode.Search);
      expect(statusBar['mode']).toBe(EditMode.Search);
      expect(statusBar['getModeString']()).toBe('SEARCH');
    });
  });

  describe('message display', () => {
    it('should set custom message', () => {
      statusBar.setMessage('Custom message', '#FF00FF');
      expect(statusBar['message']).toBe('Custom message');
      expect(statusBar['messageColor']).toBe('#FF00FF');
    });

    it('should use default color when not specified', () => {
      statusBar.setMessage('Default color message');
      expect(statusBar['message']).toBe('Default color message');
      expect(statusBar['messageColor']).toBe('#888888');
    });

    it('should clear message', () => {
      statusBar.setMessage('Temporary message');
      expect(statusBar['message']).toBe('Temporary message');
      
      statusBar.clearMessage();
      expect(statusBar['message']).toBe('');
    });
  });

  describe('convenience methods', () => {
    it('should show error message', () => {
      statusBar.showError('Something went wrong');
      
      expect(statusBar['message']).toBe('❌ Something went wrong');
      expect(statusBar['messageColor']).toBe('#FF0000');
    });

    it('should show success message', () => {
      statusBar.showSuccess('Operation completed');
      
      expect(statusBar['message']).toBe('✓ Operation completed');
      expect(statusBar['messageColor']).toBe('#00FF00');
    });

    it('should show info message', () => {
      statusBar.showInfo('Information');
      
      expect(statusBar['message']).toBe('ℹ Information');
      expect(statusBar['messageColor']).toBe('#0088FF');
    });
  });

  describe('mode colors', () => {
    it('should use green for NORMAL mode', () => {
      expect(statusBar['getModeColor']()).toBe('#00AA00');
      statusBar.setMode(EditMode.Normal);
      expect(statusBar['getModeColor']()).toBe('#00AA00');
    });

    it('should use orange for VISUAL mode', () => {
      statusBar.setMode(EditMode.Visual);
      expect(statusBar['getModeColor']()).toBe('#FFAA00');
    });

    it('should use red for EDIT mode', () => {
      statusBar.setMode(EditMode.Edit);
      expect(statusBar['getModeColor']()).toBe('#FF0000');
    });

    it('should use blue for INSERT mode', () => {
      statusBar.setMode(EditMode.Insert);
      expect(statusBar['getModeColor']()).toBe('#0088FF');
    });

    it('should use orange-red for SEARCH mode', () => {
      statusBar.setMode(EditMode.Search);
      expect(statusBar['getModeColor']()).toBe('#FF6600');
    });
  });


});