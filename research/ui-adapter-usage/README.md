# UI Adapter Usage Documentation

Complete research on how the S3Explorer UI components interact with storage adapters.

## 📚 Documents in This Research

### 1. **COMPREHENSIVE_REPORT.md** (START HERE)

Full documentation of adapter usage patterns, including:

- Complete inventory of all adapter method calls
- Detailed usage patterns in S3Explorer component
- Error handling strategies
- Progress tracking assumptions
- Return type expectations
- Optional methods pattern
- Recommendations for adapter implementations

**Best For**: Understanding the complete picture of adapter usage

### 2. **QUICK_REFERENCE.md**

Quick lookup tables and common patterns:

- Adapter methods called by UI (table)
- Files using adapters
- Common code patterns
- Key assumptions table
- Error recovery scenarios
- Implementation checklist

**Best For**: Quick lookups during development

### 3. **FILE_BY_FILE_ANALYSIS.md**

Detailed analysis of every file mentioned:

- s3-explorer.tsx - with code sections and line numbers
- progress-window-integration.test.tsx - test patterns
- AdapterContext.tsx - context implementation
- useNavigationHandlers.ts - callback pattern
- All adapter-agnostic files documented
- Dependency analysis
- Architectural insights

**Best For**: Deep diving into specific files and understanding data flow

---

## 🎯 Key Findings

### Adapter Usage is Highly Centralized

- **Primary Location**: `src/ui/s3-explorer.tsx` (1,288 lines, 31% adapter-related)
- **11 adapter methods called** from this single component
- **All error handling** at call sites
- **Zero adapter calls** in other UI components or most hooks

### Architecture Pattern: Dependency Injection

```
AdapterProvider
    ↓
S3Explorer (receives adapter via prop or context)
    ├→ useNavigationHandlers (receives onLoadBuffer callback)
    ├→ useProgressState (receives progress events)
    └→ Other UI components (receive data via props only)
```

### Optional Methods Pattern

Some adapter methods have guards:

```typescript
if (adapter.downloadToLocal) {
  await adapter.downloadToLocal(...);
}
```

When not available, operation is skipped gracefully.

### All Operations Are Async

- `list()`, `read()`, `create()`, `delete()`, `move()`, `copy()` → Promise-based
- `downloadToLocal()`, `uploadFromLocal()`, `getBucketEntries()` → Promise-based
- `setBucket()`, `setRegion()` → Synchronous side effects (optional)

### Error Handling is Consistent

- All async operations wrapped in try-catch
- Errors parsed with `parseAwsError()` utility
- User messages formatted to 70 chars
- Status bar shows errors in red
- Previous state preserved on error (no UI crash)

### Progress Tracking is Built-In

Every adapter operation receives optional `onProgress` callback:

```typescript
adapter.delete(path, recursive, { onProgress });
```

UI aggregates progress across multiple operations.

---

## 🔍 Quick Navigation

**Looking for...**

| Goal                         | Document                 | Section                  |
| ---------------------------- | ------------------------ | ------------------------ |
| How adapter.list() is called | COMPREHENSIVE_REPORT.md  | Section 2.1 - Method 1   |
| Error handling patterns      | COMPREHENSIVE_REPORT.md  | Section 6                |
| All methods table            | QUICK_REFERENCE.md       | Adapter Methods table    |
| s3-explorer.tsx breakdown    | FILE_BY_FILE_ANALYSIS.md | Section 1                |
| Common code patterns         | QUICK_REFERENCE.md       | Common Patterns          |
| Entry structure              | QUICK_REFERENCE.md       | Entry Structure          |
| Progress callback details    | COMPREHENSIVE_REPORT.md  | Section 5.3              |
| Optional methods             | COMPREHENSIVE_REPORT.md  | Section 5.5              |
| Return type expectations     | COMPREHENSIVE_REPORT.md  | Section 5.4              |
| Implementation checklist     | QUICK_REFERENCE.md       | Implementation Checklist |

---

## 📋 Adapter Methods Called by UI

| Method               | Lines               | When Called               | Guard? |
| -------------------- | ------------------- | ------------------------- | ------ |
| `list()`             | 194, 486, 840, 1063 | Navigation, refresh, init | ❌     |
| `read()`             | 1138                | File preview              | ❌     |
| `create()`           | 781                 | Create file/dir           | ❌     |
| `delete()`           | 789                 | Delete entry              | ❌     |
| `move()`             | 795                 | Move/rename               | ❌     |
| `copy()`             | 801                 | Copy entry                | ❌     |
| `downloadToLocal()`  | 807                 | Download                  | ✅     |
| `uploadFromLocal()`  | 814                 | Upload                    | ✅     |
| `setBucket()`        | 264, 602            | Bucket selection          | ✅     |
| `setRegion()`        | 267                 | Bucket selection          | ✅     |
| `getBucketEntries()` | 471, 1050           | Root view, refresh        | ✅     |

---

## 🏗️ Architecture Diagram

```
┌─ Adapter Interface (adapter.ts)
│  ├─ ReadableStorageAdapter (list, read, getMetadata, exists)
│  ├─ MutableStorageAdapter (+ create, delete, move, copy)
│  ├─ TransferableStorageAdapter (+ downloadToLocal, uploadFromLocal)
│  └─ BucketAwareAdapter (+ getBucketEntries, setBucket, setRegion)
│
├─ AdapterContext (AdapterContext.tsx)
│  ├─ AdapterProvider <adapter>
│  ├─ useAdapter() → Adapter
│  ├─ useHasAdapter() → boolean
│  └─ useTypedAdapter<T>() → T
│
└─ S3Explorer Component (s3-explorer.tsx)
   ├─ Resolves adapter (prop or context)
   ├─ Navigation Handler
   │  └─ onLoadBuffer → adapter.list()
   ├─ Action Handlers
   │  ├─ entry:open → adapter.setBucket(), setRegion()
   │  ├─ buffer:refresh → adapter.getBucketEntries() or list()
   │  └─ ...
   ├─ Confirm Handler (Operation Loop)
   │  ├─ create → adapter.create()
   │  ├─ delete → adapter.delete()
   │  ├─ move → adapter.move()
   │  ├─ copy → adapter.copy()
   │  ├─ download → adapter.downloadToLocal()
   │  └─ upload → adapter.uploadFromLocal()
   ├─ Preview Effect
   │  └─ adapter.read()
   └─ Initial Data Load
      ├─ adapter.getBucketEntries() (root mode)
      └─ adapter.list() (bucket mode)
```

---

## 🔧 For Developers

### Implementing a New Adapter

Must implement:

- ✅ `list(path: string): Promise<ListResult>`
- ✅ `read(path: string): Promise<Buffer>`
- ✅ `create(path: string, type: EntryType): Promise<void>`
- ✅ `delete(path: string, recursive?: boolean): Promise<void>`
- ✅ `move(source: string, destination: string): Promise<void>`
- ✅ `copy(source: string, destination: string): Promise<void>`

Should implement (for full feature support):

- 📦 `downloadToLocal(remote: string, local: string, recursive?: boolean): Promise<void>`
- 📦 `uploadFromLocal(local: string, remote: string, recursive?: boolean): Promise<void>`
- 📦 `getBucketEntries(): Promise<Entry[]>`
- 📦 `setBucket(bucket: string): void`
- 📦 `setRegion(region: string): void`

### Testing Your Adapter

1. Pass to S3Explorer as prop:

```typescript
<S3Explorer adapter={myAdapter} bucket="test-bucket" />
```

2. Or use AdapterProvider:

```typescript
<AdapterProvider adapter={myAdapter}>
  <S3Explorer bucket="test-bucket" />
</AdapterProvider>
```

3. Test each operation type through UI:
   - List: Navigate to directory
   - Read: Preview file
   - Create: Press 'i' for insert mode
   - Delete: Press 'd', then 'w' to save
   - Move: Requires UI enhancements
   - Copy: Requires UI enhancements
   - Download/Upload: Uses transfer operations

---

## 📊 Statistics

- **Total adapter method calls in codebase**: 11 methods
- **Files with adapter usage**: 3 (s3-explorer.tsx, progress-window-integration.test.tsx, AdapterContext.tsx)
- **Adapter-agnostic files**: 28+ (hooks, UI components)
- **Lines of adapter code in S3Explorer**: ~400 of 1,288 (31%)
- **Centralization ratio**: 100% of adapter calls in 1 file
- **Optional methods**: 5 (downloadToLocal, uploadFromLocal, getBucketEntries, setBucket, setRegion)
- **Required methods**: 6 (list, read, create, delete, move, copy)

---

## 🚀 Common Tasks

### Add Progress Tracking to Operation

1. Implement progress callback in adapter
2. UI creates `onProgress` callback automatically
3. Adapter calls callback during operation
4. UI updates progress bar and currentFile

### Handle New Error Type

1. Update `parseAwsError()` utility if needed
2. Error automatically caught in try-catch
3. Message displayed in status bar
4. Operation can be retried

### Support Optional Adapter Feature

1. Add guard check: `if (adapter.method)`
2. Skip operation gracefully if not available
3. Show message to user
4. No UI crash

### Pass Adapter as Prop vs Context

1. **Prop**: `<S3Explorer adapter={adapter} />`
2. **Context**: `<AdapterProvider adapter={adapter}><S3Explorer /></AdapterProvider>`
3. **Both**: Prop takes precedence
4. **Neither**: Throws error

---

## 📝 Related Documentation

- **Adapter Interface**: `src/adapters/adapter.ts`
- **S3Adapter Implementation**: `src/adapters/s3-adapter.ts`
- **S3Explorer Component**: `src/ui/s3-explorer.tsx`
- **AdapterContext**: `src/contexts/AdapterContext.tsx`
- **Entry Types**: `src/types/entry.ts`

---

**Research Scope**: Open-S3 S3Explorer UI adapter integration patterns  
**Created**: 2025-11-26  
**Status**: Complete
