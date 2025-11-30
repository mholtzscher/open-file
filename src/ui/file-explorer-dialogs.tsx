/**
 * S3ExplorerDialogs - Dialog orchestration component
 *
 * Manages rendering of all dialog overlays (confirmation, help, error, upload, sort, progress).
 * This is a presentational component that receives state and callbacks from parent.
 */

import { ConfirmationDialog } from './dialog/confirmation.js';
import { HelpDialog } from './dialog/help.js';
import { ErrorDialog } from './dialog/error.js';
import { UploadDialog } from './dialog/upload.js';
import { SortMenu } from './dialog/sort.js';
import { ProgressWindow } from './progress-window.js';
import { QuitDialog } from './dialog/quit.js';
import { ProfileSelectorDialog } from './dialog/profile-selector.js';
import { ThemeSelectorDialog } from './dialog/theme-selector.js';
import { SortField, SortOrder } from '../utils/sorting.js';
import type { PendingOperation } from '../types/dialog.js';
import type { Profile } from '../providers/types/profile.js';
import type { ProfileManager } from '../providers/services/profile-manager.js';

/**
 * Props for individual dialog states
 */
export interface ConfirmDialogState {
  visible: boolean;
  operations: PendingOperation[];
  onConfirm: () => void;
  onCancel: () => void;
}

export interface ErrorDialogState {
  visible: boolean;
  message: string;
  onDismiss?: () => void;
}

export interface HelpDialogState {
  visible: boolean;
  onClose?: () => void;
}

export interface UploadDialogState {
  visible: boolean;
  destinationPath: string;
  onConfirm: (files: string[]) => void;
  onCancel: () => void;
}

export interface SortMenuState {
  visible: boolean;
  currentField: SortField;
  currentOrder: SortOrder;
  onFieldSelect: (field: SortField) => void;
  onOrderToggle: () => void;
  onClose: () => void;
}

export interface ProgressWindowState {
  visible: boolean;
  title: string;
  description: string;
  progress: number;
  currentFile: string;
  currentFileNumber: number;
  totalFiles: number;
  canCancel: boolean;
  onCancel: () => void;
}

export interface QuitDialogState {
  visible: boolean;
  pendingChanges: number;
  onQuitWithoutSave: () => void;
  onSaveAndQuit: () => void;
  onCancel: () => void;
}

export interface ProfileSelectorDialogState {
  visible: boolean;
  profileManager?: ProfileManager;
  currentProfileId?: string;
  onProfileSelect: (profile: Profile) => void;
  onCancel: () => void;
}

export interface ThemeSelectorDialogState {
  visible: boolean;
  onClose: () => void;
}

/**
 * Combined dialog state for all dialogs
 */
export interface DialogsState {
  confirm: ConfirmDialogState;
  error: ErrorDialogState;
  help: HelpDialogState;
  upload: UploadDialogState;
  sortMenu: SortMenuState;
  progress: ProgressWindowState;
  quit: QuitDialogState;
  profileSelector: ProfileSelectorDialogState;
  themeSelector: ThemeSelectorDialogState;
}

interface FileExplorerDialogsProps {
  dialogs: DialogsState;
}

/**
 * Dialog orchestration component
 *
 * Renders all dialog overlays based on their visibility state.
 * Dialogs are rendered in a specific order to ensure proper z-index stacking.
 */
export function FileExplorerDialogs({ dialogs }: FileExplorerDialogsProps) {
  const { confirm, error, help, upload, sortMenu, progress, quit, profileSelector, themeSelector } =
    dialogs;

  return (
    <>
      {/* Error Dialog - shows when there's an error */}
      <ErrorDialog visible={error.visible} message={error.message} onDismiss={error.onDismiss} />

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        title="Confirm Operations"
        operations={confirm.operations}
        visible={confirm.visible}
        onConfirm={confirm.onConfirm}
        onCancel={confirm.onCancel}
      />

      {/* Sort Menu Dialog */}
      <SortMenu
        visible={sortMenu.visible}
        currentField={sortMenu.currentField}
        currentOrder={sortMenu.currentOrder}
        onFieldSelect={sortMenu.onFieldSelect}
        onOrderToggle={sortMenu.onOrderToggle}
        onClose={sortMenu.onClose}
      />

      {/* Help Dialog */}
      <HelpDialog visible={help.visible} onClose={help.onClose} />

      {/* Upload Dialog */}
      <UploadDialog
        visible={upload.visible}
        destinationPath={upload.destinationPath}
        onConfirm={upload.onConfirm}
        onCancel={upload.onCancel}
      />

      {/* Progress Window */}
      <ProgressWindow
        visible={progress.visible}
        title={progress.title}
        description={progress.description}
        progress={progress.progress}
        currentFile={progress.currentFile}
        currentFileNumber={progress.currentFileNumber}
        totalFiles={progress.totalFiles}
        onCancel={progress.onCancel}
        canCancel={progress.canCancel}
      />

      {/* Quit Confirmation Dialog */}
      <QuitDialog
        visible={quit.visible}
        pendingChangesCount={quit.pendingChanges}
        onQuitWithoutSave={quit.onQuitWithoutSave}
        onSaveAndQuit={quit.onSaveAndQuit}
        onCancel={quit.onCancel}
      />

      {/* Profile Selector Dialog */}
      <ProfileSelectorDialog
        visible={profileSelector.visible}
        profileManager={profileSelector.profileManager}
        currentProfileId={profileSelector.currentProfileId}
        onProfileSelect={profileSelector.onProfileSelect}
        onCancel={profileSelector.onCancel}
      />

      {/* Theme Selector Dialog */}
      <ThemeSelectorDialog visible={themeSelector.visible} onClose={themeSelector.onClose} />
    </>
  );
}
