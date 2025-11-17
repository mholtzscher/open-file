/**
 * ErrorDialog tests
 *
 * Note: Component rendering tests are deferred to integration tests
 * where React is properly initialized in a terminal UI context.
 * This module is tested primarily through:
 * - Type checking (TypeScript)
 * - Runtime usage in the main S3 explorer application
 * - Integration tests that render the full UI
 */

import { describe, it, expect } from 'bun:test';

describe('ErrorDialog component', () => {
  it('module can be imported without errors', async () => {
    // Verify the module exports correctly
    const module = await import('./error-dialog-react.js');
    expect(module.ErrorDialog).toBeDefined();
    expect(typeof module.ErrorDialog).toBe('function');
  });

  it('exports the component as a named export', async () => {
    // Verify proper export structure
    const module = await import('./error-dialog-react.js');
    expect('ErrorDialog' in module).toBe(true);
  });
});
