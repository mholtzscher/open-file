#!/bin/bash
# Fake GCS Server initialization script
# Creates sample buckets and objects for testing open-s3

set -e

GCS_URL="${GCS_URL:-http://localhost:4443}"

echo "=== Initializing Fake GCS Server ==="
echo "Endpoint: $GCS_URL"

# Wait for GCS to be ready
echo "Waiting for GCS service..."
until curl -sf "$GCS_URL/storage/v1/b" > /dev/null 2>&1; do
  sleep 1
done

# ============================================================================
# Helper function to create a bucket
# ============================================================================
create_bucket() {
  local bucket_name=$1
  curl -sf -X POST "$GCS_URL/storage/v1/b?project=test-project" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$bucket_name\"}" > /dev/null || true
  echo "  Created bucket: $bucket_name"
}

# ============================================================================
# Helper function to upload an object
# ============================================================================
upload_object() {
  local bucket=$1
  local object_path=$2
  local content=$3
  local content_type=${4:-"text/plain"}
  
  # URL encode the object path
  local encoded_path=$(echo -n "$object_path" | sed 's|/|%2F|g')
  
  curl -sf -X POST "$GCS_URL/upload/storage/v1/b/$bucket/o?uploadType=media&name=$object_path" \
    -H "Content-Type: $content_type" \
    -d "$content" > /dev/null
}

# ============================================================================
# Create Buckets
# ============================================================================

echo "Creating buckets..."

create_bucket "test-bucket"
create_bucket "documents"
create_bucket "media-files"
create_bucket "backups"
create_bucket "logs"

echo "Created 5 buckets"

# ============================================================================
# Bucket: test-bucket (general testing)
# ============================================================================

echo "Populating test-bucket..."

# Root level files
upload_object "test-bucket" "hello.txt" "Hello, World!"
upload_object "test-bucket" "README.md" "# README

This is a test bucket for open-s3 development."
upload_object "test-bucket" "config.json" '{"name": "test", "version": "1.0.0"}' "application/json"

# Create folders with files
upload_object "test-bucket" "folder-a/file1.txt" "File in folder A"
upload_object "test-bucket" "folder-a/file2.txt" "Another file in folder A"
upload_object "test-bucket" "folder-a/nested/deep-file.txt" "Nested file"

upload_object "test-bucket" "folder-b/data.csv" "name,value
item1,100
item2,200"
upload_object "test-bucket" "folder-b/items.json" '{"items": [1, 2, 3]}' "application/json"

# Empty folder (just a marker)
upload_object "test-bucket" "empty-folder/.keep" ""

# ============================================================================
# Bucket: documents (office-style documents)
# ============================================================================

echo "Populating documents bucket..."

# Reports folder
upload_object "documents" "reports/q1-2024-financial.txt" "Q1 2024 Financial Report

Revenue: \$1.2M
Expenses: \$800K"
upload_object "documents" "reports/q2-2024-financial.txt" "Q2 2024 Financial Report

Revenue: \$1.5M
Expenses: \$900K"
upload_object "documents" "reports/annual-2023.txt" "Annual Summary 2023"

# Contracts folder
upload_object "documents" "contracts/service-agreement.txt" "Service Agreement v1.0"
upload_object "documents" "contracts/nda-template.txt" "NDA Template"
upload_object "documents" "contracts/employment/standard-contract.txt" "Employment Contract"

# Policies folder
upload_object "documents" "policies/employee-handbook.txt" "Employee Handbook v2.1"
upload_object "documents" "policies/remote-work.txt" "Remote Work Policy"
upload_object "documents" "policies/security/data-protection.txt" "Security Policy"

# ============================================================================
# Bucket: media-files (images, videos, audio simulation)
# ============================================================================

echo "Populating media-files bucket..."

# Images folder (simulated with text placeholders)
upload_object "media-files" "images/logo.png" "[PNG IMAGE DATA - logo.png]" "image/png"
upload_object "media-files" "images/banner.jpg" "[JPEG IMAGE DATA - banner.jpg]" "image/jpeg"
upload_object "media-files" "images/icons/icon.png" "[PNG IMAGE DATA - icon.png]" "image/png"
upload_object "media-files" "images/icons/logo.svg" "[SVG IMAGE DATA]" "image/svg+xml"

# Photos subfolder
upload_object "media-files" "images/photos/vacation-001.jpg" "[JPEG - vacation photo 1]" "image/jpeg"
upload_object "media-files" "images/photos/vacation-002.jpg" "[JPEG - vacation photo 2]" "image/jpeg"
upload_object "media-files" "images/photos/vacation-003.jpg" "[JPEG - vacation photo 3]" "image/jpeg"

# Videos folder
upload_object "media-files" "videos/intro.mp4" "[MP4 VIDEO DATA - intro.mp4]" "video/mp4"
upload_object "media-files" "videos/tutorials/getting-started.mp4" "[MP4 VIDEO DATA - tutorial.mp4]" "video/mp4"

# Audio folder  
upload_object "media-files" "audio/podcast-ep1.mp3" "[MP3 AUDIO DATA - podcast.mp3]" "audio/mpeg"
upload_object "media-files" "audio/sounds/notification.wav" "[WAV AUDIO DATA - notification.wav]" "audio/wav"

# ============================================================================
# Bucket: backups (database and system backups)
# ============================================================================

echo "Populating backups bucket..."

# Database backups
upload_object "backups" "database/postgres/backup-2024-01-15.sql" "-- PostgreSQL dump 2024-01-15 --
CREATE TABLE users..."
upload_object "backups" "database/postgres/backup-2024-01-16.sql" "-- PostgreSQL dump 2024-01-16 --
CREATE TABLE users..."
upload_object "backups" "database/postgres/backup-2024-01-17.sql" "-- PostgreSQL dump 2024-01-17 --
CREATE TABLE users..."

upload_object "backups" "database/mongodb/dump-2024-01-15.archive" "[MongoDB dump data]"
upload_object "backups" "database/mongodb/dump-2024-01-16.archive" "[MongoDB dump data]"

# System backups
upload_object "backups" "system/config-backup-2024-01.tar.gz" "[System config backup]"
upload_object "backups" "system/config-backup-2024-02.tar.gz" "[System config backup]"

# Application backups
upload_object "backups" "applications/app1/data-export-2024-01-15.json" "[App data export]" "application/json"
upload_object "backups" "applications/app1/data-export-2024-01-16.json" "[App data export]" "application/json"
upload_object "backups" "applications/app2/full-backup-2024-01.zip" "[App data export]" "application/zip"

# ============================================================================
# Bucket: logs (application and system logs)
# ============================================================================

echo "Populating logs bucket..."

# Application logs
upload_object "logs" "application/web-server/2024-01-15.log" "2024-01-15 10:00:00 INFO Application started
2024-01-15 10:00:01 INFO Connected to database"
upload_object "logs" "application/web-server/2024-01-16.log" "2024-01-16 10:00:00 INFO Application started
2024-01-16 10:05:00 WARN High memory usage"
upload_object "logs" "application/web-server/2024-01-17.log" "2024-01-17 10:00:00 INFO Application started
2024-01-17 12:00:00 ERROR Connection timeout"

upload_object "logs" "application/worker/2024-01-15.log" "2024-01-15 Worker started
2024-01-15 Processing job 1234"
upload_object "logs" "application/worker/2024-01-16.log" "2024-01-16 Worker started
2024-01-16 Processing job 1235"

# Access logs
upload_object "logs" "access/2024-01-15-access.log" '192.168.1.1 - - [15/Jan/2024:10:00:00] "GET / HTTP/1.1" 200 1234'
upload_object "logs" "access/2024-01-16-access.log" '192.168.1.2 - - [16/Jan/2024:10:00:00] "GET /api HTTP/1.1" 200 567'

# Error logs
upload_object "logs" "errors/2024-01-15-errors.log" "2024-01-15 10:30:00 ERROR NullPointerException at line 42"
upload_object "logs" "errors/2024-01-16-errors.log" "2024-01-16 14:20:00 ERROR Database connection failed"

# ============================================================================
# Summary
# ============================================================================

echo ""
echo "=== Fake GCS Server Initialization Complete ==="
echo ""
echo "Buckets created:"
curl -sf "$GCS_URL/storage/v1/b" | grep -o '"name":"[^"]*"' | cut -d'"' -f4 | while read bucket; do
  echo "  - $bucket"
done

echo ""
echo "=== Ready for testing ==="
echo "Endpoint: $GCS_URL"
echo "Project: test-project"
