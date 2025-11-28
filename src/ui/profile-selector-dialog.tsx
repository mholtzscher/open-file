/**
 * ProfileSelectorDialog React component
 *
 * Interactive dialog for selecting and switching between storage provider profiles.
 * Only shown when the new provider system is enabled.
 */

import { useState, useEffect, useCallback } from 'react';
import { CatppuccinMocha } from './theme.js';
import { BaseDialog, getContentWidth } from './base-dialog.js';
import { useDialogKeyboard } from '../hooks/useDialogKeyboard.js';
import { useKeyboardHandler, KeyboardPriority } from '../contexts/KeyboardContext.js';
import type { Profile } from '../providers/types/profile.js';
import type { ProfileManager } from '../providers/services/profile-manager.js';
import type { KeyboardKey } from '../types/keyboard.js';

// ============================================================================
// Types
// ============================================================================

export interface ProfileSelectorDialogProps {
  /** Whether the dialog is visible */
  visible: boolean;

  /** ProfileManager instance to use for listing profiles */
  profileManager: ProfileManager;

  /** Current active profile ID */
  currentProfileId?: string;

  /** Callback when a profile is selected */
  onProfileSelect: (profile: Profile) => void;

  /** Callback when dialog is cancelled/closed */
  onCancel: () => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get a short icon/indicator for provider type
 */
function getProviderTypeIndicator(providerType: string): string {
  const indicators: Record<string, string> = {
    s3: 'S3',
    gcs: 'GCS',
    sftp: 'SFTP',
    ftp: 'FTP',
    nfs: 'NFS',
    smb: 'SMB',
    gdrive: 'Drive',
    local: 'Local',
  };

  return indicators[providerType] || providerType.toUpperCase();
}

/**
 * Get color for provider type
 */
function getProviderTypeColor(providerType: string): string {
  const colors: Record<string, string> = {
    s3: CatppuccinMocha.yellow,
    gcs: CatppuccinMocha.blue,
    sftp: CatppuccinMocha.green,
    ftp: CatppuccinMocha.peach,
    nfs: CatppuccinMocha.teal,
    smb: CatppuccinMocha.mauve,
    gdrive: CatppuccinMocha.red,
    local: CatppuccinMocha.text,
  };

  return colors[providerType] || CatppuccinMocha.text;
}

// ============================================================================
// Constants
// ============================================================================

const DIALOG_WIDTH = 60;

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
}: ProfileSelectorDialogProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  // Load profiles when dialog becomes visible
  useEffect(() => {
    if (!visible) return;

    const loadProfiles = async () => {
      try {
        setIsLoading(true);
        setError(undefined);
        const profileList = await profileManager.listProfiles();
        setProfiles(profileList);

        // Set selected index to current profile if specified
        if (currentProfileId) {
          const index = profileList.findIndex(p => p.id === currentProfileId);
          if (index >= 0) {
            setSelectedIndex(index);
          }
        }
      } catch (err) {
        console.error('Failed to load profiles:', err);
        setError(err instanceof Error ? err.message : 'Failed to load profiles');
      } finally {
        setIsLoading(false);
      }
    };

    loadProfiles();
  }, [visible, profileManager, currentProfileId]);

  // Keyboard handler for navigation and selection (string-based for useDialogKeyboard)
  const handleKeyDownString = useCallback(
    (key: string) => {
      if (isLoading || error || profiles.length === 0) {
        // Only allow escape in error/loading/empty states
        if (key === 'escape') {
          onCancel();
        }
        return;
      }

      switch (key) {
        case 'j':
        case 'down':
          setSelectedIndex(prev => Math.min(prev + 1, profiles.length - 1));
          break;

        case 'k':
        case 'up':
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;

        case 'g':
          // Go to top (gg motion handled at dispatcher level)
          setSelectedIndex(0);
          break;

        case 'G':
          // Go to bottom
          setSelectedIndex(profiles.length - 1);
          break;

        case 'return':
        case 'enter':
          if (selectedIndex >= 0 && selectedIndex < profiles.length) {
            onProfileSelect(profiles[selectedIndex]);
          }
          break;

        case 'escape':
        case 'q':
          onCancel();
          break;

        default:
          break;
      }
    },
    [isLoading, error, profiles, selectedIndex, onProfileSelect, onCancel]
  );

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
        return false;
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

        case 'escape':
        case 'q':
          onCancel();
          return true;

        default:
          return false;
      }
    },
    [visible, isLoading, error, profiles, selectedIndex, onProfileSelect, onCancel]
  );

  // Register keyboard handler with KeyboardContext (high priority for dialogs)
  useKeyboardHandler(handleKeyboard, [handleKeyboard], KeyboardPriority.High);

  // Also register with useDialogKeyboard for backward compatibility when used inside S3Explorer
  useDialogKeyboard('profile-selector-dialog', handleKeyDownString, visible);

  // Don't render if not visible
  if (!visible) {
    return null;
  }

  const contentWidth = getContentWidth(DIALOG_WIDTH);

  // Calculate dialog height based on content
  const baseHeight = 6; // Header + footer + padding
  const contentHeight = Math.max(3, profiles.length);
  const dialogHeight = baseHeight + contentHeight;

  // Loading state
  if (isLoading) {
    return (
      <BaseDialog
        visible={true}
        title="Select Profile"
        width={DIALOG_WIDTH}
        height={10}
        borderColor={CatppuccinMocha.blue}
        showOverlay={true}
      >
        <text fg={CatppuccinMocha.overlay0} width={contentWidth}>
          Loading profiles...
        </text>
      </BaseDialog>
    );
  }

  // Error state
  if (error) {
    return (
      <BaseDialog
        visible={true}
        title="Select Profile"
        width={DIALOG_WIDTH}
        height={12}
        borderColor={CatppuccinMocha.red}
        showOverlay={true}
      >
        <text fg={CatppuccinMocha.red} width={contentWidth}>
          Error: {error}
        </text>
        <text fg={CatppuccinMocha.overlay0} width={contentWidth}>
          {' '}
        </text>
        <text fg={CatppuccinMocha.overlay0} width={contentWidth}>
          Press Escape to close
        </text>
      </BaseDialog>
    );
  }

  // Empty state
  if (profiles.length === 0) {
    return (
      <BaseDialog
        visible={true}
        title="Select Profile"
        width={DIALOG_WIDTH}
        height={12}
        borderColor={CatppuccinMocha.overlay0}
        showOverlay={true}
      >
        <text fg={CatppuccinMocha.overlay0} width={contentWidth}>
          No profiles configured
        </text>
        <text fg={CatppuccinMocha.overlay0} width={contentWidth}>
          {' '}
        </text>
        <text fg={CatppuccinMocha.subtext0} width={contentWidth}>
          Press Escape to close
        </text>
      </BaseDialog>
    );
  }

  // Profile list
  return (
    <BaseDialog
      visible={true}
      title="Select Profile"
      width={DIALOG_WIDTH}
      height={dialogHeight}
      borderColor={CatppuccinMocha.blue}
      showOverlay={true}
    >
      {profiles.map((profile, index) => {
        const isSelected = index === selectedIndex;
        const isCurrent = profile.id === currentProfileId;
        const indicator = getProviderTypeIndicator(profile.provider);
        const indicatorColor = getProviderTypeColor(profile.provider);

        // Build the line text
        const selectionChar = isSelected ? '>' : ' ';
        const currentChar = isCurrent ? '●' : '○';
        const badge = `[${indicator}]`;
        const name = profile.displayName;

        // Format: "> ● ProfileName [S3]"
        const line = `${selectionChar} ${currentChar} ${name} ${badge}`;

        return (
          <text
            key={profile.id}
            fg={isCurrent ? CatppuccinMocha.text : CatppuccinMocha.subtext0}
            width={contentWidth}
          >
            {line}
          </text>
        );
      })}

      {/* Footer help text */}
      <text fg={CatppuccinMocha.overlay0} width={contentWidth}>
        {' '}
      </text>
      <text fg={CatppuccinMocha.overlay0} width={contentWidth}>
        ↑↓/jk: Select Enter: Switch Esc: Cancel
      </text>
    </BaseDialog>
  );
}
