/**
 * Tests for ConnectionStatus component
 *
 * Uses OpenTUI testing patterns to properly test rendered output.
 */

import { describe, it, expect } from 'bun:test';
import { testRender } from '@opentui/react/test-utils';
import { ConnectionStatus, type ConnectionStatusProps } from './ConnectionStatus.js';
import { StorageContext, StorageContextValue, StorageState } from '../contexts/StorageContext.js';
import { Capability } from '../providers/types/capabilities.js';
import { EntryType } from '../types/entry.js';

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Create a mock StorageContextValue with configurable state
 */
function createMockStorageContext(overrides: Partial<StorageState> = {}): StorageContextValue {
  const defaultState: StorageState = {
    providerId: 'test',
    providerDisplayName: 'Test Provider',
    currentPath: '/',
    entries: [],
    isLoading: false,
    isConnected: true,
    ...overrides,
  };

  return {
    state: defaultState,
    navigate: async () => {},
    navigateUp: async () => {},
    refresh: async () => {},
    list: async () => [],
    read: async () => Buffer.from(''),
    exists: async () => true,
    getMetadata: async () => ({
      id: 'test',
      name: 'test',
      type: EntryType.File,
      path: '/test',
      modified: new Date(),
    }),
    write: async () => {},
    mkdir: async () => {},
    delete: async () => {},
    move: async () => {},
    copy: async () => {},
    download: async () => {},
    upload: async () => {},
    listContainers: async () => [],
    setContainer: async () => {},
    getContainer: () => undefined,
    hasCapability: () => false,
    getCapabilities: () => new Set<Capability>(),
    switchProvider: async () => {},
    disconnect: async () => {},
    connect: async () => {},
    subscribe: () => () => {},
    getProfileManager: () => undefined,
    switchProfile: async () => {},
  };
}

/**
 * Wrapper component that provides StorageContext for testing
 */
function TestWrapper({
  children,
  storageState,
}: {
  children: React.ReactNode;
  storageState?: Partial<StorageState>;
}) {
  const mockContext = createMockStorageContext(storageState);
  return <StorageContext.Provider value={mockContext}>{children}</StorageContext.Provider>;
}

/**
 * Helper to render ConnectionStatus with mocked storage context
 */
async function renderConnectionStatus(
  props: ConnectionStatusProps = {},
  storageState: Partial<StorageState> = {}
) {
  const result = await testRender(
    <TestWrapper storageState={storageState}>
      <ConnectionStatus {...props} />
    </TestWrapper>,
    { width: 80, height: 24 }
  );
  // Must call renderOnce to populate the buffer before capturing frame
  await result.renderOnce();
  return result;
}

// ============================================================================
// Component Rendering Tests
// ============================================================================

describe('ConnectionStatus', () => {
  describe('connected state', () => {
    it('renders connected indicator with green dot', async () => {
      const { captureCharFrame } = await renderConnectionStatus({}, { isConnected: true });

      const frame = captureCharFrame();
      expect(frame).toContain('●');
      expect(frame).toContain('Connected');
    });

    it('does not show reconnect button when connected', async () => {
      const { captureCharFrame } = await renderConnectionStatus(
        { showReconnect: true },
        { isConnected: true }
      );

      const frame = captureCharFrame();
      expect(frame).not.toContain('[R]econnect');
    });

    it('uses custom connected label', async () => {
      const { captureCharFrame } = await renderConnectionStatus(
        { connectedLabel: 'Online' },
        { isConnected: true }
      );

      const frame = captureCharFrame();
      expect(frame).toContain('Online');
      expect(frame).not.toContain('Connected');
    });
  });

  describe('disconnected state', () => {
    it('renders disconnected indicator with empty dot', async () => {
      const { captureCharFrame } = await renderConnectionStatus({}, { isConnected: false });

      const frame = captureCharFrame();
      expect(frame).toContain('○');
      expect(frame).toContain('Disconnected');
    });

    it('shows reconnect button when disconnected and showReconnect is true', async () => {
      const { captureCharFrame } = await renderConnectionStatus(
        { showReconnect: true },
        { isConnected: false }
      );

      const frame = captureCharFrame();
      expect(frame).toContain('[R]econnect');
    });

    it('hides reconnect button when showReconnect is false', async () => {
      const { captureCharFrame } = await renderConnectionStatus(
        { showReconnect: false },
        { isConnected: false }
      );

      const frame = captureCharFrame();
      expect(frame).not.toContain('[R]econnect');
    });

    it('uses custom disconnected label', async () => {
      const { captureCharFrame } = await renderConnectionStatus(
        { disconnectedLabel: 'Offline' },
        { isConnected: false }
      );

      const frame = captureCharFrame();
      expect(frame).toContain('Offline');
      expect(frame).not.toContain('Disconnected');
    });
  });

  describe('default props', () => {
    it('showReconnect defaults to true', async () => {
      const { captureCharFrame } = await renderConnectionStatus({}, { isConnected: false });

      const frame = captureCharFrame();
      expect(frame).toContain('[R]econnect');
    });

    it('connectedLabel defaults to "Connected"', async () => {
      const { captureCharFrame } = await renderConnectionStatus({}, { isConnected: true });

      const frame = captureCharFrame();
      expect(frame).toContain('Connected');
    });

    it('disconnectedLabel defaults to "Disconnected"', async () => {
      const { captureCharFrame } = await renderConnectionStatus({}, { isConnected: false });

      const frame = captureCharFrame();
      expect(frame).toContain('Disconnected');
    });
  });

  describe('custom labels combination', () => {
    it('renders with all custom labels when connected', async () => {
      const { captureCharFrame } = await renderConnectionStatus(
        {
          connectedLabel: 'System Online',
          disconnectedLabel: 'System Offline',
          showReconnect: true,
        },
        { isConnected: true }
      );

      const frame = captureCharFrame();
      expect(frame).toContain('System Online');
      expect(frame).not.toContain('System Offline');
    });

    it('renders with all custom labels when disconnected', async () => {
      const { captureCharFrame } = await renderConnectionStatus(
        {
          connectedLabel: 'System Online',
          disconnectedLabel: 'System Offline',
          showReconnect: true,
        },
        { isConnected: false }
      );

      const frame = captureCharFrame();
      expect(frame).toContain('System Offline');
      expect(frame).not.toContain('System Online');
      expect(frame).toContain('[R]econnect');
    });
  });
});

// ============================================================================
// Component Exports Tests
// ============================================================================

describe('ConnectionStatus exports', () => {
  it('exports ConnectionStatus component', () => {
    expect(ConnectionStatus).toBeDefined();
    expect(typeof ConnectionStatus).toBe('function');
  });
});

// ============================================================================
// Type Tests
// ============================================================================

describe('ConnectionStatus types', () => {
  it('ConnectionStatusProps accepts showReconnect option', () => {
    const props: ConnectionStatusProps = {
      showReconnect: true,
    };
    expect(props.showReconnect).toBe(true);
  });

  it('ConnectionStatusProps accepts custom labels', () => {
    const props: ConnectionStatusProps = {
      connectedLabel: 'Online',
      disconnectedLabel: 'Offline',
    };
    expect(props.connectedLabel).toBe('Online');
    expect(props.disconnectedLabel).toBe('Offline');
  });

  it('ConnectionStatusProps allows all options together', () => {
    const props: ConnectionStatusProps = {
      showReconnect: true,
      connectedLabel: 'Active',
      disconnectedLabel: 'Inactive',
    };

    expect(props.showReconnect).toBe(true);
    expect(props.connectedLabel).toBe('Active');
    expect(props.disconnectedLabel).toBe('Inactive');
  });
});
