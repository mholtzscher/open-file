/**
 * ConnectionStatus Component
 *
 * Displays connection status for connection-oriented storage providers
 * (SFTP, FTP, SMB, etc.) and provides reconnect functionality.
 *
 * Features:
 * - Shows connected/disconnected states
 * - Reconnect button when disconnected
 * - Visual indicators (colors, icons)
 * - Only shown for connection-oriented providers
 * - Integrates with StorageContext
 */

import { useStorageState } from '../hooks/useStorage.js';
import { CatppuccinMocha } from './theme.js';

// ============================================================================
// Types
// ============================================================================

export interface ConnectionStatusProps {
  /** Whether to show the reconnect message */
  showReconnect?: boolean;

  /** Custom label for connected state */
  connectedLabel?: string;

  /** Custom label for disconnected state */
  disconnectedLabel?: string;

  /** Custom label for reconnect button */
  reconnectLabel?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * ConnectionStatus - Shows connection state and reconnect option
 *
 * @example
 * ```tsx
 * <ConnectionStatus showReconnect={true} />
 * ```
 */
export function ConnectionStatus({
  showReconnect = true,
  connectedLabel = 'Connected',
  disconnectedLabel = 'Disconnected',
  reconnectLabel = '[R]econnect',
}: ConnectionStatusProps) {
  const state = useStorageState();

  const isConnected = state.isConnected;

  // Determine colors based on connection state
  const statusColor = isConnected ? CatppuccinMocha.green : CatppuccinMocha.red;
  const statusLabel = isConnected ? connectedLabel : disconnectedLabel;
  const statusIcon = isConnected ? '●' : '○';

  return (
    <box flexDirection="row" alignItems="center">
      <text fg={statusColor}>
        {statusIcon} {statusLabel}
      </text>
      {!isConnected && showReconnect && (
        <text fg={CatppuccinMocha.blue} marginLeft={1}>
          {reconnectLabel}
        </text>
      )}
    </box>
  );
}
