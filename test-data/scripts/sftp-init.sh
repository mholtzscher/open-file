#!/bin/sh
# SFTP server initialization script
# Creates sample directories and files for testing open-file SFTP provider

# Don't exit on error - some operations may fail on read-only mounts
# set -e

echo "=== Initializing SFTP Test Data ==="

# Wait for the user to be fully created
sleep 2

DATA_DIR="/home/testuser/data"

# Ensure data directory exists with correct permissions
mkdir -p "$DATA_DIR"

# Use numeric uid/gid (1000:1000) as specified in docker-compose
chown 1000:1000 "$DATA_DIR"

# ============================================================================
# Create Test Directory Structure
# ============================================================================

echo "Creating test directories..."

mkdir -p "$DATA_DIR/documents"
mkdir -p "$DATA_DIR/documents/reports"
mkdir -p "$DATA_DIR/documents/contracts"
mkdir -p "$DATA_DIR/images"
mkdir -p "$DATA_DIR/backups"
mkdir -p "$DATA_DIR/backups/database"
mkdir -p "$DATA_DIR/logs"
mkdir -p "$DATA_DIR/empty-folder"

# ============================================================================
# Create Test Files
# ============================================================================

echo "Creating test files..."

# Root level files
echo "Hello, SFTP World!" > "$DATA_DIR/hello.txt"
echo "# SFTP Test Data

This directory contains test data for open-file SFTP integration testing.

## Structure
- documents/ - Office documents
- images/ - Image files (simulated)
- backups/ - Backup files
- logs/ - Log files
" > "$DATA_DIR/README.md"
echo '{"name": "sftp-test", "version": "1.0.0", "description": "Test configuration"}' > "$DATA_DIR/config.json"

# Documents
echo "Q1 2024 Financial Report

Revenue: \$1.2M
Expenses: \$800K
Net Income: \$400K" > "$DATA_DIR/documents/reports/q1-2024-financial.txt"

echo "Q2 2024 Financial Report

Revenue: \$1.5M
Expenses: \$900K
Net Income: \$600K" > "$DATA_DIR/documents/reports/q2-2024-financial.txt"

echo "Service Agreement v1.0

This agreement is between Party A and Party B..." > "$DATA_DIR/documents/contracts/service-agreement.txt"

echo "Non-Disclosure Agreement

Confidential information shall be protected..." > "$DATA_DIR/documents/contracts/nda-template.txt"

# Images (simulated with text placeholders)
echo "[PNG IMAGE DATA - logo.png - 1024x768]" > "$DATA_DIR/images/logo.png"
echo "[JPEG IMAGE DATA - banner.jpg - 1920x1080]" > "$DATA_DIR/images/banner.jpg"
echo "[PNG IMAGE DATA - icon.png - 64x64]" > "$DATA_DIR/images/icon.png"

# Backups
echo "-- PostgreSQL dump $(date +%Y-%m-%d) --
CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(100));
INSERT INTO users (name) VALUES ('Alice'), ('Bob'), ('Charlie');" > "$DATA_DIR/backups/database/backup-latest.sql"

echo "[MongoDB dump archive data]" > "$DATA_DIR/backups/database/mongo-dump.archive"

echo "[System configuration backup tarball]" > "$DATA_DIR/backups/system-config.tar.gz"

# Logs
echo "$(date +%Y-%m-%d) 10:00:00 INFO Application started
$(date +%Y-%m-%d) 10:00:01 INFO Connected to database
$(date +%Y-%m-%d) 10:05:00 WARN High memory usage detected
$(date +%Y-%m-%d) 10:10:00 INFO Request processed successfully
$(date +%Y-%m-%d) 10:15:00 ERROR Connection timeout to external service" > "$DATA_DIR/logs/application.log"

echo "192.168.1.1 - - [$(date +%d/%b/%Y:%H:%M:%S)] \"GET / HTTP/1.1\" 200 1234
192.168.1.2 - - [$(date +%d/%b/%Y:%H:%M:%S)] \"GET /api HTTP/1.1\" 200 567
192.168.1.3 - - [$(date +%d/%b/%Y:%H:%M:%S)] \"POST /api/data HTTP/1.1\" 201 890" > "$DATA_DIR/logs/access.log"

# ============================================================================
# Set Permissions
# ============================================================================

echo "Setting permissions..."

chown -R 1000:1000 "$DATA_DIR"
chmod -R 755 "$DATA_DIR"

# ============================================================================
# Setup SSH Keys (if provided)
# ============================================================================

SSH_KEYS_DIR="/home/testuser/.ssh/keys"
SSH_DIR="/home/testuser/.ssh"

if [ -d "$SSH_KEYS_DIR" ] && [ "$(ls -A $SSH_KEYS_DIR 2>/dev/null)" ]; then
    echo "Setting up SSH key authentication..."
    
    mkdir -p "$SSH_DIR"
    
    # Look for authorized_keys file
    if [ -f "$SSH_KEYS_DIR/authorized_keys" ]; then
        cat "$SSH_KEYS_DIR/authorized_keys" >> "$SSH_DIR/authorized_keys"
    fi
    
    # Look for any .pub files and add them
    for pubkey in "$SSH_KEYS_DIR"/*.pub; do
        if [ -f "$pubkey" ]; then
            cat "$pubkey" >> "$SSH_DIR/authorized_keys"
        fi
    done
    
    if [ -f "$SSH_DIR/authorized_keys" ]; then
        chown 1000:1000 "$SSH_DIR/authorized_keys" 2>/dev/null || true
        chmod 600 "$SSH_DIR/authorized_keys" 2>/dev/null || true
        echo "SSH key authentication configured"
    fi
    
    chown -R 1000:1000 "$SSH_DIR" 2>/dev/null || true
    chmod 700 "$SSH_DIR" 2>/dev/null || true
fi

# ============================================================================
# Summary
# ============================================================================

echo ""
echo "=== SFTP Initialization Complete ==="
echo ""
echo "Test user: testuser"
echo "Password: testpass"
echo "Data directory: /home/testuser/data"
echo ""
echo "Directory structure:"
find "$DATA_DIR" -type d | head -20
echo ""
echo "Files created:"
find "$DATA_DIR" -type f | wc -l
echo ""
echo "=== Ready for testing ==="
