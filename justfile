# Justfile for open-s3 development

# Default recipe to display help
default:
    @just --list

# Install dependencies
install:
    bun install

# Build TypeScript to JavaScript (optional with Bun - can run .ts directly)
build:
    bun build src/index.ts --outdir dist --target bun

# Run in watch mode for development
dev:
    bun run --watch src/index.ts

# Run the application directly (no build needed with Bun!)
run:
    bun run src/index.ts

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

# Format code (placeholder for when we add prettier)
fmt:
    @echo "Code formatting not yet configured"

# Run tests
test:
    bun test

# Run linting (placeholder for when we add eslint)
lint:
    @echo "Linting not yet configured"

# Show project info
info:
    @echo "Project: open-s3"
    @echo "Bun version: $(bun --version)"
    @echo "TypeScript version: $(bun run --no-install tsc --version)"

# Quick development cycle: clean, install, run
quick: clean install run
