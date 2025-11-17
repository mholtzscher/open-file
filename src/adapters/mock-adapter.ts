import { Adapter, ListOptions, ListResult } from './adapter.js';
import { Entry, EntryType } from '../types/entry.js';

/**
 * In-memory entry for MockAdapter
 */
interface MockEntry extends Entry {
  content?: Buffer | string;
  children?: Map<string, MockEntry>;
}

/**
 * MockAdapter - In-memory adapter for testing
 *
 * Useful for testing the UI without connecting to S3
 */
export class MockAdapter implements Adapter {
  readonly name = 'mock';
  private entries: Map<string, MockEntry> = new Map();
  private idCounter = 0;

  constructor() {
    // Seed with some default test data
    this.seedTestData();
  }

  /**
   * Seed the adapter with test data
   */
  private seedTestData(): void {
    const now = new Date();

    // Root bucket
    this.entries.set('test-bucket/', {
      id: this.generateId(),
      name: 'test-bucket',
      type: EntryType.Directory,
      path: 'test-bucket/',
      modified: now,
      children: new Map(),
    });

    // Add some sample files and directories
    this.createSync('test-bucket/documents/', EntryType.Directory);
    this.createSync('test-bucket/images/', EntryType.Directory);
    this.createSync('test-bucket/videos/', EntryType.Directory);
    this.createSync('test-bucket/scrollable/', EntryType.Directory);

    this.createSync('test-bucket/README.md', EntryType.File, 'Hello from mock S3!');
    this.createSync('test-bucket/config.json', EntryType.File, '{"version": "1.0"}');

    this.createSync('test-bucket/documents/report.pdf', EntryType.File, 'PDF content...');
    this.createSync('test-bucket/documents/notes.txt', EntryType.File, 'My notes here');

    this.createSync('test-bucket/images/photo1.jpg', EntryType.File, 'JPEG binary data');
    this.createSync('test-bucket/images/photo2.png', EntryType.File, 'PNG binary data');

    // Add 100 fake files to scrollable directory for testing page scrolling
    for (let i = 1; i <= 100; i++) {
      const paddedNumber = i.toString().padStart(3, '0');
      this.createSync(
        `test-bucket/scrollable/file-${paddedNumber}.txt`,
        EntryType.File,
        `Content of file ${i}`
      );
    }
  }

  /**
   * Generate unique entry ID
   */
  private generateId(): string {
    return `mock-${this.idCounter++}`;
  }

  /**
   * Normalize path (ensure trailing slash for directories)
   */
  private normalizePath(path: string, isDirectory: boolean = false): string {
    let normalized = path.replace(/\/+/g, '/').replace(/^\//, '');
    if (isDirectory && !normalized.endsWith('/')) {
      normalized += '/';
    }
    return normalized;
  }

  /**
   * Synchronous create for seeding
   */
  private createSync(path: string, type: EntryType, content?: Buffer | string): void {
    const normalized = this.normalizePath(path, type === EntryType.Directory);
    const parts = normalized.split('/').filter(p => p);
    const name = parts[parts.length - 1] || '';

    const entry: MockEntry = {
      id: this.generateId(),
      name,
      type,
      path: normalized,
      modified: new Date(),
      size: type === EntryType.File && content ? Buffer.from(content).length : undefined,
      content,
      children: type === EntryType.Directory ? new Map() : undefined,
    };

    this.entries.set(normalized, entry);
  }

  async list(path: string, options?: ListOptions): Promise<ListResult> {
    // For mock adapter, if path is empty, list root as "test-bucket/"
    const listPath = path === '' ? 'test-bucket/' : path;
    const normalized = this.normalizePath(listPath, true);
    const entries: Entry[] = [];

    // Find all entries that are direct children of this path
    for (const [entryPath, entry] of this.entries) {
      if (entryPath === normalized) continue; // Skip the directory itself

      // Check if this is a direct child
      if (entryPath.startsWith(normalized)) {
        const relativePath = entryPath.substring(normalized.length);
        const parts = relativePath.split('/').filter(p => p);

        // Direct child: only one part (for files) or first part (for subdirs)
        if (parts.length === 1 || (parts.length === 2 && entryPath.endsWith('/'))) {
          entries.push({
            id: entry.id,
            name: entry.name,
            type: entry.type,
            path: entry.path,
            size: entry.size,
            modified: entry.modified,
            metadata: entry.metadata,
          });
        }
      }
    }

    // Sort: directories first, then by name
    entries.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === EntryType.Directory ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return {
      entries,
      hasMore: false,
    };
  }

  async getMetadata(path: string): Promise<Entry> {
    const normalized = this.normalizePath(path);
    const entry = this.entries.get(normalized) || this.entries.get(normalized + '/');

    if (!entry) {
      throw new Error(`Entry not found: ${path}`);
    }

    return {
      id: entry.id,
      name: entry.name,
      type: entry.type,
      path: entry.path,
      size: entry.size,
      modified: entry.modified,
      metadata: entry.metadata,
    };
  }

  async create(
    path: string,
    type: EntryType,
    content?: Buffer | string,
    _options?: any
  ): Promise<void> {
    this.createSync(path, type, content);
  }

  async delete(path: string, recursive?: boolean, _options?: any): Promise<void> {
    const normalized = this.normalizePath(path);
    const toDelete: string[] = [];

    // Find all entries to delete
    for (const entryPath of this.entries.keys()) {
      if (entryPath === normalized || (recursive && entryPath.startsWith(normalized))) {
        toDelete.push(entryPath);
      }
    }

    if (toDelete.length === 0) {
      throw new Error(`Entry not found: ${path}`);
    }

    toDelete.forEach(p => this.entries.delete(p));
  }

  async move(source: string, destination: string, _options?: any): Promise<void> {
    const srcNormalized = this.normalizePath(source);
    const entry = this.entries.get(srcNormalized) || this.entries.get(srcNormalized + '/');

    if (!entry) {
      throw new Error(`Source not found: ${source}`);
    }

    // Delete from source
    this.entries.delete(srcNormalized);
    if (entry.type === EntryType.Directory) {
      this.entries.delete(srcNormalized + '/');
    }

    // Create at destination
    const destNormalized = this.normalizePath(destination, entry.type === EntryType.Directory);
    const parts = destNormalized.split('/').filter(p => p);
    const name = parts[parts.length - 1] || '';

    this.entries.set(destNormalized, {
      ...entry,
      name,
      path: destNormalized,
    });
  }

  async copy(source: string, destination: string, _options?: any): Promise<void> {
    const srcNormalized = this.normalizePath(source);
    const entry = this.entries.get(srcNormalized) || this.entries.get(srcNormalized + '/');

    if (!entry) {
      throw new Error(`Source not found: ${source}`);
    }

    // Create copy at destination
    const destNormalized = this.normalizePath(destination, entry.type === EntryType.Directory);
    const parts = destNormalized.split('/').filter(p => p);
    const name = parts[parts.length - 1] || '';

    this.entries.set(destNormalized, {
      ...entry,
      id: this.generateId(), // New ID for the copy
      name,
      path: destNormalized,
    });
  }

  async exists(path: string): Promise<boolean> {
    const normalized = this.normalizePath(path);
    return this.entries.has(normalized) || this.entries.has(normalized + '/');
  }

  async read(path: string, _options?: any): Promise<Buffer> {
    const normalized = this.normalizePath(path);
    const entry = this.entries.get(normalized);

    if (!entry) {
      throw new Error(`Entry not found: ${path}`);
    }

    if (entry.type === EntryType.Directory) {
      throw new Error(`Cannot read directory: ${path}`);
    }

    const content = entry.content || '';
    return Buffer.from(content);
  }

  /**
   * Get list of buckets (for root view)
   * Returns mock buckets for testing
   */
  async getBucketEntries(): Promise<Entry[]> {
    return [
      {
        id: 'bucket-1',
        name: 'test-bucket',
        type: EntryType.Bucket,
        path: 'test-bucket',
        modified: new Date(),
        metadata: {
          region: 'us-east-1',
          createdAt: new Date('2024-01-01'),
        },
      },
      {
        id: 'bucket-2',
        name: 'demo-bucket',
        type: EntryType.Bucket,
        path: 'demo-bucket',
        modified: new Date(),
        metadata: {
          region: 'us-west-2',
          createdAt: new Date('2024-02-01'),
        },
      },
    ];
  }
}
