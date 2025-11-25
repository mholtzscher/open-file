/**
 * BaseDialog tests
 *
 * Note: Component rendering tests are deferred to integration tests
 * where React is properly initialized in a terminal UI context.
 * This module is tested primarily through:
 * - Type checking (TypeScript)
 * - Runtime usage in the main S3 explorer application
 * - Integration tests that render the full UI
 */

import { describe, it, expect } from 'bun:test';

describe('BaseDialog component', () => {
  it('module can be imported without errors', async () => {
    // Verify the module exports correctly
    const module = await import('./base-dialog-react.js');
    expect(module.BaseDialog).toBeDefined();
    expect(typeof module.BaseDialog).toBe('function');
  });

  it('exports the component as a named export', async () => {
    // Verify proper export structure
    const module = await import('./base-dialog-react.js');
    expect('BaseDialog' in module).toBe(true);
  });

  it('exports the getContentWidth helper', async () => {
    const module = await import('./base-dialog-react.js');
    expect(module.getContentWidth).toBeDefined();
    expect(typeof module.getContentWidth).toBe('function');
  });

  it('getContentWidth calculates correct width', async () => {
    const { getContentWidth } = await import('./base-dialog-react.js');
    // Default padding: left=2, right=2, border=2
    expect(getContentWidth(70)).toBe(64); // 70 - 2 - 2 - 2
    expect(getContentWidth(50)).toBe(44); // 50 - 2 - 2 - 2

    // Custom padding
    expect(getContentWidth(70, 1, 1)).toBe(66); // 70 - 1 - 1 - 2
    expect(getContentWidth(50, 3, 3)).toBe(42); // 50 - 3 - 3 - 2
  });
});
