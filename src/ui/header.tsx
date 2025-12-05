/**
 * Header React component
 *
 * Displays the application title and current container/bucket at the top of the screen.
 *
 * Now supports both legacy adapter (bucket-based) and new provider system (container-based).
 * Automatically hides container selector for providers that don't support containers.
 */

import { Theme } from './theme.js';
import { ProviderIndicator } from './provider-indicator.js';
import { useHasStorage } from '../contexts/StorageContext.js';
import { useStorageState, useStorageCapabilities } from '../hooks/useStorage.js';
import { ConnectionStatus } from './connection-status.js';
import { Capability } from '../providers/types/capabilities.js';

// Header takes no props

/**
 * Header React component
 *
 * Displays "open-file" in the title border and container/bucket info inside the box.
 * Shows the current AWS profile on the right side.
 * Uses padding to keep content inside the bordered box.
 *
 * Features:
 * - Shows container name from StorageContext when available
 * - Falls back to legacy bucket prop for backward compatibility
 * - Hides container selector for providers without container support
 * - Shows provider display name
 */
export function Header() {
  const hasStorage = useHasStorage();
  const state = useStorageState();
  const capabilities = useStorageCapabilities();

  // Determine what to display - use hasStorage to conditionally access state
  const hasConnection = hasStorage && capabilities?.hasCapability(Capability.Connection);
  const providerName = hasStorage ? state?.providerDisplayName : undefined;
  const profileName = hasStorage ? state?.profileName : undefined;
  const providerId = hasStorage ? state?.providerId : undefined;

  const profileDisplay = profileName ? `${profileName} ` : providerName || 'none';

  return (
    <box
      flexShrink={0}
      borderStyle="rounded"
      borderColor={Theme.getVisualModeColor()}
      title="open-file"
      paddingLeft={1}
      paddingRight={1}
      flexDirection="row"
      alignItems="center"
      justifyContent="space-between"
    >
      <box flexDirection="row" alignItems="center">
        <box flexDirection="row" alignItems="center">
          <text fg={Theme.getVisualModeColor()}>profile: </text>
          <text fg={Theme.getTextColor()}>{profileDisplay}</text>
          {profileName && providerId && <ProviderIndicator providerType={providerId} />}
        </box>
        <box paddingLeft={1}>{hasConnection && <ConnectionStatus showReconnect={true} />}</box>
      </box>
    </box>
  );
}
