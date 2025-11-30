/**
 * ProfileSelectorDialog SolidJS component
 *
 * Interactive dialog for selecting and switching between storage provider profiles.
 * Only shown when the new provider system is enabled.
 */

import { createSignal, createEffect, For } from 'solid-js';
import { Theme } from '../theme.js';
import { ProviderIndicator } from '../provider-indicator.js';
import { BaseDialog } from './base.js';
import { HelpBar } from '../help-bar.js';
import { useKeyboardHandler, KeyboardPriority } from '../../contexts/KeyboardContext.js';
import type { Profile } from '../../providers/types/profile.js';
import type { ProfileManager } from '../../providers/services/profile-manager.js';
import type { KeyboardKey } from '../../types/keyboard.js';

// ============================================================================
// Types
// ============================================================================

export interface ProfileSelectorDialogProps {
  /** Whether the dialog is visible */
  visible: boolean;

  /** ProfileManager instance to use for listing profiles */
  profileManager: ProfileManager | undefined;

  /** Current active profile ID */
  currentProfileId?: string;

  /** Callback when a profile is selected */
  onProfileSelect: (profile: Profile) => void;

  /** Callback when dialog is cancelled/closed */
  onCancel: () => void;

  /** Callback to edit profiles in external editor (optional) */
  onEditProfiles?: () => Promise<void>;
}

// ============================================================================
// Component
// ============================================================================

/**
 * ProfileSelectorDialog - Interactive profile selector with keyboard navigation
 *
 * Features:
 * - Lists all available profiles from ProfileManager
 * - Shows provider type badges
 * - Highlights current active profile
 * - Keyboard navigation (j/k or arrow keys)
 * - Enter to select, Escape to cancel
 */
export function ProfileSelectorDialog(props: ProfileSelectorDialogProps) {
  const [profiles, setProfiles] = createSignal<Profile[]>([]);
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [isLoading, setIsLoading] = createSignal(true);
  const [error, setError] = createSignal<string | undefined>();
  let prevVisible = false;
  let hasSetInitialSelection = false;

  // Reset selection to current profile when dialog opens
  createEffect(() => {
    const wasHidden = !prevVisible;
    prevVisible = props.visible;

    // Reset the initial selection flag when dialog closes
    if (!props.visible) {
      hasSetInitialSelection = false;
      return;
    }

    // Set selection when: dialog just opened OR profiles just loaded for first time
    if (props.visible && profiles().length > 0 && props.currentProfileId) {
      if (wasHidden || !hasSetInitialSelection) {
        const index = profiles().findIndex(p => p.id === props.currentProfileId);
        setSelectedIndex(index >= 0 ? index : 0);
        hasSetInitialSelection = true;
      }
    }
  });

  // Load profiles when dialog becomes visible
  createEffect(() => {
    if (!props.visible) return;

    // If no profile manager is available, show an error state
    if (!props.profileManager) {
      setIsLoading(false);
      setProfiles([]);
      setError('Profile manager is not available');
      return;
    }

    const loadProfiles = async () => {
      try {
        setIsLoading(true);
        setError(undefined);
        const profileList = await props.profileManager!.listProfiles();
        setProfiles(profileList);
      } catch (err) {
        console.error('Failed to load profiles:', err);
        setError(err instanceof Error ? err.message : 'Failed to load profiles');
      } finally {
        setIsLoading(false);
      }
    };

    loadProfiles();
  });

  // Keyboard handler for KeyboardContext (KeyboardKey-based)
  const handleKeyboard = (key: KeyboardKey): boolean => {
    if (!props.visible) return false;

    const keyName = key.name;

    if (isLoading() || error() || profiles().length === 0) {
      // Only allow escape in error/loading/empty states
      if (keyName === 'escape') {
        props.onCancel();
        return true;
      }
      return true; // Block other keys while dialog visible
    }

    switch (keyName) {
      case 'j':
      case 'down':
        setSelectedIndex(prev => Math.min(prev + 1, profiles().length - 1));
        return true;

      case 'k':
      case 'up':
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        return true;

      case 'g':
        setSelectedIndex(0);
        return true;

      case 'G':
        setSelectedIndex(profiles().length - 1);
        return true;

      case 'return':
      case 'enter':
        if (selectedIndex() >= 0 && selectedIndex() < profiles().length) {
          props.onProfileSelect(profiles()[selectedIndex()]);
        }
        return true;

      case 'e':
        // Open profiles.json in external editor
        if (props.onEditProfiles) {
          props.onEditProfiles();
        }
        return true;

      case 'escape':
        props.onCancel();
        return true;

      default:
        return true; // Block all other keys when profile selector is open
    }
  };

  // Register keyboard handler with KeyboardContext (high priority for dialogs)
  useKeyboardHandler(handleKeyboard, KeyboardPriority.High);

  // Don't render if not visible
  if (!props.visible) {
    return null;
  }

  // Loading state
  if (isLoading()) {
    return (
      <BaseDialog visible={true} title="Select Profile" borderColor={Theme.getInfoColor()}>
        <text fg={Theme.getDimColor()}>Loading profiles...</text>
      </BaseDialog>
    );
  }

  // Error state
  if (error()) {
    return (
      <BaseDialog visible={true} title="Select Profile" borderColor={Theme.getErrorColor()}>
        <text fg={Theme.getErrorColor()}>Error: {error()}</text>
        <text fg={Theme.getDimColor()}> </text>
        <HelpBar
          items={[
            { key: 'e', description: 'edit' },
            { key: 'Esc', description: 'close' },
          ]}
        />
      </BaseDialog>
    );
  }

  // Empty state
  if (profiles().length === 0) {
    return (
      <BaseDialog visible={true} title="Select Profile" borderColor={Theme.getDimColor()}>
        <text fg={Theme.getDimColor()}>No profiles configured</text>
        <text fg={Theme.getDimColor()}> </text>
        <HelpBar
          items={[
            { key: 'e', description: 'edit' },
            { key: 'Esc', description: 'close' },
          ]}
        />
      </BaseDialog>
    );
  }

  // Profile list
  return (
    <BaseDialog visible={true} title="Select Profile" borderColor={Theme.getInfoColor()}>
      <For each={profiles()}>
        {(profile, index) => {
          const isSelected = () => index() === selectedIndex();
          const isCurrent = () => profile.id === props.currentProfileId;

          // Build the line text
          const selectionChar = () => (isSelected() ? '>' : ' ');
          const currentChar = () => (isCurrent() ? '●' : '○');
          const prefix = () => `${selectionChar()} ${currentChar()} ${profile.displayName} `;

          // Use provider-specific color for the badge via ProviderIndicator
          const textColor = () => (isCurrent() ? Theme.getTextColor() : Theme.getMutedColor());

          return (
            <box flexDirection="row">
              <text fg={textColor()}>{prefix()}</text>
              <ProviderIndicator providerType={profile.provider} />
            </box>
          );
        }}
      </For>

      {/* Footer help text */}
      <text fg={Theme.getDimColor()}> </text>
      <HelpBar
        items={[
          { key: 'j/k', description: 'select' },
          { key: 'Enter', description: 'switch' },
          { key: 'e', description: 'edit' },
          { key: 'Esc', description: 'cancel' },
        ]}
      />
    </BaseDialog>
  );
}
