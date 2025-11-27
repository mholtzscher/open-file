/**
 * usePreview Hook
 *
 * Manages file preview state and loading using StorageContext.
 * Provides a unified way to preview files that works with both
 * legacy adapters and new provider system.
 *
 * Features:
 * - Automatic file size checking
 * - Previewable file type detection
 * - Error handling
 * - Loading state management
 * - Works with both adapter and provider systems
 */

import { useState, useEffect, useCallback } from 'react';
import { useStorage, useHasStorage } from '../contexts/StorageContext.js';
import { Adapter } from '../adapters/adapter.js';
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
 * Determine if a file should be previewed based on its extension
 */
function isPreviewableFile(entry: Entry | undefined): boolean {
  if (!entry || entry.type !== EntryType.File) return false;

  const name = entry.name.toLowerCase();
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
 *       {preview.isLoading && <div>Loading preview...</div>}
 *       {preview.error && <div>Error: {preview.error}</div>}
 *       {preview.content && <PreviewPane content={preview.content} filename={preview.filename} />}
 *     </div>
 *   );
 * }
 * ```
 */
export function usePreview(
  currentPath: string,
  selectedEntry: Entry | undefined,
  options: PreviewOptions = {}
): PreviewState {
  const { maxSize = 100 * 1024, enabled = true } = options;

  const hasStorage = useHasStorage();
  const storage = hasStorage ? useStorage() : null;

  const [state, setState] = useState<PreviewState>({
    content: null,
    filename: '',
    isLoading: false,
    error: null,
    isPreviewable: false,
  });

  const loadPreview = useCallback(async () => {
    // Early exit if preview is disabled or no storage context
    if (!enabled || !storage) {
      setState({
        content: null,
        filename: '',
        isLoading: false,
        error: null,
        isPreviewable: false,
      });
      return;
    }

    // Early exit if no entry selected
    if (!selectedEntry) {
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
    if (!isPreviewableFile(selectedEntry)) {
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
    if (selectedEntry.size && selectedEntry.size > maxSize) {
      setState({
        content: `File too large to preview (${formatBytes(selectedEntry.size)})`,
        filename: selectedEntry.name,
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
      filename: selectedEntry.name,
    }));

    try {
      // Construct full path
      const fullPath = currentPath ? `${currentPath}${selectedEntry.name}` : selectedEntry.name;

      // Read file content using storage context
      const buffer = await storage.read(fullPath);
      const content = buffer.toString('utf-8');

      setState({
        content,
        filename: selectedEntry.name,
        isLoading: false,
        error: null,
        isPreviewable: true,
      });
    } catch (err) {
      console.error('Failed to load preview:', err);
      setState({
        content: null,
        filename: selectedEntry.name,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to load preview',
        isPreviewable: true,
      });
    }
  }, [enabled, storage, selectedEntry, currentPath, maxSize]);

  // Load preview when dependencies change
  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  return state;
}

// ============================================================================
// Hook (Legacy Adapter Version - for backward compatibility)
// ============================================================================

/**
 * Use file preview with legacy Adapter
 *
 * This is a backward-compatible version for components that still use
 * the legacy adapter system directly.
 *
 * @deprecated Use usePreview with StorageContext instead
 */
export function usePreviewLegacy(
  adapter: Adapter,
  currentPath: string,
  selectedEntry: Entry | undefined,
  options: PreviewOptions = {}
): PreviewState {
  const { maxSize = 100 * 1024, enabled = true } = options;

  const [state, setState] = useState<PreviewState>({
    content: null,
    filename: '',
    isLoading: false,
    error: null,
    isPreviewable: false,
  });

  const loadPreview = useCallback(async () => {
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

    // Early exit if no entry selected
    if (!selectedEntry) {
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
    if (!isPreviewableFile(selectedEntry)) {
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
    if (selectedEntry.size && selectedEntry.size > maxSize) {
      setState({
        content: `File too large to preview (${formatBytes(selectedEntry.size)})`,
        filename: selectedEntry.name,
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
      filename: selectedEntry.name,
    }));

    try {
      // Construct full path
      const fullPath = currentPath ? `${currentPath}${selectedEntry.name}` : selectedEntry.name;

      // Read file content using adapter
      const buffer = await adapter.read(fullPath);
      const content = buffer.toString('utf-8');

      setState({
        content,
        filename: selectedEntry.name,
        isLoading: false,
        error: null,
        isPreviewable: true,
      });
    } catch (err) {
      console.error('Failed to load preview:', err);
      setState({
        content: null,
        filename: selectedEntry.name,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to load preview',
        isPreviewable: true,
      });
    }
  }, [enabled, adapter, selectedEntry, currentPath, maxSize]);

  // Load preview when dependencies change
  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  return state;
}
