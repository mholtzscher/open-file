# UI Adapter Usage - Quick Reference

## Adapter Methods Called by UI

| Method               | Location        | Called From           | Line                | When                      | Guard                                   |
| -------------------- | --------------- | --------------------- | ------------------- | ------------------------- | --------------------------------------- |
| `list()`             | s3-explorer.tsx | onLoadBuffer callback | 194, 486, 840, 1063 | Navigation, refresh, init | ❌ No                                   |
| `read()`             | s3-explorer.tsx | Preview effect        | 1138                | File preview              | ❌ No                                   |
| `create()`           | s3-explorer.tsx | Confirm handler       | 781                 | Create file/dir           | ❌ No                                   |
| `delete()`           | s3-explorer.tsx | Confirm handler       | 789                 | Delete entry              | ❌ No                                   |
| `move()`             | s3-explorer.tsx | Confirm handler       | 795                 | Move/rename               | ❌ No                                   |
| `copy()`             | s3-explorer.tsx | Confirm handler       | 801                 | Copy entry                | ❌ No                                   |
| `downloadToLocal()`  | s3-explorer.tsx | Confirm handler       | 807                 | Download                  | ✅ Yes: `if (adapter.downloadToLocal)`  |
| `uploadFromLocal()`  | s3-explorer.tsx | Confirm handler       | 814                 | Upload                    | ✅ Yes: `if (adapter.uploadFromLocal)`  |
| `setBucket()`        | s3-explorer.tsx | Navigate into bucket  | 264, 602            | Bucket selection          | ✅ Yes: `if (adapter.setBucket)`        |
| `setRegion()`        | s3-explorer.tsx | Navigate into bucket  | 267                 | Bucket selection          | ✅ Yes: `if (adapter.setRegion)`        |
| `getBucketEntries()` | s3-explorer.tsx | Init, refresh, action | 471, 1050           | Root view, refresh        | ✅ Yes: `if (adapter.getBucketEntries)` |

## Files Using Adapters

### Primary Usage (UI Components)

- **src/ui/s3-explorer.tsx** - Main component, 11 adapter methods
- **src/ui/progress-window-integration.test.tsx** - Types only

### Context Usage

- **src/contexts/AdapterContext.tsx** - Provides `useAdapter()`, `useHasAdapter()`

### Hook Usage

- **src/hooks/useNavigationHandlers.ts** - Receives callbacks, NOT direct calls

### Adapter-Agnostic (No Adapter Code)

- All other UI components
- All other hooks
- Buffer state management

## Common Patterns

### Pattern 1: Adapter Resolution

```typescript
const hasAdapterContext = useHasAdapter();
const contextAdapter = hasAdapterContext ? useAdapter() : null;
const adapter = adapterProp ?? contextAdapter;

if (!adapter) {
  throw new Error('S3Explorer requires an adapter.');
}
```

### Pattern 2: List with Error Handling

```typescript
try {
  const result = await adapter.list(path);
  bufferState.setEntries([...result.entries]);
  setStatusMessage('Success');
} catch (err) {
  const parsedError = parseAwsError(err, 'Navigation failed');
  setStatusMessage(formatErrorForDisplay(parsedError, 70));
  setStatusMessageColor(CatppuccinMocha.red);
}
```

### Pattern 3: Optional Methods

```typescript
if (adapter.downloadToLocal) {
  await adapter.downloadToLocal(source, dest, recursive, { onProgress });
} else {
  setStatusMessage('Download not supported');
}
```

### Pattern 4: Progress Tracking

```typescript
const onProgress = (event: ProgressEvent) => {
  const baseProgress = (opIndex / totalOps) * 100;
  const opProgress = event.percentage / totalOps;
  const totalProgress = Math.round(baseProgress + opProgress);
  updateProgress(totalProgress);
};

await adapter.delete(path, true, { onProgress });
```

## Key Assumptions

### Return Types

- `list()` → `Promise<{entries: Entry[], hasMore: boolean, continuationToken?: string}>`
- `read()` → `Promise<Buffer>` (UTF-8 decodable)
- `getBucketEntries()` → `Promise<Entry[]>`
- `create/delete/move/copy/download/upload()` → `Promise<void>`
- `setBucket/setRegion()` → `void`

### Error Handling

- All methods throw on error (not return error objects)
- Errors caught with try-catch
- UI shows error message in status bar
- Previous state preserved on error

### Progress Callback

- Called multiple times during operation
- `percentage`: 0-100 for current operation
- `operation`: Description string
- `currentFile`: Optional current file name
- UI aggregates across multiple operations

### Optional Methods

When not available, UI gracefully skips:

- `downloadToLocal`, `uploadFromLocal` - Shows error if attempted
- `getBucketEntries`, `setBucket`, `setRegion` - Skips silently

## Error Recovery

| Scenario                          | Response                                                    |
| --------------------------------- | ----------------------------------------------------------- |
| `adapter.list()` throws           | Show error, keep previous entries visible                   |
| `adapter.read()` throws           | Set preview to "Failed to load preview"                     |
| `adapter.delete()` in loop throws | Log error, continue with next operation, show error message |
| Optional method missing           | Skip operation gracefully, show error message               |
| Operation aborted by user         | Set message to "Operation cancelled by user"                |

## State Management

### When Adapter Operations Succeed

1. Update buffer with new entries
2. Update original entries reference
3. Clear deletion marks
4. Show success message in status bar

### When Adapter Operations Fail

1. Preserve previous entries
2. Show error message in status bar
3. Don't update state
4. Allow user to retry

## Entry Structure Expectations

```typescript
{
  id: string,           // Unique identifier
  name: string,         // Filename or bucket name
  type: 'file' | 'directory' | 'bucket',
  path: string,         // Full path
  size?: number,        // File size (optional)
  modified?: Date,      // Last modified (optional)
  metadata?: {          // Custom metadata (optional)
    region?: string,    // AWS region for buckets
    [key: string]: any
  }
}
```

## Implementation Checklist for New Adapter

Must Implement:

- ✅ `list(path)` - Core functionality
- ✅ `read(path)` - Preview support
- ✅ `create(path, type)` - File creation
- ✅ `delete(path, recursive)` - Deletion
- ✅ `move(source, dest)` - Rename/move
- ✅ `copy(source, dest)` - Copying

Should Implement (for full feature support):

- 📦 `downloadToLocal(remote, local, recursive)`
- 📦 `uploadFromLocal(local, remote, recursive)`
- 📦 `getBucketEntries()`
- 📦 `setBucket(bucket)`
- 📦 `setRegion(region)`

Progress Support:

- ✅ Pass progress callback in every operation option
- ✅ Call callback with `{operation, percentage, currentFile, bytesTransferred, totalBytes}`

Error Handling:

- ✅ Throw descriptive errors
- ✅ Include context in error messages
- ✅ Support AWS error types for S3Adapter

---

**Quick Reference Version**: 1.0  
**Last Updated**: 2025-11-26
