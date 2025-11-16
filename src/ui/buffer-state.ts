/**
 * Buffer state management for the editor
 * 
 * Manages the current view state including:
 * - Current entries being displayed
 * - Selection state (cursor position, visual selection)
 * - Edit mode state
 * - Undo/redo history
 */

import { Entry, EntryType } from '../types/entry.js';
import { EntryIdMap } from '../utils/entry-id.js';

/**
 * Edit mode for the buffer
 */
export enum EditMode {
  Normal = 'normal',
  Visual = 'visual',
  Insert = 'insert',
  Edit = 'edit',
  Search = 'search',
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
  
   /** Search/filter query */
   searchQuery = '';
   
   /** Whether search mode is active */
   isSearching = false;

   /** Whether search is case-sensitive */
   searchCaseSensitive = false;

   /** Whether to use regex matching */
   searchUseRegex = false;

   /** Key sequence state for multi-key commands */
    private keySequence: string[] = [];
    private keySequenceTimeout?: ReturnType<typeof setTimeout>;

    /** Entry being created/edited in insert mode */
    insertingEntryName = '';
    
    /** Position where new entry will be inserted */
    insertPosition = 0;

    /** Set of entry IDs marked for deletion */
    deletedEntryIds: Set<string> = new Set();

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
   moveCursorUp(pageSize: number = 10): void {
     this.selection.cursorIndex = Math.max(0, this.selection.cursorIndex - 1);
     
      // Adjust scroll offset to keep cursor visible
      if (this.selection.cursorIndex < this.scrollOffset) {
        // Scroll up to show cursor at the top of visible area
        this.scrollOffset = Math.max(0, this.selection.cursorIndex);
      }
   }

   /**
    * Move cursor down
    */
   moveCursorDown(pageSize: number = 10): void {
     this.selection.cursorIndex = Math.min(
       this.entries.length - 1,
       this.selection.cursorIndex + 1
     );
     
      // Adjust scroll offset to keep cursor visible
      if (this.selection.cursorIndex >= this.scrollOffset + pageSize) {
        // Scroll down to show cursor at near the bottom of visible area
        this.scrollOffset = Math.min(
          this.selection.cursorIndex - pageSize + 1,
          Math.max(0, this.entries.length - pageSize)
        );
      }
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
    * Enter insert mode to create a new entry
    */
   enterInsertMode(): void {
     this.mode = EditMode.Insert;
     this.insertingEntryName = '';
     this.insertPosition = this.selection.cursorIndex + 1;
   }

   /**
    * Exit insert mode without creating entry
    */
   exitInsertMode(): void {
     this.mode = EditMode.Normal;
     this.insertingEntryName = '';
   }

   /**
    * Confirm entry creation and add it to the buffer
    */
   confirmInsertEntry(): Entry | null {
     if (!this.insertingEntryName.trim()) {
       this.exitInsertMode();
       return null;
     }

     // Create new entry
     const newEntry: Entry = {
       id: `entry_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
       name: this.insertingEntryName.trim(),
       path: `${this.currentPath}${this.insertingEntryName.trim()}`,
       type: EntryType.File, // Default to file, can be changed later
       size: undefined,
       modified: new Date(),
     };

     // Insert at the determined position
     this.entries.splice(this.insertPosition, 0, newEntry);
     this.idMap.registerEntry(newEntry.path, newEntry.id);
     this.isDirty = true;

     this.exitInsertMode();
     return newEntry;
   }

   /**
    * Add character to the entry name being inserted
    */
   addCharToInsertingName(char: string): void {
     this.insertingEntryName += char;
   }

   /**
    * Remove last character from entry name being inserted
    */
   removeCharFromInsertingName(): void {
     this.insertingEntryName = this.insertingEntryName.slice(0, -1);
   }

   /**
    * Get tab completion suggestions for entry names
    */
   getTabCompletions(): string[] {
     const prefix = this.insertingEntryName.toLowerCase();
     const existingNames = this.entries.map(e => e.name.toLowerCase());
     
     // Return common file extensions as suggestions if prefix is empty
     if (!prefix) {
       return ['js', 'ts', 'json', 'md', 'txt', 'html', 'css'];
     }

     // Return existing entries that match the prefix
     const matches = existingNames
       .filter(name => name.startsWith(prefix) && name !== prefix)
       .slice(0, 5);

     return matches.length > 0 ? matches : ['js', 'ts', 'json', 'md'];
   }

   /**
    * Apply first tab completion suggestion
    */
   applyFirstTabCompletion(): void {
     const suggestions = this.getTabCompletions();
     if (suggestions.length > 0) {
       this.insertingEntryName = suggestions[0];
     }
   }

   /**
    * Mark an entry for deletion (can be undone with 'u')
    */
   deleteEntry(index: number): void {
     const entry = this.entries[index];
     if (entry) {
       this.deletedEntryIds.add(entry.id);
       this.isDirty = true;
     }
   }

   /**
    * Delete multiple entries (for visual selection)
    */
   deleteEntries(indices: number[]): void {
     for (const index of indices) {
       this.deleteEntry(index);
     }
   }

   /**
    * Check if an entry is marked for deletion
    */
   isEntryDeleted(index: number): boolean {
     const entry = this.entries[index];
     return entry ? this.deletedEntryIds.has(entry.id) : false;
   }

   /**
    * Unmark an entry for deletion (undo)
    */
   undeleteEntry(index: number): void {
     const entry = this.entries[index];
     if (entry) {
       this.deletedEntryIds.delete(entry.id);
     }
   }

   /**
    * Get list of deleted entries
    */
   getDeletedEntries(): Entry[] {
     return this.entries.filter((e) => this.deletedEntryIds.has(e.id));
   }

   /**
    * Permanently remove all deleted entries from the buffer
    */
   commitDeletions(): void {
     this.entries = this.entries.filter((e) => !this.deletedEntryIds.has(e.id));
     for (const id of this.deletedEntryIds) {
       const entry = this.originalEntries.find((e) => e.id === id);
       if (entry) {
         this.idMap.removeEntry(entry.path);
       }
     }
     this.deletedEntryIds.clear();
   }

   /**
    * Clear deletion marks (undo all deletions)
    */
   undoAllDeletions(): void {
     this.deletedEntryIds.clear();
   }

   /**
    * Add an entry to the buffer
    */
   addEntry(entry: Entry): void {
     this.entries.push(entry);
     this.idMap.registerEntry(entry.path, entry.id);
     this.isDirty = true;
     // Clear redo history when making a new change
     this.redoHistory = [];
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
      // Clear redo history when making a new change
      this.redoHistory = [];
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
      // Clear redo history when making a new change
      this.redoHistory = [];
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
      cloned.searchQuery = this.searchQuery;
      cloned.isSearching = this.isSearching;
      cloned.insertingEntryName = this.insertingEntryName;
      cloned.insertPosition = this.insertPosition;
      cloned.deletedEntryIds = new Set(this.deletedEntryIds);
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
          id: `entry_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
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
          id: `entry_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
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
     * Page down (Ctrl+D) - scroll down by specified amount
     * @param scrollAmount - number of entries to scroll (default 10)
     * @param pageSize - number of entries per page for cursor positioning (default 10)
     */
    pageDown(scrollAmount: number = 10, pageSize: number = 10): void {
      const maxScroll = Math.max(0, this.entries.length - pageSize);
      const oldScrollOffset = this.scrollOffset;
      this.scrollOffset = Math.min(this.scrollOffset + scrollAmount, maxScroll);
      
      // Vim-style: position cursor at a reasonable position in the new view
      // If cursor was at top, move it to middle. If cursor was in middle, keep it there.
      const relativePos = this.selection.cursorIndex - oldScrollOffset;
      const targetRelativePos = relativePos <= 2 ? Math.floor(pageSize / 2) : relativePos;
      
      // Ensure cursor stays within bounds and visible area
      this.selection.cursorIndex = Math.min(
        Math.max(this.scrollOffset + targetRelativePos, this.scrollOffset),
        Math.min(this.scrollOffset + pageSize - 1, this.entries.length - 1)
      );
    }

    /**
     * Page up (Ctrl+U) - scroll up by specified amount
     * @param scrollAmount - number of entries to scroll (default 10)
     * @param pageSize - number of entries per page for cursor positioning (default 10)
     */
    pageUp(scrollAmount: number = 10, pageSize: number = 10): void {
      const oldScrollOffset = this.scrollOffset;
      this.scrollOffset = Math.max(0, this.scrollOffset - scrollAmount);
      
      // Vim-style: maintain cursor's relative position in the new view
      const relativePos = this.selection.cursorIndex - oldScrollOffset;
      
      // Ensure cursor stays within bounds and visible area
      this.selection.cursorIndex = Math.min(
        this.scrollOffset + relativePos,
        Math.min(this.scrollOffset + pageSize - 1, this.entries.length - 1)
      );
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

   /**
    * Enter search mode
    */
   enterSearchMode(): void {
     this.isSearching = true;
     this.searchQuery = '';
     this.scrollOffset = 0;
   }

   /**
    * Exit search mode
    */
   exitSearchMode(): void {
     this.isSearching = false;
     this.searchQuery = '';
     this.scrollOffset = 0;
     this.selection.cursorIndex = 0;
   }

   /**
    * Update search query (for live filtering)
    */
   updateSearchQuery(query: string): void {
     this.searchQuery = query;
     this.scrollOffset = 0;
     
     // Reset cursor to first filtered entry
     const filtered = this.getFilteredEntries();
     if (filtered.length > 0) {
       this.selection.cursorIndex = this.entries.indexOf(filtered[0]);
     } else {
       this.selection.cursorIndex = 0;
     }
   }

    /**
     * Get filtered entries based on search query
     * Supports case-sensitive and regex matching
     */
    getFilteredEntries(): Entry[] {
      if (!this.searchQuery) {
        return this.entries;
      }
      
      try {
        if (this.searchUseRegex) {
          // Use regex matching
          const flags = this.searchCaseSensitive ? 'g' : 'gi';
          const regex = new RegExp(this.searchQuery, flags);
          return this.entries.filter(entry => regex.test(entry.name));
        } else {
          // Use substring matching
          const query = this.searchCaseSensitive ? this.searchQuery : this.searchQuery.toLowerCase();
          return this.entries.filter(entry => {
            const name = this.searchCaseSensitive ? entry.name : entry.name.toLowerCase();
            return name.includes(query);
          });
        }
      } catch (e) {
        // If regex is invalid, fall back to substring matching
        const query = this.searchCaseSensitive ? this.searchQuery : this.searchQuery.toLowerCase();
        return this.entries.filter(entry => {
          const name = this.searchCaseSensitive ? entry.name : entry.name.toLowerCase();
          return name.includes(query);
        });
      }
    }

   /**
    * Get currently displayed entries (respecting search filter and scroll)
    */
   getDisplayEntries(pageSize: number = 10): Entry[] {
     const filtered = this.getFilteredEntries();
     const start = this.scrollOffset;
     const end = Math.min(start + pageSize, filtered.length);
     return filtered.slice(start, end);
   }

   /**
    * Get the actual index in all entries for a filtered entry
    */
   getActualIndex(filteredIndex: number): number {
     const filtered = this.getFilteredEntries();
     if (filteredIndex >= 0 && filteredIndex < filtered.length) {
       return this.entries.indexOf(filtered[filteredIndex]);
     }
     return 0;
   }

    /**
     * Check if entry matches current search query
     */
    isEntryMatching(entry: Entry): boolean {
      if (!this.searchQuery) {
        return true;
      }
      
      const query = this.searchQuery.toLowerCase();
      return entry.name.toLowerCase().includes(query);
    }

    /**
     * Toggle case-sensitive search
     */
    toggleCaseSensitive(): void {
      this.searchCaseSensitive = !this.searchCaseSensitive;
      // Re-apply filter with new setting
      this.updateSearchQuery(this.searchQuery);
    }

   /**
    * Toggle regex matching
    */
   toggleRegexMode(): void {
     this.searchUseRegex = !this.searchUseRegex;
   }

   /**
    * Find next match in search results
    */
   findNextMatch(): void {
     const filtered = this.getFilteredEntries();
     if (filtered.length === 0) {
       return;
     }

     // Find the index of the current cursor entry in the filtered results
     const currentEntry = this.entries[this.selection.cursorIndex];
     const currentIndex = filtered.findIndex(e => e.id === currentEntry?.id);

     // Move to next match, wrapping around if needed
     const nextIndex = currentIndex < filtered.length - 1 ? currentIndex + 1 : 0;
     const nextEntry = filtered[nextIndex];

     // Update cursor to point to the next match
     this.selection.cursorIndex = this.entries.findIndex(e => e.id === nextEntry.id);
   }

   /**
    * Find previous match in search results
    */
   findPreviousMatch(): void {
     const filtered = this.getFilteredEntries();
     if (filtered.length === 0) {
       return;
     }

     // Find the index of the current cursor entry in the filtered results
     const currentEntry = this.entries[this.selection.cursorIndex];
     const currentIndex = filtered.findIndex(e => e.id === currentEntry?.id);

     // Move to previous match, wrapping around if needed
     const prevIndex = currentIndex > 0 ? currentIndex - 1 : filtered.length - 1;
     const prevEntry = filtered[prevIndex];

     // Update cursor to point to the previous match
     this.selection.cursorIndex = this.entries.findIndex(e => e.id === prevEntry.id);
   }

   /**
    * Handle key press for sequence detection
    */
    handleKeyPress(key: string): { handled: boolean; sequence: string[]; action?: 'moveToTop' | 'moveToBottom' | 'delete' } {
     // Clear existing timeout
     if (this.keySequenceTimeout) {
       clearTimeout(this.keySequenceTimeout);
     }

     // Add key to sequence
     this.keySequence.push(key);
     

     
     // Set timeout to clear sequence after 500ms
     this.keySequenceTimeout = setTimeout(() => {
       this.keySequence = [];
     }, 500);

      // Check for gg sequence
      if (this.keySequence.length === 2 && 
          this.keySequence[0] === 'g' && 
          this.keySequence[1] === 'g') {
        this.keySequence = [];
        this.moveCursorToTop();
        return { handled: true, sequence: ['g', 'g'], action: 'moveToTop' };
      }

      // Check for dd sequence (delete line)
      if (this.keySequence.length === 2 && 
          this.keySequence[0] === 'd' && 
          this.keySequence[1] === 'd') {
        this.keySequence = [];
        return { handled: true, sequence: ['d', 'd'], action: 'delete' };
      }

      // Check for G (single key)
      if (this.keySequence.length === 1 && this.keySequence[0] === 'G') {
        console.log('G detected, entries.length:', this.entries.length);
        this.moveCursorToBottom();
        return { handled: true, sequence: ['G'], action: 'moveToBottom' };
      }

      // Single g without second g - not handled yet
      if (this.keySequence.length === 1 && this.keySequence[0] === 'g') {
        return { handled: false, sequence: ['g'] };
      }

      // Single d without second d - not handled yet (could be part of dd)
      if (this.keySequence.length === 1 && this.keySequence[0] === 'd') {
        return { handled: false, sequence: ['d'] };
      }

     // Other keys - clear sequence and not handled
     if (this.keySequence.length > 0) {
       const sequence = [...this.keySequence];
       this.keySequence = [];
       return { handled: false, sequence };
     }

     return { handled: false, sequence: this.keySequence };
   }

    /**
     * Get search filter status string
     */
    getSearchStatus(): string {
      const flags: string[] = [];
      if (this.searchCaseSensitive) flags.push('Aa');
      if (this.searchUseRegex) flags.push('.*');
      return flags.length > 0 ? `[${flags.join(' ')}]` : '';
    }

    /**
     * Save current state to undo history
     */
    saveToHistory(): void {
      this.undoHistory.push(this.clone());
      // Clear redo history when making a new change
      this.redoHistory = [];
    }

    /**
     * Undo last operation
     */
    undo(): boolean {
      if (this.undoHistory.length === 0) {
        return false;
      }

      // Save current state to redo history
      this.redoHistory.push(this.clone());

      // Restore previous state
      const previousState = this.undoHistory.pop()!;
      this.entries = previousState.entries;
      this.originalEntries = previousState.originalEntries;
      this.mode = previousState.mode;
      this.selection = { ...previousState.selection };
      this.isDirty = previousState.isDirty;
      this.currentPath = previousState.currentPath;
      this.copyRegister = [...previousState.copyRegister];
       this.scrollOffset = previousState.scrollOffset;
       this.searchQuery = previousState.searchQuery;
       this.isSearching = previousState.isSearching;
       this.insertingEntryName = previousState.insertingEntryName;
       this.insertPosition = previousState.insertPosition;
       this.deletedEntryIds = new Set(previousState.deletedEntryIds);
       this.idMap = new EntryIdMap();
       for (const entry of this.entries) {
         this.idMap.registerEntry(entry.path, entry.id);
       }

       return true;
     }

     /**
      * Redo last undone operation
      */
     redo(): boolean {
      if (this.redoHistory.length === 0) {
        return false;
      }

      // Save current state to undo history
      this.undoHistory.push(this.clone());

      // Restore next state
      const nextState = this.redoHistory.pop()!;
      this.entries = nextState.entries;
      this.originalEntries = nextState.originalEntries;
      this.mode = nextState.mode;
      this.selection = { ...nextState.selection };
      this.isDirty = nextState.isDirty;
      this.currentPath = nextState.currentPath;
      this.copyRegister = [...nextState.copyRegister];
       this.scrollOffset = nextState.scrollOffset;
       this.searchQuery = nextState.searchQuery;
       this.isSearching = nextState.isSearching;
       this.insertingEntryName = nextState.insertingEntryName;
       this.insertPosition = nextState.insertPosition;
       this.deletedEntryIds = new Set(nextState.deletedEntryIds);
       this.idMap = new EntryIdMap();
       for (const entry of this.entries) {
         this.idMap.registerEntry(entry.path, entry.id);
       }

       return true;
     }

     /**
      * Check if undo is available
      */
     canUndo(): boolean {
      return this.undoHistory.length > 0;
    }

    /**
     * Check if redo is available
     */
    canRedo(): boolean {
      return this.redoHistory.length > 0;
    }

    /**
     * Clear undo/redo history
     */
    clearHistory(): void {
      this.undoHistory = [];
      this.redoHistory = [];
    }

    /**
     * Get undo/redo history status
     */
    getHistoryStatus(): string {
      return `Undo: ${this.undoHistory.length}, Redo: ${this.redoHistory.length}`;
    }
}
