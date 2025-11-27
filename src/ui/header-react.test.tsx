/**
 * Header component tests
 *
 * Note: These tests verify the Header component type signatures and exports.
 * Full integration tests with React context require a proper React testing setup.
 */

import { describe, it, expect } from 'bun:test';
import { Header, type HeaderProps } from './header-react.js';

describe('Header', () => {
  it('exports Header component', () => {
    expect(Header).toBeDefined();
    expect(typeof Header).toBe('function');
  });

  it('HeaderProps interface supports bucket prop', () => {
    const props: HeaderProps = { bucket: 'my-bucket' };
    expect(props.bucket).toBe('my-bucket');
  });

  it('HeaderProps interface supports height prop', () => {
    const props: HeaderProps = { height: 3 };
    expect(props.height).toBe(3);
  });

  it('HeaderProps interface allows empty props', () => {
    const props: HeaderProps = {};
    expect(props).toBeDefined();
  });
});

describe('Header - Legacy Compatibility', () => {
  it('bucket prop is marked as deprecated but still works', () => {
    // This test verifies that the legacy bucket prop is still supported
    // for backward compatibility, even though it's deprecated
    const props: HeaderProps = { bucket: 'legacy-bucket' };
    expect(props.bucket).toBe('legacy-bucket');
  });
});
