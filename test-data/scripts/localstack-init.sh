#!/bin/bash
# LocalStack S3 initialization script
# Creates sample buckets, folders, and objects for testing open-file

set -e

echo "=== Initializing LocalStack S3 ==="

# Wait for S3 to be ready
echo "Waiting for S3 service..."
awslocal s3 ls 2>/dev/null || sleep 2

# ============================================================================
# Create Buckets
# ============================================================================

echo "Creating buckets..."

awslocal s3 mb s3://test-bucket
awslocal s3 mb s3://documents
awslocal s3 mb s3://media-files
awslocal s3 mb s3://backups
awslocal s3 mb s3://logs

echo "Created 5 buckets"

# ============================================================================
# Bucket: test-bucket (general testing)
# ============================================================================

echo "Populating test-bucket..."

# Root level files
echo "Hello, World!" | awslocal s3 cp - s3://test-bucket/hello.txt
echo "# README\n\nThis is a test bucket for open-file development." | awslocal s3 cp - s3://test-bucket/README.md
echo '{"name": "test", "version": "1.0.0"}' | awslocal s3 cp - s3://test-bucket/config.json

# Create folders with files
echo "File in folder A" | awslocal s3 cp - s3://test-bucket/folder-a/file1.txt
echo "Another file in folder A" | awslocal s3 cp - s3://test-bucket/folder-a/file2.txt
echo "Nested file" | awslocal s3 cp - s3://test-bucket/folder-a/nested/deep-file.txt

echo "File in folder B" | awslocal s3 cp - s3://test-bucket/folder-b/data.csv
echo '{"items": [1, 2, 3]}' | awslocal s3 cp - s3://test-bucket/folder-b/items.json

# Empty folder (just a marker)
echo "" | awslocal s3 cp - s3://test-bucket/empty-folder/.keep

# ============================================================================
# Bucket: documents (office-style documents)
# ============================================================================

echo "Populating documents bucket..."

# Reports folder
echo "Q1 2024 Financial Report\n\nRevenue: \$1.2M\nExpenses: \$800K" | awslocal s3 cp - s3://documents/reports/q1-2024-financial.txt
echo "Q2 2024 Financial Report\n\nRevenue: \$1.5M\nExpenses: \$900K" | awslocal s3 cp - s3://documents/reports/q2-2024-financial.txt
echo "Annual Summary 2023" | awslocal s3 cp - s3://documents/reports/annual-2023.txt

# Contracts folder
echo "Service Agreement v1.0" | awslocal s3 cp - s3://documents/contracts/service-agreement.txt
echo "NDA Template" | awslocal s3 cp - s3://documents/contracts/nda-template.txt
echo "Employment Contract" | awslocal s3 cp - s3://documents/contracts/employment/standard-contract.txt

# Policies folder
echo "Employee Handbook v2.1" | awslocal s3 cp - s3://documents/policies/employee-handbook.txt
echo "Remote Work Policy" | awslocal s3 cp - s3://documents/policies/remote-work.txt
echo "Security Policy" | awslocal s3 cp - s3://documents/policies/security/data-protection.txt

# ============================================================================
# Bucket: media-files (images, videos, audio simulation)
# ============================================================================

echo "Populating media-files bucket..."

# Images folder (simulated with text placeholders)
echo "[PNG IMAGE DATA - logo.png]" | awslocal s3 cp - s3://media-files/images/logo.png --content-type "image/png"
echo "[JPEG IMAGE DATA - banner.jpg]" | awslocal s3 cp - s3://media-files/images/banner.jpg --content-type "image/jpeg"
echo "[PNG IMAGE DATA - icon.png]" | awslocal s3 cp - s3://media-files/images/icons/icon.png --content-type "image/png"
echo "[SVG IMAGE DATA]" | awslocal s3 cp - s3://media-files/images/icons/logo.svg --content-type "image/svg+xml"

# Photos subfolder
echo "[JPEG - vacation photo 1]" | awslocal s3 cp - s3://media-files/images/photos/vacation-001.jpg --content-type "image/jpeg"
echo "[JPEG - vacation photo 2]" | awslocal s3 cp - s3://media-files/images/photos/vacation-002.jpg --content-type "image/jpeg"
echo "[JPEG - vacation photo 3]" | awslocal s3 cp - s3://media-files/images/photos/vacation-003.jpg --content-type "image/jpeg"

# Videos folder
echo "[MP4 VIDEO DATA - intro.mp4]" | awslocal s3 cp - s3://media-files/videos/intro.mp4 --content-type "video/mp4"
echo "[MP4 VIDEO DATA - tutorial.mp4]" | awslocal s3 cp - s3://media-files/videos/tutorials/getting-started.mp4 --content-type "video/mp4"

# Audio folder  
echo "[MP3 AUDIO DATA - podcast.mp3]" | awslocal s3 cp - s3://media-files/audio/podcast-ep1.mp3 --content-type "audio/mpeg"
echo "[WAV AUDIO DATA - notification.wav]" | awslocal s3 cp - s3://media-files/audio/sounds/notification.wav --content-type "audio/wav"

# ============================================================================
# Bucket: backups (database and system backups)
# ============================================================================

echo "Populating backups bucket..."

# Database backups
echo "-- PostgreSQL dump 2024-01-15 --\nCREATE TABLE users..." | awslocal s3 cp - s3://backups/database/postgres/backup-2024-01-15.sql
echo "-- PostgreSQL dump 2024-01-16 --\nCREATE TABLE users..." | awslocal s3 cp - s3://backups/database/postgres/backup-2024-01-16.sql
echo "-- PostgreSQL dump 2024-01-17 --\nCREATE TABLE users..." | awslocal s3 cp - s3://backups/database/postgres/backup-2024-01-17.sql

echo "[MongoDB dump data]" | awslocal s3 cp - s3://backups/database/mongodb/dump-2024-01-15.archive
echo "[MongoDB dump data]" | awslocal s3 cp - s3://backups/database/mongodb/dump-2024-01-16.archive

# System backups
echo "[System config backup]" | awslocal s3 cp - s3://backups/system/config-backup-2024-01.tar.gz
echo "[System config backup]" | awslocal s3 cp - s3://backups/system/config-backup-2024-02.tar.gz

# Application backups
echo "[App data export]" | awslocal s3 cp - s3://backups/applications/app1/data-export-2024-01-15.json
echo "[App data export]" | awslocal s3 cp - s3://backups/applications/app1/data-export-2024-01-16.json
echo "[App data export]" | awslocal s3 cp - s3://backups/applications/app2/full-backup-2024-01.zip

# ============================================================================
# Bucket: logs (application and system logs)
# ============================================================================

echo "Populating logs bucket..."

# Application logs
echo "2024-01-15 10:00:00 INFO Application started\n2024-01-15 10:00:01 INFO Connected to database" | awslocal s3 cp - s3://logs/application/web-server/2024-01-15.log
echo "2024-01-16 10:00:00 INFO Application started\n2024-01-16 10:05:00 WARN High memory usage" | awslocal s3 cp - s3://logs/application/web-server/2024-01-16.log
echo "2024-01-17 10:00:00 INFO Application started\n2024-01-17 12:00:00 ERROR Connection timeout" | awslocal s3 cp - s3://logs/application/web-server/2024-01-17.log

echo "2024-01-15 Worker started\n2024-01-15 Processing job 1234" | awslocal s3 cp - s3://logs/application/worker/2024-01-15.log
echo "2024-01-16 Worker started\n2024-01-16 Processing job 1235" | awslocal s3 cp - s3://logs/application/worker/2024-01-16.log

# Access logs
echo '192.168.1.1 - - [15/Jan/2024:10:00:00] "GET / HTTP/1.1" 200 1234' | awslocal s3 cp - s3://logs/access/2024-01-15-access.log
echo '192.168.1.2 - - [16/Jan/2024:10:00:00] "GET /api HTTP/1.1" 200 567' | awslocal s3 cp - s3://logs/access/2024-01-16-access.log

# Error logs
echo "2024-01-15 10:30:00 ERROR NullPointerException at line 42" | awslocal s3 cp - s3://logs/errors/2024-01-15-errors.log
echo "2024-01-16 14:20:00 ERROR Database connection failed" | awslocal s3 cp - s3://logs/errors/2024-01-16-errors.log

# ============================================================================
# Summary
# ============================================================================

echo ""
echo "=== LocalStack S3 Initialization Complete ==="
echo ""
echo "Buckets created:"
awslocal s3 ls

echo ""
echo "Sample bucket contents (test-bucket):"
awslocal s3 ls s3://test-bucket --recursive

echo ""
echo "=== Ready for testing ==="
echo "Endpoint: http://localhost:4566"
echo "Use AWS CLI with: aws --endpoint-url=http://localhost:4566 s3 ls"
