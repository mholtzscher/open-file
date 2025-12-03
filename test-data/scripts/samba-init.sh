#!/bin/bash
# Initialize test data for SMB testing

SHARE_DIR="/share"

# Create test directories
mkdir -p "$SHARE_DIR/documents"
mkdir -p "$SHARE_DIR/photos"
mkdir -p "$SHARE_DIR/nested/deep/path"

# Create test files
echo "Hello from SMB!" > "$SHARE_DIR/hello.txt"
echo "This is a test document." > "$SHARE_DIR/documents/readme.txt"
echo "Another file for testing." > "$SHARE_DIR/documents/notes.txt"
echo "Photo metadata here." > "$SHARE_DIR/photos/info.txt"
echo "Deep nested file." > "$SHARE_DIR/nested/deep/path/file.txt"

# Create a larger test file (1KB)
dd if=/dev/urandom bs=1024 count=1 2>/dev/null | base64 > "$SHARE_DIR/random.bin"

# Set permissions
chmod -R 777 "$SHARE_DIR"

echo "SMB test data initialized successfully."
