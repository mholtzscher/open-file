/**
 * App - Root component with context provider hierarchy
 */

import { Show } from 'solid-js';
import { FileExplorerNew } from './file-explorer-new.js';
import { ProfileSelectorDialog } from './dialog/profile-selector.js';
import { ProfileProvider, useProfile } from '../contexts/ProfileContext.js';
import { StorageContextProvider } from '../contexts/StorageContextProvider.js';
import { ThemeProvider } from '../contexts/ThemeContext.js';
import { DialogProvider } from '../contexts/DialogContext.js';
import { SyncProvider } from '../contexts/sync.js';
import { LocalProvider } from '../contexts/local.js';
import { KeybindProvider } from '../contexts/keybind.js';
import type { ProfileManager } from '../providers/services/profile-manager.js';

export interface AppProps {
  profileManager: ProfileManager;
  onExitWithoutProvider?: () => void;
  onEditProfiles?: () => Promise<void>;
}

export function App(props: AppProps) {
  return (
    <ThemeProvider>
      <DialogProvider>
        <ProfileProvider
          profileManager={props.profileManager}
          onExitWithoutProvider={props.onExitWithoutProvider}
        >
          <AppContent onEditProfiles={props.onEditProfiles} />
        </ProfileProvider>
      </DialogProvider>
    </ThemeProvider>
  );
}

/** Inner component that uses ProfileContext */
function AppContent(props: { onEditProfiles?: () => Promise<void> }) {
  const profile = useProfile();

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
        <SyncProvider>
          <LocalProvider>
            <KeybindProvider>
              <FileExplorerNew />
            </KeybindProvider>
          </LocalProvider>
        </SyncProvider>
      </StorageContextProvider>
    </Show>
  );
}
