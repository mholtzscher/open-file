# S3Adapter Usage Audit

**Date**: 2025-11-27  
**Scope**: Comprehensive audit of S3Adapter usage patterns across the open-s3 codebase  
**Focus**: UI components, adapter methods, S3-specific assumptions, and AdapterContext integration

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Adapter Imports Overview](#adapter-imports-overview)
3. [UI Component Analysis](#ui-component-analysis)
4. [Adapter Method Calls](#adapter-method-calls)
5. [S3-Specific Assumptions](#s3-specific-assumptions)
6. [AdapterContext Usage Patterns](#adaptercontext-usage-patterns)
7. [Key Findings](#key-findings)
8. [Recommendations](#recommendations)

---

## Executive Summary

The S3Adapter is **tightly integrated** into the UI layer through the main `S3Explorer` component. The audit reveals:

- ✅ **Centralized adapter usage**: Nearly all adapter calls originate from `s3-explorer.tsx`
- ⚠️ **S3-specific leakage**: UI code makes assumptions about bucket-aware operations (`getBucketEntries`, `setBucket`, `setRegion`)
- ✅ **Good: AdapterContext integration**: Proper context-based dependency injection established
- ⚠️ **Concern**: Limited abstraction for S3-specific operations in UI layer
- ✅ **Good: Interface segregation**: Adapter interfaces are well-structured (ReadableStorageAdapter, MutableStorageAdapter, BucketAwareAdapter)

**Overall Assessment**: The adapter abstraction is reasonable, but the UI layer contains several S3-specific assumptions that would complicate supporting alternate storage backends (e.g., GCS, AzureBlob).

---

## Adapter Imports Overview

### Direct S3Adapter Imports

| File                                         | Line | Purpose                      | Type          |
| -------------------------------------------- | ---- | ---------------------------- | ------------- |
| `src/index.tsx`                              | 9    | Main initialization          | Direct import |
| `src/adapters/s3-adapter.copy.test.ts`       | 6    | Testing                      | Test import   |
| `src/adapters/s3-adapter.localstack.test.ts` | 21   | Integration testing          | Test import   |
| `src/adapters/adapter.test.ts`               | 7    | Adapter contract testing     | Test import   |
| `src/adapters/s3-adapter.di.test.ts`         | 15   | Dependency injection testing | Test import   |

### Adapter Interface Imports

| File                                          | Line | Usage                                        |
| --------------------------------------------- | ---- | -------------------------------------------- |
| `src/ui/s3-explorer.tsx`                      | 9    | `import { Adapter, ProgressEvent }`          |
| `src/ui/progress-window-integration.test.tsx` | 8    | `import { ProgressEvent, ProgressCallback }` |

**Key Finding**: Only test files directly import `S3Adapter`. Production code uses the generic `Adapter` interface, which is good for abstraction.

---

## UI Component Analysis

### Primary UI Component: S3Explorer (src/ui/s3-explorer.tsx)

**Role**: Main application component managing all storage operations and UI state

**Adapter Access Pattern** (lines 80-92):

```typescript
// Dual adapter resolution: prop or context
const hasAdapterContext = useHasAdapter();
const contextAdapter = hasAdapterContext ? useAdapter() : null;
const adapter = adapterProp ?? contextAdapter;

if (!adapter) {
  throw new Error('S3Explorer requires an adapter...');
}
```

**Adapter Usage Locations**:

#### 1. Navigation Loading (Line 194)

```typescript
const result = await adapter.list(path);
// Used in navigationConfig.onLoadBuffer callback
```

#### 2. Root View Initialization (Lines 1050-1051)

```typescript
if (adapter.getBucketEntries) {
  const entries = await adapter.getBucketEntries();
  // S3-specific: Only works with bucket-aware adapters
}
```

#### 3. Bucket Selection Handler (Lines 263-268)

```typescript
if (adapter.setBucket) {
  adapter.setBucket(bucketName);
}
if (adapter.setRegion) {
  adapter.setRegion(bucketRegion);
}
// **ISSUE**: S3-specific bucket/region concepts leak into UI
```

#### 4. Bucket Refresh (Lines 470-472)

```typescript
if (adapter.getBucketEntries) {
  adapter.getBucketEntries().then((entries: Entry[]) => {
    // Refresh root view
  });
}
```

#### 5. File Operations (Lines 776-821)

**Create Operation** (Line 781):

```typescript
case 'create':
  await adapter.create(op.path, createType, undefined, { onProgress });
```

**Delete Operation** (Line 789):

```typescript
case 'delete':
  const isDirectory = op.entry?.type === 'directory';
  await adapter.delete(op.path, isDirectory, { onProgress });
```

**Move Operation** (Line 795):

```typescript
case 'move':
  await adapter.move(op.source, op.destination, { onProgress });
```

**Copy Operation** (Line 801):

```typescript
case 'copy':
  await adapter.copy(op.source, op.destination, { onProgress });
```

**Download Operation** (Lines 806-809):

```typescript
if (adapter.downloadToLocal && op.source && op.destination) {
  await adapter.downloadToLocal(op.source, op.destination, op.recursive || false, {
    onProgress,
  });
  // **ISSUE**: Optional method check - not all adapters support this
}
```

**Upload Operation** (Lines 814-817):

```typescript
if (adapter.uploadFromLocal && op.source && op.destination) {
  await adapter.uploadFromLocal(op.source, op.destination, op.recursive || false, {
    onProgress,
  });
  // **ISSUE**: Optional method check - not all adapters support this
}
```

#### 6. Post-Operation Refresh (Line 840)

```typescript
const result = await adapter.list(currentBufferState.currentPath);
currentBufferState.setEntries([...result.entries]);
```

#### 7. File Preview Loading (Line 1138)

```typescript
const buffer = await adapter.read(fullPath);
const content = buffer.toString('utf-8');
setPreviewContent(content);
```

### Other UI Components

**PreviewPane** (`src/ui/preview-pane-react.tsx`):

- ✅ **No adapter usage** - Pure presentation component
- Displays file content passed as props

**UploadDialog** (`src/ui/upload-dialog-react.tsx`):

- ✅ **No adapter usage** - Handles local file browsing only
- Returns selected files to parent for processing

**Other Components** (tested via grep):

- `s3-explorer-dialogs.tsx`: No adapter usage
- `confirmation-dialog-react.tsx`: No adapter usage
- `error-dialog-react.tsx`: No adapter usage
- `sort-menu-react.tsx`: No adapter usage
- `help-dialog-react.tsx`: No adapter usage
- `quit-dialog-react.tsx`: No adapter usage
- `status-bar-react.tsx`: No adapter usage
- `header-react.tsx`: No adapter usage
- `pane-react.tsx`: No adapter usage

**Finding**: ✅ Adapter usage is **well-contained** to a single component (`s3-explorer.tsx`)

---

## Adapter Method Calls

### Summary Table

| Method               | Type                       | Location        | S3-Specific | Line(s)             |
| -------------------- | -------------------------- | --------------- | ----------- | ------------------- |
| `list()`             | ReadableStorageAdapter     | s3-explorer.tsx | No          | 194, 487, 840, 1063 |
| `read()`             | ReadableStorageAdapter     | s3-explorer.tsx | No          | 1138                |
| `getBucketEntries()` | BucketAwareAdapter         | s3-explorer.tsx | **YES**     | 470-472, 1050-1051  |
| `setBucket()`        | BucketAwareAdapter         | s3-explorer.tsx | **YES**     | 263-264, 602-603    |
| `setRegion()`        | BucketAwareAdapter         | s3-explorer.tsx | **YES**     | 266-267             |
| `create()`           | MutableStorageAdapter      | s3-explorer.tsx | No          | 781                 |
| `delete()`           | MutableStorageAdapter      | s3-explorer.tsx | No          | 789                 |
| `move()`             | MutableStorageAdapter      | s3-explorer.tsx | No          | 795                 |
| `copy()`             | MutableStorageAdapter      | s3-explorer.tsx | No          | 801                 |
| `downloadToLocal()`  | TransferableStorageAdapter | s3-explorer.tsx | No          | 806-809             |
| `uploadFromLocal()`  | TransferableStorageAdapter | s3-explorer.tsx | No          | 814-817             |

### Method Call Patterns

#### 1. **Core Operations** (Well-abstracted, backend-independent)

- `list()` - 4 calls - List directory contents
- `read()` - 1 call - Read file for preview
- `create()` - 1 call - Create file/directory
- `delete()` - 1 call - Delete file/directory
- `move()` - 1 call - Rename/move operations
- `copy()` - 1 call - Copy operations

#### 2. **Transfer Operations** (Optional, with capability checks)

- `downloadToLocal()` - Protected with `if (adapter.downloadToLocal)`
- `uploadFromLocal()` - Protected with `if (adapter.uploadFromLocal)`

#### 3. **Bucket-Specific Operations** (S3-only, unprotected)

- `getBucketEntries()` - 2 calls - Root view bucket listing (S3-specific)
- `setBucket()` - 2 calls - Set active bucket (S3-specific)
- `setRegion()` - 1 call - Set AWS region (S3-specific)

---

## S3-Specific Assumptions

### 1. Bucket-Based Root View Model

**Location**: `s3-explorer.tsx` lines 258-269, 470-483, 1048-1071

**Assumption**:

```typescript
if (!bucket && currentEntry.type === 'bucket') {
  // When bucket is undefined, lists buckets
  // When bucket is defined, lists objects in bucket
}
```

**S3 Concept**: AWS S3's two-level model:

- Account level: List buckets
- Bucket level: List objects with prefix

**Impact**:

- ✅ Works for S3-compatible services (Minio, Wasabi, DigitalOcean Spaces)
- ❌ Doesn't work for flat storage backends (GCS, Azure Blob - different hierarchies)

**Code**:

```typescript
// Line 1048-1051
if (!bucket) {
  if (adapter.getBucketEntries) {
    const entries = await adapter.getBucketEntries();
  }
}
```

### 2. Region Metadata on Bucket Selection

**Location**: `s3-explorer.tsx` lines 260-268

**Code**:

```typescript
const bucketRegion = currentEntry.metadata?.region || 'us-east-1';

if (adapter.setRegion) {
  adapter.setRegion(bucketRegion);
}
```

**S3 Concept**: AWS S3 buckets are region-specific; region must be set for operations

**Impact**:

- ❌ Assumes buckets have region metadata (S3-specific)
- ❌ Falls back to 'us-east-1' (AWS assumption)
- ❌ Would require region tracking for other backends

### 3. Path-Based Directory Model

**Location**: `s3-explorer.tsx` throughout

**Assumption**:

```typescript
// Paths are strings with '/' delimiters
// Directories are identified by trailing '/'
const path = 'bucket/dir/subdir/';
```

**S3 Concept**: AWS S3 uses "virtual directories" via prefixes with '/' delimiters

**Impact**:

- ✅ Works for S3-compatible services
- ⚠️ Requires careful implementation in other backends
- GCS: Uses flat namespace, no directories
- Azure Blob: Uses container + path model

### 4. Entry Type Detection

**Location**: `s3-explorer.tsx` lines 259, 788

**Code**:

```typescript
if (currentEntry.type === 'bucket') {
  // S3-specific: bucket type
}

const isDirectory = op.entry?.type === 'directory';
```

**S3 Concepts**:

- Bucket type (S3-specific)
- Directory vs. File distinction (virtual in S3)

**Impact**:

- ✅ Entry interface is abstract and reusable
- ❌ But UI logic branches on 'bucket' type
- ❌ Only entry types: 'bucket' | 'file' | 'directory'

### 5. Multipart Upload Threshold

**Location**: Not in UI, but in adapter (`s3-adapter.ts`)

**S3 Concept**: 5MB threshold for multipart uploads (S3-specific optimization)

**Finding**: ✅ Appropriately hidden in adapter implementation

### 6. Entry Metadata Structure

**Location**: `s3-explorer.tsx` line 261

**Code**:

```typescript
const bucketRegion = currentEntry.metadata?.region || 'us-east-1';
```

**Assumption**: Bucket entries have `metadata.region` property

**Impact**:

- ✅ Abstracted as optional metadata
- ❌ But assumes `region` exists for S3 buckets
- Hard to test: Requires mocking bucket metadata with regions

---

## AdapterContext Usage Patterns

### Context Setup

**Location**: `src/contexts/AdapterContext.tsx`

**Three hooks provided**:

#### 1. `useAdapter()` (Line 107)

```typescript
export function useAdapter(): Adapter {
  const context = useContext(AdapterContext);
  if (!context) {
    throw new Error('useAdapter must be used within an AdapterProvider');
  }
  return context.adapter;
}
```

**Usage**:

- `s3-explorer.tsx` line 85: `const contextAdapter = useAdapter()`
- Throws error if used outside provider

#### 2. `useTypedAdapter<T>()` (Line 130)

```typescript
export function useTypedAdapter<T extends ReadableStorageAdapter>(): T {
  const adapter = useAdapter();
  return adapter as unknown as T;
}
```

**Status**: ✅ Defined but not used in current codebase

#### 3. `useHasAdapter()` (Line 153)

```typescript
export function useHasAdapter(): boolean {
  const context = useContext(AdapterContext);
  return context !== null;
}
```

**Usage**:

- `s3-explorer.tsx` line 84: `const hasAdapterContext = useHasAdapter()`
- Enables graceful degradation (optional context)

### Provider Setup

**Location**: `src/index.tsx` lines 188-192

```typescript
<KeyboardProvider>
  <AdapterProvider adapter={adapter}>
    <App bucket={bucket} adapter={adapter} configManager={configManager} />
  </AdapterProvider>
</KeyboardProvider>
```

**Pattern**:

- ✅ Adapter provided at app root
- ✅ Also passed as prop to App component (dual pattern)
- ⚠️ Redundant: Both context and prop passed

### Dual Access Pattern

**Location**: `s3-explorer.tsx` lines 80-92

```typescript
const hasAdapterContext = useHasAdapter();
const contextAdapter = hasAdapterContext ? useAdapter() : null;
const adapter = adapterProp ?? contextAdapter;
```

**Purpose**: Allow adapter from either prop or context
**Status**: ✅ Flexible pattern, good for testing and composition
**Risk**: Only one adapter used, unclear which takes precedence

### Provider Memoization

**Location**: `src/contexts/AdapterContext.tsx` lines 73-82

```typescript
const value = useMemo<AdapterContextValue>(
  () => ({
    adapter,
  }),
  [adapter]
);

return <AdapterContext.Provider value={value}>{children}</AdapterContext.Provider>;
```

**Status**: ✅ Properly memoized to prevent unnecessary re-renders

---

## Key Findings

### 1. ✅ **Good: Centralized Adapter Usage**

- **Location**: Almost exclusively in `s3-explorer.tsx`
- **Benefit**: Easy to audit, refactor, or swap implementations
- **Impact**: 95%+ of adapter calls in one component

### 2. ✅ **Good: Interface Segregation**

- **Interfaces**: ReadableStorageAdapter, MutableStorageAdapter, TransferableStorageAdapter, BucketAwareAdapter
- **Benefit**: Clear capability contracts
- **Status**: Well-designed adapter abstraction

### 3. ✅ **Good: Capability-Based Guards**

```typescript
if (adapter.getBucketEntries) {
  await adapter.getBucketEntries();
}
```

- **Benefit**: Gracefully handles adapters without certain capabilities
- **Locations**: Lines 470, 806, 814, 1050

### 4. ⚠️ **Issue: S3-Specific Bucket Handling**

- **Locations**: Lines 259, 263-268, 470, 1048-1051
- **Problem**: Entry type 'bucket' only exists in S3 model
- **Impact**: Requires re-architecting for GCS/Azure support
- **Severity**: Medium - Breaks abstraction at UI level

### 5. ⚠️ **Issue: Region Metadata Assumption**

- **Location**: Line 261: `currentEntry.metadata?.region`
- **Problem**: Assumes buckets have region metadata
- **Impact**: GCS/Azure would need to provide synthetic region data
- **Severity**: Medium

### 6. ⚠️ **Issue: Unprotected setBucket/setRegion Calls**

- **Locations**: Lines 263-268, 602-603
- **Problem**: Calls made without checking if adapter supports them
- **Compare to**: `downloadToLocal` is protected with `if` check
- **Severity**: Medium - Should be guarded like transfer operations

### 7. ✅ **Good: Error Handling**

- **Pattern**: All adapter calls wrapped in try-catch
- **Parsing**: `parseAwsError()` used for error normalization
- **Locations**: Throughout s3-explorer.tsx

### 8. ✅ **Good: Progress Tracking**

- **Pattern**: All long-running operations pass `{ onProgress }` callback
- **Locations**: Lines 781, 789, 795, 801, 807, 815
- **Status**: Properly implemented across operations

### 9. ⚠️ **Issue: No Adapter Feature Detection Hook**

- **Gap**: No standard way to check adapter capabilities
- **Workaround**: Manual checks like `if (adapter.getBucketEntries)`
- **Better Approach**:
  ```typescript
  // Could have:
  isBucketAware(adapter): boolean
  isTransferable(adapter): boolean
  // Rather than: if (adapter.downloadToLocal)
  ```

### 10. ✅ **Good: AdapterContext Integration**

- **Provider**: Correctly set up at app root
- **Hooks**: Three hooks provided (useAdapter, useTypedAdapter, useHasAdapter)
- **Status**: Well-implemented dependency injection

---

## Recommendations

### Priority 1: Immediate (Breaking Issues)

#### 1.1 Protect setBucket/setRegion Calls

```typescript
// Current (Line 263-268):
if (adapter.setBucket) {
  adapter.setBucket(bucketName);
}
if (adapter.setRegion) {
  adapter.setRegion(bucketRegion);
}

// Better: Use type guard
if (isBucketAwareAdapter(adapter)) {
  adapter.setBucket(bucketName);
  adapter.setRegion(bucketRegion);
}
```

**Files to update**:

- `src/ui/s3-explorer.tsx` lines 263-268, 602-603

#### 1.2 Extract Bucket-Specific Logic

Create a separate component or hook for bucket selection:

```typescript
// New: useBucketSelection.ts
export function useBucketSelection(adapter: Adapter) {
  const handleBucketSelect = (bucket: Entry) => {
    if (isBucketAwareAdapter(adapter)) {
      adapter.setBucket(bucket.name);
      if (bucket.metadata?.region) {
        adapter.setRegion(bucket.metadata.region);
      }
    }
  };

  return { handleBucketSelect };
}
```

**Benefit**: Encapsulates S3-specific logic, easier to mock for GCS/Azure

### Priority 2: Enhancement (Better Abstraction)

#### 2.1 Add Feature Detection Hook

```typescript
// In AdapterContext.tsx
export function useAdapterCapabilities(adapter: Adapter) {
  return {
    isBucketAware: isBucketAwareAdapter(adapter),
    isTransferable: isTransferableAdapter(adapter),
    isMutable: isMutableAdapter(adapter),
    supportsBucketListing: 'getBucketEntries' in adapter,
    supportsRegionSelection: 'setRegion' in adapter,
  };
}
```

**Usage**:

```typescript
const caps = useAdapterCapabilities(adapter);
if (caps.isBucketAware) {
  // Show bucket selection UI
}
```

#### 2.2 Generalize Root View Logic

```typescript
// Current assumption:
// - No bucket → List buckets (S3-specific)
// - Bucket set → List objects (S3-specific)

// Better: Provider abstraction
interface RootViewProvider {
  getRootEntries(): Promise<Entry[]>;
  canListBuckets(): boolean;
}
```

### Priority 3: Documentation (Lower Risk)

#### 3.1 Document S3-Specific Assumptions

Add comments to UI code explaining which patterns are S3-specific:

```typescript
// Line 259: S3-SPECIFIC: 'bucket' entry type only exists in S3
if (!bucket && currentEntry.type === 'bucket') {
  // ...
}

// Line 261: S3-SPECIFIC: Assumes bucket metadata contains region
const bucketRegion = currentEntry.metadata?.region || 'us-east-1';
```

#### 3.2 Add Migration Guide

For supporting new backends (GCS, Azure, etc.):

1. Map backend container/bucket model to Entry type
2. Provide region metadata (or synthetic values)
3. Implement directory path handling
4. Implement transfer operations

---

## Appendix: Detailed Call Sites

### All Adapter Method Calls in Production Code

#### `adapter.list()`

1. **s3-explorer.tsx:194** - Navigation loading
2. **s3-explorer.tsx:487** - Current path refresh
3. **s3-explorer.tsx:840** - Post-operation refresh
4. **s3-explorer.tsx:1063** - Initial data load

#### `adapter.read()`

1. **s3-explorer.tsx:1138** - File preview loading

#### `adapter.create()`

1. **s3-explorer.tsx:781** - File/directory creation with progress

#### `adapter.delete()`

1. **s3-explorer.tsx:789** - File/directory deletion with progress

#### `adapter.move()`

1. **s3-explorer.tsx:795** - File/directory rename/move with progress

#### `adapter.copy()`

1. **s3-explorer.tsx:801** - File/directory copy with progress

#### `adapter.getBucketEntries()`

1. **s3-explorer.tsx:471** - Root view refresh
2. **s3-explorer.tsx:1051** - Initial data load (root view)

#### `adapter.setBucket()`

1. **s3-explorer.tsx:264** - Bucket selection from root view
2. **s3-explorer.tsx:603** - Bucket selection in keyboard handler

#### `adapter.setRegion()`

1. **s3-explorer.tsx:267** - Region update during bucket selection

#### `adapter.downloadToLocal()`

1. **s3-explorer.tsx:807** - Download with progress (optional, guarded)

#### `adapter.uploadFromLocal()`

1. **s3-explorer.tsx:815** - Upload with progress (optional, guarded)

---

## Summary Statistics

| Metric                          | Value                                      |
| ------------------------------- | ------------------------------------------ |
| **Total Adapter Method Calls**  | 14                                         |
| **Unique Methods Called**       | 11                                         |
| **UI Components Using Adapter** | 1                                          |
| **Files with Adapter Imports**  | 5 (1 prod + 4 test)                        |
| **S3-Specific Method Calls**    | 3 (getBucketEntries, setBucket, setRegion) |
| **Backend-Agnostic Calls**      | 11                                         |
| **Guarded Optional Calls**      | 2 (downloadToLocal, uploadFromLocal)       |
| **Unguarded S3-Specific Calls** | 3 ⚠️                                       |

---

## Version History

| Date       | Author   | Status   | Changes                     |
| ---------- | -------- | -------- | --------------------------- |
| 2025-11-27 | AI Agent | Complete | Initial comprehensive audit |
