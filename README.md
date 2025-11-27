# open-s3

A Terminal User Interface (TUI) for exploring and managing AWS S3 buckets, inspired by oil.nvim's buffer-as-editor approach.

## Features

- 🗂️ **Browse S3 buckets** - Navigate through S3 buckets like a file system
- ✏️ **Edit as buffer** - Edit bucket contents like a text buffer (create, delete, rename, move)
- 🎨 **Beautiful UI** - Color-coded entries, vim-style keybindings
- 🔄 **Provider system** - Extensible storage provider architecture for S3 and future backends
- ⚡ **Fast** - Built with Bun runtime for superior performance
- 🧪 **Well-tested** - Comprehensive test suite for reliability

## Installation

### Prerequisites

- **Bun >= 1.0.0** - The runtime environment
- **Node.js 18+** (optional) - For npm compatibility
- **AWS Account** - With S3 bucket access and credentials
- **Terminal** - Any modern terminal emulator (iTerm2, Alacritty, GNOME Terminal, etc.)

### Installation Methods

#### Method 1: From Source (Recommended for Development)

```bash
# Clone the repository
git clone https://github.com/yourusername/open-s3.git
cd open-s3

# Install Bun (if not already installed)
curl -fsSL https://bun.sh/install | bash

# Install dependencies
bun install

# Run the application
bun run src/index.ts
```

#### Method 2: Using npm (if Bun is not available)

```bash
# Clone and setup
git clone https://github.com/yourusername/open-s3.git
cd open-s3
npm install

# Run (requires Bun runtime)
bun run src/index.ts
```

### First Time Setup

After installing open-s3, follow these steps to get started:

1. **Set up AWS credentials** (choose one method):

   Option A - Environment variables:

   ```bash
   export AWS_ACCESS_KEY_ID=your-access-key
   export AWS_SECRET_ACCESS_KEY=your-secret-key
   export AWS_REGION=us-east-1
   ```

   Option B - Use AWS CLI configuration:

   ```bash
   aws configure
   ```

   Option C - Pass credentials via command line:

   ```bash
   bun run src/index.ts --access-key your-key --secret-key your-secret --region us-east-1
   ```

2. **Verify credentials work**:

   ```bash
   # List your buckets to test credentials
   aws s3 ls
   ```

3. **Start open-s3**:

   ```bash
   bun run src/index.ts
   ```

4. **Navigate with vim keybindings**:
   - Use `j`/`k` to move up and down
   - Press `Enter` to open directories
   - Press `q` to quit

## Quick Start Tutorial

### Bucket Root View

When you start open-s3 without specifying a bucket, you'll see a list of all S3 buckets in your AWS account. This is the root view where you can:

1. **Browse buckets** - Use `j` and `k` to move cursor down and up
2. **Enter a bucket** - Press `Enter` or `l` to open a bucket and view its contents
3. **See bucket metadata** - Each bucket shows:
   - **Name** - The bucket identifier
   - **Region** - Where the bucket is located
   - **Creation Date** - When the bucket was created
   - **Size** - Total size of objects in the bucket (if enabled)

### Navigating Within a Bucket

Once you've entered a bucket, you'll see a list of entries (files and directories). Here's how to navigate:

1. **Move around** - Use `j` and `k` to move cursor down and up
2. **Enter a directory** - Press `Enter` or `l` to open a directory
3. **Go back** - Press `h` or `Backspace` to go to the parent directory
4. **Return to bucket root** - Press `~` to go back to the bucket listing
5. **Jump to top** - Press `gg` (press 'g' twice) to jump to the top
6. **Jump to bottom** - Press `G` (capital G) to jump to the bottom

### Creating Entries

To create a new file or directory:

1. Press `i` to enter insert mode
2. Type the name of the new entry (e.g., `myfile.txt` or `mydir/`)
3. Press `Tab` to see auto-completion suggestions (based on existing files)
4. Press `Enter` to create the entry
5. Or press `Escape` to cancel

The new entry will be created when you save with `w`.

### Editing Entries

To modify an entry (rename or move it):

1. Navigate to the entry
2. Press `a` to enter edit mode
3. Modify the entry name or path
4. Press `w` to save changes
5. Or press `Escape` to cancel

### Deleting Entries

To delete one or more entries:

1. **Single delete** - Navigate to the entry and press `dd`
2. **Multiple delete** - Press `v` to enter visual mode, move to select entries with `j`/`k`, then press `d`

Deleted entries will be shown with a `~` prefix and can be undone with `u` before you save.

### Saving Changes

After making changes (creates, deletes, moves), you must save them:

1. Press `w` to save
2. Review the confirmation dialog showing what will be created/deleted/moved
3. Press `Enter` to confirm or `Escape` to cancel
4. Changes will be applied to your bucket

## Keybinding Reference

### Normal Mode

| Key               | Action                                 |
| ----------------- | -------------------------------------- |
| `j`               | Move cursor down                       |
| `k`               | Move cursor up                         |
| `gg`              | Move to top                            |
| `G`               | Move to bottom                         |
| `n`               | Page down (next page)                  |
| `p`               | Page up (previous page)                |
| `Enter` / `l`     | Open file/directory or select bucket   |
| `h` / `Backspace` | Go to parent directory                 |
| `~`               | Go to bucket root (from within bucket) |
| `i`               | **Create new entry**                   |
| `a`               | Edit mode                              |
| `dd`              | **Delete entry at cursor**             |
| `v`               | Start visual selection                 |
| `c`               | Copy selected entry to clipboard       |
| `P`               | Paste after cursor                     |
| `w`               | Save changes (confirm operations)      |
| `/`               | Enter search mode                      |
| `u`               | Undo last change                       |
| `Ctrl+r`          | Redo last change                       |
| `q`               | Quit application                       |

### Visual Mode

| Key      | Action                  |
| -------- | ----------------------- |
| `j`      | Extend selection down   |
| `k`      | Extend selection up     |
| `d`      | Delete selected entries |
| `Escape` | Exit visual mode        |

### Insert Mode (Creating Entries)

| Key           | Action                                 |
| ------------- | -------------------------------------- |
| Any character | Type entry name                        |
| `Backspace`   | Delete last character                  |
| `Tab`         | Apply first auto-completion suggestion |
| `Enter`       | Confirm entry creation                 |
| `Escape`      | Cancel entry creation                  |

### Search Mode

| Key           | Action                       |
| ------------- | ---------------------------- |
| Any character | Add to search query          |
| `Backspace`   | Delete last character        |
| `Ctrl+c`      | Toggle case-sensitive search |
| `Ctrl+r`      | Toggle regex matching        |
| `Escape`      | Exit search mode             |

## Configuration

### Command Line Options

open-s3 is configured primarily through command-line arguments:

```bash
open-s3 [OPTIONS] [BUCKET]

OPTIONS:
  -b, --bucket NAME       S3 bucket name
  -p, --profile NAME      AWS profile name (default: active profile or 'default')
  -r, --region REGION     AWS region (default: from profile, then us-east-1)
  --endpoint URL          Custom S3 endpoint (for LocalStack, etc.)
  --access-key KEY        AWS access key
  --secret-key KEY        AWS secret key
  --debug                 Enable debug logging to file
  -h, --help              Show help message
  -v, --version           Show version
```

### Configuration Options

All configuration is done through CLI arguments and environment variables:

```bash
# Use specific AWS profile
open-s3 --profile production my-bucket

# Override region
open-s3 --region us-west-2 my-bucket

# Use custom endpoint (LocalStack)
open-s3 --endpoint http://localhost:4566 test-bucket

# Specify credentials explicitly
open-s3 --access-key KEY --secret-key SECRET --region us-east-1 my-bucket
```

### Customization

```json
{
  "keybindings": {
    "moveDown": "j",
    "moveUp": "k",
    "moveToTop": "gg",
    "moveToBottom": "G",
    "openItem": "Enter",
    "createEntry": "i",
    "deleteEntry": "dd",
    "save": "w"
  },
  "colors": {
    "cursor": "#FFFF00",
    "selection": "#00FF00",
    "directory": "#0080FF",
    "file": "#FFFFFF",
    "error": "#FF0000",
    "text": "#CCCCCC"
  }
}
```

**Note:** The `bucket` field is now optional. If omitted, open-s3 will start at the bucket root view, allowing you to browse and select from all available buckets in your AWS account.

### Configuration Examples

#### Bucket Root View (Start with Bucket Selection)

```json
{
  "s3": {
    "region": "us-east-1"
  }
}
```

#### Minimal Configuration with Specific Bucket

```json
{
  "s3": {
    "region": "us-east-1",
    "bucket": "my-bucket"
  }
}
```

#### Full Configuration with Custom Keybindings

```json
{
  "s3": {
    "region": "eu-west-1",
    "bucket": "production-bucket",
    "endpoint": "https://s3.eu-west-1.amazonaws.com"
  },
  "display": {
    "showIcons": true,
    "showSizes": true,
    "showDates": true,
    "defaultSort": "modified"
  },
  "keybindings": {
    "moveDown": "j",
    "moveUp": "k",
    "moveToTop": "gg",
    "moveToBottom": "G",
    "openItem": "l",
    "createEntry": "i",
    "deleteEntry": "dd",
    "save": "w",
    "undo": "u",
    "redo": "C-r"
  }
}
```

#### S3 with Custom Endpoint (LocalStack, Minio, etc.)

```json
{
  "s3": {
    "region": "us-east-1",
    "bucket": "test-bucket",
    "endpoint": "http://localhost:4566",
    "accessKeyId": "test",
    "secretAccessKey": "test",
    "forcePathStyle": true
  }
}
```

### Credential Resolution Order

open-s3 looks for AWS credentials in this order:

1. Command-line arguments (`--access-key`, `--secret-key`, `--region`)
2. Environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`)
3. AWS CLI profile (`~/.aws/credentials` and `~/.aws/config`)
4. AWS profile specified with `--profile` flag

## Architecture

The application follows a clean, modular architecture with a React-based UI. As of November 2025, open-s3 uses a provider-based architecture that supports multiple storage backends with better error handling, capability-based UI, and connection status tracking.

### Providers (`src/providers/`)

- **StorageProvider Interface** - Unified interface for storage backends
- **S3Provider** - AWS S3 implementation using SDK v3
- **MockStorageProvider** - In-memory provider for testing
- **Profile Management** - Credential and configuration management
- **Provider Factory** - Provider creation and registration

### React Components (`src/ui/`)

- **S3Explorer** - Main React component with declarative rendering
- **BufferView** - React component for rendering entries as editable buffer
- **StatusBar** - React component for status bar display
- **ConfirmationDialog** - React component for operation confirmations
- **theme.ts** - Catppuccin color theme definitions

### React Hooks (`src/hooks/`)

- **useBufferState** - State management for buffer entries, cursor, selection, mode
- **useKeyboardEvents** - Keyboard event handling with vim-style bindings
- **useNavigationHandlers** - Directory navigation logic
- **useBufferOperations** - Buffer operations (copy, paste, delete)
- **useTerminalSize** - Terminal dimension tracking for responsive layout

### Utilities (`src/utils/`)

- **Change Detection** - Detects creates, deletes, moves, renames
- **Entry ID Management** - Tracks entries across buffer edits
- **Configuration** - Manages user preferences
- **Path Utilities** - Path manipulation helpers

### Types (`src/types/`)

- **Entry** - Represents files/directories
- **Operations** - Create, Delete, Move, Copy operations
- **EditMode** - Editor modes (Normal, Visual, Insert, Edit, Search)

## Development

### Run in Watch Mode

```bash
bun run --watch src/index.ts
```

Or using Just:

```bash
just dev
```

### Run Tests

```bash
bun test
```

All tests must pass. The project currently has **1469 tests** across 65 test files covering providers, hooks, UI components, and utilities.

### Build for Production

```bash
bun build src/index.ts --outdir dist --target bun
```

Or using Just:

```bash
just build
```

## Project Structure

```
open-s3/
├── src/
│   ├── providers/         # Storage provider system
│   │   ├── provider.ts   # StorageProvider interface
│   │   ├── base-provider.ts
│   │   ├── factory.ts
│   │   ├── s3/           # S3 provider implementation
│   │   │   ├── s3-provider.ts
│   │   │   └── utils/    # S3-specific utilities
│   │   ├── services/     # Profile management
│   │   ├── credentials/  # Credential management
│   │   └── types/        # Provider-specific types
│   ├── hooks/            # React hooks for state & effects
│   │   ├── useBufferState.ts
│   │   ├── useKeyboardEvents.ts
│   │   ├── useNavigationHandlers.ts
│   │   ├── useBufferOperations.ts
│   │   └── useTerminalSize.ts
│   ├── ui/               # React components & UI utilities
│   │   ├── s3-explorer.tsx         # Main React component
│   │   ├── buffer-view-react.tsx   # Buffer rendering
│   │   ├── status-bar-react.tsx    # Status bar
│   │   ├── confirmation-dialog-react.tsx  # Dialog component
│   │   ├── buffer-state.ts         # Editor state management
│   │   ├── theme.ts                # Color theme definitions
│   │   └── keybindings.ts          # Keybinding utilities
│   ├── types/            # Common type definitions
│   │   ├── entry.ts      # Entry, EntryType, EntryMetadata
│   │   ├── progress.ts   # Progress tracking types
│   │   ├── list.ts       # List operation types
│   │   ├── operations.ts
│   │   └── edit-mode.ts
│   ├── utils/            # Utilities
│   │   ├── change-detection.ts
│   │   ├── entry-id.ts
│   │   ├── config.ts
│   │   ├── path-utils.ts
│   │   ├── errors.ts
│   │   ├── sorting.ts
│   │   └── cli.ts
│   ├── contexts/         # React contexts
│   │   └── StorageContext.tsx
│   ├── components/       # Reusable React components
│   └── index.tsx         # Main application & keyboard dispatcher
├── justfile              # Development commands
├── package.json          # Dependencies
├── tsconfig.json         # TypeScript configuration
└── README.md             # This file
```

## React Architecture

The application uses React with OpenTUI for terminal UI rendering. Key architectural decisions:

### Component Structure

- **S3Explorer** - Main React component that orchestrates the entire application
- Renders declaratively using JSX with OpenTUI primitives (`<text>`, `<box>`)
- Uses hooks for all state management and side effects

### State Management via Hooks

- **useBufferState** - Manages entries, cursor position, selection state, and edit modes
- **useKeyboardEvents** - Handles all keyboard input with vim-style keybindings
- **useNavigationHandlers** - Manages directory navigation logic
- **useTerminalSize** - Tracks terminal dimensions for responsive layout

### Event Handling

- Keyboard events are captured at the top level (index.tsx)
- Dispatched to React components via a global dispatcher
- Components handle events through callback props and hooks
- Vim-style key sequences (gg, dd, yy) are handled by useKeyboardEvents

### Responsive Layout

- Terminal size changes are detected via SIGWINCH signals
- useTerminalSize hook provides reactive width/height values
- Layout dimensions automatically recalculate on resize
- UI hides/shows columns based on available space

### No Imperative State Mutation

- All state changes go through React hooks
- BufferState and related logic are now hook-based
- No manual DOM manipulation or rendering
- Declarative JSX for all UI elements

## Key Concepts

### Buffer-as-Editor Pattern

Following oil.nvim's approach, the file/directory listing is treated as an editable buffer:

- Entries are displayed as text lines
- Deleting lines removes files
- Editing names renames files
- Changes are tracked and committed with confirmation

### Entry ID System

Each entry has a unique ID that persists during buffer edits. This allows:

- Tracking which file is which when you rename it
- Detecting moves vs creates
- Proper change detection algorithm

### Change Detection

The application compares original and edited states to detect:

- **Creates** - New entries added to buffer
- **Deletes** - Entries removed from buffer
- **Moves** - Entries with changed paths (renames/relocations)
- **Reorders** - Entries in different positions

### Operation Planning

Detected changes are converted to an executable operation plan:

1. Creates (new files/directories)
2. Moves (renames, relocations)
3. Deletes (always last to avoid dependencies)

## AWS Credentials

The S3 adapter uses AWS SDK v3 and supports multiple credential methods:

1. **Environment Variables**

   ```bash
   export AWS_ACCESS_KEY_ID=your-key
   export AWS_SECRET_ACCESS_KEY=your-secret
   export AWS_REGION=us-east-1
   ```

2. **AWS Credentials File** (`~/.aws/credentials`)
   - Standard AWS credentials file

3. **Command Line Arguments**

   ```bash
   open-s3 --access-key your-key --secret-key your-secret --region us-east-1
   ```

## Troubleshooting

### Common Issues and Solutions

#### "Access Denied" or "Invalid Credentials"

**Problem**: Getting authentication errors when trying to list S3 buckets

**Solutions**:

1. Check your AWS credentials are properly set:

   ```bash
   # Check environment variables
   echo $AWS_ACCESS_KEY_ID
   echo $AWS_SECRET_ACCESS_KEY
   ```

2. Ensure your IAM user has S3 permissions:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": ["s3:*"],
         "Resource": "*"
       }
     ]
   }
   ```

#### "Bucket not found" or Cannot Connect

**Problem**: Error message about bucket not being found or connection failure

**Solutions**:

1. Verify bucket name in config:

   ```bash
   aws s3 ls | grep your-bucket-name
   ```

2. Check region is correct - bucket may be in different region:

   ```bash
   aws s3api get-bucket-location --bucket your-bucket-name
   ```

3. If using custom endpoint (LocalStack, Minio), verify it's running:
   ```bash
   curl -v http://localhost:4566
   ```

#### Changes Not Saving

**Problem**: You made changes but they didn't apply to S3

**Solutions**:

1. Make sure to press `w` to save - changes are not automatic
2. Review the confirmation dialog before confirming
3. Check the status bar for error messages
4. Look for permission issues with the IAM user

#### Cursor Jumping or Display Issues

**Problem**: Cursor behavior is erratic or display is glitchy

**Solutions**:

1. Try resizing your terminal window
2. Update your terminal emulator to the latest version
3. Try disabling icons or dates in the config:
   ```json
   {
     "display": {
       "showIcons": false,
       "showDates": false
     }
   }
   ```

#### Performance Issues with Large Buckets

**Problem**: open-s3 is slow when working with buckets containing many entries

**Solutions**:

1. Use pagination (the app supports page-up/page-down with `p` and `n`)
2. Use search mode (`/`) to filter entries
3. Consider using a smaller bucket or prefix for operations
4. Check your AWS region and network connectivity

### Getting Help

If you encounter an issue not listed here:

1. Check the [GitHub Issues](https://github.com/yourusername/open-s3/issues)
2. Enable verbose logging (if available)
3. Report with details about your environment:
   - Bun version (`bun --version`)
   - Terminal emulator and version
   - AWS region and bucket size
   - Configuration file (remove sensitive data)

## Roadmap

- [ ] Visual file preview pane
- [ ] Recursive directory operations
- [ ] Copy/paste operations (already have clipboard, expand with move)
- [ ] Multi-file rename/move
- [ ] Advanced search and filter (regex support added, more filters)
- [ ] Configuration GUI
- [ ] Integration tests with LocalStack
- [ ] Performance optimizations for large buckets
- [ ] S3 versioning support
- [ ] Tagging interface

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Run `bun test` to ensure all tests pass
5. Submit a pull request

## License

MIT

## Acknowledgments

- Inspired by [oil.nvim](https://github.com/stevearc/oil.nvim)
- Built with [Bun](https://bun.sh/) and [OpenTUI](https://github.com/opentui/opentui)
- Uses [AWS SDK for JavaScript v3](https://github.com/aws/aws-sdk-js-v3)
