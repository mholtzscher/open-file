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
    let icon: string;
    switch (entry.type) {
      case EntryType.Directory:
        icon = '📁';
        break;
      case EntryType.Bucket:
        icon = '🪣';
        break;
      default:
        icon = '📄';
    }
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
    let suffix = '';
    if (entry.type === EntryType.Directory) {
      suffix = '/';
    } else if (entry.type === EntryType.Bucket) {
      // Buckets don't get a suffix in root view
      suffix = '';
    }
    const name = entry.name + suffix;
    // Truncate if too long to prevent overflow
    const truncatedName = name.length > this.width ? name.slice(0, this.width - 3) + '...' : name;
    // Add extra space after column
    return padString(truncatedName, this.width, this.align) + '  ';
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
 * Bucket region column - shows S3 bucket region (root view only)
 */
export class BucketRegionColumn implements Column {
  id = 'bucket-region';
  name = 'Region';
  width = 12;
  visible = true;
  align: 'left' | 'right' | 'center' = 'left';

  render(entry: Entry): string {
    const region = entry.metadata?.region;
    if (!region || entry.type !== EntryType.Bucket) {
      return padString('-', this.width, this.align) + ' ';
    }

    return padString(region, this.width, this.align) + ' ';
  }
}

/**
 * Bucket created date column - shows bucket creation date (root view only)
 */
export class BucketCreatedColumn implements Column {
  id = 'bucket-created';
  name = 'Created';
  width = 10;
  visible = true;
  align: 'left' | 'right' | 'center' = 'left';

  render(entry: Entry): string {
    if (entry.type !== EntryType.Bucket) {
      return padString('-', this.width, this.align);
    }

    const createdAt = entry.metadata?.createdAt;
    if (!createdAt) {
      return padString('-', this.width, this.align);
    }

    const date = createdAt instanceof Date ? createdAt : new Date(createdAt);
    const formatted = date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: '2-digit',
    });

    return padString(formatted, this.width, this.align);
  }
}

/**
 * ETag column (S3-specific) - shows object ETag hash
 */
export class ETagColumn implements Column {
  id = 'etag';
  name = 'ETag';
  width = 20;
  visible = false; // Hidden by default
  align: 'left' | 'right' | 'center' = 'left';

  render(entry: Entry): string {
    const etag = entry.metadata?.etag;
    if (!etag) {
      return padString('-', this.width, this.align);
    }

    // ETags can be long, show first part with ellipsis
    const shortened = etag.length > this.width ? etag.slice(0, this.width - 3) + '...' : etag;
    return padString(shortened, this.width, this.align) + ' ';
  }
}

/**
 * Content Type column (S3-specific) - shows MIME type
 */
export class ContentTypeColumn implements Column {
  id = 'content-type';
  name = 'Type';
  width = 16;
  visible = false; // Hidden by default
  align: 'left' | 'right' | 'center' = 'left';

  render(entry: Entry): string {
    if (entry.type === EntryType.Directory) {
      return padString('dir', this.width, this.align) + ' ';
    }

    const contentType = entry.metadata?.contentType;
    if (!contentType) {
      return padString('-', this.width, this.align) + ' ';
    }

    // Shorten common MIME types for display
    const shortened = contentType
      .replace('application/json', 'JSON')
      .replace('application/xml', 'XML')
      .replace('application/pdf', 'PDF')
      .replace('text/plain', 'TXT')
      .replace('text/html', 'HTML')
      .replace('text/css', 'CSS')
      .replace('text/javascript', 'JS')
      .replace('image/png', 'PNG')
      .replace('image/jpeg', 'JPEG')
      .replace('image/gif', 'GIF')
      .replace('video/mp4', 'MP4')
      .replace('audio/mpeg', 'MP3');

    // Use original or shortened, whichever fits better
    const display =
      shortened.length > this.width ? shortened.slice(0, this.width - 3) + '...' : shortened;
    return padString(display, this.width, this.align) + ' ';
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
    new ETagColumn(),
    new ContentTypeColumn(),
  ];
}

/**
 * Bucket root view column configuration (for listing S3 buckets)
 */
export function getBucketColumns(): Column[] {
  return [new IconColumn(), new NameColumn(), new BucketRegionColumn(), new BucketCreatedColumn()];
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
