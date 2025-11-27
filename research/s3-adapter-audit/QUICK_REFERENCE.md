# S3Adapter Usage - Quick Reference

## At a Glance

- **Primary Component**: `src/ui/s3-explorer.tsx` (95% of adapter usage)
- **Adapter Access**: Via context (`useAdapter()`) or prop
- **Total Methods Called**: 11 unique methods
- **S3-Specific Methods**: 3 (getBucketEntries, setBucket, setRegion)
- **Issues Found**: 3 medium severity

## All Adapter Calls

```
s3-explorer.tsx:194    adapter.list(path)                      // Load directory
s3-explorer.tsx:487    adapter.list(path)                      // Refresh
s3-explorer.tsx:781    adapter.create(path, type, ...)         // Create file/dir
s3-explorer.tsx:789    adapter.delete(path, recursive, ...)    // Delete
s3-explorer.tsx:795    adapter.move(source, dest, ...)         // Move/rename
s3-explorer.tsx:801    adapter.copy(source, dest, ...)         // Copy
s3-explorer.tsx:806    adapter.downloadToLocal(...)            // Optional: Download
s3-explorer.tsx:814    adapter.uploadFromLocal(...)            // Optional: Upload
s3-explorer.tsx:840    adapter.list(path)                      // Post-op refresh
s3-explorer.tsx:1050   adapter.getBucketEntries()              // Root view - S3 only
s3-explorer.tsx:1051   adapter.getBucketEntries()              // Root view - S3 only
s3-explorer.tsx:1063   adapter.list(path)                      // Init data
s3-explorer.tsx:1138   adapter.read(path)                      // File preview
s3-explorer.tsx:264    adapter.setBucket(name)                 // S3 only (unguarded!)
s3-explorer.tsx:267    adapter.setRegion(region)               // S3 only (unguarded!)
s3-explorer.tsx:471    adapter.getBucketEntries()              // Refresh - S3 only
s3-explorer.tsx:603    adapter.setBucket(name)                 // S3 only (unguarded!)
```

## S3-Specific Code

**Bucket handling** (Lines 259-268):

```typescript
// Checks entry type 'bucket' - S3-specific
if (!bucket && currentEntry.type === 'bucket') {
  // Calls setBucket + setRegion - S3-specific
  if (adapter.setBucket) adapter.setBucket(bucketName);
  if (adapter.setRegion) adapter.setRegion(bucketRegion);
}
```

**Root view mode**:

```typescript
// Assumes bucket mode: no bucket = list buckets, has bucket = list objects
if (!bucket) {
  if (adapter.getBucketEntries) {
    // S3-specific, skipped if adapter doesn't have it
  }
}
```

## Issues Found

| Issue                         | Location       | Severity | Impact                              |
| ----------------------------- | -------------- | -------- | ----------------------------------- |
| Unguarded `setBucket()` calls | Lines 264, 603 | Medium   | Will crash non-BucketAware adapters |
| Unguarded `setRegion()` call  | Line 267       | Medium   | Will crash non-BucketAware adapters |
| S3 bucket type in UI          | Line 259       | Medium   | Breaks abstraction for GCS/Azure    |
| Region metadata assumption    | Line 261       | Medium   | Assumes region in bucket metadata   |

## Good Patterns

✅ All operations pass `{ onProgress }` callback  
✅ All adapter calls wrapped in try-catch  
✅ Download/Upload operations are properly guarded  
✅ Using generic `Adapter` interface, not `S3Adapter`  
✅ AdapterContext properly implemented  
✅ Capability checks before optional operations

## To Support New Backend

1. ⚠️ Remove bucket type check (line 259) - backend-agnostic
2. ⚠️ Guard `setBucket`/`setRegion` calls
3. ⚠️ Provide region metadata or skip region handling
4. ✅ Implement `list()`, `read()`, `create()`, `delete()`, `move()`, `copy()`
5. ✅ Optional: Implement `downloadToLocal()`, `uploadFromLocal()`
6. ✅ Optional: Implement `getBucketEntries()`, `setBucket()`, `setRegion()`

## File Structure

```
src/
├── adapters/
│   ├── adapter.ts              # Interface definitions
│   ├── s3-adapter.ts           # S3 implementation (BucketAwareAdapter)
│   └── mock-adapter.ts         # Mock implementation
├── contexts/
│   └── AdapterContext.tsx       # useAdapter(), useHasAdapter()
└── ui/
    └── s3-explorer.tsx         # All adapter usage in one file
```

## Quick Copy-Paste Fixes

### Fix 1: Guard setBucket/setRegion

```typescript
// Line 263-268: Current
if (adapter.setBucket) {
  adapter.setBucket(bucketName);
}
if (adapter.setRegion) {
  adapter.setRegion(bucketRegion);
}

// Better
import { isBucketAwareAdapter } from '../adapters/adapter.js';
if (isBucketAwareAdapter(adapter)) {
  adapter.setBucket(bucketName);
  if (bucketRegion) {
    adapter.setRegion(bucketRegion);
  }
}
```

### Fix 2: Add feature detection hook

```typescript
// In AdapterContext.tsx
export function useAdapterCapabilities(adapter: Adapter) {
  return {
    isBucketAware: isBucketAwareAdapter(adapter),
    isTransferable: isTransferableAdapter(adapter),
    isMutable: isMutableAdapter(adapter),
  };
}
```

### Fix 3: Protect bucket type check

```typescript
// Line 259: Current
if (!bucket && currentEntry.type === 'bucket') {

// Better: Only show if bucket-aware
if (!bucket && currentEntry.type === 'bucket' && isBucketAwareAdapter(adapter)) {
```
