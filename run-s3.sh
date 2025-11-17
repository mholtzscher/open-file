#!/bin/bash
# Run with real S3 bucket (uses AWS credentials from environment)
if [ -z "$1" ]; then
  echo "Usage: ./run-s3.sh BUCKET_NAME [REGION]"
  echo "Example: ./run-s3.sh my-bucket us-east-1"
  exit 1
fi

BUCKET=$1
REGION=${2:-us-east-1}

echo "Starting open-s3 with bucket: $BUCKET in region: $REGION"
echo "Using AWS credentials from environment"
echo "Press 'q' to quit"
echo ""
bun run src/index.tsx --adapter s3 --bucket "$BUCKET" --region "$REGION"
