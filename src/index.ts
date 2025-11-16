#!/usr/bin/env bun

import { createCliRenderer, CliRenderer, TextRenderable } from '@opentui/core';
import { Adapter } from './adapters/adapter.js';
import { MockAdapter } from './adapters/mock-adapter.js';
import { S3Adapter } from './adapters/s3-adapter.js';
import { BufferState, EditMode } from './ui/buffer-state.js';
import { BufferView } from './ui/buffer-view.js';
import { StatusBar } from './ui/status-bar.js';
import { ConfirmationDialog } from './ui/confirmation-dialog.js';
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
  private currentPath = 'test-bucket/';
  private configManager: ConfigManager;
  private bucket: string = 'test-bucket';

  constructor(bucket?: string, adapter?: Adapter) {
    this.configManager = new ConfigManager();
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
    if (keyResult.handled) {
      if (keyResult.sequence[0] === 'g' && keyResult.sequence[1] === 'g') {
        // gg - move to top
        this.bufferState.moveCursorToTop();
      } else if (keyResult.sequence[0] === 'G') {
        // G - move to bottom
        this.bufferState.moveCursorToBottom();
      }
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
           this.bufferState.moveCursorDown(10); // Pass page size for scroll adjustment
           break;
         case 'k':
           this.bufferState.moveCursorUp(10); // Pass page size for scroll adjustment
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
        case 'a':
          this.bufferState.enterEditMode();
          break;
         case 'w':
          // Save buffer (commit changes)
          this.handleSave();
          break;
         case 'c':
          // Copy selected entry
          this.handleCopy();
          break;
          // 'p' is now used for page up, paste moved to 'P'
          case 'P':
           // Paste after cursor (was 'p', now 'P')
           this.handlePasteAfter();
           break;
           case 'n':
           // Next page (page down)
           this.handlePageDown();
           break;
           case 'p':
           // Previous page (page up)
           this.handlePageUp();
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
          this.bufferState.exitSearchMode();
          break;
        case 'enter':
          // Confirm search and stay in search mode for refinement
          break;
        case 'backspace':
          // Delete last character from search query
          this.bufferState.updateSearchQuery(this.bufferState.searchQuery.slice(0, -1));
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
        this.bufferState.removeEntry(index);
      }
    }
    this.bufferState.exitVisualSelection();
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
     * Page down (Ctrl+D) - half page
     */
   private handlePageDown(): void {
     const pageSize = 10; // Entries per page
     const halfPage = Math.ceil(pageSize / 2); // Half page = 5 entries
     this.bufferState.pageDown(halfPage, pageSize);
     this.statusBar.showInfo(`Scroll: ${this.bufferState.scrollOffset}-${Math.min(this.bufferState.scrollOffset + pageSize, this.bufferState.entries.length)}`);
   }

   /**
     * Page up (Ctrl+U) - half page
     */
   private handlePageUp(): void {
     const pageSize = 10; // Entries per page
     const halfPage = Math.ceil(pageSize / 2); // Half page = 5 entries
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
    * Render the UI
    */
   private async render(): Promise<void> {
     // Note: OpenTUI automatically handles updates, so we just update components
     // No need to manually clear and re-add

     // Title
     const title = new TextRenderable(this.renderer, {
       id: 'title',
       content: '📦 open-s3 - S3 TUI Explorer',
       fg: '#00FF00',
       position: 'absolute',
       left: 2,
       top: 1,
     });

     // Render header info (path/bucket)
     const bucketText = new TextRenderable(this.renderer, {
       id: 'bucket',
       content: `Bucket: ${this.bucket}`,
       fg: '#00CCFF',
       position: 'absolute',
       left: 2,
       top: 2,
     });

      // Create buffer view with improved styling (only once, then reuse and update)
      if (!this.bufferView) {
        this.bufferView = new BufferView(this.renderer, this.bufferState, {
          left: 4,
          top: 4,
          height: 10, // Match the page size used in scrolling logic
        });
      } else {
        // Update the existing buffer view with new state
        this.bufferView.updateState(this.bufferState);
      }

     // Update status bar
     this.statusBar.setPath(this.bufferState.currentPath);
     this.statusBar.setMode(this.bufferState.mode);

     // Render components
     this.renderer.root.add(title);
     this.renderer.root.add(bucketText);
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
  const app = new S3Explorer(bucket, adapter);
  await app.start();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
