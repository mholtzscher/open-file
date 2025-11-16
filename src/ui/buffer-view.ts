/**
 * Buffer view component
 * 
 * Renders the entry list as a buffer that can be edited.
 * Similar to oil.nvim's approach - the buffer itself is the interface.
 */

import { CliRenderer, TextRenderable } from '@opentui/core';
import { Entry, EntryType } from '../types/entry.js';
import { BufferState, EditMode } from './buffer-state.js';
import { Theme, CatppuccinMocha } from './theme.js';

/**
 * Column interface for configurable display
 */
export interface Column {
  /** Column ID for tracking */
  id: string;
  /** Column label/header */
  label: string;
  /** Width in characters */
  width: number;
  /** Render function for entry */
  render(entry: Entry): string;
  /** Color for this column */
  color?: (entry: Entry, isSelected: boolean) => string;
}

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
  /** Custom columns */
  columns?: Column[];
}

/**
 * Standard columns
 */
export class Columns {
  /**
   * Icon column for directory/file type
   */
  static createIconColumn(): Column {
    return {
      id: 'icon',
      label: '',
      width: 4,
      render: (entry) => {
        return entry.type === EntryType.Directory ? '📁  ' : '📄  ';
      },
    };
  }

  /**
   * Name column
   */
  static createNameColumn(width: number = 30): Column {
    return {
      id: 'name',
      label: 'Name',
      width,
      render: (entry) => {
        const suffix = entry.type === EntryType.Directory ? '/' : '';
        return (entry.name + suffix).padEnd(width);
      },
       color: (entry, isSelected) => {
         if (entry.type === EntryType.Directory) {
           return Theme.getDirectoryColor(isSelected);
         }
         return Theme.getFileColor(isSelected);
       },
    };
  }

  /**
   * Size column
   */
  static createSizeColumn(width: number = 12): Column {
    return {
      id: 'size',
      label: 'Size',
      width,
      render: (entry) => {
        if (entry.type === EntryType.Directory) {
          return '-'.padEnd(width);
        }
        const size = entry.size ?? 0;
        const formatted = size > 1024 * 1024
          ? `${(size / (1024 * 1024)).toFixed(1)}MB`
          : size > 1024
            ? `${(size / 1024).toFixed(1)}KB`
            : `${size}B`;
        return formatted.padEnd(width);
       },
       color: () => CatppuccinMocha.overlay1,
     };
   }

   /**
    * Modified date column
    */
   static createDateColumn(width: number = 12): Column {
     return {
       id: 'modified',
       label: 'Modified',
       width,
       render: (entry) => {
         if (!entry.modified) {
           return '-'.padEnd(width);
         }
         const date = entry.modified instanceof Date ? entry.modified : new Date(entry.modified);
         const str = date.toLocaleDateString('en-US', {
           month: '2-digit',
           day: '2-digit',
           year: '2-digit',
         });
         return str.padEnd(width);
       },
       color: () => CatppuccinMocha.overlay0,
    };
  }
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
  private columns: Column[] = [];

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
      columns: options.columns,
    };

    // Set up default columns
    this.setupColumns();
  }

  /**
   * Setup columns based on options
   */
  private setupColumns(): void {
    if (this.options.columns) {
      this.columns = this.options.columns;
    } else {
      // Default columns
      if (this.options.showIcons) {
        this.columns.push(Columns.createIconColumn());
      }
      this.columns.push(Columns.createNameColumn(30));
      if (this.options.showSizes) {
        this.columns.push(Columns.createSizeColumn(12));
      }
      if (this.options.showDates) {
        this.columns.push(Columns.createDateColumn(12));
      }
    }
  }

  /**
   * Format an entry for display with columns
   */
  private formatEntry(entry: Entry, isSelected: boolean): string {
    const parts: string[] = [];
    
    for (const column of this.columns) {
      parts.push(column.render(entry));
    }
    
    const content = parts.join('');
    const prefix = isSelected ? '> ' : '  ';
    return `${prefix}${content}`;
  }

   /**
    * Get color for entry based on selection and mode
    */
   private getEntryColor(index: number, entry: Entry, visibleIndex?: number): string {
     // For visible entries, use visible cursor index to handle scrolling
     const isSelected = visibleIndex !== undefined 
       ? visibleIndex === this.bufferState.getVisibleCursorIndex(this.options.height ?? 20)
       : index === this.bufferState.selection.cursorIndex;
     
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
       return Theme.getEditModeColor();
     } else if (isInSelection) {
       return Theme.getSelectionColor();
     } else if (isSelected) {
       return Theme.getCursorColor();
     }

     // Check if entry has custom color
     const nameColumn = this.columns.find(c => c.id === 'name');
     if (nameColumn?.color) {
       return nameColumn.color(entry, isSelected);
     }

     return CatppuccinMocha.text;
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

      // Get page size based on available height
      const pageSize = this.options.height ?? 20;
      
      // Get entries to display (filtered if searching)
      const displayEntries = this.bufferState.getDisplayEntries(pageSize);
      const filtered = this.bufferState.getFilteredEntries();

       // Render visible entries
       let row = this.options.top!;
       for (let visibleIndex = 0; visibleIndex < displayEntries.length; visibleIndex++) {
         const entry = displayEntries[visibleIndex];
         // Get actual index in the full entries list
         let actualIndex = -1;
         if (this.bufferState.isSearching && this.bufferState.searchQuery) {
           // When searching, we need to find the entry in the full list
           actualIndex = this.bufferState.entries.findIndex(e => e.id === entry.id);
         } else {
           // When not searching, use direct index lookup
           actualIndex = this.bufferState.entries.indexOf(entry);
         }
         
         // Check if this entry is the cursor position
         // Use visible cursor index to handle scrolling correctly
         const visibleCursorIndex = this.bufferState.getVisibleCursorIndex(pageSize);
         const isSelected = visibleIndex === visibleCursorIndex;
         const text = this.formatEntry(entry, isSelected);
         const color = this.getEntryColor(actualIndex, entry, visibleIndex);

       const line = new TextRenderable(this.renderer, {
         id: `buffer-line-${actualIndex}`,
         content: text,
         fg: color,
         position: 'absolute',
         left: this.options.left,
         top: row++,
       });

       this.renderer.root.add(line);
       this.renderedLines.set(actualIndex, line);
     }
     
      // Show search query if in search mode
      if (this.bufferState.isSearching) {
        const searchRow = this.options.top! - 1;
        const flags = this.bufferState.getSearchStatus();
        const matchInfo = this.bufferState.searchQuery ? ` (${filtered.length} matches)` : '';
        const content = `/ ${this.bufferState.searchQuery}${flags}${matchInfo}`;
         const searchText = new TextRenderable(this.renderer, {
           id: 'search-bar',
           content: content,
           fg: Theme.getSearchModeColor(),
           position: 'absolute',
           left: this.options.left,
           top: searchRow,
         });
        this.renderer.root.add(searchText);
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

  /**
   * Get current columns
   */
  getColumns(): Column[] {
    return this.columns;
  }

  /**
   * Set columns
   */
  setColumns(columns: Column[]): void {
    this.columns = columns;
    this.render();
  }
}
