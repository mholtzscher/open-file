/**
 * Buffer state management for the editor
 * 
 * Manages the current view state including:
 * - Current entries being displayed
 * - Selection state (cursor position, visual selection)
 * - Edit mode state
 * - Undo/redo history
 */

import { Entry } from '../types/entry.js';
import { EntryIdMap } from '../utils/entry-id.js';

/**
 * Edit mode for the buffer
 */
export enum EditMode {
  Normal = 'normal',
  Visual = 'visual',
  Insert = 'insert',
  Edit = 'edit',
}

/**
 * Selection state
 */
export interface SelectionState {
  /** Currently selected entry index (cursor position) */
  cursorIndex: number;
  /** Start of visual selection (when in visual mode) */
  selectionStart?: number;
  /** End of visual selection (when in visual mode) */
  selectionEnd?: number;
  /** Whether selection is active */
  isActive: boolean;
}

/**
 * Buffer state
 */
export class BufferState {
  /** Current entries in the buffer */
  entries: Entry[] = [];
  
  /** Original entries (before edits) */
  originalEntries: Entry[] = [];
  
  /** Current edit mode */
  mode: EditMode = EditMode.Normal;
  
  /** Selection/cursor state */
  selection: SelectionState = {
    cursorIndex: 0,
    isActive: false,
  };
  
  /** Entry ID map for tracking changes */
  idMap: EntryIdMap = new EntryIdMap();
  
  /** Undo history */
  undoHistory: BufferState[] = [];
  
  /** Redo history */
  redoHistory: BufferState[] = [];
  
  /** Whether the buffer has unsaved changes */
  isDirty = false;
  
  /** Current path being viewed */
  currentPath = '';
  
  /** Copy register (clipboard) - stores entries to be pasted */
  copyRegister: Entry[] = [];
  
  /** Scroll offset for viewport (number of entries scrolled from top) */
  scrollOffset = 0;

  constructor(entries: Entry[] = []) {
    this.entries = entries;
    this.originalEntries = JSON.parse(JSON.stringify(entries));
    
    // Register all entries in the ID map
    for (const entry of entries) {
      this.idMap.registerEntry(entry.path, entry.id);
    }
  }

  /**
   * Get the currently selected entry
   */
  getSelectedEntry(): Entry | undefined {
    return this.entries[this.selection.cursorIndex];
  }

  /**
   * Get all selected entries (when in visual mode)
   */
  getSelectedEntries(): Entry[] {
    if (!this.selection.isActive || this.selection.selectionStart === undefined) {
      return this.getSelectedEntry() ? [this.getSelectedEntry()!] : [];
    }

    const start = Math.min(
      this.selection.selectionStart,
      this.selection.selectionEnd ?? this.selection.selectionStart
    );
    const end = Math.max(
      this.selection.selectionStart,
      this.selection.selectionEnd ?? this.selection.selectionStart
    );

    return this.entries.slice(start, end + 1);
  }

  /**
   * Move cursor up
   */
  moveCursorUp(): void {
    this.selection.cursorIndex = Math.max(0, this.selection.cursorIndex - 1);
  }

  /**
   * Move cursor down
   */
  moveCursorDown(): void {
    this.selection.cursorIndex = Math.min(
      this.entries.length - 1,
      this.selection.cursorIndex + 1
    );
  }

  /**
   * Move cursor to top
   */
  moveCursorToTop(): void {
    this.selection.cursorIndex = 0;
  }

  /**
   * Move cursor to bottom
   */
  moveCursorToBottom(): void {
    this.selection.cursorIndex = Math.max(0, this.entries.length - 1);
  }

  /**
   * Start visual selection
   */
  startVisualSelection(): void {
    this.mode = EditMode.Visual;
    this.selection.isActive = true;
    this.selection.selectionStart = this.selection.cursorIndex;
    this.selection.selectionEnd = this.selection.cursorIndex;
  }

  /**
   * Extend visual selection
   */
  extendVisualSelection(direction: 'up' | 'down'): void {
    if (!this.selection.isActive) {
      return;
    }

    if (direction === 'up') {
      this.moveCursorUp();
      this.selection.selectionEnd = this.selection.cursorIndex;
    } else {
      this.moveCursorDown();
      this.selection.selectionEnd = this.selection.cursorIndex;
    }
  }

  /**
   * Exit visual selection
   */
  exitVisualSelection(): void {
    this.mode = EditMode.Normal;
    this.selection.isActive = false;
    this.selection.selectionStart = undefined;
    this.selection.selectionEnd = undefined;
  }

  /**
   * Enter edit mode
   */
  enterEditMode(): void {
    this.mode = EditMode.Edit;
  }

  /**
   * Exit edit mode
   */
  exitEditMode(): void {
    this.mode = EditMode.Normal;
  }

  /**
   * Add an entry to the buffer
   */
  addEntry(entry: Entry): void {
    this.entries.push(entry);
    this.idMap.registerEntry(entry.path, entry.id);
    this.isDirty = true;
  }

  /**
   * Remove an entry from the buffer
   */
  removeEntry(index: number): void {
    const entry = this.entries[index];
    if (entry) {
      this.entries.splice(index, 1);
      this.idMap.removeEntry(entry.path);
      this.isDirty = true;
    }
  }

  /**
   * Update an entry
   */
  updateEntry(index: number, updates: Partial<Entry>): void {
    const entry = this.entries[index];
    if (entry) {
      const oldPath = entry.path;
      Object.assign(entry, updates);
      
      // Update ID map if path changed
      if (updates.path && updates.path !== oldPath) {
        this.idMap.removeEntry(oldPath);
        this.idMap.registerEntry(updates.path, entry.id);
      }
      
      this.isDirty = true;
    }
  }

  /**
   * Check if buffer has unsaved changes
   */
  hasChanges(): boolean {
    return this.isDirty || JSON.stringify(this.entries) !== JSON.stringify(this.originalEntries);
  }

  /**
   * Save the buffer (mark as clean)
   */
  save(): void {
    this.isDirty = false;
    this.originalEntries = JSON.parse(JSON.stringify(this.entries));
  }

  /**
   * Discard changes and revert to original
   */
  discard(): void {
    this.entries = JSON.parse(JSON.stringify(this.originalEntries));
    this.isDirty = false;
  }

   /**
    * Clone the current state for undo/redo
    */
   clone(): BufferState {
     const cloned = new BufferState(JSON.parse(JSON.stringify(this.entries)));
     cloned.mode = this.mode;
     cloned.selection = { ...this.selection };
     cloned.isDirty = this.isDirty;
     cloned.currentPath = this.currentPath;
     cloned.copyRegister = JSON.parse(JSON.stringify(this.copyRegister));
     cloned.scrollOffset = this.scrollOffset;
     return cloned;
   }

   /**
    * Copy selected entries to the clipboard
    */
   copySelection(): void {
     const selected = this.getSelectedEntries();
     this.copyRegister = JSON.parse(JSON.stringify(selected));
   }

   /**
    * Paste entries before the cursor position
    */
   pasteBeforeCursor(): Entry[] {
     if (this.copyRegister.length === 0) {
       return [];
     }
     
     // Create copies of the entries with new IDs and paths
     const pastedEntries: Entry[] = [];
     for (const entry of this.copyRegister) {
       const newEntry: Entry = {
         ...JSON.parse(JSON.stringify(entry)),
         id: `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
       };
       pastedEntries.push(newEntry);
       this.entries.splice(this.selection.cursorIndex + pastedEntries.length - 1, 0, newEntry);
       this.idMap.registerEntry(newEntry.path, newEntry.id);
     }
     
     this.isDirty = true;
     return pastedEntries;
   }

   /**
    * Paste entries after the cursor position
    */
   pasteAfterCursor(): Entry[] {
     if (this.copyRegister.length === 0) {
       return [];
     }
     
     // Create copies of the entries with new IDs and paths
     const pastedEntries: Entry[] = [];
     for (const entry of this.copyRegister) {
       const newEntry: Entry = {
         ...JSON.parse(JSON.stringify(entry)),
         id: `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
       };
       pastedEntries.push(newEntry);
       this.entries.splice(this.selection.cursorIndex + pastedEntries.length, 0, newEntry);
       this.idMap.registerEntry(newEntry.path, newEntry.id);
     }
     
     this.isDirty = true;
     return pastedEntries;
   }

   /**
    * Check if copy register has entries
    */
   hasClipboardContent(): boolean {
     return this.copyRegister.length > 0;
   }

   /**
    * Clear the copy register
    */
   clearClipboard(): void {
     this.copyRegister = [];
   }

   /**
    * Page down (Ctrl+D) - scroll down by page size
    * @param pageSize - number of entries per page (default 10)
    */
   pageDown(pageSize: number = 10): void {
     const maxScroll = Math.max(0, this.entries.length - pageSize);
     this.scrollOffset = Math.min(this.scrollOffset + pageSize, maxScroll);
     
     // Keep cursor in visible area
     if (this.selection.cursorIndex < this.scrollOffset) {
       this.selection.cursorIndex = this.scrollOffset;
     } else if (this.selection.cursorIndex >= this.scrollOffset + pageSize) {
       this.selection.cursorIndex = Math.min(this.scrollOffset + pageSize - 1, this.entries.length - 1);
     }
   }

   /**
    * Page up (Ctrl+U) - scroll up by page size
    * @param pageSize - number of entries per page (default 10)
    */
   pageUp(pageSize: number = 10): void {
     this.scrollOffset = Math.max(0, this.scrollOffset - pageSize);
     
     // Keep cursor in visible area
     if (this.selection.cursorIndex >= this.scrollOffset + pageSize) {
       this.selection.cursorIndex = Math.max(0, this.scrollOffset + pageSize - 1);
     } else if (this.selection.cursorIndex < this.scrollOffset) {
       this.selection.cursorIndex = this.scrollOffset;
     }
   }

   /**
    * Get visible entries based on scroll offset
    * @param pageSize - number of entries per page (default 10)
    */
   getVisibleEntries(pageSize: number = 10): Entry[] {
     const start = this.scrollOffset;
     const end = Math.min(start + pageSize, this.entries.length);
     return this.entries.slice(start, end);
   }

   /**
    * Get the index of the cursor relative to visible entries
    */
   getVisibleCursorIndex(pageSize: number = 10): number {
     return Math.max(0, Math.min(this.selection.cursorIndex - this.scrollOffset, pageSize - 1));
   }
}
