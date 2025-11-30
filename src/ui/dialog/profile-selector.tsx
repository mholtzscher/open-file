/**
 * ProfileSelectorDialog React component
 *
 * Interactive dialog for selecting and switching between storage provider profiles.
 * Only shown when the new provider system is enabled.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
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
// Helper Functions
// ============================================================================

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
export function ProfileSelectorDialog({
  visible,
  profileManager,
  currentProfileId,
  onProfileSelect,
  onCancel,
  onEditProfiles,
}: ProfileSelectorDialogProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const prevVisibleRef = useRef(false); // Start as false to handle initial visible=true case
  const hasSetInitialSelectionRef = useRef(false);

  // Reset selection to current profile when dialog opens
  useEffect(() => {
    const wasHidden = !prevVisibleRef.current;
    prevVisibleRef.current = visible;

    // Reset the initial selection flag when dialog closes
    if (!visible) {
      hasSetInitialSelectionRef.current = false;
      return;
    }

    // Set selection when: dialog just opened OR profiles just loaded for first time
    if (visible && profiles.length > 0 && currentProfileId) {
      if (wasHidden || !hasSetInitialSelectionRef.current) {
        const index = profiles.findIndex(p => p.id === currentProfileId);
        setSelectedIndex(index >= 0 ? index : 0);
        hasSetInitialSelectionRef.current = true;
      }
    }
  }, [visible, currentProfileId, profiles]);

  // Load profiles when dialog becomes visible
  useEffect(() => {
    if (!visible) return;

    // If no profile manager is available, show an error state
    if (!profileManager) {
      setIsLoading(false);
      setProfiles([]);
      setError('Profile manager is not available');
      return;
    }

    const loadProfiles = async () => {
      try {
        setIsLoading(true);
        setError(undefined);
        const profileList = await profileManager.listProfiles();
        setProfiles(profileList);
      } catch (err) {
        console.error('Failed to load profiles:', err);
        setError(err instanceof Error ? err.message : 'Failed to load profiles');
      } finally {
        setIsLoading(false);
      }
    };

    loadProfiles();
  }, [visible, profileManager]);

  // Keyboard handler for KeyboardContext (KeyboardKey-based)
  const handleKeyboard = useCallback(
    (key: KeyboardKey): boolean => {
      if (!visible) return false;

      const keyName = key.name;

      if (isLoading || error || profiles.length === 0) {
        // Only allow escape in error/loading/empty states
        if (keyName === 'escape') {
          onCancel();
          return true;
        }
        return true; // Block other keys while dialog visible
      }

      switch (keyName) {
        case 'j':
        case 'down':
          setSelectedIndex(prev => Math.min(prev + 1, profiles.length - 1));
          return true;

        case 'k':
        case 'up':
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          return true;

        case 'g':
          setSelectedIndex(0);
          return true;

        case 'G':
          setSelectedIndex(profiles.length - 1);
          return true;

        case 'return':
        case 'enter':
          if (selectedIndex >= 0 && selectedIndex < profiles.length) {
            onProfileSelect(profiles[selectedIndex]);
          }
          return true;

        case 'e':
          // Open profiles.json in external editor
          if (onEditProfiles) {
            onEditProfiles();
          }
          return true;

        case 'escape':
        case 'q':
          onCancel();
          return true;

        default:
          return true; // Block all other keys when profile selector is open
      }
    },
    [visible, isLoading, error, profiles, selectedIndex, onProfileSelect, onCancel]
  );

  // Register keyboard handler with KeyboardContext (high priority for dialogs)
  useKeyboardHandler(handleKeyboard, KeyboardPriority.High);

  // Don't render if not visible
  if (!visible) {
    return null;
  }

  // Loading state
  if (isLoading) {
    return (
      <BaseDialog visible={true} title="Select Profile" borderColor={Theme.getInfoColor()}>
        <text fg={Theme.getDimColor()}>Loading profiles...</text>
      </BaseDialog>
    );
  }

  // Error state
  if (error) {
    return (
      <BaseDialog visible={true} title="Select Profile" borderColor={Theme.getErrorColor()}>
        <text fg={Theme.getErrorColor()}>Error: {error}</text>
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
  if (profiles.length === 0) {
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
      {profiles.map((profile, index) => {
        const isSelected = index === selectedIndex;
        const isCurrent = profile.id === currentProfileId;

        // Build the line text
        const selectionChar = isSelected ? '>' : ' ';
        const currentChar = isCurrent ? '●' : '○';
        const prefix = `${selectionChar} ${currentChar} ${profile.displayName} `;

        // Use provider-specific color for the badge via ProviderIndicator
        const textColor = isCurrent ? Theme.getTextColor() : Theme.getMutedColor();

        return (
          <box key={profile.id} flexDirection="row">
            <text fg={textColor}>{prefix}</text>
            <ProviderIndicator providerType={profile.provider} />
          </box>
        );
      })}

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
