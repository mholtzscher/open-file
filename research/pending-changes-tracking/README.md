# Pending Changes Tracking System - Research Summary

## Quick Overview

This open-s3 file manager uses an **oil.nvim-inspired staging system** where:

1. Users **mark changes locally** (press `dd` to mark for deletion)
2. Changes appear **visually staged** (strikethrough + red + ✗ marker)
3. Users **review before confirming** (press `w`, see confirmation dialog)
4. Changes **execute sequentially** with progress feedback
5. State is **reloaded from S3** on completion

**Key phrase**: "Buffer is the interface" - changes stay in buffer until explicitly synced.

---

## Files You Need to Know

### The Core Trio

| File                          | Role                     | Key State                               |
| ----------------------------- | ------------------------ | --------------------------------------- |
| `src/hooks/useBufferState.ts` | Track marked entries     | `deletedEntryIds: Set<string>`          |
| `src/hooks/useDialogState.ts` | Track pending operations | `pendingOperations: PendingOperation[]` |
| `src/ui/s3-explorer.tsx`      | Orchestrate workflow     | Action handlers + execution             |

### Supporting Cast

| File                                   | Purpose                                      |
| -------------------------------------- | -------------------------------------------- |
| `src/types/dialog.ts`                  | Type defs: `DialogState`, `PendingOperation` |
| `src/types/operations.ts`              | Operation type union                         |
| `src/ui/buffer-view-react.tsx`         | Show marked entries with strikethrough       |
| `src/ui/confirmation-dialog-react.tsx` | User confirms operations                     |
| `src/ui/quit-dialog-react.tsx`         | Handle quit with pending changes             |

---

## How It Works (Simple Version)

```
dd  →  Mark for deletion in buffer
       ✓ Entry shows with strikethrough

w   →  Collect marked entries
       ✓ Show confirmation dialog

Enter → Execute operations sequentially
       ✓ Show progress
       ✓ Reload buffer
       ✓ Clear marks

u   →  Undo last change (before save)
       ✓ Restore entries + marks
```

---

## The Three Layers

### Layer 1: Buffer State (Local)

```typescript
deletedEntryIds: Set<string>  // Which entries are marked
entries: Entry[]              // All entries (stay visible even when marked)
```

**What**: Entries stay in the list even when marked for deletion
**Why**: Vim-like philosophy - see what you're doing before committing

### Layer 2: Dialog State (Staging)

```typescript
pendingOperations: PendingOperation[]  // Ready for execution
```

**What**: Marked entries converted to executable operations
**Why**: Show user exactly what will happen before executing

### Layer 3: Adapter (Execution)

```typescript
adapter.delete(path, recursive, { onProgress });
```

**What**: Actually delete from S3
**Why**: Only changes that user confirmed and reviewed get executed

---

## Key Design Patterns

### 1. Mark vs. Delete

- **Mark** = Add to `deletedEntryIds` set (non-destructive, local)
- **Delete** = Execute operation (destructive, syncs to S3)
- Entry can be unmarked if user changes mind

### 2. Snapshot-Based Undo

- Before each change, full buffer state saved
- Snapshots include both entries AND deletion marks
- Undo restores everything to previous state
- Redo history cleared on new change

### 3. Two-Source Data Model

- `entries[]` - Source of truth for what's visible
- `deletedEntryIds` - Metadata about entries
- UI checks both to render correctly
- Both updated together for consistency

### 4. Sequential Execution

- Operations execute one-by-one (not parallel)
- Progress updated for each
- Failures don't block others
- All successful operations counted together

---

## Visual Indicators

### When Entry Is Marked

```
> ✗ file-to-delete.txt    ← Cursor, ✗ marker, strikethrough, red color
  normal-file.txt         ← Not marked (normal appearance)
```

### Status Messages

- Marking: `"5 item(s) marked for deletion. Press 'w' to save or 'u' to undo."`
- Executing: `"Executing delete..."`
- Success: `"5 operation(s) completed successfully"`

---

## Workflow Trace

### Complete Example: Delete 2 Files

```
1. User at /bucket/path/

2. Press 'dd' on file1.txt
   → bufferState.saveSnapshot()
   → bufferState.markForDeletion(file1_id)
   → deletedEntryIds = {file1_id}
   → Status: "1 item(s) marked for deletion..."
   → UI: file1 shows ✗ + strikethrough + red

3. Press 'dd' on file2.txt
   → bufferState.saveSnapshot()
   → bufferState.markForDeletion(file2_id)
   → deletedEntryIds = {file1_id, file2_id}
   → Status: "2 item(s) marked for deletion..."

4. Press 'w' (save)
   → getMarkedForDeletion() = [file1, file2]
   → Create: [
       {id, type: 'delete', path: '/bucket/path/file1.txt', entry: file1},
       {id, type: 'delete', path: '/bucket/path/file2.txt', entry: file2}
     ]
   → showConfirm(operations)
   → Dialog opens showing what will happen

5. User presses Enter (confirm)
   → createConfirmHandler() starts
   → showProgress()
   → adapter.delete('/bucket/path/file1.txt', false, {onProgress})
   → adapter.delete('/bucket/path/file2.txt', false, {onProgress})
   → hideProgress()
   → adapter.list('/bucket/path/') // Reload
   → setEntries([...newList])
   → clearDeletionMarks()
   → Status: "2 operation(s) completed successfully"

6. Buffer now shows updated list without deleted files
```

---

## What Happens On Different Keys

| Key      | Action  | Triggers             | Effect                    |
| -------- | ------- | -------------------- | ------------------------- |
| `dd`     | Delete  | `entry:delete`       | Mark/unmark for deletion  |
| `w`      | Save    | `buffer:save`        | Show confirmation dialog  |
| `Enter`  | Confirm | Confirmation handler | Execute operations        |
| `Escape` | Cancel  | Dialog handler       | Close confirmation        |
| `u`      | Undo    | `buffer:undo`        | Restore previous state    |
| `Ctrl+R` | Redo    | `buffer:redo`        | Restore undone state      |
| `q`      | Quit    | `app:quit`           | Check for pending changes |

---

## State Management Code Pattern

### Marking an Entry

```typescript
bufferState.markForDeletion(entry.id);
// Inside: deletedEntryIds.add(id)
```

### Checking if Marked

```typescript
bufferState.isMarkedForDeletion(entry.id);
// Inside: deletedEntryIds.has(id)
```

### Getting All Marked

```typescript
bufferState.getMarkedForDeletion();
// Inside: entries.filter(e => deletedEntryIds.has(e.id))
```

### Clearing All Marks

```typescript
bufferState.clearDeletionMarks();
// Inside: deletedEntryIds.clear()
```

---

## Multi-Pane Considerations

```typescript
const activeBufferState = multiPaneLayout.getActiveBufferState() || bufferState;
```

Each pane has:

- Independent `deletedEntryIds` set
- Independent undo/redo history
- Independent entries list
- Separate confirmation dialogs

So you can mark files in pane 1, switch to pane 2, mark different files, then sync both independently.

---

## Error Scenarios

### Operation Fails Partway Through

```
User confirms 5 deletes
Delete 1: Success
Delete 2: Fails (permission error)
Delete 3: Success (continues anyway)
Delete 4: Success
Delete 5: Success

Result:
- Show error message
- Status: "4 operation(s) completed successfully"
- Buffer reloads to show accurate S3 state
- User can retry failed operation
```

### User Cancels During Execution

```
Operations executing, user presses Escape
→ abortController.signal.aborted = true
→ Loop breaks on next iteration
→ Progress window closes
→ Status: "Operation cancelled by user"
→ Remaining operations not executed
```

---

## Performance

- **Add mark**: O(1) - Set.add()
- **Check mark**: O(1) - Set.has()
- **Get all marked**: O(n) - Filter loop
- **Save snapshot**: O(n) - Deep copy
- **Execute all**: O(m) - Sequential loop

n = total entries, m = pending operations

---

## Limitations & Design Choices

1. **No concurrent operations** - Sequential only (simpler, safer)
2. **No partial undo** - Undo restores full state (consistent)
3. **No persistent state** - Lost on quit without save (explicit)
4. **No transaction support** - Each operation independent (simple)
5. **No dry-run mode** - Execute or cancel only (clear)
6. **Single confirmation** - No batch grouping (atomic)

---

## Extensions Possible

### Add More Operation Types

1. Add to `PendingOperation` type
2. Add case in `createConfirmHandler()` switch
3. Add UI rendering in confirmation dialog

### Add Dry-Run

1. Execute in read-only mode
2. Show what would happen
3. Let user proceed or cancel

### Add Batch Grouping

1. Group operations by type
2. Show grouped in confirmation
3. Execute with priority order

---

## Testing Checklist

Manual:

- [ ] Mark entry with `dd` → see visual indicators
- [ ] Unmark with `dd` again
- [ ] Check status message shows count
- [ ] Undo with `u` → marks restored
- [ ] Save with `w` → dialog appears
- [ ] Confirm with Enter → operations execute
- [ ] Watch progress
- [ ] Buffer updates after success
- [ ] Quit with `q` → no confirmation if no marks
- [ ] Quit with `q` → confirmation if marks exist

---

## Documentation Guide

**Start here**:

1. `README.md` (this file) - Overview and quick reference
2. `QUICK_REFERENCE.md` - Common tasks and patterns
3. `COMPREHENSIVE_GUIDE.md` - Deep dive with code examples
4. `INDEX.md` - File locations and detailed structure

**When you need to**:

- Understand the system → Read COMPREHENSIVE_GUIDE
- Find a function → Search INDEX for file locations
- Quick lookup → Use QUICK_REFERENCE
- Debug issue → Check both files involved + use INDEX

---

## Key Takeaways

1. **Pending changes = marked entries** in a Set, not a separate list
2. **Visual staging** shows user exactly what will happen
3. **Multi-layer approach** separates concerns: buffer → dialog → execution
4. **Snapshot-based undo** provides full rollback capability
5. **Sequential execution** keeps things simple and consistent
6. **Buffer reloads after** changes to stay in sync with S3

This design prioritizes **safety and clarity** over performance - users always see what will happen before it happens.
