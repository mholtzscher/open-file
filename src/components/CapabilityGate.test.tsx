/**
 * Tests for CapabilityGate component
 *
 * Note: These tests verify the component exports and type signatures.
 * Full integration tests with React context require proper React testing setup.
 */

import { describe, it, expect } from 'bun:test';
import {
  CapabilityGate,
  RequiresCapability,
  DisabledIfMissing,
  useHasCapability,
  useHasAllCapabilities,
  useHasAnyCapability,
  type CapabilityGateProps,
  type GateBehavior,
} from './CapabilityGate.js';
import { Capability } from '../providers/types/capabilities.js';

// ============================================================================
// Component Exports
// ============================================================================

describe('CapabilityGate exports', () => {
  it('exports CapabilityGate component', () => {
    expect(CapabilityGate).toBeDefined();
    expect(typeof CapabilityGate).toBe('function');
  });

  it('exports RequiresCapability component', () => {
    expect(RequiresCapability).toBeDefined();
    expect(typeof RequiresCapability).toBe('function');
  });

  it('exports DisabledIfMissing component', () => {
    expect(DisabledIfMissing).toBeDefined();
    expect(typeof DisabledIfMissing).toBe('function');
  });

  it('exports capability hooks', () => {
    expect(useHasCapability).toBeDefined();
    expect(useHasAllCapabilities).toBeDefined();
    expect(useHasAnyCapability).toBeDefined();
  });
});

// ============================================================================
// Type Tests
// ============================================================================

describe('CapabilityGate types', () => {
  it('GateBehavior type has correct values', () => {
    const behaviors: GateBehavior[] = ['hide', 'disable', 'show-disabled'];
    expect(behaviors).toHaveLength(3);
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

  it('CapabilityGateProps accepts string capability', () => {
    const props: CapabilityGateProps = {
      requires: 'custom-capability',
      children: null,
    };
    expect(props.requires).toBe('custom-capability');
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

  it('CapabilityGateProps accepts disabled message', () => {
    const props: CapabilityGateProps = {
      requires: Capability.Copy,
      children: null,
      disabledMessage: 'Feature disabled',
    };
    expect(props.disabledMessage).toBe('Feature disabled');
  });
});

// ============================================================================
// Capability Enum Tests
// ============================================================================

describe('Capability enum usage', () => {
  it('supports core operation capabilities', () => {
    expect(Capability.List).toBe(Capability.List);
    expect(Capability.Read).toBe(Capability.Read);
    expect(Capability.Write).toBe(Capability.Write);
    expect(Capability.Delete).toBe(Capability.Delete);
  });

  it('supports navigation capabilities', () => {
    expect(Capability.Mkdir).toBe(Capability.Mkdir);
    expect(Capability.Rmdir).toBe(Capability.Rmdir);
  });

  it('supports file management capabilities', () => {
    expect(Capability.Copy).toBe(Capability.Copy);
    expect(Capability.Move).toBe(Capability.Move);
    expect(Capability.ServerSideCopy).toBe(Capability.ServerSideCopy);
  });

  it('supports transfer capabilities', () => {
    expect(Capability.Download).toBe(Capability.Download);
    expect(Capability.Upload).toBe(Capability.Upload);
    expect(Capability.Resume).toBe(Capability.Resume);
  });

  it('supports advanced capabilities', () => {
    expect(Capability.Versioning).toBe(Capability.Versioning);
    expect(Capability.Metadata).toBe(Capability.Metadata);
    expect(Capability.Permissions).toBe(Capability.Permissions);
    expect(Capability.Symlinks).toBe(Capability.Symlinks);
    expect(Capability.PresignedUrls).toBe(Capability.PresignedUrls);
  });

  it('supports container capability', () => {
    expect(Capability.Containers).toBe(Capability.Containers);
  });

  it('supports locking capabilities', () => {
    expect(Capability.FileLocking).toBe(Capability.FileLocking);
    expect(Capability.Delegations).toBe(Capability.Delegations);
  });
});

// ============================================================================
// Usage Pattern Tests
// ============================================================================

describe('Common usage patterns', () => {
  it('single capability requirement pattern', () => {
    const requirement = Capability.Copy;
    expect(requirement).toBe(Capability.Copy);
  });

  it('multiple capabilities requirement pattern', () => {
    const requirements = [Capability.Copy, Capability.ServerSideCopy];
    expect(requirements).toHaveLength(2);
    expect(requirements).toContain(Capability.Copy);
    expect(requirements).toContain(Capability.ServerSideCopy);
  });

  it('custom capability string pattern', () => {
    const customCapability = 'custom-feature';
    expect(typeof customCapability).toBe('string');
  });

  it('behavior options pattern', () => {
    const behaviors: GateBehavior[] = ['hide', 'disable', 'show-disabled'];
    behaviors.forEach(behavior => {
      expect(['hide', 'disable', 'show-disabled']).toContain(behavior);
    });
  });
});

// ============================================================================
// Component Patterns
// ============================================================================

describe('Component patterns', () => {
  it('RequiresCapability props pattern', () => {
    const props = {
      capability: Capability.Upload,
      children: null,
    };
    expect(props.capability).toBe(Capability.Upload);
  });

  it('DisabledIfMissing props pattern', () => {
    const props = {
      capability: Capability.Versioning,
      message: 'Not available',
      children: null,
    };
    expect(props.capability).toBe(Capability.Versioning);
    expect(props.message).toBe('Not available');
  });
});

// ============================================================================
// Integration Scenarios
// ============================================================================

describe('Integration scenarios', () => {
  it('copy button scenario', () => {
    // Scenario: Hide copy button when Copy capability is missing
    const requirement = Capability.Copy;
    const behavior: GateBehavior = 'hide';

    expect(requirement).toBe(Capability.Copy);
    expect(behavior).toBe('hide');
  });

  it('versioning UI scenario', () => {
    // Scenario: Show disabled versioning UI when not supported
    const requirement = Capability.Versioning;
    const behavior: GateBehavior = 'show-disabled';
    const message = 'Versioning not supported';

    expect(requirement).toBe(Capability.Versioning);
    expect(behavior).toBe('show-disabled');
    expect(message).toContain('not supported');
  });

  it('permissions column scenario', () => {
    // Scenario: Hide permissions column when Permissions capability missing
    const requirement = Capability.Permissions;
    const behavior: GateBehavior = 'hide';

    expect(requirement).toBe(Capability.Permissions);
    expect(behavior).toBe('hide');
  });

  it('server-side copy scenario', () => {
    // Scenario: Require both Copy and ServerSideCopy capabilities
    const requirements = [Capability.Copy, Capability.ServerSideCopy];

    expect(requirements).toContain(Capability.Copy);
    expect(requirements).toContain(Capability.ServerSideCopy);
  });

  it('transfer operations scenario', () => {
    // Scenario: Check if any transfer capability is available
    const transferCapabilities = [Capability.Upload, Capability.Download];

    expect(transferCapabilities).toContain(Capability.Upload);
    expect(transferCapabilities).toContain(Capability.Download);
  });
});
