/**
 * Header SolidJS component
 *
 * Displays the application title and current container/bucket at the top of the screen.
 *
 * Now supports both legacy adapter (bucket-based) and new provider system (container-based).
 * Automatically hides container selector for providers that don't support containers.
 */

import { Show } from 'solid-js';
import { Theme } from './theme.js';
import { ProviderIndicator } from './provider-indicator.js';
import { useHasStorage } from '../contexts/StorageContext.js';
import { useStorageState, useStorageCapabilities } from '../hooks/useStorage.js';
import { ConnectionStatus } from './connection-status.js';
import { Capability } from '../providers/types/capabilities.js';

export interface HeaderProps {}

/**
 * Header SolidJS component
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
  const state = hasStorage ? useStorageState() : null;
  const capabilities = hasStorage ? useStorageCapabilities() : null;

  // Determine what to display - use accessor functions
  // state is already a () => StorageState accessor, so we call it to get the state
  const hasConnection = () => capabilities?.hasCapability(Capability.Connection) ?? false;
  const providerName = () => (state ? state().providerDisplayName : undefined);
  const profileName = () => (state ? state().profileName : undefined);
  const providerId = () => (state ? state().providerId : undefined);

  const profileDisplay = () => {
    const name = profileName();
    return name ? `${name} ` : providerName() || 'none';
  };

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
          <text fg={Theme.getTextColor()}>{profileDisplay()}</text>
          <Show when={profileName() && providerId()}>
            <ProviderIndicator providerType={providerId()!} />
          </Show>
        </box>
        <box paddingLeft={1}>
          <Show when={hasConnection()}>
            <ConnectionStatus showReconnect={true} />
          </Show>
        </box>
      </box>
    </box>
  );
}
