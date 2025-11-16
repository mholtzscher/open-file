/**
 * Status bar component
 * 
 * Displays current path, mode, and status messages at the bottom of the screen
 */

import { CliRenderer, TextRenderable } from '@opentui/core';
import { EditMode } from './buffer-state.js';
import { Theme, CatppuccinMocha } from './theme.js';

/**
 * Status bar component
 */
export class StatusBar {
   private renderer: CliRenderer;
   private currentPath: string = '';
   private mode: EditMode = EditMode.Normal;
   private message: string = '';
   private messageColor: string = CatppuccinMocha.overlay1;
   private searchQuery: string = '';
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
   setMessage(message: string, color: string = CatppuccinMocha.overlay1): void {
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
   * Set search query for display in search mode
   */
  setSearchQuery(query: string): void {
    this.searchQuery = query;
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
       case EditMode.Search:
         return 'SEARCH';
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
          return Theme.getNormalModeColor();
        case EditMode.Visual:
          return Theme.getVisualModeColor();
        case EditMode.Edit:
          return Theme.getEditModeColor();
        case EditMode.Insert:
          return Theme.getInsertModeColor();
        case EditMode.Search:
          return Theme.getSearchModeColor();
        default:
          return CatppuccinMocha.overlay1;
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
    const searchText = this.mode === EditMode.Search ? ` /${this.searchQuery}` : '';
    const leftContent = `${pathText} ${modeText}${searchText}`;

     const left = new TextRenderable(this.renderer, {
       id: 'status-left',
       content: leftContent,
       fg: CatppuccinMocha.yellow,
       position: 'absolute',
       left: 2,
       bottom: 0,
     });
     this.renderedElements.push(left);
     this.renderer.root.add(left);

     // Right side: message or help text
      const helpText = this.mode === EditMode.Search 
        ? 'n:next  N:prev  Ctrl+C:toggle-case  Ctrl+R:regex  ESC:exit'
        : 'q:quit  j/k:nav  v:select  i:insert  dd:delete  w:save  p:paste  Ctrl+N/P:page  g?:help';
      const rightContent = this.message || helpText;
     const right = new TextRenderable(this.renderer, {
       id: 'status-right',
       content: rightContent,
       fg: this.message ? this.messageColor : CatppuccinMocha.overlay0,
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
     this.setMessage(`❌ ${message}`, Theme.getErrorColor());
   }

   /**
    * Show a success message
    */
   showSuccess(message: string): void {
     this.setMessage(`✓ ${message}`, Theme.getSuccessColor());
   }

   /**
    * Show an info message
    */
   showInfo(message: string): void {
     this.setMessage(`ℹ ${message}`, Theme.getInfoColor());
  }
}
