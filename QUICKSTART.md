# Open-S3 Quick Start Guide

## Running the Application

### Option 1: Demo with Mock Data (No AWS Required)

```bash
just demo
```

Or directly:

```bash
bun run src/index.tsx --mock
```

This runs the app with mock data for testing the UI. No AWS credentials needed!

### Option 2: Browse All Buckets (Bucket Root View)

```bash
bun run src/index.tsx
```

Or using the config file (`~/.open-s3rc.json`):

```json
{
  "adapter": "s3",
  "s3": {
    "region": "us-east-1"
  }
}
```

This starts open-s3 at the bucket root view, showing all S3 buckets in your AWS account. Use `j`/`k` to navigate and `Enter` to enter a bucket.

**Prerequisites:**

- AWS credentials configured (via `~/.aws/credentials` or environment variables)
- IAM permissions: `s3:ListAllMyBuckets`

### Option 3: Open Specific Bucket

```bash
just s3 YOUR-BUCKET-NAME
```

With custom region:

```bash
just s3 my-bucket us-west-2
```

**Prerequisites:**

- AWS credentials configured (via `~/.aws/credentials` or environment variables)
- Appropriate S3 permissions for the bucket

### Option 4: LocalStack (Local S3 Testing)

```bash
just localstack test-bucket
```

Or directly:

```bash
bun run src/index.tsx --endpoint http://localhost:4566 --bucket test-bucket
```

## Keybindings

### Navigation

- `j` / `k` - Move down/up
- `gg` / `G` - Go to top/bottom
- `Enter` / `l` - Open directory, file, or select bucket
- `h` / `Backspace` - Go to parent directory
- `~` - Go to bucket root (when inside a bucket)
- `Ctrl+N` / `Ctrl+P` - Page down/up

### Selection & Operations

- `v` - Start visual selection
- `d` - Delete selected entries (shows confirmation)
- `q` - Quit application

### Modes

- `[NORMAL]` - Normal navigation mode
- `[VISUAL]` - Visual selection mode
- `[ROOT]` - Bucket root view (showing all buckets)

## Status Bar

The bottom of the screen shows:

- **Left:** Current path and mode
- **Right:** Status messages or help text

## Examples

### Explore all your S3 buckets

```bash
bun run src/index.tsx
```

1. See all buckets in your account with creation date and region
2. Use `j/k` to move up and down through buckets
3. Press `Enter` to enter a bucket

### Browse a specific S3 bucket

```bash
./run-s3.sh my-photos us-east-1
```

### Navigate the file tree within a bucket

1. Use `j/k` to move up and down
2. Press `Enter` to open a directory
3. Press `h` to go back to parent
4. Press `~` to go back to bucket root

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
