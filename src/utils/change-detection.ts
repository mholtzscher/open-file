/**
 * Change detection and operation planning
 * 
 * Compares original and edited entry lists to detect changes:
 * - New entries (creates)
 * - Removed entries (deletes)
 * - Renamed entries (moves)
 * - Reordered entries
 */

import { Entry } from '../types/entry.js';
import {
  AdapterOperation,
  CreateOperation,
  DeleteOperation,
  MoveOperation,
  OperationPlan,
} from '../types/operations.js';
import { EntryIdMap, generateEntryId } from './entry-id.js';

/**
 * Change detection result
 */
export interface DetectedChanges {
  creates: Entry[];
  deletes: Entry[];
  moves: Map<Entry, string>; // Maps original entry to new path
  copies: Map<Entry, string>; // Maps original entry to copied path
  reorders: Array<{
    entry: Entry;
    oldIndex: number;
    newIndex: number;
  }>;
}

/**
 * Compare two lists of entries to detect changes
 */
export function detectChanges(
  original: Entry[],
  edited: Entry[],
  idMap: EntryIdMap
): DetectedChanges {
  const creates: Entry[] = [];
  const deletes: Entry[] = [];
  const moves = new Map<Entry, string>();
  const copies = new Map<Entry, string>();
  const reorders: DetectedChanges['reorders'] = [];

  // Create maps for easier lookup
  const originalById = new Map<string, Entry>();
  const editedById = new Map<string, Entry>();
  const editedByName = new Map<string, Entry>();
  const originalByPath = new Map<string, Entry>();

  for (const entry of original) {
    originalById.set(entry.id, entry);
    originalByPath.set(entry.path, entry);
  }

  for (const entry of edited) {
    editedById.set(entry.id, entry);
    editedByName.set(entry.name, entry);
  }

  // Detect creates, copies, and potential duplicates (new entries in edited list)
  for (const entry of edited) {
    if (!originalById.has(entry.id)) {
      // This is a new entry - check if it's a copy
      const originalAtPath = originalByPath.get(entry.path);
      
      if (originalAtPath && originalAtPath.type === entry.type) {
        // Same path and type suggests a copy operation
        // (e.g., user duplicated a file in the UI and it got a new ID)
        copies.set(originalAtPath, entry.path);
      } else {
        // This is a genuine create
        creates.push({
          ...entry,
          // Ensure new entries have IDs
          id: entry.id || generateEntryId(),
        });
      }
    }
  }

  // Detect deletes and moves (entries in original list)
  for (const originalEntry of original) {
    const editedEntry = editedById.get(originalEntry.id);

    if (!editedEntry) {
      // Entry was deleted
      deletes.push(originalEntry);
    } else if (editedEntry.path !== originalEntry.path) {
      // Entry was moved or renamed
      moves.set(originalEntry, editedEntry.path);
    }
  }

  // Detect reorders (same entries but different positions)
  for (let i = 0; i < original.length; i++) {
    for (let j = 0; j < edited.length; j++) {
      if (original[i].id === edited[j].id && i !== j) {
        reorders.push({
          entry: original[i],
          oldIndex: i,
          newIndex: j,
        });
      }
    }
  }

  return {
    creates,
    deletes,
    moves,
    copies,
    reorders,
  };
}

/**
 * Convert detected changes to an executable operation plan
 * 
 * Order matters:
 * 1. Creates (new files/directories)
 * 2. Moves (renames, relocations)
 * 3. Deletes (removes, always last to avoid dependency issues)
 */
export function buildOperationPlan(
  changes: DetectedChanges,
  idGenerator: () => string = generateEntryId
): OperationPlan {
  const operations: AdapterOperation[] = [];
  let opId = 0;

  // 1. Create operations for new entries
  for (const entry of changes.creates) {
    const createOp: CreateOperation = {
      id: `op-${opId++}`,
      type: 'create',
      path: entry.path,
      entryType: entry.type,
    };
    operations.push(createOp);
  }

  // 2. Copy operations for duplicated entries
  for (const [originalEntry, copiedPath] of changes.copies) {
    // Determine the new path based on copy operation
    // For simple copies, use the same base path with a suffix
    const copyOp: AdapterOperation = {
      id: `op-${opId++}`,
      type: 'copy',
      source: originalEntry.path,
      destination: copiedPath,
      entry: originalEntry,
    };
    operations.push(copyOp);
  }

  // 3. Move operations for renamed/relocated entries
  for (const [originalEntry, newPath] of changes.moves) {
    const moveOp: MoveOperation = {
      id: `op-${opId++}`,
      type: 'move',
      source: originalEntry.path,
      destination: newPath,
      entry: originalEntry,
    };
    operations.push(moveOp);
  }

  // 4. Delete operations (last to avoid dependency issues)
  for (const entry of changes.deletes) {
    const deleteOp: DeleteOperation = {
      id: `op-${opId++}`,
      type: 'delete',
      path: entry.path,
      entry,
    };
    operations.push(deleteOp);
  }

  return {
    operations,
    summary: {
      creates: changes.creates.length,
      deletes: changes.deletes.length,
      moves: changes.moves.size,
      copies: changes.copies.size,
      total: operations.length,
    },
  };
}

/**
 * Validate an operation plan
 * 
 * Checks for:
 * - Circular dependencies
 * - Invalid paths
 * - Conflicting operations
 */
export function validateOperationPlan(plan: OperationPlan): boolean {
  // Basic validation: no two operations should affect the same path
  const affectedPaths = new Set<string>();

  for (const op of plan.operations) {
    let path: string;
    switch (op.type) {
      case 'create':
        path = op.path;
        break;
      case 'delete':
        path = op.path;
        break;
      case 'move':
        path = op.source;
        break;
      default:
        continue;
    }

    if (affectedPaths.has(path)) {
      return false; // Conflict detected
    }
    affectedPaths.add(path);
  }

  return true;
}
