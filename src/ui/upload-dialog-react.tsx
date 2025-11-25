/**
 * UploadDialog React component
 *
 * Interactive file upload dialog with file browser, selection, and queue management
 */

import { useState, useEffect, useCallback } from 'react';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import { useDialogKeyboard } from '../hooks/useDialogKeyboard.js';
import { LocalFileEntry, FileTypeFilter, listFiles, formatBytes } from '../utils/file-browser.js';
import { CatppuccinMocha } from './theme.js';
import { BaseDialog, getContentWidth } from './base-dialog-react.js';

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
 * UploadDialog React component with dynamic, flexible layout
 */
export function UploadDialog({ visible = true, onConfirm, onCancel }: UploadDialogProps) {
  const terminalSize = useTerminalSize();
  const [state, setState] = useState<DialogState>({
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
  const windowWidth = Math.min(80, terminalSize.width - 4);
  const windowHeight = Math.min(24, terminalSize.height - 4);

  // Load directory on mount or when path changes
  useEffect(() => {
    const loadDirectory = async () => {
      try {
        const result = await listFiles({
          currentPath: state.currentPath,
          filter: state.filter,
          searchPattern: state.searchPattern,
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
  }, [state.currentPath, state.filter, state.searchPattern]);

  // Handle keyboard input
  const handleKeyDown = useCallback(
    (key: string) => {
      // Estimate visible list height (rough, will work for dynamic sizing)
      const estimatedListHeight = Math.max(3, windowHeight - 7);

      switch (key) {
        case 'j':
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
          break;

        case 'k':
          // Move up with scrolling
          setState(prev => {
            const newIndex = Math.max(prev.selectedIndex - 1, 0);
            let newOffset = prev.scrollOffset;
            if (newIndex < prev.scrollOffset) {
              newOffset = newIndex;
            }
            return { ...prev, selectedIndex: newIndex, scrollOffset: newOffset };
          });
          break;

        case 'space':
          // Toggle selection
          if (state.selectedIndex < state.entries.length) {
            const entry = state.entries[state.selectedIndex];
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
          break;

        case 'l':
        case 'return':
          // On directory: navigate into it
          // On file: select it and confirm upload
          if (state.selectedIndex < state.entries.length) {
            const entry = state.entries[state.selectedIndex];
            if (entry.isDirectory) {
              setState(prev => ({
                ...prev,
                currentPath: entry.path,
              }));
            } else {
              // Select this file and confirm
              const filesToUpload = new Set(state.selectedFiles);
              filesToUpload.add(entry.path);
              onConfirm?.(Array.from(filesToUpload));
            }
          }
          break;

        case 'h':
        case 'backspace':
          // Go to parent directory
          const parentPath = state.currentPath.substring(0, state.currentPath.lastIndexOf('/'));
          if (parentPath) {
            setState(prev => ({
              ...prev,
              currentPath: parentPath || '/',
            }));
          }
          break;

        case 'escape':
          onCancel?.();
          break;
      }
    },
    [state, onConfirm, onCancel, windowHeight]
  );

  // Register keyboard handler with dialog system
  useDialogKeyboard('upload-dialog', handleKeyDown, visible);

  const selectedCount = state.selectedFiles.size;
  const totalSize = Array.from(state.selectedFiles).reduce((sum, path) => {
    const entry = state.entries.find(e => e.path === path);
    return sum + (entry?.size || 0);
  }, 0);

  const contentWidth = getContentWidth(windowWidth);

  return (
    <BaseDialog
      visible={visible}
      title="Upload Files"
      width={windowWidth}
      height={windowHeight}
      borderColor={CatppuccinMocha.blue}
      showOverlay={true}
    >
      {/* Path display */}
      <text fg={CatppuccinMocha.text} width={contentWidth}>
        📁 {state.currentPath.substring(0, contentWidth - 2)}
      </text>

      {/* File list - grows to fill available space */}
      <box flexDirection="column" overflow="hidden" marginTop={1} marginBottom={1}>
        {state.entries.length === 0 ? (
          <text fg={CatppuccinMocha.subtext0}>
            {state.error ? `Error: ${state.error}` : 'No files'}
          </text>
        ) : (
          // Show files based on scroll offset
          // Since we can't know exact height, just show a reasonable amount
          state.entries
            .slice(state.scrollOffset, state.scrollOffset + 15)
            .map((entry, visibleIndex) => {
              const actualIndex = state.scrollOffset + visibleIndex;
              const isSelected = actualIndex === state.selectedIndex;
              const isSelectedFile = state.selectedFiles.has(entry.path);
              const prefix = entry.isDirectory ? '📁' : '📄';
              const checkmark = isSelectedFile ? '✓' : ' ';
              const displayName = `${checkmark} ${prefix} ${entry.name}`;

              return (
                <text
                  key={entry.path}
                  fg={
                    isSelected
                      ? CatppuccinMocha.blue
                      : isSelectedFile
                        ? CatppuccinMocha.green
                        : CatppuccinMocha.text
                  }
                  bg={isSelected ? CatppuccinMocha.surface0 : undefined}
                  width={contentWidth}
                >
                  {displayName.substring(0, contentWidth)}
                </text>
              );
            })
        )}
      </box>

      {/* Selection summary */}
      {selectedCount > 0 && (
        <text fg={CatppuccinMocha.green} width={contentWidth}>
          {`Selected: ${selectedCount} files - ${formatBytes(totalSize)}`.substring(
            0,
            contentWidth
          )}
        </text>
      )}

      {/* Help text - matches app-wide keybinding format */}
      <text fg={CatppuccinMocha.overlay0} width={contentWidth}>
        {`j/k:nav  space:select  enter:confirm  h:back  ESC:cancel`.substring(0, contentWidth)}
      </text>
    </BaseDialog>
  );
}
