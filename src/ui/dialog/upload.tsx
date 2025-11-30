/**
 * UploadDialog SolidJS component
 *
 * Interactive file upload dialog with file browser, selection, and queue management
 */

import { createSignal, createEffect, For, Show } from 'solid-js';
import { useTerminalSize } from '../../hooks/useTerminalSize.js';
import { useKeyboardHandler, KeyboardPriority } from '../../contexts/KeyboardContext.js';
import {
  LocalFileEntry,
  FileTypeFilter,
  listFiles,
  formatBytes,
} from '../../utils/file-browser.js';
import { Theme } from '../theme.js';
import { BaseDialog, getContentWidth } from './base.js';
import { HelpBar } from '../help-bar.js';
import type { KeyboardKey } from '../../types/keyboard.js';

export interface UploadDialogProps {
  visible?: boolean;
  destinationPath?: string;
  onConfirm?: (selectedFiles: string[]) => void;
  onCancel?: () => void;
}

/**
 * Upload dialog state
 */
interface DialogState {
  currentPath: string;
  entries: LocalFileEntry[];
  selectedIndex: number;
  scrollOffset: number;
  selectedFiles: Set<string>;
  filter: FileTypeFilter;
  searchPattern: string;
  isSearchMode: boolean;
  error?: string;
}

/**
 * UploadDialog SolidJS component with dynamic, flexible layout
 */
export function UploadDialog(props: UploadDialogProps) {
  const terminalSize = useTerminalSize();
  const visible = () => props.visible ?? true;

  const [state, setState] = createSignal<DialogState>({
    currentPath: process.cwd(),
    entries: [],
    selectedIndex: 0,
    scrollOffset: 0,
    selectedFiles: new Set(),
    filter: FileTypeFilter.All,
    searchPattern: '',
    isSearchMode: false,
  });

  // Use most of the available space, but leave room for margins
  // terminalSize has getters, so access properties directly
  const windowWidth = () => Math.min(80, terminalSize.width - 4);
  const windowHeight = () => Math.min(24, terminalSize.height - 4);

  // Load directory on mount or when path changes
  createEffect(() => {
    const currentState = state();
    const loadDirectory = async () => {
      try {
        const result = await listFiles({
          currentPath: currentState.currentPath,
          filter: currentState.filter,
          searchPattern: currentState.searchPattern,
        });
        setState(prev => ({
          ...prev,
          entries: result.entries,
          selectedIndex: 0,
          error: undefined,
        }));
      } catch (err) {
        setState(prev => ({
          ...prev,
          error: `Failed to load directory: ${(err as Error).message}`,
        }));
      }
    };

    loadDirectory();
  });

  const handleKey = (key: KeyboardKey) => {
    if (!visible()) return false;

    // Estimate visible list height (rough, will work for dynamic sizing)
    const estimatedListHeight = Math.max(3, windowHeight() - 7);

    switch (key.name) {
      case 'j': {
        // Move down with scrolling
        setState(prev => {
          const newIndex = Math.min(prev.selectedIndex + 1, prev.entries.length - 1);
          let newOffset = prev.scrollOffset;
          if (newIndex >= prev.scrollOffset + estimatedListHeight - 1) {
            newOffset = Math.min(
              newIndex - estimatedListHeight + 2,
              prev.entries.length - estimatedListHeight
            );
          }
          return { ...prev, selectedIndex: newIndex, scrollOffset: Math.max(0, newOffset) };
        });
        return true;
      }

      case 'k': {
        // Move up with scrolling
        setState(prev => {
          const newIndex = Math.max(prev.selectedIndex - 1, 0);
          let newOffset = prev.scrollOffset;
          if (newIndex < prev.scrollOffset) {
            newOffset = newIndex;
          }
          return { ...prev, selectedIndex: newIndex, scrollOffset: newOffset };
        });
        return true;
      }

      case 'space': {
        // Toggle selection
        const currentState = state();
        if (currentState.selectedIndex < currentState.entries.length) {
          const entry = currentState.entries[currentState.selectedIndex];
          setState(prev => {
            const newSelected = new Set(prev.selectedFiles);
            if (newSelected.has(entry.path)) {
              newSelected.delete(entry.path);
            } else {
              newSelected.add(entry.path);
            }
            return { ...prev, selectedFiles: newSelected };
          });
        }
        return true;
      }

      case 'l':
      case 'return':
      case 'enter': {
        // On directory: navigate into it
        // On file: select it and confirm upload
        const currentState = state();
        if (currentState.selectedIndex < currentState.entries.length) {
          const entry = currentState.entries[currentState.selectedIndex];
          if (entry.isDirectory) {
            setState(prev => ({
              ...prev,
              currentPath: entry.path,
            }));
          } else {
            // Select this file and confirm
            const filesToUpload = new Set(currentState.selectedFiles);
            filesToUpload.add(entry.path);
            props.onConfirm?.(Array.from(filesToUpload));
          }
        }
        return true;
      }

      case 'h':
      case 'backspace': {
        // Go to parent directory
        const currentPath = state().currentPath;
        const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/'));
        if (parentPath) {
          setState(prev => ({
            ...prev,
            currentPath: parentPath || '/',
          }));
        }
        return true;
      }

      case 'escape': {
        props.onCancel?.();
        return true;
      }

      default:
        return true; // Block all other keys when upload dialog is open
    }
  };

  useKeyboardHandler(handleKey, KeyboardPriority.High);

  const selectedCount = () => state().selectedFiles.size;
  const totalSize = () =>
    Array.from(state().selectedFiles).reduce((sum, path) => {
      const entry = state().entries.find(e => e.path === path);
      return sum + (entry?.size || 0);
    }, 0);

  const contentWidth = () => getContentWidth(windowWidth());

  const visibleEntries = () =>
    state().entries.slice(state().scrollOffset, state().scrollOffset + 15);

  return (
    <BaseDialog
      visible={visible()}
      title="Upload Files"
      width={windowWidth()}
      height={windowHeight()}
      borderColor={Theme.getInfoColor()}
    >
      {/* Path display */}
      <text fg={Theme.getTextColor()}>
        {'📁 '}
        {state().currentPath}
      </text>

      {/* File list - grows to fill available space */}
      <box flexDirection="column" overflow="hidden" marginTop={1} marginBottom={1}>
        <Show
          when={state().entries.length > 0}
          fallback={
            <text fg={Theme.getMutedColor()}>
              {state().error ? `Error: ${state().error}` : 'No files'}
            </text>
          }
        >
          <For each={visibleEntries()}>
            {(entry, visibleIndex) => {
              const actualIndex = () => state().scrollOffset + visibleIndex();
              const isSelected = () => actualIndex() === state().selectedIndex;
              const isSelectedFile = () => state().selectedFiles.has(entry.path);
              const prefix = entry.isDirectory ? '📁' : '📄';
              const checkmark = () => (isSelectedFile() ? '✓' : ' ');
              const displayName = () => `${checkmark()} ${prefix} ${entry.name}`;

              return (
                <text
                  fg={
                    isSelected()
                      ? Theme.getInfoColor()
                      : isSelectedFile()
                        ? Theme.getSuccessColor()
                        : Theme.getTextColor()
                  }
                  bg={isSelected() ? Theme.getBgSurface() : undefined}
                  width={contentWidth()}
                >
                  {displayName()}
                </text>
              );
            }}
          </For>
        </Show>
      </box>

      {/* Selection summary */}
      <Show when={selectedCount() > 0}>
        <text fg={Theme.getSuccessColor()} width={contentWidth()}>
          {`Selected: ${selectedCount()} files - ${formatBytes(totalSize())}`}
        </text>
      </Show>

      {/* Help text */}
      <HelpBar
        items={[
          { key: 'j/k', description: 'nav' },
          { key: 'Space', description: 'select' },
          { key: 'Enter', description: 'confirm' },
          { key: 'h', description: 'back' },
          { key: 'Esc', description: 'cancel' },
        ]}
      />
    </BaseDialog>
  );
}
