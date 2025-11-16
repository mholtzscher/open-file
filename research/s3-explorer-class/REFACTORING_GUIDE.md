# S3Explorer Refactoring Guide: From Imperative to React

## Quick Navigation
- [Data Flow Diagram](#data-flow-diagram)
- [State Management Strategy](#state-management-strategy)
- [Component Breakdown](#component-breakdown)
- [Key Handler Migration](#key-handler-migration)
- [Async Operations](#async-operations)
- [Implementation Checklist](#implementation-checklist)

---

## Data Flow Diagram

### BEFORE: Monolithic Class with Imperative Rendering

```
┌─────────────────────────────────────────────────────────────┐
│                    S3Explorer Class                          │
│                     (924 lines)                              │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Private State:                                               │
│  ├── renderer: CliRenderer                                    │
│  ├── bufferState: BufferState                                │
│  ├── adapter: Adapter                                        │
│  ├── bufferView, statusBar, previewPane, helpWindow          │
│  ├── previewPaneVisible, sortMenuOpen (booleans)             │
│  └── titleRenderable, bucketRenderable (cached)              │
│                                                               │
│  Methods:                                                     │
│  ├── start() → setupEventHandlers() → mainLoop()             │
│  ├── loadBuffer(path) [async]                                │
│  ├── handleKeyPress() → route by mode                        │
│  ├── handleNormalModeKey() [complex 160-line switch]         │
│  ├── handleNavigate(), handleSave() [async]                  │
│  └── render() [imperative component updates]                │
│                                                               │
│  Event Flow:                                                  │
│  1. User presses key                                          │
│  2. renderer.keyInput.on('keypress') fires                   │
│  3. handleKeyPress() routes by mode                          │
│  4. Handler mutates bufferState                              │
│  5. Handler calls this.render()                              │
│  6. render() manually updates all components                 │
│  7. Components call imperative .render() on OpenTUI          │
│                                                               │
└─────────────────────────────────────────────────────────────┘

Problems:
❌ Hard to test (tightly coupled, all-or-nothing)
❌ Unclear data flow (state mutations scattered)
❌ Imperative rendering (manual lifecycle)
❌ Dialogs block execution (async/await anti-pattern)
❌ No reusable components
❌ Complex event routing
```

### AFTER: Declarative React Components with Hooks

```
┌────────────────────────────────────────────────────────────┐
│                  S3Explorer React Component                 │
│                  (~150 lines, pure render)                 │
├────────────────────────────────────────────────────────────┤
│                                                              │
│  const { state, dispatch } = useBufferState(adapter)        │
│  const handlers = useKeyboardEvents(dispatch, renderer)     │
│  const [showHelp, setShowHelp] = useState(false)            │
│  const [showSort, setShowSort] = useState(false)            │
│                                                              │
│  useEffect(() => {                                          │
│    renderer.keyInput.on('keypress', handlers.onKeyPress)    │
│    return () => renderer.keyInput.off(...)                  │
│  }, [handlers, renderer])                                   │
│                                                              │
│  return (                                                    │
│    <>                                                        │
│      <Title bucket={bucket} />                             │
│      <BufferView state={state} />                          │
│      <StatusBar state={state} />                           │
│      {state.previewVisible && <PreviewPane {...} />}       │
│      {showHelp && <HelpWindow onClose={() => setShowHelp(false)} />} │
│      {showSort && <SortMenu onSort={(cfg) => {...}} />}    │
│    </>                                                       │
│  )                                                           │
│                                                              │
└────────────────────────────────────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────────┐
│         React Component Tree (Declarative)                  │
├────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─ useBufferState() Hook ────────────────────────┐        │
│  │ ├─ state: BufferState + UI state              │        │
│  │ ├─ dispatch: (action) => void                 │        │
│  │ └─ Actions:                                    │        │
│  │    ├─ 'navigate' → async load + update       │        │
│  │    ├─ 'moveCursor' → update selection        │        │
│  │    ├─ 'copy' → update copyRegister           │        │
│  │    ├─ 'save' → show dialog → execute ops     │        │
│  │    └─ ...                                     │        │
│  └──────────────────────────────────────────────┘        │
│                                                              │
│  ┌─ useKeyboardEvents() Hook ─────────────────────┐        │
│  │ Returns handlers for each mode:                │        │
│  │ ├─ onKeyPress: (key) => dispatch(...)        │        │
│  │ ├─ normalModeHandler                          │        │
│  │ ├─ visualModeHandler                          │        │
│  │ ├─ insertModeHandler                          │        │
│  │ └─ searchModeHandler                          │        │
│  └──────────────────────────────────────────────┘        │
│                                                              │
│  ┌─ Components (Functional, Pure Props) ───────────┐       │
│  │ ├─ <BufferView entries={} selection={} />      │       │
│  │ ├─ <StatusBar path={} mode={} />               │       │
│  │ ├─ <PreviewPane entry={} />                    │       │
│  │ ├─ <HelpWindow onClose={} />                   │       │
│  │ └─ <SortMenu onSort={} onClose={} />           │       │
│  └──────────────────────────────────────────────────┘      │
│                                                              │
└────────────────────────────────────────────────────────────┘

Benefits:
✅ Testable (hooks + unit tests + component tests)
✅ Clear data flow (Redux-like actions)
✅ Declarative rendering (React handles lifecycle)
✅ Non-blocking dialogs (state-based, not async/await)
✅ Reusable components (props-driven)
✅ Easy event routing (hooks)
```

---

## State Management Strategy

### Current BufferState (to be wrapped in hook)

```typescript
// Current: Direct mutation
bufferState.moveCursorDown(pageSize);
bufferState.deleteEntry(index);
bufferState.startVisualSelection();

// After: Action-based
dispatch({ type: 'moveCursor', direction: 'down', pageSize });
dispatch({ type: 'deleteEntry', index });
dispatch({ type: 'startVisualSelection' });
```

### useBufferState Hook Architecture

```typescript
// hooks/useBufferState.ts

interface BufferAction {
  type: 'navigate' | 'moveCursor' | 'copy' | 'paste' | 'delete' | 'save' | ...
  payload?: any
}

interface BufferStateWithUI extends BufferState {
  // Additional UI-only state
  showHelp?: boolean
  showSort?: boolean
  showConfirmDialog?: boolean
  confirmDialogPlan?: OperationPlan
  lastError?: string
}

export function useBufferState(adapter: Adapter, configManager: ConfigManager) {
  const [state, dispatch] = useReducer(bufferReducer, initialState);
  
  // Handle async operations
  useEffect(() => {
    // Navigate async
    if (state.pendingNavigation) {
      handleNavigate(adapter, state).then(newState => {
        dispatch({ type: 'navigationComplete', state: newState })
      }).catch(err => {
        dispatch({ type: 'navigationError', error: err })
      })
    }
  }, [state.pendingNavigation])
  
  return { state, dispatch }
}

// State reducer
function bufferReducer(state: BufferStateWithUI, action: BufferAction) {
  switch (action.type) {
    case 'moveCursor':
      return {
        ...state,
        selection: {
          ...state.selection,
          cursorIndex: calculateNewCursorPosition(...)
        }
      }
    
    case 'navigate':
      return {
        ...state,
        pendingNavigation: true,
        pendingPath: action.payload.path
      }
    
    case 'navigationComplete':
      return action.payload.state
    
    case 'save':
      return {
        ...state,
        showConfirmDialog: true,
        confirmDialogPlan: buildOperationPlan(...)
      }
    
    case 'confirmSave':
      // This triggers a side-effect in useEffect
      return {
        ...state,
        pendingSaveExecution: true,
        showConfirmDialog: false
      }
    
    case 'cancelSave':
      return {
        ...state,
        showConfirmDialog: false
      }
    
    // ... more cases
    
    default:
      return state
  }
}
```

---

## Component Breakdown

### 1. BufferView Component (Main Content Area)

**Current (Imperative)**
```typescript
// ui/buffer-view.ts (imperative class)
class BufferView {
  constructor(renderer: CliRenderer, state: BufferState, options) {
    this.renderer = renderer
    this.state = state
    // ... setup
  }
  
  updateState(state: BufferState) {
    this.state = state
  }
  
  render() {
    // Imperative manipulation of OpenTUI renderables
    this.renderer.root.add(...)
    this.renderer.root.update(...)
  }
}
```

**After (Declarative React)**
```typescript
// ui/components/BufferView.tsx (React component)
interface BufferViewProps {
  entries: Entry[]
  cursorIndex: number
  scrollOffset: number
  selection: SelectionState
  showHidden: boolean
  onNavigate?: (entry: Entry) => void
  displayConfig: DisplayConfig
}

export function BufferView({
  entries,
  cursorIndex,
  scrollOffset,
  selection,
  showHidden,
  onNavigate,
  displayConfig,
}: BufferViewProps) {
  const pageSize = useTerminalHeight()
  const filteredEntries = useMemo(
    () => entries.filter(e => showHidden || !e.name.startsWith('.')),
    [entries, showHidden]
  )
  
  const visibleEntries = useMemo(
    () => filteredEntries.slice(scrollOffset, scrollOffset + pageSize),
    [filteredEntries, scrollOffset, pageSize]
  )
  
  return (
    <BufferLines>
      {visibleEntries.map((entry, index) => (
        <BufferLine
          key={entry.id}
          entry={entry}
          isSelected={cursorIndex === scrollOffset + index}
          isInSelection={selection.selectionStart === scrollOffset + index}
          displayConfig={displayConfig}
        />
      ))}
    </BufferLines>
  )
}
```

### 2. StatusBar Component

**After (Declarative React)**
```typescript
// ui/components/StatusBar.tsx
interface StatusBarProps {
  path: string
  mode: EditMode
  searchQuery: string
  searchFlags: string  // "Aa .*" etc
  dirty: boolean
  message?: string
  messageType?: 'info' | 'success' | 'error'
}

export function StatusBar({
  path,
  mode,
  searchQuery,
  searchFlags,
  dirty,
  message,
  messageType,
}: StatusBarProps) {
  const modeStr = formatMode(mode)
  const pathStr = truncatePath(path, 60)
  const status = `${dirty ? '●' : ''} ${modeStr} ${pathStr}`
  
  let rightContent = ''
  if (searchQuery) {
    rightContent = `/${searchQuery}${searchFlags ? ` ${searchFlags}` : ''}`
  }
  
  return (
    <StatusLine
      left={status}
      right={rightContent}
      message={message}
      type={messageType}
    />
  )
}
```

### 3. HelpWindow Component

**After (Declarative React)**
```typescript
// ui/components/HelpWindow.tsx
interface HelpWindowProps {
  onClose: () => void
}

export function HelpWindow({ onClose }: HelpWindowProps) {
  useEffect(() => {
    const handleEscape = (e: any) => {
      if (e.key === 'Escape') onClose()
    }
    // Subscribe to keyboard events
    return () => {}
  }, [onClose])
  
  return (
    <FloatingWindowComponent
      width={80}
      height={35}
      title="KEYBINDINGS"
      onClose={onClose}
    >
      <HelpContent />
    </FloatingWindowComponent>
  )
}
```

### 4. SortMenu Component

**After (Declarative React)**
```typescript
// ui/components/SortMenu.tsx
interface SortMenuProps {
  currentField: SortField
  currentOrder: SortOrder
  onSort: (config: SortConfig) => void
  onClose: () => void
}

export function SortMenu({
  currentField,
  currentOrder,
  onSort,
  onClose,
}: SortMenuProps) {
  const handleFieldSelect = (field: SortField) => {
    onSort({ field, order: currentOrder })
    onClose()
  }
  
  return (
    <FloatingWindowComponent
      title="SORT OPTIONS"
      onClose={onClose}
    >
      <SortOptions
        current={currentField}
        onSelect={handleFieldSelect}
      />
    </FloatingWindowComponent>
  )
}
```

### 5. ConfirmationDialog Component

**After (Declarative React)**
```typescript
// ui/components/ConfirmationDialog.tsx
interface ConfirmationDialogProps {
  plan: OperationPlan
  onConfirm: () => void
  onCancel: () => void
  isLoading?: boolean
}

export function ConfirmationDialog({
  plan,
  onConfirm,
  onCancel,
  isLoading,
}: ConfirmationDialogProps) {
  return (
    <FloatingWindowComponent
      title="CONFIRM OPERATIONS"
      onClose={onCancel}
    >
      <div>
        {plan.operations.map(op => (
          <OperationLine key={op.id} operation={op} />
        ))}
        <div className="buttons">
          <Button onClick={onConfirm} disabled={isLoading}>
            {isLoading ? 'Executing...' : 'Confirm (y/n)'}
          </Button>
        </div>
      </div>
    </FloatingWindowComponent>
  )
}
```

---

## Key Handler Migration

### Current: Complex Switch Statement (160+ lines)

```typescript
// s3-explorer-class.ts lines 132-294
private handleNormalModeKey(key: any): void {
  // Handle sort menu intercepts
  // Handle help window intercepts
  // Complex debug logging
  // Key sequence detection
  // Individual key handlers (switch on key.name)
  // Many inline render() calls
}
```

### After: Organized Hook Functions

```typescript
// hooks/useKeyboardEvents.ts

export function useKeyboardEvents(dispatch: any, renderer: CliRenderer) {
  const normalModeHandler = useCallback((key: any) => {
    const keyName = normalizeKeyName(key)
    
    // Sequence detection
    const result = handleKeySequence(keyName)
    if (result.handled) {
      switch (result.action) {
        case 'moveToTop':
          dispatch({ type: 'moveCursor', position: 0 })
          break
        case 'moveToBottom':
          dispatch({ type: 'moveCursor', position: 'last' })
          break
        case 'copy':
          dispatch({ type: 'copy' })
          break
        case 'delete':
          dispatch({ type: 'deleteEntry' })
          break
      }
      return
    }
    
    // Single key handlers
    switch (keyName) {
      case 'j':
        dispatch({ type: 'moveCursor', direction: 'down' })
        break
      case 'k':
        dispatch({ type: 'moveCursor', direction: 'up' })
        break
      case 'h':
      case 'Backspace':
        dispatch({ type: 'navigateUp' })
        break
      case 'l':
      case 'Enter':
        dispatch({ type: 'navigate' })
        break
      case 'v':
        dispatch({ type: 'startVisualSelection' })
        break
      case 'i':
        dispatch({ type: 'enterInsertMode' })
        break
      case 'a':
        dispatch({ type: 'enterEditMode' })
        break
      case 'w':
        dispatch({ type: 'save' })
        break
      case 'p':
        dispatch({ type: 'togglePreview' })
        break
      case '/':
        dispatch({ type: 'enterSearchMode' })
        break
      case 'o':
        dispatch({ type: 'openSortMenu' })
        break
      case 'u':
        dispatch({ type: 'undo' })
        break
      case 'C-r':
        dispatch({ type: 'redo' })
        break
      case 'H':
        dispatch({ type: 'toggleHiddenFiles' })
        break
      case 'q':
        process.exit(0)
        break
    }
  }, [dispatch])
  
  const visualModeHandler = useCallback((key: any) => {
    const keyName = normalizeKeyName(key)
    switch (keyName) {
      case 'Escape':
        dispatch({ type: 'exitVisualSelection' })
        break
      case 'j':
        dispatch({ type: 'extendSelection', direction: 'down' })
        break
      case 'k':
        dispatch({ type: 'extendSelection', direction: 'up' })
        break
      case 'd':
        dispatch({ type: 'deleteSelection' })
        break
    }
  }, [dispatch])
  
  const insertModeHandler = useCallback((key: any) => {
    const keyName = normalizeKeyName(key)
    switch (keyName) {
      case 'Escape':
        dispatch({ type: 'exitInsertMode' })
        break
      case 'Enter':
        dispatch({ type: 'confirmInsertEntry' })
        break
      case 'Tab':
        dispatch({ type: 'applyTabCompletion' })
        break
      case 'Backspace':
        dispatch({ type: 'removeCharFromInsertingName' })
        break
      default:
        if (keyName.length === 1) {
          dispatch({ type: 'addCharToInsertingName', char: keyName })
        }
    }
  }, [dispatch])
  
  const searchModeHandler = useCallback((key: any) => {
    const keyName = normalizeKeyName(key)
    switch (keyName) {
      case 'Escape':
        dispatch({ type: 'exitSearchMode' })
        break
      case 'Backspace':
        dispatch({ type: 'updateSearchQuery', query: '...' })
        break
      case 'n':
        dispatch({ type: 'findNextMatch' })
        break
      case 'N':
        dispatch({ type: 'findPreviousMatch' })
        break
      case 'C-c':
        dispatch({ type: 'toggleCaseSensitive' })
        break
      case 'C-r':
        dispatch({ type: 'toggleRegexMode' })
        break
      default:
        if (keyName.length === 1) {
          dispatch({ type: 'updateSearchQuery', char: keyName })
        }
    }
  }, [dispatch])
  
  const onKeyPress = useCallback((key: any) => {
    const mode = /* get current mode from state */
    switch (mode) {
      case EditMode.Normal:
        normalModeHandler(key)
        break
      case EditMode.Visual:
        visualModeHandler(key)
        break
      case EditMode.Insert:
        insertModeHandler(key)
        break
      case EditMode.Search:
        searchModeHandler(key)
        break
    }
  }, [normalModeHandler, visualModeHandler, insertModeHandler, searchModeHandler])
  
  return { onKeyPress, normalModeHandler, visualModeHandler, insertModeHandler, searchModeHandler }
}
```

---

## Async Operations

### Save Operation Flow

**Current (Blocking Dialog)**
```typescript
private async handleSave(): Promise<void> {
  const changes = detectChanges(...)
  const plan = buildOperationPlan(changes)
  
  // BLOCKS here waiting for user
  const dialog = new ConfirmationDialog(this.renderer, plan)
  const result = await dialog.show()
  
  // Resumes after user confirms/cancels
  if (result.confirmed) {
    await this.executeOperationPlan(plan)
    await this.loadBuffer(this.currentPath)
  }
  
  this.render()
}
```

**After (Declarative State)**
```typescript
// In reducer
case 'save': {
  const changes = detectChanges(...)
  const plan = buildOperationPlan(changes)
  
  return {
    ...state,
    showConfirmDialog: true,
    confirmDialogPlan: plan,
    mode: EditMode.Normal  // Don't change mode until user acts
  }
}

case 'confirmSave': {
  return {
    ...state,
    pendingSaveExecution: true,
    showConfirmDialog: false
  }
}

// In component useEffect
useEffect(() => {
  if (state.pendingSaveExecution && state.confirmDialogPlan) {
    executeOperationPlan(adapter, state.confirmDialogPlan)
      .then(() => loadBuffer(adapter, state.currentPath))
      .then(newEntries => {
        dispatch({ type: 'saveComplete', entries: newEntries })
      })
      .catch(error => {
        dispatch({ type: 'saveError', error })
      })
  }
}, [state.pendingSaveExecution, state.confirmDialogPlan])

// Component render
{state.showConfirmDialog && (
  <ConfirmationDialog
    plan={state.confirmDialogPlan!}
    onConfirm={() => dispatch({ type: 'confirmSave' })}
    onCancel={() => dispatch({ type: 'cancelSave' })}
    isLoading={state.pendingSaveExecution}
  />
)}
```

### Navigation Async Flow

**After: Async Navigation with Loading State**
```typescript
useEffect(() => {
  if (state.pendingNavigation) {
    const loadEntries = async () => {
      try {
        dispatch({ type: 'navigationStarted' })
        const result = await adapter.list(state.pendingPath!)
        dispatch({
          type: 'navigationComplete',
          entries: result.entries,
          path: state.pendingPath!
        })
      } catch (error) {
        dispatch({ type: 'navigationError', error })
      }
    }
    
    loadEntries()
  }
}, [state.pendingNavigation, state.pendingPath])
```

---

## Implementation Checklist

### Phase 1: Extract State Management (Week 1)

- [ ] Create `hooks/useBufferState.ts`
  - [ ] Define reducer function
  - [ ] Implement all action types (20+)
  - [ ] Add side-effect useEffects for async ops
  - [ ] Test reducer with jest

- [ ] Create `state/bufferReducer.ts`
  - [ ] Extract pure reducer logic
  - [ ] Add action type definitions
  - [ ] Write unit tests for all actions

- [ ] Update S3Explorer React component
  - [ ] Replace internal bufferState with hook
  - [ ] Replace handlers with dispatch calls
  - [ ] Remove manual render() calls

### Phase 2: Extract Components (Week 2)

- [ ] Create `components/BufferView.tsx`
  - [ ] Accept props instead of managing state
  - [ ] Render with React (no imperative calls)
  - [ ] Add component tests

- [ ] Create `components/StatusBar.tsx`
  - [ ] Pure component from props
  - [ ] Format status string
  - [ ] Add tests

- [ ] Create `components/PreviewPane.tsx`
  - [ ] Accept entry prop
  - [ ] Load content async with useEffect
  - [ ] Add loading state

- [ ] Create `components/Title.tsx`
  - [ ] Simple pure component

### Phase 3: Extract Input Handling (Week 3)

- [ ] Create `hooks/useKeyboardEvents.ts`
  - [ ] Separate handlers by mode
  - [ ] Normalize key names
  - [ ] Handle key sequences
  - [ ] Write tests for each mode

- [ ] Update S3Explorer component
  - [ ] Replace inline handlers with hook
  - [ ] Setup keypress listener in useEffect
  - [ ] Cleanup listener on unmount

### Phase 4: Dialog Components (Week 4)

- [ ] Create `components/HelpWindow.tsx`
  - [ ] Replace FloatingWindow usage
  - [ ] Add keyboard escape handler
  - [ ] Add tests

- [ ] Create `components/SortMenu.tsx`
  - [ ] Replace FloatingWindow usage
  - [ ] Dispatch sort action on selection
  - [ ] Add tests

- [ ] Create `components/ConfirmationDialog.tsx`
  - [ ] Replace ConfirmationDialog class
  - [ ] Accept onConfirm/onCancel callbacks
  - [ ] Add loading state
  - [ ] Add tests

### Phase 5: Deprecation (Week 5)

- [ ] Update all imports to use React components
- [ ] Remove S3Explorer class
- [ ] Update entry point to use new component
- [ ] Run full test suite
- [ ] Remove old imperative component files

### Testing Targets

```
Test Coverage Target: >90%

Unit Tests:
├── hooks/useBufferState (reducer logic)
├── hooks/useKeyboardEvents (key routing)
├── state/bufferReducer (all actions)
├── utils/change-detection (existing)
└── utils/sorting (existing)

Component Tests:
├── components/BufferView
├── components/StatusBar
├── components/PreviewPane
├── components/HelpWindow
├── components/SortMenu
├── components/ConfirmationDialog
└── S3Explorer (integration)

File Count: ~20 new files (3 hooks, 6 components, 2 state files, 9 tests)
```

---

## File Size Comparison

| File | Current | After | Change |
|------|---------|-------|--------|
| s3-explorer-class.ts | 924 lines | 0 lines | Removed ✓ |
| s3-explorer.tsx | 54 lines | ~150 lines | +96 (full logic) |
| useBufferState.ts | - | ~400 lines | New hook |
| useKeyboardEvents.ts | - | ~200 lines | New hook |
| bufferReducer.ts | - | ~300 lines | New reducer |
| BufferView.tsx | - | ~80 lines | New component |
| StatusBar.tsx | - | ~50 lines | New component |
| PreviewPane.tsx | - | ~100 lines | New component |
| HelpWindow.tsx | - | ~80 lines | New component |
| SortMenu.tsx | - | ~60 lines | New component |
| ConfirmationDialog.tsx | - | ~90 lines | New component |
| **Total** | **~1000** | **~1500** | Better organization |

Note: More lines but distributed, testable, and reusable.

---

## Migration Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Lost functionality during refactor | High | Create parallel implementation, test thoroughly |
| Keyboard shortcuts break | High | Extract tests early, verify all sequences |
| Async operations behave differently | Medium | Use same adapter, compare behavior |
| Performance regression | Medium | Profile both versions, benchmark key operations |
| User confusion | Low | Backwards compatible, same keybindings |

---

## Success Criteria

- ✅ All keyboard shortcuts work identically
- ✅ No performance regression (< 10% slower)
- ✅ All unit tests pass (>90% coverage)
- ✅ No console errors or warnings
- ✅ Dialog interactions non-blocking
- ✅ Code reviewable (modular, documented)
- ✅ All async operations handle errors properly
- ✅ Can add tests for previously untested code
