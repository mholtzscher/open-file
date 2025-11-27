# Pending Changes Tracking System - Comprehensive Guide

## Overview

This open-s3 file manager implements an **oil.nvim-style pending changes system** that tracks modifications (deletes, creates, moves) before they are applied to S3. The system uses a multi-layered approach combining buffer state, dialog state, and progressive UI feedback.

**Key Philosophy**: Changes are never applied immediately. Users can see what will happen, undo changes, and confirm before syncing to S3.

---

## 1. Core Data Structures

### 1.1 Buffer State (useBufferState Hook)

**File**: `src/hooks/useBufferState.ts`

The heart of pending changes tracking. Manages the in-memory state of entries with deletion marks.

```typescript
export interface UseBufferStateReturn {
  // Entry management
  entries: Entry[];                        // Current visible entries
  originalEntries: Entry[];                // Unmodified entries
  
  // Deletion tracking (core of pending changes system)
  deletedEntryIds: Set<string>;            // IDs of entries marked for deletion
  
  // Deletion operations
  markForDeletion: (entryId: string) => void;
  unmarkForDeletion: (entryId: string) => void;
  isMarkedForDeletion: (entryId: string) => boolean;
  getMarkedForDeletion: () => Entry[];     // Get all marked entries
  clearDeletionMarks: () => void;          // Clear all marks
  
  // Snapshots for undo/redo
  saveSnapshot: () => void;                // Save current state to undo history
  undo: () => boolean;
  redo: () => boolean;
  
  // ... other state
}
```

**How it works**:
1. `deletedEntryIds` is a `Set<string>` tracking which entries are marked for deletion
2. When user presses `dd` (vim-style delete), entry is marked but NOT removed from view
3. Entry stays in `entries` array but appears with strikethrough + red color
4. Changes are non-destructive until explicitly synced with `w` (save)

### 1.2 Dialog State (useDialogState Hook)

**File**: `src/hooks/useDialogState.ts`

Manages pending operations ready to be confirmed and executed.

```typescript
export interface DialogState {
  activeDialog: DialogType;           // Which dialog is open
  pendingOperations: PendingOperation[];  // Operations waiting for confirmation
  quitPendingChanges: number;         // Count of pending deletes for quit dialog
}

export interface PendingOperation {
  id: string;
  type: 'create' | 'delete' | 'move' | 'copy' | 'download' | 'upload';
  path?: string;                      // For single-path operations
  source?: string;                    // For source/dest operations
  destination?: string;
  entry?: Entry;                      // Associated entry
  entryType?: 'file' | 'directory';
  recursive?: boolean;
}
```

**Flow**:
1. `pendingOperations` is a list of operations waiting for user confirmation
2. When user presses `w` (save), buffer state's marked entries become `PendingOperation` objects
3. User sees confirmation dialog with list of operations
4. User confirms → operations execute sequentially
5. After success → buffer reloads and marks are cleared

### 1.3 Entry Type

**File**: `src/types/entry.ts`

Each entry has metadata for tracking:

```typescript
export interface Entry {
  id: string;           // Unique ID tracked by system
  name: string;
  path: string;         // Full S3 path
  type: 'file' | 'directory' | 'bucket';
  size?: number;
  modified?: Date;
  metadata?: {
    region?: string;
    createdAt?: Date;
  };
}
```

---

## 2. State Management Architecture

### 2.1 Three-Layer Stack

```
┌─────────────────────────────────────────────┐
│ Layer 3: Dialog State (pendingOperations)   │
│ - Operations confirmed but not yet executed │
│ - Shown in confirmation dialog              │
└─────────────────────────────────────────────┘
         ↑                           ↑
         │                           │
    User presses 'w'            Confirm dialog
         │                       
┌─────────────────────────────────────────────┐
│ Layer 2: Buffer State (deletedEntryIds)     │
│ - Entries marked for deletion                │
│ - Show in UI with strikethrough              │
│ - Can be unmarked with 'u' (undo)           │
└─────────────────────────────────────────────┘
         ↑                           ↑
         │                           │
    User presses 'dd'           Entry still visible
         │
┌─────────────────────────────────────────────┐
│ Layer 1: Original State (originalEntries)   │
│ - Committed, unchanged entries              │
│ - Reference point for undo                  │
└─────────────────────────────────────────────┘
```

### 2.2 State Transitions

```
User presses 'dd' on entry
      ↓
bufferState.markForDeletion(entryId)
      ↓
deletedEntryIds.add(entryId)
      ↓
Entry stays in buffer, shows with strikethrough
      ↓
User can press 'u' (undo) to unmark
      ↓
OR User presses 'w' (save)
      ↓
buffer:save action collects marked entries
      ↓
Creates PendingOperation objects for each
      ↓
Passes to showConfirm(pendingOperations)
      ↓
Confirm dialog shows what will happen
      ↓
User confirms
      ↓
createConfirmHandler executes operations
      ↓
adapter.delete() called on S3
      ↓
On success: reload buffer, clear marks
```

---

## 3. How Changes Are Tracked

### 3.1 Marking for Deletion

**File**: `src/ui/s3-explorer.tsx` (lines 318-347)

```typescript
'entry:delete': () => {
  const currentBufferState = getActiveBuffer();
  const selected = currentBufferState.getSelectedEntries();
  
  if (selected.length > 0) {
    currentBufferState.saveSnapshot();  // Snapshot for undo
    
    for (const entry of selected) {
      if (currentBufferState.isMarkedForDeletion(entry.id)) {
        currentBufferState.unmarkForDeletion(entry.id);
      } else {
        currentBufferState.markForDeletion(entry.id);  // Mark or unmark
      }
    }
    
    // Show status
    const markedCount = currentBufferState.getMarkedForDeletion().length;
    setStatusMessage(`${markedCount} item(s) marked for deletion...`);
  }
},
```

**Key Points**:
- When user presses `dd`, `saveSnapshot()` is called first (for undo)
- Entry is marked by adding ID to `deletedEntryIds` Set
- Toggling works: pressing `dd` twice unmarked it
- Status bar shows count of pending deletions

### 3.2 Visual Representation

**File**: `src/ui/buffer-view-react.tsx` (lines 174-189)

Deleted entries are shown with visual indicators:

```typescript
// Check if entry is marked for deletion
const isMarkedForDeletion = bufferState.isMarkedForDeletion(entry.id);

const cursor = isSelected ? '> ' : '  ';
const deleteMarker = isMarkedForDeletion ? '✗ ' : '';  // Add ✗ marker
let content = cursor + deleteMarker + formatEntry(...);

// Apply strikethrough to deleted entries
if (isMarkedForDeletion) {
  content = applyStrikethrough(content);  // Unicode combining char \u0336
}

const color = getEntryColor(entry, isSelected, isMarkedForDeletion);  // Red color
```

**Visual Output**:
```
> ✗ file-to-delete.txt    ← Marked for deletion (strikethrough + red + ✗)
  normal-file.txt         ← Not marked (normal color)
```

### 3.3 Converting Marks to Operations

**File**: `src/ui/s3-explorer.tsx` (lines 446-464)

When user presses `w` (save):

```typescript
'buffer:save': () => {
  const currentBufferState = getActiveBuffer();
  const markedForDeletion = currentBufferState.getMarkedForDeletion();
  
  // Convert marked entries to operations
  const deleteOperations: PendingOperation[] = markedForDeletion.map(entry => ({
    id: entry.id,
    type: 'delete' as const,
    path: entry.path,
    entry,
  }));
  
  if (deleteOperations.length === 0) {
    setStatusMessage('No changes to save');
    return;
  }
  
  // Show confirmation dialog with operations
  showConfirm(deleteOperations);
},
```

---

## 4. Confirmation Dialog System

### 4.1 Dialog State Management

**File**: `src/types/dialog.ts`

```typescript
export interface DialogState {
  activeDialog: DialogType;           // Current active dialog
  pendingOperations: PendingOperation[];  // Operations pending confirmation
  quitPendingChanges: number;         // For quit dialog
}

export type DialogAction =
  | { type: 'SHOW_CONFIRM'; payload: ShowConfirmOptions }
  | { type: 'SHOW_HELP' }
  | { type: 'CLOSE' }
  | { type: 'CLEAR_OPERATIONS' };
```

### 4.2 Showing Confirmation

From `s3-explorer.tsx`:
```typescript
showConfirm(deleteOperations);  // Opens confirmation dialog
```

Triggers:
```typescript
const showConfirm = useCallback((operations: PendingOperation[]) => {
  dispatch({ type: 'SHOW_CONFIRM', payload: { operations } });
}, []);
```

### 4.3 Confirmation Dialog UI

**File**: `src/ui/confirmation-dialog-react.tsx`

User sees:
- List of operations to be executed
- "Confirm" (Return/Enter) or "Cancel" (Escape) buttons
- Operations display:
  ```
  Delete: /bucket/path/file.txt
  Delete: /bucket/path/file2.txt
  ```

---

## 5. Apply/Sync Mechanism

### 5.1 Execution Handler

**File**: `src/ui/s3-explorer.tsx` (lines 731-865)

When user confirms operations:

```typescript
const createConfirmHandler = useCallback(async () => {
  try {
    const abortController = new AbortController();
    let successCount = 0;
    
    // Show progress window
    showProgress({
      title: `Executing ${pendingOperations[0]?.type || 'operation'}...`,
      totalNum: pendingOperations.length,
      cancellable: true,
    });
    
    // Execute each operation sequentially
    for (let opIndex = 0; opIndex < pendingOperations.length; opIndex++) {
      const op = pendingOperations[opIndex];
      
      if (abortController.signal.aborted) break;
      
      try {
        // Update progress
        const progress = Math.round((opIndex / pendingOperations.length) * 100);
        dispatchProgress({
          type: 'UPDATE',
          payload: {
            value: progress,
            description: `${op.type}: ${op.path || op.source || 'processing'}`,
            currentNum: opIndex + 1,
          },
        });
        
        // Execute based on operation type
        switch (op.type) {
          case 'delete':
            if (op.path) {
              const isDirectory = op.entry?.type === 'directory';
              await adapter.delete(op.path, isDirectory, { onProgress });
              successCount++;
            }
            break;
          case 'create':
            // ... handle create
            break;
          case 'move':
            // ... handle move
            break;
          // ... other operations
        }
      } catch (opError) {
        console.error(`Failed to execute ${op.type} operation:`, opError);
        // Continue to next operation or abort
      }
    }
    
    hideProgress();
    
    // After all operations succeed
    if (successCount > 0) {
      // Reload buffer from S3
      const result = await adapter.list(currentBufferState.currentPath);
      currentBufferState.setEntries([...result.entries]);
      
      // Clear deletion marks
      currentBufferState.clearDeletionMarks();
      
      setStatusMessage(`${successCount} operation(s) completed successfully`);
      setStatusMessageColor(CatppuccinMocha.green);
    }
    
    closeAndClearOperations();
    
  } catch (err) {
    // Error handling
  }
}, [pendingOperations, adapter, /* deps */]);
```

### 5.2 Operation Execution Phases

1. **Pre-execution**:
   - Show progress window
   - Initialize abort controller for cancellation

2. **Execution Loop**:
   - For each pending operation
   - Update progress display
   - Call adapter method (e.g., `adapter.delete()`)
   - Track successes

3. **Post-execution**:
   - Hide progress window
   - Reload buffer from S3 source
   - Clear deletion marks
   - Show success/error message

4. **Cleanup**:
   - Close confirmation dialog
   - Clear pending operations
   - Update UI state

---

## 6. Undo/Redo System

### 6.1 Snapshot-Based Undo

**File**: `src/hooks/useBufferState.ts` (lines 402-405)

```typescript
type BufferSnapshot = {
  entries: Entry[];
  deletedIds: Set<string>;
};

const saveSnapshot = useCallback((): void => {
  setUndoHistory(prev => [...prev, { entries, deletedIds: new Set(deletedEntryIds) }]);
  setRedoHistory([]);  // Clear redo on new change
}, [entries, deletedEntryIds]);
```

### 6.2 Undo Action

When user presses `u`:

```typescript
'buffer:undo': () => {
  const currentBufferState = getActiveBuffer();
  if (currentBufferState.undo()) {
    setStatusMessage('Undo');
  } else {
    setStatusMessage('Nothing to undo');
  }
},
```

Restores:
- All entries to previous state
- All deletion marks
- Cursor position
- Other buffer state

---

## 7. Quit with Pending Changes

### 7.1 Detecting Pending Changes

**File**: `src/ui/s3-explorer.tsx` (lines 529-541)

```typescript
'app:quit': () => {
  const currentBufferState = getActiveBuffer();
  const pendingChanges = currentBufferState.getMarkedForDeletion().length;
  
  if (pendingChanges > 0) {
    // Show quit confirmation dialog
    showQuit(pendingChanges);
    return;
  }
  
  // No pending changes - quit immediately
  process.exit(0);
},
```

### 7.2 Quit Dialog Options

**File**: `src/ui/quit-dialog-react.tsx`

Shows user:
```
You have 5 unsaved changes.
d - Discard changes and quit
w - Save changes first
q - Cancel (go back)
```

If user chooses `w`:
```typescript
if (quitAfterSaveRef.current) {
  quitAfterSaveRef.current = false;
  process.exit(0);  // Exit after save completes
}
```

---

## 8. Files and Their Roles

| File | Purpose | Key Functions |
|------|---------|---|
| `src/hooks/useBufferState.ts` | Core buffer state with deletion tracking | `markForDeletion`, `getMarkedForDeletion`, `saveSnapshot` |
| `src/hooks/useDialogState.ts` | Dialog and pending operations state | `showConfirm`, `closeAndClearOperations` |
| `src/types/dialog.ts` | Type definitions for dialog system | `DialogState`, `PendingOperation` |
| `src/types/operations.ts` | Operation type definitions | `AdapterOperation`, `CreateOperation`, `DeleteOperation` |
| `src/ui/s3-explorer.tsx` | Main component orchestrating everything | `buffer:save` action, `createConfirmHandler` |
| `src/ui/buffer-view-react.tsx` | Renders pending changes visually | Strikethrough + red color for marked entries |
| `src/ui/confirmation-dialog-react.tsx` | Shows operations for confirmation | User confirms or cancels |
| `src/adapters/adapter.ts` | Executes operations on S3 | `delete`, `create`, `move`, `copy` |
| `src/ui/quit-dialog-react.tsx` | Handles quit with pending changes | Shows pending change count |

---

## 9. Key Concepts

### 9.1 Non-Destructive Editing

- No entry is permanently deleted until user confirms with `w`
- Entry stays in buffer throughout editing session
- Users can see exact state before committing
- Complies with oil.nvim philosophy: buffer IS the interface

### 9.2 Multi-Pane Support

Changes tracked per-pane:
```typescript
const activeBufferState = multiPaneLayout.getActiveBufferState() || bufferState;
```

Each pane has independent:
- `deletedEntryIds` set
- Undo/redo history
- Pending marks

### 9.3 Progress Tracking

During execution:
- Progress window shows current operation
- File-by-file feedback
- Estimated completion
- Cancellation supported

### 9.4 Error Handling

If operation fails:
- Continues with next operation
- Shows error message in status bar
- User can retry later
- Buffer reloads to show accurate state

---

## 10. Workflow Example

### Complete Delete and Save Flow

```
1. User navigates to /bucket/path/
   → adapter.list() loads entries
   → BufferState entries updated

2. User presses 'dd' on file1.txt
   → bufferState.saveSnapshot()  (save for undo)
   → bufferState.markForDeletion(entry.id)
   → deletedEntryIds.add(id)
   → Status: "1 item(s) marked for deletion. Press 'w' to save or 'u' to undo."
   → UI shows: ✗ file1.txt (strikethrough + red)

3. User presses 'dd' on file2.txt
   → Same as above for file2
   → Status: "2 item(s) marked for deletion..."

4. User presses 'u'
   → bufferState.undo()
   → Restore entries + deletedEntryIds from history
   → file2 no longer marked
   → Status: "Undo"

5. User presses 'w' (save)
   → buffer:save action triggered
   → getMarkedForDeletion() returns [file1, file2]
   → Create PendingOperation objects
   → showConfirm([deleteOp1, deleteOp2])
   → Confirmation dialog shown

6. User presses Enter (confirm)
   → createConfirmHandler() called
   → showProgress()
   → For each operation:
     - adapter.delete(path, recursive, {onProgress})
     - Track success
   → hideProgress()
   → Reload buffer: adapter.list(currentPath)
   → Clear marks: clearDeletionMarks()
   → Status: "2 operation(s) completed successfully"

7. User quits with 'q'
   → No pending changes
   → process.exit(0)
```

---

## 11. Data Flow Diagram

```
┌──────────────────┐
│   User Input     │
│   (dd, w, u)     │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────┐
│   Action Dispatcher          │
│   (useKeyboardDispatcher)     │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│   Buffer State Hook          │
│   - markForDeletion          │ ◄─── deletedEntryIds: Set<string>
│   - getMarkedForDeletion     │
│   - clearDeletionMarks       │
│   - saveSnapshot             │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│   Dialog State Hook          │
│   - pendingOperations[]      │ ◄─── Operations for confirmation
│   - showConfirm              │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│   Confirmation Dialog        │
│   (User reviews operations)  │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│   Execution Handler          │
│   - createConfirmHandler     │ ◄─── Progress tracking
│   - Execute each operation   │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│   S3 Adapter                 │
│   - adapter.delete()         │
│   - adapter.create()         │
│   - adapter.move()           │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│   S3 (AWS Backend)           │
└──────────────────────────────┘
```

---

## 12. Summary

**Pending changes tracking in open-s3**:

1. **At Buffer Layer**: Entries marked for deletion stay visible with visual indicators (strikethrough, ✗, red color)
2. **At Dialog Layer**: Marked entries converted to PendingOperation objects for review
3. **At Execution Layer**: Operations executed sequentially with progress feedback
4. **At Confirmation Layer**: User confirms before any S3 changes
5. **At State Layer**: Changes tracked in immutable Sets and snapshots for undo/redo

This creates a safe, vim-like interface where changes are staged locally before being applied to S3.
