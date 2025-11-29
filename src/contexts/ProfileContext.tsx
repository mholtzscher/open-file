/**
 * ProfileContext - Manages profile selection and provider lifecycle
 *
 * Provides:
 * - Profile selection state
 * - Current provider instance
 * - Profile switching capabilities
 */

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { StorageProvider } from '../providers/provider.js';
import type { ProfileManager } from '../providers/services/profile-manager.js';
import type { Profile } from '../providers/types/profile.js';

// ============================================================================
// Context Types
// ============================================================================

/**
 * Profile context value
 */
export interface ProfileContextValue {
  /** Current storage provider (undefined if no profile selected) */
  provider: StorageProvider | undefined;

  /** Current profile ID (unique identifier) */
  profileId: string | undefined;

  /** Current profile display name */
  profileName: string | undefined;

  /** Whether profile selector should be shown */
  isSelectingProfile: boolean;

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
// Context
// ============================================================================

const ProfileContext = createContext<ProfileContextValue | null>(null);

// ============================================================================
// Provider Props
// ============================================================================

export interface ProfileProviderProps {
  children: ReactNode;
  profileManager: ProfileManager;
  /** Optional handler when no profile is selected and the selector is closed */
  onExitWithoutProvider?: () => void;
}

// ============================================================================
// Provider Component
// ============================================================================

/**
 * ProfileProvider - Manages profile selection and provider lifecycle
 *
 * Always starts with profile selector visible.
 * Once a profile is selected, creates the provider.
 */
export function ProfileProvider({
  children,
  profileManager,
  onExitWithoutProvider,
}: ProfileProviderProps) {
  const [provider, setProvider] = useState<StorageProvider | undefined>(undefined);
  const [profileId, setProfileId] = useState<string | undefined>(undefined);
  const [profileName, setProfileName] = useState<string | undefined>(undefined);
  const [isSelectingProfile, setIsSelectingProfile] = useState(true);

  const selectProfile = useCallback(
    async (profile: Profile) => {
      try {
        const newProvider = await profileManager.createProviderFromProfile(profile.id);
        setProvider(newProvider);
        setProfileId(profile.id);
        setProfileName(profile.displayName);
        setIsSelectingProfile(false);
      } catch (err) {
        // Log error but stay on profile selector
        console.error('Failed to load profile', err);
      }
    },
    [profileManager]
  );

  const openProfileSelector = useCallback(() => {
    setIsSelectingProfile(true);
  }, []);

  const closeProfileSelector = useCallback(() => {
    // Only close if we have a provider to fall back to
    if (provider) {
      setIsSelectingProfile(false);
    } else if (onExitWithoutProvider) {
      onExitWithoutProvider();
    } else {
      // No provider available, exit the app by default
      process.exit(0);
    }
  }, [onExitWithoutProvider, provider]);

  const value: ProfileContextValue = {
    provider,
    profileId,
    profileName,
    isSelectingProfile,
    profileManager,
    selectProfile,
    openProfileSelector,
    closeProfileSelector,
  };

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to access profile context
 * @throws Error if used outside ProfileProvider
 */
export function useProfile(): ProfileContextValue {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}

/**
 * Hook to check if profile context is available
 */
export function useHasProfile(): boolean {
  return useContext(ProfileContext) !== null;
}
