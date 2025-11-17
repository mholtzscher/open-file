/**
 * Column system for entry display
 *
 * Provides a flexible, configurable column system for displaying entry information.
 * Similar to ls -l or ranger's column view.
 */

import { Entry, EntryType } from '../types/entry.js';

/**
 * Column interface - defines how to render a column
 */
export interface Column {
  /** Unique identifier for the column */
  id: string;
  /** Display name of the column */
  name: string;
  /** Width in characters (undefined = auto) */
  width?: number;
  /** Minimum width in characters */
  minWidth?: number;
  /** Whether this column is visible */
  visible: boolean;
  /** Render function - returns the string to display */
  render: (entry: Entry) => string;
  /** Alignment: 'left' | 'right' | 'center' */
  align?: 'left' | 'right' | 'center';
}

/**
 * Pad string to width with alignment
 */
function padString(
  str: string,
  width: number,
  align: 'left' | 'right' | 'center' = 'left'
): string {
  if (str.length >= width) {
    return str.slice(0, width);
  }

  const padding = width - str.length;

  switch (align) {
    case 'right':
      return ' '.repeat(padding) + str;
    case 'center':
      const leftPad = Math.floor(padding / 2);
      const rightPad = padding - leftPad;
      return ' '.repeat(leftPad) + str + ' '.repeat(rightPad);
    case 'left':
    default:
      return str + ' '.repeat(padding);
  }
}

/**
 * Icon column - shows file type icon
 */
export class IconColumn implements Column {
  id = 'icon';
  name = 'Icon';
  width = 3;
  visible = true;
  align: 'left' | 'right' | 'center' = 'left';

  render(entry: Entry): string {
    const icon = entry.type === EntryType.Directory ? '📁' : '📄';
    // Emojis can be 2 chars wide, just add one space after
    return icon + ' ';
  }
}

/**
 * Name column - shows entry name
 */
export class NameColumn implements Column {
  id = 'name';
  name = 'Name';
  width = 35;
  minWidth = 20;
  visible = true;
  align: 'left' | 'right' | 'center' = 'left';

  render(entry: Entry): string {
    const suffix = entry.type === EntryType.Directory ? '/' : '';
    const name = entry.name + suffix;
    // Add extra space after column
    return padString(name, this.width, this.align) + '  ';
  }
}

/**
 * Size column - shows file size
 */
export class SizeColumn implements Column {
  id = 'size';
  name = 'Size';
  width = 8;
  visible = true;
  align: 'left' | 'right' | 'center' = 'right';

  render(entry: Entry): string {
    if (entry.type === EntryType.Directory) {
      return padString('-', this.width, this.align) + ' ';
    }

    const size = entry.size ?? 0;
    let formatted: string;

    if (size >= 1024 * 1024 * 1024) {
      formatted = `${(size / (1024 * 1024 * 1024)).toFixed(1)}GB`;
    } else if (size >= 1024 * 1024) {
      formatted = `${(size / (1024 * 1024)).toFixed(1)}MB`;
    } else if (size >= 1024) {
      formatted = `${(size / 1024).toFixed(1)}KB`;
    } else {
      formatted = `${size}B`;
    }

    return padString(formatted, this.width, this.align) + ' ';
  }
}

/**
 * Date column - shows last modified date
 */
export class DateColumn implements Column {
  id = 'modified';
  name = 'Modified';
  width = 10;
  visible = true;
  align: 'left' | 'right' | 'center' = 'left';

  render(entry: Entry): string {
    if (!entry.modified) {
      return padString('-', this.width, this.align);
    }

    const date = entry.modified instanceof Date ? entry.modified : new Date(entry.modified);
    const formatted = date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: '2-digit',
    });

    return padString(formatted, this.width, this.align);
  }
}

/**
 * Storage class column (S3-specific)
 */
export class StorageClassColumn implements Column {
  id = 'storage-class';
  name = 'Storage';
  width = 12;
  visible = false; // Hidden by default
  align: 'left' | 'right' | 'center' = 'left';

  render(entry: Entry): string {
    const storageClass = entry.metadata?.storageClass;
    if (!storageClass) {
      return padString('-', this.width, this.align);
    }

    // Shorten common storage class names
    const shortened = storageClass
      .replace('STANDARD', 'STD')
      .replace('INTELLIGENT_TIERING', 'INT')
      .replace('GLACIER', 'GLA')
      .replace('DEEP_ARCHIVE', 'DEEP');

    return padString(shortened, this.width, this.align);
  }
}

/**
 * Column configuration
 */
export interface ColumnConfig {
  columns: Column[];
}

/**
 * Default column configuration
 */
export function getDefaultColumns(): Column[] {
  return [
    new IconColumn(),
    new NameColumn(),
    new SizeColumn(),
    new DateColumn(),
    new StorageClassColumn(),
  ];
}

/**
 * Render a row using the column configuration
 */
export function renderRow(entry: Entry, columns: Column[]): string {
  const parts: string[] = [];

  for (const column of columns) {
    if (column.visible) {
      parts.push(column.render(entry));
    }
  }

  // Columns already have padding, no need for extra separator
  return parts.join('');
}

/**
 * Get total width of all visible columns
 */
export function getTotalWidth(columns: Column[]): number {
  return columns.filter(col => col.visible).reduce((total, col) => total + (col.width || 0) + 1, 0); // +1 for spacing
}

/**
 * Toggle column visibility
 */
export function toggleColumn(columns: Column[], columnId: string): Column[] {
  return columns.map(col => (col.id === columnId ? { ...col, visible: !col.visible } : col));
}

/**
 * Set column width
 */
export function setColumnWidth(columns: Column[], columnId: string, width: number): Column[] {
  return columns.map(col => (col.id === columnId ? { ...col, width } : col));
}
