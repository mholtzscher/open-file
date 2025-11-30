/**
 * usePreview Hook
 *
 * Manages file preview state and loading using StorageContext.
 * Provides a unified way to preview files.
 *
 * Features:
 * - Automatic file size checking
 * - Previewable file type detection
 * - Error handling
 * - Loading state management
 */

import { createSignal, createEffect, on } from 'solid-js';
import { useStorage } from '../contexts/StorageContextProvider.js';
import { Entry, EntryType } from '../types/entry.js';
import { formatBytes } from '../utils/file-browser.js';

// ============================================================================
// Types
// ============================================================================

export interface PreviewOptions {
  /** Maximum file size to preview (in bytes) */
  maxSize?: number;

  /** Whether preview is enabled */
  enabled?: boolean;
}

export interface PreviewState {
  /** Preview content (text) */
  content: string | null;

  /** Filename being previewed */
  filename: string;

  /** Whether preview is currently loading */
  isLoading: boolean;

  /** Error message if preview failed */
  error: string | null;

  /** Whether the file is previewable */
  isPreviewable: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Determine if a file should be previewed based on its extension or name
 */
function isPreviewableFile(entry: Entry | undefined): boolean {
  if (!entry || entry.type !== EntryType.File) return false;

  const name = entry.name.toLowerCase();

  // Common extensionless text files (exact matches)
  const extensionlessTextFiles = [
    'dockerfile',
    'makefile',
    'gnumakefile',
    'rakefile',
    'gemfile',
    'procfile',
    'brewfile',
    'vagrantfile',
    'jenkinsfile',
    'justfile',
    'license',
    'licence',
    'readme',
    'authors',
    'contributors',
    'changelog',
    'changes',
    'history',
    'news',
    'todo',
    'copying',
    'install',
    'cmakelists.txt', // Special case: has extension but commonly searched without
  ];

  // Dotfiles that are text (exact matches)
  const textDotfiles = [
    '.gitignore',
    '.gitattributes',
    '.gitmodules',
    '.gitconfig',
    '.npmignore',
    '.npmrc',
    '.nvmrc',
    '.yarnrc',
    '.editorconfig',
    '.prettierrc',
    '.prettierignore',
    '.eslintrc',
    '.eslintignore',
    '.babelrc',
    '.env',
    '.env.local',
    '.env.development',
    '.env.production',
    '.env.test',
    '.env.example',
    '.dockerignore',
    '.hgignore',
    '.mailmap',
    '.htaccess',
    '.htpasswd',
    '.profile',
    '.bashrc',
    '.bash_profile',
    '.zshrc',
    '.zprofile',
    '.vimrc',
    '.inputrc',
  ];

  // Check exact matches for extensionless files
  if (extensionlessTextFiles.includes(name)) return true;

  // Check exact matches for dotfiles
  if (textDotfiles.includes(name)) return true;

  // Check file extensions
  const textExtensions = [
    '.txt',
    '.md',
    '.json',
    '.yaml',
    '.yml',
    '.toml',
    '.xml',
    '.csv',
    '.log',
    '.js',
    '.ts',
    '.tsx',
    '.jsx',
    '.py',
    '.rb',
    '.go',
    '.rs',
    '.c',
    '.cpp',
    '.h',
    '.java',
    '.sh',
    '.bash',
    '.zsh',
    '.sql',
    '.html',
    '.css',
    '.scss',
    '.sass',
    '.less',
    '.php',
    '.swift',
    '.kt',
    '.kts',
    '.ini',
    '.conf',
    '.cfg',
    '.properties',
  ];

  return textExtensions.some(ext => name.endsWith(ext));
}

// ============================================================================
// Hook (StorageContext Version)
// ============================================================================

/**
 * Use file preview with StorageContext
 *
 * This hook manages preview state and automatically loads preview
 * when the selected entry changes.
 *
 * @example
 * ```tsx
 * function FileExplorer({ currentPath, selectedEntry }) {
 *   const preview = usePreview(currentPath, selectedEntry, {
 *     enabled: isPreviewMode,
 *     maxSize: 100 * 1024, // 100KB
 *   });
 *
 *   return (
 *     <div>
 *       {preview().isLoading && <div>Loading preview...</div>}
 *       {preview().error && <div>Error: {preview().error}</div>}
 *       {preview().content && <PreviewPane content={preview().content} filename={preview().filename} />}
 *     </div>
 *   );
 * }
 * ```
 */
export function usePreview(
  currentPath: () => string,
  selectedEntry: () => Entry | undefined,
  options: PreviewOptions = {}
): () => PreviewState {
  const maxSize = options.maxSize ?? 100 * 1024;
  const enabled = options.enabled ?? true;

  const storage = useStorage();

  const [state, setState] = createSignal<PreviewState>({
    content: null,
    filename: '',
    isLoading: false,
    error: null,
    isPreviewable: false,
  });

  const loadPreview = async () => {
    // Early exit if preview is disabled
    if (!enabled) {
      setState({
        content: null,
        filename: '',
        isLoading: false,
        error: null,
        isPreviewable: false,
      });
      return;
    }

    const entry = selectedEntry();

    // Early exit if no entry selected
    if (!entry) {
      setState({
        content: null,
        filename: '',
        isLoading: false,
        error: null,
        isPreviewable: false,
      });
      return;
    }

    // Check if file is previewable
    if (!isPreviewableFile(entry)) {
      setState({
        content: null,
        filename: '',
        isLoading: false,
        error: null,
        isPreviewable: false,
      });
      return;
    }

    // Check file size
    if (entry.size && entry.size > maxSize) {
      setState({
        content: `File too large to preview (${formatBytes(entry.size)})`,
        filename: entry.name,
        isLoading: false,
        error: null,
        isPreviewable: true,
      });
      return;
    }

    // File is previewable, start loading
    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
      isPreviewable: true,
      filename: entry.name,
    }));

    try {
      // Construct full path - ensure proper path separator
      const path = currentPath();
      const separator = path && !path.endsWith('/') ? '/' : '';
      const fullPath = path ? `${path}${separator}${entry.name}` : entry.name;

      // Read file content using storage context
      const buffer = await storage.read(fullPath);
      const content = buffer.toString('utf-8');

      setState({
        content,
        filename: entry.name,
        isLoading: false,
        error: null,
        isPreviewable: true,
      });
    } catch (err) {
      console.error('Failed to load preview:', err);
      setState({
        content: null,
        filename: entry?.name ?? '',
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to load preview',
        isPreviewable: true,
      });
    }
  };

  // Load preview when dependencies change
  createEffect(
    on([currentPath, selectedEntry], () => {
      loadPreview();
    })
  );

  return state;
}
