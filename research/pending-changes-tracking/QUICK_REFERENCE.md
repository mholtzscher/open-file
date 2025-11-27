# Pending Changes Tracking - Quick Reference

## Core Components

### 1. Data Structures

#### Buffer State (`useBufferState.ts`)

- **`deletedEntryIds: Set<string>`** - Tracks which entries are marked for deletion
- **`markForDeletion(entryId)`** - Mark entry for deletion
- **`getMarkedForDeletion(): Entry[]`** - Get all marked entries
- **`clearDeletionMarks()`** - Clear all deletion marks
- **`saveSnapshot()`** - Save state for undo

#### Dialog State (`useDialogState.ts`)

- **`pendingOperations: PendingOperation[]`** - Operations waiting for confirmation
- **`showConfirm(operations)`** - Show confirmation dialog
- **`closeAndClearOperations()`** - Close dialog and clear operations

#### Pending Operation Type

```typescript
interface PendingOperation {
  id: string;
  type: 'create' | 'delete' | 'move' | 'copy' | 'download' | 'upload';
  path?: string;
  source?: string;
  destination?: string;
  entry?: Entry;
  entryType?: 'file' | 'directory';
  recursive?: boolean;
}
```

---

## Workflow Stages

### Stage 1: User Marks Changes (Buffer Layer)

```
User presses 'dd'
    ↓
entry:delete action triggered
    ↓
bufferState.saveSnapshot()
    ↓
bufferState.markForDeletion(entryId)
    ↓
deletedEntryIds.add(id)
    ↓
Status bar shows count: "X item(s) marked for deletion"
UI shows: ✗ file.txt (red + strikethrough)
```

### Stage 2: User Reviews Changes (Confirmation Layer)

```
User presses 'w'
    ↓
buffer:save action triggered
    ↓
getMarkedForDeletion() collects all marked entries
    ↓
Convert to PendingOperation[]
    ↓
showConfirm(pendingOperations)
    ↓
Confirmation dialog shown with list of operations
User reviews what will happen
```

### Stage 3: User Confirms (Execution Layer)

```
User presses Enter
    ↓
createConfirmHandler() called
    ↓
showProgress() - show execution window
    ↓
For each PendingOperation:
  - Update progress
  - adapter.delete/create/move/etc
  - Track success
    ↓
hideProgress()
    ↓
adapter.list() - reload buffer
    ↓
clearDeletionMarks()
    ↓
Show success message
```

### Stage 4: User Undoes (Before Save)

```
User presses 'u'
    ↓
buffer:undo action triggered
    ↓
Restore from undoHistory snapshot
    ↓
Restore entries + deletedEntryIds
    ↓
Re-render with restored state
```

---

## Key Functions by File

### `useBufferState.ts`

- `markForDeletion(entryId)` - Add to deletedEntryIds set
- `unmarkForDeletion(entryId)` - Remove from deletedEntryIds set
- `isMarkedForDeletion(entryId)` - Check if in set
- `getMarkedForDeletion()` - Filter entries by deletedEntryIds
- `clearDeletionMarks()` - Clear entire set
- `saveSnapshot()` - Add current state to undoHistory
- `undo()` - Restore from undoHistory
- `redo()` - Restore from redoHistory

### `s3-explorer.tsx` Actions

- `'entry:delete'` - Toggle mark for deletion
- `'buffer:save'` - Collect marks → show confirmation
- `'buffer:undo'` - Undo last change
- `'app:quit'` - Check for pending changes

### `buffer-view-react.tsx`

- `isMarkedForDeletion(entry.id)` - Check UI state
- `applyStrikethrough(text)` - Unicode strikethrough effect
- Color entries red if marked
- Add `✗` marker prefix

### `createConfirmHandler()`

- Loop through `pendingOperations`
- Call adapter methods sequentially
- Track success/failure
- Update progress display
- Reload buffer on completion
- Clear marks on success

---

## Visual Indicators

### Marked for Deletion

```
✗ file-to-delete.txt  ← Red color, strikethrough, ✗ marker
  normal-file.txt     ← Normal color, no marker
```

### Status Messages

```
"5 item(s) marked for deletion. Press 'w' to save or 'u' to undo."
"No changes to save"
"Executing delete..."
"5 operation(s) completed successfully"
```

---

## Multi-Pane Consideration

Each pane has independent state:

```typescript
const activeBufferState = multiPaneLayout.getActiveBufferState() || bufferState;
```

- Separate `deletedEntryIds` sets per pane
- Separate undo/redo histories
- Can mark different files in different panes

---

## Error Handling

If operation fails:

1. Continue to next operation
2. Show error in status bar
3. User can retry
4. Buffer reloads to show accurate state

No partial success - buffer always consistent with S3.

---

## Quit Behavior

### No Pending Changes

```
User presses 'q'
    ↓
getMarkedForDeletion().length === 0
    ↓
process.exit(0) immediately
```

### Pending Changes

```
User presses 'q'
    ↓
getMarkedForDeletion().length > 0
    ↓
showQuit(pendingChanges)
    ↓
User sees options:
  d - Discard and quit
  w - Save first, then quit
  q - Cancel (go back)
```

---

## State Persistence

- **Buffer state**: In-memory only (lost on quit without save)
- **Marked entries**: Cleared after successful sync
- **Undo history**: Per-session only
- **S3 state**: Reloaded after each successful operation

---

## Entry ID Tracking

Each entry has unique ID:

```typescript
interface Entry {
  id: string; // "entry_timestamp_random"
  path: string; // Full S3 path
  // ...
}
```

- IDs used to track entries through list updates
- Prevents confusion if entries are renamed/moved
- IDs stay consistent within a session

---

## Performance Notes

- `deletedEntryIds` is a Set for O(1) lookup
- Snapshots stored as full JSON copies
- No lazy loading of pending operations
- All marked entries collected on save (no pagination)

---

## Testing Entry Points

1. **Mark deletion**: Press `dd` on entry
2. **Verify UI**: Entry shows with ✗, strikethrough, red color
3. **Check status**: Count shown in status bar
4. **Undo**: Press `u`, entry should unmarked
5. **Save**: Press `w`, dialog should appear
6. **Confirm**: Press Enter, operations execute
7. **Verify**: Buffer reloads, marks cleared

---

## Common Patterns

### Get Pending Changes Count

```typescript
const pendingCount = bufferState.getMarkedForDeletion().length;
```

### Check if Changes Exist

```typescript
if (bufferState.getMarkedForDeletion().length > 0) {
  // Show warning
}
```

### Build Delete Operations

```typescript
const ops = bufferState.getMarkedForDeletion().map(entry => ({
  id: entry.id,
  type: 'delete',
  path: entry.path,
  entry,
}));
```

### Execute Operations

```typescript
for (const op of pendingOperations) {
  await adapter.delete(op.path, isDirectory, { onProgress });
}
```

### Cleanup After Success

```typescript
bufferState.clearDeletionMarks();
const result = await adapter.list(currentPath);
bufferState.setEntries([...result.entries]);
```
