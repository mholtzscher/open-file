/**
 * UploadDialog React component
 *
 * Interactive file upload dialog with file browser, selection, and queue management
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import { useDialogKeyboard } from '../hooks/useDialogKeyboard.js';
import { LocalFileEntry, FileTypeFilter, listFiles, formatBytes } from '../utils/file-browser.js';
import { CatppuccinMocha } from './theme.js';

export interface UploadDialogProps {
  visible?: boolean;
  destinationPath?: string;
  onConfirm?: (selectedFiles: string[]) => void;
  onCancel?: () => void;
  onKeyDown?: (key: string) => void;
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
 * UploadDialog React component
 */
export function UploadDialog({
  visible = true,
  destinationPath = '',
  onConfirm,
  onCancel,
  onKeyDown,
}: UploadDialogProps) {
  if (!visible) return null;

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

  const windowWidth = Math.min(80, terminalSize.width - 4);
  const maxHeight = Math.max(10, terminalSize.height - 8);
  const windowHeight = Math.min(24, maxHeight);
  const centerLeft = Math.floor((terminalSize.width - windowWidth) / 2);
  const centerTop = Math.max(2, Math.floor((terminalSize.height - windowHeight) / 2));

  // Calculate available space for file list
  // Account for: title(1) + path(1) + top padding(1) + selection info(1) + help text(1) + bottom padding(1) = 6 lines minimum
  const headerHeight = 4; // title + path + margins
  const footerHeight = 3; // selection info + help text + margins
  const listHeight = Math.max(3, windowHeight - headerHeight - footerHeight);

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
      switch (key) {
        case 'j':
          // Move down with scrolling
          setState(prev => {
            const newIndex = Math.min(prev.selectedIndex + 1, prev.entries.length - 1);
            let newOffset = prev.scrollOffset;
            // Scroll down if selected item is near bottom
            if (newIndex >= prev.scrollOffset + listHeight - 1) {
              newOffset = Math.min(newIndex - listHeight + 2, prev.entries.length - listHeight);
            }
            return { ...prev, selectedIndex: newIndex, scrollOffset: Math.max(0, newOffset) };
          });
          break;

        case 'k':
          // Move up with scrolling
          setState(prev => {
            const newIndex = Math.max(prev.selectedIndex - 1, 0);
            let newOffset = prev.scrollOffset;
            // Scroll up if selected item is near top
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

        case 'return':
          // Navigate into directory or select file
          if (state.selectedIndex < state.entries.length) {
            const entry = state.entries[state.selectedIndex];
            if (entry.isDirectory) {
              setState(prev => ({
                ...prev,
                currentPath: entry.path,
              }));
            }
          }
          break;

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

        case 'c':
          // Confirm selection
          if (state.selectedFiles.size > 0) {
            onConfirm?.(Array.from(state.selectedFiles));
          }
          break;
      }
    },
    [state, onConfirm, onCancel]
  );

  // Register keyboard handler with dialog system
  useDialogKeyboard('upload-dialog', handleKeyDown, visible);

  const selectedEntry = state.entries[state.selectedIndex];
  const selectedCount = state.selectedFiles.size;
  const totalSize = Array.from(state.selectedFiles).reduce((sum, path) => {
    const entry = state.entries.find(e => e.path === path);
    return sum + (entry?.size || 0);
  }, 0);

  return (
    <>
      {/* Background overlay */}
      <box
        position="absolute"
        left={centerLeft}
        top={centerTop}
        width={windowWidth}
        height={windowHeight}
        backgroundColor={CatppuccinMocha.base}
        zIndex={999}
      />

      {/* Dialog window */}
      <box
        position="absolute"
        left={centerLeft}
        top={centerTop}
        width={windowWidth}
        height={windowHeight}
        borderStyle="rounded"
        borderColor={CatppuccinMocha.blue}
        title="Upload Files"
        flexDirection="column"
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
        zIndex={1000}
      >
        {/* Path display */}
        <text fg={CatppuccinMocha.text} width={Math.max(20, windowWidth - 6)}>
          📁 {state.currentPath}
        </text>

        {/* File list - scrollable */}
        <box
          flexDirection="column"
          height={listHeight}
          overflow="hidden"
          marginTop={1}
          marginBottom={1}
        >
          {state.entries.length === 0 ? (
            <text fg={CatppuccinMocha.subtext0}>
              {state.error ? `Error: ${state.error}` : 'No files'}
            </text>
          ) : (
            state.entries
              .slice(state.scrollOffset, state.scrollOffset + listHeight)
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
                    width={Math.max(20, windowWidth - 6)}
                  >
                    {displayName.substring(0, Math.max(20, windowWidth - 6))}
                  </text>
                );
              })
          )}
        </box>

        {/* Footer - selection info and help text in fixed box */}
        <box flexDirection="column" height={2} overflow="hidden">
          {/* Selection info */}
          {selectedCount > 0 && (
            <text fg={CatppuccinMocha.green} width={Math.max(20, windowWidth - 6)}>
              {`Selected: ${selectedCount} files - ${formatBytes(totalSize)}`.substring(
                0,
                Math.max(20, windowWidth - 6)
              )}
            </text>
          )}

          {/* Help text - compact and single line */}
          <text fg={CatppuccinMocha.overlay0} width={Math.max(20, windowWidth - 6)}>
            {`j/k↕ space☑ enter→ c✓ esc✕`.substring(0, Math.max(20, windowWidth - 6))}
          </text>
        </box>
      </box>
    </>
  );
}
