/**
 * App - Outermost application wrapper
 *
 * Provides the context hierarchy:
 * - KeyboardProvider (keyboard event handling)
 * - ProfileProvider (profile selection and provider lifecycle)
 * - StorageContextProvider (storage operations, when profile is selected)
 */

import { FileExplorer } from './file-explorer.js';
import { ProfileSelectorDialog } from './dialog/profile-selector.js';
import { KeyboardProvider } from '../contexts/KeyboardContext.js';
import { ProfileProvider, useProfile } from '../contexts/ProfileContext.js';
import { StorageContextProvider } from '../contexts/StorageContextProvider.js';
import { ThemeProvider } from '../contexts/ThemeContext.js';
import type { ProfileManager } from '../providers/services/profile-manager.js';
import type { KeyboardDispatcher } from '../types/keyboard.js';

// ============================================================================
// App Props
// ============================================================================

/**
 * Props for the App component
 */
export interface AppProps {
  profileManager: ProfileManager;
  onDispatchReady?: (dispatch: KeyboardDispatcher | null) => void;
  /** Optional handler when profile selection is cancelled without an active provider */
  onExitWithoutProvider?: () => void;
  /** Optional handler to edit profiles in external editor (called from profile selector) */
  onEditProfiles?: () => Promise<void>;
}

// ============================================================================
// Inner Components
// ============================================================================

/**
 * Props for AppContent
 */
interface AppContentProps {
  /** Handler to edit profiles in external editor */
  onEditProfiles?: () => Promise<void>;
}

/**
 * AppContent - Renders profile selector or main content based on profile state
 */
function AppContent({ onEditProfiles }: AppContentProps) {
  const {
    provider,
    profileId,
    profileName,
    profileManager,
    isSelectingProfile,
    selectProfile,
    closeProfileSelector,
  } = useProfile();

  // Show profile selector if selecting or no provider
  if (isSelectingProfile || !provider) {
    return (
      <ProfileSelectorDialog
        visible={true}
        profileManager={profileManager}
        currentProfileId={profileId}
        onProfileSelect={selectProfile}
        onCancel={closeProfileSelector}
        onEditProfiles={onEditProfiles}
      />
    );
  }

  // Render main content with storage context
  return (
    <StorageContextProvider
      provider={provider}
      profileManager={profileManager}
      profileId={profileId}
      profileName={profileName}
    >
      <FileExplorer />
    </StorageContextProvider>
  );
}

// ============================================================================
// App Component
// ============================================================================

/**
 * App - Outermost application wrapper
 *
 * Provides all contexts and renders the appropriate content.
 */
export function App({
  profileManager,
  onDispatchReady,
  onExitWithoutProvider,
  onEditProfiles,
}: AppProps) {
  return (
    <ThemeProvider>
      <KeyboardProvider onDispatchReady={onDispatchReady}>
        <ProfileProvider
          profileManager={profileManager}
          onExitWithoutProvider={onExitWithoutProvider}
        >
          <AppContent onEditProfiles={onEditProfiles} />
        </ProfileProvider>
      </KeyboardProvider>
    </ThemeProvider>
  );
}
