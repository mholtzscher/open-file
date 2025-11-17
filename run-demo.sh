#!/bin/bash
# Quick demo with mock adapter
echo "Starting open-s3 with mock adapter..."
echo "Press 'q' to quit"
echo ""
bun run src/index.tsx --mock
