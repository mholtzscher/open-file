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
    const maxLines = this.config.height - (this.config.showBorder ? 3 : 1);

    for (let i = 0; i < Math.min(this.content.length, maxLines); i++) {
      const line = this.content[i];

      const contentElement = new TextRenderable(this.renderer, {
        id: `floating-window-content-${pos.x}-${pos.y}-${i}`,
        content: line,
        fg: this.config.textColor,
        position: 'absolute',
        left: contentStartX,
        top: contentStartY + i,
      });
      this.contentElements.push(contentElement);
      this.renderer.root.add(contentElement);
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
