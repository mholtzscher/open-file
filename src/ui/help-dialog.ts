/**
 * Help dialog component
 * 
 * Displays keybindings and help information
 */

import { CliRenderer, TextRenderable } from '@opentui/core';
import { EditMode } from './buffer-state.js';
import { KeybindingRegistry } from './keybindings.js';
import { Theme, CatppuccinMocha } from './theme.js';

/**
 * Help dialog
 */
export class HelpDialog {
  private renderer: CliRenderer;
  private registry: KeybindingRegistry;
  private renderedElements: TextRenderable[] = [];
  private isVisible = false;

  constructor(renderer: CliRenderer, registry: KeybindingRegistry) {
    this.renderer = renderer;
    this.registry = registry;
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
   * Render the help dialog
   */
  private renderDialog(): void {
    const centerX = Math.floor(this.renderer.width / 2);
    const centerY = Math.floor(this.renderer.height / 2) - 10;

     // Title
     const title = new TextRenderable(this.renderer, {
       id: 'help-title',
       content: '╔════ KEYBINDINGS HELP ════╗',
       fg: Theme.getSuccessColor(),
       position: 'absolute',
       left: centerX - 14,
       top: centerY,
     });
     this.renderedElements.push(title);
     this.renderer.root.add(title);

     let row = centerY + 1;

     // Group by mode
     const modes = [EditMode.Normal, EditMode.Visual, EditMode.Edit];
     for (const mode of modes) {
       const modeTitle = new TextRenderable(this.renderer, {
         id: `help-mode-${mode}`,
         content: `\n${mode.toUpperCase()} MODE:`,
         fg: CatppuccinMocha.yellow,
         position: 'absolute',
         left: centerX - 12,
         top: row++,
       });
       this.renderedElements.push(modeTitle);
       this.renderer.root.add(modeTitle);

       const actions = this.registry.getActionsForMode(mode);
       for (const action of actions.slice(0, 10)) {
         // Limit to 10 per mode to fit
         const binding = new TextRenderable(this.renderer, {
           id: `help-binding-${mode}-${action.key}`,
           content: `  ${action.key.padEnd(10)} - ${action.description}`,
           fg: CatppuccinMocha.subtext1,
           position: 'absolute',
           left: centerX - 12,
           top: row++,
         });
         this.renderedElements.push(binding);
         this.renderer.root.add(binding);
       }
     }

     row++;

     // Instructions
     const instructions = new TextRenderable(this.renderer, {
       id: 'help-instructions',
       content: 'Press q or ESC to close help',
       fg: CatppuccinMocha.overlay1,
       position: 'absolute',
       left: centerX - 12,
       top: row,
     });
    this.renderedElements.push(instructions);
    this.renderer.root.add(instructions);

    this.isVisible = true;
  }

  /**
   * Show the help dialog
   */
  async show(): Promise<void> {
    this.renderDialog();

    return new Promise((resolve) => {
      const handleKeyPress = (key: any) => {
        if (key.name === 'q' || key.name === 'escape') {
          this.renderer.keyInput.removeListener('keypress', handleKeyPress);
          this.clearRendered();
          this.isVisible = false;
          resolve();
        }
      };

      this.renderer.keyInput.on('keypress', handleKeyPress);
    });
  }

  /**
   * Check if help is visible
   */
  isOpen(): boolean {
    return this.isVisible;
  }

  /**
   * Toggle help visibility
   */
  async toggle(): Promise<void> {
    if (this.isVisible) {
      this.clearRendered();
      this.isVisible = false;
    } else {
      await this.show();
    }
  }
}
