#!/usr/bin/env node

import { createCliRenderer, CliRenderer, TextRenderable } from '@opentui/core';
import { MockAdapter } from './adapters/mock-adapter.js';

/**
 * Main application class
 */
class S3Explorer {
  private renderer!: CliRenderer;
  private adapter: MockAdapter;
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
    
    // Render initial UI
    await this.render();
  }

  /**
   * Setup keyboard event handlers
   */
  private setupEventHandlers(): void {
    this.renderer.keyInput.on('keypress', (key) => {
      // q to quit
      if (key.name === 'q') {
        process.exit(0);
      }
    });
  }

  /**
   * Render the UI
   */
  private async render(): Promise<void> {
    // Title
    const title = new TextRenderable(this.renderer, {
      id: 'title',
      content: '📦 open-s3 - S3 TUI Explorer',
      fg: '#00FF00',
      position: 'absolute',
      left: 2,
      top: 1,
    });

    // Current path
    const pathText = new TextRenderable(this.renderer, {
      id: 'path',
      content: `Path: ${this.currentPath}`,
      fg: '#FFFF00',
      position: 'absolute',
      left: 2,
      top: 2,
    });

    // Status
    const status = new TextRenderable(this.renderer, {
      id: 'status',
      content: 'Press q to quit',
      fg: '#888888',
      position: 'absolute',
      left: 2,
      bottom: 0,
    });

    // List entries
    const entries = await this.adapter.list(this.currentPath);
    let row = 4;
    
    for (const entry of entries.entries) {
      const icon = entry.type === 'directory' ? '📁' : '📄';
      const size = entry.size !== undefined ? `(${entry.size} bytes)` : '';
      const text = new TextRenderable(this.renderer, {
        id: `entry-${entry.id}`,
        content: `${icon} ${entry.name} ${size}`,
        position: 'absolute',
        left: 4,
        top: row++,
      });
      this.renderer.root.add(text);
    }

    this.renderer.root.add(title);
    this.renderer.root.add(pathText);
    this.renderer.root.add(status);
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
