/**
 * Status bar component
 * 
 * Displays current path, mode, and status messages at the bottom of the screen
 */

import { CliRenderer, TextRenderable } from '@opentui/core';
import { EditMode } from './buffer-state.js';

/**
 * Status bar component
 */
export class StatusBar {
  private renderer: CliRenderer;
  private currentPath: string = '';
  private mode: EditMode = EditMode.Normal;
  private message: string = '';
  private messageColor: string = '#888888';
  private renderedElements: TextRenderable[] = [];

  constructor(renderer: CliRenderer) {
    this.renderer = renderer;
  }

  /**
   * Set the current path
   */
  setPath(path: string): void {
    this.currentPath = path;
  }

  /**
   * Set the current mode
   */
  setMode(mode: EditMode): void {
    this.mode = mode;
  }

  /**
   * Set a message
   */
  setMessage(message: string, color: string = '#888888'): void {
    this.message = message;
    this.messageColor = color;
  }

  /**
   * Clear message
   */
  clearMessage(): void {
    this.message = '';
  }

  /**
   * Get mode string
   */
  private getModeString(): string {
    switch (this.mode) {
      case EditMode.Normal:
        return 'NORMAL';
      case EditMode.Visual:
        return 'VISUAL';
      case EditMode.Edit:
        return 'EDIT';
      case EditMode.Insert:
        return 'INSERT';
      default:
        return 'UNKNOWN';
    }
  }

  /**
   * Get mode color
   */
  private getModeColor(): string {
    switch (this.mode) {
      case EditMode.Normal:
        return '#00AA00';
      case EditMode.Visual:
        return '#FFAA00';
      case EditMode.Edit:
        return '#FF0000';
      case EditMode.Insert:
        return '#0088FF';
      default:
        return '#888888';
    }
  }

  /**
   * Render the status bar
   */
  render(): void {
    // Clear previous rendered elements
    for (const element of this.renderedElements) {
      this.renderer.root.remove(element.id);
    }
    this.renderedElements = [];

    const bottomRow = this.renderer.height - 1;

    // Left side: path and mode
    const pathText = `📂 ${this.currentPath}`;
    const modeText = `[${this.getModeString()}]`;
    const leftContent = `${pathText} ${modeText}`;

    const left = new TextRenderable(this.renderer, {
      id: 'status-left',
      content: leftContent,
      fg: '#FFFF00',
      position: 'absolute',
      left: 2,
      bottom: 0,
    });
    this.renderedElements.push(left);
    this.renderer.root.add(left);

    // Right side: message or help text
    const rightContent = this.message || 'q:quit  j/k:nav  v:select  i:insert  dd:delete  w:save  ?:help';
    const right = new TextRenderable(this.renderer, {
      id: 'status-right',
      content: rightContent,
      fg: this.message ? this.messageColor : '#666666',
      position: 'absolute',
      right: 2,
      bottom: 0,
    });
    this.renderedElements.push(right);
    this.renderer.root.add(right);
  }

  /**
   * Show an error message
   */
  showError(message: string): void {
    this.setMessage(`❌ ${message}`, '#FF0000');
  }

  /**
   * Show a success message
   */
  showSuccess(message: string): void {
    this.setMessage(`✓ ${message}`, '#00FF00');
  }

  /**
   * Show an info message
   */
  showInfo(message: string): void {
    this.setMessage(`ℹ ${message}`, '#0088FF');
  }
}
