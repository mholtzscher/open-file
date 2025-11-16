/**
 * Tests for entry ID generation and management
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { generateEntryId, isValidEntryId, EntryIdMap } from './entry-id.js';

describe('generateEntryId', () => {
  it('should generate valid entry IDs', () => {
    const id1 = generateEntryId();
    const id2 = generateEntryId();
    
    expect(isValidEntryId(id1)).toBe(true);
    expect(isValidEntryId(id2)).toBe(true);
  });

  it('should generate unique IDs', () => {
    const ids = new Set();
    for (let i = 0; i < 1000; i++) {
      ids.add(generateEntryId());
    }
    
    // All generated IDs should be unique
    expect(ids.size).toBe(1000);
  });

  it('should generate IDs with correct format', () => {
    const id = generateEntryId();
    
    // Should match format: entry_<timestamp>_<random>
    expect(id).toMatch(/^entry_[a-z0-9]+_[a-f0-9]{16}$/);
  });

  it('should generate IDs that start with "entry_"', () => {
    const id = generateEntryId();
    expect(id.startsWith('entry_')).toBe(true);
  });
});

describe('isValidEntryId', () => {
  it('should validate correct entry IDs', () => {
    const validIds = [
      'entry_abc123_0123456789abcdef',
      'entry_z9x8y7_fedcba9876543210',
      'entry_1a2b3c_aaaaaaaaaaaaaaaa',
    ];
    
    for (const id of validIds) {
      expect(isValidEntryId(id)).toBe(true);
    }
  });

  it('should reject invalid formats', () => {
    const invalidIds = [
      'entry_abc123',                    // Missing random part
      'entry_abc123_123',                // Random part too short
      'entry_abc123_0123456789abcdefgh', // Random part too long
      'entry_ABC123_0123456789abcdef',   // Uppercase in timestamp
      'entry_abc123_0123456789ABCDEF',   // Uppercase in random
      'notentry_abc123_0123456789abcdef', // Wrong prefix
      'entry-abc123-0123456789abcdef',   // Wrong separator
      '',                                 // Empty string
      'random_string',                    // Random string
    ];
    
    for (const id of invalidIds) {
      expect(isValidEntryId(id)).toBe(false);
    }
  });
});

describe('EntryIdMap', () => {
  let map: EntryIdMap;

  beforeEach(() => {
    map = new EntryIdMap();
  });

  describe('registerEntry', () => {
    it('should register entry with ID', () => {
      map.registerEntry('path/to/file.txt', 'entry_123_abc');
      
      expect(map.getId('path/to/file.txt')).toBe('entry_123_abc');
      expect(map.getPath('entry_123_abc')).toBe('path/to/file.txt');
    });

    it('should handle re-registration with same ID', () => {
      map.registerEntry('path/to/file.txt', 'entry_123_abc');
      map.registerEntry('path/to/file.txt', 'entry_123_abc');
      
      expect(map.getId('path/to/file.txt')).toBe('entry_123_abc');
      expect(map.size).toBe(1);
    });

    it('should update ID when path is re-registered with different ID', () => {
      map.registerEntry('path/to/file.txt', 'entry_123_abc');
      map.registerEntry('path/to/file.txt', 'entry_456_def');
      
      expect(map.getId('path/to/file.txt')).toBe('entry_456_def');
      expect(map.getPath('entry_123_abc')).toBeUndefined();
      expect(map.getPath('entry_456_def')).toBe('path/to/file.txt');
      expect(map.size).toBe(1);
    });

    it('should handle multiple entries', () => {
      map.registerEntry('file1.txt', 'entry_1_aaa');
      map.registerEntry('file2.txt', 'entry_2_bbb');
      map.registerEntry('file3.txt', 'entry_3_ccc');
      
      expect(map.size).toBe(3);
      expect(map.getId('file1.txt')).toBe('entry_1_aaa');
      expect(map.getId('file2.txt')).toBe('entry_2_bbb');
      expect(map.getId('file3.txt')).toBe('entry_3_ccc');
    });
  });

  describe('getId', () => {
    it('should return ID for registered path', () => {
      map.registerEntry('path/to/file.txt', 'entry_123_abc');
      expect(map.getId('path/to/file.txt')).toBe('entry_123_abc');
    });

    it('should return undefined for unregistered path', () => {
      expect(map.getId('nonexistent/path.txt')).toBeUndefined();
    });
  });

  describe('getPath', () => {
    it('should return path for registered ID', () => {
      map.registerEntry('path/to/file.txt', 'entry_123_abc');
      expect(map.getPath('entry_123_abc')).toBe('path/to/file.txt');
    });

    it('should return undefined for unregistered ID', () => {
      expect(map.getPath('entry_999_zzz')).toBeUndefined();
    });
  });

  describe('hasEntry', () => {
    it('should return true for registered path', () => {
      map.registerEntry('path/to/file.txt', 'entry_123_abc');
      expect(map.hasEntry('path/to/file.txt')).toBe(true);
    });

    it('should return false for unregistered path', () => {
      expect(map.hasEntry('nonexistent/path.txt')).toBe(false);
    });
  });

  describe('getAllEntries', () => {
    it('should return empty array for empty map', () => {
      expect(map.getAllEntries()).toEqual([]);
    });

    it('should return all entries', () => {
      map.registerEntry('file1.txt', 'entry_1_aaa');
      map.registerEntry('file2.txt', 'entry_2_bbb');
      map.registerEntry('file3.txt', 'entry_3_ccc');
      
      const entries = map.getAllEntries();
      expect(entries).toHaveLength(3);
      expect(entries).toContainEqual(['file1.txt', 'entry_1_aaa']);
      expect(entries).toContainEqual(['file2.txt', 'entry_2_bbb']);
      expect(entries).toContainEqual(['file3.txt', 'entry_3_ccc']);
    });
  });

  describe('removeEntry', () => {
    it('should remove entry from map', () => {
      map.registerEntry('path/to/file.txt', 'entry_123_abc');
      
      expect(map.hasEntry('path/to/file.txt')).toBe(true);
      
      map.removeEntry('path/to/file.txt');
      
      expect(map.hasEntry('path/to/file.txt')).toBe(false);
      expect(map.getId('path/to/file.txt')).toBeUndefined();
      expect(map.getPath('entry_123_abc')).toBeUndefined();
    });

    it('should handle removing non-existent entry', () => {
      expect(() => map.removeEntry('nonexistent/path.txt')).not.toThrow();
    });

    it('should decrease size when entry is removed', () => {
      map.registerEntry('file1.txt', 'entry_1_aaa');
      map.registerEntry('file2.txt', 'entry_2_bbb');
      
      expect(map.size).toBe(2);
      
      map.removeEntry('file1.txt');
      
      expect(map.size).toBe(1);
    });
  });

  describe('clear', () => {
    it('should clear all entries', () => {
      map.registerEntry('file1.txt', 'entry_1_aaa');
      map.registerEntry('file2.txt', 'entry_2_bbb');
      map.registerEntry('file3.txt', 'entry_3_ccc');
      
      expect(map.size).toBe(3);
      
      map.clear();
      
      expect(map.size).toBe(0);
      expect(map.getAllEntries()).toEqual([]);
    });

    it('should handle clearing empty map', () => {
      expect(() => map.clear()).not.toThrow();
      expect(map.size).toBe(0);
    });
  });

  describe('size', () => {
    it('should return 0 for empty map', () => {
      expect(map.size).toBe(0);
    });

    it('should return correct size', () => {
      map.registerEntry('file1.txt', 'entry_1_aaa');
      expect(map.size).toBe(1);
      
      map.registerEntry('file2.txt', 'entry_2_bbb');
      expect(map.size).toBe(2);
      
      map.registerEntry('file3.txt', 'entry_3_ccc');
      expect(map.size).toBe(3);
    });
  });

  describe('integration scenarios', () => {
    it('should handle entry renaming', () => {
      // Original entry
      const id = 'entry_123_abc';
      map.registerEntry('original/path.txt', id);
      
      // Rename: remove old path, add new path with same ID
      map.removeEntry('original/path.txt');
      map.registerEntry('new/path.txt', id);
      
      expect(map.getId('original/path.txt')).toBeUndefined();
      expect(map.getId('new/path.txt')).toBe(id);
      expect(map.getPath(id)).toBe('new/path.txt');
    });

    it('should track multiple renames of same entry', () => {
      const id = 'entry_123_abc';
      
      // Path 1
      map.registerEntry('path1.txt', id);
      expect(map.getPath(id)).toBe('path1.txt');
      
      // Rename to path 2
      map.removeEntry('path1.txt');
      map.registerEntry('path2.txt', id);
      expect(map.getPath(id)).toBe('path2.txt');
      
      // Rename to path 3
      map.removeEntry('path2.txt');
      map.registerEntry('path3.txt', id);
      expect(map.getPath(id)).toBe('path3.txt');
      
      // Only current path should exist
      expect(map.size).toBe(1);
      expect(map.getId('path1.txt')).toBeUndefined();
      expect(map.getId('path2.txt')).toBeUndefined();
      expect(map.getId('path3.txt')).toBe(id);
    });

    it('should handle swapping paths between entries', () => {
      const id1 = 'entry_1_aaa';
      const id2 = 'entry_2_bbb';
      
      map.registerEntry('pathA.txt', id1);
      map.registerEntry('pathB.txt', id2);
      
      // Swap paths
      map.removeEntry('pathA.txt');
      map.removeEntry('pathB.txt');
      map.registerEntry('pathA.txt', id2);
      map.registerEntry('pathB.txt', id1);
      
      expect(map.getId('pathA.txt')).toBe(id2);
      expect(map.getId('pathB.txt')).toBe(id1);
      expect(map.size).toBe(2);
    });
  });
});
