# open-s3

A Terminal User Interface (TUI) for exploring and managing AWS S3 buckets, inspired by oil.nvim's buffer-as-editor approach.

## Features

- 🗂️ **Browse S3 buckets** - Navigate through S3 buckets like a file system
- ✏️ **Edit as buffer** - Edit bucket contents like a text buffer (create, delete, rename, move)
- 🎨 **Beautiful UI** - Color-coded entries, vim-style keybindings
- 🔄 **Multiple adapters** - Support for S3 and mock adapter for testing
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

   Option B - Create config file (`~/.open-s3rc.json`):
   ```json
   {
     "adapter": "s3",
     "s3": {
       "region": "us-east-1",
       "bucket": "my-bucket"
     }
   }
   ```

   Option C - Use AWS CLI configuration:
   ```bash
   aws configure
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

### Navigating Buckets

When you start open-s3, you'll see a list of entries (files and directories) in your bucket. Here's how to navigate:

1. **Move around** - Use `j` and `k` to move cursor down and up
2. **Enter a directory** - Press `Enter` or `l` to open a directory
3. **Go back** - Press `h` or `Backspace` to go to the parent directory
4. **Jump to top** - Press `gg` (press 'g' twice) to jump to the top
5. **Jump to bottom** - Press `G` (capital G) to jump to the bottom

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

| Key | Action |
|-----|--------|
| `j` | Move cursor down |
| `k` | Move cursor up |
| `gg` | Move to top |
| `G` | Move to bottom |
| `n` | Page down (next page) |
| `p` | Page up (previous page) |
| `Enter` / `l` | Open file/directory |
| `h` / `Backspace` | Go to parent directory |
| `i` | **Create new entry** |
| `a` | Edit mode |
| `dd` | **Delete entry at cursor** |
| `v` | Start visual selection |
| `c` | Copy selected entry to clipboard |
| `P` | Paste after cursor |
| `w` | Save changes (confirm operations) |
| `/` | Enter search mode |
| `u` | Undo last change |
| `Ctrl+r` | Redo last change |
| `q` | Quit application |

### Visual Mode

| Key | Action |
|-----|--------|
| `j` | Extend selection down |
| `k` | Extend selection up |
| `d` | Delete selected entries |
| `Escape` | Exit visual mode |

### Insert Mode (Creating Entries)

| Key | Action |
|-----|--------|
| Any character | Type entry name |
| `Backspace` | Delete last character |
| `Tab` | Apply first auto-completion suggestion |
| `Enter` | Confirm entry creation |
| `Escape` | Cancel entry creation |

### Search Mode

| Key | Action |
|-----|--------|
| Any character | Add to search query |
| `Backspace` | Delete last character |
| `Ctrl+c` | Toggle case-sensitive search |
| `Ctrl+r` | Toggle regex matching |
| `Escape` | Exit search mode |

## Configuration

Configuration file: `~/.open-s3rc.json`

The configuration file allows you to customize how open-s3 behaves and appears. Here are the available options:

### Configuration Options

```json
{
  "adapter": "s3",
  "s3": {
    "region": "us-east-1",
    "bucket": "my-bucket",
    "endpoint": "https://s3.amazonaws.com",
    "accessKeyId": "optional-key",
    "secretAccessKey": "optional-secret"
  },
  "display": {
    "showIcons": true,
    "showSizes": true,
    "showDates": false,
    "defaultSort": "name"
  },
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

### Configuration Examples

#### Minimal Configuration (Uses All Defaults)

```json
{
  "adapter": "s3",
  "s3": {
    "region": "us-east-1",
    "bucket": "my-bucket"
  }
}
```

#### Full Configuration with Custom Keybindings

```json
{
  "adapter": "s3",
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
  "adapter": "s3",
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

### Configuration Locations

open-s3 looks for configuration in this order:

1. `~/.open-s3rc.json` - User configuration file
2. `./.open-s3rc.json` - Local project configuration
3. Environment variables - AWS credentials from environment
4. `~/.aws/credentials` - Standard AWS credentials file

## Architecture

The application follows a clean, modular architecture:

### Adapters (`src/adapters/`)
- **Adapter Interface** - Abstract interface for storage backends
- **MockAdapter** - In-memory adapter for testing
- **S3Adapter** - AWS S3 implementation using SDK v3
- **AdapterRegistry** - Registry for managing multiple adapters

### UI Components (`src/ui/`)
- **BufferState** - Manages editor state (entries, selection, mode)
- **BufferView** - Renders entries as editable buffer
- **ConfirmationDialog** - Confirmation for operations

### Utilities (`src/utils/`)
- **Change Detection** - Detects creates, deletes, moves, renames
- **Entry ID Management** - Tracks entries across buffer edits
- **Configuration** - Manages user preferences
- **Path Utilities** - Path manipulation helpers

### Types (`src/types/`)
- **Entry** - Represents files/directories
- **Operations** - Create, Delete, Move, Copy operations
- **AdapterOperations** - Type definitions for adapter operations

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

All tests must pass:

```bash
src/adapters/adapter.test.ts - 11 tests
src/utils/change-detection.test.ts - 12 tests
```

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
│   ├── adapters/          # Storage backends
│   │   ├── adapter.ts     # Base adapter interface
│   │   ├── mock-adapter.ts
│   │   ├── s3-adapter.ts
│   │   └── registry.ts
│   ├── ui/                # UI components
│   │   ├── buffer-state.ts
│   │   ├── buffer-view.ts
│   │   └── confirmation-dialog.ts
│   ├── types/             # Type definitions
│   │   ├── entry.ts
│   │   └── operations.ts
│   ├── utils/             # Utilities
│   │   ├── change-detection.ts
│   │   ├── entry-id.ts
│   │   ├── config.ts
│   │   └── path-utils.ts
│   └── index.ts           # Main application
├── justfile               # Development commands
├── package.json           # Dependencies
├── tsconfig.json          # TypeScript configuration
└── README.md              # This file
```

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

2. **Configuration File** (`~/.open-s3rc.json`)
   ```json
   {
     "s3": {
       "accessKeyId": "your-key",
       "secretAccessKey": "your-secret",
       "region": "us-east-1"
     }
   }
   ```

3. **AWS Credentials File** (`~/.aws/credentials`)
   - Standard AWS credentials file

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

2. If using config file, verify credentials are correct:
   ```bash
   cat ~/.open-s3rc.json
   ```

3. Ensure your IAM user has S3 permissions:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3:*"
         ],
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
