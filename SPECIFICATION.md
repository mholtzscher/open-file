# Open-File Application Specification

A comprehensive, language-agnostic specification enabling reimplementation in any technology stack.

---

## 1. Executive Summary

### Purpose

Open-File is a terminal-based file explorer and manager for cloud storage and remote filesystems. It provides a unified interface for navigating, viewing, and manipulating files across multiple storage backends through a single application.

### Target Users

- **DevOps engineers** managing cloud storage (object stores, remote servers)
- **System administrators** working with multiple file systems
- **Developers** who prefer terminal-based workflows and keyboard-driven interfaces
- **Power users** seeking vim-style file management

### Key Value Proposition

1. **Unified Access**: Single interface across disparate storage systems (cloud object stores, SSH servers, FTP, local filesystem)
2. **Immediate Operations with Confirmation**: Destructive operations (delete) show a confirmation dialog, then execute immediately
3. **Keyboard-Driven**: Full operation possible without mouse input, using vim-inspired modal editing
4. **Preview Capabilities**: View file contents with syntax highlighting without downloading

### Core Design Philosophy

The application adopts a **"buffer-as-editor"** paradigm inspired by oil.nvim:

- Directory listings are treated as editable text buffers
- Pressing `dd` on an entry initiates deletion (with confirmation)
- Editing a filename (`a`) and pressing Enter renames immediately
- Adding a line (`i`) creates a new file/directory immediately
- Operations execute immediately after user action (no staging/save step)

---

## 2. Architecture Overview

### High-Level System Design

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Presentation Layer                            │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Main View     │  Dialogs      │  Status Bar  │  Preview     │   │
│  │  (Buffer)      │  (Modals)     │  (Messages)  │  (Optional)  │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│                              ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    Event Handling Layer                       │   │
│  │  Keyboard Dispatch │ Mode Management │ Action Handlers        │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Application Layer                             │
│  ┌──────────────┐  ┌───────────────┐  ┌────────────────────────┐   │
│  │ Buffer State │  │ Clipboard     │  │ Profile Management     │   │
│  │ Management   │  │ State         │  │                        │   │
│  └──────────────┘  └───────────────┘  └────────────────────────┘   │
│                               │                                      │
│                               ▼                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                Storage Abstraction Layer                      │   │
│  │  Capability Detection │ Operation Routing │ Error Handling    │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Provider Layer                                │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐   │
│  │ Object  │  │ Cloud   │  │  SSH    │  │  FTP    │  │ Local   │   │
│  │ Store   │  │ Storage │  │  File   │  │         │  │ File    │   │
│  │ (S3)    │  │ (GCS)   │  │ Transfer│  │         │  │ System  │   │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Relationships

| Component               | Responsibility                           | Dependencies                |
| ----------------------- | ---------------------------------------- | --------------------------- |
| **Presentation**        | Render UI, capture input                 | Application Layer           |
| **Event Handling**      | Route input to appropriate handlers      | Mode state, Action handlers |
| **Buffer State**        | Track view state, selection, edit buffer | None (pure state)           |
| **Clipboard State**     | Track copied entries for paste           | None (pure state)           |
| **Profile Management**  | Manage connection configurations         | Credential storage          |
| **Storage Abstraction** | Unified API over providers               | Provider implementations    |
| **Providers**           | Backend-specific protocol handling       | External services           |

### Data Flow

#### Navigation Flow

```
User Input → Keyboard Dispatch → Navigation Handler → Storage Abstraction
→ Provider List Operation → Entry List → Buffer State Update → UI Render
```

#### Operation Flow (Immediate Execution)

```
User Input → Mode Handler → Confirmation Dialog (if destructive)
→ User Confirms → Provider Operation → Progress Updates (if needed)
→ Buffer Refresh → UI Render
```

#### Copy/Paste Flow

```
Copy Command → Entries Stored in Clipboard → Navigate to Destination
→ Paste Command → Provider Copy Operation → Progress Updates
→ Buffer Refresh → UI Render
```

### Architectural Patterns

| Pattern                            | Application                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------------ |
| **Strategy Pattern**               | Storage providers implement common interface with backend-specific logic       |
| **Capability-Based Introspection** | Providers declare supported operations; UI adapts dynamically                  |
| **Immediate Execution**            | File operations execute immediately with confirmation for destructive actions  |
| **State Machine**                  | Edit modes (Normal, Visual, Insert, etc.) with defined transitions             |
| **Observer Pattern**               | Components subscribe to state changes for reactive updates                     |
| **Chain of Responsibility**        | Keyboard handlers processed in priority order                                  |
| **Facade Pattern**                 | Storage abstraction provides simplified interface over complex provider system |

---

## 3. Core Domain Model

### Primary Entities

#### Entry

The fundamental entity representing any file system object.

| Attribute  | Description                                                            |
| ---------- | ---------------------------------------------------------------------- |
| `id`       | Unique identifier for tracking across edits (implementation-generated) |
| `name`     | Display name without path                                              |
| `type`     | One of: File, Directory, Container (bucket/share), Symlink             |
| `path`     | Full path within the storage system                                    |
| `size`     | Size in bytes (undefined for directories)                              |
| `modified` | Last modification timestamp                                            |
| `metadata` | Extended attributes (see below)                                        |

**Extended Metadata** (optional, provider-dependent):

- Content type / MIME type
- Cloud storage: ETag, storage class, version identifier
- POSIX systems: permission mode (octal), owner, group
- Symlinks: target path
- Containers: region, creation time, total size, object count

#### Profile

Named configuration for connecting to a storage backend.

| Attribute           | Description                                                       |
| ------------------- | ----------------------------------------------------------------- |
| `id`                | Unique profile identifier                                         |
| `displayName`       | Human-readable name                                               |
| `provider`          | Provider type identifier                                          |
| `themeId`           | Optional theme preference for this profile                        |
| _provider-specific_ | Configuration varies by provider type (see External Integrations) |

#### Clipboard State

Temporary storage for copy/paste operations.

| Attribute | Description                            |
| --------- | -------------------------------------- |
| `entries` | List of entries that have been copied  |
| `isEmpty` | Whether clipboard contains any entries |

Clipboard is cleared after successful paste operation.

### State Structures

#### Buffer State

Current view and editing state.

| Attribute          | Description                                  |
| ------------------ | -------------------------------------------- |
| `entries`          | Currently displayed entries                  |
| `originalEntries`  | Snapshot before edits (for change detection) |
| `currentPath`      | Path being viewed                            |
| `mode`             | Current edit mode                            |
| `cursorIndex`      | Selected entry position                      |
| `selectionRange`   | Start/end for visual selection               |
| `scrollOffset`     | Viewport scroll position                     |
| `editBuffer`       | Text being typed in edit modes               |
| `editBufferCursor` | Cursor position within edit buffer           |
| `searchQuery`      | Active filter query                          |
| `sortConfig`       | Sort field and direction                     |
| `showHiddenFiles`  | Whether dot-prefixed entries are visible     |

#### Storage State

Provider connection state.

| Attribute          | Description                                           |
| ------------------ | ----------------------------------------------------- |
| `providerId`       | Current provider type                                 |
| `profileId`        | Current profile identifier                            |
| `currentPath`      | Path being viewed                                     |
| `currentContainer` | Current bucket/share (if applicable)                  |
| `isLoading`        | Whether a list operation is in progress               |
| `error`            | Current error message (if any)                        |
| `isConnected`      | Connection status (for connection-oriented protocols) |

#### Progress State

Long-running operation tracking.

| Attribute      | Description                             |
| -------------- | --------------------------------------- |
| `visible`      | Whether progress UI is shown            |
| `title`        | Operation title                         |
| `description`  | Current step description                |
| `percentage`   | Progress 0-100                          |
| `currentFile`  | File being processed                    |
| `currentIndex` | Current operation index                 |
| `totalCount`   | Total operations                        |
| `cancellable`  | Whether operation supports cancellation |
| `cancelled`    | Whether cancellation was requested      |

### Entity Relationships

```
Profile ──configures──▶ Provider ──provides──▶ Entry[]
   │                        │
   └──has themeId──────▶ Theme

Buffer State ──displays──▶ Entry[] (filtered, sorted)

Clipboard State ──stores──▶ Entry[] (for paste)

User Action ──executes via──▶ Provider ──returns──▶ Operation Result
```

---

## 4. Feature Specifications

### 4.1 Directory Navigation

**Functional Requirements**:

- Display entries at current path with type indicators
- Navigate into directories and containers
- Navigate to parent directory
- Navigate to specific path via command input
- Support for both flat (object store) and hierarchical (filesystem) models

**User Interactions**:

- Move cursor up/down through entry list
- Select entry to navigate into (directories) or preview (files)
- Go back to parent directory
- Jump to first/last entry
- Page up/down for large listings

**Validation Rules**:

- Cannot navigate into files (opens preview instead)
- Cannot navigate above root level
- Container selection required before object store navigation

**Edge Cases**:

- Empty directories display appropriate message
- Permission denied shows error without crashing
- Network errors offer retry option

### 4.2 File Operations (Immediate Execution)

**Functional Requirements**:

- Delete entries (with confirmation dialog)
- Rename entries (immediate on submit)
- Copy entries to clipboard
- Paste clipboard contents to current directory
- Create new files and directories

**User Workflows**:

_Delete Workflow_:

1. Position cursor on entry (or select multiple in visual mode)
2. Press delete key (`dd`)
3. Confirmation dialog appears showing entries to be deleted
4. Confirm to execute deletion immediately
5. Entry removed from listing

_Rename Workflow_:

1. Position cursor on entry
2. Enter edit mode (`a`)
3. Modify entry name in inline editor
4. Press Enter to confirm
5. Rename executes immediately
6. Entry name updated in listing

_Copy/Paste Workflow_:

1. Position cursor on entry (or select multiple in visual mode)
2. Copy command (`yy`)
3. Navigate to destination directory
4. Paste command (`p`)
5. Copy executes immediately (progress shown for large operations)
6. New entries appear in listing

_Create Workflow_:

1. Enter insert mode (`i`)
2. Type new entry name (trailing `/` for directory)
3. Press Enter to confirm
4. File/directory created immediately
5. New entry appears in listing

**Validation Rules**:

- Cannot rename to empty name
- Cannot rename to existing name (conflict)
- Cannot paste into non-directory
- Cannot delete root container
- Name validation: no path separators, length limits

**Edge Cases**:

- Pasting into same directory creates copy with modified name
- Circular move detection (moving directory into itself)
- Large file operations show progress (5+ files OR any file > 10MB)
- On error: error dialog shown, entry remains visible

### 4.3 Visual Selection Mode

**Functional Requirements**:

- Select multiple entries for batch operations
- Extend selection up/down
- Apply operations to all selected entries

**User Workflow**:

1. Enter visual mode on current entry
2. Move cursor to extend selection (highlighted range)
3. Apply operation (delete, copy, cut) to all selected
4. Exit visual mode

**Validation Rules**:

- Selection must be contiguous
- Cannot select across directory boundaries

### 4.4 Search/Filter Mode

**Functional Requirements**:

- Filter displayed entries by name pattern
- Real-time filtering as user types
- Clear filter to restore full listing

**User Workflow**:

1. Enter search mode
2. Type filter pattern
3. Entries filtered in real-time
4. Confirm to keep filter or cancel to restore

**Validation Rules**:

- Case-insensitive by default
- Supports glob-style wildcards

### 4.5 File Preview

**Functional Requirements**:

- Display file contents without downloading
- Syntax highlighting for code files
- Handle binary files gracefully
- Respect file size limits

**User Workflow**:

1. Position cursor on file
2. Open preview (or toggle preview pane)
3. File content displayed with highlighting
4. Navigate away to close preview

**Validation Rules**:

- Maximum preview size (configurable)
- Binary files show type indicator only
- Unsupported files show message

**Supported File Types** (syntax highlighting):

- Programming languages (detected by extension)
- Configuration files (JSON, YAML, TOML, INI)
- Markup (Markdown, HTML, XML)
- Shell scripts
- Special files (Dockerfile, Makefile, dotfiles)

### 4.6 Upload/Download

**Functional Requirements**:

- Download remote files to local filesystem
- Upload local files to remote storage
- Support recursive directory transfers
- Progress tracking with cancellation

**User Workflows**:

_Download_:

1. Select entry (file or directory)
2. Invoke download command
3. Select local destination (or use default)
4. Progress indicator shown
5. Completion notification

_Upload_:

1. Open upload dialog
2. Browse local filesystem
3. Select file(s) or directory
4. Confirm upload destination
5. Progress indicator shown
6. Entries appear in listing on completion

**Validation Rules**:

- Sufficient local disk space for downloads
- Write permission on remote for uploads
- Handle name conflicts (overwrite/skip/rename)

### 4.7 Profile Management

**Functional Requirements**:

- Create named connection profiles
- Edit existing profiles
- Delete profiles
- Switch between profiles
- Per-profile theme preferences

**User Workflow**:

1. Open profile selector
2. Choose existing profile or create new
3. For new: select provider type, enter configuration
4. Configuration validated
5. Connection established

**Validation Rules**:

- Required fields by provider type
- Unique profile identifiers
- Credential format validation
- Connection test before save (optional)

---

## 5. External Integrations

### Storage Providers

#### Object Store (S3-Compatible)

**Protocol**: HTTPS REST API
**Authentication**: Access key + secret key, STS temporary credentials, or profile-based
**Configuration**:

- Region
- Credential source (explicit, profile name, environment)
- Custom endpoint (for S3-compatible services)
- Path-style addressing option

**Capabilities**: List, Read, Write, Delete, Copy (server-side), Move (copy+delete), Containers (buckets), Metadata, Presigned URLs, Batch Delete

**Virtual Directory Handling**: Flat namespace with "/" delimiter simulation

#### Cloud Object Storage (GCS)

**Protocol**: HTTPS REST API
**Authentication**: Service account key file, application default credentials
**Configuration**:

- Project identifier
- Key file path or default credentials flag
- Custom endpoint (for emulators)

**Capabilities**: List, Read, Write, Delete, Copy (server-side), Move, Containers (buckets), Metadata, Presigned URLs, Versioning

#### SSH File Transfer (SFTP)

**Protocol**: SSH subsystem (TCP port 22 typically)
**Authentication**: Password, private key file, SSH agent
**Configuration**:

- Host and port
- Username
- Authentication method and credentials
- Private key path and passphrase (if applicable)
- Base path

**Capabilities**: List, Read, Write, Delete, Mkdir, Move, Permissions, Symlinks, Connection lifecycle

**Connection Management**: Persistent connection with reconnect support

#### File Transfer Protocol (FTP)

**Protocol**: FTP (TCP port 21 typically), FTPS
**Authentication**: Username/password, anonymous
**Configuration**:

- Host and port
- Username and password
- Security mode (plain, explicit TLS, implicit TLS)
- Base path

**Capabilities**: List, Read, Write, Delete, Mkdir, Move, Connection lifecycle

#### Local Filesystem

**Protocol**: Native OS filesystem calls
**Authentication**: Process user permissions
**Configuration**:

- Base path (optional, defaults to user home)

**Capabilities**: List, Read, Write, Delete, Mkdir, Move, Copy, Permissions, Symlinks

### Credential Handling

**Resolution Chain** (checked in order):

1. Environment variables
2. OS keychain/credential manager
3. Cloud provider CLI profiles
4. SSH agent
5. Key files at standard locations
6. Inline encrypted configuration
7. Interactive prompt (last resort)

**Security Requirements**:

- Credentials never logged
- Sensitive fields masked in UI
- Support for encrypted storage
- Timing-safe comparison for validation

---

## 6. UI/UX Specifications

### Screen Inventory

#### Main Screen (File Explorer)

```
┌──────────────────────────────────────────────────────────────┐
│ Header: [Provider Badge] Profile Name    [Connection Status] │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  > selected-entry/                                          │
│    another-entry.txt                                        │
│    documents/                                                │
│    image.png                                                 │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ Status: path/to/current  [NORMAL]     j/k nav  ? help       │
└──────────────────────────────────────────────────────────────┘
```

**Components**:

- **Header**: Provider indicator, profile name, connection status
- **Entry List**: Directory contents with visual state indicators
- **Status Bar**: Current path, mode indicator, contextual help hints

#### Two-Pane Layout (with Preview)

```
┌─────────────────────────────────┬────────────────────────────┐
│ Entry List (left pane)          │ File Preview (right pane)  │
│                                 │                            │
│   file1.txt                     │  1 │ // File contents     │
│ > file2.txt                     │  2 │ function example() {  │
│   folder/                       │  3 │   return true;        │
│                                 │  4 │ }                     │
└─────────────────────────────────┴────────────────────────────┘
```

### Modal Dialogs

| Dialog               | Purpose                        | Content                       |
| -------------------- | ------------------------------ | ----------------------------- |
| **Help**             | Display all keybindings        | Categorized list of shortcuts |
| **Confirmation**     | Confirm destructive operations | Operation summary, Yes/No     |
| **Sort**             | Change sort options            | Field selector, order toggle  |
| **Upload**           | Browse local files for upload  | File browser, selection       |
| **Quit**             | Confirm quit                   | Quit/Cancel options           |
| **Profile Selector** | Choose connection profile      | Profile list, create/edit     |
| **Theme Selector**   | Change color theme             | Theme list with preview       |
| **Progress**         | Show operation progress        | Progress bar, cancel button   |
| **Error**            | Display error details          | Message, dismiss button       |

### Navigation Model

#### Mode State Machine

```
                         ┌─────────────────────────┐
                         │                         │
                         ▼                         │
                   ┌──────────┐                    │
              ┌───▶│  NORMAL  │◀───────────────────┤
              │    └────┬─────┘                    │
              │         │                          │
         ESC  │    ┌────┴────┬─────┬────┬────┐    │
              │    │         │     │    │    │    │
              │    ▼         ▼     ▼    ▼    ▼    │ ESC
              │ INSERT    EDIT  VISUAL SEARCH CMD │
              │    │         │     │    │    │    │
              └────┴─────────┴─────┴────┴────┴────┘
```

| Mode        | Purpose                      | Activation        | Deactivation              |
| ----------- | ---------------------------- | ----------------- | ------------------------- |
| **Normal**  | Navigation, basic operations | Default / ESC     | N/A                       |
| **Visual**  | Multi-entry selection        | `v`               | ESC or complete operation |
| **Insert**  | Create new entry             | `i`               | ESC or Enter (confirm)    |
| **Edit**    | Rename entry                 | `a` or equivalent | ESC or Enter (confirm)    |
| **Search**  | Filter entries               | `/`               | ESC or Enter              |
| **Command** | Execute commands             | `:`               | ESC or Enter              |

### Input Model

#### Keyboard Shortcuts (Default Bindings)

**Navigation (Normal Mode)**:
| Key | Action |
|-----|--------|
| `j` / `↓` | Move cursor down |
| `k` / `↑` | Move cursor up |
| `g` then `g` | Go to first entry |
| `G` | Go to last entry |
| `Ctrl+D` / Page Down | Page down |
| `Ctrl+U` / Page Up | Page up |
| `l` / `Enter` | Open directory/preview file |
| `h` / `Backspace` | Go to parent directory |

**Operations (Normal Mode)**:
| Key | Action |
|-----|--------|
| `d` then `d` | Delete (with confirmation) |
| `y` then `y` | Copy to clipboard |
| `p` | Paste from clipboard |
| `r` | Refresh listing |

**Mode Changes**:
| Key | Action |
|-----|--------|
| `i` | Enter insert mode |
| `a` | Enter edit mode (rename) |
| `v` | Enter visual mode |
| `/` | Enter search mode |
| `:` | Enter command mode |
| `ESC` | Return to normal mode |

**Dialogs/Actions**:
| Key | Action |
|-----|--------|
| `?` | Toggle help dialog |
| `o` | Open sort menu |
| `P` | Open profile selector |
| `D` | Download entry |
| `U` | Open upload dialog |
| `H` | Toggle hidden files |

**Commands** (Command Mode):
| Command | Action |
|---------|--------|
| `:q` | Quit |

**Text Input Modes** (Insert, Edit, Search, Command):
| Key | Action |
|-----|--------|
| Characters | Append to input |
| `Backspace` | Delete before cursor |
| `Delete` | Delete at cursor |
| `←` / `→` | Move cursor |
| `Home` / `Ctrl+A` | Go to start |
| `End` / `Ctrl+E` | Go to end |
| `Tab` | Auto-complete (where applicable) |
| `Enter` | Confirm input |
| `ESC` | Cancel input |

#### Priority-Based Input Handling

Keyboard events are processed through a priority chain:

1. **Critical (highest)**: System-level handlers (panic, force quit)
2. **High**: Active dialog handlers
3. **Normal**: Main application handlers
4. **Low (lowest)**: Default/fallback handlers

When a handler processes a key, it stops propagation to lower priorities.

### Visual State Indicators

| State            | Visual Treatment                   |
| ---------------- | ---------------------------------- |
| Cursor position  | `>` prefix, highlighted background |
| Visual selection | Highlighted background on range    |
| Directory        | Trailing `/`, distinct color       |
| Symlink          | `→` with target, distinct color    |

### Theming System

**Theme Structure**:

- **Palette**: Raw color values (base, surface, text, accent colors)
- **Semantic Colors**: Colors by purpose (success, error, warning, info)
- **Syntax Colors**: Code highlighting token colors

**Semantic Color Purposes**:

- Text hierarchy (primary, secondary, muted, disabled)
- Backgrounds (base, surface, highlight, selection)
- Status (success, error, warning, info)
- File types (directory, file, special)
- Mode indicators (normal, insert, visual, search, edit)
- Provider branding (per-provider accent colors)

**Built-in Themes**:

- Multiple dark themes (default)
- Light theme option
- Per-profile theme override support

---

## 7. Configuration & Extensibility

### User-Configurable Options

| Option            | Description                           | Scope                 |
| ----------------- | ------------------------------------- | --------------------- |
| Default profile   | Profile to connect on launch          | Global                |
| Theme             | Color scheme                          | Global or per-profile |
| Show hidden files | Display dot-prefixed entries          | Session or persisted  |
| Sort field        | Default sort (name, size, date, type) | Session or persisted  |
| Sort order        | Ascending or descending               | Session or persisted  |
| Preview pane      | Enable/disable preview pane           | Session               |

### Profile Configuration

Profiles are stored persistently and include:

- Connection parameters (provider-specific)
- Credential references (not raw credentials)
- Theme preference
- Display name

### Extension Points

**Provider System**:

- New storage providers can be added by implementing the provider interface
- Providers declare capabilities for feature detection
- No UI changes required for new providers with standard capabilities

**Theme System**:

- Custom themes can be registered
- Themes define palette, semantic colors, and syntax highlighting
- Hot-swappable at runtime

**Keybinding Customization** (potential extension):

- Action-based binding system allows remapping
- Mode-specific bindings supported
- Multi-key sequences supported

---

## 8. Non-Functional Requirements

### Performance Considerations

| Area                    | Requirement                                       |
| ----------------------- | ------------------------------------------------- |
| **Startup**             | Application ready within 2 seconds                |
| **Directory listing**   | Display results as they arrive (streaming)        |
| **Large directories**   | Handle 10,000+ entries with virtualized rendering |
| **Preview loading**     | Progressive display, don't block UI               |
| **Operation execution** | Parallel execution where safe                     |
| **Memory**              | Cap undo history, limit preview size              |

### Error Handling Philosophy

1. **Graceful Degradation**: Missing capabilities don't crash; features are disabled
2. **User-Friendly Messages**: Technical errors translated to actionable messages
3. **Recovery Options**: Retry for transient errors, skip for individual failures in batch
4. **Explicit Failure**: Never silently fail; always surface errors
5. **Partial Success**: Batch operations continue past individual failures, report summary

**Error Categories**:
| Category | Behavior |
|----------|----------|
| Not Found | Show message, offer refresh |
| Permission Denied | Show message, no retry |
| Network Error | Show message, offer retry (retryable) |
| Timeout | Show message, offer retry (retryable) |
| Conflict | Show details, offer resolution options |
| Validation | Show inline feedback, prevent action |

### Logging Approach

- Structured log entries with severity levels
- Credential sanitization (automatic masking)
- Operation audit trail (what was done, when)
- Debug mode for troubleshooting
- No sensitive data in logs at any level

### Accessibility Considerations

- Full keyboard navigation (no mouse required)
- High contrast theme option
- Screen reader compatible text output
- Clear visual state indicators

---

## Appendix A: URI Format

Storage URIs follow this format:

```
scheme://container/path/to/entry
```

Examples:

- `s3://bucket-name/folder/file.txt`
- `gcs://bucket-name/folder/file.txt`
- `sftp://host:port/path/file.txt`
- `ftp://host:port/path/file.txt`
- `file:///home/user/file.txt`

URIs are used internally for:

- Cross-backend entry identification
- Pending operation tracking
- Clipboard operations across directories

---

## Appendix B: Capability Matrix

| Capability           | S3  | GCS | SFTP | FTP | Local |
| -------------------- | :-: | :-: | :--: | :-: | :---: |
| List                 |  ●  |  ●  |  ●   |  ●  |   ●   |
| Read                 |  ●  |  ●  |  ●   |  ●  |   ●   |
| Write                |  ●  |  ●  |  ●   |  ●  |   ●   |
| Delete               |  ●  |  ●  |  ●   |  ●  |   ●   |
| Create Directory     |  ●  |  ●  |  ●   |  ●  |   ●   |
| Move/Rename          |  ●  |  ●  |  ●   |  ●  |   ●   |
| Copy                 |  ●  |  ●  |  ○   |  ○  |   ●   |
| Server-Side Copy     |  ●  |  ●  |  ○   |  ○  |   ○   |
| Containers           |  ●  |  ●  |  ○   |  ○  |   ○   |
| Download             |  ●  |  ●  |  ●   |  ●  |   ●   |
| Upload               |  ●  |  ●  |  ●   |  ●  |   ●   |
| Permissions          |  ○  |  ○  |  ●   |  ○  |   ●   |
| Symlinks             |  ○  |  ○  |  ●   |  ○  |   ●   |
| Connection Lifecycle |  ○  |  ○  |  ●   |  ●  |   ○   |
| Presigned URLs       |  ●  |  ●  |  ○   |  ○  |   ○   |
| Versioning           |  ○  |  ●  |  ○   |  ○  |   ○   |
| Batch Delete         |  ●  |  ●  |  ○   |  ○  |   ○   |

● = Supported, ○ = Not Supported

---

## Appendix C: Glossary

| Term            | Definition                                                          |
| --------------- | ------------------------------------------------------------------- |
| **Buffer**      | In-memory representation of directory contents, treated as editable |
| **Clipboard**   | Temporary storage for copied entries awaiting paste                 |
| **Container**   | Top-level organizational unit (S3 bucket, GCS bucket)               |
| **Entry**       | Any file system object (file, directory, container, symlink)        |
| **Profile**     | Named configuration for connecting to a storage backend             |
| **Provider**    | Implementation of storage backend protocol                          |
| **URI**         | Uniform Resource Identifier for cross-backend entry addressing      |
| **Visual Mode** | Multi-selection state for batch operations                          |
