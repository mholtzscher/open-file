# Justfile for open-file development

# Default recipe to display help
default:
    @echo "Open-File - Terminal UI for cloud storage"
    @echo ""
    @echo "Quick Start:"
    @echo "  just demo              - Run with mock data (no AWS required)"
    @echo "  just s3                - Browse all S3 buckets (root view)"
    @echo "  just s3 my-bucket      - Connect to specific S3 bucket"
    @echo "  just s3 my-bucket us-west-2  - Specify region"
    @echo ""
    @echo "Installation:"
    @echo "  just install-global    - Build and install binary to ~/.local/bin"
    @echo "  just uninstall-global  - Remove installed binary"
    @echo ""
    @echo "All available commands:"
    @just --list

# Install dependencies
install:
    bun install

# Build TypeScript to JavaScript (optional with Bun - can run .ts directly)
build:
    bun build src/index.tsx --outdir dist --target bun

# Build and install standalone binary to ~/.local/bin
install-global:
    @echo "Building standalone executable..."
    bun build src/index.tsx --compile --outfile=open-file
    @echo "Installing to ~/.local/bin..."
    mv open-file ~/.local/bin/
    chmod +x ~/.local/bin/open-file
    @echo ""
    @echo "✓ open-file installed successfully!"
    @echo "Location: $(which open-file)"
    @echo ""
    @echo "Try it with: open-file --help"

# Uninstall global binary
uninstall-global:
    @echo "Removing open-file from ~/.local/bin..."
    rm -f ~/.local/bin/open-file
    @echo "✓ open-file uninstalled"

# Run in watch mode for development
dev:
    bun run --watch src/index.tsx

# Run the application directly (no build needed with Bun!)
run:
    bun run src/index.tsx

# Clean build artifacts
clean:
    rm -rf dist/
    rm -rf node_modules/.cache/

# Full clean including node_modules
clean-all:
    rm -rf dist/
    rm -rf node_modules/

# Reinstall dependencies from scratch
reinstall: clean-all install

# Check TypeScript types
check:
    bun run --no-install tsc --noEmit

# Check TypeScript types with React JSX
check-jsx:
    bun run --no-install tsc --noEmit --skipLibCheck

# Format code with Prettier
fmt:
    bun run prettier --write .

# Check code formatting with Prettier
fmt-check:
    bun run prettier --check .

# Run tests
test:
    bun test

# Run tests in watch mode
test-watch:
    bun test --watch

# Run linting (matches CI lint job)
lint:
    bunx tsc --noEmit --skipLibCheck
    bunx biome check --write src/ || echo "Biome checks skipped"

# Test React components specifically
test-react:
    bun test src/**/*react*.test.ts

# Show project info
info:
    @echo "Project: open-file"
    @echo "Bun version: $(bun --version)"
    @echo "TypeScript version: $(bun run --no-install tsc --version)"

# Quick development cycle: clean, install, run
quick: clean install run

# Run demo with mock data (no AWS required)
demo:
    @echo "Starting open-file with mock data..."
    @echo "Press 'q' to quit"
    @echo ""
    bun run src/index.tsx --mock

# Run with mock adapter (alias for demo)
run-mock: demo

# Run with real S3 (shows all buckets if no bucket specified)
s3 BUCKET="" REGION="us-east-1":
    @if [ -z "{{BUCKET}}" ]; then \
        echo "Starting open-file - showing all S3 buckets (root view)"; \
        echo "Use vim keybindings to navigate, Enter to select a bucket"; \
        echo "Press 'q' to quit"; \
        echo ""; \
        bun run src/index.tsx --region {{REGION}}; \
    else \
        echo "Starting open-file with bucket: {{BUCKET}} in region: {{REGION}}"; \
        echo "Using AWS credentials from environment"; \
        echo "Press 'q' to quit"; \
        echo ""; \
        bun run src/index.tsx --bucket {{BUCKET}} --region {{REGION}}; \
    fi

# Run with LocalStack (local S3 testing) - shows all buckets if no bucket specified
localstack BUCKET="":
    @if [ -z "{{BUCKET}}" ]; then \
        echo "Starting open-file with LocalStack - showing all buckets"; \
        echo "Endpoint: http://localhost:4566"; \
        echo ""; \
        bun run src/index.tsx --endpoint http://localhost:4566; \
    else \
        echo "Starting open-file with LocalStack..."; \
        echo "Bucket: {{BUCKET}}"; \
        echo "Endpoint: http://localhost:4566"; \
        echo ""; \
        bun run src/index.tsx --endpoint http://localhost:4566 --bucket {{BUCKET}}; \
    fi

# Development with type checking and running
dev-check: check
    bun run --watch src/index.tsx

# Run all tests and type checking
ci: check test
    @echo "✓ All checks passed!"

# Quick test - run tests and show summary
t:
    @bun test 2>&1 | tail -5

# Show version and help
help:
    bun run src/index.tsx --help

# Show version
version:
    bun run src/index.tsx --version
