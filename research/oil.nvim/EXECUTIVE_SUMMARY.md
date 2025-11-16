# Oil.nvim Research - Executive Summary

## Research Complete ✅

Four comprehensive documents (2,340 lines of analysis) covering oil.nvim, a sophisticated Neovim file explorer plugin. This research provides the architectural foundation for building open-s3.

**Location**: `/Users/michael/code/vibes/open-s3/research/oil.nvim/`

---

## Key Findings at a Glance

### What is Oil.nvim?

A Neovim plugin that **treats the filesystem as an editable buffer**. Users browse directories, edit file listings like text, then save changes with `:w`. Inspired by vim-vinegar and built for modern Neovim.

### Why It's Relevant

✅ 5.9k+ stars (proven, well-maintained)
✅ Adapter architecture (directly applicable to S3)
✅ Cross-directory operations (critical for multi-bucket work)
✅ Safety-first design (confirmation dialogs essential for cloud ops)
✅ Vim-native operations (edit, delete, copy all work naturally)

---

## 1. Core Concept: Buffer-as-Filesystem

### Oil's Innovation

```
Traditional: Browse → Select → Edit
Oil's Way:   Browse → Edit → Save

Why? Because Vim users understand buffers.
- dd = delete
- p = paste (duplicate)
- yy = copy
- :w = commit
```

### Implication for S3

Users can:
- List S3 objects like a directory
- Edit entries (rename, move, copy)
- Confirm operations before executing
- Use all Vim motions naturally

---

## 2. Architecture Highlights

### Adapter Pattern (Genius for Multi-Backend)

Oil supports local filesystem AND SSH through pluggable adapters. Same buffer UI, different backends.

```
PERFECT for S3: Just add S3 adapter without changing UI layer
```

### Key Architecture Layers

1. **Buffer Layer**: Display, editing, confirmation
2. **Adapter Interface**: List, create, delete, move, copy
3. **Backend**: File system, SSH, or S3

### Change Tracking

- Compares current buffer to previous state
- Detects creates (new lines), deletes (removed lines), renames, copies
- Generates operation plan
- Shows confirmation before commit

**This exact pattern works for S3.**

---

## 3. Keybindings: Smart and Sparse

Oil has only **16 default keybindings** but they're strategically chosen:

| Binding | Purpose | Why |
|---------|---------|-----|
| `-` | Parent directory | Iconic (vim-vinegar origin) |
| `<CR>` | Open file | Universal convention |
| `<C-s>` | Vertical split | Standard Ctrl+letter |
| `j/k` | Navigate | Pure Vim |
| `dd`, `p`, `yy` | Edit | Pure Vim |
| `gs` | Change sort | Mnemonic (g=go, s=sort) |
| `g.` | Show hidden | Mnemonic (. = dotfiles) |
| `:w` | Save | Standard |

**Principle**: Vim-familiar users immediately understand oil.

---

## 4. UI/UX Patterns Worth Copying

### Visual Display
```
📁 lua/          (icon + name + optional columns)
📁 tests/
📄 main.rs       ← cursor here
📄 Cargo.toml
📄 README.md
```

Columns are:
- Icon (type indicator)
- Name (editable)
- Optional: size, mtime, permissions

### Floating Windows
- Non-intrusive (centered, with padding)
- Optional preview split
- Easy to toggle on/off

### Confirmation Dialogs
```
┌─────────────────────────────┐
│ Confirm Operations          │
├─────────────────────────────┤
│ Create: new_file.txt        │
│ Delete: old_config.json     │
│ Move:   file1 → archive/    │
│                             │
│ (y)es / (n)o                │
└─────────────────────────────┘
```

**Critical for S3**: Users see exactly what will happen before pressing `y`.

---

## 5. Workflows That Work

### Browse and Navigate
```
:Oil ~/projects    → Open directory
j k                → Navigate
<CR>               → Open file or enter directory
-                  → Go up
```

### Create File
```
1. Position cursor on empty line
2. Type: new_file.txt
3. :w → Creates file
```

### Batch Delete
```
1. V (visual line mode)
2. j j j (select 3 lines)
3. d (delete selected)
4. :w → Confirms and deletes all 3
```

### Copy Between Directories
```
Window 1: :Oil ~/src
Window 2: :Oil ~/backup

In Window 1:
  yy (copy file)
In Window 2:
  p (paste)
  :w (copies file between dirs)
```

**All of these map naturally to S3.**

---

## 6. What Makes Oil Extensible

### Configuration Options: 50+
- Columns to display
- Sort order
- Hidden file rules
- Custom keymaps
- Highlight groups

### Customization Examples
```lua
-- Toggle detail view
["gd"] = function()
  require("oil").set_columns({
    detail and {"icon", "size", "mtime"} or {"icon"}
  })
end

-- Custom action
["gx"] = function()
  -- Open with external program
end
```

**Pattern**: Config is declarative, callbacks are functional.

---

## 7. Critical Challenges for S3

### 1. Asynchronous Operations
- **Oil**: Instant (local filesystem)
- **S3**: Network latency required
- **Solution**: Progress windows (oil already has them)

### 2. Virtual Directories
- **Oil**: Real directories from filesystem
- **S3**: Virtual prefixes (just text)
- **Solution**: Treat prefixes as directories, display with trailing `/`

### 3. Metadata Model
- **Oil**: File type, permissions, size, mtime
- **S3**: ↑ plus version ID, storage class, encryption, tags, ACLs
- **Solution**: Extensible columns system (already have it)

### 4. Permission Model
- **Oil**: Unix rwx permissions
- **S3**: Bucket policies, object ACLs, IAM
- **Solution**: Simplified UI for Phase 1, defer complex editing to Phase 3+

### 5. Cost Awareness
- **Oil**: No costs to list/delete files
- **S3**: Every DELETE and LIST has cost implications
- **Solution**: Show cost estimates in confirmation dialog

---

## 8. Implementation Roadmap

### Phase 1: Core (MVP - Oil Parity)
- [x] Browse S3 buckets and prefixes
- [x] Edit buffer (add/delete/rename objects)
- [x] Confirmation dialogs
- [x] Multi-window support
- [x] Basic columns (icon, name, size, mtime)
- [x] Keybindings

**Effort**: ~2-3 weeks

### Phase 2: Enhanced (Oil Features)
- [ ] Floating windows
- [ ] Preview windows
- [ ] Search/filter
- [ ] Sort customization
- [ ] Custom colors

**Effort**: ~1-2 weeks

### Phase 3: S3-Specific
- [ ] Versioning UI
- [ ] Tag display/edit
- [ ] Storage class indication
- [ ] Sync to local filesystem
- [ ] Download/upload tracking

**Effort**: ~2-3 weeks

### Phase 4: Advanced
- [ ] Cross-bucket sync
- [ ] Batch operations from CSV
- [ ] Lambda integration
- [ ] CloudFront invalidation
- [ ] Cost reporting

**Effort**: ~1 week per feature

---

## 9. Code Structure to Adopt

```
open-s3/
├── lua/s3/
│   ├── init.lua              -- Setup, main API
│   ├── adapter.lua           -- S3 adapter (oil-style)
│   ├── buffer.lua            -- Buffer management
│   ├── actions.lua           -- User actions (keybindings)
│   ├── diff.lua              -- Change tracking
│   ├── operations.lua        -- S3 operations (create/delete/move)
│   ├── ui/
│   │   ├── window.lua        -- Floating windows
│   │   ├── highlight.lua     -- Color groups
│   │   └── confirm.lua       -- Confirmation dialog
│   └── aws/
│       ├── client.lua        -- AWS SDK wrapper
│       └── s3.lua            -- S3 API calls
├── plugin/
│   └── s3.lua                -- Entry point (:S3 command)
└── doc/
    └── s3.txt                -- Help documentation
```

**Philosophy**: Same structure as oil.nvim (proven architecture).

---

## 10. Critical Success Factors

### 1. Safety First
- ✅ Always show confirmation before destructive ops
- ✅ Estimate costs for delete operations
- ✅ Support "archive to prefix" instead of delete

### 2. Async Done Right
- ✅ Progress indication for network operations
- ✅ Retry logic with exponential backoff
- ✅ Timeout handling (critical for reliability)

### 3. Vim Philosophy
- ✅ Respect keybinding conventions
- ✅ All standard Vim operations work
- ✅ No modal menus (use buffer editing)

### 4. Performance
- ✅ Lazy load large buckets (pagination)
- ✅ Cache listings with TTL
- ✅ Connection pooling to S3

### 5. Extensibility
- ✅ Customizable keymaps
- ✅ Custom columns system
- ✅ Highlight group overrides

---

## 11. Metrics for Success

| Metric | Target | Status |
|--------|--------|--------|
| Lines of Code | <5,000 Lua | TBD |
| Default Keybindings | 12-16 | TBD |
| Configuration Options | 30+ | TBD |
| Setup Time for Users | <5 minutes | TBD |
| Time to Browse Bucket | <2 seconds | TBD |
| Multi-bucket Copy | <5 keystrokes | TBD |

---

## 12. Documentation Generated

### 1. **oil_nvim_research.md** (728 lines)
- Core philosophy, features, architecture
- Complete keybinding reference
- API documentation
- Real-world workflow examples

### 2. **keybindings_ui_patterns.md** (661 lines)
- Detailed keybinding design
- UI pattern examples with ASCII diagrams
- State machines for interactions
- Customization patterns
- Design principles

### 3. **implementation_insights.md** (679 lines)
- Adapter pattern for S3
- Workflow implementations
- Performance optimization strategies
- Error handling patterns
- 4-phase roadmap
- Configuration templates

### 4. **README.md** (272 lines)
- Document index and navigation
- Quick reference summaries
- Key concepts
- Related resources

**Total**: 2,340 lines of carefully researched analysis

---

## Key Recommendations

### For MVP (Phase 1)
1. **Copy oil's adapter pattern exactly** - it works
2. **Implement async with progress windows** - essential for S3
3. **Make confirmation mandatory** - builds user trust
4. **Keep keybindings minimal** - 12-16 is plenty
5. **Use oil's column system** - proven and extensible

### For Long-Term
1. **Extend adapter interface** for versioning, tags, metadata
2. **Build custom highlight system** for S3-specific types
3. **Add cost estimation** for budget-conscious users
4. **Support bucket policies** (defer to Phase 3+)
5. **Consider multi-cloud** (Azure, GCS) in architecture

### For Users
1. **Read oil.nvim docs** - same keybindings work
2. **Learn Vim motions** - they all work here too
3. **Use floating window** for non-intrusive browsing
4. **Check confirmation** before pressing `y`
5. **Customize keymaps** if defaults don't suit you

---

## Bottom Line

**Oil.nvim is an exceptional reference implementation.** Its clean architecture, Vim-first philosophy, and proven UX patterns provide a strong foundation for open-s3.

The main work is:
1. **Adapter**: S3-specific list, create, delete, move, copy operations
2. **Async**: Network calls require progress indication
3. **Adaptation**: Virtual directories, metadata model, cost awareness

Everything else (buffer UI, confirmation dialogs, keybindings, display) can follow oil's proven patterns with minimal modifications.

**Estimated implementation time with this research**: 4-6 weeks for Phase 1 MVP + Phase 2 features.

---

## Next Steps

1. ✅ Research complete (THIS DOCUMENT)
2. → Design API and configuration
3. → Implement Phase 1 (MVP)
4. → User testing and feedback
5. → Phase 2 (Enhanced features)
6. → Phase 3+ (S3-specific advanced features)

---

**Research Date**: 2025-01-15
**Sources**: Oil.nvim GitHub (stevearc/oil.nvim), official docs, source code
**Researcher**: AI Assistant
**Format**: Comprehensive technical analysis
**Total Content**: 2,340 lines across 4 documents
