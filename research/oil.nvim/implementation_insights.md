# Oil.nvim: Implementation Insights for S3 Explorer

## 1. Architectural Patterns to Adopt

### 1.1 Adapter Pattern for S3

Oil.nvim's adapter architecture is directly applicable:

```
┌─────────────────────────────────────────────┐
│         Oil.nvim Buffer Layer               │
│  (Display, Editing, Confirmation)           │
└────────────────────┬────────────────────────┘
                     │
         ┌───────────┼───────────┐
         │           │           │
         ↓           ↓           ↓
    ┌────────┐  ┌────────┐  ┌────────┐
    │ Files  │  │  SSH   │  │  S3    │
    │Adapter │  │Adapter │  │Adapter │
    └────────┘  └────────┘  └────────┘
         │           │           │
         ↓           ↓           ↓
    ┌────────┐  ┌────────┐  ┌────────┐
    │Local FS│  │Remote  │  │AWS S3  │
    │        │  │Server  │  │        │
    └────────┘  └────────┘  └────────┘
```

**Adapter Interface to Implement**:

```lua
-- Minimal adapter interface (oil-style)
local s3_adapter = {
  name = "s3",
  
  -- List objects in bucket/prefix
  list = function(path, callback)
    -- path format: "s3://bucket/prefix/path"
    -- callback(err, entries)
    -- entries: [{id="...", name="...", type="file|dir", ...}]
  end,
  
  -- Create object or prefix
  create = function(path, entry_type, callback)
    -- entry_type: "file" or "dir"
  end,
  
  -- Delete object or prefix
  delete = function(path, callback)
    -- Recursive delete if directory
  end,
  
  -- Move/copy objects
  move = function(src, dest, callback)
    -- Handles copy + delete pattern for S3
  end,
  
  -- Get object metadata
  get_metadata = function(path, callback)
    -- Returns size, mtime, storage_class, etc.
  end,
}
```

### 1.2 Buffer Representation

**Oil Pattern for S3**:

```
Opening: :S3 s3://my-bucket/data/
Buffer Name: s3://my-bucket/data/

Display:
📁 2025/
📁 archives/
📄 config.json
📄 data.csv
📄 backup.tar.gz

Edit Buffer (user adds line):
📁 2025/
📁 archives/
📄 new_file.json     ← New line added
📄 config.json
📄 data.csv
📄 backup.tar.gz

Save (:w):
✓ Confirm create new_file.json in s3://my-bucket/data/
✓ File created in S3 (via PutObject)
```

### 1.3 Change Tracking Model

Oil's diff-based approach adapts well for S3:

```lua
-- In oil: compares buffer state to disk state
-- For S3: compares buffer state to last-listed state

local changes = {
  -- New objects detected
  creates = {
    {path = "s3://bucket/new_file.json", type = "file"},
  },
  
  -- Objects removed from buffer
  deletes = {
    {path = "s3://bucket/old_file.csv", type = "file"},
  },
  
  -- Objects renamed/moved
  moves = {
    {from = "s3://bucket/file.txt", to = "s3://bucket/archive/file.txt"},
  },
  
  -- Objects duplicated
  copies = {
    {from = "s3://bucket/file.txt", to = "s3://bucket/file_copy.txt"},
  },
}

-- Generate operation plan (like oil does)
local operations = plan_operations(changes)

-- Show confirmation dialog
show_confirmation(operations)

-- If confirmed, execute all operations in sequence
execute_operations(operations)
```

---

## 2. Key Workflows to Implement

### 2.1 Browse and Navigate Buckets

```
Initial: :S3 s3://
├─ Lists all accessible buckets
├─ Select with <CR>
└─ Opens bucket listing

Browse: :S3 s3://my-bucket
├─ Lists root-level objects/prefixes
├─ Prefix shown with trailing /
├─ Objects with icons/metadata
├─ j/k to navigate
└─ <CR> to open prefix or preview object

Navigation:
├─ - to go up (to parent prefix or bucket list)
├─ <C-p> to preview object content
└─ Multiple buffers for different prefixes
```

### 2.2 Copy/Sync Between Buckets

**Multi-Buffer Workflow**:

```vim
" Window 1: :S3 s3://source-bucket/data/
" Window 2: :S3 s3://dest-bucket/archive/

" In Window 1:
yy                   " Yank/copy object

" In Window 2:
p                    " Paste line

" :w in Window 2:
" Copies object from source to dest bucket
" Uses S3 CopyObject for efficiency
```

### 2.3 Batch Operations

**Visual Selection Pattern**:

```vim
" Delete multiple objects
:S3 s3://bucket/logs/

V                    " Visual line mode
j j j                " Select 3 objects
d                    " Mark for deletion

:w                   " Show confirmation
" [Delete] 3 objects:
"   logs/2024-01.log
"   logs/2024-02.log
"   logs/2024-03.log
" (y)es / (n)o

" Confirm: deletes all 3 objects from S3
```

### 2.4 Search and Filter

```vim
" Search within bucket
/pattern             " Find objects matching pattern

" Filter result
n / N                " Navigate matches

" Combine with operations:
/ \.log$             " Find all .log files
V G                  " Select to end
d                    " Mark all logs for deletion
:w                   " Confirm and delete
```

---

## 3. S3-Specific Considerations

### 3.1 Handling S3 Virtual Directories

Oil shows actual directories. S3 has virtual prefixes:

```lua
-- S3 listing for s3://bucket/data/
-- Raw API response:
{
  Contents = [
    {Key = "data/file1.txt"},
    {Key = "data/file2.txt"},
    {Key = "data/archive/old.tar.gz"},
  ],
  CommonPrefixes = [
    {Prefix = "data/archive/"},
    {Prefix = "data/backup/"},
  ]
}

-- Convert to oil-style entries:
{
  {id = "s3_1", name = "archive/", type = "dir"},
  {id = "s3_2", name = "backup/", type = "dir"},
  {id = "s3_3", name = "file1.txt", type = "file"},
  {id = "s3_4", name = "file2.txt", type = "file"},
}

-- Display (sorted):
📁 archive/
📁 backup/
📄 file1.txt
📄 file2.txt
```

### 3.2 Columns for S3 Objects

Adapt oil's column system for S3 metadata:

```lua
columns = {
  "icon",              -- 📁 or 📄 or 🔒 for versioned
  -- Optional S3-specific:
  "size",              -- 1.2 MB, 34 KB
  "mtime",             -- 2025-01-15 14:32
  "storage_class",     -- STANDARD, GLACIER, etc.
  "version_id",        -- If versioning enabled
  "encrypted",         -- 🔒 indicator
}
```

### 3.3 Async Operations and Progress

S3 operations are inherently async (network latency):

```lua
-- Oil's progress display adapts well:

┌─────────────────────────────────┐
│  Listing s3://bucket/data/...   │
├─────────────────────────────────┤
│  [████░░░░░░░░░░░░░░] 25%       │
│  Fetching object list...        │
└─────────────────────────────────┘

-- After listing:
┌─────────────────────────────────┐
│  Copying files...               │
├─────────────────────────────────┤
│  [██████░░░░░░░░░░░░] 30%       │
│  file_1.tar.gz → dest/          │
│  2.1 GB / 7 GB                  │
└─────────────────────────────────┘
```

### 3.4 Confirmation Critical for Cloud Operations

Oil's confirmation pattern is ESSENTIAL for S3:

```
❌ Before: User deletes without seeing what's deleted
✅ Oil-style: Shows ALL operations before :w

┌─────────────────────────────────────┐
│  Confirm Operations                 │
├─────────────────────────────────────┤
│  DELETE 15 objects from s3:         │
│                                     │
│  logs/2024-01-15.log (234 MB)       │
│  logs/2024-01-16.log (189 MB)       │
│  ... (13 more)                      │
│                                     │
│  ⚠️  Cost: ~$0.30 to retrieve       │
│      (you will pay for deleted)     │
│                                     │
│  (y)es / (n)o                       │
└─────────────────────────────────────┘
```

---

## 4. API Design Recommendations

### 4.1 Core API (oil-style)

```lua
-- Main plugin setup
require("s3-explorer").setup({
  default_bucket = "my-bucket",
  aws_profile = "default",
  region = "us-east-1",
  
  columns = {
    "icon",
    "size",
    "mtime",
  },
  
  keymaps = {
    ["<CR>"] = "actions.select",
    ["<C-s>"] = { "actions.select", opts = { vertical = true } },
    ["-"] = "actions.parent",
    ["g?"] = "actions.show_help",
    -- Custom S3 operations
    ["gv"] = "actions.toggle_versions",
    ["gt"] = "actions.show_tags",
  },
})

-- Commands (oil-style)
:S3                          " Open at default bucket
:S3 s3://bucket/path        " Open specific bucket/prefix
:S3 --float                 " Open in floating window
:S3 --float s3://bucket     " Float + bucket
```

### 4.2 Lua API (oil-style)

```lua
local s3 = require("s3-explorer")

-- Navigation
s3.open("s3://bucket/prefix")      -- Open in current window
s3.open_float("s3://bucket")        -- Open in float
s3.toggle_float("s3://bucket")      -- Toggle visibility

-- Buffer operations
s3.get_current_bucket(bufnr)        -- Get bucket from buffer
s3.get_current_prefix(bufnr)        -- Get prefix from buffer
s3.get_cursor_entry()               -- Get entry under cursor

-- Display customization
s3.set_columns({"icon", "size", "mtime"})
s3.set_sort({{"type", "asc"}, {"name", "asc"}})
s3.toggle_hidden()                  -- Hide/show incomplete multiparts

-- Operations
s3.save()                           -- Apply changes (:w)
s3.discard_all_changes()            -- Discard (:q!)
s3.refresh()                        -- Reload from S3
```

### 4.3 Actions (oil-style)

```lua
-- Built-in actions (like oil's)

actions.select                      -- Open object/prefix
actions.preview                     -- Preview object content
actions.parent                      -- Go up level
actions.cd                          -- Change bucket/prefix
actions.refresh                     -- Reload from S3
actions.copy_to_clipboard           -- Copy object name
actions.paste_from_clipboard        -- Paste objects from clipboard

-- S3-specific actions
actions.toggle_versions             -- Show/hide object versions
actions.show_tags                   -- Display object tags
actions.show_metadata               -- Display full metadata
actions.open_in_console             -- Open in AWS console
actions.download_object             -- Download to local file
actions.sync_prefix                 -- Sync prefix to local
```

---

## 5. Performance and Optimization

### 5.1 Lazy Loading Pattern

Oil loads only visible directory. S3 should do same:

```lua
-- Don't load entire bucket on open
-- Instead: pagination + lazy loading

list_objects = function(bucket, prefix, limit)
  -- Return first `limit` objects
  -- Store continuation_token for next page
  
  return {
    entries = [...],  -- first 100 objects
    continuation_token = "abc123",
    is_truncated = true,
    total = 50000,  -- Estimated total
  }
end

-- User scrolls down:
load_more = function(continuation_token)
  -- Fetch next batch on demand
end
```

### 5.2 Caching Strategy

```lua
-- Cache bucket listings with TTL
local cache = setmetatable({}, {
  __index = function(self, key)
    -- key = "s3://bucket/prefix"
    local cached = rawget(self, key)
    if cached and not cached.expired then
      return cached.value
    end
    -- Fetch fresh from S3
    local value = list_s3_objects(key)
    self[key] = {
      value = value,
      timestamp = os.time(),
      expired = false,
    }
    return value
  end,
})

-- Invalidate on write
on_save = function(operations)
  for _, op in ipairs(operations) do
    invalidate_cache(get_prefix(op.path))
  end
end
```

### 5.3 Connection Pooling

```lua
-- Reuse AWS SDK client
local s3_client = nil

get_client = function()
  if not s3_client then
    s3_client = aws.S3:new({
      region = config.region,
      credentials = get_credentials(config.aws_profile),
    })
  end
  return s3_client
end
```

---

## 6. Error Handling Patterns

### 6.1 Display Errors Like Oil

```lua
-- Oil shows errors in floating window
-- S3 should do the same for network/permission errors

on_error = function(err)
  if err.code == "AccessDenied" then
    vim.notify("Access denied to s3://bucket/prefix", vim.log.levels.ERROR)
    -- Show detail in floating window
    show_error_details({
      title = "Access Denied",
      message = "You don't have permission to list this bucket",
      suggestion = "Check AWS credentials and bucket policies",
    })
  elseif err.code == "NoSuchBucket" then
    vim.notify("Bucket not found", vim.log.levels.ERROR)
  elseif err.type == "network" then
    vim.notify("Network error - check internet connection", vim.log.levels.WARN)
  end
end
```

### 6.2 Retry Logic

```lua
-- Oil: simple retry for transient failures
-- S3: essential for network operations

retry_operation = function(fn, max_retries)
  local retries = 0
  while retries < max_retries do
    local ok, result = pcall(fn)
    if ok then
      return result
    end
    retries = retries + 1
    if retries < max_retries then
      vim.wait(math.pow(2, retries) * 1000)  -- Exponential backoff
    end
  end
  error("Operation failed after " .. max_retries .. " retries")
end
```

---

## 7. Feature Roadmap (Based on Oil Patterns)

### Phase 1: Core (Oil Parity)
- [x] Browse S3 buckets and prefixes
- [x] Edit buffer (create/delete/rename/move objects)
- [x] Confirmation dialogs
- [x] Multi-window support
- [x] Basic columns (icon, name, size, mtime)
- [x] Keybindings

### Phase 2: Enhanced (Oil+)
- [ ] Preview object content
- [ ] Floating window support
- [ ] Search/filter objects
- [ ] Sort customization
- [ ] Custom highlight groups
- [ ] Trash/archive support

### Phase 3: S3-Specific
- [ ] Versioning support
- [ ] Object tags display/edit
- [ ] Storage class indication
- [ ] Encryption status
- [ ] Sync to local filesystem
- [ ] Download/upload progress
- [ ] ACL/policy editing
- [ ] CloudFront invalidation

### Phase 4: Advanced
- [ ] Cross-bucket operations (copy/sync)
- [ ] Batch operations from CSV
- [ ] Lambda integration
- [ ] Cost estimation
- [ ] Object lifecycle policies
- [ ] Replication configuration

---

## 8. Code Organization

```
open-s3/
├── lua/
│   └── s3/
│       ├── init.lua           -- Setup and main API
│       ├── adapter.lua        -- S3 adapter pattern
│       ├── buffer.lua         -- Buffer management (oil-style)
│       ├── actions.lua        -- User actions
│       ├── diff.lua           -- Change tracking (oil-style)
│       ├── operations.lua     -- Create/delete/move/copy
│       ├── ui/
│       │   ├── window.lua     -- Float/split management
│       │   ├── highlight.lua  -- Highlight groups
│       │   └── confirm.lua    -- Confirmation dialog
│       ├── aws/
│       │   ├── client.lua     -- AWS SDK wrapper
│       │   ├── s3.lua         -- S3 specific ops
│       │   └── credentials.lua -- Auth handling
│       └── util/
│           ├── cache.lua      -- Caching
│           ├── async.lua      -- Async helpers
│           └── format.lua     -- Display formatting
├── plugin/
│   └── s3.lua                -- Plugin entry point
└── doc/
    └── s3.txt                -- Help documentation
```

---

## 9. Configuration Template

```lua
-- Based on oil.nvim setup style
require("s3-explorer").setup({
  -- AWS Configuration
  aws_profile = "default",
  region = "us-east-1",
  default_bucket = nil,
  
  -- Display
  columns = {
    "icon",
    "size",
    "mtime",
  },
  
  -- Buffer options
  buf_options = {
    buflisted = false,
    bufhidden = "hide",
  },
  
  -- Window options
  win_options = {
    wrap = false,
    signcolumn = "no",
  },
  
  -- S3-specific behavior
  show_incomplete_multiparts = false,
  delete_to_archive = false,  -- Move to special "archive" prefix instead of delete
  
  -- Confirmation
  skip_confirm_for_simple_edits = false,
  
  -- Performance
  cache_ttl_ms = 5000,
  max_items_per_request = 1000,
  
  -- Keymaps (fully customizable)
  keymaps = {
    ["g?"] = "actions.show_help",
    ["<CR>"] = "actions.select",
    ["<C-s>"] = { "actions.select", opts = { vertical = true } },
    ["-"] = "actions.parent",
    ["gs"] = "actions.change_sort",
    -- S3-specific
    ["gv"] = "actions.toggle_versions",
    ["gt"] = "actions.show_tags",
  },
})
```

---

## 10. Key Differences from Oil (for Implementation)

| Oil | S3 Explorer |
|-----|-------------|
| Local/SSH filesystems | Only S3 (can extend later) |
| Instant operations | Async with loading states |
| No permission variations | Must show/respect S3 permissions |
| Simple object types | Need versioning, tags, metadata |
| Actual directories | Virtual prefixes (no real "directories") |
| Unix permissions | S3 ACLs/bucket policies |
| Simple deletion | Need archive/retention strategies |
| Mv/cp are file ops | Need S3 CopyObject, multipart upload |
| No cost consideration | Should warn about operation costs |
| Local-only preview | Preview needs download/streaming |

---

## References

- Oil.nvim GitHub: https://github.com/stevearc/oil.nvim
- Oil Architecture: https://github.com/stevearc/oil.nvim/tree/master/lua/oil
- AWS SDK Lua: https://github.com/aws-sdk-lua
- Neovim Lua API: https://neovim.io/doc/user/api.html
