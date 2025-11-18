/**
 * Tests for column system
 */

import { describe, it, expect } from 'bun:test';
import {
  IconColumn,
  NameColumn,
  SizeColumn,
  DateColumn,
  getDefaultColumns,
  renderRow,
  getTotalWidth,
  toggleColumn,
  setColumnWidth,
} from './columns.js';
import { Entry, EntryType } from '../types/entry.js';
import { generateEntryId } from '../utils/entry-id.js';

describe('IconColumn', () => {
  it('should render directory icon', () => {
    const column = new IconColumn();
    const entry: Entry = {
      id: generateEntryId(),
      name: 'test',
      type: EntryType.Directory,
      path: 'test/',
    };

    const result = column.render(entry);
    expect(result).toContain('📁');
  });

  it('should render file icon', () => {
    const column = new IconColumn();
    const entry: Entry = {
      id: generateEntryId(),
      name: 'test.txt',
      type: EntryType.File,
      path: 'test.txt',
    };

    const result = column.render(entry);
    expect(result).toContain('📄');
  });
});

describe('NameColumn', () => {
  it('should render name with directory suffix', () => {
    const column = new NameColumn();
    const entry: Entry = {
      id: generateEntryId(),
      name: 'mydir',
      type: EntryType.Directory,
      path: 'mydir/',
    };

    const result = column.render(entry);
    expect(result).toContain('mydir/');
  });

  it('should render name without suffix for files', () => {
    const column = new NameColumn();
    const entry: Entry = {
      id: generateEntryId(),
      name: 'file.txt',
      type: EntryType.File,
      path: 'file.txt',
    };

    const result = column.render(entry);
    expect(result).toContain('file.txt');
    expect(result).not.toContain('file.txt/');
  });

  it('should pad name to specified width', () => {
    const column = new NameColumn();
    const entry: Entry = {
      id: generateEntryId(),
      name: 'x',
      type: EntryType.File,
      path: '/x',
    };

    const result = column.render(entry);
    // Width is 35 + 2 extra spaces
    expect(result.length).toBeGreaterThanOrEqual(35);
  });

  it('should truncate long filenames with ellipsis', () => {
    const column = new NameColumn();
    const entry: Entry = {
      id: generateEntryId(),
      name: 'fantasy-draft-implementation-plan.md',
      type: EntryType.File,
      path: '/fantasy-draft-implementation-plan.md',
    };

    const result = column.render(entry);
    // Should be truncated to width (35) + 2 extra spaces = 37
    expect(result.length).toBe(37);
    // Should contain ellipsis
    expect(result).toContain('...');
    // Should start with the beginning of the filename
    expect(result).toMatch(/^fantasy-draft-implementation/);
  });

  it('should not truncate filenames at exactly the width', () => {
    const column = new NameColumn();
    // Create a name that's exactly 35 chars
    const exactName = 'a'.repeat(35);
    const entry: Entry = {
      id: generateEntryId(),
      name: exactName,
      type: EntryType.File,
      path: `/${exactName}`,
    };

    const result = column.render(entry);
    // Should be padded to 35 + 2 spaces = 37
    expect(result.length).toBe(37);
    // Should NOT contain ellipsis
    expect(result).not.toContain('...');
  });
});

describe('SizeColumn', () => {
  it('should show dash for directory', () => {
    const column = new SizeColumn();
    const entry: Entry = {
      id: generateEntryId(),
      name: 'dir',
      type: EntryType.Directory,
      path: 'dir/',
    };

    const result = column.render(entry);
    expect(result).toContain('-');
  });

  it('should format bytes', () => {
    const column = new SizeColumn();
    const entry: Entry = {
      id: generateEntryId(),
      name: 'file.txt',
      type: EntryType.File,
      path: 'file.txt',
      size: 512,
    };

    const result = column.render(entry);
    expect(result).toContain('B');
  });

  it('should format kilobytes', () => {
    const column = new SizeColumn();
    const entry: Entry = {
      id: generateEntryId(),
      name: 'file.txt',
      type: EntryType.File,
      path: 'file.txt',
      size: 10 * 1024,
    };

    const result = column.render(entry);
    expect(result).toContain('KB');
  });

  it('should format megabytes', () => {
    const column = new SizeColumn();
    const entry: Entry = {
      id: generateEntryId(),
      name: 'file.txt',
      type: EntryType.File,
      path: 'file.txt',
      size: 5 * 1024 * 1024,
    };

    const result = column.render(entry);
    expect(result).toContain('MB');
  });

  it('should format gigabytes', () => {
    const column = new SizeColumn();
    const entry: Entry = {
      id: generateEntryId(),
      name: 'file.iso',
      type: EntryType.File,
      path: 'file.iso',
      size: 2 * 1024 * 1024 * 1024,
    };

    const result = column.render(entry);
    expect(result).toContain('GB');
  });
});

describe('DateColumn', () => {
  it('should show dash when no date', () => {
    const column = new DateColumn();
    const entry: Entry = {
      id: generateEntryId(),
      name: 'file.txt',
      type: EntryType.File,
      path: 'file.txt',
    };

    const result = column.render(entry);
    expect(result).toContain('-');
  });

  it('should format date', () => {
    const column = new DateColumn();
    const date = new Date('2024-01-15');
    const entry: Entry = {
      id: generateEntryId(),
      name: 'file.txt',
      type: EntryType.File,
      path: 'file.txt',
      modified: date,
    };

    const result = column.render(entry);
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{2}/);
  });
});

describe('Column functions', () => {
  it('should get default columns', () => {
    const columns = getDefaultColumns();
    expect(columns.length).toBe(7);
    expect(columns[0].id).toBe('icon');
    expect(columns[1].id).toBe('name');
    expect(columns[2].id).toBe('size');
    expect(columns[3].id).toBe('modified');
    expect(columns[4].id).toBe('storage-class');
    expect(columns[5].id).toBe('etag');
    expect(columns[6].id).toBe('content-type');
  });

  it('should render row with all columns', () => {
    const columns = getDefaultColumns();
    const entry: Entry = {
      id: generateEntryId(),
      name: 'myfile.txt',
      type: EntryType.File,
      path: 'myfile.txt',
      size: 1024,
      modified: new Date('2024-01-15'),
    };

    const result = renderRow(entry, columns);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should calculate total width', () => {
    const columns = getDefaultColumns();
    const width = getTotalWidth(columns);
    expect(width).toBeGreaterThan(0);
  });

  it('should toggle column visibility', () => {
    const columns = getDefaultColumns();
    const updated = toggleColumn(columns, 'size');

    const sizeColumn = updated.find(c => c.id === 'size');
    expect(sizeColumn?.visible).toBe(false);
  });

  it('should set column width', () => {
    const columns = getDefaultColumns();
    const updated = setColumnWidth(columns, 'name', 50);

    const nameColumn = updated.find(c => c.id === 'name');
    expect(nameColumn?.width).toBe(50);
  });
});
