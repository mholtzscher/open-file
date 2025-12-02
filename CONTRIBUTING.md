# Contributing to open-file

## Development Setup

```bash
# Install dependencies
bun install

# Run in development mode (with watch)
bun run --watch src/index.tsx
# or
just dev

# Run tests
bun test

# Lint and format
bun run lint
bun run format
```

## Local Testing Infrastructure

Docker Compose provides local testing with multiple storage backends:

```bash
# Start all services
docker-compose up -d

# Or specific services
docker-compose up -d localstack    # S3 (LocalStack)
docker-compose up -d fake-gcs      # GCS
docker-compose up -d sftp          # SFTP
```

### LocalStack (S3)

- Endpoint: `http://localhost:4566`
- Region: `us-east-1`
- Credentials: `test` / `test`

```bash
bun run src/index.tsx --endpoint http://localhost:4566
```

### SFTP

- Host: `localhost:2222`
- Username: `testuser`
- Password: `testpass`

## Project Structure

```
src/
├── index.tsx              # Application entry point
├── ui/                    # React components
│   ├── app.tsx           # Root app component
│   ├── file-explorer.tsx # Main file browser
│   ├── buffer-view.tsx   # Entry list rendering
│   ├── dialog/           # Modal dialogs
│   ├── header.tsx        # Provider/profile header
│   ├── status-bar.tsx    # Bottom status bar
│   └── preview-pane.tsx  # File preview
├── hooks/                 # React hooks
│   ├── useBufferState.ts # Buffer entries, cursor, mode
│   ├── useStorage.ts     # Provider operations
│   ├── useNavigationHandlers.ts
│   ├── useDialogState.ts
│   ├── useKeybindings.ts
│   └── useClipboard.ts
├── providers/             # Storage backends
│   ├── provider.ts       # StorageProvider interface
│   ├── factory.ts        # Provider instantiation
│   ├── s3/               # AWS S3
│   ├── gcs/              # Google Cloud Storage
│   ├── sftp/             # SSH File Transfer
│   ├── ftp/              # FTP
│   ├── local/            # Local filesystem
│   ├── credentials/      # Credential resolution
│   └── services/         # Profile management
├── contexts/              # React contexts
│   ├── StorageContext.tsx
│   ├── ProfileContext.tsx
│   └── KeyboardContext.tsx
├── themes/                # Color themes
├── types/                 # TypeScript types
│   ├── entry.ts          # File/directory entries
│   ├── dialog.ts         # Dialog state types
│   └── edit-mode.ts      # Editor modes
└── utils/                 # Utilities
    ├── cli.ts            # CLI argument parsing
    ├── logger.ts         # Structured logging
    ├── sorting.ts        # Entry sorting
    └── path-utils.ts     # Path manipulation
```

## Architecture

### Provider System

Storage backends implement the `StorageProvider` interface:

```typescript
interface StorageProvider {
  list(path: string): Promise<Entry[]>;
  read(path: string): Promise<Uint8Array>;
  write(path: string, content: Uint8Array): Promise<void>;
  delete(path: string): Promise<void>;
  move(source: string, destination: string): Promise<void>;
  copy(source: string, destination: string): Promise<void>;
  getCapabilities(): ProviderCapabilities;
  // ...
}
```

Providers declare capabilities so the UI adapts to what's supported.

### React/OpenTUI

The UI is built with React and OpenTUI for terminal rendering:

- Components use JSX with OpenTUI primitives (`<box>`, `<text>`)
- State management via hooks (`useState`, `useReducer`)
- Keyboard events handled through `KeyboardContext`

### Edit Modes

The app uses vim-style modal editing:

- **Normal** - Navigation and commands
- **Visual** - Multi-select
- **Insert** - Creating new entries
- **Edit** - Renaming entries
- **Search** - Filtering entries

## Testing

Tests use Bun's native test runner with OpenTUI's test utilities:

```typescript
import { describe, it, expect } from 'bun:test'
import { testRender } from '@opentui/react/test-utils'

describe('Component', () => {
  it('renders', async () => {
    const { renderOnce, captureCharFrame } = await testRender(
      <MyComponent />,
      { width: 80, height: 24 }
    )
    await renderOnce()
    expect(captureCharFrame()).toContain('Expected text')
  })
})
```

See `research/opentui-testing/` for detailed testing patterns.

## Adding a New Provider

1. Create directory: `src/providers/yourprovider/`
2. Implement `StorageProvider` interface
3. Register in `src/providers/factory.ts`
4. Add credential resolver in `src/providers/credentials/resolvers/`
5. Add profile type in `src/providers/types/profile.ts`

## Code Style

- TypeScript strict mode
- ESLint + Prettier for formatting
- Prefer hooks over class components
- Use descriptive names over comments
