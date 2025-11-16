#!/usr/bin/env bun

import { createCliRenderer, CliRenderer, TextRenderable } from '@opentui/core';
import { MockAdapter } from './adapters/mock-adapter.js';
import { BufferState, EditMode } from './ui/buffer-state.js';
import { BufferView } from './ui/buffer-view.js';
import { ConfirmationDialog } from './ui/confirmation-dialog.js';
import { detectChanges, buildOperationPlan } from './utils/change-detection.js';

/**
 * Main application class
 */
class S3Explorer {
  private renderer!: CliRenderer;
  private adapter: MockAdapter;
  private bufferState!: BufferState;
  private bufferView!: BufferView;
  private currentPath = 'test-bucket/';

  constructor() {
    this.adapter = new MockAdapter();
  }

  /**
   * Start the application
   */
  async start(): Promise<void> {
    // Initialize renderer
    this.renderer = await createCliRenderer({
      exitOnCtrlC: true,
    });

    // Setup event handlers
    this.setupEventHandlers();

    // Load initial buffer
    await this.loadBuffer(this.currentPath);

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
    }
  }

  /**
   * Handle keys in normal mode
   */
  private handleNormalModeKey(key: any): void {
    switch (key.name) {
      case 'q':
        process.exit(0);
        break;
      case 'j':
        this.bufferState.moveCursorDown();
        break;
      case 'k':
        this.bufferState.moveCursorUp();
        break;
      case 'g':
        // gg to go to top (simplified: just one 'g')
        this.bufferState.moveCursorToTop();
        break;
      case 'G':
        this.bufferState.moveCursorToBottom();
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
   * Navigate into a directory
   */
  private async handleNavigate(): Promise<void> {
    const selected = this.bufferState.getSelectedEntry();
    if (selected && selected.type.toString() === 'directory') {
      await this.loadBuffer(selected.path);
      this.render();
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
      await this.loadBuffer(newPath);
      this.render();
    }
  }

  /**
   * Delete selected entries
   */
  private handleDeleteSelection(): void {
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

    // Current path and mode
    const modeStr = this.bufferState.mode === EditMode.Normal ? 'NORMAL' :
                    this.bufferState.mode === EditMode.Visual ? 'VISUAL' :
                    'EDIT';
    const pathText = new TextRenderable(this.renderer, {
      id: 'path',
      content: `Path: ${this.bufferState.currentPath} [${modeStr}]`,
      fg: '#FFFF00',
      position: 'absolute',
      left: 2,
      top: 2,
    });

    // Status bar
    const statusContent = this.bufferState.isDirty ? '* Unsaved changes' : 'Press q to quit, ? for help';
    const status = new TextRenderable(this.renderer, {
      id: 'status',
      content: statusContent,
      fg: this.bufferState.isDirty ? '#FF0000' : '#888888',
      position: 'absolute',
      left: 2,
      bottom: 0,
    });

    // Create buffer view
    this.bufferView = new BufferView(this.renderer, this.bufferState, {
      left: 4,
      top: 4,
    });

    // Render components
    this.renderer.root.add(title);
    this.renderer.root.add(pathText);
    this.renderer.root.add(status);
    this.bufferView.render();
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
  const app = new S3Explorer();
  await app.start();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
