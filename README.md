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

- Bun >= 1.0.0
- Node.js 18+ (optional, for npm compatibility)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/open-s3.git
cd open-s3

# Install dependencies
bun install

# Run the application
bun run src/index.ts
```

## Usage

### Navigation (Normal Mode)

| Key | Action |
|-----|--------|
| `j` | Move cursor down |
| `k` | Move cursor up |
| `g` | Move to top |
| `G` | Move to bottom |
| `Enter` / `l` | Open file/directory |
| `h` / `Backspace` | Go to parent directory |
| `q` | Quit application |

### Editing (Visual Mode)

| Key | Action |
|-----|--------|
| `v` | Enter visual mode (start selection) |
| `j` / `k` | Extend selection |
| `d` | Delete selected entries |
| `Escape` | Exit visual mode |

### Operations

| Key | Action |
|-----|--------|
| `i` / `a` | Enter edit mode |
| `w` | Save changes (shows confirmation) |
| `Escape` | Cancel edits |

## Configuration

Configuration file: `~/.open-s3rc.json`

### Example Configuration

```json
{
  "adapter": "s3",
  "s3": {
    "region": "us-east-1",
    "bucket": "my-bucket",
    "endpoint": "https://s3.amazonaws.com"
  },
  "display": {
    "showIcons": true,
    "showSizes": true,
    "showDates": false
  },
  "colors": {
    "cursor": "#FFFF00",
    "selection": "#00FF00",
    "directory": "#0080FF",
    "error": "#FF0000"
  }
}
```

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

## Roadmap

- [ ] Visual file preview pane
- [ ] Recursive directory operations
- [ ] Copy/paste operations
- [ ] Multi-select operations
- [ ] Search and filter
- [ ] Undo/redo support
- [ ] Configuration GUI
- [ ] Integration tests with LocalStack

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
