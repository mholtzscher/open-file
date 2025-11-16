#!/usr/bin/env bun

import { createCliRenderer, CliRenderer, TextRenderable } from '@opentui/core';
import { Adapter } from './adapters/adapter.js';
import { MockAdapter } from './adapters/mock-adapter.js';
import { S3Adapter } from './adapters/s3-adapter.js';
import { BufferState, EditMode } from './ui/buffer-state.js';
import { BufferView } from './ui/buffer-view.js';
import { StatusBar } from './ui/status-bar.js';
import { ConfirmationDialog } from './ui/confirmation-dialog.js';
import { FloatingWindow } from './ui/floating-window.js';
import { detectChanges, buildOperationPlan } from './utils/change-detection.js';
import { ConfigManager } from './utils/config.js';
import { parseArgs, printHelp, printVersion } from './utils/cli.js';
import { formatErrorForDisplay, parseAwsError } from './utils/errors.js';

/**
 * Main application class
 */
class S3Explorer {
  private renderer!: CliRenderer;
  private adapter!: Adapter;
  private bufferState!: BufferState;
  private bufferView!: BufferView;
  private statusBar!: StatusBar;
  private helpWindow?: FloatingWindow;
  private titleRenderable?: TextRenderable;
  private bucketRenderable?: TextRenderable;
  private lastCalculatedHeight = 0;
  private currentPath = 'test-bucket/';
  private configManager: ConfigManager;
  private bucket: string = 'test-bucket';

  constructor(bucket?: string, adapter?: Adapter, configManager?: ConfigManager) {
    this.configManager = configManager || new ConfigManager();
    if (bucket) {
      this.bucket = bucket;
      this.currentPath = bucket.endsWith('/') ? bucket : bucket + '/';
    }
    if (adapter) {
      this.adapter = adapter;
    } else {
      this.adapter = new MockAdapter();
    }
  }

  /**
   * Start the application
   */
  async start(): Promise<void> {
    // Initialize renderer
    this.renderer = await createCliRenderer({
      exitOnCtrlC: true,
    });

    // Initialize status bar
    this.statusBar = new StatusBar(this.renderer);

    // Setup event handlers
    this.setupEventHandlers();

    // Load initial buffer
    try {
      await this.loadBuffer(this.currentPath);
      this.currentPath = this.bufferState.currentPath;
    } catch (error) {
      const err = parseAwsError(error, 'Loading buffer');
      this.statusBar.showError(err.message);
    }

    // Render initial UI
    await this.render();

    // Start main loop
    await this.mainLoop();
  }

  /**
   * Load entries from adapter into buffer
   */
  private async loadBuffer(path: string): Promise<void> {
    const result = await this.adapter.list(path);
    this.bufferState = new BufferState(result.entries);
    this.bufferState.currentPath = path;
  }

  /**
   * Setup keyboard event handlers
   */
  private setupEventHandlers(): void {
    this.renderer.keyInput.on('keypress', (key) => {
      this.handleKeyPress(key);
    });
  }

   /**
    * Handle keyboard input
    */
    private handleKeyPress(key: any): void {
      switch (this.bufferState.mode) {
        case EditMode.Normal:
          this.handleNormalModeKey(key);
          break;
        case EditMode.Visual:
          this.handleVisualModeKey(key);
          break;
        case EditMode.Insert:
          this.handleInsertModeKey(key);
          break;
        case EditMode.Edit:
          this.handleEditModeKey(key);
          break;
        case EditMode.Search:
          this.handleSearchModeKey(key);
          break;
      }
    }

   /**
    * Handle keys in normal mode
    */
    private handleNormalModeKey(key: any): void {
      const keyResult = this.bufferState.handleKeyPress(key.name);
    
       // If key was handled as a sequence, execute the action
       // Note: buffer-state already executed most sequence actions (gg, G, yy, dd)
       // We only need to handle app-level actions here like showing the help menu
       if (keyResult.handled) {
         if (keyResult.sequence[0] === 'g' && keyResult.sequence[1] === '?') {
           // g? - show help/actions menu (app-level action)
           this.handleShowHelp();
         }
         // Other sequence actions (gg, G, yy, dd) are already handled by buffer-state
         // Don't return early - let it fall through to render() at the end
       }

     // Handle Ctrl+N and Ctrl+P (page navigation) - these should work regardless
     // Try multiple key name formats since different systems report them differently
     if (key.name === 'C-n' || key.name === 'c-n' || (key.ctrl && key.name === 'n')) {
       this.handlePageDown();
       this.render();
       return;
     }
     if (key.name === 'C-p' || key.name === 'c-p' || (key.ctrl && key.name === 'p')) {
       this.handlePageUp();
       this.render();
       return;
     }

     // Handle single keys that aren't part of a sequence
     if (keyResult.sequence.length === 0 || 
         (keyResult.sequence.length === 1 && keyResult.sequence[0] !== 'g')) {
       switch (key.name) {
         case 'q':
           process.exit(0);
           break;
          case 'j':
            const pageSize = Math.max(10, this.renderer.height - 7);
            this.bufferState.moveCursorDown(pageSize); // Pass page size for scroll adjustment
            break;
          case 'k':
            const pageSizeUp = Math.max(10, this.renderer.height - 7);
            this.bufferState.moveCursorUp(pageSizeUp); // Pass page size for scroll adjustment
            break;
         case 'v':
           this.bufferState.startVisualSelection();
           break;
         case 'enter':
         case 'l':
           // Navigate into directory or open file
           this.handleNavigate();
           break;
         case 'h':
         case 'backspace':
           // Navigate to parent directory
           this.handleNavigateUp();
           break;
          case 'i':
            // Enter insert mode to create new entry
            this.bufferState.enterInsertMode();
            break;
          case 'a':
            this.bufferState.enterEditMode();
            break;
          case 'w':
           // Save buffer (commit changes)
           this.handleSave();
           break;
          case 'c':
           // Copy selected entry (deprecated, use yy instead)
           this.handleCopy();
           break;
           case 'p':
            // Paste after cursor (Vim-style)
            this.handlePasteAfter();
            break;
          case '/':
           // Enter search mode
           this.handleEnterSearch();
           break;
          case 'u':
           // Undo (Vim-style)
           if (this.bufferState.undo()) {
             this.statusBar.showSuccess('Undone');
           } else {
             this.statusBar.showInfo('Nothing to undo');
           }
           break;
         case 'C-r':
           // Redo (Vim-style, Ctrl+R)
           if (this.bufferState.redo()) {
             this.statusBar.showSuccess('Redone');
           } else {
             this.statusBar.showInfo('Nothing to redo');
           }
           break;
         case 'escape':
           // Close help window if open
           if (this.helpWindow?.getIsVisible()) {
             this.helpWindow.hide();
             this.statusBar.clearMessage();
           }
           break;
        }
      }

     this.render();
   }

  /**
   * Handle keys in visual mode
   */
  private handleVisualModeKey(key: any): void {
    switch (key.name) {
      case 'escape':
        this.bufferState.exitVisualSelection();
        break;
      case 'j':
        this.bufferState.extendVisualSelection('down');
        break;
      case 'k':
        this.bufferState.extendVisualSelection('up');
        break;
      case 'd':
        // Delete selected entries
        this.handleDeleteSelection();
        break;
    }

     this.render();
   }

   /**
    * Handle keys in insert mode (creating new entries)
    */
   private handleInsertModeKey(key: any): void {
     switch (key.name) {
       case 'escape':
         // Cancel entry creation
         this.bufferState.exitInsertMode();
         this.statusBar.showInfo('Entry creation cancelled');
         break;
       case 'enter':
         // Confirm entry creation
         const newEntry = this.bufferState.confirmInsertEntry();
         if (newEntry) {
           this.statusBar.showSuccess(`Created entry: ${newEntry.name}`);
         } else {
           this.statusBar.showInfo('Empty entry name - cancelled');
         }
         break;
       case 'tab':
         // Apply first tab completion
         this.bufferState.applyFirstTabCompletion();
         break;
       case 'backspace':
         // Remove last character from entry name
         this.bufferState.removeCharFromInsertingName();
         break;
       default:
         // Add character to entry name if it's a printable character
         if (key.name && key.name.length === 1) {
           this.bufferState.addCharToInsertingName(key.name);
         }
         break;
     }

     this.render();
   }

    /**
     * Handle keys in edit mode
     */
    private handleEditModeKey(key: any): void {
     switch (key.name) {
       case 'escape':
         this.bufferState.exitEditMode();
         break;
       // Text editing would be handled by the renderer
       // For now, just exit with ESC
     }

     this.render();
   }

    /**
     * Handle keys in search mode
     */
    private handleSearchModeKey(key: any): void {
      switch (key.name) {
        case 'escape':
          // Exit search mode and return to normal mode
          this.bufferState.exitSearchMode();
          this.bufferState.mode = EditMode.Normal;
          break;
        case 'enter':
          // Confirm search and stay in search mode for refinement
          break;
        case 'backspace':
          // Delete last character from search query
          this.bufferState.updateSearchQuery(this.bufferState.searchQuery.slice(0, -1));
          break;
        case 'n':
          // Find next match
          this.bufferState.findNextMatch();
          break;
        case 'N':
          // Find previous match
          this.bufferState.findPreviousMatch();
          break;
        case 'C-c':
          // Toggle case-sensitive search
          this.bufferState.toggleCaseSensitive();
          this.statusBar.showInfo(`Case-sensitive: ${this.bufferState.searchCaseSensitive ? 'ON' : 'OFF'}`);
          break;
        case 'C-r':
          // Toggle regex mode
          this.bufferState.toggleRegexMode();
          this.statusBar.showInfo(`Regex mode: ${this.bufferState.searchUseRegex ? 'ON' : 'OFF'}`);
          break;
        default:
          // Add character to search query if it's a printable character
          if (key.name && key.name.length === 1) {
            const newQuery = this.bufferState.searchQuery + key.name;
            this.bufferState.updateSearchQuery(newQuery);
          }
          break;
      }

      this.render();
    }

  /**
   * Navigate into a directory
   */
  private async handleNavigate(): Promise<void> {
    const selected = this.bufferState.getSelectedEntry();
    if (selected && selected.type.toString() === 'directory') {
      try {
        await this.loadBuffer(selected.path);
        this.currentPath = this.bufferState.currentPath;
        this.statusBar.clearMessage();
        this.render();
      } catch (error) {
        const err = parseAwsError(error, 'Navigate');
        this.statusBar.showError(err.message);
        this.render();
      }
    }
  }

  /**
   * Navigate to parent directory
   */
  private async handleNavigateUp(): Promise<void> {
    const parts = this.currentPath.split('/').filter(p => p);
    if (parts.length > 1) {
      parts.pop();
      const newPath = parts.join('/') + '/';
      try {
        await this.loadBuffer(newPath);
        this.currentPath = this.bufferState.currentPath;
        this.statusBar.clearMessage();
        this.render();
      } catch (error) {
        const err = parseAwsError(error, 'Navigate up');
        this.statusBar.showError(err.message);
        this.render();
      }
    }
  }

   /**
    * Delete selected entries
    */
    private handleDeleteSelection(): void {
      // Save state to undo history before making changes
      this.bufferState.saveToHistory();
      
      const selected = this.bufferState.getSelectedEntries();
      for (const entry of selected) {
        const index = this.bufferState.entries.findIndex(e => e.id === entry.id);
        if (index !== -1) {
          this.bufferState.deleteEntry(index);
        }
      }
      this.statusBar.showSuccess(`${selected.length} entries marked for deletion (undo with u)`);
      this.bufferState.exitVisualSelection();
    }

    /**
     * Delete the current line (entry at cursor) - marks for deletion, not immediate removal
     */
    private handleDeleteLine(): void {
      // Save state to undo history before making changes
      this.bufferState.saveToHistory();
      
      const cursorIndex = this.bufferState.selection.cursorIndex;
      if (cursorIndex >= 0 && cursorIndex < this.bufferState.entries.length) {
        this.bufferState.deleteEntry(cursorIndex);
        this.statusBar.showSuccess('Entry marked for deletion (undo with u)');
        this.render(); // Refresh the UI immediately
      }
    }

   /**
    * Save buffer (detect changes and execute operations)
    */
  private async handleSave(): Promise<void> {
    // Detect changes
    const changes = detectChanges(
      this.bufferState.originalEntries,
      this.bufferState.entries,
      this.bufferState.idMap
    );

    if (changes.creates.length === 0 &&
        changes.deletes.length === 0 &&
        changes.moves.size === 0) {
      // No changes
      return;
    }

    // Build operation plan
    const plan = buildOperationPlan(changes);

    // Show confirmation dialog
    const dialog = new ConfirmationDialog(this.renderer, plan);
    const result = await dialog.show();

    if (result.confirmed) {
       // Execute operations
       await this.executeOperationPlan(plan);

       // Commit the deletions to the buffer state
       this.bufferState.commitDeletions();

       // Reload buffer
       await this.loadBuffer(this.currentPath);
     }

     this.render();
  }

   /**
    * Execute an operation plan
    */
   private async executeOperationPlan(plan: any): Promise<void> {
     for (const op of plan.operations) {
       try {
         switch (op.type) {
           case 'create':
             await this.adapter.create(op.path, op.entryType);
             break;
           case 'delete':
             await this.adapter.delete(op.path, true);
             break;
           case 'move':
             await this.adapter.move(op.source, op.destination);
             break;
         }
       } catch (error) {
         console.error(`Failed to execute operation ${op.id}:`, error);
       }
     }
   }

   /**
    * Copy selected entry to clipboard
    */
   private handleCopy(): void {
     const selected = this.bufferState.getSelectedEntry();
     if (selected) {
       this.bufferState.copySelection();
       this.statusBar.showInfo(`Copied: ${selected.name}`);
     }
   }

   /**
    * Paste after cursor
    */
   private handlePasteAfter(): void {
     if (!this.bufferState.hasClipboardContent()) {
       this.statusBar.setMessage('Nothing to paste');
       return;
     }
     
     // Save state to undo history before pasting
     this.bufferState.saveToHistory();
     const pastedEntries = this.bufferState.pasteAfterCursor();
     this.statusBar.showSuccess(`Pasted ${pastedEntries.length} entry/entries`);
   }

   /**
    * Paste before cursor
    */
   private handlePasteBefore(): void {
     if (!this.bufferState.hasClipboardContent()) {
       this.statusBar.setMessage('Nothing to paste');
       return;
     }
     
     // Save state to undo history before pasting
     this.bufferState.saveToHistory();
     const pastedEntries = this.bufferState.pasteBeforeCursor();
     this.statusBar.showSuccess(`Pasted ${pastedEntries.length} entry/entries`);
   }

     /**
      * Page down (Ctrl+N) - half page
      */
    private handlePageDown(): void {
     const pageSize = Math.max(10, this.renderer.height - 7); // Dynamic page size based on terminal height
     const halfPage = Math.ceil(pageSize / 2); // Half page scroll
     this.bufferState.pageDown(halfPage, pageSize);
     this.statusBar.showInfo(`Scroll: ${this.bufferState.scrollOffset}-${Math.min(this.bufferState.scrollOffset + pageSize, this.bufferState.entries.length)}`);
   }

     /**
      * Page up (Ctrl+P) - half page
      */
    private handlePageUp(): void {
     const pageSize = Math.max(10, this.renderer.height - 7); // Dynamic page size based on terminal height
     const halfPage = Math.ceil(pageSize / 2); // Half page scroll
     this.bufferState.pageUp(halfPage, pageSize);
     this.statusBar.showInfo(`Scroll: ${this.bufferState.scrollOffset}-${Math.min(this.bufferState.scrollOffset + pageSize, this.bufferState.entries.length)}`);
   }

    /**
     * Enter search mode
     */
    private handleEnterSearch(): void {
      this.bufferState.mode = EditMode.Search;
      this.bufferState.enterSearchMode();
      this.statusBar.showInfo('Type to search, ESC to exit');
    }

    /**
     * Show help and available actions menu
     */
    private handleShowHelp(): void {
      const helpLines = [
        '═══════════════════════════════════════',
        'KEYBINDINGS & ACTIONS',
        '═══════════════════════════════════════',
        '',
        'NAVIGATION:',
        '  j/k      - Move cursor up/down',
        '  h/←      - Go to parent directory',
        '  l/→      - Open directory/file',
        '  gg       - Go to top',
        '  G        - Go to bottom',
        '  Ctrl+P   - Page up',
        '  Ctrl+N   - Page down',
        '',
        'SELECTION & EDITING:',
        '  v        - Start visual selection',
        '  yy       - Copy/yank current entry',
        '  p        - Paste after cursor',
        '  dd       - Delete current entry',
        '  i        - Insert new entry',
        '  a        - Edit current entry',
        '  u        - Undo',
        '  Ctrl+R   - Redo',
        '',
        'OPERATIONS:',
        '  w        - Save/write changes',
        '  /        - Search/filter',
        '  g?       - Show this help menu',
        '  q        - Quit',
        '',
        'Press ESC to close this menu',
      ];
      
      if (!this.helpWindow) {
        this.helpWindow = new FloatingWindow(this.renderer, {
          width: 45,
          height: 35,
          title: 'KEYBINDINGS',
          horizontalAlign: 'center',
          verticalAlign: 'center',
        });
      }
      
      this.helpWindow.setContent(helpLines);
      this.helpWindow.show();
      this.statusBar.showInfo('Help menu - Press ESC to close');
    }

    /**
     * Render the UI
     */
   private async render(): Promise<void> {
     // Create title renderable only once
     if (!this.titleRenderable) {
       this.titleRenderable = new TextRenderable(this.renderer, {
         id: 'title',
         content: '📦 open-s3 - S3 TUI Explorer',
         fg: '#00FF00',
         position: 'absolute',
         left: 2,
         top: 1,
       });
       this.renderer.root.add(this.titleRenderable);
     }

     // Create bucket renderable only once
     if (!this.bucketRenderable) {
       this.bucketRenderable = new TextRenderable(this.renderer, {
         id: 'bucket',
         content: `Bucket: ${this.bucket}`,
         fg: '#00CCFF',
         position: 'absolute',
         left: 2,
         top: 2,
       });
       this.renderer.root.add(this.bucketRenderable);
     }

     // Create buffer view only once, but check if height changed
     if (!this.bufferView) {
       const displayConfig = this.configManager.getDisplayConfig();
       // Calculate height to use full terminal: total height - top padding - status bar - title - bucket line - margin
       const calculatedHeight = Math.max(10, this.renderer.height - 7);
       this.lastCalculatedHeight = calculatedHeight;
       this.bufferView = new BufferView(this.renderer, this.bufferState, {
         left: 4,
         top: 4,
         height: calculatedHeight,
         showIcons: displayConfig.showIcons ?? true,
         showSizes: displayConfig.showSizes ?? true,
         showDates: displayConfig.showDates ?? false,
       });
     } else {
       // Update the existing buffer view with new state
       this.bufferView.updateState(this.bufferState);
     }

     // Update status bar
     this.statusBar.setPath(this.bufferState.currentPath);
     this.statusBar.setMode(this.bufferState.mode);
     this.statusBar.setSearchQuery(this.bufferState.searchQuery);

     // Render components (reuse existing renderables, they update internally)
     this.bufferView.render();
     this.statusBar.render();
   }

  /**
   * Main application loop
   */
  private async mainLoop(): Promise<void> {
    // Keep the app running
    while (true) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

// Main entry point
async function main() {
  // Parse CLI arguments (skip 'bun' and script name)
  const args = Bun.argv.slice(2);
  const cliArgs = parseArgs(args);

  // Handle help and version flags
  if (cliArgs.help) {
    printHelp();
    process.exit(0);
  }

  if (cliArgs.version) {
    printVersion();
    process.exit(0);
  }

  // Create config manager
  const configManager = new ConfigManager(cliArgs.config);

  // Determine adapter
  let adapter: Adapter;
  const adapterType = cliArgs.adapter || configManager.getAdapter();

  if (adapterType === 's3') {
    // Get S3 config from CLI args or config file
    const s3Config = configManager.getS3Config();
    const finalS3Config = {
      region: cliArgs.region || s3Config.region || 'us-east-1',
      bucket: cliArgs.bucket || s3Config.bucket || 'my-bucket',
      endpoint: cliArgs.endpoint || s3Config.endpoint,
      accessKeyId: cliArgs.accessKey || s3Config.accessKeyId,
      secretAccessKey: cliArgs.secretKey || s3Config.secretAccessKey,
    };

    adapter = new S3Adapter(finalS3Config);
  } else {
    // Use mock adapter
    adapter = new MockAdapter();
  }

  // Create and start application
  const bucket = cliArgs.bucket || configManager.getS3Config().bucket || 'test-bucket';
  const app = new S3Explorer(bucket, adapter, configManager);
  await app.start();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
