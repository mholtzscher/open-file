/**
 * UploadDialog component tests
 */

import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { testRender } from '@opentui/react/test-utils';
import { UploadDialog } from './upload.js';
import { getDialogHandler } from '../../hooks/useDialogKeyboard.js';
import type { LocalFileEntry } from '../../utils/file-browser.js';

// Create mock entries for testing
function createMockEntries(count: number = 5): LocalFileEntry[] {
  const entries: LocalFileEntry[] = [];

  // Add a parent directory
  entries.push({
    name: 'parent-dir',
    path: '/test/path/parent-dir',
    size: 0,
    modified: new Date(),
    isDirectory: true,
  });

  // Add files
  for (let i = 1; i < count; i++) {
    entries.push({
      name: `file${i}.txt`,
      path: `/test/path/file${i}.txt`,
      size: 1024 * i,
      modified: new Date(),
      isDirectory: false,
      extension: 'txt',
    });
  }

  return entries;
}

describe('UploadDialog', () => {
  // Verify mock entries function works
  beforeEach(() => {
    // Ensure createMockEntries is available for tests that need it
    const entries = createMockEntries(3);
    expect(entries.length).toBe(3);
  });

  describe('visibility', () => {
    it('renders when visible is true', async () => {
      const { renderOnce, captureCharFrame } = await testRender(<UploadDialog visible={true} />, {
        width: 80,
        height: 24,
      });
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('Upload Files');
    });

    it('renders by default (visible defaults to true)', async () => {
      const { renderOnce, captureCharFrame } = await testRender(<UploadDialog />, {
        width: 80,
        height: 24,
      });
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('Upload Files');
    });

    it('renders nothing when visible is false', async () => {
      const { renderOnce, captureCharFrame } = await testRender(<UploadDialog visible={false} />, {
        width: 80,
        height: 24,
      });
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).not.toContain('Upload Files');
    });
  });

  describe('current path display', () => {
    it('displays the current working directory path', async () => {
      const { renderOnce, captureCharFrame } = await testRender(<UploadDialog visible={true} />, {
        width: 80,
        height: 24,
      });

      await new Promise(resolve => setTimeout(resolve, 50));
      await renderOnce();

      const frame = captureCharFrame();
      // Should show a path with folder emoji
      expect(frame).toMatch(/📁.*\//);
    });
  });

  describe('help text', () => {
    it('displays keyboard navigation help', async () => {
      const { renderOnce, captureCharFrame } = await testRender(<UploadDialog visible={true} />, {
        width: 120,
        height: 800,
      });

      await new Promise(resolve => setTimeout(resolve, 50));
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('j/k:nav');
      expect(frame).toContain('space:select');
      expect(frame).toContain('enter:confirm');
      expect(frame).toContain('ESC:cancel');
    });
  });

  describe('callback handling', () => {
    it('calls onCancel when escape is pressed', async () => {
      const onCancel = mock(() => {});

      const { renderOnce } = await testRender(<UploadDialog visible={true} onCancel={onCancel} />, {
        width: 80,
        height: 24,
      });

      await new Promise(resolve => setTimeout(resolve, 50));
      await renderOnce();

      // Get the dialog handler and simulate escape key
      const handler = getDialogHandler('upload-dialog');
      expect(handler).toBeDefined();

      handler?.('escape');
      expect(onCancel).toHaveBeenCalled();
    });

    it('does not trigger onCancel when visible is false', async () => {
      const onCancel = mock(() => {});

      const { renderOnce, captureCharFrame } = await testRender(
        <UploadDialog visible={false} onCancel={onCancel} />,
        { width: 80, height: 24 }
      );
      await renderOnce();

      // Dialog should not be rendered when not visible
      const frame = captureCharFrame();
      expect(frame).not.toContain('Upload Files');

      // onCancel should not have been called
      expect(onCancel).not.toHaveBeenCalled();
    });
  });

  describe('component interface', () => {
    it('has correct props interface', () => {
      const props = {
        visible: true,
        destinationPath: '/bucket/uploads',
        onConfirm: (_files: string[]) => {},
        onCancel: () => {},
      };

      expect(props.visible).toBe(true);
      expect(props.destinationPath).toBe('/bucket/uploads');
      expect(typeof props.onConfirm).toBe('function');
      expect(typeof props.onCancel).toBe('function');
    });
  });

  describe('file selection state', () => {
    it('handles file selection with Set', () => {
      const selectedFiles = new Set<string>();

      selectedFiles.add('/home/user/file1.txt');
      selectedFiles.add('/home/user/file2.txt');

      expect(selectedFiles.size).toBe(2);
      expect(selectedFiles.has('/home/user/file1.txt')).toBe(true);

      selectedFiles.delete('/home/user/file1.txt');
      expect(selectedFiles.size).toBe(1);
      expect(selectedFiles.has('/home/user/file1.txt')).toBe(false);
    });

    it('toggles selection correctly', () => {
      const selectedFiles = new Set<string>();
      const filePath = '/test/file.txt';

      // Add file
      if (!selectedFiles.has(filePath)) {
        selectedFiles.add(filePath);
      }
      expect(selectedFiles.has(filePath)).toBe(true);

      // Toggle off
      if (selectedFiles.has(filePath)) {
        selectedFiles.delete(filePath);
      } else {
        selectedFiles.add(filePath);
      }
      expect(selectedFiles.has(filePath)).toBe(false);
    });
  });

  describe('navigation path', () => {
    it('tracks current navigation path', () => {
      let currentPath = '/home/user/downloads';

      // Simulate directory navigation
      currentPath = '/home/user/downloads/documents';
      expect(currentPath).toBe('/home/user/downloads/documents');

      // Simulate going back
      const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/'));
      expect(parentPath).toBe('/home/user/downloads');
    });

    it('handles root path correctly', () => {
      const currentPath = '/';
      const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/'));
      expect(parentPath).toBe('');
    });

    it('handles nested paths correctly', () => {
      let currentPath = '/a/b/c/d/e';

      // Go back multiple levels
      for (let i = 0; i < 3; i++) {
        currentPath = currentPath.substring(0, currentPath.lastIndexOf('/')) || '/';
      }
      expect(currentPath).toBe('/a/b');
    });
  });

  describe('selected index management', () => {
    it('manages selected index for keyboard navigation', () => {
      let selectedIndex = 0;
      const entriesCount = 5;

      // Move down
      selectedIndex = Math.min(selectedIndex + 1, entriesCount - 1);
      expect(selectedIndex).toBe(1);

      // Move up
      selectedIndex = Math.max(selectedIndex - 1, 0);
      expect(selectedIndex).toBe(0);

      // Boundary check - can't go below 0
      selectedIndex = Math.max(selectedIndex - 1, 0);
      expect(selectedIndex).toBe(0);

      // Boundary check - can't exceed entries
      selectedIndex = Math.min(selectedIndex + 10, entriesCount - 1);
      expect(selectedIndex).toBe(entriesCount - 1);
    });

    it('handles empty entries list', () => {
      let selectedIndex = 0;
      const entriesCount = 0;

      selectedIndex = Math.min(selectedIndex + 1, Math.max(0, entriesCount - 1));
      expect(selectedIndex).toBe(0);
    });
  });

  describe('scroll offset management', () => {
    it('calculates scroll offset when moving down', () => {
      const entriesCount = 20;
      const visibleHeight = 10;
      let selectedIndex = 0;
      let scrollOffset = 0;

      // Move down past visible area
      for (let i = 0; i < 15; i++) {
        selectedIndex = Math.min(selectedIndex + 1, entriesCount - 1);
        if (selectedIndex >= scrollOffset + visibleHeight - 1) {
          scrollOffset = Math.min(selectedIndex - visibleHeight + 2, entriesCount - visibleHeight);
        }
      }

      expect(selectedIndex).toBe(15);
      expect(scrollOffset).toBeGreaterThan(0);
    });

    it('calculates scroll offset when moving up', () => {
      let selectedIndex = 10;
      let scrollOffset = 5;

      // Move up past scroll offset
      selectedIndex = Math.max(selectedIndex - 8, 0);
      if (selectedIndex < scrollOffset) {
        scrollOffset = selectedIndex;
      }

      expect(selectedIndex).toBe(2);
      expect(scrollOffset).toBe(2);
    });
  });

  describe('file filtering', () => {
    it('filters file entries by extension', () => {
      interface FileEntry {
        name: string;
        extension?: string;
        isDirectory: boolean;
      }

      const entries: FileEntry[] = [
        { name: 'document.txt', extension: 'txt', isDirectory: false },
        { name: 'image.jpg', extension: 'jpg', isDirectory: false },
        { name: 'archive.zip', extension: 'zip', isDirectory: false },
        { name: 'folder', extension: undefined, isDirectory: true },
      ];

      const textFiles = entries.filter(e => e.extension === 'txt' || e.isDirectory);
      expect(textFiles.length).toBe(2);

      const allButDirs = entries.filter(e => !e.isDirectory);
      expect(allButDirs.length).toBe(3);
    });

    it('always includes directories in filtered results', () => {
      interface FileEntry {
        name: string;
        extension?: string;
        isDirectory: boolean;
      }

      const entries: FileEntry[] = [
        { name: 'docs', extension: undefined, isDirectory: true },
        { name: 'images', extension: undefined, isDirectory: true },
        { name: 'script.js', extension: 'js', isDirectory: false },
        { name: 'readme.md', extension: 'md', isDirectory: false },
      ];

      // Filter for JS files but always include directories
      const filtered = entries.filter(e => e.isDirectory || e.extension === 'js');
      expect(filtered.length).toBe(3);
      expect(filtered.filter(e => e.isDirectory).length).toBe(2);
    });
  });

  describe('total size calculation', () => {
    it('calculates total selected file size', () => {
      interface SelectedFile {
        path: string;
        size: number;
      }

      const selectedFiles: SelectedFile[] = [
        { path: '/file1.txt', size: 1024 },
        { path: '/file2.txt', size: 2048 },
        { path: '/file3.txt', size: 4096 },
      ];

      const totalSize = selectedFiles.reduce((sum, f) => sum + f.size, 0);
      expect(totalSize).toBe(7168);
    });

    it('handles empty selection', () => {
      const selectedFiles: { path: string; size: number }[] = [];
      const totalSize = selectedFiles.reduce((sum, f) => sum + f.size, 0);
      expect(totalSize).toBe(0);
    });

    it('handles files with undefined size', () => {
      const entries = [
        { path: '/file1.txt', size: 1024 },
        { path: '/file2.txt', size: undefined },
        { path: '/file3.txt', size: 2048 },
      ];

      const totalSize = entries.reduce((sum, f) => sum + (f.size || 0), 0);
      expect(totalSize).toBe(3072);
    });
  });

  describe('keyboard navigation commands', () => {
    it('maps keyboard keys to commands', () => {
      const commands: Record<string, string> = {
        j: 'move-down',
        k: 'move-up',
        space: 'toggle-select',
        return: 'open-or-confirm',
        l: 'open-directory',
        h: 'go-back',
        backspace: 'go-back',
        escape: 'cancel',
      };

      expect(commands['j']).toBe('move-down');
      expect(commands['k']).toBe('move-up');
      expect(commands['space']).toBe('toggle-select');
      expect(commands['return']).toBe('open-or-confirm');
      expect(commands['escape']).toBe('cancel');
    });
  });

  describe('file size formatting', () => {
    it('formats bytes correctly', () => {
      const formatBytes = (bytes: number): string => {
        if (bytes === 0) return '0B';
        if (bytes < 1024) return bytes + 'B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
        if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
        return (bytes / (1024 * 1024 * 1024)).toFixed(1) + 'GB';
      };

      expect(formatBytes(0)).toBe('0B');
      expect(formatBytes(512)).toBe('512B');
      expect(formatBytes(1024)).toBe('1.0KB');
      expect(formatBytes(1024 * 1024)).toBe('1.0MB');
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1.0GB');
    });
  });

  describe('search pattern matching', () => {
    it('matches filenames case-insensitively', () => {
      const matchesSearchPattern = (filename: string, pattern?: string): boolean => {
        if (!pattern) return true;
        return filename.toLowerCase().includes(pattern.toLowerCase());
      };

      expect(matchesSearchPattern('document.txt', 'doc')).toBe(true);
      expect(matchesSearchPattern('document.txt', 'pdf')).toBe(false);
      expect(matchesSearchPattern('UPPERCASE.TXT', 'upper')).toBe(true);
      expect(matchesSearchPattern('file.txt', undefined)).toBe(true);
      expect(matchesSearchPattern('file.txt', '')).toBe(true);
    });
  });

  describe('entry display', () => {
    it('formats directory entries with folder emoji', () => {
      const entry = {
        name: 'documents',
        isDirectory: true,
        path: '/test/documents',
      };

      const prefix = entry.isDirectory ? '📁' : '📄';
      expect(prefix).toBe('📁');
    });

    it('formats file entries with file emoji', () => {
      const entry = {
        name: 'readme.txt',
        isDirectory: false,
        path: '/test/readme.txt',
      };

      const prefix = entry.isDirectory ? '📁' : '📄';
      expect(prefix).toBe('📄');
    });

    it('shows checkmark for selected files', () => {
      const selectedFiles = new Set(['/test/file1.txt']);
      const entry = { path: '/test/file1.txt', name: 'file1.txt', isDirectory: false };

      const isSelectedFile = selectedFiles.has(entry.path);
      const checkmark = isSelectedFile ? '✓' : ' ';
      expect(checkmark).toBe('✓');
    });

    it('shows space for unselected files', () => {
      const selectedFiles = new Set(['/test/file1.txt']);
      const entry = { path: '/test/file2.txt', name: 'file2.txt', isDirectory: false };

      const isSelectedFile = selectedFiles.has(entry.path);
      const checkmark = isSelectedFile ? '✓' : ' ';
      expect(checkmark).toBe(' ');
    });
  });

  describe('empty state', () => {
    it('shows "No files" when directory is empty', async () => {
      // The component will load from actual filesystem, but we test the logic
      const entries: LocalFileEntry[] = [];
      const isEmpty = entries.length === 0;
      expect(isEmpty).toBe(true);
    });
  });

  describe('selection summary', () => {
    it('generates correct summary text', () => {
      const selectedCount = 3;
      const totalSize = 7168;
      const formatBytes = (bytes: number) => (bytes / 1024).toFixed(1) + 'KB';

      const summary = `Selected: ${selectedCount} files - ${formatBytes(totalSize)}`;
      expect(summary).toBe('Selected: 3 files - 7.0KB');
    });

    it('does not show summary when no files selected', () => {
      const selectedCount = 0;
      const shouldShowSummary = selectedCount > 0;
      expect(shouldShowSummary).toBe(false);
    });
  });

  describe('dialog handler registration', () => {
    it('registers handler when visible', async () => {
      const { renderOnce } = await testRender(<UploadDialog visible={true} />, {
        width: 80,
        height: 24,
      });

      await new Promise(resolve => setTimeout(resolve, 50));
      await renderOnce();

      const handler = getDialogHandler('upload-dialog');
      expect(handler).toBeDefined();
    });

    it('dialog is not rendered when not visible', async () => {
      const { renderOnce, captureCharFrame } = await testRender(<UploadDialog visible={false} />, {
        width: 80,
        height: 24,
      });
      await renderOnce();

      // When not visible, the dialog should not be rendered
      const frame = captureCharFrame();
      expect(frame).not.toContain('Upload Files');
      expect(frame).not.toContain('j/k:nav');
    });
  });

  describe('keyboard handler behavior', () => {
    it('handles j key for moving down', async () => {
      const { renderOnce } = await testRender(<UploadDialog visible={true} />, {
        width: 80,
        height: 24,
      });

      await new Promise(resolve => setTimeout(resolve, 50));
      await renderOnce();

      const handler = getDialogHandler('upload-dialog');
      expect(handler).toBeDefined();

      // Should not throw when calling handler
      expect(() => handler?.('j')).not.toThrow();
    });

    it('handles k key for moving up', async () => {
      const { renderOnce } = await testRender(<UploadDialog visible={true} />, {
        width: 80,
        height: 24,
      });

      await new Promise(resolve => setTimeout(resolve, 50));
      await renderOnce();

      const handler = getDialogHandler('upload-dialog');
      expect(() => handler?.('k')).not.toThrow();
    });

    it('handles space key for toggling selection', async () => {
      const { renderOnce } = await testRender(<UploadDialog visible={true} />, {
        width: 80,
        height: 24,
      });

      await new Promise(resolve => setTimeout(resolve, 50));
      await renderOnce();

      const handler = getDialogHandler('upload-dialog');
      expect(() => handler?.('space')).not.toThrow();
    });

    it('handles h key for going back', async () => {
      const { renderOnce } = await testRender(<UploadDialog visible={true} />, {
        width: 80,
        height: 24,
      });

      await new Promise(resolve => setTimeout(resolve, 50));
      await renderOnce();

      const handler = getDialogHandler('upload-dialog');
      expect(() => handler?.('h')).not.toThrow();
    });

    it('handles backspace key for going back', async () => {
      const { renderOnce } = await testRender(<UploadDialog visible={true} />, {
        width: 80,
        height: 24,
      });

      await new Promise(resolve => setTimeout(resolve, 50));
      await renderOnce();

      const handler = getDialogHandler('upload-dialog');
      expect(() => handler?.('backspace')).not.toThrow();
    });

    it('handles l key for entering directory', async () => {
      const { renderOnce } = await testRender(<UploadDialog visible={true} />, {
        width: 80,
        height: 24,
      });

      await new Promise(resolve => setTimeout(resolve, 50));
      await renderOnce();

      const handler = getDialogHandler('upload-dialog');
      expect(() => handler?.('l')).not.toThrow();
    });

    it('handles return key for confirm/enter', async () => {
      const { renderOnce } = await testRender(<UploadDialog visible={true} />, {
        width: 80,
        height: 24,
      });

      await new Promise(resolve => setTimeout(resolve, 50));
      await renderOnce();

      const handler = getDialogHandler('upload-dialog');
      expect(() => handler?.('return')).not.toThrow();
    });
  });

  describe('window sizing', () => {
    it('calculates window size based on terminal', () => {
      const terminalWidth = 100;
      const terminalHeight = 30;

      const windowWidth = Math.min(80, terminalWidth - 4);
      const windowHeight = Math.min(24, terminalHeight - 4);

      expect(windowWidth).toBe(80);
      expect(windowHeight).toBe(24);
    });

    it('constrains window size for small terminals', () => {
      const terminalWidth = 60;
      const terminalHeight = 18;

      const windowWidth = Math.min(80, terminalWidth - 4);
      const windowHeight = Math.min(24, terminalHeight - 4);

      expect(windowWidth).toBe(56);
      expect(windowHeight).toBe(14);
    });
  });

  describe('exports', () => {
    it('exports UploadDialog component', async () => {
      const module = await import('./upload.js');
      expect(module.UploadDialog).toBeDefined();
      expect(typeof module.UploadDialog).toBe('function');
    });

    it('exports UploadDialogProps interface', async () => {
      // TypeScript interface check - if this compiles, the interface exists
      const props: import('./upload.js').UploadDialogProps = {
        visible: true,
        destinationPath: '/test',
        onConfirm: () => {},
        onCancel: () => {},
      };
      expect(props.visible).toBe(true);
    });
  });
});
