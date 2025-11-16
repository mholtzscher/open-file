/**
 * Entry ID generation and management utilities
 * 
 * Entry IDs uniquely identify entries across buffer edits.
 * This allows us to track which entries have been renamed, moved, or deleted.
 */

import { randomBytes } from 'crypto';

/**
 * Generate a unique entry ID
 * 
 * Uses a combination of timestamp and random bytes for uniqueness
 * Format: "entry_<timestamp>_<random>"
 */
export function generateEntryId(): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(8).toString('hex');
  return `entry_${timestamp}_${random}`;
}

/**
 * Validate if a string is a valid entry ID
 */
export function isValidEntryId(id: string): boolean {
  return /^entry_[a-z0-9]+_[a-f0-9]{16}$/.test(id);
}

/**
 * Map for tracking entry IDs during buffer edits
 * 
 * Maintains mapping from entry path to ID so we can track changes
 */
export class EntryIdMap {
  private pathToId: Map<string, string> = new Map();
  private idToPath: Map<string, string> = new Map();

  /**
   * Register an entry with its ID
   */
  registerEntry(path: string, id: string): void {
    // If path already has a different ID, clean up old mapping
    const existingId = this.pathToId.get(path);
    if (existingId && existingId !== id) {
      this.idToPath.delete(existingId);
    }

    this.pathToId.set(path, id);
    this.idToPath.set(id, path);
  }

  /**
   * Get ID for a path
   */
  getId(path: string): string | undefined {
    return this.pathToId.get(path);
  }

  /**
   * Get path for an ID
   */
  getPath(id: string): string | undefined {
    return this.idToPath.get(id);
  }

  /**
   * Check if an entry is registered
   */
  hasEntry(path: string): boolean {
    return this.pathToId.has(path);
  }

  /**
   * Get all registered entries
   */
  getAllEntries(): Array<[path: string, id: string]> {
    return Array.from(this.pathToId.entries());
  }

  /**
   * Remove an entry from the map
   */
  removeEntry(path: string): void {
    const id = this.pathToId.get(path);
    if (id) {
      this.pathToId.delete(path);
      this.idToPath.delete(id);
    }
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.pathToId.clear();
    this.idToPath.clear();
  }

  /**
   * Get size of the map
   */
  get size(): number {
    return this.pathToId.size;
  }
}
