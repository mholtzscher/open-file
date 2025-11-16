# Oil.nvim: Detailed Keybindings and UI/UX Pattern Analysis

## 1. Keybinding Design Philosophy

### 1.1 Principles

1. **Vim Familiarity**: All keybindings respect Vim conventions
   - Motions: `j/k` for navigation
   - Operators: `d` for delete, `y` for yank
   - Mnemonic prefixes: `g*` for special operations

2. **Composability**: Standard Vim editing operations work directly
   - Can use `dd`, `p`, visual selection, registers
   - Buffer edit → save workflow is intuitive

3. **Accessibility**: Most common operations are single keystrokes
   - `-` for parent (inspired by vim-vinegar)
   - `<CR>` for select (Enter key, universal)
   - `<C-c>` for close (common Vim abort pattern)

4. **Discoverability**: Built-in help system
   - `g?` shows all default keymaps
   - Descriptions included with each binding

---

## 2. Keybinding Categories and Patterns

### 2.1 Navigation Keybindings

```
SINGLE DIRECTORY NAVIGATION
├─ j / k              → Cursor up/down (Vim standard)
├─ gg / G             → First/last entry
├─ / <search>         → Find entries (Vim standard)
└─ n / N              → Next/previous search result

CROSS-DIRECTORY NAVIGATION
├─ <CR>               → Open file/directory in current window
├─ <C-s>              → Open in vertical split
├─ <C-h>              → Open in horizontal split
├─ <C-t>              → Open in new tab
├─ -                  → Parent directory
├─ _                  → Current working directory
├─ `                  → :cd to current directory
└─ ~                  → :tcd to current directory

PREVIEW NAVIGATION
├─ <C-p>              → Toggle preview window
├─ <PageUp/Dn>        → Scroll in preview (via custom mappings)
└─ <C-c>              → Close preview and oil
```

**Design Notes**:
- `-` (minus) is iconic for "go up" and was popularized by vim-vinegar
- `~` (tilde) for tab-level directory change is mnemonic (home directory symbol)
- `` ` `` (backtick) for `:cd` (Vim's mark notation connection)
- Split variants use Ctrl+letter pattern (standard in many plugins)

### 2.2 File Operation Keybindings

```
VIM NATIVE OPERATIONS (work directly in buffer)
├─ d / dd             → Delete line (file on :w)
├─ p / P              → Paste (duplicate files)
├─ y / yy             → Yank (copy files)
├─ c / cc             → Change (move/rename files)
├─ V                  → Visual line selection
└─ :x (:w)            → Save all changes

GAS KEYBINDINGS (custom actions)
├─ gs                 → Change sort order (g = go to, s = sort)
├─ g.                 → Toggle hidden files (g = go to, . = dotfiles)
├─ g\\                → Toggle trash view
├─ gx                 → Open with external program
└─ g?                 → Show help
```

**Design Notes**:
- `g` prefix follows Vim convention for extended commands (like `gj`, `gk`)
- `s` for sort is mnemonic (though not standard Vim)
- `.` for hidden files recalls Unix dotfile convention
- `x` for external relates to "execute/external"

### 2.3 Refresh and Utility Operations

```
BUFFER OPERATIONS
├─ <C-l>              → Refresh current directory
├─ <C-c>              → Close and restore
└─ :w                 → Save all changes
```

---

## 3. Editing Workflow Examples

### 3.1 Creating New File (Buffer Approach)

```vim
" Oil buffer shows:
src/
  main.lua
  utils.lua
README.md
LICENSE

" User interaction:
1. Position cursor on empty line (or use 'o' to create new line)
2. Type: new_feature.lua
3. Press <Esc> (exit insert mode)
4. Buffer now shows:
   
   src/
     main.lua
     utils.lua
   README.md
   new_feature.lua
   LICENSE

5. :w (save changes)
6. Oil detects new entry, confirms, creates file
7. File appears on disk at project root
```

### 3.2 Moving File to Subdirectory

```vim
" Before:
src/
  main.lua
LICENSE

" Edit operation:
1. Position cursor on main.lua line
2. d (delete) or dd (cut)
3. Navigate to src/ line
4. Position below src/ line
5. p (paste)
6. Buffer now shows:
   
   src/
   main.lua
   LICENSE

7. :w (save)
8. Oil calculates: main.lua moved from root/src/ to root/
9. Applies changes
```

### 3.3 Copying File Between Directories (Multi-Buffer)

```vim
" Window 1 (:Oil ~/src)        Window 2 (:Oil ~/backup)
src/                           backup/
  main.lua                      config.lua
  utils.lua                     old_backup.tar.gz
  config.lua

" Workflow:
1. In Window 1: position on config.lua
2. yy (yank/copy)
3. Move to Window 2
4. p (paste below any entry)
5. Window 2 now shows:
   
   backup/
     config.lua            <- new entry (pending)
     config.lua
     old_backup.tar.gz

6. :w in Window 2
7. Oil detects copy operation and prompts
8. Copies config.lua from src/ to backup/
```

### 3.4 Batch Delete with Visual Selection

```vim
" Before:
README.md
CHANGELOG.md
LICENSE
AUTHORS
CONTRIBUTING.md

" Workflow:
1. Move cursor to README.md
2. V (visual line mode)
3. j j (select down 2 lines) → selects README, CHANGELOG, LICENSE
4. d (delete visual selection)
5. Buffer shows:
   
   AUTHORS
   CONTRIBUTING.md
   
   (README, CHANGELOG, LICENSE grayed out or removed from buffer)

6. :w (save)
7. Oil shows confirmation: "Delete 3 files?"
8. User confirms
9. All three files deleted from disk
```

---

## 4. UI/UX Pattern Details

### 4.1 Visual Display Architecture

#### Buffer Content Structure

```
┌─────────────────────────────────────────────────────┐
│  winbar: ~/project/src                              │
├─────────────────────────────────────────────────────┤
│ 📁 lua                                              │
│ 📁 bin                                              │
│ 📄 main.rs      <- cursor here                      │
│ 📄 Cargo.toml                                       │
│ 📄 README.md                                        │
│ 📁 .git         <- hidden (if toggled)              │
│ 📄 .gitignore   <- hidden                           │
├─────────────────────────────────────────────────────┤
│ ~/.../src [12 entries] 10,50                        │
└─────────────────────────────────────────────────────┘
```

**Key Visual Elements**:

1. **Winbar**: Shows current directory path
   - Uses `fnamemodify(dir, ":~")` for tilde expansion
   - Helps user know "where they are"

2. **Icon Column**: 
   - 📁 for directories
   - 📄 for files
   - 🔗 for symlinks
   - Colored by type (OilDir, OilFile, OilLink, etc.)

3. **Name Column**:
   - Fully editable in buffer
   - Highlighted by type
   - Trailing `/` convention for directories (optional)

4. **Optional Columns**:
   - Permissions: Unix-style (drwxr-xr-x)
   - Size: Human-readable (12.5 KB, 1.2 MB)
   - Mtime: Formatted timestamp (2025-01-15 14:32)

5. **Cursor Line**:
   - Normal highlighting
   - Can constrain to editable parts
   - Shows current entry ID implicitly

6. **Status Line**:
   - Entry count: "[12 entries]"
   - Cursor position: "10,50" (line 10, column 50)
   - Unsaved changes indicator

#### Highlight Groups and Customization

```lua
-- Default highlight groups available:
OilDir              -- Directory names (normal)
OilDirHidden        -- Hidden directory names
OilDirIcon          -- Directory icons
OilFile             -- File names
OilFileHidden       -- Hidden file names
OilSocket           -- Socket file type
OilLink             -- Symbolic link
OilLinkTarget       -- Symlink target path
OilOrphanLink       -- Broken symlink
OilHidden           -- Generic hidden entry

-- Customizable via setup:
highlight_filename = function(entry, is_hidden, is_link_target, is_link_orphan)
  -- Return highlight group name or nil
  if is_hidden then
    return "OilDirHidden"
  end
  return nil
end
```

### 4.2 Floating Window Patterns

#### Layout Options

```lua
float = {
  padding = 2,              -- Padding around border
  max_width = 0.8,          -- 80% of screen width
  max_height = 0.9,         -- 90% of screen height
  border = "rounded",       -- Border style
  preview_split = "auto",   -- Preview position
}
```

#### Visual Layout Examples

**Centered Float (default)**:
```
┌──────────────────────────────────────────────┐
│                                              │
│   ┌──────────────────────────────────────┐   │
│   │  📁 src/                             │   │
│   │  📁 bin/                             │   │
│   │  📄 main.rs                          │   │
│   │  📄 Cargo.toml                       │   │
│   │  📄 README.md                        │   │
│   │                                      │   │
│   └──────────────────────────────────────┘   │
│                                              │
└──────────────────────────────────────────────┘
```

**Float with Preview (preview_split = "right")**:
```
┌──────────────────────────────────────────────┐
│  ┌──────────────────┐  ┌──────────────────┐  │
│  │ 📁 src/          │  │ [README.md cont]│  │
│  │ 📁 bin/          │  │                  │  │
│  │ 📄 main.rs       │  │ Line 1...        │  │
│  │ 📄 Cargo.toml <- │──│ # My Project     │  │
│  │ 📄 README.md     │  │ README content   │  │
│  │                  │  │ ...              │  │
│  └──────────────────┘  └──────────────────┘  │
└──────────────────────────────────────────────┘
```

### 4.3 Confirmation Dialog Patterns

#### Pre-Save Confirmation Window

```
┌────────────────────────────────────────────────┐
│  Confirm Operations                            │
├────────────────────────────────────────────────┤
│                                                │
│  4 changes:                                    │
│                                                │
│  Create:  new_file.txt                         │
│  Move:    src/main.lua → src/old_main.lua     │
│  Delete:  LICENSE                             │
│  Copy:    README.md → README.backup            │
│                                                │
├────────────────────────────────────────────────┤
│  (y)es / (n)o                                  │
└────────────────────────────────────────────────┘
```

**Confirmation Logic**:

```lua
-- Simplified from operation planning
local operations = {
  {type = "create", path = "new_file.txt"},
  {type = "move", from = "src/main.lua", to = "src/old_main.lua"},
  {type = "delete", path = "LICENSE"},
  {type = "copy", from = "README.md", to = "README.backup"},
}

-- Shown in floating window for user confirmation
-- User presses 'y' to confirm or 'n' to cancel
```

### 4.4 Progress Indication Patterns

#### Long-Running Operation Display

```
┌─────────────────────────────────┐
│  Copying files...               │
├─────────────────────────────────┤
│                                 │
│  [████████░░░░░░░░░░] 40%       │
│                                 │
│  large_file.iso (2.3 GB)        │
│  3.2 GB / 8 GB                  │
│                                 │
│  ETA: ~2 minutes                │
│                                 │
└─────────────────────────────────┘
```

**Features**:
- Progress bar percentage
- Current file being processed
- Total progress (bytes/files)
- Estimated time remaining
- Minimizable when not focused

### 4.5 Help Window Pattern

#### Interactive Help Display

```
┌─────────────────────────────────────────────┐
│  Oil Keymaps                                │
├─────────────────────────────────────────────┤
│                                             │
│  NAVIGATION:                                │
│  <CR>        Open file/directory           │
│  j/k         Move up/down                  │
│  -           Parent directory              │
│                                             │
│  EDITING:                                   │
│  y            Yank (copy)                  │
│  p            Paste                        │
│  d            Delete                       │
│  c            Change (rename/move)         │
│                                             │
│  SPECIAL:                                   │
│  g?           Show this help               │
│  <C-l>        Refresh                      │
│  <C-c>        Close oil                    │
│                                             │
│  Press q to close                          │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 5. Interaction State Machines

### 5.1 Oil Buffer State Lifecycle

```
                    ┌─────────────┐
                    │   START     │
                    └──────┬──────┘
                           │
                           ↓
                   ┌──────────────────┐
                   │  Display Entries │◄──────────────┐
                   │  (Browsing Mode) │               │
                   └────┬────────┬────┘               │
                        │        │                    │
              ┌─────────┘        └──────────┐         │
              │                             │         │
              ↓                             ↓         │
       ┌────────────────┐          ┌──────────────┐  │
       │ Edit Buffer    │          │ Preview File │  │
       │ (Insert Mode)  │          └──────┬───────┘  │
       └────┬───────────┘                 │          │
            │ <Esc>                       │ <Esc>   │
            └───────────────┬─────────────┘         │
                            │                       │
                            ↓                       │
                   ┌──────────────────┐             │
                   │ Changes Detected │             │
                   │ (Review Mode)    │             │
                   └────┬─────────────┘             │
                        │                           │
              ┌─────────┴────────────┐              │
              │                      │              │
              ↓                      ↓              │
        ┌──────────┐           ┌──────────────┐   │
        │   :w     │           │   :q (no :w) │   │
        │          │           │              │   │
        ↓          ↓           ↓              │   │
    ┌──────────────────────┐  ┌──────────────┐│   │
    │  Confirm Operations  │  │ Discard All  ││   │
    │  (Floating Dialog)   │  │ (Back to)    ││   │
    └────┬──────────────┬──┘  │ Browse Mode  ││   │
         │              │     └──────────────┘│   │
    (y)  │              │ (n)                 │   │
         ↓              ↓                     │   │
    ┌─────────┐   ┌──────────┐              │   │
    │ Execute │   │  Cancel  │──────────────┘   │
    │  Ops    │   │ (Review) │                   │
    │ (Apply) │   └──────────┘                   │
    └────┬────┘                                  │
         │                                       │
         ↓                                       │
    ┌──────────┐                                │
    │ Progress │                                │
    │ Display  │                                │
    └────┬─────┘                                │
         │                                      │
         ├─ Success ──→ ┌──────────────────┐   │
         │              │ Display Entries  │───┘
         │              │ (Browsing Mode)  │
         │              └──────────────────┘
         │
         └─ Error ────→ ┌──────────────────┐
                        │ Show Error       │
                        │ (Stay in Review) │
                        └──────────────────┘
```

### 5.2 User Interaction Context

```
                   ┌─────────────┐
                   │ Oil Buffer  │
                   │ Opened      │
                   └──────┬──────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
          ↓               ↓               ↓
    ┌──────────┐   ┌──────────┐   ┌──────────┐
    │ Browse   │   │ Select & │   │ Direct   │
    │ (View    │   │ Open     │   │ Edit     │
    │ Only)    │   │ <CR>     │   │ Buffer   │
    │ j/k      │   │ <C-s>    │   │ Insert   │
    │ /search  │   │ <C-h>    │   │ Mode     │
    │          │   │ <C-t>    │   │          │
    └──────────┘   └──────────┘   └──────────┘
          │               │               │
          │ <CR>          │ <CR>          │
          └───────┬───────┴───────┬───────┘
                  │               │
                  ↓               ↓
          ┌─────────────────────────────────┐
          │    :w to Save Changes           │
          │    (Applies edits to disk)      │
          └─────────────────────────────────┘
```

---

## 6. Mapping Customization Examples

### 6.1 Vim-style Customization

```lua
require("oil").setup({
  keymaps = {
    -- Override defaults
    ["<CR>"] = "actions.select",
    ["-"] = { "actions.parent", mode = "n" },
    
    -- Disable defaults
    ["gx"] = false,
    
    -- Add custom
    ["<leader>gd"] = {
      callback = function()
        require("oil").set_columns({ "icon", "permissions", "size", "mtime" })
      end,
      desc = "Toggle detail view",
    },
    
    -- Vim-style split navigation
    ["<C-w>v"] = { "actions.select", opts = { vertical = true } },
    ["<C-w>s"] = { "actions.select", opts = { horizontal = true } },
    
    -- Custom navigation
    ["<leader>o"] = {
      "actions.open_external",
      desc = "Open with system application"
    },
  },
})
```

### 6.2 Modal Customization

```lua
-- Toggle between simple and detailed view
local detail_mode = false

require("oil").setup({
  keymaps = {
    ["gd"] = {
      callback = function()
        detail_mode = not detail_mode
        if detail_mode then
          require("oil").set_columns({
            "icon",
            "permissions",
            "size",
            "mtime"
          })
        else
          require("oil").set_columns({ "icon" })
        end
      end,
      desc = "Toggle detail view"
    },
  },
})
```

---

## 7. Design Principles Summary

### 7.1 Core Principles

| Principle | Implementation |
|-----------|-----------------|
| **Vim-First** | All operations composable with standard Vim motions |
| **Discoverability** | Help system built-in; sensible defaults |
| **Safety** | Confirmation dialogs for destructive ops; preview windows |
| **Efficiency** | Single-key access to common operations |
| **Flexibility** | Highly customizable keymaps, columns, highlighting |
| **Clarity** | Clear visual distinction between files/dirs/links |
| **Responsiveness** | Progress indication for long operations |
| **Reversibility** | Changes held until `:w`; can discard with `:q!` |

### 7.2 Vim Philosophy Integration

Oil.nvim deeply respects Vim philosophy:

1. **Composable Operations**: Buffer editing paradigm
   - `d` deletes, `y` yanks, `p` pastes
   - Works just like editing text files

2. **Modes and Motions**: Respects modal editing
   - Normal mode: navigation, operations
   - Insert mode: edit names, add entries
   - Visual mode: select multiple entries

3. **Registers and Buffers**: Vim's core abstractions
   - Can yank filenames to registers
   - Multiple oil buffers work like splits

4. **Command Line**: Standard Vim CLI
   - `:Oil`, `:w`, `:q`, `:e` all work

5. **Extensibility**: Lua API and keymapping
   - Custom actions via Lua callbacks
   - Flexible configuration structure

---

## 8. Comparison to Alternative Approaches

### Oil.nvim vs. Tree View Plugins

| Aspect | Oil.nvim | Tree View (neo-tree, etc.) |
|--------|----------|---------------------------|
| **Paradigm** | Edit filesystem as buffer | Graphical tree navigation |
| **Multi-Directory** | Excellent (split/tab support) | Limited (single tree) |
| **Learning Curve** | Low (Vim native ops) | Medium (new abstractions) |
| **Performance** | Good (single directory focus) | Varies (whole tree loaded) |
| **Bulk Operations** | Excellent (visual selection) | Good (but menu-driven) |
| **Keyboard-First** | Yes (100% keyboard) | Partial (often mouse-friendly) |

### Oil.nvim vs. Fuzzy Finders

| Aspect | Oil.nvim | Fuzzy Finders (fzf, telescope) |
|--------|----------|--------------------------------|
| **Browse Mode** | Primary | Secondary (search-focused) |
| **Create Operations** | Native (edit buffer) | Limited (scripted) |
| **Directory Structure** | Visible (single dir) | Hidden (search results) |
| **Folder Navigation** | Natural | By path search |
| **Bulk Operations** | Native | Limited |

---

## References

- Oil.nvim GitHub: https://github.com/stevearc/oil.nvim
- Vim Motion Guide: https://vim.fandom.com/wiki/All_the_right_moves
- Vim Philosophy: https://en.wikibooks.org/wiki/Learning_the_vi_Editor/Vim/Modes
