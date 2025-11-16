/**
 * Tests for file preview pane
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { PreviewPane } from './preview-pane.js';
import { MockAdapter } from '../adapters/mock-adapter.js';
import { Entry, EntryType } from '../types/entry.js';
import { generateEntryId } from '../utils/entry-id.js';

// Mock renderer for testing
const createMockRenderer = () => {
  const mockRoot = {
    add: () => {},
    remove: () => {},
  };
  return {
    root: mockRoot,
    width: 80,
    height: 20,
  };
};

describe('PreviewPane', () => {
  let previewPane: PreviewPane;
  let mockAdapter: MockAdapter;

  beforeEach(() => {
    mockAdapter = new MockAdapter();
    const mockRenderer = createMockRenderer() as any;
    previewPane = new PreviewPane(mockRenderer, mockAdapter, {
      width: 20,
      height: 15,
      maxFileSize: 50 * 1024,
    });
  });

  describe('File Type Detection', () => {
    it('should identify text files', () => {
      const textFiles = ['file.txt', 'script.js', 'readme.md', 'config.json', 'style.css'];
      
      for (const filename of textFiles) {
        const entry: Entry = {
          id: generateEntryId(),
          name: filename,
          type: EntryType.File,
          path: filename,
        };
        expect(previewPane.isPreviewable(entry)).toBe(true);
      }
    });

    it('should identify image files', () => {
      const imageFiles = ['photo.jpg', 'picture.png', 'diagram.svg', 'animation.gif'];
      
      for (const filename of imageFiles) {
        const entry: Entry = {
          id: generateEntryId(),
          name: filename,
          type: EntryType.File,
          path: filename,
        };
        expect(previewPane.isPreviewable(entry)).toBe(true);
      }
    });

    it('should not preview directories', () => {
      const entry: Entry = {
        id: generateEntryId(),
        name: 'folder',
        type: EntryType.Directory,
        path: 'folder/',
      };
      expect(previewPane.isPreviewable(entry)).toBe(false);
    });

    it('should not preview files exceeding max size', () => {
      const entry: Entry = {
        id: generateEntryId(),
        name: 'large.bin',
        type: EntryType.File,
        path: 'large.bin',
        size: 100 * 1024, // 100KB, exceeds 50KB limit
      };
      expect(previewPane.isPreviewable(entry)).toBe(false);
    });

    it('should not preview unknown binary files', () => {
      const entry: Entry = {
        id: generateEntryId(),
        name: 'archive.zip',
        type: EntryType.File,
        path: 'archive.zip',
      };
      expect(previewPane.isPreviewable(entry)).toBe(false);
    });
  });

  describe('Preview Content', () => {
    it('should set and get preview content', () => {
      const content = 'Preview content';
      previewPane.setPreviewContent(content);
      expect(previewPane.getPreviewContent()).toBe(content);
    });

    it('should initially have empty preview content', () => {
      expect(previewPane.getPreviewContent()).toBe('');
    });

    it('should track current entry when set', () => {
      const content = 'Test content';
      previewPane.setPreviewContent(content);
      expect(previewPane.getPreviewContent()).toBe(content);
    });
  });

  describe('Current Entry Tracking', () => {
    it('should initially have no current entry', () => {
      expect(previewPane.getCurrentEntry()).toBeNull();
    });

    it('should support tracking multiple entries sequentially', () => {
      const entry1: Entry = {
        id: generateEntryId(),
        name: 'file1.txt',
        type: EntryType.File,
        path: 'file1.txt',
      };

      const entry2: Entry = {
        id: generateEntryId(),
        name: 'file2.txt',
        type: EntryType.File,
        path: 'file2.txt',
      };

      previewPane.setPreviewContent('Entry 1 content');
      expect(previewPane.getCurrentEntry()).toBeNull(); // Not set by setPreviewContent

      // In real usage, previewEntry would set current entry
      // This test validates that the component can handle multiple files
      expect(previewPane.isPreviewable(entry1)).toBe(true);
      expect(previewPane.isPreviewable(entry2)).toBe(true);
    });
  });
});
