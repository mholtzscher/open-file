/**
 * CapabilityGate Component
 *
 * Conditional rendering based on storage provider capabilities.
 * Hides or disables UI elements when the underlying provider doesn't
 * support the required operation.
 *
 * Features:
 * - Hide elements when capability is missing
 * - Disable elements with visual feedback
 */

import type { ReactNode } from 'react';
import { useStorageCapabilities } from '../hooks/useStorage.js';
import { Capability } from '../providers/types/capabilities.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Behavior when capability is missing
 */
export type GateBehavior = 'hide' | 'disable';

export interface CapabilityGateProps {
  /** Required capability to show/enable this element */
  requires: Capability | Capability[];

  /** Child elements to conditionally render */
  children: ReactNode;

  /**
   * Behavior when capability is missing
   * - 'hide': Don't render children at all (default)
   * - 'disable': Render with visual indication it's disabled
   */
  behavior?: GateBehavior;

  /**
   * Fallback content when capability is missing
   * Only used with 'hide' behavior
   */
  fallback?: ReactNode;
}

// ============================================================================
// Component
// ============================================================================

/**
 * CapabilityGate - Conditionally render based on provider capabilities
 *
 * @example
 * ```tsx
 * // Hide copy button if Copy capability not available
 * <CapabilityGate requires={Capability.Copy}>
 *   <button onClick={handleCopy}>Copy</button>
 * </CapabilityGate>
 *
 * // Show disabled state
 * <CapabilityGate requires={Capability.Versioning} behavior="disable">
 *   <button>View Versions</button>
 * </CapabilityGate>
 *
 * // Multiple capabilities required (all must be present)
 * <CapabilityGate requires={[Capability.Copy, Capability.ServerSideCopy]}>
 *   <button>Server-Side Copy</button>
 * </CapabilityGate>
 * ```
 */
export function CapabilityGate({
  requires,
  children,
  behavior = 'hide',
  fallback = null,
}: CapabilityGateProps) {
  const { hasCapability } = useStorageCapabilities();

  // Convert to array for consistent handling
  const requiredCapabilities = Array.isArray(requires) ? requires : [requires];

  // Check if all required capabilities are available
  const hasAllCapabilities = requiredCapabilities.every(cap => hasCapability(cap));
  if (hasAllCapabilities) {
    return <>{children}</>;
  }

  switch (behavior) {
    case 'hide':
      return <>{fallback}</>;
    case 'disable':
      return <>{children}</>;
    default:
      return <>{fallback}</>;
  }
}
