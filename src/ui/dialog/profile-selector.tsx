/**
 * ProfileSelectorDialog SolidJS component
 *
 * Interactive dialog for selecting and switching between storage provider profiles.
 */

import { createSignal, createEffect, For, Switch, Match } from 'solid-js';
import { useKeyboard } from '@opentui/solid';
import { Theme } from '../theme.js';
import { ProviderIndicator } from '../provider-indicator.js';
import { BaseDialog } from './base.js';
import { HelpBar } from '../help-bar.js';
import type { Profile } from '../../providers/types/profile.js';
import type { ProfileManager } from '../../providers/services/profile-manager.js';

export interface ProfileSelectorDialogProps {
  visible: boolean;
  profileManager: ProfileManager | undefined;
  currentProfileId?: string;
  onProfileSelect: (profile: Profile) => Promise<void> | void;
  onCancel: () => void;
  onEditProfiles?: () => Promise<void>;
}

export function ProfileSelectorDialog(props: ProfileSelectorDialogProps) {
  const [profiles, setProfiles] = createSignal<Profile[]>([]);
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [isLoading, setIsLoading] = createSignal(true);
  const [isSwitching, setIsSwitching] = createSignal(false);
  const [error, setError] = createSignal<string | undefined>();
  let prevVisible = false;
  let hasSetInitialSelection = false;

  // Reset selection to current profile when dialog opens
  createEffect(() => {
    const wasHidden = !prevVisible;
    prevVisible = props.visible;

    if (!props.visible) {
      hasSetInitialSelection = false;
      return;
    }

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

    if (!props.profileManager) {
      setIsLoading(false);
      setProfiles([]);
      setError('Profile manager is not available');
      return;
    }

    const profileManager = props.profileManager;

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
  });

  // Keyboard handling using OpenTUI's useKeyboard directly
  useKeyboard(evt => {
    if (!props.visible || isSwitching()) return;

    const keyName = evt.name;

    // Only allow escape in error/loading/empty states
    if (isLoading() || error() || profiles().length === 0) {
      if (keyName === 'escape') {
        props.onCancel();
      }
      return;
    }

    switch (keyName) {
      case 'j':
      case 'down':
        setSelectedIndex(prev => Math.min(prev + 1, profiles().length - 1));
        break;

      case 'k':
      case 'up':
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;

      case 'g':
        setSelectedIndex(0);
        break;

      case 'G':
        setSelectedIndex(profiles().length - 1);
        break;

      case 'return':
      case 'enter':
        if (selectedIndex() >= 0 && selectedIndex() < profiles().length) {
          const selectedProfile = profiles()[selectedIndex()];
          setIsSwitching(true);

          // Add timeout to detect hangs
          const timeoutId = setTimeout(() => {
            process.stderr.write(
              '[PROFILE-SELECTOR] WARNING: Profile switch taking longer than 10 seconds\n'
            );
          }, 10000);

          const result = props.onProfileSelect(selectedProfile);
          // Handle both sync and async onProfileSelect
          if (result && typeof result.then === 'function') {
            result
              .then(() => {
                clearTimeout(timeoutId);
                process.stderr.write('[PROFILE-SELECTOR] onProfileSelect resolved successfully\n');
                // Close dialog on success
                props.onCancel();
              })
              .catch(err => {
                clearTimeout(timeoutId);
                process.stderr.write(
                  `[PROFILE-SELECTOR] onProfileSelect rejected with error: ${err}\n`
                );
                // Also close dialog on error (error message is shown in status bar)
                props.onCancel();
              })
              .finally(() => {
                process.stderr.write('[PROFILE-SELECTOR] Setting isSwitching to false\n');
                setIsSwitching(false);
              });
          } else {
            clearTimeout(timeoutId);
            setIsSwitching(false);
            // Close dialog immediately for sync operations
            props.onCancel();
          }
        }
        break;

      case 'e':
        if (props.onEditProfiles) {
          props.onEditProfiles();
        }
        break;

      case 'escape':
        props.onCancel();
        break;
    }
  });

  // Derive dialog state for Switch/Match
  type DialogState = 'hidden' | 'loading' | 'switching' | 'error' | 'empty' | 'ready';
  const dialogState = (): DialogState => {
    if (!props.visible) return 'hidden';
    if (isSwitching()) return 'switching';
    if (isLoading()) return 'loading';
    if (error()) return 'error';
    if (profiles().length === 0) return 'empty';
    return 'ready';
  };

  return (
    <Switch>
      <Match when={dialogState() === 'hidden'}>{null}</Match>

      <Match when={dialogState() === 'loading'}>
        <BaseDialog visible={true} title="Select Profile" borderColor={Theme.getInfoColor()}>
          <text fg={Theme.getDimColor()}>Loading profiles...</text>
        </BaseDialog>
      </Match>

      <Match when={dialogState() === 'switching'}>
        <BaseDialog visible={true} title="Select Profile" borderColor={Theme.getInfoColor()}>
          <text fg={Theme.getInfoColor()}>Switching profile...</text>
        </BaseDialog>
      </Match>

      <Match when={dialogState() === 'error'}>
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
      </Match>

      <Match when={dialogState() === 'empty'}>
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
      </Match>

      <Match when={dialogState() === 'ready'}>
        <BaseDialog visible={true} title="Select Profile" borderColor={Theme.getInfoColor()}>
          <For each={profiles()}>
            {(profile, index) => {
              const isSelected = () => index() === selectedIndex();
              const isCurrent = () => profile.id === props.currentProfileId;
              const selectionChar = () => (isSelected() ? '>' : ' ');
              const currentChar = () => (isCurrent() ? '●' : '○');
              const prefix = () => `${selectionChar()} ${currentChar()} ${profile.displayName} `;
              const textColor = () => (isCurrent() ? Theme.getTextColor() : Theme.getMutedColor());

              return (
                <box flexDirection="row">
                  <text fg={textColor()}>{prefix()}</text>
                  <ProviderIndicator providerType={profile.provider} />
                </box>
              );
            }}
          </For>

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
      </Match>
    </Switch>
  );
}
