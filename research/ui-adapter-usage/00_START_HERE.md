# UI Adapter Usage - START HERE

## 📋 What This Research Contains

Complete documentation of **all UI adapter usage patterns** in the Open-S3 S3Explorer application. This includes:

- ✅ Every adapter method call in the codebase
- ✅ How each method is called and when
- ✅ Error handling patterns
- ✅ Progress tracking implementation
- ✅ Return type assumptions
- ✅ Optional methods and guards
- ✅ File-by-file analysis with line numbers

---

## 🎯 Key Discovery

**Adapter usage is 100% centralized in a single UI component:**

```
src/ui/s3-explorer.tsx
├─ 11 adapter methods called
├─ ~400 lines of adapter code (31% of file)
├─ All error handling included
└─ No adapter calls in other UI components
```

---

## 📖 How to Use This Research

### Quick Lookup
Need fast answers? Start with **QUICK_REFERENCE.md**
- Adapter methods table
- Common code patterns
- Implementation checklist
- Error scenarios

### Deep Understanding
Want to understand everything? Start with **COMPREHENSIVE_REPORT.md**
- Complete adapter interface documentation
- Detailed usage for each method
- Assumptions about adapter behavior
- Progress tracking details
- Recommendations for implementation

### Code Investigation
Debugging specific code? Start with **FILE_BY_FILE_ANALYSIS.md**
- Breakdown of s3-explorer.tsx by section
- Line numbers for every call
- Context imports and props
- Other files analyzed (hooks, context, etc.)

---

## 🚀 Quick Facts

| Aspect | Details |
|--------|---------|
| **Primary File** | `src/ui/s3-explorer.tsx` (1,288 lines) |
| **Adapter Methods Called** | 11 total |
| **Required Methods** | 6 (list, read, create, delete, move, copy) |
| **Optional Methods** | 5 (download, upload, bucket ops) |
| **Error Handling** | Try-catch at every call site |
| **Progress Tracking** | Built-in via callbacks |
| **Context Provider** | `src/contexts/AdapterContext.tsx` |
| **Files Using Adapters** | 3 (explorer, test, context) |
| **Adapter-Agnostic Files** | 28+ (all other UI/hooks) |

---

## 🔍 What You'll Find

### In COMPREHENSIVE_REPORT.md

1. **Adapter Architecture Overview** - Core interfaces
2. **UI Adapter Usage Inventory** - All 11 methods documented
3. **Hook Adapter Usage** - How hooks interact
4. **Context Adapter Usage** - DI pattern
5. **UI Assumptions** - Behavior expectations
6. **Error Handling Patterns** - 4 different patterns
7. **Adapter Injection Points** - How to provide adapters
8. **Key Insights** - 8 architectural takeaways

### In QUICK_REFERENCE.md

1. **Adapter Methods Table** - Quick lookup
2. **Files Using Adapters** - Directory overview
3. **Common Patterns** - Code snippets
4. **Key Assumptions** - Return types, errors, progress
5. **Error Recovery** - What happens on failure
6. **Implementation Checklist** - For new adapters

### In FILE_BY_FILE_ANALYSIS.md

1. **Summary Table** - All files with metrics
2. **s3-explorer.tsx Breakdown** - 7 sections with code
3. **Other Files** - Context, hooks, UI components
4. **Pattern Summary** - 4 usage patterns
5. **Dependency Analysis** - Component relationships
6. **Architectural Insights** - Design patterns

---

## 🧭 Navigation Guide

**I want to know...**

| Question | Document | Section |
|----------|----------|---------|
| How adapter methods are called | COMPREHENSIVE_REPORT | Section 2 |
| When each method is called | QUICK_REFERENCE | Adapter Methods Table |
| Where each method is called | FILE_BY_FILE_ANALYSIS | s3-explorer.tsx breakdown |
| What errors can happen | QUICK_REFERENCE | Error Recovery |
| How progress tracking works | COMPREHENSIVE_REPORT | Section 5.3 |
| How to implement a new adapter | QUICK_REFERENCE | Implementation Checklist |
| How optional methods work | COMPREHENSIVE_REPORT | Section 5.5 |
| How to pass the adapter | COMPREHENSIVE_REPORT | Section 7.1 |
| What the UI expects | COMPREHENSIVE_REPORT | Section 5 |
| Code examples | QUICK_REFERENCE | Common Patterns |

---

## 📊 Adapter Methods at a Glance

### Must-Implement Methods
```typescript
adapter.list(path) → Promise<ListResult>
adapter.read(path) → Promise<Buffer>
adapter.create(path, type) → Promise<void>
adapter.delete(path, recursive) → Promise<void>
adapter.move(source, dest) → Promise<void>
adapter.copy(source, dest) → Promise<void>
```

### Should-Implement Methods
```typescript
adapter.downloadToLocal(remote, local, recursive) → Promise<void>
adapter.uploadFromLocal(local, remote, recursive) → Promise<void>
adapter.getBucketEntries() → Promise<Entry[]>
adapter.setBucket(bucket) → void
adapter.setRegion(region) → void
```

### All Methods Support Progress
```typescript
{ onProgress: (event: ProgressEvent) => void }
```

---

## 💡 Key Patterns

### Pattern 1: Optional Methods
```typescript
if (adapter.downloadToLocal) {
  await adapter.downloadToLocal(...);
}
```

### Pattern 2: Error Handling
```typescript
try {
  const result = await adapter.list(path);
} catch (err) {
  const parsed = parseAwsError(err, 'Failed to list');
  setStatusMessage(formatErrorForDisplay(parsed, 70));
}
```

### Pattern 3: Progress Aggregation
```typescript
const onProgress = (event: ProgressEvent) => {
  const baseProgress = (opIndex / totalOps) * 100;
  const opProgress = event.percentage / totalOps;
  updateProgress(Math.round(baseProgress + opProgress));
};
```

### Pattern 4: Dependency Injection
```typescript
const hasContext = useHasAdapter();
const contextAdapter = hasContext ? useAdapter() : null;
const adapter = adapterProp ?? contextAdapter;
```

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────┐
│      S3Explorer Component           │
│  (src/ui/s3-explorer.tsx)          │
│                                     │
│  Adapter Resolution:                │
│  • Prop takes precedence            │
│  • Falls back to context            │
│  • Throws if neither provided       │
└────────────────┬────────────────────┘
                 │
        ┌────────▼────────┐
        │  Adapter        │
        │  (from prop     │
        │   or context)   │
        └────────┬────────┘
                 │
      ┌──────────┼──────────┐
      │          │          │
      ▼          ▼          ▼
   Read Ops  Write Ops  Transfer Ops
   • list()  • create() • download()
   • read()  • delete() • upload()
            • move()   • buckets
            • copy()
```

---

## 📚 Document Sizes

| Document | Size | Sections | Best For |
|----------|------|----------|----------|
| COMPREHENSIVE_REPORT.md | 23 KB | 10 | Complete understanding |
| FILE_BY_FILE_ANALYSIS.md | 21 KB | 6 | Code investigation |
| QUICK_REFERENCE.md | 6 KB | 6 | Quick lookups |
| README.md | 8.7 KB | 7 | Navigation guide |

**Total Research**: ~59 KB of documentation

---

## ✅ Verification Checklist

This research documents:
- ✅ All imports of adapter-related code
- ✅ All adapter methods called from UI
- ✅ All adapter methods called from hooks
- ✅ UI assumptions about adapter behavior
- ✅ Error handling patterns
- ✅ Progress tracking patterns
- ✅ File paths and line numbers
- ✅ Context and dependency injection
- ✅ Optional methods and guards
- ✅ Return types and data structures

---

## 🎓 Learning Path

**Beginner**: Start with README.md → QUICK_REFERENCE.md
**Intermediate**: Add COMPREHENSIVE_REPORT.md → Section 2
**Advanced**: Study FILE_BY_FILE_ANALYSIS.md → Implementation details

---

## 🔗 Related Files in Codebase

**Core Adapter Files**:
- `src/adapters/adapter.ts` - Interface definitions
- `src/adapters/s3-adapter.ts` - S3 implementation
- `src/adapters/mock-adapter.ts` - Mock implementation

**UI Files**:
- `src/ui/s3-explorer.tsx` - Primary component (CRITICAL)
- `src/ui/progress-window-integration.test.tsx` - Progress tests
- `src/contexts/AdapterContext.tsx` - Dependency injection

**Type Definitions**:
- `src/types/entry.ts` - Entry type
- `src/types/dialog.ts` - Operation types

---

## 📝 Notes

- This research is based on codebase analysis as of 2025-11-26
- All line numbers reference `src/ui/s3-explorer.tsx` unless otherwise noted
- Patterns shown are current implementation patterns
- Research focuses on UI side; adapter implementation details are in adapter tests

---

## 🎯 Next Steps

1. **Read** QUICK_REFERENCE.md for quick facts
2. **Understand** COMPREHENSIVE_REPORT.md for deep knowledge
3. **Investigate** FILE_BY_FILE_ANALYSIS.md for specific code
4. **Use** README.md for navigation while developing

---

**Research Metadata**:
- Created: 2025-11-26
- Scope: Open-S3 S3Explorer UI adapter patterns
- Status: ✅ Complete
- Coverage: 100% of UI adapter usage
