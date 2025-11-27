/**
 * ProfileSelector Component
 *
 * Allows users to view and switch between configured storage provider profiles.
 * Only shown when the new provider system is enabled.
 *
 * Features:
 * - List available profiles from ProfileManager
 * - Switch between profiles
 * - Show provider type icon/indicator
 * - Handle connection state during switch
 * - Graceful error handling
 */

import { useState, useEffect } from 'react';
import type { Profile, ProviderType } from '../providers/types/profile.js';
import type { ProfileManager } from '../providers/services/profile-manager.js';
import { CatppuccinMocha } from '../ui/theme.js';
import { isNewProviderSystemEnabled } from '../utils/feature-flags.js';

// ============================================================================
// Types
// ============================================================================

export interface ProfileSelectorProps {
  /** ProfileManager instance to use for listing profiles */
  profileManager: ProfileManager;

  /** Current active profile ID */
  currentProfileId?: string;

  /** Callback when a profile is selected */
  onProfileSelect: (profile: Profile) => void;

  /** Whether the selector is currently loading */
  isLoading?: boolean;

  /** Error message to display */
  error?: string;

  /** Whether to show provider type indicators */
  showProviderType?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get a short icon/indicator for provider type
 */
function getProviderTypeIndicator(providerType: ProviderType): string {
  const indicators: Record<ProviderType, string> = {
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
function getProviderTypeColor(providerType: ProviderType): string {
  const colors: Record<ProviderType, string> = {
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
// Component
// ============================================================================

/**
 * ProfileSelector - List and switch between storage provider profiles
 *
 * @example
 * ```tsx
 * function App() {
 *   const [profileManager] = useState(() => new FileProfileManager());
 *   const [currentProfile, setCurrentProfile] = useState<string>();
 *
 *   const handleProfileSelect = async (profile: Profile) => {
 *     setCurrentProfile(profile.id);
 *     // Create provider from profile and switch context
 *   };
 *
 *   return (
 *     <ProfileSelector
 *       profileManager={profileManager}
 *       currentProfileId={currentProfile}
 *       onProfileSelect={handleProfileSelect}
 *       showProviderType={true}
 *     />
 *   );
 * }
 * ```
 */
export function ProfileSelector({
  profileManager,
  currentProfileId,
  onProfileSelect,
  isLoading = false,
  error,
  showProviderType = true,
}: ProfileSelectorProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [loadError, setLoadError] = useState<string | undefined>(error);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Only show if new provider system is enabled
  const isEnabled = isNewProviderSystemEnabled();

  // Load profiles on mount
  useEffect(() => {
    const loadProfiles = async () => {
      try {
        setLoadingProfiles(true);
        setLoadError(undefined);
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
        setLoadError(err instanceof Error ? err.message : 'Failed to load profiles');
      } finally {
        setLoadingProfiles(false);
      }
    };

    loadProfiles();
  }, [profileManager, currentProfileId]);

  // Don't render if provider system is not enabled
  if (!isEnabled) {
    return null;
  }

  // Show loading state
  if (loadingProfiles || isLoading) {
    return (
      <box
        borderStyle="rounded"
        borderColor={CatppuccinMocha.blue}
        title="Profiles"
        paddingLeft={1}
        paddingRight={1}
        flexDirection="column"
      >
        <text fg={CatppuccinMocha.overlay0}>Loading profiles...</text>
      </box>
    );
  }

  // Show error state
  if (loadError) {
    return (
      <box
        borderStyle="rounded"
        borderColor={CatppuccinMocha.red}
        title="Profiles"
        paddingLeft={1}
        paddingRight={1}
        flexDirection="column"
      >
        <text fg={CatppuccinMocha.red}>Error: {loadError}</text>
      </box>
    );
  }

  // Show empty state
  if (profiles.length === 0) {
    return (
      <box
        borderStyle="rounded"
        borderColor={CatppuccinMocha.overlay0}
        title="Profiles"
        paddingLeft={1}
        paddingRight={1}
        flexDirection="column"
      >
        <text fg={CatppuccinMocha.overlay0}>No profiles configured</text>
      </box>
    );
  }

  // Render profile list
  return (
    <box
      borderStyle="rounded"
      borderColor={CatppuccinMocha.blue}
      title="Profiles"
      paddingLeft={1}
      paddingRight={1}
      flexDirection="column"
    >
      {profiles.map((profile, index) => {
        const isSelected = index === selectedIndex;
        const isCurrent = profile.id === currentProfileId;
        const indicator = showProviderType ? getProviderTypeIndicator(profile.provider) : '';
        const indicatorColor = getProviderTypeColor(profile.provider);

        return (
          <box
            key={profile.id}
            flexDirection="row"
            marginBottom={index < profiles.length - 1 ? 1 : 0}
          >
            {/* Selection indicator */}
            <text fg={isSelected ? CatppuccinMocha.blue : CatppuccinMocha.overlay0}>
              {isSelected ? '>' : ' '}
            </text>

            {/* Current indicator */}
            <text fg={isCurrent ? CatppuccinMocha.green : CatppuccinMocha.overlay0} marginLeft={1}>
              {isCurrent ? '●' : '○'}
            </text>

            {/* Profile name */}
            <text fg={isCurrent ? CatppuccinMocha.text : CatppuccinMocha.subtext0} marginLeft={1}>
              {profile.displayName}
            </text>

            {/* Provider type indicator */}
            {showProviderType && (
              <text fg={indicatorColor} marginLeft={1}>
                [{indicator}]
              </text>
            )}
          </box>
        );
      })}

      {/* Help text */}
      <box marginTop={1}>
        <text fg={CatppuccinMocha.overlay0}>Use ↑↓ to select, Enter to switch</text>
      </box>
    </box>
  );
}

// ============================================================================
// Utility Component - ProfileBadge
// ============================================================================

/**
 * Simple badge showing current profile info
 *
 * @example
 * ```tsx
 * <ProfileBadge profile={currentProfile} />
 * ```
 */
export function ProfileBadge({ profile }: { profile: Profile | undefined }) {
  if (!profile) {
    return null;
  }

  const indicator = getProviderTypeIndicator(profile.provider);
  const color = getProviderTypeColor(profile.provider);

  return (
    <box flexDirection="row" alignItems="center">
      <text fg={color}>[{indicator}]</text>
      <text fg={CatppuccinMocha.text} marginLeft={1}>
        {profile.displayName}
      </text>
    </box>
  );
}

// ============================================================================
// Utility Component - ProfileList
// ============================================================================

/**
 * Simple list of profile names (no selection)
 *
 * @example
 * ```tsx
 * <ProfileList profiles={availableProfiles} />
 * ```
 */
export function ProfileList({
  profiles,
  showProviderType = true,
}: {
  profiles: Profile[];
  showProviderType?: boolean;
}) {
  if (profiles.length === 0) {
    return <text fg={CatppuccinMocha.overlay0}>No profiles</text>;
  }

  return (
    <box flexDirection="column">
      {profiles.map((profile, index) => {
        const indicator = showProviderType ? getProviderTypeIndicator(profile.provider) : '';
        const indicatorColor = getProviderTypeColor(profile.provider);

        return (
          <box
            key={profile.id}
            flexDirection="row"
            marginBottom={index < profiles.length - 1 ? 1 : 0}
          >
            <text fg={CatppuccinMocha.text}>{profile.displayName}</text>
            {showProviderType && (
              <text fg={indicatorColor} marginLeft={1}>
                [{indicator}]
              </text>
            )}
          </box>
        );
      })}
    </box>
  );
}
