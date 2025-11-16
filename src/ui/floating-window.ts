/**
 * Floating window / modal component
 *
 * Reusable floating window for dialogs, menus, and other overlays
 */

import { CliRenderer, BoxRenderable, TextRenderable } from '@opentui/core';
import { Theme, CatppuccinMocha } from './theme.js';

/**
 * Floating window configuration
 */
export interface FloatingWindowConfig {
  /** Window width */
  width?: number;
  /** Window height */
  height?: number;
  /** Horizontal position: 'center', 'left', 'right', or pixel offset */
  horizontalAlign?: 'center' | 'left' | 'right';
  /** Vertical position: 'center', 'top', 'bottom', or pixel offset */
  verticalAlign?: 'center' | 'top' | 'bottom';
  /** Window title */
  title?: string;
  /** Show borders */
  showBorder?: boolean;
  /** Border style */
  borderStyle?: 'single' | 'double' | 'rounded';
  /** Window z-index / depth */
  zIndex?: number;
  /** Background color */
  backgroundColor?: string;
  /** Text color */
  textColor?: string;
  /** Border color */
  borderColor?: string;
}

/**
 * Floating window component
 */
export class FloatingWindow {
  private renderer: CliRenderer;
  private config: Required<FloatingWindowConfig>;
  private box?: BoxRenderable;
  private contentElements: TextRenderable[] = [];
  private isVisible = false;
  private content: string[] = [];

  /**
   * Calculate visible length of text, excluding ANSI color codes
   */
  private getVisibleLength(text: string): number {
    // Remove ANSI escape sequences and count remaining characters
    return text.replace(/\x1b\[[0-9;]*m/g, '').length;
  }

  constructor(renderer: CliRenderer, config: FloatingWindowConfig = {}) {
    this.renderer = renderer;
    this.config = {
      width: config.width ?? 60,
      height: config.height ?? 20,
      horizontalAlign: config.horizontalAlign ?? 'center',
      verticalAlign: config.verticalAlign ?? 'center',
      title: config.title ?? '',
      showBorder: config.showBorder ?? true,
      borderStyle: config.borderStyle ?? 'single',
      zIndex: config.zIndex ?? 10,
      backgroundColor: config.backgroundColor ?? CatppuccinMocha.base,
      textColor: config.textColor ?? CatppuccinMocha.text,
      borderColor: config.borderColor ?? Theme.getSuccessColor(),
    };
  }

  /**
   * Get the position for the window
   */
  private getPosition(): { x: number; y: number } {
    let x = 0;
    let y = 0;

    if (this.config.horizontalAlign === 'center') {
      x = Math.floor((this.renderer.width - this.config.width) / 2);
    } else if (this.config.horizontalAlign === 'left') {
      x = 2;
    } else if (this.config.horizontalAlign === 'right') {
      x = this.renderer.width - this.config.width - 2;
    } else {
      x = parseInt(this.config.horizontalAlign as any) || 0;
    }

    if (this.config.verticalAlign === 'center') {
      y = Math.floor((this.renderer.height - this.config.height) / 2);
    } else if (this.config.verticalAlign === 'top') {
      y = 2;
    } else if (this.config.verticalAlign === 'bottom') {
      y = this.renderer.height - this.config.height - 2;
    } else {
      y = parseInt(this.config.verticalAlign as any) || 0;
    }

    return { x, y };
  }

  /**
   * Clear rendered content elements
   */
  private clearContent(): void {
    for (const element of this.contentElements) {
      this.renderer.root.remove(element.id);
    }
    this.contentElements = [];
  }

  /**
   * Set window content (lines of text)
   */
  setContent(content: string[]): void {
    this.content = content;
  }

  /**
   * Add a line of content
   */
  addContentLine(line: string): void {
    this.content.push(line);
  }

  /**
   * Render the floating window
   */
  render(): void {
    this.clearContent();

    if (!this.isVisible) {
      if (this.box) {
        this.renderer.root.remove(this.box.id);
        this.box = undefined;
      }
      return;
    }

    const pos = this.getPosition();

    // Create box with border
    if (!this.box) {
      this.box = new BoxRenderable(this.renderer, {
        id: `floating-window-box-${pos.x}-${pos.y}`,
        position: 'absolute',
        left: pos.x,
        top: pos.y,
        width: this.config.width,
        height: this.config.height,
        border: this.config.showBorder,
        borderStyle: this.config.borderStyle as any,
        borderColor: this.config.borderColor,
        backgroundColor: this.config.backgroundColor,
        title: this.config.title || undefined,
        titleAlignment: 'left',
      });
      this.renderer.root.add(this.box);
    }

    // Render content lines inside the box
    const contentStartX = pos.x + (this.config.showBorder ? 2 : 1);
    const contentStartY = pos.y + (this.config.showBorder ? 1 : 0);
    const contentWidth = this.config.width - (this.config.showBorder ? 4 : 2);
    const maxLines = this.config.height - (this.config.showBorder ? 3 : 1);

    let lineIndex = 0;
    for (let i = 0; i < this.content.length && lineIndex < maxLines; i++) {
      let line = this.content[i];
      
      // Handle long lines by truncating with ellipsis (using visible length, not byte length)
      const visibleLen = this.getVisibleLength(line);
      if (visibleLen > contentWidth) {
        // Truncate while accounting for ANSI codes
        let truncated = '';
        let visibleCount = 0;
        for (const char of line) {
          // Check if we're in an ANSI sequence
          if (truncated.endsWith('\x1b') || (truncated.match(/\x1b\[[0-9;]*$/) !== null)) {
            // Continue adding ANSI codes
            truncated += char;
          } else if (visibleCount < contentWidth - 1) {
            truncated += char;
            visibleCount++;
          } else {
            break;
          }
        }
        line = truncated + '…';
      }

      const contentElement = new TextRenderable(this.renderer, {
        id: `floating-window-content-${pos.x}-${pos.y}-${lineIndex}`,
        content: line,
        fg: this.config.textColor,
        position: 'absolute',
        left: contentStartX,
        top: contentStartY + lineIndex,
      });
      this.contentElements.push(contentElement);
      this.renderer.root.add(contentElement);
      lineIndex++;
    }
  }

  /**
   * Show the window
   */
  show(): void {
    this.isVisible = true;
    this.render();
  }

  /**
   * Hide the window
   */
  hide(): void {
    this.isVisible = false;
    this.clearContent();
    if (this.box) {
      this.renderer.root.remove(this.box.id);
      this.box = undefined;
    }
  }

  /**
   * Check if window is visible
   */
  getIsVisible(): boolean {
    return this.isVisible;
  }

  /**
   * Update window configuration
   */
  updateConfig(config: Partial<FloatingWindowConfig>): void {
    this.config = { ...this.config, ...config } as Required<FloatingWindowConfig>;
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<Required<FloatingWindowConfig>> {
    return this.config;
  }
}
