/**
 * Tests for column system
 */

import { describe, it, expect } from 'bun:test';
import { Column, Columns } from './buffer-view.js';
import { Entry, EntryType } from '../types/entry.js';
import { Theme, CatppuccinMocha } from './theme.js';

describe('Column interface', () => {
  it('should have required properties', () => {
    const column: Column = {
      id: 'test',
      label: 'Test',
      width: 10,
      render: () => 'test',
    };

    expect(column.id).toBe('test');
    expect(column.label).toBe('Test');
    expect(column.width).toBe(10);
    expect(typeof column.render).toBe('function');
  });
});

describe('IconColumn', () => {
  it('should render directory icon', () => {
    const column = Columns.createIconColumn();
    const entry: Entry = {
      id: '1',
      name: 'test-dir',
      type: EntryType.Directory,
      path: 'test-dir/',
    };

    const result = column.render(entry);
    expect(result).toBe('📁  ');
  });

  it('should render file icon', () => {
    const column = Columns.createIconColumn();
    const entry: Entry = {
      id: '1',
      name: 'test.txt',
      type: EntryType.File,
      path: 'test.txt',
    };

    const result = column.render(entry);
    expect(result).toBe('📄  ');
  });
});

describe('NameColumn', () => {
  it('should render directory name with slash', () => {
    const column = Columns.createNameColumn(20);
    const entry: Entry = {
      id: '1',
      name: 'test-dir',
      type: EntryType.Directory,
      path: 'test-dir/',
    };

    const result = column.render(entry);
    expect(result).toBe('test-dir/           ');
  });

  it('should render file name without slash', () => {
    const column = Columns.createNameColumn(20);
    const entry: Entry = {
      id: '1',
      name: 'test.txt',
      type: EntryType.File,
      path: 'test.txt',
    };

    const result = column.render(entry);
    expect(result).toBe('test.txt            ');
  });

  it('should use default width', () => {
    const column = Columns.createNameColumn();
    expect(column.width).toBe(30);
  });

   it('should color directories blue', () => {
     const column = Columns.createNameColumn();
     const entry: Entry = {
       id: '1',
       name: 'test-dir',
       type: EntryType.Directory,
       path: 'test-dir/',
     };

     const color = column.color!(entry, false);
     expect(color).toBe('#89b4fa'); // CatppuccinMocha.blue
   });

   it('should color selected directories differently', () => {
     const column = Columns.createNameColumn();
     const entry: Entry = {
       id: '1',
       name: 'test-dir',
       type: EntryType.Directory,
       path: 'test-dir/',
     };

     const color = column.color!(entry, true);
     expect(color).toBe('#74c7ec'); // CatppuccinMocha.sapphire
   });

   it('should color files white', () => {
     const column = Columns.createNameColumn();
     const entry: Entry = {
       id: '1',
       name: 'test.txt',
       type: EntryType.File,
       path: 'test.txt',
     };

     const color = column.color!(entry, false);
     expect(color).toBe('#cdd6f4'); // CatppuccinMocha.text
   });

  it('should color selected directories differently', () => {
    const column = Columns.createNameColumn();
    const entry: Entry = {
      id: '1',
      name: 'test-dir',
      type: EntryType.Directory,
      path: 'test-dir/',
    };

    const color = column.color!(entry, true);
    expect(color).toBe('#74c7ec');
  });

  it('should color files white', () => {
    const column = Columns.createNameColumn();
    const entry: Entry = {
      id: '1',
      name: 'test.txt',
      type: EntryType.File,
      path: 'test.txt',
    };

    const color = column.color!(entry, false);
    expect(color).toBe('#cdd6f4');
  });
});

describe('SizeColumn', () => {
  it('should render dash for directories', () => {
    const column = Columns.createSizeColumn(12);
    const entry: Entry = {
      id: '1',
      name: 'test-dir',
      type: EntryType.Directory,
      path: 'test-dir/',
    };

    const result = column.render(entry);
    expect(result).toBe('-           ');
  });

  it('should render bytes for small files', () => {
    const column = Columns.createSizeColumn(12);
    const entry: Entry = {
      id: '1',
      name: 'test.txt',
      type: EntryType.File,
      path: 'test.txt',
      size: 512,
    };

    const result = column.render(entry);
    expect(result).toBe('512B        ');
  });

  it('should render KB for medium files', () => {
    const column = Columns.createSizeColumn(12);
    const entry: Entry = {
      id: '1',
      name: 'test.txt',
      type: EntryType.File,
      path: 'test.txt',
      size: 2048,
    };

    const result = column.render(entry);
    expect(result).toBe('2.0KB       ');
  });

  it('should render MB for large files', () => {
    const column = Columns.createSizeColumn(12);
    const entry: Entry = {
      id: '1',
      name: 'test.txt',
      type: EntryType.File,
      path: 'test.txt',
      size: 2 * 1024 * 1024,
    };

    const result = column.render(entry);
    expect(result).toBe('2.0MB       ');
  });

  it('should handle zero size', () => {
    const column = Columns.createSizeColumn(12);
    const entry: Entry = {
      id: '1',
      name: 'test.txt',
      type: EntryType.File,
      path: 'test.txt',
      size: 0,
    };

    const result = column.render(entry);
    expect(result).toBe('0B          ');
  });

  it('should use default width', () => {
    const column = Columns.createSizeColumn();
    expect(column.width).toBe(12);
  });

  it('should color sizes gray', () => {
    const column = Columns.createSizeColumn();
    const entry: Entry = {
      id: '1',
      name: 'test.txt',
      type: EntryType.File,
      path: 'test.txt',
    };

    const color = column.color!(entry, false);
    expect(color).toBe('#9399b2');
  });
});

describe('DateColumn', () => {
  it('should render dash for entries without date', () => {
    const column = Columns.createDateColumn(12);
    const entry: Entry = {
      id: '1',
      name: 'test.txt',
      type: EntryType.File,
      path: 'test.txt',
    };

    const result = column.render(entry);
    expect(result).toBe('-           ');
  });

  it('should render formatted date', () => {
    const column = Columns.createDateColumn(12);
    const entry: Entry = {
      id: '1',
      name: 'test.txt',
      type: EntryType.File,
      path: 'test.txt',
      modified: new Date('2023-12-25'),
    };

    const result = column.render(entry);
    expect(result).toBe('12/25/23    ');
  });

  it('should handle string dates', () => {
    const column = Columns.createDateColumn(12);
    const entry: Entry = {
      id: '1',
      name: 'test.txt',
      type: EntryType.File,
      path: 'test.txt',
      modified: new Date('2023-12-25T10:30:00Z'),
    };

    const result = column.render(entry);
    expect(result).toBe('12/25/23    ');
  });

  it('should use default width', () => {
    const column = Columns.createDateColumn();
    expect(column.width).toBe(12);
  });

  it('should color dates dark gray', () => {
    const column = Columns.createDateColumn();
    const entry: Entry = {
      id: '1',
      name: 'test.txt',
      type: EntryType.File,
      path: 'test.txt',
    };

    const color = column.color!(entry, false);
    expect(color).toBe('#6c7086');
  });
});