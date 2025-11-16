# Oil.nvim Research Documentation

This directory contains comprehensive research on **oil.nvim**, a Neovim file explorer plugin that implements a unique "edit filesystem like a buffer" paradigm. This research is foundational for designing the open-s3 S3 bucket explorer.

## Document Index

### 1. **oil_nvim_research.md** (Main Reference)
   - **Overview**: Core philosophy and capabilities
   - **Features**: Detailed breakdown of all features (13+ major capabilities)
   - **Keybindings**: Complete default keymap reference with explanations
   - **UI/UX Patterns**: Visual display, highlighting, window management
   - **Workflows**: Complete examples of navigation, editing, and batch operations
   - **Architecture**: Adapter pattern, buffer management, change tracking
   - **API Reference**: All available actions and customization options
   - **Takeaways**: 10 key lessons for S3 explorer design

   **Best for**: Understanding what oil.nvim does and how it works

### 2. **keybindings_ui_patterns.md** (Detailed Design)
   - **Keybinding Philosophy**: 4 core design principles
   - **Keymap Categories**: Navigation, file operations, utilities
   - **Workflow Examples**: Step-by-step examples with ASCII diagrams
   - **Visual Patterns**: Buffer layout, highlighting, floating windows
   - **State Machines**: User interaction flows and state transitions
   - **Customization**: Real examples of extending keymaps
   - **Design Principles**: 8 core principles + Vim philosophy
   - **Comparisons**: Oil vs. tree views vs. fuzzy finders

   **Best for**: Understanding UI/UX design decisions and interaction patterns

### 3. **implementation_insights.md** (Practical Application)
   - **Adapter Pattern**: How to apply oil's architecture to S3
   - **Core Workflows**: Implementation patterns for S3-specific workflows
   - **S3 Considerations**: Virtual directories, metadata, async operations
   - **API Design**: Recommended API structure (setup, commands, Lua API)
   - **Performance**: Lazy loading, caching, connection pooling
   - **Error Handling**: How to adapt oil's error patterns
   - **Feature Roadmap**: 4-phase implementation plan
   - **Code Organization**: Suggested directory structure
   - **Configuration**: Template based on oil's setup style
   - **Key Differences**: Oil vs. S3 reality check

   **Best for**: Planning the open-s3 implementation

## Quick Reference

### Oil.nvim Strengths (Relevant to S3)

✅ **Buffer-as-Interface** - Intuitive edit→save paradigm
✅ **Cross-Directory Ops** - Copy/move between open buffers
✅ **Adapter Architecture** - Pluggable backend (extensible to S3)
✅ **Floating Windows** - Non-intrusive UI
✅ **Confirmation Dialogs** - Safety for destructive operations
✅ **Vim-Native** - All standard Vim operations work
✅ **Async-Ready** - Progress indicators and state management
✅ **Highly Customizable** - Keymaps, columns, highlights

### Oil.nvim Challenges (for S3 Adaptation)

⚠️ **Network Latency** - S3 calls slower than local FS
⚠️ **Async Requirements** - Progress indication essential
⚠️ **Virtual Paths** - S3 has virtual prefixes, not real dirs
⚠️ **Metadata Model** - S3 has versioning, tags, storage classes
⚠️ **Cost Awareness** - Need to warn about S3 operation costs
⚠️ **Permission Model** - S3 ACLs differ from Unix permissions

## Key Statistics

- **Stars**: 5.9k+ (well-maintained, popular)
- **Contributors**: 73+ (active community)
- **Lines of Code**: ~6,000 Lua (manageable complexity)
- **Default Keymaps**: 16 (well-designed, not overwhelming)
- **Available Actions**: 20+ (extensive but optional)
- **Configuration Options**: 50+ (highly customizable)

## Oil.nvim Feature Matrix

| Category | Feature | Complexity |
|----------|---------|-----------|
| **Navigation** | Browse single directory | ⭐ |
| **Selection** | Open file/directory | ⭐ |
| **Editing** | Direct buffer editing | ⭐⭐ |
| **Operations** | Create/delete/move/copy | ⭐⭐ |
| **Display** | Icons, columns, sorting | ⭐⭐ |
| **Windows** | Float, splits, tabs | ⭐⭐ |
| **Confirmation** | Operation preview + confirm | ⭐⭐⭐ |
| **SSH** | Remote filesystem browsing | ⭐⭐⭐ |
| **LSP Integration** | File operation callbacks | ⭐⭐⭐ |
| **Adapters** | Backend abstraction | ⭐⭐⭐⭐ |

## Recommended Reading Order

1. **Start here**: oil_nvim_research.md (sections 1-3)
   - Understand core philosophy and features
   
2. **Deep dive**: keybindings_ui_patterns.md (sections 1-4)
   - Learn UI/UX design patterns
   
3. **Plan implementation**: implementation_insights.md (sections 1-4)
   - Map oil patterns to S3
   
4. **Reference as needed**: Implementation sections for specific topics
   - Performance, error handling, configuration

## Key Concepts Summary

### Buffer-as-Filesystem Pattern
```
Oil's Insight: "Treat filesystem as a buffer"

Implication for S3:
- Users edit S3 listing like a text buffer
- Changes staged in buffer until :w
- Confirmation shows all changes before commit
- All Vim operations work: dd, p, y, v, etc.
```

### Entry ID System
```
Each file/directory gets unique ID during load:

  oil_id_1 | 📁 src/
  oil_id_2 | 📁 lua/
  oil_id_3 | 📄 README.md
  
When buffer edited:
  - New line → CREATE
  - Deleted line → DELETE
  - Changed line name → MOVE/RENAME
  - Duplicated line → COPY
```

### State Transitions
```
Browse → Edit → Review → Confirm → Execute → Browse (updated)
```

### Adapter Interface
```lua
adapter.list(path)         -- Get entries
adapter.create(path, type) -- Create entry
adapter.delete(path)       -- Delete entry
adapter.move(src, dest)    -- Move entry
adapter.copy(src, dest)    -- Copy entry
```

## S3-Specific Adaptations Needed

### 1. Virtual Directories vs. Real Files
```
S3 API returns:
- Contents: actual objects
- CommonPrefixes: virtual "directories" (prefixes)

Must merge into unified listing:
- Prefixes displayed as 📁 with trailing /
- Objects displayed as 📄
```

### 2. Async Operations
```
Local FS: Operations instant
S3: Network operations require:
- Async/await or callbacks
- Progress indication
- Retry logic with backoff
- Timeout handling
```

### 3. Permission Model
```
Local: Unix permissions (rwx for user/group/other)
S3: Bucket policies, object ACLs, IAM

Display: Simplified indicator (🔒 for private, 🌐 for public)
Edit: Potentially complex (defer to Phase 3+)
```

### 4. Versioning
```
Local: Single current version
S3: Multiple versions per object (if enabled)

Display: Show current version normally
         Show version ID in metadata column
Edit: Toggle versions view (gv action)
```

## Design Philosophy Alignment

Oil.nvim's philosophy aligns perfectly with open-s3 goals:

1. **Vim-First**: Users expect Vim conventions
2. **Keyboard-Driven**: All operations keyboard-accessible
3. **Minimal UI**: Show only what's necessary
4. **Extensible**: Users can customize heavily
5. **Safe**: Confirmation before destructive operations
6. **Composable**: Operations combine naturally

## Related Resources

- **Oil.nvim GitHub**: https://github.com/stevearc/oil.nvim
- **vim-vinegar (inspiration)**: https://github.com/tpope/vim-vinegar
- **Neovim API**: https://neovim.io/doc/user/api.html
- **Vim Philosophy**: https://vim.fandom.com/wiki/Vim_Philosophy
- **AWS S3 API**: https://docs.aws.amazon.com/s3/latest/API/Welcome.html

## Notes for Implementation

### What to Copy Directly
- Keybinding pattern (especially `-` for parent)
- Floating window architecture
- Confirmation dialog UI
- Column-based display system
- Sort/filter options

### What to Adapt
- Adapter interface (add S3-specific methods)
- Buffer entry system (include S3 metadata)
- Change tracking (handle virtual directories)
- Progress indication (mandatory for network ops)

### What to Skip (Initially)
- SSH adapter (S3-only for now)
- Tree view (single directory focus)
- Advanced git integration
- LSP file operations (not applicable to S3)

### What to Add
- Bucket selection UI
- Object metadata display
- Version management
- Tag editing
- S3-specific error handling
- Cost awareness warnings

## Future Enhancements

Based on oil.nvim's extensibility, future versions could support:

1. **Multi-Cloud**: Azure Blob, GCS adapters
2. **Local Sync**: Bidirectional sync to local filesystem
3. **Advanced Querying**: S3 Select integration
4. **Monitoring**: CloudWatch metrics display
5. **Automation**: Lambda invocation from explorer
6. **Collaboration**: Shared S3 session features

## Contributing/Extending

If extending for other cloud providers:

1. Implement adapter interface (operations.lua)
2. Add service-specific metadata column types
3. Create service-specific error handling
4. Add service initialization (credentials, regions, etc.)
5. Extend tests for service-specific behavior

Example: `lua/s3/adapters/gcs.lua` for Google Cloud Storage

---

## Summary

Oil.nvim provides an excellent reference implementation for building a powerful, Vim-integrated file browser. Its architecture is clean, extensible, and philosophy-aligned with Unix/Vim traditions. The main challenge in adapting it to S3 is handling asynchrony, but oil.nvim already has UI patterns (progress windows, confirmations) that suit this perfectly.

The research shows that **adopting oil's design patterns** while **adapting to S3 reality** creates a product that will feel natural to Vim users while providing cloud-native capabilities.

---

**Document compiled**: 2025-01-15
**Oil.nvim version referenced**: v2.15.0+
**Research depth**: Comprehensive (architecture, keybindings, UX, implementation)
