# Oil.nvim Research: A Neovim File Explorer Plugin

## Overview

**oil.nvim** is a sophisticated Neovim file explorer plugin that brings a novel approach to filesystem browsing: treating the filesystem as a buffer that can be directly edited.

- **Creator**: stevearc
- **Repository**: https://github.com/stevearc/oil.nvim
- **Stars**: 5.9k+ (popular, well-maintained)
- **License**: MIT
- **Latest Version**: v2.15.0+

### Core Philosophy

Oil.nvim is inspired by [vim-vinegar](https://github.com/tpope/vim-vinegar) and implements the concept that "Split windows and the project drawer go together like oil and vinegar." The plugin's philosophy is:

1. **Edit filesystem like a buffer**: Direct manipulation of file/directory listings using standard buffer operations
2. **Single-directory browsing**: Shows one directory per buffer (unlike tree views)
3. **Cross-directory operations**: Unique capability to perform operations across multiple directories in one session
4. **Neovim-first**: Leverages modern Neovim features (floating windows, LSP integration, Lua API)

---

## 1. Core Features and Functionality

### 1.1 Core Capabilities

| Feature                        | Description                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------- |
| **Directory Editing**          | Edit directory contents as a buffer, then save changes with `:w`                            |
| **Direct File Operations**     | Cut/paste (rename/move), copy, create new files/directories via buffer editing              |
| **Cross-Directory Operations** | Copy/move files between open directories in a single session                                |
| **Floating Windows**           | Can open in floating windows for non-intrusive browsing                                     |
| **SSH Support**                | Browse remote filesystems via SSH adapter (URL format: `oil-ssh://[user@]host[:port]/path`) |
| **Adapter Architecture**       | Pluggable architecture allowing support for different filesystems (local, SSH, custom)      |
| **LSP Integration**            | Respects LSP file operations (e.g., willRenameFiles callbacks)                              |
| **Preview Windows**            | Preview files/directories before opening (configurable auto-update)                         |
| **Customizable Columns**       | Display: icon, permissions, size, modification time, etc.                                   |
| **Sorting Options**            | Sort by type, name, size, mtime (natural order support)                                     |
| **Hidden File Management**     | Toggle visibility of hidden files; customizable hiding logic                                |
| **Trash Support**              | Send deleted files to trash instead of permanent deletion                                   |
| **Terminal Integration**       | Open terminal in current directory                                                          |
| **System Clipboard**           | Copy/paste filenames to system clipboard                                                    |
| **Confirmation Dialogs**       | Review all changes before saving (configurable)                                             |

### 1.2 Display and Rendering

```
📁 lua/
   oil/
   config.lua
📄 README.md
📄 LICENSE
```

**Display Elements**:

- File/directory icons (via mini.icons or nvim-web-devicons)
- Type indicator (directory vs file)
- Optional: permissions, size, modification time
- Hidden files shown with reduced opacity
- Current line highlighted
- Breadcrumb or path indicator in winbar

### 1.3 Key Design Patterns

**Buffer-as-Filesystem Pattern**:

```
Before (:w):
📁 lua/
   oil/
   config.lua
📄 README.md

After editing (remove config.lua line):
📁 lua/
   oil/
📄 README.md

After :w:
✓ config.lua is deleted from disk
```

**Change Tracking**:

- Oil tracks modifications to the buffer
- Confirmation window shows ALL planned operations:
  - Creates (new files/dirs)
  - Deletes (removed lines)
  - Moves (renamed lines)
  - Copies (duplicated entries)

---

## 2. Key Bindings and User Interactions

### 2.1 Default Keymaps

| Key     | Action                        | Mode | Description                        |
| ------- | ----------------------------- | ---- | ---------------------------------- |
| `<CR>`  | `actions.select`              | n    | Open file/directory at cursor      |
| `<C-s>` | `actions.select` (vertical)   | n    | Open in vertical split             |
| `<C-h>` | `actions.select` (horizontal) | n    | Open in horizontal split           |
| `<C-t>` | `actions.select` (tab)        | n    | Open in new tab                    |
| `<C-p>` | `actions.preview`             | n    | Preview file/directory             |
| `<C-c>` | `actions.close`               | n    | Close oil, restore previous buffer |
| `<C-l>` | `actions.refresh`             | n    | Refresh current directory          |
| `-`     | `actions.parent`              | n    | Go to parent directory             |
| `_`     | `actions.open_cwd`            | n    | Open cwd in oil                    |
| `` ` `` | `actions.cd`                  | n    | :cd to current directory           |
| `~`     | `actions.cd` (tab scope)      | n    | :tcd to current directory          |
| `gs`    | `actions.change_sort`         | n    | Change sort order (interactive)    |
| `gx`    | `actions.open_external`       | n    | Open in external program           |
| `g.`    | `actions.toggle_hidden`       | n    | Toggle hidden files                |
| `g\`    | `actions.toggle_trash`        | n    | Jump to/from trash                 |
| `g?`    | `actions.show_help`           | n    | Show keymaps help                  |

### 2.2 Buffer Editing Operations

Oil supports standard Vim editing for filesystem operations:

**Creating New File**:

```vim
" Position cursor on empty line and type:
new_file.txt

" Then :w to create
```

**Creating Directory**:

```vim
" Type directory name with trailing slash:
new_dir/

" Then :w to create
```

**Deleting**:

```vim
" Delete line with dd:
:dd           " Deletes file/directory on disk when :w

" Delete multiple lines with visual selection:
:V            " Select lines
:d            " Delete them all (with confirmation on :w)
```

**Moving/Renaming**:

```vim
" Rename by editing the name in the buffer:
old_name.txt → new_name.txt

" Move by changing path structure:
file.txt → subdir/file.txt
```

**Copying**:

```vim
" Duplicate the line (yy, p):
:yy           " Yank line
:p            " Paste below (creates copy)

" Then :w to complete copy operation
```

**System Clipboard Operations**:

- `actions.copy_to_system_clipboard`: Copy filename to clipboard
- `actions.paste_from_system_clipboard`: Paste files from clipboard

### 2.3 Command Line Interface

```vim
:Oil                    " Open oil at current directory
:Oil <path>            " Open oil at specific path
:Oil --float           " Open in floating window
:Oil --float <path>    " Open in floating window at path
:e <directory>         " Automatically opens with oil (if enabled)
nvim .                 " Opens current directory with oil
:w                     " Save all changes
:q                     " Close without saving (discards changes)
```

### 2.4 Vim Motions and Selection

Full Vim motions work within oil buffers:

```vim
j/k            " Navigate up/down
G              " Go to end of file list
gg             " Go to start
/pattern       " Search within listing
n/N            " Next/previous search result
v              " Visual selection (line-wise or character-wise)
d              " Delete selection
y              " Yank/copy
p              " Paste
.              " Repeat last action
```

---

## 3. UI/UX Patterns: Display and Interaction Design

### 3.1 Visual Representation

**Column-Based Layout**:

```
ID        | Icon | Name                | Type      | Size    | Mtime
----------|------|---------------------|-----------|---------|---------------
oil_id_1  |  🗂️  | src/                | directory | -       | 2025-01-15
oil_id_2  |  🗂️  | lua/                | directory | -       | 2025-01-14
oil_id_3  |  📄  | README.md           | file      | 12.5 KB | 2025-01-10
oil_id_4  |  📄  | LICENSE             | file      | 1.2 KB  | 2024-12-01
oil_id_5  |  📄  | .gitignore          | file      | 285 B   | 2025-01-05
```

**Highlighting**:

- `OilDir`: Directory names (normal)
- `OilDirHidden`: Hidden directories (dimmed)
- `OilFile`: File names (normal)
- `OilFileHidden`: Hidden files (dimmed)
- `OilDirIcon`: Directory icons
- `OilLink`: Symbolic links (with target shown)
- `OilOrphanLink`: Broken links (highlighted as orphaned)

**Path Indication**:

- Winbar: Shows current path (e.g., `~/project/src`)
- Buffer name: Full path or oil-specific identifier
- Breadcrumb trail (via recipe)

### 3.2 Window Management

**Floating Window**:

- Non-intrusive, centered by default
- Configurable padding, width, height
- Optional preview split (auto/left/right/above/below)
- Can be toggled on/off
- Border and winblend customizable

```lua
-- Example floating window config
float = {
  padding = 2,
  max_width = 0.8,
  max_height = 0.8,
  border = "rounded",
  preview_split = "auto",
}
```

**Split Management**:

- `<CR>` opens in current window
- `<C-s>` opens in vertical split
- `<C-h>` opens in horizontal split
- `<C-t>` opens in new tab
- Each can be customized with split modifiers (aboveleft/belowright/etc.)

### 3.3 Confirmation and Safety

**Confirmation Dialogs**:

- Floating window displays all planned operations
- Shows operation type (create/delete/move/copy) with paths
- User confirms with `y` or cancels with `n`
- Configurable to skip for "simple" operations (single action, no deletes, no cross-adapter moves)

**Change Persistence**:

- All changes held in buffer until `:w` is executed
- Users can review changes before committing
- `:q!` discards all changes
- `:q` (without `:w`) prompts if there are unsaved changes

### 3.4 State Visualization

**Current Entry Highlighting**:

- Cursor line is highlighted
- Entry ID appears implicitly (used for tracking changes)
- Can configure constrain_cursor to keep cursor on valid entries

**Search Highlighting**:

- `/` pattern search works like normal buffer
- Matches highlighted in results
- Can integrate with quickfix list

**Progress Indication**:

- Floating progress window for long operations
- Shows percentage complete
- Minimizable border when minimized

---

## 4. Main Workflows and Operations

### 4.1 Navigation Workflow

**Basic Navigation**:

```vim
:Oil ~/projects          " Open oil at specific directory
j k                      " Move cursor up/down
G gg                     " Jump to end/start
/pattern Enter           " Search and navigate
<CR>                     " Open file/directory

-                        " Go to parent directory
_                        " Open current working directory
`                        " :cd to directory
```

**Multi-Directory Navigation**:

```vim
:Oil ~/src               " Open first directory in split 1
<C-s>                    " Open selected file in vertical split
j k                      " Navigate in second directory
<C-s>                    " Open in another split
```

### 4.2 File Operations Workflow

**Creating New File**:

```vim
:Oil ~/projects          " Open directory
" Navigate to desired location
o                        " New line (via buffer operation)
new_filename.txt         " Type filename
:w                       " Create file
```

**Copying File**:

```vim
:Oil ~/projects          " Open source directory
yy                       " Yank/copy line
" Navigate to destination directory or another oil buffer
p                        " Paste line
:w                       " Confirm copy in popup
```

**Moving/Renaming**:

```vim
:Oil ~/projects          " Open directory
" Rename entry directly in buffer:
old_name.txt → new_name.txt
:w                       " Save changes
```

**Batch Operations**:

```vim
:Oil ~/projects
" Select multiple files
V                        " Visual line mode
j j j                    " Select multiple lines
d                        " Delete marked lines
:w                       " Confirm deletion of all selected files
```

### 4.3 Advanced Workflows

**Cross-Directory Operations**:

```vim
" Split 1: :Oil ~/src
" Split 2: :Oil ~/backup

" In split 1:
yy                       " Copy file
" Move to split 2
p                        " Paste
:w                       " Copies file to backup
```

**SSH Browsing**:

```vim
:Oil oil-ssh://user@host.com/var/www
" Browse remote directory
j k <CR>                 " Navigate/open files
yy                       " Copy file
" In local directory buffer
p                        " Paste (copies via SCP)
:w                       " File appears locally
```

**Preview and Decision Making**:

```vim
:Oil ~/projects
<C-p>                    " Preview file under cursor
" Review content in split window
j                        " Move to next file
<C-p>                    " Preview updates automatically
<CR>                     " Open in editor when ready
```

**Filtering and Organization**:

```vim
g.                       " Toggle hidden files
gs                       " Change sort order
/pattern                 " Search for files
" Edit buffer to group/organize:
" - Create subdirectories
" - Move files into them
:w                       " Apply all changes
```

### 4.4 Integration Patterns

**LSP File Operations**:

- Oil respects LSP `willRenameFiles` notifications
- Can auto-save affected buffers
- Timeout-aware (1 second default)

**Git Integration** (via recipe):

```lua
-- Hide gitignored files
is_hidden_file = function(name, bufnr)
  return git_status[dir].ignored[name]
end
```

**Quickfix Integration**:

```vim
:Oil ~/projects
" Select some files
" Via custom action:
send_to_qflist           " Send to quickfix list
```

---

## 5. Configuration and Customization

### 5.1 Essential Configuration Options

```lua
require("oil").setup({
  -- Replace netrw for directory buffers
  default_file_explorer = true,

  -- Displayed columns
  columns = {
    "icon",
    -- "permissions",
    -- "size",
    -- "mtime",
  },

  -- Window behavior
  buf_options = {
    buflisted = false,
    bufhidden = "hide",
  },

  -- Visual options
  win_options = {
    wrap = false,
    signcolumn = "no",
    cursorcolumn = false,
    conceallevel = 3,
  },

  -- Behavior
  delete_to_trash = false,
  skip_confirm_for_simple_edits = false,
  prompt_save_on_select_new_entry = true,
  watch_for_changes = false,
})
```

### 5.2 Keymaps

Fully customizable via `keymaps` table:

```lua
keymaps = {
  ["<CR>"] = "actions.select",
  ["<C-s>"] = { "actions.select", opts = { vertical = true } },
  ["-"] = { "actions.parent", mode = "n" },
  -- Custom functions
  ["gd"] = {
    callback = function()
      require("oil").set_columns({ "icon", "permissions", "size", "mtime" })
    end,
    desc = "Toggle detail view",
  },
  -- Disable default mapping
  ["gx"] = false,
}
```

### 5.3 View Options

```lua
view_options = {
  show_hidden = false,
  natural_order = "fast",        -- Human-friendly number sorting
  case_insensitive = false,
  is_hidden_file = function(name, bufnr)
    return name:match("^%.") ~= nil
  end,
  is_always_hidden = function(name, bufnr)
    return false
  end,
  sort = {
    { "type", "asc" },
    { "name", "asc" },
  },
}
```

---

## 6. Architecture and Technical Design

### 6.1 Adapter Pattern

Oil abstracts filesystem operations through adapters:

**Built-in Adapters**:

1. **Files Adapter** (local filesystem)
   - Direct filesystem operations via Lua APIs
   - Full feature support

2. **SSH Adapter** (remote filesystem)
   - Connects via SSH
   - Operations via shell commands
   - Supports SCP for cross-adapter transfers

**Custom Adapter Possibility**:

- Implement adapter interface
- Support operations: list, create, delete, move, copy
- Return entries with metadata (name, type, id, etc.)

### 6.2 Buffer Management

- Oil creates special buffers (not listed by default)
- One buffer per directory view
- Buffers can be kept hidden and reused
- Automatic cleanup of hidden buffers after delay
- LSP integration for file method callbacks

### 6.3 Change Tracking

- **Entry System**: Each file/directory has unique ID
- **Diff Computation**: Compares current buffer state to disk state
- **Operation Planning**: Determines creates/deletes/moves/copies
- **Transactional Save**: All operations batched and executed on `:w`

---

## 7. Available Actions (API)

### 7.1 Selection and Navigation

| Action             | Purpose                        |
| ------------------ | ------------------------------ |
| `actions.select`   | Open entry (file/directory)    |
| `actions.preview`  | Preview in split window        |
| `actions.parent`   | Navigate to parent directory   |
| `actions.open_cwd` | Open current working directory |

### 7.2 Directory Operations

| Action                  | Purpose                                  |
| ----------------------- | ---------------------------------------- |
| `actions.refresh`       | Reload directory from disk               |
| `actions.cd`            | Change directory (`:cd`, `:tcd`, `:lcd`) |
| `actions.change_sort`   | Modify sort order                        |
| `actions.toggle_hidden` | Show/hide dotfiles                       |

### 7.3 External Integration

| Action                                | Purpose                         |
| ------------------------------------- | ------------------------------- |
| `actions.open_external`               | Open with external program      |
| `actions.open_terminal`               | Open terminal in directory      |
| `actions.open_cmdline`                | Open cmdline with path argument |
| `actions.copy_to_system_clipboard`    | Copy filename to clipboard      |
| `actions.paste_from_system_clipboard` | Paste files from clipboard      |

### 7.4 File Management

| Action                   | Purpose                     |
| ------------------------ | --------------------------- |
| `actions.send_to_qflist` | Send files to quickfix list |
| `actions.yank_entry`     | Yank filepath to register   |
| `actions.toggle_trash`   | Jump to/from trash          |

### 7.5 UI Actions

| Action              | Purpose             |
| ------------------- | ------------------- |
| `actions.show_help` | Display keymap help |
| `actions.close`     | Close oil buffer    |

---

## 8. Advantages for S3 Bucket Explorer Inspiration

### What oil.nvim Does Well

1. **Buffer-as-Interface**: Direct editing metaphor is intuitive and powerful
   - Users understand: edit, then save (`:w`)
   - No mode switching or command menus needed

2. **Cross-Directory Operations**: Can copy/move between buckets in one session
   - This is _very_ useful for S3 (e.g., copy between bucket/prefix combinations)
   - Not common in other file explorers

3. **Adapter Architecture**: Multiple backend support built-in
   - Oil supports local + SSH + potentially custom
   - S3 could be a custom adapter

4. **Floating Windows**: Non-intrusive browsing
   - Less modal switching, more contextual
   - Good UX when browsing while editing

5. **Confirmation and Safety**: Shows planned operations before commit
   - Critical for cloud operations (S3 delete is permanent)
   - Preview before `:w` builds confidence

6. **Preview Windows**: See content before opening
   - Valuable for S3 (preview object content without download)

7. **Extensibility**:
   - Custom keymaps, columns, sorting
   - Highlight groups for custom styling

### Challenges to Adapt for S3

1. **Latency**: S3 calls are slower than local filesystem
   - May need async operations, progress indicators
   - Pagination for large buckets

2. **Permissions**: S3 ACLs/bucket policies are different from Unix permissions
   - Different permission display/editing model

3. **Versioning**: S3 has object versioning, not traditional file versioning
   - Need UI representation of versions

4. **Costs**: S3 operations have associated costs
   - May need warnings for expensive operations

5. **Path Conventions**: S3 uses virtual paths (no real directories)
   - "/" is just prefix separator, not true hierarchy

---

## 9. Recipes and Patterns

### 9.1 Toggle Detail View

```lua
local detail = false
require("oil").setup({
  keymaps = {
    ["gd"] = {
      callback = function()
        detail = not detail
        if detail then
          require("oil").set_columns({ "icon", "permissions", "size", "mtime" })
        else
          require("oil").set_columns({ "icon" })
        end
      end,
      desc = "Toggle detail view",
    },
  },
})
```

### 9.2 Show CWD in Winbar

```lua
function _G.get_oil_winbar()
  local dir = require("oil").get_current_dir(0)
  if dir then
    return vim.fn.fnamemodify(dir, ":~")
  else
    return vim.api.nvim_buf_get_name(0)
  end
end

require("oil").setup({
  win_options = {
    winbar = "%!v:lua.get_oil_winbar()",
  },
})
```

### 9.3 Hide Gitignored Files

- Uses git commands to build cache of ignored vs tracked files
- Customizes `is_hidden_file` function
- Allows showing tracked hidden files while hiding gitignored ones

---

## 10. Key Takeaways for S3 Explorer Design

1. **Embrace the Buffer Metaphor**
   - Users familiar with Vim will find it intuitive
   - Edit → Save pattern is clear and predictable

2. **Design for Cross-Bucket Operations**
   - Allow multiple buffers/windows for different buckets/prefixes
   - Support copy/move between them

3. **Prioritize Safety**
   - Always show confirmation before destructive operations
   - Preview operations before commit

4. **Adapt for Cloud Reality**
   - Show object metadata (size, modified time, storage class, etc.)
   - Distinguish virtual prefixes from actual objects
   - Consider versioning and tagging UI

5. **Performance Matters**
   - Implement async loading with progress indicators
   - Lazy-load large directories
   - Cache results appropriately

6. **Floating Windows are Friendly**
   - Less intrusive than fullscreen
   - Good for quick browsing while editing

7. **Extensibility Through Customization**
   - Allow custom keymaps and commands
   - Support highlight groups for theming
   - Provide hooks for extensions

---

## References

- **GitHub**: https://github.com/stevearc/oil.nvim
- **Documentation**: Built-in `:help oil` in Neovim
- **vim-vinegar**: https://github.com/tpope/vim-vinegar
- **Mini.files**: Alternative with column view
