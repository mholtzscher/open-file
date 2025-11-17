/**
 * Tests for the column system
 */

import { describe, it, expect } from 'bun:test';
import {
  IconColumn,
  NameColumn,
  SizeColumn,
  DateColumn,
  StorageClassColumn,
  getDefaultColumns,
  renderRow,
  getTotalWidth,
  toggleColumn,
  setColumnWidth,
} from './columns.js';
import { Entry, EntryType } from '../types/entry.js';

describe('Column System', () => {
  describe('IconColumn', () => {
    it('should render directory icon', () => {
      const col = new IconColumn();
      const entry: Entry = {
        id: '1',
        name: 'test',
        type: EntryType.Directory,
        path: '/test',
      };
      const result = col.render(entry);
      expect(result).toContain('📁');
    });

    it('should render file icon', () => {
      const col = new IconColumn();
      const entry: Entry = {
        id: '1',
        name: 'test.txt',
        type: EntryType.File,
        path: '/test.txt',
      };
      const result = col.render(entry);
      expect(result).toContain('📄');
    });
  });

  describe('NameColumn', () => {
    it('should add suffix for directories', () => {
      const col = new NameColumn();
      const entry: Entry = {
        id: '1',
        name: 'mydir',
        type: EntryType.Directory,
        path: '/mydir',
      };
      const result = col.render(entry);
      expect(result).toContain('mydir/');
    });

    it('should not add suffix for files', () => {
      const col = new NameColumn();
      const entry: Entry = {
        id: '1',
        name: 'file.txt',
        type: EntryType.File,
        path: '/file.txt',
      };
      const result = col.render(entry);
      expect(result).toContain('file.txt');
      expect(result).not.toContain('file.txt/');
    });
  });

  describe('SizeColumn', () => {
    it('should show dash for directories', () => {
      const col = new SizeColumn();
      const entry: Entry = {
        id: '1',
        name: 'dir',
        type: EntryType.Directory,
        path: '/dir',
      };
      const result = col.render(entry);
      expect(result).toContain('-');
    });

    it('should format bytes', () => {
      const col = new SizeColumn();
      const entry: Entry = {
        id: '1',
        name: 'file',
        type: EntryType.File,
        path: '/file',
        size: 500,
      };
      const result = col.render(entry);
      expect(result).toContain('500B');
    });

    it('should format KB', () => {
      const col = new SizeColumn();
      const entry: Entry = {
        id: '1',
        name: 'file',
        type: EntryType.File,
        path: '/file',
        size: 2048,
      };
      const result = col.render(entry);
      expect(result).toContain('2.0KB');
    });

    it('should format MB', () => {
      const col = new SizeColumn();
      const entry: Entry = {
        id: '1',
        name: 'file',
        type: EntryType.File,
        path: '/file',
        size: 5 * 1024 * 1024,
      };
      const result = col.render(entry);
      expect(result).toContain('5.0MB');
    });

    it('should format GB', () => {
      const col = new SizeColumn();
      const entry: Entry = {
        id: '1',
        name: 'file',
        type: EntryType.File,
        path: '/file',
        size: 3 * 1024 * 1024 * 1024,
      };
      const result = col.render(entry);
      expect(result).toContain('3.0GB');
    });
  });

  describe('DateColumn', () => {
    it('should show dash when no date', () => {
      const col = new DateColumn();
      const entry: Entry = {
        id: '1',
        name: 'file',
        type: EntryType.File,
        path: '/file',
      };
      const result = col.render(entry);
      expect(result).toContain('-');
    });

    it('should format date', () => {
      const col = new DateColumn();
      const entry: Entry = {
        id: '1',
        name: 'file',
        type: EntryType.File,
        path: '/file',
        modified: new Date('2024-01-15'),
      };
      const result = col.render(entry);
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{2}/);
    });
  });

  describe('StorageClassColumn', () => {
    it('should show dash when no storage class', () => {
      const col = new StorageClassColumn();
      const entry: Entry = {
        id: '1',
        name: 'file',
        type: EntryType.File,
        path: '/file',
      };
      const result = col.render(entry);
      expect(result).toContain('-');
    });

    it('should display storage class', () => {
      const col = new StorageClassColumn();
      const entry: Entry = {
        id: '1',
        name: 'file',
        type: EntryType.File,
        path: '/file',
        metadata: {
          storageClass: 'STANDARD',
        },
      };
      const result = col.render(entry);
      expect(result).toContain('STD');
    });
  });

  describe('getDefaultColumns', () => {
    it('should return default column set', () => {
      const columns = getDefaultColumns();
      expect(columns.length).toBe(5);
      expect(columns[0].id).toBe('icon');
      expect(columns[1].id).toBe('name');
      expect(columns[2].id).toBe('size');
      expect(columns[3].id).toBe('modified');
      expect(columns[4].id).toBe('storage-class');
    });

    it('should have storage-class hidden by default', () => {
      const columns = getDefaultColumns();
      const storageCol = columns.find(c => c.id === 'storage-class');
      expect(storageCol?.visible).toBe(false);
    });
  });

  describe('renderRow', () => {
    it('should render all visible columns', () => {
      const columns = getDefaultColumns();
      const entry: Entry = {
        id: '1',
        name: 'test.txt',
        type: EntryType.File,
        path: '/test.txt',
        size: 1024,
        modified: new Date('2024-01-01'),
      };
      const result = renderRow(entry, columns);
      expect(result).toContain('📄');
      expect(result).toContain('test.txt');
      expect(result).toContain('1.0KB');
    });

    it('should skip invisible columns', () => {
      const columns = getDefaultColumns();
      columns[0].visible = false; // Hide icon
      const entry: Entry = {
        id: '1',
        name: 'test',
        type: EntryType.File,
        path: '/test',
      };
      const result = renderRow(entry, columns);
      expect(result).not.toContain('📄');
    });
  });

  describe('getTotalWidth', () => {
    it('should calculate total width of visible columns', () => {
      const columns = getDefaultColumns();
      const width = getTotalWidth(columns);
      expect(width).toBeGreaterThan(0);
    });

    it('should exclude invisible columns', () => {
      const columns = getDefaultColumns();
      const allWidth = getTotalWidth(columns);
      columns[0].visible = false;
      const reducedWidth = getTotalWidth(columns);
      expect(reducedWidth).toBeLessThan(allWidth);
    });
  });

  describe('toggleColumn', () => {
    it('should toggle column visibility', () => {
      const columns = getDefaultColumns();
      const iconCol = columns[0];
      const originalVisibility = iconCol.visible;
      
      const updated = toggleColumn(columns, 'icon');
      const updatedIconCol = updated.find(c => c.id === 'icon');
      
      expect(updatedIconCol?.visible).toBe(!originalVisibility);
    });

    it('should not modify other columns', () => {
      const columns = getDefaultColumns();
      const updated = toggleColumn(columns, 'icon');
      const nameCol = updated.find(c => c.id === 'name');
      
      expect(nameCol?.visible).toBe(columns.find(c => c.id === 'name')?.visible);
    });
  });

  describe('setColumnWidth', () => {
    it('should update column width', () => {
      const columns = getDefaultColumns();
      const updated = setColumnWidth(columns, 'name', 50);
      const nameCol = updated.find(c => c.id === 'name');
      
      expect(nameCol?.width).toBe(50);
    });

    it('should not modify other columns', () => {
      const columns = getDefaultColumns();
      const originalSizeWidth = columns.find(c => c.id === 'size')?.width;
      const updated = setColumnWidth(columns, 'name', 50);
      const sizeCol = updated.find(c => c.id === 'size');
      
      expect(sizeCol?.width).toBe(originalSizeWidth);
    });
  });
});
