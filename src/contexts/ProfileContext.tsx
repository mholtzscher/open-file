/**
 * ProfileContext - Manages profile selection and provider lifecycle
 *
 * Provides:
 * - Profile selection state
 * - Current provider instance
 * - Profile switching capabilities
 */

import { createSignal } from 'solid-js';
import { StorageProvider } from '../providers/provider.js';
import type { ProfileManager } from '../providers/services/profile-manager.js';
import type { Profile } from '../providers/types/profile.js';
import { ThemeRegistry } from '../ui/theme-registry.js';
import { createSimpleContext } from './helper.js';

// ============================================================================
// Context Types
// ============================================================================

/**
 * Profile context value
 */
export interface ProfileContextValue {
  /** Current storage provider (call as function in Solid) */
  provider: () => StorageProvider | undefined;

  /** Current profile ID (call as function in Solid) */
  profileId: () => string | undefined;

  /** Current profile display name (call as function in Solid) */
  profileName: () => string | undefined;

  /** Whether profile selector should be shown (call as function in Solid) */
  isSelectingProfile: () => boolean;

  /** Profile manager instance */
  profileManager: ProfileManager;

  /** Select a profile and create its provider */
  selectProfile: (profile: Profile) => Promise<void>;

  /** Open profile selector */
  openProfileSelector: () => void;

  /** Close profile selector (only if a provider exists) */
  closeProfileSelector: () => void;
}

// ============================================================================
// Provider Props
// ============================================================================

export interface ProfileProviderProps {
  profileManager: ProfileManager;
  /** Optional handler when no profile is selected and the selector is closed */
  onExitWithoutProvider?: () => void;
}

// ============================================================================
// Provider using SST pattern
// ============================================================================

const { Provider: ProfileProvider, use: useProfile } = createSimpleContext<
  ProfileContextValue,
  ProfileProviderProps
>({
  name: 'Profile',
  init: props => {
    const [provider, setProvider] = createSignal<StorageProvider | undefined>(undefined);
    const [profileId, setProfileId] = createSignal<string | undefined>(undefined);
    const [profileName, setProfileName] = createSignal<string | undefined>(undefined);
    const [isSelectingProfile, setIsSelectingProfile] = createSignal(true);

    const selectProfile = async (profile: Profile) => {
      try {
        const newProvider = await props.profileManager.createProviderFromProfile(profile.id);
        setProvider(newProvider);
        setProfileId(profile.id);
        setProfileName(profile.displayName);
        setIsSelectingProfile(false);

        // Apply profile's theme preference if set
        if (profile.themeId && ThemeRegistry.has(profile.themeId)) {
          ThemeRegistry.setActive(profile.themeId);
        }
      } catch (err) {
        // Log error but stay on profile selector
        console.error('Failed to load profile', err);
      }
    };

    const openProfileSelector = () => {
      setIsSelectingProfile(true);
    };

    const closeProfileSelector = () => {
      // Only close if we have a provider to fall back to
      if (provider()) {
        setIsSelectingProfile(false);
      } else if (props.onExitWithoutProvider) {
        props.onExitWithoutProvider();
      } else {
        // No provider available, exit the app by default
        process.exit(0);
      }
    };

    return {
      provider,
      profileId,
      profileName,
      isSelectingProfile,
      profileManager: props.profileManager,
      selectProfile,
      openProfileSelector,
      closeProfileSelector,
    };
  },
});

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to check if profile context is available
 * Note: In Solid, we'd need a different pattern for this - returning false outside provider
 */
export function useHasProfile(): boolean {
  try {
    useProfile();
    return true;
  } catch {
    return false;
  }
}

export { ProfileProvider, useProfile };
