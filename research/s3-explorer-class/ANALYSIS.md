# S3Explorer Class Architecture Analysis

## Executive Summary

The `s3-explorer-class.ts` is a **large monolithic class (924 lines)** that implements the entire application logic in an **imperative, event-driven paradigm**. It manages:

1. **Application lifecycle** (initialization, render loops)
2. **Keyboard event handlers** (for 5 different editing modes)
3. **Composite UI component management** (BufferView, StatusBar, FloatingWindow, PreviewPane)
4. **State mutations** (through BufferState)
5. **Business logic** (save operations, navigation, file operations)

The class is tightly coupled to `@opentui/core` (OpenTUI renderer) and uses imperative rendering calls. This needs to be **refactored into declarative React components** to enable proper testing, reusability, and maintainability.

---

## 1. Main State Management

### State Variables (Lines 20-36)

```typescript
private renderer!: CliRenderer;              // OpenTUI renderer instance
private adapter!: Adapter;                   // S3/file system adapter
private bufferState!: BufferState;           // Main editable state
private bufferView!: BufferView;             // Display component
private statusBar!: StatusBar;               // Status line
private previewPane?: PreviewPane;           // Optional preview pane
private previewPaneVisible = false;          // Preview visibility flag
private helpWindow?: FloatingWindow;         // Floating help dialog
private sortMenu?: FloatingWindow;           // Sort menu overlay
private sortMenuOpen = false;                // Sort menu state
private titleRenderable?: TextRenderable;    // Title display
private bucketRenderable?: TextRenderable;   // Bucket name display
private lastCalculatedHeight = 0;            // Terminal height cache
private currentPath = 'test-bucket/';        // Current S3 path
private configManager: ConfigManager;        // Config persistence
private bucket: string = 'test-bucket';      // Bucket name
```

### State Relationships

```
S3Explorer (Main App)
├── bufferState (BufferState)
│   ├── entries: Entry[]
│   ├── selection: SelectionState
│   ├── mode: EditMode (Normal|Visual|Insert|Edit|Search)
│   ├── copyRegister: Entry[]
│   ├── scrollOffset: number
│   ├── searchQuery: string
│   ├── deletedEntryIds: Set<string>
│   └── undoHistory: BufferState[]
├── bufferView (Display)
├── statusBar (Display)
├── previewPane (Optional Display)
├── helpWindow (Floating overlay)
├── sortMenu (Floating overlay)
└── adapter (S3 operations)
```

**Key Insight**: `BufferState` is the **source of truth** for editable data. Everything else depends on it. This can become a **custom React hook** or **Zustand store**.

---

## 2. Main Event Handlers & State Mutations

### Primary Event Handler (Lines 100-127)

```typescript
setupEventHandlers(): void {
  this.renderer.keyInput.on('keypress', (key) => {
    this.handleKeyPress(key);
  });
}

private handleKeyPress(key: any): void {
  switch (this.bufferState.mode) {
    case EditMode.Normal:      this.handleNormalModeKey(key);
    case EditMode.Visual:      this.handleVisualModeKey(key);
    case EditMode.Insert:      this.handleInsertModeKey(key);
    case EditMode.Edit:        this.handleEditModeKey(key);
    case EditMode.Search:      this.handleSearchModeKey(key);
  }
}
```

### Mode-Specific Key Handlers

#### Normal Mode Handler (Lines 132-294)

- **Sort Menu**: Intercepts keys when menu is open
- **Help Window**: Shows/hides help overlay
- **Navigation**: `j/k` (up/down), `h` (parent), `l` (enter)
- **Editing**: `v` (visual select), `i` (insert), `a` (edit)
- **Operations**: `w` (save), `p` (paste/preview), `/` (search), `o` (sort), `u` (undo), `Ctrl+R` (redo)
- **Vim-style**: `gg` (top), `G` (bottom), `yy` (copy), `dd` (delete)

**State mutations in Normal Mode:**

```typescript
this.bufferState.moveCursorDown(pageSize); // Move cursor
this.bufferState.startVisualSelection(); // Enter visual mode
this.bufferState.toggleHiddenFiles(); // Toggle filter
this.render(); // Force re-render
```

#### Visual Mode Handler (Lines 299-317)

- Extends selection up/down
- Handles `d` to delete selected entries
- Calls `this.render()` after each action

#### Insert Mode Handler (Lines 322-355)

- Accumulates characters: `addCharToInsertingName()`
- Handles backspace: `removeCharFromInsertingName()`
- Tab completion: `applyFirstTabCompletion()`
- Confirmation: `confirmInsertEntry()`

#### Edit Mode Handler (Lines 360-370)

- Currently minimal - just handles escape to exit

#### Search Mode Handler (Lines 375-417)

- Accumulates search query: `updateSearchQuery()`
- Navigation: `n` (next), `N` (previous)
- Toggles: `C-c` (case), `C-r` (regex)

### Navigation Handlers

#### Navigate Into Directory (Lines 422-436)

```typescript
private async handleNavigate(): Promise<void> {
  const selected = this.bufferState.getSelectedEntry();
  if (selected?.type === 'directory') {
    try {
      await this.loadBuffer(selected.path);        // Load from adapter
      this.currentPath = this.bufferState.currentPath;
      this.render();                               // Force re-render
    } catch (error) { ... }
  }
}
```

#### Navigate Up (Lines 441-457)

- Parses path, pops directory
- Calls `loadBuffer()` with new path
- Handles errors via status bar

### Save Handler (Lines 495-529)

```typescript
private async handleSave(): Promise<void> {
  // 1. Detect changes
  const changes = detectChanges(
    this.bufferState.originalEntries,
    this.bufferState.entries,
    this.bufferState.idMap
  );

  // 2. Build operation plan
  const plan = buildOperationPlan(changes);

  // 3. Show confirmation dialog (BLOCKS waiting for user)
  const dialog = new ConfirmationDialog(this.renderer, plan);
  const result = await dialog.show();

  // 4. If confirmed, execute operations
  if (result.confirmed) {
    await this.executeOperationPlan(plan);
    this.bufferState.commitDeletions();
    await this.loadBuffer(this.currentPath);
  }

  this.render();
}
```

**Issue**: The dialog is **imperative** - it blocks execution. In React, this should be **declarative state**.

### Other Key Handlers

| Handler                   | Mutation                       | Side Effects                  |
| ------------------------- | ------------------------------ | ----------------------------- |
| `handleCopy()`            | `copySelection()`              | Show status                   |
| `handlePasteAfter()`      | `pasteAfterCursor()`           | Save to history, show status  |
| `handleDeleteSelection()` | `deleteEntry()` + save history | Exit visual mode, show status |
| `handlePageDown()`        | `pageDown()`                   | Update preview + scroll info  |
| `handlePageUp()`          | `pageUp()`                     | Update preview + scroll info  |
| `handleTogglePreview()`   | Toggle `previewPaneVisible`    | Lazy-create PreviewPane       |
| `handleOpenSortMenu()`    | Create/show FloatingWindow     | Set `sortMenuOpen = true`     |
| `handleShowHelp()`        | Create/show FloatingWindow     | Lazy-create HelpWindow        |

---

## 3. Main Render Operations

### Central Render Method (Lines 849-909)

```typescript
private async render(): Promise<void> {
  // 1. Create title (once only)
  if (!this.titleRenderable) {
    this.titleRenderable = new TextRenderable(...);
    this.renderer.root.add(this.titleRenderable);
  }

  // 2. Create bucket display (once only)
  if (!this.bucketRenderable) {
    this.bucketRenderable = new TextRenderable(...);
    this.renderer.root.add(this.bucketRenderable);
  }

  // 3. Create or update buffer view (main content area)
  if (!this.bufferView) {
    this.bufferView = new BufferView(this.renderer, this.bufferState, {...});
  } else {
    this.bufferView.updateState(this.bufferState);
  }

  // 4. Update status bar
  this.statusBar.setPath(this.bufferState.currentPath);
  this.statusBar.setMode(this.bufferState.mode);
  this.statusBar.setSearchQuery(this.bufferState.searchQuery);

  // 5. Render each component
  this.bufferView.render();
  if (this.previewPaneVisible && this.previewPane) {
    this.previewPane.render();
  }
  this.statusBar.render();
}
```

### Render Flow

```
render() [called after every action]
├── Create/Reuse titleRenderable (OpenTUI TextRenderable)
├── Create/Reuse bucketRenderable
├── Create/Update bufferView (BufferView class)
│   └── bufferView.updateState() [passes new state]
│   └── bufferView.render() [imperative render call]
├── Update statusBar state
│   └── statusBar.render()
└── If visible: previewPane.render()
```

**Problem**: This is **imperative cascading renders**. Every action calls `render()`, which:

1. Checks if components exist (lazy creation)
2. Calls `.render()` on each component
3. Components use `@opentui/core` to manipulate TextRenderable directly

**Solution**: Should be **declarative React state** → component tree re-renders automatically.

---

## 4. Current Component Rendering Strategy

### BufferView Class

- Receives `bufferState` in constructor
- Takes `renderer` to manipulate OpenTUI directly
- Has `updateState()` method to accept new state
- Has `render()` method for imperative rendering

### StatusBar Class

- Takes `renderer` and `bufferState`
- Has setter methods: `setPath()`, `setMode()`, `setSearchQuery()`
- Has `render()` method

### PreviewPane Class

- Takes `renderer`, `adapter`, and config
- Has async `previewEntry()` to load file content
- Has `render()` method

### FloatingWindow Class

- Takes `renderer` and options (width, height, title, colors)
- Has `setContent()`, `show()`, `hide()`, `render()` methods
- Used for help menu and sort menu

### UI Component Instantiation Pattern

**Current Pattern:**

```typescript
// Lazy creation with caching
if (!this.helpWindow) {
  this.helpWindow = new FloatingWindow(this.renderer, {...});
}
this.helpWindow.setContent(lines);
this.helpWindow.show();
this.render();  // Force re-render
```

**Problem**:

- Manual lifetime management
- Imperative show/hide
- Unclear data flow
- Hard to test

**React Solution:**

```typescript
// Declarative state
const [isHelpVisible, setIsHelpVisible] = useState(false);

// Conditional rendering
{isHelpVisible && <HelpWindow onClose={() => setIsHelpVisible(false)} />}
```

---

## 5. Lifecycle & Initialization

### Start Sequence (Lines 54-80)

```typescript
async start(): Promise<void> {
  // 1. Create OpenTUI renderer
  this.renderer = await createCliRenderer({exitOnCtrlC: true});

  // 2. Create StatusBar
  this.statusBar = new StatusBar(this.renderer);

  // 3. Setup keyboard handlers
  this.setupEventHandlers();

  // 4. Load initial buffer
  try {
    await this.loadBuffer(this.currentPath);
    this.currentPath = this.bufferState.currentPath;
  } catch (error) { ... }

  // 5. Initial render
  await this.render();

  // 6. Start main loop
  await this.mainLoop();
}

private async mainLoop(): Promise<void> {
  while (true) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}
```

**Issue**: Main loop just sleeps. Event handlers call `render()` imperatively.

---

## Architecture Transformation Map

### Current: Imperative Pattern

```
User Input
    ↓
setupEventHandlers() → renderer.keyInput.on('keypress')
    ↓
handleKeyPress(key) → route by mode
    ↓
Handle*ModeKey() → mutate bufferState
    ↓
this.render() ← explicit call
    ↓
Create/update component objects imperatively
    ↓
component.render() ← explicit OpenTUI manipulation
```

### Target: Declarative React Pattern

```
React Component (S3Explorer)
    ↓
useBufferState() [custom hook] ← source of truth
useKeyboardEvents() [custom hook] → handle input
    ↓
State changes → trigger reducer action
    ↓
React re-renders automatically
    ↓
Child Components render based on state
    ↓
OpenTUI TextRenderable components
```

---

## 6. Key Refactoring Points

### 1. **Create `useBufferState` Hook**

- Move all BufferState mutations into reducer
- Actions: `navigate()`, `copy()`, `paste()`, `delete()`, etc.
- Effects: handle side-effects (confirm dialogs, async operations)

### 2. **Create `useKeyboardEvents` Hook**

- Encapsulate all key handling logic
- Return: handlers for each mode
- Dispatch actions to bufferState

### 3. **Extract Modal/Dialog Components**

- `ConfirmationDialog` → React component with declarative state
- `HelpWindow` → React component
- `SortMenu` → React component
- Use state lifting instead of imperative show/hide

### 4. **Extract Composite Components**

- `BufferViewComponent` → Props-based
- `StatusBarComponent` → Props-based
- `PreviewPaneComponent` → Props-based

### 5. **Separate Concerns**

- **Adapter/IO**: Keep in classes (async operations)
- **State**: Move to reducers/hooks
- **Rendering**: Move to React components
- **Business Logic**: Extract to utils (e.g., change detection)

---

## 7. File Structure for Refactored Version

```
src/ui/
├── S3Explorer.tsx                [Main React component]
├── hooks/
│   ├── useBufferState.ts         [State management hook]
│   ├── useKeyboardEvents.ts      [Keyboard input hook]
│   └── useFileOperations.ts      [S3 adapter wrapper]
├── components/
│   ├── BufferView.tsx            [File list display]
│   ├── StatusBar.tsx             [Status line]
│   ├── PreviewPane.tsx           [File preview]
│   ├── HelpWindow.tsx            [Help overlay]
│   ├── SortMenu.tsx              [Sort dialog]
│   └── ConfirmationDialog.tsx    [Confirmation modal]
├── state/
│   ├── bufferReducer.ts          [State management logic]
│   └── actions.ts                [Action types]
└── [existing files...]
```

---

## Summary Table: What Needs to Migrate

| Category          | Current Location                         | Current Pattern             | Target Location                  | Target Pattern         |
| ----------------- | ---------------------------------------- | --------------------------- | -------------------------------- | ---------------------- |
| **State**         | `bufferState` property                   | Direct mutations            | `useBufferState()` hook          | Reducer actions        |
| **Input**         | `setupEventHandlers()`                   | Event listener registration | `useKeyboardEvents()` hook       | Hook callbacks         |
| **Rendering**     | `render()` method                        | Imperative calls            | React component tree             | Declarative JSX        |
| **UI Components** | Class instances (BufferView, etc.)       | Imperative lifecycle        | React components                 | Props + state          |
| **Dialogs**       | `FloatingWindow` class with show/hide    | Manual visibility           | React state + conditional render | Component mounting     |
| **Navigation**    | `handleNavigate()`, `handleNavigateUp()` | Direct async + render       | Actions + effects                | useEffect with reducer |
| **Configuration** | `ConfigManager` property                 | Kept as-is                  | Kept as-is                       | Pass via context       |
| **Adapter**       | `adapter` property                       | Kept as-is                  | Pass via context/prop            | Wrapped in hooks       |

---

## Dependency Graph

```
S3Explorer (Root Component)
├── useBufferState
│   ├── BufferState (reducer logic)
│   ├── useFileOperations (adapter wrapper)
│   │   └── Adapter (S3/mock)
│   └── ConfigManager (pass via context)
├── useKeyboardEvents
│   └── bufferState dispatch
└── Component Tree
    ├── BufferView
    ├── StatusBar
    ├── PreviewPane
    ├── HelpWindow (conditional)
    ├── SortMenu (conditional)
    └── ConfirmationDialog (conditional)
```

---

## Testing Strategy After Refactoring

### Unit Tests

- `useBufferState`: Test reducer logic with various actions
- Individual component rendering with mock props
- Keyboard event routing logic

### Integration Tests

- Component tree with real state management
- Dialog workflows (open → user action → close)
- Multi-step operations (navigate → edit → save)

### E2E Tests

- Full user workflows with test adapter
- Keyboard sequences (gg, dd, yy)
- Complex state transitions

---

## Migration Priority

1. **Phase 1**: Extract `useBufferState` hook (lowest risk, tests all state logic)
2. **Phase 2**: Extract individual components (BufferView, StatusBar, PreviewPane)
3. **Phase 3**: Extract input handling (`useKeyboardEvents`)
4. **Phase 4**: Implement dialogs as React components
5. **Phase 5**: Complete deprecation of S3Explorer class

---

## Critical Implementation Notes

### 1. Keyboard Event Integration

- Current: `renderer.keyInput.on('keypress', ...)`
- After: React hook needs to attach to OpenTUI's renderer
- Solution: useEffect to subscribe, cleanup to unsubscribe

### 2. Render Timing

- Current: Explicit `render()` calls after every action
- After: React's batched updates
- Consideration: May need batching logic for large state changes

### 3. Preview Pane Loading

- Current: Async `previewEntry()` updates internal state
- After: useEffect for async loading based on selectedEntry

### 4. Undo/Redo

- Current: Stored in BufferState.undoHistory
- After: Can stay in BufferState or moved to separate hook
- Ensure history cloning works correctly

### 5. Search Filter Application

- Current: Applied during `getFilteredEntries()`
- After: Same logic, but filtering happens during render
- Ensure search results update immediately on query change

---

## Code Metrics

| Metric                    | Value |
| ------------------------- | ----- |
| **Lines of Code**         | 924   |
| **Methods**               | 25+   |
| **State Variables**       | 13    |
| **UI Components Managed** | 7     |
| **Edit Modes**            | 5     |
| **Key Sequences**         | 10+   |
| **Async Operations**      | 3+    |

**After Refactoring**: Expected reduction to ~100-150 lines in main component + distributed logic in hooks and components.
