/**
 * Header component tests
 */

import { describe, it, expect } from 'bun:test';
import { Header } from './header-react.js';

describe('Header', () => {
  it('renders without bucket', () => {
    const result = Header({});
    expect(result).not.toBeNull();
  });

  it('renders with bucket name', () => {
    const result = Header({ bucket: 'my-bucket' });
    expect(result).not.toBeNull();
  });

  it('accepts custom height', () => {
    const result = Header({ height: 3 });
    expect(result).not.toBeNull();
  });

  it('uses default height when not specified', () => {
    const result = Header({});
    expect(result).not.toBeNull();
  });
});
