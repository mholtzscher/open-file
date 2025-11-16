/**
 * Confirmation dialog for operations
 * 
 * Shows a confirmation dialog before executing operations
 */

import { CliRenderer, TextRenderable } from '@opentui/core';
import { OperationPlan } from '../types/operations.js';
import { Theme, CatppuccinMocha } from './theme.js';

/**
 * Confirmation dialog result
 */
export interface ConfirmationResult {
  confirmed: boolean;
}

/**
 * Confirmation dialog component
 */
export class ConfirmationDialog {
  private renderer: CliRenderer;
  private plan: OperationPlan;
  private confirmed = false;
  private renderedElements: TextRenderable[] = [];

  constructor(renderer: CliRenderer, plan: OperationPlan) {
    this.renderer = renderer;
    this.plan = plan;
  }

  /**
   * Render the confirmation dialog
   */
  render(): void {
    this.clearRendered();

    const centerX = Math.floor(this.renderer.width / 2);
    const centerY = Math.floor(this.renderer.height / 2);

     // Dialog box background (using borders)
     const title = new TextRenderable(this.renderer, {
       id: 'dialog-title',
       content: '╔ Confirm Operations ╗',
       fg: Theme.getSuccessColor(),
       position: 'absolute',
       left: centerX - 15,
       top: centerY - 5,
     });
     this.renderedElements.push(title);
     this.renderer.root.add(title);

     // Summary line
     const summary = new TextRenderable(this.renderer, {
       id: 'dialog-summary',
       content: `Operations to execute: ${this.plan.summary.total}`,
       fg: CatppuccinMocha.text,
       position: 'absolute',
       left: centerX - 15,
       top: centerY - 3,
     });
     this.renderedElements.push(summary);
     this.renderer.root.add(summary);

     // Operation details
     let row = centerY - 1;
     if (this.plan.summary.creates > 0) {
       const creates = new TextRenderable(this.renderer, {
         id: 'dialog-creates',
         content: `  + Creates: ${this.plan.summary.creates}`,
         fg: Theme.getSuccessColor(),
         position: 'absolute',
         left: centerX - 15,
         top: row++,
       });
       this.renderedElements.push(creates);
       this.renderer.root.add(creates);
     }

     if (this.plan.summary.moves > 0) {
       const moves = new TextRenderable(this.renderer, {
         id: 'dialog-moves',
         content: `  → Moves: ${this.plan.summary.moves}`,
         fg: CatppuccinMocha.yellow,
         position: 'absolute',
         left: centerX - 15,
         top: row++,
       });
       this.renderedElements.push(moves);
       this.renderer.root.add(moves);
     }

     if (this.plan.summary.deletes > 0) {
       const deletes = new TextRenderable(this.renderer, {
         id: 'dialog-deletes',
         content: `  - Deletes: ${this.plan.summary.deletes}`,
         fg: Theme.getErrorColor(),
         position: 'absolute',
         left: centerX - 15,
         top: row++,
       });
       this.renderedElements.push(deletes);
       this.renderer.root.add(deletes);
     }

     // Instructions
     row++;
     const instructions = new TextRenderable(this.renderer, {
       id: 'dialog-instructions',
       content: 'Press y to confirm, n to cancel',
       fg: CatppuccinMocha.overlay1,
       position: 'absolute',
       left: centerX - 15,
       top: row,
     });
    this.renderedElements.push(instructions);
    this.renderer.root.add(instructions);
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
   * Show the dialog and wait for confirmation
   */
  async show(): Promise<ConfirmationResult> {
    this.render();

    return new Promise((resolve) => {
      const handleKeyPress = (key: any) => {
        if (key.name === 'y') {
          this.confirmed = true;
          this.renderer.keyInput.removeListener('keypress', handleKeyPress);
          this.clearRendered();
          resolve({ confirmed: true });
        } else if (key.name === 'n') {
          this.confirmed = false;
          this.renderer.keyInput.removeListener('keypress', handleKeyPress);
          this.clearRendered();
          resolve({ confirmed: false });
        }
      };

      this.renderer.keyInput.on('keypress', handleKeyPress);
    });
  }

  /**
   * Get the operation plan
   */
  getPlan(): OperationPlan {
    return this.plan;
  }
}
