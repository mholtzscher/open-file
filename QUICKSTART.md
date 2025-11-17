# Open-S3 Quick Start Guide

## Running the Application

### Option 1: Demo with Mock Data (No AWS Required)

```bash
./run-demo.sh
```

This runs the app with mock data for testing the UI.

### Option 2: Real S3 Bucket

```bash
./run-s3.sh YOUR-BUCKET-NAME [REGION]
```

Example:
```bash
./run-s3.sh my-bucket us-west-2
```

**Prerequisites:**
- AWS credentials configured (via `~/.aws/credentials` or environment variables)
- Appropriate S3 permissions for the bucket

### Option 3: LocalStack (Local S3 Testing)

```bash
bun run src/index.tsx --endpoint http://localhost:4566 --bucket test-bucket
```

## Keybindings

### Navigation
- `j` / `k` - Move down/up
- `g` / `G` - Go to top/bottom
- `Enter` / `l` - Open directory or file
- `h` / `Backspace` - Go to parent directory
- `Ctrl+N` / `Ctrl+P` - Page down/up

### Selection & Operations
- `v` - Start visual selection
- `d` - Delete selected entries (shows confirmation)
- `q` - Quit application

### Modes
- `[NORMAL]` - Normal navigation mode
- `[VISUAL]` - Visual selection mode

## Status Bar

The bottom of the screen shows:
- **Left:** Current path and mode
- **Right:** Status messages or help text

## Examples

### Browse your S3 bucket
```bash
./run-s3.sh my-photos us-east-1
```

### Navigate the file tree
1. Use `j/k` to move up and down
2. Press `Enter` to open a directory
3. Press `h` to go back to parent

### Delete files
1. Move cursor to file with `j/k`
2. Press `v` to enter visual mode
3. Select more files with `j/k` if needed
4. Press `d` to delete (will ask for confirmation)

## Troubleshooting

### "Access Denied" errors
Make sure your AWS credentials have permissions:
- `s3:ListBucket`
- `s3:GetObject`
- `s3:DeleteObject`
- `s3:PutObject`

### Can't see the cursor
The cursor is the `>` symbol on the left side of the selected line.

### Application won't start
1. Check that you have Bun installed: `bun --version`
2. Install dependencies: `bun install`
3. Try the mock adapter first: `./run-demo.sh`
