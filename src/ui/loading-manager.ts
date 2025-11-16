/**
 * Loading state manager
 * 
 * Manages loading states for async operations with spinner support
 */

import { CliRenderer, TextRenderable } from '@opentui/core';

/**
 * Loading state types
 */
export enum LoadingState {
  Idle = 'idle',
  Loading = 'loading',
  Success = 'success',
  Error = 'error',
}

/**
 * Loading operation info
 */
export interface LoadingOperation {
  id: string;
  name: string;
  state: LoadingState;
  message?: string;
  progress?: number;
  retryable?: boolean;
  onRetry?: () => void;
}

/**
 * Loading state manager
 */
export class LoadingManager {
  private renderer: CliRenderer;
  private operations: Map<string, LoadingOperation> = new Map();
  private spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private currentFrame = 0;
  private spinnerInterval?: ReturnType<typeof setInterval>;
  private renderedElements: TextRenderable[] = [];

  constructor(renderer: CliRenderer) {
    this.renderer = renderer;
  }

  /**
   * Start a loading operation
   */
  startLoading(id: string, name: string, retryable?: boolean, onRetry?: () => void): void {
    const operation: LoadingOperation = {
      id,
      name,
      state: LoadingState.Loading,
      retryable,
      onRetry,
    };

    this.operations.set(id, operation);
    this.startSpinner();
    this.render();
  }

  /**
   * Update loading operation message
   */
  updateMessage(id: string, message: string): void {
    const operation = this.operations.get(id);
    if (operation) {
      operation.message = message;
      this.render();
    }
  }

  /**
   * Update loading operation progress
   */
  updateProgress(id: string, progress: number): void {
    const operation = this.operations.get(id);
    if (operation) {
      operation.progress = progress;
      this.render();
    }
  }

  /**
   * Complete a loading operation successfully
   */
  completeSuccess(id: string, message?: string): void {
    const operation = this.operations.get(id);
    if (operation) {
      operation.state = LoadingState.Success;
      operation.message = message || `${operation.name} completed`;
      
      // Auto-remove success messages after 2 seconds
      setTimeout(() => {
        this.removeOperation(id);
      }, 2000);
      
      this.render();
    }
  }

  /**
   * Complete a loading operation with error
   */
  completeError(id: string, error: string | Error, retryable?: boolean): void {
    const operation = this.operations.get(id);
    if (operation) {
      operation.state = LoadingState.Error;
      operation.message = typeof error === 'string' ? error : error.message;
      operation.retryable = retryable ?? operation.retryable;
      
      this.render();
    }
  }

  /**
   * Remove an operation
   */
  removeOperation(id: string): void {
    this.operations.delete(id);
    
    if (this.operations.size === 0) {
      this.stopSpinner();
    }
    
    this.render();
  }

  /**
   * Get current loading state
   */
  getState(): LoadingState {
    if (this.operations.size === 0) {
      return LoadingState.Idle;
    }

    const states = Array.from(this.operations.values()).map(op => op.state);
    
    if (states.some(s => s === LoadingState.Error)) {
      return LoadingState.Error;
    }
    if (states.some(s => s === LoadingState.Loading)) {
      return LoadingState.Loading;
    }
    if (states.some(s => s === LoadingState.Success)) {
      return LoadingState.Success;
    }
    
    return LoadingState.Idle;
  }

  /**
   * Get active operations
   */
  getActiveOperations(): LoadingOperation[] {
    return Array.from(this.operations.values()).filter(
      op => op.state === LoadingState.Loading || op.state === LoadingState.Error
    );
  }

  /**
   * Retry an operation
   */
  retry(id: string): void {
    const operation = this.operations.get(id);
    if (operation?.retryable && operation.onRetry) {
      operation.state = LoadingState.Loading;
      operation.message = undefined;
      operation.progress = undefined;
      operation.onRetry();
      this.render();
    }
  }

  /**
   * Start spinner animation
   */
  private startSpinner(): void {
    if (this.spinnerInterval) return;

    this.spinnerInterval = setInterval(() => {
      this.currentFrame = (this.currentFrame + 1) % this.spinnerFrames.length;
      this.render();
    }, 100);
  }

  /**
   * Stop spinner animation
   */
  private stopSpinner(): void {
    if (this.spinnerInterval) {
      clearInterval(this.spinnerInterval);
      this.spinnerInterval = undefined;
      this.currentFrame = 0;
    }
  }

  /**
   * Get spinner character
   */
  private getSpinner(): string {
    return this.spinnerFrames[this.currentFrame];
  }

  /**
   * Get status icon for operation
   */
  private getStatusIcon(operation: LoadingOperation): string {
    switch (operation.state) {
      case LoadingState.Loading:
        return this.getSpinner();
      case LoadingState.Success:
        return '✓';
      case LoadingState.Error:
        return operation.retryable ? '⚠' : '❌';
      default:
        return ' ';
    }
  }

  /**
   * Format operation message
   */
  private formatOperation(operation: LoadingOperation): string {
    const icon = this.getStatusIcon(operation);
    let message = operation.message || operation.name;

    if (operation.progress !== undefined) {
      const percentage = Math.round(operation.progress * 100);
      message += ` (${percentage}%)`;
    }

    if (operation.state === LoadingState.Error && operation.retryable) {
      message += ' [R to retry]';
    }

    return `${icon} ${message}`;
  }

  /**
   * Render loading states
   */
  render(): void {
    // Clear previous rendered elements
    for (const element of this.renderedElements) {
      this.renderer.root.remove(element.id);
    }
    this.renderedElements = [];

    const activeOperations = this.getActiveOperations();
    
    if (activeOperations.length === 0) {
      return;
    }

    // Render each operation
    let row = 1; // Start from top
    for (const operation of activeOperations) {
      const content = this.formatOperation(operation);
      const color = this.getOperationColor(operation);
      
      const element = new TextRenderable(this.renderer, {
        id: `loading-${operation.id}`,
        content,
        fg: color,
        position: 'absolute',
        left: 2,
        top: row++,
      });

      this.renderedElements.push(element);
      this.renderer.root.add(element);
    }
  }

  /**
   * Get color for operation
   */
  private getOperationColor(operation: LoadingOperation): string {
    switch (operation.state) {
      case LoadingState.Loading:
        return '#FFFF00'; // Yellow
      case LoadingState.Success:
        return '#00FF00'; // Green
      case LoadingState.Error:
        return operation.retryable ? '#FFAA00' : '#FF0000'; // Orange for retryable, red for permanent
      default:
        return '#FFFFFF'; // White
    }
  }

  /**
   * Handle key press for retry functionality
   */
  handleKeyPress(key: string): boolean {
    if (key.toLowerCase() === 'r') {
      // Find first retryable error operation
      const retryableOp = Array.from(this.operations.values()).find(
        op => op.state === LoadingState.Error && op.retryable
      );
      
      if (retryableOp) {
        this.retry(retryableOp.id);
        return true;
      }
    }
    
    return false;
  }
}