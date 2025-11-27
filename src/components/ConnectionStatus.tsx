/**
 * ConnectionStatus Component
 *
 * Displays connection status for connection-oriented storage providers
 * (SFTP, FTP, SMB, etc.) and provides reconnect functionality.
 *
 * Features:
 * - Shows connected/disconnected/connecting states
 * - Reconnect button when disconnected
 * - Visual indicators (colors, icons)
 * - Only shown for connection-oriented providers
 * - Integrates with StorageContext
 */

import type { ReactNode } from 'react';
import { useStorageState, useStorage } from '../hooks/useStorage.js';
import { CatppuccinMocha } from '../ui/theme.js';

// ============================================================================
// Types
// ============================================================================

export interface ConnectionStatusProps {
  /** Whether to show the component inline or as a badge */
  variant?: 'inline' | 'badge';

  /** Whether to show the reconnect button */
  showReconnect?: boolean;

  /** Custom label for connected state */
  connectedLabel?: string;

  /** Custom label for disconnected state */
  disconnectedLabel?: string;

  /** Callback when reconnect is clicked */
  onReconnect?: () => void;
}

// ============================================================================
// Component
// ============================================================================

/**
 * ConnectionStatus - Shows connection state and reconnect option
 *
 * @example
 * ```tsx
 * // In status bar
 * <ConnectionStatus variant="inline" showReconnect={true} />
 *
 * // As a badge
 * <ConnectionStatus variant="badge" />
 * ```
 */
export function ConnectionStatus({
  variant = 'inline',
  showReconnect = true,
  connectedLabel = 'Connected',
  disconnectedLabel = 'Disconnected',
  onReconnect,
}: ConnectionStatusProps) {
  const state = useStorageState();
  const storage = useStorage();

  const isConnected = state.isConnected;

  // Determine colors based on connection state
  const statusColor = isConnected ? CatppuccinMocha.green : CatppuccinMocha.red;
  const statusLabel = isConnected ? connectedLabel : disconnectedLabel;
  const statusIcon = isConnected ? '●' : '○';

  // Handle reconnect
  const handleReconnect = async () => {
    if (onReconnect) {
      onReconnect();
    } else {
      try {
        await storage.connect();
      } catch (err) {
        console.error('Failed to reconnect:', err);
      }
    }
  };

  if (variant === 'badge') {
    return (
      <box
        borderStyle="rounded"
        borderColor={statusColor}
        paddingLeft={1}
        paddingRight={1}
        flexDirection="row"
        alignItems="center"
      >
        <text fg={statusColor}>
          {statusIcon} {statusLabel}
        </text>
        {!isConnected && showReconnect && (
          <text fg={CatppuccinMocha.blue} marginLeft={1}>
            [R]econnect
          </text>
        )}
      </box>
    );
  }

  // Inline variant
  return (
    <box flexDirection="row" alignItems="center">
      <text fg={statusColor}>
        {statusIcon} {statusLabel}
      </text>
      {!isConnected && showReconnect && (
        <text fg={CatppuccinMocha.blue} marginLeft={1}>
          [R]econnect
        </text>
      )}
    </box>
  );
}

// ============================================================================
// Utility Component - ConnectionIndicator
// ============================================================================

/**
 * Simple connection indicator (just the icon)
 *
 * @example
 * ```tsx
 * <ConnectionIndicator />
 * ```
 */
export function ConnectionIndicator() {
  const state = useStorageState();
  const isConnected = state.isConnected;
  const color = isConnected ? CatppuccinMocha.green : CatppuccinMocha.red;
  const icon = isConnected ? '●' : '○';

  return <text fg={color}>{icon}</text>;
}

// ============================================================================
// Utility Component - ReconnectButton
// ============================================================================

/**
 * Standalone reconnect button
 *
 * @example
 * ```tsx
 * <ReconnectButton onReconnect={handleReconnect} />
 * ```
 */
export function ReconnectButton({ onReconnect }: { onReconnect?: () => void }) {
  const state = useStorageState();
  const storage = useStorage();

  // Only show when disconnected
  if (state.isConnected) {
    return null;
  }

  const handleReconnect = async () => {
    if (onReconnect) {
      onReconnect();
    } else {
      try {
        await storage.connect();
      } catch (err) {
        console.error('Failed to reconnect:', err);
      }
    }
  };

  return (
    <box flexDirection="row" alignItems="center">
      <text fg={CatppuccinMocha.blue}>[R]econnect</text>
    </box>
  );
}

// ============================================================================
// Hook - useConnectionStatus
// ============================================================================

/**
 * Hook to access connection status and control
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isConnected, connect, disconnect } = useConnectionStatus();
 *
 *   return (
 *     <div>
 *       Status: {isConnected ? 'Connected' : 'Disconnected'}
 *       <button onClick={connect}>Connect</button>
 *       <button onClick={disconnect}>Disconnect</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useConnectionStatus() {
  const state = useStorageState();
  const storage = useStorage();

  const connect = async () => {
    await storage.connect();
  };

  const disconnect = async () => {
    await storage.disconnect();
  };

  return {
    isConnected: state.isConnected,
    connect,
    disconnect,
  };
}
