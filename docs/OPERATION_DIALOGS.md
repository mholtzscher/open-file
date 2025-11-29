# Operation Dialogs - Provider System Integration

This document describes how operation dialogs (Upload, Confirmation) work with both the legacy adapter system and the new provider system.

## Overview

The operation dialogs in open-file are **presentational components** that don't directly interact with storage systems. Instead, they:

1. **UploadDialog**: Provides file selection UI for choosing files to upload
2. **ConfirmationDialog**: Displays pending operations for user confirmation
3. **Operation Execution**: Handled by parent component (S3Explorer) using the `useAsyncOperations` hook

## Architecture

```
┌─────────────────┐
│   S3Explorer    │
│                 │
│ ┌─────────────┐ │
│ │useAsyncOps  │ │ ← Orchestrates operations
│ └─────────────┘ │
│                 │
│ ┌─────────────┐ │
│ │UploadDialog │ │ ← Selects files
│ └─────────────┘ │
│                 │
│ ┌─────────────┐ │
│ │Confirmation │ │ ← Shows operations
│ └─────────────┘ │
└─────────────────┘
       │
       ├──────────────┬──────────────┐
       │              │              │
   ┌───▼────┐   ┌────▼────┐   ┌────▼──────┐
   │Adapter │   │Storage  │   │Progress   │
   │(Legacy)│   │Context  │   │Tracking   │
   └────────┘   └─────────┘   └───────────┘
```

## Components

### UploadDialog

**Purpose**: Local file selection interface

**Features**:

- Directory navigation (j/k keys)
- File selection (space key)
- Multi-file selection
- File filtering
- Size display

**Integration**:

- Receives `onConfirm` callback with selected file paths
- Parent creates `PendingOperation[]` from selected files
- Does NOT perform actual upload

**Example Usage**:

```tsx
<UploadDialog
  visible={showUpload}
  destinationPath="/bucket/folder"
  onConfirm={files => {
    // Create operations
    const operations = files.map(file => ({
      id: uuid(),
      type: 'upload',
      source: file,
      destination: `/bucket/${basename(file)}`,
    }));
    // Show confirmation
    showConfirmationDialog(operations);
  }}
  onCancel={closeDialog}
/>
```

### ConfirmationDialog

**Purpose**: Display pending operations for user review

**Features**:

- Shows operation list (create, delete, move, copy, upload, download)
- Color-coded by danger level (delete = red, others = green)
- Truncates long file names
- Supports batch operations

**Integration**:

- Receives `operations: PendingOperation[]`
- Displays them in human-readable format
- Does NOT execute operations
- Triggers `onConfirm()` when user presses 'y'

**Example Usage**:

```tsx
<ConfirmationDialog
  title="Confirm Upload"
  operations={pendingOperations}
  visible={showConfirm}
  onConfirm={async () => {
    await executeOperations(pendingOperations);
    closeDialog();
  }}
  onCancel={closeDialog}
/>
```

## useAsyncOperations Hook

**Purpose**: Unified operation execution for both legacy adapters and new providers

**Location**: `src/hooks/useAsyncOperations.ts`

**Features**:

- Feature flag aware (switches between adapter/provider automatically)
- Progress tracking with callbacks
- Error handling per-operation
- Cancellation support
- Batch execution

**API**:

```typescript
interface useAsyncOperations {
  // Execute a batch of operations
  executeOperations(
    operations: PendingOperation[],
    options?: {
      onProgress?: (progress: OperationProgress) => void;
      onOperationError?: (op: PendingOperation, error: Error) => void;
      signal?: AbortSignal;
    }
  ): Promise<OperationResult>;

  // Cancel ongoing operations
  cancelOperations(): void;
}
```

**Example Usage**:

```tsx
const { executeOperations, cancelOperations } = useAsyncOperations();

const handleConfirm = async () => {
  const result = await executeOperations(pendingOperations, {
    onProgress: progress => {
      console.log(`Progress: ${progress.overallProgress}%`);
      console.log(`Current: ${progress.currentFile}`);
    },
    onOperationError: (op, error) => {
      console.error(`Failed: ${op.path}`, error);
    },
  });

  if (result.cancelled) {
    showMessage('Operations cancelled');
  } else if (result.failureCount > 0) {
    showError(`${result.failureCount} operations failed`);
  } else {
    showSuccess(`${result.successCount} operations completed`);
  }
};
```

## Operation Types

**Supported Operations**:

```typescript
type OperationType =
  | 'create' // Create file or directory
  | 'delete' // Delete file or directory
  | 'move' // Move/rename within storage
  | 'copy' // Copy within storage
  | 'upload' // Upload from local filesystem
  | 'download'; // Download to local filesystem
```

**Operation Structure**:

```typescript
interface PendingOperation {
  id: string; // Unique identifier
  type: OperationType; // Operation type
  path?: string; // Target path (create, delete)
  source?: string; // Source path (move, copy, upload, download)
  destination?: string; // Destination path (move, copy, upload, download)
  entry?: Entry; // Associated entry
  entryType?: 'file' | 'directory'; // For create operations
  recursive?: boolean; // For delete/upload/download
}
```

## Feature Flag Integration

The `useAsyncOperations` hook automatically switches between systems based on `USE_NEW_PROVIDER_SYSTEM` feature flag:

**Legacy Mode** (flag = false):

```typescript
await adapter.uploadFromLocal(source, destination, recursive, { onProgress });
await adapter.downloadToLocal(source, destination, recursive, { onProgress });
await adapter.delete(path, recursive, { onProgress });
```

**Provider Mode** (flag = true):

```typescript
await storage.upload(source, destination, { recursive, onProgress });
await storage.download(source, destination, { recursive, onProgress });
await storage.delete(path, { recursive, onProgress });
```

## Progress Tracking

Progress is reported through callbacks with detailed information:

```typescript
interface OperationProgress {
  currentIndex: number; // Which operation (0-based)
  totalCount: number; // Total operations
  overallProgress: number; // 0-100 percentage
  operationType: string; // 'upload', 'delete', etc.
  currentFile?: string; // Current file being processed
  description: string; // Human-readable description
}
```

**Usage Example**:

```tsx
const [progress, setProgress] = useState(0);
const [currentFile, setCurrentFile] = useState('');

await executeOperations(operations, {
  onProgress: p => {
    setProgress(p.overallProgress);
    setCurrentFile(p.currentFile || '');
  },
});
```

## Error Handling

Errors are handled per-operation, allowing batch operations to continue even if some fail:

```tsx
const errors: Array<{ op: PendingOperation; error: Error }> = [];

const result = await executeOperations(operations, {
  onOperationError: (op, error) => {
    errors.push({ op, error });
  },
});

// Result contains:
// - successCount: number
// - failureCount: number
// - cancelled: boolean
// - error?: string
```

## Migration Path

### Phase 1: Current State (P5-11 Complete)

- ✅ Dialogs are presentational
- ✅ `useAsyncOperations` hook created
- ✅ Supports both legacy and new systems
- ⏳ Not yet integrated into S3Explorer (waiting for P5-8)

### Phase 2: S3Explorer Integration (P5-8)

- Update S3Explorer to use `useAsyncOperations`
- Remove inline operation execution code
- Connect progress updates to ProgressWindow
- Handle operation results and errors

### Phase 3: Post-Migration

- Remove legacy adapter support from `useAsyncOperations`
- Simplify operation execution
- Remove feature flag checks

## Testing

Tests for `useAsyncOperations` cover:

- ✅ Each operation type (create, delete, move, copy, upload, download)
- ✅ Batch execution
- ✅ Progress tracking
- ✅ Error handling
- ✅ Feature flag switching
- ✅ Cancellation

**Test Location**: `src/hooks/useAsyncOperations.test.ts`

## Related Files

- `src/ui/upload-dialog-react.tsx` - File selection UI
- `src/ui/confirmation-dialog-react.tsx` - Operation confirmation UI
- `src/ui/s3-explorer-dialogs.tsx` - Dialog orchestration
- `src/hooks/useAsyncOperations.ts` - Operation execution logic
- `src/types/dialog.ts` - Dialog and operation type definitions
- `src/contexts/StorageContext.tsx` - New provider system interface
- `src/adapters/adapter.ts` - Legacy adapter interface

## Future Enhancements

Potential improvements for future iterations:

1. **Operation Queue**: Queue operations instead of executing all at once
2. **Parallel Execution**: Execute independent operations in parallel
3. **Retry Logic**: Automatic retry for transient failures
4. **Operation History**: Log completed operations for debugging
5. **Dry Run Mode**: Preview operations without executing
6. **Undo/Redo**: Support for reversible operations
7. **Bandwidth Throttling**: Limit transfer speeds for large uploads/downloads

## Conclusion

The operation dialog system is now ready for both legacy adapters and the new provider system. The separation of concerns (presentation vs. execution) makes the code maintainable and testable. Integration into S3Explorer (P5-8) will complete the migration.
