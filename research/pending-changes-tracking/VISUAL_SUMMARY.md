# Pending Changes Tracking - Visual Diagrams

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     S3Explorer Component                        │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │ useBufferState   │  │ useDialogState   │  │ useProgress  │  │
│  ├──────────────────┤  ├──────────────────┤  ├──────────────┤  │
│  │ entries[]        │  │ pendingOps[]     │  │ progress%    │  │
│  │ deletedIds Set   │  │ activeDialog     │  │ currentFile  │  │
│  │ undoHistory[]    │  │ quitPending      │  │ description  │  │
│  │ redoHistory[]    │  │                  │  │              │  │
│  └──────────────────┘  └──────────────────┘  └──────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
            ↓                   ↓                    ↓
      Mark/Unmark        Show Dialog           Display Progress
      Entry state        User confirm          File feedback
```

## State Transitions Diagram

```
                         START
                           │
                           ↓
                    ┌─────────────┐
                    │  BROWSE     │
                    │  - View     │
                    │  - Navigate │
                    └──────┬──────┘
                           │
                    Press 'dd' (delete)
                           │
                           ↓
                    ┌──────────────────┐
                    │ MARK FOR DELETE  │
                    │ - Entry marked   │
                    │ - Shows visual   │ ← Strikethrough + ✗ + Red
                    │ - Status updated │
                    └──────┬───────────┘
                     ↑     │     ↑
                 Press 'u' │ Press 'dd' again
                 (undo)    │ (toggle)
                     │     ↓     │
                    Can go back & forth
                           │
                    Press 'w' (save)
                           │
                           ↓
                    ┌──────────────────┐
                    │ CONFIRM OPS      │
                    │ - Dialog shows   │
                    │ - List operations│
                    │ - Wait for OK    │
                    └──────┬───────────┘
                           │
                    Press Enter/Escape
                           │
        ┌──────────────────┴──────────────────┐
        │                                     │
   Escape (Cancel)                     Enter (Confirm)
        │                                     │
        ↓                                     ↓
  ┌──────────────┐              ┌──────────────────────┐
  │ MARK PERSIST │              │ EXECUTING            │
  │ - Return to  │              │ - Show progress      │
  │   marked     │              │ - Call adapter       │
  │   state      │              │ - Track success      │
  └──────────────┘              └──────┬───────────────┘
                                       │
                              (Success/Failure)
                                       │
                                       ↓
                              ┌──────────────────┐
                              │ COMPLETE         │
                              │ - Reload buffer  │
                              │ - Clear marks    │
                              │ - Show message   │
                              └──────┬───────────┘
                                     │
                                Press 'q' (quit)
                                     │
                                     ↓
                              ┌──────────────────┐
                              │ QUIT             │
                              │ - Exit app       │
                              └──────────────────┘
```

## Data Structure Layers

```
LAYER 3 (Execution)
┌──────────────────────────────────────────┐
│ pendingOperations: PendingOperation[]    │
├──────────────────────────────────────────┤
│ [                                        │
│   {id, type: 'delete', path: '...'},   │
│   {id, type: 'delete', path: '...'},   │
│   {id, type: 'create', path: '...'}    │
│ ]                                        │
│ • Shown in confirmation dialog          │
│ • Executed sequentially                 │
│ • Cleared after success                 │
└──────────────────────────────────────────┘
            ↑ Converted from layer 2


LAYER 2 (Staging)
┌──────────────────────────────────────────┐
│ deletedEntryIds: Set<string>             │
├──────────────────────────────────────────┤
│ {                                        │
│   "entry_123456_abc",                   │
│   "entry_123457_def",                   │
│   "entry_123458_ghi"                    │
│ }                                        │
│ • Tracks marked entries                 │
│ • Used for visual rendering             │
│ • Can be undone with 'u'                │
│ • Cleared after successful sync         │
└──────────────────────────────────────────┘
            ↑ Populated from layer 1


LAYER 1 (Source of Truth)
┌──────────────────────────────────────────┐
│ entries: Entry[]                         │
├──────────────────────────────────────────┤
│ [                                        │
│   {id, name: 'file1.txt', path, ...},  │
│   {id, name: 'file2.txt', path, ...},  │ ← Still here even if marked!
│   {id, name: 'file3.txt', path, ...}   │
│ ]                                        │
│ • All visible entries                   │
│ • Never removed until synced            │
│ • Combined with layer 2 for rendering   │
└──────────────────────────────────────────┘
```

## Rendering Logic

```
For each Entry in entries[]:

  ┌─────────────────────────────┐
  │ Is in deletedIds Set?       │
  └──────────┬──────────────────┘
             │
        Yes  │  No
        │    │
        ↓    ↓
    ┌───────────────────┐
    │ Add strikethrough │  │ Keep normal
    │ Add ✗ marker      │  │
    │ Color = Red       │  │ Color = Normal
    └───────────────────┘
        ↓                ↓
    Visual: ✗ file... |  Visual: file...
    (muted, crossed)  |  (normal appearance)
```

## Mark/Unmark Toggle

```
Entry State Machine:

        ┌──────────────┐
        │ UNMARKED     │
        │ (Normal)     │
        └──────┬───────┘
               │
        Press 'dd'
               │
               ↓
        ┌──────────────┐
        │ MARKED       │
        │ (Visual)     │
        └──────┬───────┘
               │
        Press 'dd'
               │
               ↓
        ┌──────────────┐
        │ UNMARKED     │
        │ (Normal)     │
        └──────────────┘

        OR Press 'u' (undo)
            at any time
            to restore
            previous state
```

## Execution Phases

```
User Confirms Execution
    │
    ↓
showProgress()
    │ Display window with:
    │ - Title: "Executing delete..."
    │ - Progress bar: 0%
    │ - Current file: ""
    │
    ↓
FOR EACH operation in pendingOperations:
    │
    ├─ Update progress display
    │   (opIndex / total) * 100
    │
    ├─ Call adapter.delete/create/move
    │   With onProgress callback
    │
    ├─ Track success/failure
    │
    ↓
hideProgress()
    │ Close progress window
    │
    ↓
adapter.list(currentPath)
    │ Reload buffer from S3
    │
    ↓
setEntries([...newList])
    │ Update buffer with fresh data
    │
    ↓
clearDeletionMarks()
    │ Clear deletedEntryIds Set
    │
    ↓
Show success message
    │ "5 operation(s) completed successfully"
```

## Undo/Redo Mechanism

```
            Initial State
                │
        (Take snapshot)
                │
                ↓
        ┌─────────────────┐
        │ State A         │
        │ entries: []     │
        │ deleted: {}     │
        └────────┬────────┘
                 │
        (Save to undoHistory)
                 │
                 ↓
        User makes changes...
                 │
        (Take snapshot)
                 │
                 ↓
        ┌─────────────────┐
        │ State B         │
        │ entries: []     │
        │ deleted: {1,2}  │
        └────────┬────────┘
                 │
    ┌────────────┴────────────┐
    │                         │
 Press 'u'              Press 'Ctrl+R'
    │                         │
    ↓                         ↓
 Restore A            Continue to C
 (from undo)
    │
    ↓
 State A restored
 (all entries back)
 (all marks cleared)
```

## Multi-Pane Independence

```
┌─────────────────────────────────────────────────────────┐
│                S3Explorer                              │
│                                                         │
│  ┌──────────────────┐         ┌──────────────────┐    │
│  │ Pane 1           │         │ Pane 2           │    │
│  ├──────────────────┤         ├──────────────────┤    │
│  │ BufferState 1:   │         │ BufferState 2:   │    │
│  │ - entries[]      │         │ - entries[]      │    │
│  │ - deleted: {1,2} │         │ - deleted: {7}   │    │
│  │ - undo: [A, B]   │         │ - undo: [X, Y]   │    │
│  │ - redo: []       │         │ - redo: [Z]      │    │
│  │                  │         │                  │    │
│  │ Active? NO       │         │ Active? YES ✓    │    │
│  └──────────────────┘         └──────────────────┘    │
│                                                         │
│  All operations use:                                   │
│  activeBufferState = getActiveBufferState() || default │
│                                                         │
│  So each pane has:                                     │
│  - Own marked entries                                  │
│  - Own undo/redo history                               │
│  - Own cursor position                                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Error Handling Flow

```
Start executing operations
    │
    ├─ Exec 1: Success → successCount = 1
    │
    ├─ Exec 2: FAIL → Catch error, log
    │                  Continue to next
    │
    ├─ Exec 3: Success → successCount = 2
    │
    ├─ Exec 4: FAIL → Catch error, log
    │                  Continue to next
    │
    └─ Exec 5: Success → successCount = 3
         │
         ↓
    hideProgress()
         │
         ↓
    adapter.list() - Reload from S3
         │
         ↓
    Show status: "3 operation(s) completed successfully"
         │
    (User can see which failed, try again)
```

## Status Message Timeline

```
User Navigation:
→ Status: "Navigated to /bucket/path"  (green)

Mark Entry:
→ Status: "1 item(s) marked for deletion. Press 'w' to save or 'u' to undo." (yellow)

Mark Another:
→ Status: "2 item(s) marked for deletion. Press 'w' to save or 'u' to undo." (yellow)

Press Undo:
→ Status: "Undo" (green)

Mark Again:
→ Status: "1 item(s) marked for deletion. Press 'w' to save or 'u' to undo." (yellow)

Press Save:
→ Dialog opens (status clears)

Confirm Execution:
→ Status: "Executing delete..." (blue - during progress)

Complete:
→ Status: "2 operation(s) completed successfully" (green)
```

## Keyboard Event Flow

```
User presses 'dd'
    │
    ↓
useKeyboardEvents intercepts
    │
    ↓
useKeyboardDispatcher routes
    │
    ↓
'entry:delete' action handler
    │
    ├─ Get active buffer
    ├─ Get selected entries
    ├─ saveSnapshot() for undo
    ├─ For each entry:
    │   - Toggle mark (mark/unmark)
    ├─ Update status message
    ├─ Trigger re-render
    │
    ↓
React re-renders
    │
    ├─ buffer-view-react checks isMarkedForDeletion
    ├─ Apply strikethrough to marked
    ├─ Apply red color to marked
    ├─ Add ✗ marker to marked
    │
    ↓
User sees visual update
```

## Confirmation Dialog Sequence

```
User presses 'w'
    │
    ↓
'buffer:save' action
    │
    ├─ Get marked entries
    ├─ Convert to PendingOperation[]
    ├─ If empty: show "No changes"
    └─ Else: showConfirm(operations)
    │
    ↓
useDialogState.dispatch({
  type: 'SHOW_CONFIRM',
  payload: { operations }
})
    │
    ↓
Dialog reducer updates state
    │
    ├─ activeDialog = 'confirm'
    └─ pendingOperations = [...]
    │
    ↓
React renders ConfirmationDialog
    │
    ├─ List each operation
    ├─ Show "Confirm" button (Enter)
    ├─ Show "Cancel" button (Escape)
    │
    ↓
User presses Enter/Escape
    │
    ├─ Enter: confirmHandlerRef.current()
    └─ Escape: closeDialog()
```

---

## Performance Characteristics

```
Operation:          Time:    Algorithm:
─────────────────────────────────────────
Mark entry          O(1)     Set.add()
Check if marked     O(1)     Set.has()
Get all marked      O(n)     Filter loop
Clear all marks     O(1)     Set.clear()
Save snapshot       O(n)     Deep copy
Execute ops         O(m)     Sequential loop

n = total entries
m = pending operations
```

---

## Visual Indicators Quick Reference

```
Entry State       Visual              Color    Marker   Strikethrough
─────────────────────────────────────────────────────────────────────
Not marked        normal text         normal   -        none
Marked            muted/faded         red      ✗        yes
Marked+Selected   muted highlight     red      ✗        yes
Not marked+Sel.   highlighted         normal   -        none
In search result  found match         normal   -        none
```
