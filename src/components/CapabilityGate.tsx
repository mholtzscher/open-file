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
 * - Show tooltips explaining why a feature is unavailable
 * - Works with both legacy adapters and new provider system
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
export type GateBehavior = 'hide' | 'disable' | 'show-disabled';

export interface CapabilityGateProps {
  /** Required capability to show/enable this element */
  requires: Capability | Capability[] | string | string[];

  /** Child elements to conditionally render */
  children: ReactNode;

  /**
   * Behavior when capability is missing
   * - 'hide': Don't render children at all (default)
   * - 'disable': Render but with disabled state
   * - 'show-disabled': Render with visual indication it's disabled
   */
  behavior?: GateBehavior;

  /**
   * Fallback content when capability is missing
   * Only used with 'hide' behavior
   */
  fallback?: ReactNode;

  /**
   * Custom message to show when disabled
   */
  disabledMessage?: string;
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
 * // Show disabled state with message
 * <CapabilityGate
 *   requires={Capability.Versioning}
 *   behavior="show-disabled"
 *   disabledMessage="Versioning not supported"
 * >
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
  disabledMessage,
}: CapabilityGateProps) {
  const { hasCapability } = useStorageCapabilities();

  // Convert to array for consistent handling
  const requiredCapabilities = Array.isArray(requires) ? requires : [requires];

  // Check if all required capabilities are available
  const hasAllCapabilities = requiredCapabilities.every(cap => hasCapability(cap));

  // If all capabilities are present, render children normally
  if (hasAllCapabilities) {
    return <>{children}</>;
  }

  // Handle missing capability based on behavior
  switch (behavior) {
    case 'hide':
      return <>{fallback}</>;

    case 'disable':
    case 'show-disabled':
      // For TUI, we show a visual indicator that the feature is disabled
      // We render children with a gray color to indicate disabled state
      return (
        <box flexDirection="row">
          {children}
          {disabledMessage && (
            <text fg="gray" marginLeft={1}>
              ({disabledMessage})
            </text>
          )}
        </box>
      );

    default:
      return <>{fallback}</>;
  }
}

// ============================================================================
// Utility Component - RequiresCapability
// ============================================================================

/**
 * Simple wrapper for common "hide if not available" use case
 *
 * @example
 * ```tsx
 * <RequiresCapability capability={Capability.Upload}>
 *   <UploadButton />
 * </RequiresCapability>
 * ```
 */
export function RequiresCapability({
  capability,
  children,
}: {
  capability: Capability | string;
  children: ReactNode;
}) {
  return (
    <CapabilityGate requires={capability} behavior="hide">
      {children}
    </CapabilityGate>
  );
}

// ============================================================================
// Utility Component - DisabledIfMissing
// ============================================================================

/**
 * Shows element but in disabled state if capability is missing
 *
 * @example
 * ```tsx
 * <DisabledIfMissing
 *   capability={Capability.Versioning}
 *   message="Versioning not available"
 * >
 *   <button>View Versions</button>
 * </DisabledIfMissing>
 * ```
 */
export function DisabledIfMissing({
  capability,
  message,
  children,
}: {
  capability: Capability | string;
  message?: string;
  children: ReactNode;
}) {
  return (
    <CapabilityGate requires={capability} behavior="show-disabled" disabledMessage={message}>
      {children}
    </CapabilityGate>
  );
}

// ============================================================================
// Utility Hook - useHasCapability
// ============================================================================

/**
 * Hook to check if a specific capability is available
 *
 * Useful for conditional logic that doesn't involve rendering.
 *
 * @example
 * ```tsx
 * function FileActions({ file }) {
 *   const canCopy = useHasCapability(Capability.Copy);
 *   const canDelete = useHasCapability(Capability.Delete);
 *
 *   const handleAction = () => {
 *     if (canCopy) {
 *       // Perform copy
 *     } else {
 *       showError("Copy not supported");
 *     }
 *   };
 *
 *   return <button onClick={handleAction}>Action</button>;
 * }
 * ```
 */
export function useHasCapability(capability: Capability | string): boolean {
  const { hasCapability } = useStorageCapabilities();
  return hasCapability(capability);
}

/**
 * Hook to check if all of multiple capabilities are available
 *
 * @example
 * ```tsx
 * const canServerSideCopy = useHasAllCapabilities([
 *   Capability.Copy,
 *   Capability.ServerSideCopy
 * ]);
 * ```
 */
export function useHasAllCapabilities(capabilities: (Capability | string)[]): boolean {
  const { hasCapability } = useStorageCapabilities();
  return capabilities.every(cap => hasCapability(cap));
}

/**
 * Hook to check if any of multiple capabilities are available
 *
 * @example
 * ```tsx
 * const canTransfer = useHasAnyCapability([
 *   Capability.Upload,
 *   Capability.Download
 * ]);
 * ```
 */
export function useHasAnyCapability(capabilities: (Capability | string)[]): boolean {
  const { hasCapability } = useStorageCapabilities();
  return capabilities.some(cap => hasCapability(cap));
}
