# UI Adapter Usage Patterns - Comprehensive Report

## Executive Summary

This document provides a complete inventory of how the S3Explorer UI components interact with storage adapters throughout the codebase. The adapter is the critical abstraction layer that enables storage operations (list, read, write, delete, transfer) while keeping the UI decoupled from specific storage implementations.

**Key Finding**: Adapter usage is **highly centralized** in the main `S3Explorer` component, with most hooks and UI components being adapter-agnostic (they operate on entries and state, not directly on adapters).

---

## 1. Adapter Architecture Overview

### 1.1 Core Adapter Interfaces (from `src/adapters/adapter.ts`)

```typescript
// Read-only operations
interface ReadableStorageAdapter {
  readonly name: string;
  list(path: string, options?: ListOptions): Promise<ListResult>;
  getMetadata(path: string): Promise<Entry>;
  exists(path: string): Promise<boolean>;
  read(path: string, options?: OperationOptions): Promise<Buffer>;
}

// Write operations
interface MutableStorageAdapter extends ReadableStorageAdapter {
  create(path: string, type: EntryType, content?: Buffer | string, options?: OperationOptions): Promise<void>;
  delete(path: string, recursive?: boolean, options?: OperationOptions): Promise<void>;
  move(source: string, destination: string, options?: OperationOptions): Promise<void>;
  copy(source: string, destination: string, options?: OperationOptions): Promise<void>;
}

// Transfer operations
interface TransferableStorageAdapter extends MutableStorageAdapter {
  downloadToLocal(remotePath: string, localPath: string, recursive?: boolean, options?: OperationOptions): Promise<void>;
  uploadFromLocal(localPath: string, remotePath: string, recursive?: boolean, options?: OperationOptions): Promise<void>;
}

// Bucket operations
interface BucketAwareAdapter extends TransferableStorageAdapter {
  getBucketEntries(): Promise<Entry[]>;
  setBucket(bucket: string): void;
  setRegion(region: string): void;
}

// Backward compatibility alias
type Adapter = MutableStorageAdapter (with optional transfer/bucket methods)
```

### 1.2 Progress Tracking

```typescript
interface ProgressEvent {
  operation: string;
  bytesTransferred: number;
  totalBytes?: number;
  percentage: number;
  currentFile?: string;
}

type ProgressCallback = (event: ProgressEvent) => void;

interface OperationOptions {
  onProgress?: ProgressCallback;
}
```

### 1.3 AdapterContext (from `src/contexts/AdapterContext.tsx`)

Provides dependency injection for adapters in React components:

```typescript
// Provider
<AdapterProvider adapter={adapter}>
  <S3Explorer />
</AdapterProvider>

// Hook to access adapter
const adapter = useAdapter(); // throws if not in AdapterProvider
const hasAdapter = useHasAdapter(); // boolean check
const typedAdapter = useTypedAdapter<T>(); // type-safe access
```

---

## 2. UI Adapter Usage - Comprehensive Inventory

### 2.1 **src/ui/s3-explorer.tsx** (MAIN COMPONENT - CRITICAL)

**Purpose**: Main application UI - orchestrates all operations

#### Imports:
```typescript
import { Adapter, ProgressEvent } from '../adapters/adapter.js';
import { useAdapter, useHasAdapter } from '../contexts/AdapterContext.js';
```

#### Adapter Resolution (Line 80-92):
```typescript
export function S3Explorer({ bucket: initialBucket, adapter: adapterProp }: S3ExplorerProps) {
  // Dual mode: prop-based or context-based
  const hasAdapterContext = useHasAdapter();
  const contextAdapter = hasAdapterContext ? useAdapter() : null;
  const adapter = adapterProp ?? contextAdapter; // Prop takes precedence

  if (!adapter) {
    throw new Error(
      'S3Explorer requires an adapter. Either pass it as a prop or wrap with AdapterProvider.'
    );
  }
  // ... rest of component
}
```

**Assumption about adapter behavior**: 
- Adapter is required (non-null)
- Either passed as prop OR available via AdapterContext
- If both missing, throws Error

#### Adapter Methods Called:

**1. `adapter.list(path)` - List directory contents**
- Lines 194, 486-487, 840, 1063
- Called when: navigating to path, refreshing buffer, loading initial data
- Usage pattern:
  ```typescript
  const result = await adapter.list(path);
  activeBufferState.setEntries([...result.entries]);
  ```
- Error handling: Try-catch block, sets error status message
- Return type assumption: `Promise<ListResult>` with `{entries: Entry[], hasMore: boolean, continuationToken?: string}`

**2. `adapter.setBucket(bucketName)` - Set current bucket**
- Lines 264, 602
- Called when: user navigates into bucket from root view, switches buckets via command
- Usage pattern:
  ```typescript
  if (adapter.setBucket) {
    adapter.setBucket(bucketName);
  }
  ```
- Behavior: Optional method (guard checked), synchronous side effect
- Assumption: Prepares adapter to operate within bucket context

**3. `adapter.setRegion(region)` - Set current region**
- Lines 267, (implicit in bucket selection)
- Called when: user navigates into bucket (region from metadata)
- Usage pattern:
  ```typescript
  if (adapter.setRegion) {
    adapter.setRegion(bucketRegion);
  }
  ```
- Assumption: Configures adapter for region-specific operations

**4. `adapter.getBucketEntries()` - List all buckets**
- Lines 471-472, 1050-1051
- Called when: in root view mode (no bucket selected), refresh pressed, initial data load
- Usage pattern:
  ```typescript
  if (adapter.getBucketEntries) {
    const entries = await adapter.getBucketEntries();
    currentBufferState.setEntries([...entries]);
  }
  ```
- Behavior: Optional method, async
- Return type assumption: `Promise<Entry[]>` where Entry.type === 'bucket'
- Error handling: `.catch()` handler updates status message

**5. `adapter.read(fullPath)` - Read file contents**
- Line 1138
- Called when: user enables preview on text file
- Usage pattern:
  ```typescript
  const buffer = await adapter.read(fullPath);
  const content = buffer.toString('utf-8');
  setPreviewContent(content);
  ```
- Error handling: Wrapped in try-catch, sets preview to "Failed to load preview"
- Assumption: Returns Buffer, UTF-8 decodable
- Size limit: 100KB max (prevents large file read)

**6. `adapter.create(path, type, content?, options)` - Create file/directory**
- Line 781
- Called in operation confirmation handler
- Usage pattern:
  ```typescript
  const createType = op.entryType === 'directory' ? EntryType.Directory : EntryType.File;
  await adapter.create(op.path, createType, undefined, { onProgress });
  ```
- Error handling: Caught in try-catch within operation loop
- Parameters:
  - `path`: Full S3 path
  - `type`: EntryType.Directory or EntryType.File
  - `content`: undefined for directories
  - `options`: `{onProgress}` callback for progress tracking

**7. `adapter.delete(path, recursive?, options)` - Delete file/directory**
- Line 789
- Called in operation confirmation handler
- Usage pattern:
  ```typescript
  const isDirectory = op.entry?.type === 'directory';
  await adapter.delete(op.path, isDirectory, { onProgress });
  ```
- Assumption: `recursive` parameter matches entry type (directories need recursive=true)
- Error handling: Caught in try-catch within operation loop

**8. `adapter.move(source, destination, options)` - Move/rename**
- Line 795
- Called in operation confirmation handler
- Usage pattern:
  ```typescript
  await adapter.move(op.source, op.destination, { onProgress });
  ```
- Error handling: Caught in try-catch within operation loop

**9. `adapter.copy(source, destination, options)` - Copy file/directory**
- Line 801
- Called in operation confirmation handler
- Usage pattern:
  ```typescript
  await adapter.copy(op.source, op.destination, { onProgress });
  ```
- Error handling: Caught in try-catch within operation loop

**10. `adapter.downloadToLocal(remotePath, localPath, recursive?, options)` - Download to local**
- Line 807
- Called in operation confirmation handler
- Usage pattern:
  ```typescript
  if (adapter.downloadToLocal && op.source && op.destination) {
    await adapter.downloadToLocal(op.source, op.destination, op.recursive || false, { onProgress });
  }
  ```
- Behavior: Optional method (guarded by if check)
- Usage: When not available, skips operation with no error
- Error handling: Caught in try-catch within operation loop

**11. `adapter.uploadFromLocal(localPath, remotePath, recursive?, options)` - Upload from local**
- Line 814
- Called in operation confirmation handler
- Usage pattern:
  ```typescript
  if (adapter.uploadFromLocal && op.source && op.destination) {
    await adapter.uploadFromLocal(op.source, op.destination, op.recursive || false, { onProgress });
  }
  ```
- Behavior: Optional method (guarded by if check)
- Error handling: Caught in try-catch within operation loop

#### Progress Tracking Pattern (Lines 753-774):
```typescript
const onProgress = (event: ProgressEvent) => {
  const baseProgress = (opIndex / pendingOperations.length) * 100;
  const opProgress = event.percentage / pendingOperations.length;
  const totalProgress = Math.round(baseProgress + opProgress);

  updateProgress(totalProgress);
  if (event.currentFile) {
    dispatchProgress({ type: 'UPDATE', payload: { currentFile: event.currentFile } });
  }
  updateProgressDescription(event.operation);
};
```

**Assumptions about ProgressEvent**:
- Contains: `operation`, `percentage`, `currentFile` (optional), `bytesTransferred`, `totalBytes` (optional)
- Percentage should be 0-100 for current operation
- Can be called multiple times during operation
- GUI handles aggregation across multiple operations

#### Error Handling Pattern:
```typescript
try {
  const result = await adapter.list(path);
  // ... update state
} catch (err) {
  const parsedError = parseAwsError(err, 'Navigation failed');
  setStatusMessage(formatErrorForDisplay(parsedError, 70));
  setStatusMessageColor(CatppuccinMocha.red);
}
```

**Assumptions about error behavior**:
- Errors can be AWS-specific (parsed by `parseAwsError`)
- Error messages shown to user in status bar
- Previous state preserved on error (UI doesn't crash)
- All async adapter operations should be wrapped in try-catch

---

### 2.2 **src/ui/progress-window-integration.test.tsx**

**Purpose**: Tests for progress window integration with adapter progress events

#### Imports:
```typescript
import { ProgressEvent, ProgressCallback } from '../adapters/adapter.js';
```

#### Usage:
- Simulates adapter progress callbacks
- Tests batch operation progress calculation
- Tests abort controller for cancellation

**No direct adapter method calls** - only uses types

---

### 2.3 **src/ui/upload-dialog-react.tsx**

**Purpose**: File selection dialog for uploads

#### No adapter imports or usage
- Uses local filesystem via `listFiles()` utility
- Adapter integration happens in S3Explorer component that calls `uploadFromLocal`

**Key assumption**: Upload dialog is adapter-agnostic; adapter calls happen at S3Explorer level

---

### 2.4 **Other UI Components (no adapter usage)**

- `src/ui/buffer-state.ts` - Entry management, no adapter
- `src/ui/buffer-view-react.tsx` - Renders entries, no adapter
- `src/ui/confirmation-dialog-react.tsx` - Confirmation UI, no adapter
- `src/ui/error-dialog-react.tsx` - Error display, no adapter
- `src/ui/help-dialog-react.tsx` - Help UI, no adapter
- `src/ui/header-react.tsx` - Header display, no adapter
- `src/ui/pane-react.tsx` - Pane layout, no adapter
- `src/ui/preview-pane-react.tsx` - Preview pane, no adapter
- `src/ui/progress-window-react.tsx` - Progress display, no adapter
- `src/ui/quit-dialog-react.tsx` - Quit dialog, no adapter
- `src/ui/sort-menu-react.tsx` - Sort menu, no adapter
- `src/ui/status-bar-react.tsx` - Status bar, no adapter
- `src/ui/s3-explorer-dialogs.tsx` - Dialog wrapper, no adapter
- `src/ui/s3-explorer-layout.tsx` - Layout wrapper, no adapter

---

## 3. Hook Adapter Usage

### 3.1 **src/hooks/useNavigationHandlers.ts**

**Purpose**: Navigation logic (navigate into directory, go back, etc.)

#### No direct adapter usage
- Receives configuration callbacks: `onLoadBuffer`, `onErrorOccurred`, `onBucketSelected`
- These callbacks are configured by S3Explorer to call adapter methods
- Hook is adapter-agnostic

**Pattern**:
```typescript
export function useNavigationHandlers(
  bufferState: UseBufferStateReturn,
  config: NavigationConfig = {}
): UseNavigationHandlersReturn {
  const navigateInto = useCallback(async () => {
    // ... check entry type
    if (config.onLoadBuffer) {
      await config.onLoadBuffer(selected.path); // S3Explorer calls adapter.list here
    }
  }, [bufferState, config]);
}
```

**Key Assumption**: Hook receives adapter interaction as callbacks, doesn't directly call adapter

---

### 3.2 **src/hooks/useAsyncOperations.test.ts**

**Purpose**: Test specifications for async operations

#### Comments only (no implementation)
- References: `adapter.list()`, `adapter.delete()` as intended behaviors
- No actual code - just test placeholders

---

### 3.3 **Other Hooks (no adapter usage)**

- `src/hooks/useBufferState.ts` - Buffer state management, no adapter
- `src/hooks/useKeyboardDispatcher.ts` - Keyboard dispatch, no adapter
- `src/hooks/useKeyboardEvents.ts` - Keyboard events, no adapter
- `src/hooks/useMultiPaneLayout.ts` - Multi-pane layout, no adapter
- `src/hooks/useProgressState.ts` - Progress state, no adapter
- `src/hooks/useDialogState.ts` - Dialog state, no adapter
- `src/hooks/useTerminalSize.ts` - Terminal size, no adapter

---

## 4. Context Adapter Usage

### 4.1 **src/contexts/AdapterContext.tsx**

**Purpose**: React Context for dependency injection of adapters

#### Exports:

```typescript
// Provider component
<AdapterProvider adapter={adapter}>
  {children}
</AdapterProvider>

// Hooks to access adapter
useAdapter(): Adapter // throws if not in provider
useTypedAdapter<T extends ReadableStorageAdapter>(): T // type-safe access
useHasAdapter(): boolean // optional access
```

#### Usage in S3Explorer:
```typescript
const hasAdapterContext = useHasAdapter();
const contextAdapter = hasAdapterContext ? useAdapter() : null;
const adapter = adapterProp ?? contextAdapter;
```

**Pattern**: Context provides centralized adapter access, but S3Explorer can also receive adapter as prop

---

## 5. UI Assumptions About Adapter Behavior

### 5.1 Synchronous vs Asynchronous

| Method | Async | Return Type | Optional? |
|--------|-------|-------------|-----------|
| `list()` | ✅ Yes | Promise<ListResult> | ❌ No |
| `read()` | ✅ Yes | Promise<Buffer> | ❌ No |
| `create()` | ✅ Yes | Promise<void> | ❌ No |
| `delete()` | ✅ Yes | Promise<void> | ❌ No |
| `move()` | ✅ Yes | Promise<void> | ❌ No |
| `copy()` | ✅ Yes | Promise<void> | ❌ No |
| `downloadToLocal()` | ✅ Yes | Promise<void> | ✅ Yes (checked with if) |
| `uploadFromLocal()` | ✅ Yes | Promise<void> | ✅ Yes (checked with if) |
| `getBucketEntries()` | ✅ Yes | Promise<Entry[]> | ✅ Yes (checked with if) |
| `setBucket()` | ❌ No | void | ✅ Yes (checked with if) |
| `setRegion()` | ❌ No | void | ✅ Yes (checked with if) |

### 5.2 Error Handling Assumptions

**Expected behavior when adapter method throws**:
- Error caught at call site with try-catch
- Error message displayed in status bar
- Previous UI state preserved (no crash)
- Operation skipped if optional method not available

**Example error types adapter might throw**:
- `NoSuchBucket` - S3 bucket doesn't exist
- `AccessDenied` - AWS credentials insufficient
- `NoSuchKey` - File/object not found
- `InvalidPath` - Path format invalid
- Network errors - Connection issues

**UI handles errors via**:
- `parseAwsError()` utility - parses AWS SDK errors
- `formatErrorForDisplay()` utility - truncates to 70 chars for status bar

### 5.3 Progress Tracking Assumptions

**Progress callback expectations**:
- Called multiple times during operation (not just start/end)
- `percentage` field should be 0-100 for current operation
- `operation` field describes current action
- `currentFile` field (optional) shows current file being processed
- `bytesTransferred` and `totalBytes` for monitoring data transfer

**UI aggregation logic**:
```
totalProgress = (opIndex / totalOps) * 100 + (eventProgress / totalOps)
```

### 5.4 Return Type Assumptions

**ListResult structure**:
```typescript
{
  entries: Entry[],
  hasMore: boolean,
  continuationToken?: string
}
```

**Entry structure** (from `src/types/entry.ts`):
```typescript
{
  id: string,
  name: string,
  type: 'file' | 'directory' | 'bucket',
  path: string,
  size?: number,
  modified?: Date,
  metadata?: {
    region?: string,
    [key: string]: any
  }
}
```

### 5.5 Optional Methods Pattern

**Methods that are checked before calling**:
- `adapter.downloadToLocal` - guarded with `if (adapter.downloadToLocal)`
- `adapter.uploadFromLocal` - guarded with `if (adapter.uploadFromLocal)`
- `adapter.getBucketEntries` - guarded with `if (adapter.getBucketEntries)`
- `adapter.setBucket` - guarded with `if (adapter.setBucket)`
- `adapter.setRegion` - guarded with `if (adapter.setRegion)`

**When not available**:
- Transfer operations: Skip the operation gracefully
- Bucket operations: Show error message

### 5.6 Path Format Assumptions

**Path formats observed**:
- S3 paths: `"bucket/prefix/"` or `"prefix/file.txt"`
- Relative paths used in listing: `""` for root, `"folder/subfolder/"` for directories
- Full paths constructed by combining: `currentPath + entryName`

---

## 6. Error Handling Patterns Observed

### 6.1 Navigation Errors (Lines 201-205)
```typescript
try {
  const result = await adapter.list(path);
  // ... update state
} catch (err) {
  const parsedError = parseAwsError(err, 'Navigation failed');
  setStatusMessage(formatErrorForDisplay(parsedError, 70));
  setStatusMessageColor(CatppuccinMocha.red);
}
```

### 6.2 Operation Loop Errors (Lines 822-831)
```typescript
try {
  // ... execute adapter operation
  await adapter.delete(op.path, isDirectory, { onProgress });
  successCount++;
} catch (opError) {
  if (opError instanceof Error && opError.name === 'AbortError') {
    setStatusMessage('Operation cancelled by user');
    break;
  }
  console.error(`Failed to execute ${op.type} operation:`, opError);
  const parsedError = parseAwsError(opError, `Failed to ${op.type}`);
  setStatusMessage(`Operation failed: ${formatErrorForDisplay(parsedError, 70)}`);
  setStatusMessageColor(CatppuccinMocha.red);
}
```

### 6.3 Reload Errors (Lines 854-858)
```typescript
try {
  const currentBufferState = multiPaneLayout.getActiveBufferState() || bufferState;
  const result = await adapter.list(currentBufferState.currentPath);
  // ... update state
} catch (reloadError) {
  console.error('Failed to reload buffer:', reloadError);
  setStatusMessage('Operations completed but failed to reload buffer');
  setStatusMessageColor(CatppuccinMocha.yellow);
}
```

### 6.4 Preview Errors (Lines 1142-1145)
```typescript
try {
  const buffer = await adapter.read(fullPath);
  const content = buffer.toString('utf-8');
  setPreviewContent(content);
} catch (err) {
  console.error('Failed to load preview:', err);
  setPreviewContent('Failed to load preview');
}
```

---

## 7. Adapter Dependencies and Injection Points

### 7.1 Entry Points Where Adapter Is Provided

**1. Application entry point (index.tsx or similar)**:
```typescript
const adapter = new S3Adapter({ region: 'us-east-1' });

// Option A: Via AdapterProvider
<AdapterProvider adapter={adapter}>
  <S3Explorer bucket="my-bucket" />
</AdapterProvider>

// Option B: Via prop
<S3Explorer adapter={adapter} bucket="my-bucket" />

// Option C: AdapterProvider for DI, prop for override
<AdapterProvider adapter={defaultAdapter}>
  <S3Explorer adapter={overrideAdapter} bucket="my-bucket" />
</AdapterProvider>
```

### 7.2 Adapter Implementation Assumptions

**S3Adapter specific** (from `src/adapters/s3-adapter.ts`):
- Implements all required methods
- Supports progress tracking
- Supports bucket-aware operations (getBucketEntries, setBucket, setRegion)
- Supports transfers (downloadToLocal, uploadFromLocal)
- Uses AWS SDK v3

**MockAdapter** (from `src/adapters/mock-adapter.ts`):
- In-memory implementation for testing
- May not support all operations

---

## 8. Summary of UI/Adapter Integration Points

### Files That Use Adapters:
1. **src/ui/s3-explorer.tsx** - MAIN (11 adapter methods called)
2. **src/ui/progress-window-integration.test.tsx** - TYPES ONLY (ProgressEvent, ProgressCallback)

### Files That Are Adapter-Aware (Use Callbacks):
1. **src/hooks/useNavigationHandlers.ts** - Receives `onLoadBuffer` callback

### Files That Are Adapter-Agnostic:
- All other UI components
- All other hooks
- Buffer state and entry management

### Context-Based Injection:
1. **src/contexts/AdapterContext.tsx** - Provides `useAdapter()`, `useHasAdapter()`, `useTypedAdapter<T>()`
2. **src/ui/s3-explorer.tsx** - Uses `useAdapter()` and `useHasAdapter()`

---

## 9. Key Insights

1. **Centralized Adapter Usage**: All adapter method calls originate from S3Explorer component, making changes to adapter behavior easy to track

2. **Optional Methods Pattern**: Transfer and bucket operations use guard clauses to support adapters with limited capabilities

3. **Progress Callback Strategy**: Operations pass progress callbacks, allowing adapters to control frequency and detail level

4. **Error Resilience**: All async operations wrapped in try-catch with graceful degradation

5. **State Preservation**: On error, UI preserves previous state and displays error message without crashing

6. **Async/Await Pattern**: All adapter operations use modern async/await, not callbacks or promises

7. **Type Safety**: Uses TypeScript interfaces to define adapter contracts

8. **Testability**: useNavigationHandlers accepts callbacks, making it easy to mock adapter

---

## 10. Recommendations for Adapter Implementations

### Must Support:
- ✅ `list()` - Required for core functionality
- ✅ `read()` - Required for preview
- ✅ `create()`, `delete()`, `move()`, `copy()` - Required for file operations
- ✅ Progress callbacks in OperationOptions

### Should Support:
- 📦 `getBucketEntries()` - For bucket listing
- 📦 `setBucket()`, `setRegion()` - For multi-bucket support

### May Support:
- 📦 `downloadToLocal()`, `uploadFromLocal()` - For transfer operations (optional)

### Error Handling:
- All methods should throw on error (not return error objects)
- Error messages should be descriptive for user display
- Consider AWS SDK error types

### Progress Tracking:
- Call progress callback regularly during long operations
- Set `percentage` to 0-100 for current operation
- Provide meaningful `operation` string
- Include `currentFile` when processing multiple files

---

## Appendix: Code Location Quick Reference

| Feature | File | Lines |
|---------|------|-------|
| Adapter resolution | s3-explorer.tsx | 80-92 |
| list() calls | s3-explorer.tsx | 194, 486, 840, 1063 |
| read() call | s3-explorer.tsx | 1138 |
| create() call | s3-explorer.tsx | 781 |
| delete() call | s3-explorer.tsx | 789 |
| move() call | s3-explorer.tsx | 795 |
| copy() call | s3-explorer.tsx | 801 |
| downloadToLocal() call | s3-explorer.tsx | 807 |
| uploadFromLocal() call | s3-explorer.tsx | 814 |
| setBucket() calls | s3-explorer.tsx | 264, 602 |
| setRegion() call | s3-explorer.tsx | 267 |
| getBucketEntries() calls | s3-explorer.tsx | 471, 1050 |
| Progress tracking | s3-explorer.tsx | 753-774 |
| Error handling | s3-explorer.tsx | 201-205, 822-831, 854-858, 1142-1145 |
| Context hook | AdapterContext.tsx | useAdapter(), useHasAdapter() |
| Context provider | AdapterContext.tsx | <AdapterProvider> |

---

**Document Version**: 1.0  
**Last Updated**: 2025-11-26  
**Scope**: Open-S3 S3Explorer UI adapter integration patterns
