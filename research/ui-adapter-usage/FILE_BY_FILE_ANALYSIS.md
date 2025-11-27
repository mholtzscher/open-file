# File-by-File Adapter Usage Analysis

## Summary Table

| File | Category | Adapter Imports | Methods Used | Error Handling | Status |
|------|----------|-----------------|---------------|----------------|--------|
| src/ui/s3-explorer.tsx | Primary UI | Adapter, ProgressEvent, useAdapter, useHasAdapter | 11 methods | Comprehensive try-catch | ✅ CRITICAL |
| src/ui/progress-window-integration.test.tsx | Tests | ProgressEvent, ProgressCallback | None (types only) | N/A | ⚪ Info |
| src/ui/upload-dialog-react.tsx | UI Dialog | None | None | N/A | ⚪ N/A |
| src/contexts/AdapterContext.tsx | Context | Adapter | None (provides access) | useContext error | ⚪ N/A |
| src/hooks/useNavigationHandlers.ts | Hook | None | None (callbacks) | Error callback | ⚪ N/A |
| All other UI/hooks | UI/Hooks | None | None | N/A | ⚪ N/A |

---

## Detailed File Analysis

### 1. src/ui/s3-explorer.tsx

**Category**: PRIMARY UI COMPONENT - CRITICAL FILE

**File Size**: 1,288 lines  
**Adapter-Related Code**: ~400 lines (31%)

#### Imports Related to Adapters
```typescript
import { Adapter, ProgressEvent } from '../adapters/adapter.js';
import { useAdapter, useHasAdapter } from '../contexts/AdapterContext.js';
```

#### Props Interface
```typescript
interface S3ExplorerProps {
  bucket?: string;
  adapter?: Adapter;  // Optional prop - takes precedence over context
  configManager: ConfigManager;
}
```

#### Component Structure with Adapter Usage

**Section 1: Adapter Resolution (Lines 80-92)**
```typescript
const hasAdapterContext = useHasAdapter();
const contextAdapter = hasAdapterContext ? useAdapter() : null;
const adapter = adapterProp ?? contextAdapter;

if (!adapter) {
  throw new Error(
    'S3Explorer requires an adapter. Either pass it as a prop or wrap with AdapterProvider.'
  );
}
```
**Analysis**: 
- Supports both prop and context injection
- Prop takes precedence (destructuring with ??)
- Throws if neither source provides adapter
- Dependency: useHasAdapter, useAdapter hooks

---

**Section 2: Navigation Configuration (Lines 189-213)**
```typescript
const navigationConfig = useMemo(
  () => ({
    onLoadBuffer: async (path: string) => {
      const activeBufferState = multiPaneLayout.getActiveBufferState() || bufferState;
      try {
        const result = await adapter.list(path);  // ← adapter.list() CALL
        activeBufferState.setEntries([...result.entries]);
        activeBufferState.setCurrentPath(path);
        setOriginalEntries([...result.entries]);
        activeBufferState.cursorToTop();
        setStatusMessage(`Navigated to ${path}`);
        setStatusMessageColor(CatppuccinMocha.green);
      } catch (err) {  // ← ERROR HANDLING
        const parsedError = parseAwsError(err, 'Navigation failed');
        setStatusMessage(formatErrorForDisplay(parsedError, 70));
        setStatusMessageColor(CatppuccinMocha.red);
      }
    },
    onErrorOccurred: (error: string) => {
      setStatusMessage(error);
      setStatusMessageColor(CatppuccinMocha.red);
    },
  }),
  [adapter, bufferState, multiPaneLayout]
);
```
**Adapter Methods**:
- `adapter.list(path)` - Line 194
- **Return Type Assumption**: `ListResult` with `{entries: Entry[]}`
- **Error Handling**: Try-catch, parseAwsError, status message
- **Dependencies**: Dependency array includes `adapter` - re-runs if adapter changes

**Analysis**:
- Navigation config is memoized to prevent unnecessary re-renders
- onLoadBuffer is used by useNavigationHandlers hook
- Comprehensive error handling with user-friendly messages

---

**Section 3: Action Handlers - Entry:Open (Lines 252-284)**
```typescript
'entry:open': async () => {
  const currentBufferState = getActiveBuffer();
  const currentEntry = currentBufferState.entries[currentBufferState.selection.cursorIndex];

  if (!currentEntry) return;

  // Check if we're navigating into a bucket from root view
  if (!bucket && currentEntry.type === 'bucket') {
    const bucketName = currentEntry.name;
    const bucketRegion = currentEntry.metadata?.region || 'us-east-1';

    if (adapter.setBucket) {  // ← OPTIONAL METHOD CHECK
      adapter.setBucket(bucketName);  // ← adapter.setBucket() CALL
    }
    if (adapter.setRegion) {  // ← OPTIONAL METHOD CHECK
      adapter.setRegion(bucketRegion);  // ← adapter.setRegion() CALL
    }
    setBucket(bucketName);
    return;
  }

  if (currentEntry.type === 'file') {
    if (!previewEnabled) {
      setPreviewEnabled(true);
      setStatusMessage('Preview enabled');
      setStatusMessageColor(CatppuccinMocha.blue);
    }
    return;
  }

  await navigationHandlers.navigateInto();
}
```
**Adapter Methods**:
- `adapter.setBucket(bucketName)` - Line 264 (optional)
- `adapter.setRegion(bucketRegion)` - Line 267 (optional)
- **Pattern**: Guard checks with `if (adapter.method)`
- **Assumption**: Synchronous methods for adapter setup

---

**Section 4: Refresh Action (Lines 466-500)**
```typescript
'buffer:refresh': () => {
  const currentBufferState = getActiveBuffer();

  if (!bucket) {
    if (adapter.getBucketEntries) {  // ← OPTIONAL METHOD CHECK
      adapter
        .getBucketEntries()  // ← adapter.getBucketEntries() CALL
        .then((entries: Entry[]) => {
          currentBufferState.setEntries([...entries]);
          setStatusMessage(`Refreshed: ${entries.length} bucket(s)`);
          setStatusMessageColor(CatppuccinMocha.green);
        })
        .catch((err: unknown) => {  // ← ERROR HANDLING
          const parsedError = parseAwsError(err, 'Refresh failed');
          setStatusMessage(formatErrorForDisplay(parsedError, 70));
          setStatusMessageColor(CatppuccinMocha.red);
        });
    }
  } else {
    const currentPath = currentBufferState.currentPath;
    adapter
      .list(currentPath)  // ← adapter.list() CALL
      .then(result => {
        currentBufferState.setEntries([...result.entries]);
        setOriginalEntries([...result.entries]);
        setStatusMessage('Refreshed');
        setStatusMessageColor(CatppuccinMocha.green);
      })
      .catch((err: unknown) => {  // ← ERROR HANDLING
        const parsedError = parseAwsError(err, 'Refresh failed');
        setStatusMessage(formatErrorForDisplay(parsedError, 70));
        setStatusMessageColor(CatppuccinMocha.red);
      });
  }
}
```
**Adapter Methods**:
- `adapter.getBucketEntries()` - Line 471 (optional, then/catch pattern)
- `adapter.list()` - Line 487 (then/catch pattern)
- **Note**: Uses Promise .then()/.catch() instead of async/await

---

**Section 5: Confirm Handler - Main Operation Loop (Lines 731-865)**

This is the most complex section with all write operations:

```typescript
const createConfirmHandler = useCallback(async () => {
  try {
    const abortController = new AbortController();
    operationAbortControllerRef.current = abortController;

    let successCount = 0;
    showProgress({
      title: `Executing ${pendingOperations[0]?.type || 'operation'}...`,
      totalNum: pendingOperations.length,
      cancellable: true,
    });

    for (let opIndex = 0; opIndex < pendingOperations.length; opIndex++) {
      const op = pendingOperations[opIndex];

      if (abortController.signal.aborted) {
        setStatusMessage('Operation cancelled by user');
        setStatusMessageColor(CatppuccinMocha.yellow);
        break;
      }

      try {
        const onProgress = (event: ProgressEvent) => {  // ← PROGRESS CALLBACK
          const baseProgress = (opIndex / pendingOperations.length) * 100;
          const opProgress = event.percentage / pendingOperations.length;
          const totalProgress = Math.round(baseProgress + opProgress);

          updateProgress(totalProgress);
          if (event.currentFile) {
            dispatchProgress({ type: 'UPDATE', payload: { currentFile: event.currentFile } });
          }
          updateProgressDescription(event.operation);
        };

        const progress = Math.round((opIndex / pendingOperations.length) * 100);
        dispatchProgress({
          type: 'UPDATE',
          payload: {
            value: progress,
            description: `${op.type}: ${op.path || op.source || 'processing'}`,
            currentFile: op.path || op.source || '',
            currentNum: opIndex + 1,
          },
        });

        switch (op.type) {
          case 'create':
            if (op.path) {
              const createType =
                op.entryType === 'directory' ? EntryType.Directory : EntryType.File;
              await adapter.create(op.path, createType, undefined, { onProgress });  // ← CALL
              successCount++;
            }
            break;
          case 'delete':
            if (op.path) {
              const isDirectory = op.entry?.type === 'directory';
              await adapter.delete(op.path, isDirectory, { onProgress });  // ← CALL
              successCount++;
            }
            break;
          case 'move':
            if (op.source && op.destination) {
              await adapter.move(op.source, op.destination, { onProgress });  // ← CALL
              successCount++;
            }
            break;
          case 'copy':
            if (op.source && op.destination) {
              await adapter.copy(op.source, op.destination, { onProgress });  // ← CALL
              successCount++;
            }
            break;
          case 'download':
            if (adapter.downloadToLocal && op.source && op.destination) {  // ← GUARD
              await adapter.downloadToLocal(op.source, op.destination, op.recursive || false, {
                onProgress,
              });  // ← CALL
              successCount++;
            }
            break;
          case 'upload':
            if (adapter.uploadFromLocal && op.source && op.destination) {  // ← GUARD
              await adapter.uploadFromLocal(op.source, op.destination, op.recursive || false, {
                onProgress,
              });  // ← CALL
              successCount++;
            }
            break;
        }
      } catch (opError) {  // ← ERROR HANDLING
        if (opError instanceof Error && opError.name === 'AbortError') {
          setStatusMessage('Operation cancelled by user');
          setStatusMessageColor(CatppuccinMocha.yellow);
          break;
        }
        console.error(`Failed to execute ${op.type} operation:`, opError);
        const parsedError = parseAwsError(opError, `Failed to ${op.type}`);
        setStatusMessage(`Operation failed: ${formatErrorForDisplay(parsedError, 70)}`);
        setStatusMessageColor(CatppuccinMocha.red);
      }
    }

    hideProgress();

    if (successCount > 0) {
      try {
        const currentBufferState = multiPaneLayout.getActiveBufferState() || bufferState;
        const result = await adapter.list(currentBufferState.currentPath);  // ← RELOAD
        currentBufferState.setEntries([...result.entries]);
        currentBufferState.clearDeletionMarks();
        setOriginalEntries([...result.entries]);
        setStatusMessage(`${successCount} operation(s) completed successfully`);
        setStatusMessageColor(CatppuccinMocha.green);

        if (quitAfterSaveRef.current) {
          quitAfterSaveRef.current = false;
          process.exit(0);
        }
      } catch (reloadError) {  // ← RELOAD ERROR HANDLING
        console.error('Failed to reload buffer:', reloadError);
        setStatusMessage('Operations completed but failed to reload buffer');
        setStatusMessageColor(CatppuccinMocha.yellow);
      }
    }

    closeAndClearOperations();
  } catch {
    // Error handling is done within the loop
  }
}, [pendingOperations, adapter, multiPaneLayout, bufferState, closeAndClearOperations]);
```

**Adapter Methods Called**:
- `adapter.create(path, type, content?, {onProgress})` - Line 781
- `adapter.delete(path, recursive, {onProgress})` - Line 789
- `adapter.move(source, dest, {onProgress})` - Line 795
- `adapter.copy(source, dest, {onProgress})` - Line 801
- `adapter.downloadToLocal(remote, local, recursive, {onProgress})` - Line 807 (optional)
- `adapter.uploadFromLocal(local, remote, recursive, {onProgress})` - Line 814 (optional)
- `adapter.list(path)` - Line 840 (reload after success)

**Error Handling**:
1. Catch operation errors (opError)
2. Check for AbortError (user cancellation)
3. Parse AWS errors
4. Continue with next operation (resilience)
5. Catch reload errors separately (degraded mode)

**Progress Tracking**:
- Creates onProgress callback for each operation
- Aggregates progress: `baseProgress + (opProgress / totalOps)`
- Updates UI with `currentFile` and `operation` description
- Supports cancellation via AbortController

---

**Section 6: Preview Effect (Lines 1099-1157)**
```typescript
const fetchPreview = async () => {
  // ... validation checks ...
  
  try {
    const maxPreviewSize = 100 * 1024;
    if (selectedEntry.size && selectedEntry.size > maxPreviewSize) {
      setPreviewContent(`File too large to preview (${formatBytes(selectedEntry.size)})`);
      setPreviewFilename('');
      return;
    }

    const fullPath = currentBufferState.currentPath
      ? `${currentBufferState.currentPath}${selectedEntry.name}`
      : selectedEntry.name;

    const buffer = await adapter.read(fullPath);  // ← adapter.read() CALL
    const content = buffer.toString('utf-8');
    setPreviewContent(content);
    setPreviewFilename(selectedEntry.name);
  } catch (err) {  // ← ERROR HANDLING
    console.error('Failed to load preview:', err);
    setPreviewContent('Failed to load preview');
  }
};
```

**Adapter Methods**:
- `adapter.read(fullPath)` - Line 1138
- **Assumptions**: Returns Buffer, UTF-8 decodable
- **Size limit**: 100KB (prevents memory issues)
- **Error handling**: Graceful degradation to error message

---

**Section 7: Initial Data Load (Lines 1042-1094)**
```typescript
useEffect(() => {
  const initializeData = async () => {
    try {
      console.error(`[S3Explorer] Initializing data...`);

      const currentBufferState = multiPaneLayout.getActiveBufferState() || bufferState;
      if (!bucket) {
        console.error(`[S3Explorer] Root view mode detected, loading buckets...`);
        if (adapter.getBucketEntries) {  // ← GUARD
          const entries = await adapter.getBucketEntries();  // ← CALL
          console.error(`[S3Explorer] Received ${entries.length} buckets`);
          currentBufferState.setEntries([...entries]);
          currentBufferState.setCurrentPath('');
          setStatusMessage(`Found ${entries.length} bucket(s)`);
          setStatusMessageColor(CatppuccinMocha.green);
        } else {
          throw new Error('Adapter does not support bucket listing');
        }
      } else {
        const path = currentBufferState.currentPath;
        console.error(`[S3Explorer] Loading bucket: ${bucket}, path: "${path}"`);
        const result = await adapter.list(path);  // ← CALL
        console.error(`[S3Explorer] Received ${result.entries.length} entries`);

        currentBufferState.setEntries([...result.entries]);
        // ...
        setStatusMessage(`Loaded ${result.entries.length} items`);
        setStatusMessageColor(CatppuccinMocha.green);
      }

      setIsInitialized(true);
    } catch (err) {  // ← ERROR HANDLING
      console.error('[S3Explorer] Error loading data:', err);
      const parsedError = parseAwsError(
        err,
        bucket ? 'Failed to load bucket' : 'Failed to list buckets'
      );
      const errorDisplay = formatErrorForDisplay(parsedError, 70);
      console.error('[S3Explorer] Setting error message:', errorDisplay);
      setStatusMessage(errorDisplay);
      setStatusMessageColor(CatppuccinMocha.red);
      setIsInitialized(true);
    }
  };

  initializeData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [bucket, adapter]);  // ← DEPENDENCY: adapter
```

**Adapter Methods**:
- `adapter.getBucketEntries()` - Line 1050 (optional)
- `adapter.list(path)` - Line 1063

---

### 2. src/ui/progress-window-integration.test.tsx

**Category**: TEST FILE

**File Size**: 163 lines  
**Adapter-Related Code**: All lines (test code)

#### Imports
```typescript
import { ProgressEvent, ProgressCallback } from '../adapters/adapter.js';
```

#### Usage
- Only imports types (ProgressEvent, ProgressCallback)
- No adapter method calls
- Tests progress calculation logic
- Tests abort controller for cancellation

**Key Test Patterns**:
1. Simulates progress events with percentage 0-100
2. Tests batch operation progress aggregation
3. Tests AbortController for cancellation

---

### 3. src/contexts/AdapterContext.tsx

**Category**: CONTEXT/DI PROVIDER

**File Size**: 157 lines  
**Adapter-Related Code**: All lines

#### Exports

**1. AdapterProvider Component**
```typescript
export function AdapterProvider({ children, adapter }: AdapterProviderProps) {
  const value = useMemo<AdapterContextValue>(
    () => ({
      adapter,
    }),
    [adapter]
  );

  return <AdapterContext.Provider value={value}>{children}</AdapterContext.Provider>;
}
```
- Wraps adapter in context value
- Memoizes to prevent unnecessary re-renders

**2. useAdapter Hook**
```typescript
export function useAdapter(): Adapter {
  const context = useContext(AdapterContext);
  if (!context) {
    throw new Error('useAdapter must be used within an AdapterProvider');
  }
  return context.adapter;
}
```
- Retrieves adapter from context
- Throws if not in provider

**3. useTypedAdapter Hook**
```typescript
export function useTypedAdapter<T extends ReadableStorageAdapter>(): T {
  const adapter = useAdapter();
  return adapter as unknown as T;
}
```
- Type-safe adapter access for specific interface types

**4. useHasAdapter Hook**
```typescript
export function useHasAdapter(): boolean {
  const context = useContext(AdapterContext);
  return context !== null;
}
```
- Optional adapter checking

#### Usage in s3-explorer.tsx
```typescript
const hasAdapterContext = useHasAdapter();
const contextAdapter = hasAdapterContext ? useAdapter() : null;
const adapter = adapterProp ?? contextAdapter;
```

---

### 4. src/hooks/useNavigationHandlers.ts

**Category**: HOOK (NO DIRECT ADAPTER USAGE)

**File Size**: ~170 lines  
**Adapter-Related Code**: 0 lines (uses callbacks)

#### Structure
```typescript
export function useNavigationHandlers(
  bufferState: UseBufferStateReturn,
  config: NavigationConfig = {}
): UseNavigationHandlersReturn {
  const navigateInto = useCallback(async () => {
    // ...
    if (config.onLoadBuffer) {
      await config.onLoadBuffer(selected.path);  // ← Callback receives adapter call
    }
  }, [bufferState, config]);
  
  // ... more handlers
}
```

#### Integration
- Receives `NavigationConfig` with callbacks
- S3Explorer injects `onLoadBuffer` that calls `adapter.list()`
- Hook is adapter-agnostic, testable in isolation

#### Used By
- s3-explorer.tsx (receives navigationConfig with onLoadBuffer)

---

### 5. All Other UI Components

**Category**: ADAPTER-AGNOSTIC

**Files**:
- src/ui/buffer-state.ts
- src/ui/buffer-view-react.tsx
- src/ui/confirmation-dialog-react.tsx
- src/ui/error-dialog-react.tsx
- src/ui/help-dialog-react.tsx
- src/ui/header-react.tsx
- src/ui/pane-react.tsx
- src/ui/preview-pane-react.tsx
- src/ui/progress-window-react.tsx
- src/ui/quit-dialog-react.tsx
- src/ui/sort-menu-react.tsx
- src/ui/status-bar-react.tsx
- src/ui/s3-explorer-dialogs.tsx
- src/ui/s3-explorer-layout.tsx
- src/ui/upload-dialog-react.tsx

**Reason**: All UI components receive data via props, not adapters

---

### 6. All Other Hooks

**Category**: ADAPTER-AGNOSTIC

**Files**:
- src/hooks/useBufferState.ts
- src/hooks/useKeyboardDispatcher.ts
- src/hooks/useKeyboardEvents.ts
- src/hooks/useMultiPaneLayout.ts
- src/hooks/useProgressState.ts
- src/hooks/useDialogState.ts
- src/hooks/useTerminalSize.ts
- src/hooks/useKeybindings.ts
- src/hooks/useDialogKeyboard.ts

**Reason**: Hooks manage local state, receive callbacks for async operations

---

## Pattern Summary

### Adapter Usage Patterns

**Pattern 1: Configuration Callbacks**
- Component provides callbacks to hooks
- Hooks invoke callbacks without knowing implementation
- Example: navigationHandlers receives onLoadBuffer

**Pattern 2: Direct Adapter Calls**
- Main component (S3Explorer) makes direct calls
- All error handling at call site
- Async/await pattern

**Pattern 3: Optional Method Guards**
- Check method exists before calling
- Skip gracefully if not available
- Used for: downloadToLocal, uploadFromLocal, getBucketEntries, setBucket, setRegion

**Pattern 4: Progress Aggregation**
- Create onProgress callback
- Aggregate multiple operations into single progress bar
- UI calculates: baseProgress + (eventProgress / totalOps)

---

## Dependency Analysis

### S3Explorer Dependencies on Adapter
1. Direct calls to adapter methods
2. Depends on adapter being available (throws if missing)
3. Passes adapter to: navigationHandlers config, confirmHandler

### useNavigationHandlers Dependencies on Adapter
1. Indirect: receives onLoadBuffer callback
2. Does NOT depend on adapter directly
3. Can be tested without adapter

### Context Dependencies
1. AdapterProvider must wrap S3Explorer
2. S3Explorer can also receive adapter as prop
3. Prop takes precedence over context

---

## Key Architectural Insights

1. **Centralization**: All adapter calls in S3Explorer (1 file)
2. **Separation of Concerns**: Hooks and UI components are adapter-agnostic
3. **Dependency Injection**: Via context or props
4. **Error Resilience**: Try-catch at every call site
5. **Progress Support**: Built into operation callbacks
6. **Optional Features**: Transfer and bucket operations have guards
7. **Type Safety**: TypeScript interfaces for adapter contracts

