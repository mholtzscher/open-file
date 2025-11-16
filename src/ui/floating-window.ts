/**
 * Floating window / modal component
 *
 * Reusable floating window for dialogs, menus, and other overlays
 */

import { CliRenderer, TextRenderable } from '@opentui/core';
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
  private renderedElements: TextRenderable[] = [];
  private isVisible = false;
  private content: string[] = [];

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
   * Calculate visible length of text, excluding ANSI color codes
   */
  private getVisibleLength(text: string): number {
    // Remove ANSI escape sequences and count remaining characters
    return text.replace(/\x1b\[[0-9;]*m/g, '').length;
  }

  /**
   * Get border characters for the style
   */
  private getBorderChars() {
    switch (this.config.borderStyle) {
      case 'double':
        return {
          topLeft: '╔',
          topRight: '╗',
          bottomLeft: '╚',
          bottomRight: '╝',
          horizontal: '═',
          vertical: '║',
        };
      case 'rounded':
        return {
          topLeft: '╭',
          topRight: '╮',
          bottomLeft: '╰',
          bottomRight: '╯',
          horizontal: '─',
          vertical: '│',
        };
      case 'single':
      default:
        return {
          topLeft: '┌',
          topRight: '┐',
          bottomLeft: '└',
          bottomRight: '┘',
          horizontal: '─',
          vertical: '│',
        };
    }
  }

  /**
   * Clear rendered elements
   */
  private clearRendered(): void {
    for (const element of this.renderedElements) {
      this.renderer.root.remove(element.id);
    }
    this.renderedElements = [];
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
    this.clearRendered();

    if (!this.isVisible) {
      return;
    }

    const pos = this.getPosition();
    const chars = this.getBorderChars();

    // Render top border with title
    if (this.config.showBorder) {
      let topBorder = chars.topLeft;
      if (this.config.title) {
        const padding = this.config.width - this.config.title.length - 4;
        topBorder += ` ${this.config.title} `;
        topBorder += chars.horizontal.repeat(Math.max(0, padding - 1));
      } else {
        topBorder += chars.horizontal.repeat(this.config.width - 2);
      }
      topBorder += chars.topRight;

      const topElement = new TextRenderable(this.renderer, {
        id: `floating-window-top-${pos.x}-${pos.y}`,
        content: topBorder,
        fg: this.config.borderColor,
        position: 'absolute',
        left: pos.x,
        top: pos.y,
      });
      this.renderedElements.push(topElement);
      this.renderer.root.add(topElement);
    }

    // Render content lines
    let currentLine = pos.y + (this.config.showBorder ? 1 : 0);
    const maxLines = this.config.height - (this.config.showBorder ? 2 : 0);

    for (let i = 0; i < Math.min(this.content.length, maxLines); i++) {
      let contentLine = this.content[i];

      // Calculate visible length (excluding ANSI codes)
      const visibleLength = this.getVisibleLength(contentLine);

      // Truncate or pad content based on visible length
      if (visibleLength > this.config.width - (this.config.showBorder ? 4 : 2)) {
        // Need to truncate, accounting for ANSI codes
        let truncated = '';
        let visibleCount = 0;
        for (const char of contentLine) {
          if (truncated.match(/\x1b\[[0-9;]*m$/)) {
            // This is part of an ANSI code, always include it
            truncated += char;
          } else if (visibleCount < this.config.width - (this.config.showBorder ? 5 : 3)) {
            truncated += char;
            visibleCount++;
          } else {
            break;
          }
        }
        contentLine = truncated + '…';
      }

      // Add border and padding based on visible length
      if (this.config.showBorder) {
        const visibleLen = this.getVisibleLength(contentLine);
        const padding = this.config.width - visibleLen - 4;
        contentLine = `│ ${contentLine}${' '.repeat(Math.max(0, padding))} │`;
      } else {
        const visibleLen = this.getVisibleLength(contentLine);
        const padding = this.config.width - visibleLen - 2;
        contentLine = ` ${contentLine}${' '.repeat(Math.max(0, padding))} `;
      }

      const contentElement = new TextRenderable(this.renderer, {
        id: `floating-window-content-${pos.x}-${pos.y}-${i}`,
        content: contentLine,
        fg: this.config.textColor,
        position: 'absolute',
        left: pos.x,
        top: currentLine++,
      });
      this.renderedElements.push(contentElement);
      this.renderer.root.add(contentElement);
    }

    // Fill remaining lines with empty content
    for (let i = this.content.length; i < maxLines; i++) {
      let emptyLine = '';
      if (this.config.showBorder) {
        emptyLine = `│${' '.repeat(this.config.width - 2)}│`;
      } else {
        emptyLine = ' '.repeat(this.config.width);
      }

      const emptyElement = new TextRenderable(this.renderer, {
        id: `floating-window-empty-${pos.x}-${pos.y}-${i}`,
        content: emptyLine,
        fg: this.config.textColor,
        position: 'absolute',
        left: pos.x,
        top: currentLine++,
      });
      this.renderedElements.push(emptyElement);
      this.renderer.root.add(emptyElement);
    }

    // Render bottom border
    if (this.config.showBorder) {
      let bottomBorder = chars.bottomLeft;
      bottomBorder += chars.horizontal.repeat(this.config.width - 2);
      bottomBorder += chars.bottomRight;

      const bottomElement = new TextRenderable(this.renderer, {
        id: `floating-window-bottom-${pos.x}-${pos.y}`,
        content: bottomBorder,
        fg: this.config.borderColor,
        position: 'absolute',
        left: pos.x,
        top: currentLine,
      });
      this.renderedElements.push(bottomElement);
      this.renderer.root.add(bottomElement);
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
    this.clearRendered();
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
