# AWS Profile & Region Support - Task Dependencies

## Visual Dependency Graph

```
                    ┌─────────────────────────────────────┐
                    │   bd-5qq (Main Epic)                │
                    │   Use active AWS profile & region   │
                    └──────────┬──────────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
        ┌───────────▼──────────┐  ┌──────▼────────────────┐
        │   bd-al9             │  │   bd-8k3             │
        │   Profile detection  │  │   Region loading     │
        │   (No blockers ✓)    │  │   (No blockers ✓)    │
        └───────────┬──────────┘  └──────┬────────────────┘
                    │                     │
                    └──────────┬──────────┘
                               │ (both complete)
                    ┌──────────▼──────────────┐
                    │   bd-ams               │
                    │   S3Adapter update     │
                    │   Blocked by: al9, 8k3 │
                    └──────────┬──────────────┘
                               │
                    ┌──────────▼──────────────┐
                    │   bd-cvy               │
                    │   Region defaults      │
                    │   Blocked by: ams      │
                    └──────────┬──────────────┘
                               │
                    ┌──────────▼──────────────┐
                    │   bd-q3a               │
                    │   CLI --profile flag   │
                    │   Blocked by: cvy      │
                    └──────────┬──────────────┘
                               │
                    ┌──────────▼──────────────┐
                    │   bd-52s               │
                    │   Config file support  │
                    │   Blocked by: q3a      │
                    └──────┬─────────┬────────┘
                           │         │
          ┌────────────────┘         └───────────────────┐
          │                                              │
  ┌───────▼──────────────┐                  ┌──────────▼──────────┐
  │   bd-6k9             │                  │   bd-7sh             │
  │   Documentation      │                  │   Tests              │
  │   Blocked by: 52s    │                  │   Blocked by: 52s    │
  └──────────────────────┘                  └──────────────────────┘
```

## Timeline

| Phase | Task                       | Duration | Status    | Ready When            |
| ----- | -------------------------- | -------- | --------- | --------------------- |
| 1a    | bd-al9 (Profile detection) | 30 min   | Ready now | -                     |
| 1b    | bd-8k3 (Region loading)    | 30 min   | Ready now | -                     |
| 2     | bd-ams (S3Adapter)         | 45 min   | Blocked   | After 1a, 1b complete |
| 3     | bd-cvy (Region defaults)   | 20 min   | Blocked   | After 2 completes     |
| 4     | bd-q3a (CLI flag)          | 20 min   | Blocked   | After 3 completes     |
| 5     | bd-52s (Config file)       | 15 min   | Blocked   | After 4 completes     |
| 6a    | bd-6k9 (Docs)              | 15 min   | Blocked   | After 5 completes     |
| 6b    | bd-7sh (Tests)             | 45 min   | Blocked   | After 5 completes     |

**Total Estimated Time: ~3.5 hours**

## Parallel Execution Opportunities

### Can Run in Parallel

- **Phase 1**: bd-al9 and bd-8k3 can be worked on simultaneously by different people
- **Phase 6**: bd-6k9 and bd-7sh can be worked on simultaneously

### Must Run Sequentially

- Phases 2-5 each depend on the previous phase completing

## Ready Tasks (Start Here!)

```bash
# These have NO blockers and can be started immediately:
bd-al9  # Detect active AWS profile from environment
bd-8k3  # Load region from AWS profile config

# Start with:
bd update bd-al9 --status in_progress
bd update bd-8k3 --status in_progress
```

## How to Manage Dependencies with bd

```bash
# See what's ready to work on
bd ready --json

# See what's blocked and why
bd blocked --json

# View dependency tree for a specific task
bd dep tree bd-ams

# Check current status of all AWS Profile tasks
bd list --json | jq '.[] | select(.id | test("(5qq|al9|8k3|ams|cvy|q3a|52s|6k9|7sh)"))'

# Mark task as complete (will unblock dependents!)
bd close bd-al9 --reason "Profile detection implemented and tested"

# See cycles (if any - should be none)
bd dep cycles
```

## Priority When Starting

**Recommended approach:**

1. Start with **bd-al9** and **bd-8k3** (can both go immediately)
2. Once those are complete, **bd-ams** becomes available
3. Continue down the chain sequentially

**Alternative approach (parallelization):**

1. Person A: Works on **bd-al9** while Person B works on **bd-8k3**
2. Both complete and coordinate to start **bd-ams**
3. When **bd-52s** completes, Person A takes **bd-6k9** (docs), Person B takes **bd-7sh** (tests)

## Dependency Justification

### Why bd-ams depends on bd-al9 AND bd-8k3

- Profile detection (bd-al9) provides the profile name to use
- Region loading (bd-8k3) provides the region for that profile
- S3Adapter (bd-ams) needs both to properly instantiate the client

### Why bd-cvy depends on bd-ams

- Must update S3Adapter first before implementing region fallback logic
- Ensures the adapter is ready to accept profile-based regions

### Why bd-q3a depends on bd-cvy

- Region handling must be complete before adding CLI flag
- CLI flag will use the new region resolution logic

### Why bd-52s depends on bd-q3a

- Config file should support the new --profile flag
- Config file format needs to align with CLI interface

### Why bd-6k9 and bd-7sh depend on bd-52s

- Documentation should reference all implemented features
- Tests should cover the complete feature set

## Checking Progress

```bash
# Current status snapshot
bd list --json | jq '.[] | select(.id | test("(5qq|al9|8k3|ams|cvy|q3a|52s|6k9|7sh)")) | {id: .id, title: .title, status: .status, deps: .dependency_count, dependents: .dependent_count}'

# Only open tasks
bd blocked --json | jq '.[] | select(.id | test("(5qq|al9|8k3|ams|cvy|q3a|52s|6k9|7sh)")) | {id: .id, title: .title}'

# Epic progress
bd epic progress bd-5qq
```

---

**Generated:** 2025-11-16
**Feature:** AWS Profile & Region Support (bd-5qq)
**Total Tasks:** 8 (1 epic + 7 subtasks)
**Dependencies:** 7 blocking relationships
