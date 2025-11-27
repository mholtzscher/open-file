# Pending Changes Tracking - Complete Index

## Documentation Files

1. **COMPREHENSIVE_GUIDE.md** - Full architecture and implementation details
   - Core data structures with examples
   - State management architecture with diagrams
   - How changes are tracked step-by-step
   - Complete code examples from actual implementation
   - Workflow examples with full trace
   - File-by-file breakdown

2. **QUICK_REFERENCE.md** - Quick lookup for common tasks
   - Key functions and their purposes
   - Workflow stages at a glance
   - Visual indicators and status messages
   - Common code patterns
   - Error handling overview

3. **INDEX.md** (this file) - Navigation and file locations

---

## Core Source Files

### State Management

**`src/hooks/useBufferState.ts`** (507 lines)

- Main hook managing buffer state
- Key exports:
  - `markForDeletion(entryId)` - Mark entry for deletion
  - `unmarkForDeletion(entryId)` - Unmark entry
  - `getMarkedForDeletion(): Entry[]` - Get all marked entries
  - `clearDeletionMarks()` - Clear all marks
  - `saveSnapshot()` - Save state for undo
  - `undo() / redo()`
- Internal state:
  - `deletedEntryIds: Set<string>` - Tracks marked entries
  - `undoHistory: BufferSnapshot[]` - Undo stack
  - `redoHistory: BufferSnapshot[]` - Redo stack
- Related file: `src/ui/buffer-state.ts` (1040 lines) - Original class-based implementation

**`src/hooks/useDialogState.ts`** (150+ lines)

- Dialog and pending operations state
- Key exports:
  - `showConfirm(operations)` - Show confirmation dialog
  - `closeAndClearOperations()` - Close and cleanup
  - `dispatch()` - For advanced use
- Internal state:
  - `pendingOperations: PendingOperation[]`
  - `activeDialog: DialogType`
  - `quitPendingChanges: number`

### Type Definitions

**`src/types/dialog.ts`** (66 lines)

- `DialogState` - Current dialog state
- `PendingOperation` - Operation for confirmation
- `DialogAction` - Dialog reducer actions
- `DialogType` - Which dialog is open

**`src/types/operations.ts`** (117 lines)

- `CreateOperation` - Create file/directory
- `DeleteOperation` - Delete file/directory
- `MoveOperation` - Rename/move
- `CopyOperation` - Copy operation
- `DownloadOperation` - Download to local
- `UploadOperation` - Upload from local
- `AdapterOperation` - Union of all operations
- `OperationPlan` - Collection of operations

**`src/types/entry.ts`**

- `Entry` - File/directory entry
  - `id: string` - Unique ID for tracking
  - `name: string` - Display name
  - `path: string` - Full S3 path
  - `type: 'file' | 'directory' | 'bucket'`
  - `size?: number`
  - `modified?: Date`
  - `metadata?: {...}`

### UI Components

**`src/ui/s3-explorer.tsx`** (1200+ lines)

- Main application component
- Key action handlers (lines 446-600+):
  - `'entry:delete'` (lines 318-347) - Mark/unmark for deletion
  - `'buffer:save'` (lines 446-464) - Collect marks, show confirmation
  - `'buffer:undo'` (lines 502-511) - Undo changes
  - `'app:quit'` (lines 529-541) - Check for pending changes
- Execution handler:
  - `createConfirmHandler()` (lines 731-865) - Execute operations sequentially

**`src/ui/buffer-view-react.tsx`** (200+ lines)

- Renders entry list with pending changes visualization
- Visual indicators (lines 174-189):
  - `isMarkedForDeletion()` check
  - `✗` marker prefix
  - `applyStrikethrough()` - Unicode strikethrough
  - Red color for marked entries
- Functions:
  - `getEntryColor()` - Determine display color
  - `formatEntry()` - Format entry for display

**`src/ui/confirmation-dialog-react.tsx`**

- Shows pending operations for user confirmation
- Lists operations to be executed
- Confirm/Cancel buttons

**`src/ui/quit-dialog-react.tsx`**

- Shows pending changes when quitting
- Options: Discard, Save first, Cancel

---

## How They Connect

### Data Flow

```
User Input (dd, w, u, q)
    ↓
useKeyboardDispatcher
    ↓
Action Handlers (s3-explorer.tsx)
    ↓
useBufferState (buffer layer)
    ↓
useDialogState (dialog layer)
    ↓
Confirmation Dialog
    ↓
Execution Handler (createConfirmHandler)
    ↓
Adapter (S3 operations)
    ↓
Buffer Reload & Cleanup
```

### State Nesting

```
Component (S3Explorer)
├── useBufferState
│   ├── entries[]
│   ├── deletedEntryIds: Set<string>
│   ├── undoHistory[]
│   └── redoHistory[]
├── useDialogState
│   ├── pendingOperations[]
│   └── activeDialog: DialogType
└── useProgressState
    └── Progress display
```

---

## Key Concepts to Understand

### 1. Entry ID Tracking

- Each entry has unique `id` field
- IDs are used to track entries, not paths
- Allows entries to be safely renamed/moved
- IDs are consistent within a session

### 2. Two-Set Pattern

- `entries[]` - All entries currently visible
- `deletedEntryIds` - Which entries are marked
- Entry stays in array but marked in set
- Visual rendering uses both

### 3. Snapshot-Based Undo

- Full buffer state snapshots saved on change
- Snapshots include entries + deletedEntryIds
- Redo history cleared on new change
- Per-session only (no persistence)

### 4. Sequential Execution

- Operations execute one-by-one
- Progress updated for each
- Failures don't stop others
- All successful operations counted

### 5. Confirmation Pattern

- Mark changes locally (buffer layer)
- Collect marked changes (buffer:save action)
- Convert to operations (PendingOperation[])
- Show for user review (dialog layer)
- Execute on confirmation (execution layer)
- Reload on completion (refresh)

---

## Common Search Terms

To find specific behavior, search for:

- **Marking**: `markForDeletion`, `mark for deletion`
- **Checking if marked**: `isMarkedForDeletion`
- **Getting marked**: `getMarkedForDeletion`
- **Clearing marks**: `clearDeletionMarks`
- **Saving state**: `saveSnapshot`
- **Showing dialog**: `showConfirm`
- **Executing operations**: `createConfirmHandler`
- **Visual indicators**: `applyStrikethrough`, `isMarkedForDeletion`
- **Status messages**: `marked for deletion`, `completed successfully`

---

## Testing Checklist

### Manual Testing

- [ ] Press `dd` on a file → see strikethrough + ✗ + red
- [ ] Press `dd` again → unmark
- [ ] Mark multiple files → status shows count
- [ ] Press `u` → undo marks
- [ ] Press `w` → confirmation dialog appears
- [ ] Review operations in dialog
- [ ] Press Enter → operations execute
- [ ] Watch progress window
- [ ] Buffer reloads after completion
- [ ] Marks cleared after success
- [ ] Press `q` with pending marks → quit dialog shown
- [ ] Choose `w` in quit dialog → save then exit

### Code Testing

- [ ] `getMarkedForDeletion()` returns correct entries
- [ ] `deletedEntryIds` is a Set for O(1) lookup
- [ ] Snapshots include `deletedIds` not just entries
- [ ] Undo restores both entries and marks
- [ ] Operations generated correctly from marks
- [ ] Progress handler called for each operation
- [ ] Error doesn't prevent next operation

---

## Performance Characteristics

- **Adding mark**: O(1) - Set insertion
- **Checking mark**: O(1) - Set lookup
- **Getting all marked**: O(n) - Filter entries
- **Save snapshot**: O(n) - Deep copy
- **Execute operations**: O(m) - Sequential, not parallel

Where n = total entries, m = pending operations

---

## Future Extensions

### To Add More Operation Types

1. Extend `PendingOperation` type in `src/types/dialog.ts`
2. Add new case in `createConfirmHandler()` switch
3. Add UI rendering in confirmation dialog
4. Add action handler in `s3-explorer.tsx`

### To Add Dry-Run Preview

1. Execute operations without making changes
2. Show what would happen
3. Let user choose to proceed

### To Add Batch Operations

1. Group by type
2. Show grouped confirmation
3. Execute in priority order

---

## Related Research

- **oil.nvim patterns**: Buffer as interface paradigm
- **Vim keybindings**: `dd` delete, `u` undo, `w` save
- **Multi-pane layout**: `useMultiPaneLayout.ts`
- **Progress tracking**: `useProgressState.ts`
- **Keyboard dispatch**: `useKeyboardDispatcher.ts`

---

## Notes

- No persistent state (all changes lost on quit without save)
- No concurrent operations (sequential execution)
- No partial undo (undo restores full state)
- No transaction support (operations are independent)
- Buffer always consistent with S3 (reloaded after changes)
