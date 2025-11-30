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

import { Show } from 'solid-js';
import { useStorageState } from '../hooks/useStorage.js';
import { Theme } from './theme.js';

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
export function ConnectionStatus(props: ConnectionStatusProps) {
  const showReconnect = () => props.showReconnect ?? true;
  const connectedLabel = () => props.connectedLabel ?? 'Connected';
  const disconnectedLabel = () => props.disconnectedLabel ?? 'Disconnected';
  const reconnectLabel = () => props.reconnectLabel ?? '[R]econnect';

  const state = useStorageState();

  // state is a () => StorageState accessor, call it to get the state object
  const isConnected = () => state().isConnected;

  // Determine colors based on connection state
  const statusColor = () => (isConnected() ? Theme.getSuccessColor() : Theme.getErrorColor());
  const statusLabel = () => (isConnected() ? connectedLabel() : disconnectedLabel());
  const statusIcon = () => (isConnected() ? '●' : '○');

  return (
    <box flexDirection="row" alignItems="center">
      <text fg={statusColor()}>
        {statusIcon()} {statusLabel()}
      </text>
      <Show when={!isConnected() && showReconnect()}>
        <text fg={Theme.getInfoColor()} marginLeft={1}>
          {reconnectLabel()}
        </text>
      </Show>
    </box>
  );
}
