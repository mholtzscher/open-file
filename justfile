# Justfile for open-s3 development

# Default recipe to display help
default:
    @just --list

# Install dependencies
install:
    bun install

# Build TypeScript to JavaScript (optional with Bun - can run .ts directly)
build:
    bun build src/index.tsx --outdir dist --target bun

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

# Format code (placeholder for when we add prettier)
fmt:
    @echo "Code formatting not yet configured"

# Run tests
test:
    bun test

# Run tests in watch mode
test-watch:
    bun test --watch

# Run linting (placeholder for when we add eslint)
lint:
    @echo "Linting not yet configured"

# Test React components specifically
test-react:
    bun test src/**/*react*.test.ts

# Show project info
info:
    @echo "Project: open-s3"
    @echo "Bun version: $(bun --version)"
    @echo "TypeScript version: $(bun run --no-install tsc --version)"

# Quick development cycle: clean, install, run
quick: clean install run

# Run with mock adapter (for testing without S3)
run-mock:
    bun run src/index.tsx --adapter mock

# Check for ready work items using bd
bd-status:
    bd ready --json | jq 'length' && bd list --json | jq '[.[] | select(.status == "closed")] | length'

# Show React migration progress
migration-status:
    @echo "=== React Migration Status ==="
    @bd ready --json | jq '.[] | {id, title}' | head -20

# Development with type checking and running
dev-check: check
    bun run --watch src/index.tsx
