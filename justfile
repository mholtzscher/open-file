# Justfile for open-s3 development

# Default recipe to display help
default:
    @just --list

# Install dependencies
install:
    npm install

# Build TypeScript to JavaScript
build:
    npm run build

# Run in watch mode for development
dev:
    npm run dev

# Run the application
run: build
    npm start

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

# Check TypeScript types without building
check:
    npx tsc --noEmit

# Format code (placeholder for when we add prettier)
fmt:
    @echo "Code formatting not yet configured"

# Run tests (placeholder for when we add tests)
test:
    @echo "Tests not yet implemented"

# Run linting (placeholder for when we add eslint)
lint:
    @echo "Linting not yet configured"

# Show project info
info:
    @echo "Project: open-s3"
    @echo "TypeScript version: $(npx tsc --version)"
    @echo "Node version: $(node --version)"
    @echo "NPM version: $(npm --version)"

# Quick development cycle: clean, install, build, run
quick: clean install build run
