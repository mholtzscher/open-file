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
