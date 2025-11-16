/**
 * Buffer view component
 * 
 * Renders the entry list as a buffer that can be edited.
 * Similar to oil.nvim's approach - the buffer itself is the interface.
 */

import { CliRenderer, TextRenderable } from '@opentui/core';
import { Entry, EntryType } from '../types/entry.js';
import { BufferState, EditMode } from './buffer-state.js';

/**
 * Options for buffer rendering
 */
export interface BufferViewOptions {
  /** Left position */
  left?: number;
  /** Top position */
  top?: number;
  /** Width */
  width?: number;
  /** Height */
  height?: number;
  /** Show file icons */
  showIcons?: boolean;
  /** Show file sizes */
  showSizes?: boolean;
  /** Show modification dates */
  showDates?: boolean;
}

/**
 * Buffer view component
 * 
 * Renders entries as editable text lines in the terminal
 */
export class BufferView {
  private renderer: CliRenderer;
  private bufferState: BufferState;
  private options: BufferViewOptions;
  private renderedLines: Map<number, TextRenderable> = new Map();

  constructor(
    renderer: CliRenderer,
    bufferState: BufferState,
    options: BufferViewOptions = {}
  ) {
    this.renderer = renderer;
    this.bufferState = bufferState;
    this.options = {
      left: options.left ?? 2,
      top: options.top ?? 3,
      width: options.width ?? 80,
      height: options.height ?? 20,
      showIcons: options.showIcons ?? true,
      showSizes: options.showSizes ?? true,
      showDates: options.showDates ?? false,
    };
  }

  /**
   * Format an entry for display
   */
  private formatEntry(entry: Entry, isSelected: boolean): string {
    const icon = this.options.showIcons
      ? entry.type === EntryType.Directory
        ? '📁 '
        : '📄 '
      : '';

    const size =
      this.options.showSizes && entry.size !== undefined
        ? ` (${entry.size} bytes)`
        : '';

    const prefix = isSelected ? '> ' : '  ';

    return `${prefix}${icon}${entry.name}${size}`;
  }

  /**
   * Get color for entry based on selection and mode
   */
  private getEntryColor(index: number): string {
    const isSelected = index === this.bufferState.selection.cursorIndex;
    const isInSelection =
      this.bufferState.selection.isActive &&
      this.bufferState.selection.selectionStart !== undefined &&
      this.bufferState.selection.selectionEnd !== undefined &&
      index >= Math.min(
        this.bufferState.selection.selectionStart,
        this.bufferState.selection.selectionEnd
      ) &&
      index <= Math.max(
        this.bufferState.selection.selectionStart,
        this.bufferState.selection.selectionEnd
      );

    if (isSelected && this.bufferState.mode === EditMode.Edit) {
      return '#FF0000'; // Red for edit mode
    } else if (isInSelection) {
      return '#00FF00'; // Green for selection
    } else if (isSelected) {
      return '#FFFF00'; // Yellow for cursor
    }

    return '#FFFFFF'; // White for normal
  }

  /**
   * Render the buffer
   */
  render(): void {
    // Clear previous rendered lines
    for (const line of this.renderedLines.values()) {
      this.renderer.root.remove(line.id);
    }
    this.renderedLines.clear();

    // Render each entry
    let row = this.options.top!;
    for (let i = 0; i < this.bufferState.entries.length; i++) {
      const entry = this.bufferState.entries[i];
      const isSelected = i === this.bufferState.selection.cursorIndex;
      const text = this.formatEntry(entry, isSelected);
      const color = this.getEntryColor(i);

      const line = new TextRenderable(this.renderer, {
        id: `buffer-line-${i}`,
        content: text,
        fg: color,
        position: 'absolute',
        left: this.options.left,
        top: row++,
      });

      this.renderer.root.add(line);
      this.renderedLines.set(i, line);
    }
  }

  /**
   * Update the buffer state
   */
  updateState(state: BufferState): void {
    this.bufferState = state;
    this.render();
  }

  /**
   * Get the current buffer state
   */
  getState(): BufferState {
    return this.bufferState;
  }
}
