/**
 * File preview pane component
 * 
 * Displays previews of files (text, images) in a side panel.
 * Supports syntax highlighting and image rendering.
 */

import { CliRenderer, TextRenderable } from '@opentui/core';
import { Entry, EntryType } from '../types/entry.js';
import { Adapter } from '../adapters/adapter.js';

/**
 * Preview pane options
 */
export interface PreviewPaneOptions {
  /** Left position */
  left?: number;
  /** Top position */
  top?: number;
  /** Width */
  width?: number;
  /** Height */
  height?: number;
  /** Maximum file size to preview (bytes) */
  maxFileSize?: number;
  /** Show syntax highlighting for code files */
  showSyntaxHighlight?: boolean;
}

/**
 * File preview pane component
 */
export class PreviewPane {
  private renderer: CliRenderer;
  private adapter: Adapter;
  private options: PreviewPaneOptions;
  private currentEntry: Entry | null = null;
  private previewContent: string = '';
  private renderedElements: TextRenderable[] = [];

  constructor(renderer: CliRenderer, adapter: Adapter, options: PreviewPaneOptions = {}) {
    this.renderer = renderer;
    this.adapter = adapter;
    this.options = {
      left: options.left ?? 60,
      top: options.top ?? 3,
      width: options.width ?? 20,
      height: options.height ?? 20,
      maxFileSize: options.maxFileSize ?? 100 * 1024, // 100KB default
      showSyntaxHighlight: options.showSyntaxHighlight ?? true,
    };
  }

  /**
   * Preview a file
   */
  async previewEntry(entry: Entry): Promise<void> {
    this.currentEntry = entry;

    // Clear previous preview
    this.clearPreview();

    // Don't preview directories
    if (entry.type === EntryType.Directory) {
      this.showMessage('[ Directory ]');
      return;
    }

    // Check file size
    if (entry.size && entry.size > this.options.maxFileSize!) {
      this.showMessage(`[ File too large: ${Math.round(entry.size / 1024)}KB ]`);
      return;
    }

    // Try to load and preview the file
    try {
      await this.loadAndPreview(entry);
    } catch (error) {
      this.showMessage(`[ Preview error ]`);
    }
  }

  /**
   * Load file and show appropriate preview
   */
  private async loadAndPreview(entry: Entry): Promise<void> {
    const ext = this.getFileExtension(entry.name).toLowerCase();

    // Text file preview
    if (this.isTextFile(ext)) {
      await this.previewTextFile(entry);
    }
    // Image preview (placeholder)
    else if (this.isImageFile(ext)) {
      this.previewImage(entry);
    }
    // Binary file
    else {
      this.showMessage(`[ ${ext.toUpperCase()} Binary ]`);
    }
  }

  /**
   * Preview text file
   */
  private async previewTextFile(entry: Entry): Promise<void> {
    try {
      // Note: S3Adapter doesn't have a method to read file content yet
      // This is a placeholder for future implementation
      this.showMessage('[ Text File Preview ]');
      this.previewContent = `Preview of ${entry.name}`;
    } catch (error) {
      this.showMessage('[ Cannot read file ]');
    }
  }

  /**
   * Preview image file (placeholder)
   */
  private previewImage(entry: Entry): void {
    const ext = this.getFileExtension(entry.name).toUpperCase();
    this.showMessage(`[ ${ext} Image ]\n[ ${entry.name} ]`);
  }

  /**
   * Show a message in the preview pane
   */
  private showMessage(message: string): void {
    this.previewContent = message;
    this.render();
  }

  /**
   * Clear preview content
   */
  private clearPreview(): void {
    for (const element of this.renderedElements) {
      this.renderer.root.remove(element.id);
    }
    this.renderedElements = [];
    this.previewContent = '';
  }

  /**
   * Render the preview pane
   */
  render(): void {
    this.clearPreview();

    // Draw border
    const borderTop = new TextRenderable(this.renderer, {
      id: 'preview-border-top',
      content: '┌' + '─'.repeat(this.options.width! - 2) + '┐',
      fg: '#666666',
      position: 'absolute',
      left: this.options.left,
      top: this.options.top,
    });
    this.renderedElements.push(borderTop);
    this.renderer.root.add(borderTop);

    // Show title
    const title = new TextRenderable(this.renderer, {
      id: 'preview-title',
      content: `│ ${(this.currentEntry?.name || 'Preview').padEnd(this.options.width! - 4)} │`,
      fg: '#CCCCCC',
      position: 'absolute',
      left: this.options.left,
      top: this.options.top! + 1,
    });
    this.renderedElements.push(title);
    this.renderer.root.add(title);

    // Show content
    const lines = this.previewContent.split('\n');
    for (let i = 0; i < Math.min(lines.length, this.options.height! - 3); i++) {
      const line = lines[i].substring(0, this.options.width! - 4);
      const content = new TextRenderable(this.renderer, {
        id: `preview-line-${i}`,
        content: `│ ${line.padEnd(this.options.width! - 4)} │`,
        fg: '#AAAAAA',
        position: 'absolute',
        left: this.options.left,
        top: this.options.top! + 2 + i,
      });
      this.renderedElements.push(content);
      this.renderer.root.add(content);
    }

    // Draw border bottom
    const borderBottom = new TextRenderable(this.renderer, {
      id: 'preview-border-bottom',
      content: '└' + '─'.repeat(this.options.width! - 2) + '┘',
      fg: '#666666',
      position: 'absolute',
      left: this.options.left,
      top: this.options.top! + Math.min(lines.length + 2, this.options.height! - 1),
    });
    this.renderedElements.push(borderBottom);
    this.renderer.root.add(borderBottom);
  }

  /**
   * Get file extension
   */
  private getFileExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1] : '';
  }

  /**
   * Check if file is a text file
   */
  private isTextFile(ext: string): boolean {
    const textExtensions = [
      'txt', 'md', 'json', 'js', 'ts', 'tsx', 'jsx',
      'html', 'css', 'scss', 'sql', 'yaml', 'yml',
      'xml', 'csv', 'log', 'sh', 'bash', 'py', 'java',
      'c', 'cpp', 'h', 'go', 'rs', 'toml', 'ini',
    ];
    return textExtensions.includes(ext);
  }

  /**
   * Check if file is an image file
   */
  private isImageFile(ext: string): boolean {
    const imageExtensions = [
      'jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp',
    ];
    return imageExtensions.includes(ext);
  }

  /**
   * Get current preview entry
   */
  getCurrentEntry(): Entry | null {
    return this.currentEntry;
  }

  /**
   * Get preview content
   */
  getPreviewContent(): string {
    return this.previewContent;
  }

  /**
   * Set preview content (for testing)
   */
  setPreviewContent(content: string): void {
    this.previewContent = content;
  }

  /**
   * Check if entry is previewable
   */
  isPreviewable(entry: Entry): boolean {
    if (entry.type === EntryType.Directory) {
      return false;
    }
    if (entry.size && entry.size > this.options.maxFileSize!) {
      return false;
    }
    const ext = this.getFileExtension(entry.name).toLowerCase();
    return this.isTextFile(ext) || this.isImageFile(ext);
  }
}
