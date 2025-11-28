## Issue Tracking with bd (beads)

**IMPORTANT**: This project uses **bd (beads)** for ALL issue tracking. Do NOT use markdown TODOs, task lists, or other tracking methods.

### Why bd?

- Dependency-aware: Track blockers and relationships between issues
- Git-friendly: Auto-syncs to JSONL for version control
- Agent-optimized: JSON output, ready work detection, discovered-from links
- Prevents duplicate tracking systems and confusion

### Quick Start

**Check for ready work:**

```bash
bd ready --json
```

**Create new issues:**

```bash
bd create "Issue title" -t bug|feature|task -p 0-4 --json
bd create "Issue title" -p 1 --deps discovered-from:bd-123 --json
```

**Claim and update:**

```bash
bd update bd-42 --status in_progress --json
bd update bd-42 --priority 1 --json
```

**Complete work:**

```bash
bd close bd-42 --reason "Completed" --json
```

### Issue Types

- `bug` - Something broken
- `feature` - New functionality
- `task` - Work item (tests, docs, refactoring)
- `epic` - Large feature with subtasks
- `chore` - Maintenance (dependencies, tooling)

### Priorities

- `0` - Critical (security, data loss, broken builds)
- `1` - High (major features, important bugs)
- `2` - Medium (default, nice-to-have)
- `3` - Low (polish, optimization)
- `4` - Backlog (future ideas)

### Workflow for AI Agents

1. **Check ready work**: `bd ready` shows unblocked issues
2. **Claim your task**: `bd update <id> --status in_progress`
3. **Work on it**: Implement, test, document
4. **Discover new work?** Create linked issue:
   - `bd create "Found bug" -p 1 --deps discovered-from:<parent-id>`
5. **Complete**: `bd close <id> --reason "Done"`
6. **Stage changes**: Stage all modified files with `git add`
7. **DO NOT COMMIT**: Let the human review and commit changes

**IMPORTANT**: Agents should NEVER create git commits. Always stage changes and let the human review before committing.

### Auto-Sync

bd automatically syncs with git:

- Exports to `.beads/issues.jsonl` after changes (5s debounce)
- Imports from JSONL when newer (e.g., after `git pull`)
- No manual export/import needed!

### MCP Server (Recommended)

If using Claude or MCP-compatible clients, install the beads MCP server:

```bash
pip install beads-mcp
```

Add to MCP config (e.g., `~/.config/claude/config.json`):

```json
{
  "beads": {
    "command": "beads-mcp",
    "args": []
  }
}
```

Then use `mcp__beads__*` functions instead of CLI commands.

### Managing AI-Generated Planning Documents

AI assistants often create planning and design documents during development:

- PLAN.md, IMPLEMENTATION.md, ARCHITECTURE.md
- DESIGN.md, CODEBASE_SUMMARY.md, INTEGRATION_PLAN.md
- TESTING_GUIDE.md, TECHNICAL_DESIGN.md, and similar files

**Best Practice: Use a dedicated directory for these ephemeral files**

**Recommended approach:**

- Create a `history/` directory in the project root
- Store ALL AI-generated planning/design docs in `history/`
- Keep the repository root clean and focused on permanent project files
- Only access `history/` when explicitly asked to review past planning

**Example .gitignore entry (optional):**

```
# AI planning documents (ephemeral)
history/
```

**Benefits:**

- ✅ Clean repository root
- ✅ Clear separation between ephemeral and permanent documentation
- ✅ Easy to exclude from version control if desired
- ✅ Preserves planning history for archeological research
- ✅ Reduces noise when browsing the project

### Managing Dependencies

Use the `bd dep` command to set up task workflows:

```bash
# Add a dependency: task-b depends on task-a
bd dep add task-a task-b --json

# View dependency tree
bd dep tree --json

# Detect circular dependencies
bd dep cycles --json

# Remove a dependency
bd dep remove task-a task-b --json
```

**Dependency workflow example:**

```bash
# Create epic
EPIC=$(bd create "Feature X" -t epic -p 1 --json | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

# Create foundational tasks
TASK1=$(bd create "Foundation task 1" -t task -p 1 --json | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
TASK2=$(bd create "Foundation task 2" -t task -p 1 --json | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

# Create dependent tasks
TASK3=$(bd create "Depends on 1&2" -t task -p 1 --json | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

# Link them
bd dep add $EPIC $TASK1 --json
bd dep add $EPIC $TASK2 --json
bd dep add $TASK1 $TASK3 --json
bd dep add $TASK2 $TASK3 --json
```

### Important Rules

- ✅ Use bd for ALL task tracking
- ✅ Always use `--json` flag for programmatic use
- ✅ Link discovered work with `discovered-from` dependencies
- ✅ Use `bd dep add` to manage task dependencies and workflows
- ✅ Check `bd ready` before asking "what should I work on?"
- ✅ Store AI planning docs in `history/` directory
- ✅ Stage changes with `git add` when work is complete
- ❌ Do NOT create markdown TODO lists
- ❌ Do NOT use external issue trackers
- ❌ Do NOT duplicate tracking systems
- ❌ Do NOT clutter repo root with planning documents
- ❌ **NEVER manually edit `.beads/beads.jsonl`** - Always use bd commands
- ❌ Do NOT directly read issues.json always use the mcp server
- ❌ **NEVER create git commits** - Always let the human review and commit

For more details, see README.md and QUICKSTART.md.

---

## OpenTUI Testing Cheat Sheet

This project uses **OpenTUI** for terminal UI components. Tests use **Bun's native test runner** with OpenTUI's custom testing utilities.

### Setup

```typescript
import { describe, it, expect } from 'bun:test';
import { testRender } from '@opentui/react/test-utils';
```

### Basic Rendering

```typescript
it("renders correctly", async () => {
  const { renderOnce, captureCharFrame } = await testRender(
    <MyComponent />,
    { width: 80, height: 24 }
  )
  await renderOnce()  // IMPORTANT: Must call to populate buffer
  const frame = captureCharFrame()

  expect(frame).toContain("Expected Text")
})
```

### Keyboard Input

```typescript
// Single keys
mockInput.pressKey('j'); // vim navigation
mockInput.pressEnter(); // Enter key
mockInput.pressEscape(); // Escape key
mockInput.pressTab(); // Tab key
mockInput.pressBackspace(); // Backspace

// Modifiers
mockInput.pressKey('c', { ctrl: true });
mockInput.pressKey('x', { alt: true });
mockInput.pressKey('Tab', { shift: true });

// Arrow keys
mockInput.pressArrow('up');
mockInput.pressArrow('down');
mockInput.pressArrow('left');
mockInput.pressArrow('right');

// Ctrl+C shortcut
mockInput.pressCtrlC();

// Type text (async)
await mockInput.typeText('hello world');
```

### Mouse Input

```typescript
// Click at column 10, row 5
mockMouse.click(10, 5);

// Right click
mockMouse.click(10, 5, { button: 'right' });

// Scroll
mockMouse.scroll('up', 10, 5);
mockMouse.scroll('down', 10, 5);
```

### Testing State Changes

```typescript
it("updates on keypress", async () => {
  const { renderOnce, captureCharFrame, mockInput } = await testRender(
    <ListComponent items={items} />,
    { width: 80, height: 24 }
  )
  await renderOnce()

  // Initial state
  expect(captureCharFrame()).toContain("Item 1 [selected]")

  // Navigate down
  mockInput.pressKey("j")
  await renderOnce()
  expect(captureCharFrame()).toContain("Item 2 [selected]")
})
```

### Resize Terminal

```typescript
it("handles resize", async () => {
  const { renderOnce, captureCharFrame, resize } = await testRender(
    <ResponsiveComponent />,
    { width: 80, height: 24 }
  )
  await renderOnce()

  resize(40, 12)  // width, height
  await renderOnce()
  expect(captureCharFrame()).toContain("Compact View")
})
```

### Full Test Example

```typescript
import { describe, it, expect } from "bun:test"
import { testRender } from "@opentui/react/test-utils"
import { FileList } from "./FileList"

describe("FileList", () => {
  it("navigates with j/k keys", async () => {
    const files = ["file1.txt", "file2.txt", "file3.txt"]
    const { renderOnce, captureCharFrame, mockInput } = await testRender(
      <FileList files={files} />,
      { width: 80, height: 24 }
    )
    await renderOnce()

    // First item selected by default
    expect(captureCharFrame()).toContain("> file1.txt")

    // Move down
    mockInput.pressKey("j")
    await renderOnce()
    expect(captureCharFrame()).toContain("> file2.txt")

    // Move up
    mockInput.pressKey("k")
    await renderOnce()
    expect(captureCharFrame()).toContain("> file1.txt")
  })

  it("opens file on Enter", async () => {
    const onOpen = vi.fn()  // or use bun:test mock
    const { renderOnce, mockInput } = await testRender(
      <FileList files={["test.txt"]} onOpen={onOpen} />,
      { width: 80, height: 24 }
    )
    await renderOnce()

    mockInput.pressEnter()
    expect(onOpen).toHaveBeenCalledWith("test.txt")
  })
})
```

### Key Utilities Reference

| Function                          | Purpose                     |
| --------------------------------- | --------------------------- |
| `testRender(node, options)`       | Render React component      |
| `renderOnce()`                    | Render frame to buffer      |
| `captureCharFrame()`              | Get current frame as string |
| `mockInput.pressKey(key, mods?)`  | Simulate keypress           |
| `mockInput.pressEnter()`          | Simulate Enter key          |
| `mockInput.pressEscape()`         | Simulate Escape key         |
| `mockInput.pressArrow(direction)` | Simulate arrow keys         |
| `mockInput.pressCtrlC()`          | Simulate Ctrl+C             |
| `mockInput.typeText(text)`        | Type text (async)           |
| `mockMouse.click(x, y, opts?)`    | Simulate mouse click        |
| `mockMouse.scroll(dir, x, y)`     | Simulate scroll             |
| `resize(width, height)`           | Resize terminal             |

### Tips

- `testRender` returns a Promise - always `await` it
- Call `renderOnce()` after initial render and after each input to update buffer
- Frame output is a string - use `toContain()` for partial matches
- Options use `width` and `height`, not `cols` and `rows`
- For detailed research, see `research/opentui-testing/`
