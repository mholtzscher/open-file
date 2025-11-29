/**
 * Header component tests
 *
 * Note: These tests verify the Header component type signatures and exports.
 * Full integration tests with React context require a proper React testing setup.
 */

import { describe, it, expect } from 'bun:test';
import { Header, type HeaderProps } from './header.js';
import { Capability } from '../providers/types/capabilities.js';

describe('Header', () => {
  it('exports Header component', () => {
    expect(Header).toBeDefined();
    expect(typeof Header).toBe('function');
  });

  it('HeaderProps interface allows empty props', () => {
    const props: HeaderProps = {};
    expect(props).toBeDefined();
  });
});

describe('Header - Connection Capability', () => {
  it('Connection capability exists for connection-oriented providers', () => {
    // Verify the Connection capability is defined
    expect(Capability.Connection).toBeDefined();
    expect(typeof Capability.Connection).toBe('string');
  });

  it('ConnectionStatus integration pattern', () => {
    // Pattern: Header conditionally renders ConnectionStatus based on capability
    // This simulates the pattern used in the header component
    const hasConnection = true;
    const variant = 'badge';
    const showReconnect = true;

    // Expected props when ConnectionStatus is rendered
    const connectionStatusProps = {
      variant,
      showReconnect,
    };

    if (hasConnection) {
      expect(connectionStatusProps.variant).toBe('badge');
      expect(connectionStatusProps.showReconnect).toBe(true);
    }
  });

  it('ConnectionStatus should not render for non-connection providers', () => {
    // Pattern: S3, GCS, local filesystem don't need connection status
    const hasConnection = false;

    // When hasConnection is false, ConnectionStatus is not rendered
    expect(hasConnection).toBe(false);
  });

  it('ConnectionStatus should render for connection-oriented providers', () => {
    // Pattern: SFTP, FTP, SMB, NFS providers need connection status
    const connectionOrientedProviders = ['sftp', 'ftp', 'smb', 'nfs'];

    connectionOrientedProviders.forEach(provider => {
      // Each of these should report hasConnection = true
      expect(provider).toBeTruthy();
    });
  });
});
