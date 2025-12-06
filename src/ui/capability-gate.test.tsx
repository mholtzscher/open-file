/**
 * Tests for CapabilityGate component
 *
 * Uses OpenTUI testing patterns to properly test rendered output.
 */

import { describe, it, expect } from 'bun:test';
import { testRender } from '@opentui/react/test-utils';
import { CapabilityGate, type CapabilityGateProps, type GateBehavior } from './capability-gate.js';
import { StorageContext, StorageContextValue, StorageState } from '../contexts/StorageContext.js';
import { Capability } from '../providers/types/capabilities.js';
import { EntryType } from '../types/entry.js';

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Create a mock StorageContextValue with configurable capabilities
 */
function createMockStorageContext(capabilities: Set<Capability> = new Set()): StorageContextValue {
  const defaultState: StorageState = {
    providerId: 'test',
    providerDisplayName: 'Test Provider',
    currentPath: '/',
    entries: [],
    isLoading: false,
    isConnected: true,
  };

  return {
    state: defaultState,
    navigate: () => Promise.resolve(),
    navigateUp: () => Promise.resolve(),
    refresh: () => Promise.resolve(),
    list: () => Promise.resolve([]),
    read: () => Promise.resolve(Buffer.from('')),
    getMetadata: () =>
      Promise.resolve({
        id: 'test',
        name: 'test',
        type: EntryType.File,
        path: '/test',
        modified: new Date(),
      }),
    write: () => Promise.resolve(),
    mkdir: () => Promise.resolve(),
    delete: () => Promise.resolve(),
    move: () => Promise.resolve(),
    copy: () => Promise.resolve(),
    download: () => Promise.resolve(),
    upload: () => Promise.resolve(),
    listContainers: () => Promise.resolve([]),
    setContainer: () => Promise.resolve(),
    getContainer: () => undefined,
    hasCapability: (cap: Capability) => capabilities.has(cap),
    switchProvider: () => Promise.resolve(),
    disconnect: () => Promise.resolve(),
    connect: () => Promise.resolve(),
    subscribe: () => () => {},
    getProfileManager: () => undefined,
    switchProfile: () => Promise.resolve(),
  };
}

/**
 * Wrapper component that provides StorageContext for testing
 */
function TestWrapper({
  children,
  capabilities,
}: {
  children: React.ReactNode;
  capabilities?: Set<Capability>;
}) {
  const mockContext = createMockStorageContext(capabilities);
  return <StorageContext.Provider value={mockContext}>{children}</StorageContext.Provider>;
}

/**
 * Helper to render CapabilityGate with mocked storage context
 */
async function renderCapabilityGate(
  props: CapabilityGateProps,
  capabilities: Set<Capability> = new Set()
) {
  const result = await testRender(
    <TestWrapper capabilities={capabilities}>
      <CapabilityGate {...props} />
    </TestWrapper>,
    { width: 80, height: 24 }
  );
  await result.renderOnce();
  return result;
}

// ============================================================================
// Component Rendering Tests
// ============================================================================

describe('CapabilityGate', () => {
  describe('when capability is present', () => {
    it('renders children when single capability is available', async () => {
      const { captureCharFrame } = await renderCapabilityGate(
        {
          requires: Capability.Copy,
          children: <text>Copy Button</text>,
        },
        new Set([Capability.Copy])
      );

      const frame = captureCharFrame();
      expect(frame).toContain('Copy Button');
    });

    it('renders children when all required capabilities are available', async () => {
      const { captureCharFrame } = await renderCapabilityGate(
        {
          requires: [Capability.Copy, Capability.Move],
          children: <text>File Operations</text>,
        },
        new Set([Capability.Copy, Capability.Move, Capability.Delete])
      );

      const frame = captureCharFrame();
      expect(frame).toContain('File Operations');
    });

    it('renders children when capability enum is available', async () => {
      const { captureCharFrame } = await renderCapabilityGate(
        {
          requires: Capability.Versioning,
          children: <text>Version Feature</text>,
        },
        new Set([Capability.Versioning])
      );

      const frame = captureCharFrame();
      expect(frame).toContain('Version Feature');
    });
  });

  describe('when capability is missing with hide behavior (default)', () => {
    it('hides children when capability is missing', async () => {
      const { captureCharFrame } = await renderCapabilityGate(
        {
          requires: Capability.Copy,
          children: <text>Copy Button</text>,
        },
        new Set() // No capabilities
      );

      const frame = captureCharFrame();
      expect(frame).not.toContain('Copy Button');
    });

    it('hides children when one of multiple required capabilities is missing', async () => {
      const { captureCharFrame } = await renderCapabilityGate(
        {
          requires: [Capability.Copy, Capability.ServerSideCopy],
          children: <text>Server Copy</text>,
        },
        new Set([Capability.Copy]) // Missing ServerSideCopy
      );

      const frame = captureCharFrame();
      expect(frame).not.toContain('Server Copy');
    });

    it('renders fallback when capability is missing', async () => {
      const { captureCharFrame } = await renderCapabilityGate(
        {
          requires: Capability.Versioning,
          children: <text>Version History</text>,
          fallback: <text>Versioning unavailable</text>,
        },
        new Set()
      );

      const frame = captureCharFrame();
      expect(frame).not.toContain('Version History');
      expect(frame).toContain('Versioning unavailable');
    });

    it('renders null fallback by default', async () => {
      const { captureCharFrame } = await renderCapabilityGate(
        {
          requires: Capability.Copy,
          children: <text>Should not appear</text>,
        },
        new Set()
      );

      const frame = captureCharFrame();
      expect(frame).not.toContain('Should not appear');
    });
  });

  describe('when capability is missing with disable behavior', () => {
    it('still renders children when behavior is disable', async () => {
      const { captureCharFrame } = await renderCapabilityGate(
        {
          requires: Capability.Versioning,
          children: <text>View Versions</text>,
          behavior: 'disable',
        },
        new Set() // No capabilities
      );

      const frame = captureCharFrame();
      expect(frame).toContain('View Versions');
    });
  });

  describe('behavior prop', () => {
    it('defaults to hide behavior', async () => {
      const { captureCharFrame } = await renderCapabilityGate(
        {
          requires: Capability.Upload,
          children: <text>Upload</text>,
          // behavior not specified - should default to 'hide'
        },
        new Set()
      );

      const frame = captureCharFrame();
      expect(frame).not.toContain('Upload');
    });

    it('respects explicit hide behavior', async () => {
      const { captureCharFrame } = await renderCapabilityGate(
        {
          requires: Capability.Download,
          children: <text>Download</text>,
          behavior: 'hide',
        },
        new Set()
      );

      const frame = captureCharFrame();
      expect(frame).not.toContain('Download');
    });
  });
});

// ============================================================================
// Component Exports Tests
// ============================================================================

describe('CapabilityGate exports', () => {
  it('exports CapabilityGate component', () => {
    expect(CapabilityGate).toBeDefined();
    expect(typeof CapabilityGate).toBe('function');
  });
});

// ============================================================================
// Type Tests
// ============================================================================

describe('CapabilityGate types', () => {
  it('GateBehavior type has correct values', () => {
    const behaviors: GateBehavior[] = ['hide', 'disable'];
    expect(behaviors).toHaveLength(2);
  });

  it('CapabilityGateProps accepts single capability', () => {
    const props: CapabilityGateProps = {
      requires: Capability.Copy,
      children: null,
    };
    expect(props.requires).toBe(Capability.Copy);
  });

  it('CapabilityGateProps accepts array of capabilities', () => {
    const props: CapabilityGateProps = {
      requires: [Capability.Copy, Capability.Move],
      children: null,
    };
    expect(Array.isArray(props.requires)).toBe(true);
  });

  it('CapabilityGateProps accepts Capability enum', () => {
    const props: CapabilityGateProps = {
      requires: Capability.Versioning,
      children: null,
    };
    expect(props.requires).toBe(Capability.Versioning);
  });

  it('CapabilityGateProps accepts behavior option', () => {
    const props: CapabilityGateProps = {
      requires: Capability.Copy,
      children: null,
      behavior: 'hide',
    };
    expect(props.behavior).toBe('hide');
  });

  it('CapabilityGateProps accepts fallback', () => {
    const fallback = 'Fallback content';
    const props: CapabilityGateProps = {
      requires: Capability.Copy,
      children: null,
      fallback,
    };
    expect(props.fallback).toBe(fallback);
  });
});
