/**
 * App - Outermost application wrapper
 *
 * Provides the context hierarchy:
 * - KeyboardProvider (keyboard event handling)
 * - ProfileProvider (profile selection and provider lifecycle)
 * - StorageContextProvider (storage operations, when profile is selected)
 */

import { Show } from 'solid-js';
import { useKeyboard } from '@opentui/solid';
import { FileExplorer } from './file-explorer.js';
import { ProfileSelectorDialog } from './dialog/profile-selector.js';
import {
  KeyboardProvider,
  useKeyboard as useKeyboardContext,
} from '../contexts/KeyboardContext.js';
import { ProfileProvider, useProfile } from '../contexts/ProfileContext.js';
import { StorageContextProvider } from '../contexts/StorageContextProvider.js';
import { ThemeProvider } from '../contexts/ThemeContext.js';
import type { ProfileManager } from '../providers/services/profile-manager.js';
import type { KeyboardKey } from '../types/keyboard.js';

// ============================================================================
// App Props
// ============================================================================

/**
 * Props for the App component
 */
export interface AppProps {
  profileManager: ProfileManager;
  /** Optional handler when profile selection is cancelled without an active provider */
  onExitWithoutProvider?: () => void;
  /** Optional handler to edit profiles in external editor (called from profile selector) */
  onEditProfiles?: () => Promise<void>;
}

// ============================================================================
// Keyboard Bridge Component
// ============================================================================

/**
 * Bridges OpenTUI's useKeyboard to our KeyboardContext
 * This component sits inside KeyboardProvider and forwards key events
 */
function KeyboardBridge() {
  const { dispatch } = useKeyboardContext();

  // Use OpenTUI's useKeyboard to receive key events
  useKeyboard(event => {
    // Normalize key name
    let keyName = event.name || 'unknown';
    if (keyName === 'enter') {
      keyName = 'return';
    }

    // Use sequence for character input (single printable chars)
    let char: string | undefined;
    if (event.sequence && event.sequence.length === 1) {
      const code = event.sequence.charCodeAt(0);
      if (code >= 32 && code <= 126) {
        char = event.sequence;
      }
    }
    // Also derive from key name for single char keys
    if (!char && keyName.length === 1) {
      char = keyName;
    }

    // Create normalized key object
    const normalizedKey: KeyboardKey = {
      name: keyName,
      ctrl: event.ctrl || false,
      shift: event.shift || false,
      meta: event.meta || false,
      char: char,
    };

    dispatch(normalizedKey);
  });

  return null;
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
function AppContent(props: AppContentProps) {
  const profile = useProfile();

  // Show profile selector if selecting or no provider
  // Note: In Solid, signals are functions - call them to get values
  return (
    <Show
      when={!profile.isSelectingProfile() && profile.provider()}
      fallback={
        <ProfileSelectorDialog
          visible={true}
          profileManager={profile.profileManager}
          currentProfileId={profile.profileId()}
          onProfileSelect={profile.selectProfile}
          onCancel={profile.closeProfileSelector}
          onEditProfiles={props.onEditProfiles}
        />
      }
    >
      <StorageContextProvider
        provider={profile.provider()!}
        profileManager={profile.profileManager}
        profileId={profile.profileId()}
        profileName={profile.profileName()}
      >
        <FileExplorer />
      </StorageContextProvider>
    </Show>
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
export function App(props: AppProps) {
  return (
    <ThemeProvider>
      <KeyboardProvider>
        <KeyboardBridge />
        <ProfileProvider
          profileManager={props.profileManager}
          onExitWithoutProvider={props.onExitWithoutProvider}
        >
          <AppContent onEditProfiles={props.onEditProfiles} />
        </ProfileProvider>
      </KeyboardProvider>
    </ThemeProvider>
  );
}
