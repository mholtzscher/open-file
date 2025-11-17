# OpenTUI Implementation Patterns & Examples

## Common Patterns for TUI Development

### 1. Application Shell Pattern

The most common pattern for structuring OpenTUI applications:

```typescript
import { createCliRenderer, type CliRenderer, type KeyEvent } from '@opentui/core';

class Application {
  private renderer: CliRenderer | null = null;
  private isRunning = false;

  async start() {
    this.renderer = await createCliRenderer({
      targetFps: 30,
      exitOnCtrlC: true,
    });

    this.isRunning = true;
    this.setupEventHandlers();
    this.render();

    // Optional: Use rendering loop
    // await this.renderer.start()
  }

  private setupEventHandlers() {
    if (!this.renderer) return;

    this.renderer.keyInput.on('keypress', (key: KeyEvent) => {
      this.handleKeyPress(key);
    });
  }

  private handleKeyPress(key: KeyEvent) {
    // Global shortcuts
    if (key.name === 'escape' || (key.ctrl && key.name === 'c')) {
      this.shutdown();
      return;
    }

    // Delegate to screen/component
    this.handleScreenKeyPress(key);
  }

  private handleScreenKeyPress(key: KeyEvent) {
    // Override in subclass
  }

  private render() {
    if (!this.renderer) return;
    this.renderer.root.removeAll();
    this.renderScreen();
  }

  private renderScreen() {
    // Override in subclass
  }

  private shutdown() {
    this.isRunning = false;
    process.exit(0);
  }
}
```

### 2. Screen Manager Pattern

Handle multiple screens/pages with navigation:

```typescript
type ScreenName = 'home' | 'edit' | 'settings';

class ScreenManager {
  private currentScreen: ScreenName = 'home';
  private renderer: any;
  private screens: Map<ScreenName, () => void> = new Map();

  constructor(renderer: any) {
    this.renderer = renderer;
  }

  registerScreen(name: ScreenName, render: () => void) {
    this.screens.set(name, render);
  }

  navigateTo(screen: ScreenName) {
    this.currentScreen = screen;
    this.render();
  }

  getCurrentScreen(): ScreenName {
    return this.currentScreen;
  }

  private render() {
    this.renderer.root.removeAll();
    const screenRender = this.screens.get(this.currentScreen);
    if (screenRender) {
      screenRender();
    }
  }
}

// Usage
const screenManager = new ScreenManager(renderer);

screenManager.registerScreen('home', () => {
  const text = new TextRenderable(renderer, {
    id: 'home-title',
    content: 'Home Screen',
  });
  renderer.root.add(text);
});

screenManager.registerScreen('settings', () => {
  const text = new TextRenderable(renderer, {
    id: 'settings-title',
    content: 'Settings Screen',
  });
  renderer.root.add(text);
});

screenManager.navigateTo('home');
```

### 3. Focus Navigation Pattern

Automatic tab navigation between interactive components:

```typescript
class FocusNavigator {
  private focusableComponents: Array<{
    id: string;
    component: any;
    onFocus?: () => void;
    onBlur?: () => void;
  }> = [];
  private currentIndex = 0;
  private renderer: any;

  constructor(renderer: any) {
    this.renderer = renderer;
  }

  register(id: string, component: any, callbacks?: { onFocus?: () => void; onBlur?: () => void }) {
    this.focusableComponents.push({
      id,
      component,
      onFocus: callbacks?.onFocus,
      onBlur: callbacks?.onBlur,
    });
  }

  initialize() {
    if (this.focusableComponents.length > 0) {
      this.focus(0);
    }
  }

  moveNext() {
    this.focus((this.currentIndex + 1) % this.focusableComponents.length);
  }

  movePrev() {
    this.focus(
      (this.currentIndex - 1 + this.focusableComponents.length) % this.focusableComponents.length
    );
  }

  private focus(index: number) {
    // Blur current
    this.focusableComponents[this.currentIndex]?.component.blur();
    this.focusableComponents[this.currentIndex]?.onBlur?.();

    // Focus new
    this.currentIndex = index;
    this.focusableComponents[this.currentIndex]?.component.focus();
    this.focusableComponents[this.currentIndex]?.onFocus?.();
  }
}

// Usage
const focusNav = new FocusNavigator(renderer);

focusNav.register('input1', nameInput, {
  onFocus: () => console.log('Name input focused'),
});

focusNav.register('input2', emailInput, {
  onFocus: () => console.log('Email input focused'),
});

focusNav.initialize();

renderer.keyInput.on('keypress', (key: KeyEvent) => {
  if (key.name === 'tab') {
    if (key.shift) {
      focusNav.movePrev();
    } else {
      focusNav.moveNext();
    }
  }
});
```

### 4. Modal Dialog Pattern

Display modal overlays on top of content:

```typescript
class Modal {
  private renderer: any;
  private isVisible = false;
  private container: BoxRenderable | null = null;
  private onConfirm?: (value: any) => void;
  private onCancel?: () => void;

  constructor(
    renderer: any,
    options: {
      title: string;
      message: string;
      buttons?: Array<{ label: string; value: any }>;
      width?: number;
      height?: number;
    }
  ) {
    this.renderer = renderer;
    this.options = options;
  }

  show(onConfirm?: (value: any) => void, onCancel?: () => void) {
    this.onConfirm = onConfirm;
    this.onCancel = onCancel;
    this.isVisible = true;
    this.render();
  }

  hide() {
    this.isVisible = false;
    if (this.container) {
      this.renderer.root.remove(this.container.id);
    }
  }

  private render() {
    // Create modal container with high z-index
    this.container = new BoxRenderable(this.renderer, {
      id: 'modal',
      position: 'absolute',
      left: 20,
      top: 10,
      width: this.options.width || 40,
      height: this.options.height || 12,
      backgroundColor: '#1a1a2e',
      borderStyle: 'rounded',
      borderColor: '#00FF00',
      title: this.options.title,
      zIndex: 1000, // Ensure it's on top
    });

    const message = new TextRenderable(this.renderer, {
      id: 'modal-message',
      content: this.options.message,
      position: 'absolute',
      left: 2,
      top: 2,
    });
    this.container.add(message);

    this.renderer.root.add(this.container);
  }
}
```

### 5. Form Handling Pattern

Collect and validate form data:

```typescript
interface FormField {
  id: string;
  name: string;
  type: 'text' | 'select' | 'toggle';
  value: any;
  validate?: (value: any) => string | null; // Error message or null
}

class Form {
  private fields: Map<string, FormField> = new Map();
  private values: Record<string, any> = {};
  private errors: Record<string, string> = {};
  private renderer: any;

  constructor(renderer: any) {
    this.renderer = renderer;
  }

  addField(field: FormField) {
    this.fields.set(field.id, field);
    this.values[field.id] = field.value;
  }

  setValue(fieldId: string, value: any) {
    this.values[fieldId] = value;

    // Validate
    const field = this.fields.get(fieldId);
    if (field?.validate) {
      const error = field.validate(value);
      if (error) {
        this.errors[fieldId] = error;
      } else {
        delete this.errors[fieldId];
      }
    }
  }

  getValue(fieldId: string) {
    return this.values[fieldId];
  }

  getError(fieldId: string) {
    return this.errors[fieldId] || null;
  }

  isValid(): boolean {
    return Object.keys(this.errors).length === 0;
  }

  getValues() {
    return { ...this.values };
  }

  render() {
    let topOffset = 2;

    for (const [id, field] of this.fields) {
      // Render field label
      const label = new TextRenderable(this.renderer, {
        id: `label-${id}`,
        content: field.name,
        position: 'absolute',
        left: 2,
        top: topOffset,
        fg: '#FFFFFF',
      });
      this.renderer.root.add(label);

      // Render field error (if any)
      const error = this.getError(id);
      if (error) {
        const errorText = new TextRenderable(this.renderer, {
          id: `error-${id}`,
          content: error,
          position: 'absolute',
          left: 2,
          top: topOffset + 1,
          fg: '#FF0000',
        });
        this.renderer.root.add(errorText);
        topOffset += 2;
      }

      topOffset += 2;
    }
  }
}

// Usage
const form = new Form(renderer);

form.addField({
  id: 'email',
  name: 'Email',
  type: 'text',
  value: '',
  validate: value => {
    if (!value.includes('@')) {
      return 'Invalid email format';
    }
    return null;
  },
});

form.addField({
  id: 'password',
  name: 'Password',
  type: 'text',
  value: '',
  validate: value => {
    if (value.length < 6) {
      return 'Password must be at least 6 characters';
    }
    return null;
  },
});
```

### 6. List Rendering Pattern

Efficiently render large lists:

```typescript
class ListRenderer {
  private items: any[] = [];
  private selectedIndex = 0;
  private viewportHeight = 10;
  private topVisibleIndex = 0;
  private renderer: any;

  constructor(renderer: any, viewportHeight: number = 10) {
    this.renderer = renderer;
    this.viewportHeight = viewportHeight;
  }

  setItems(items: any[]) {
    this.items = items;
    this.selectedIndex = 0;
    this.topVisibleIndex = 0;
  }

  selectNext() {
    this.selectedIndex = Math.min(this.selectedIndex + 1, this.items.length - 1);
    this.ensureVisible();
  }

  selectPrev() {
    this.selectedIndex = Math.max(0, this.selectedIndex - 1);
    this.ensureVisible();
  }

  private ensureVisible() {
    if (this.selectedIndex < this.topVisibleIndex) {
      this.topVisibleIndex = this.selectedIndex;
    }
    if (this.selectedIndex >= this.topVisibleIndex + this.viewportHeight) {
      this.topVisibleIndex = this.selectedIndex - this.viewportHeight + 1;
    }
  }

  render(startY: number): void {
    const visibleItems = this.items.slice(
      this.topVisibleIndex,
      this.topVisibleIndex + this.viewportHeight
    );

    visibleItems.forEach((item, index) => {
      const realIndex = this.topVisibleIndex + index;
      const isSelected = realIndex === this.selectedIndex;
      const bg = isSelected ? '#3b82f6' : 'transparent';
      const content = `${isSelected ? '>' : ' '} ${item.name}`;

      const itemText = new TextRenderable(this.renderer, {
        id: `list-item-${realIndex}`,
        content,
        position: 'absolute',
        left: 2,
        top: startY + index,
        backgroundColor: bg,
      });
      this.renderer.root.add(itemText);
    });

    // Render scroll indicator
    const scrollPercent =
      this.topVisibleIndex / Math.max(1, this.items.length - this.viewportHeight);
    const scrollPos = Math.floor(scrollPercent * this.viewportHeight);

    const scrollBar = new TextRenderable(this.renderer, {
      id: 'scrollbar',
      content: '█',
      position: 'absolute',
      left: 40,
      top: startY + scrollPos,
      fg: '#CCCCCC',
    });
    this.renderer.root.add(scrollBar);
  }
}
```

### 7. Async Loading Pattern

Handle async operations with loading states:

```typescript
class AsyncDataLoader {
  private isLoading = false;
  private error: string | null = null;
  private data: any = null;

  async load(fetchFn: () => Promise<any>) {
    this.isLoading = true;
    this.error = null;

    try {
      this.data = await fetchFn();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Unknown error';
    } finally {
      this.isLoading = false;
    }
  }

  getState() {
    return {
      isLoading: this.isLoading,
      error: this.error,
      data: this.data,
    };
  }

  render(renderer: any, y: number) {
    if (this.isLoading) {
      const loadingText = new TextRenderable(renderer, {
        id: 'loading',
        content: 'Loading... ⠋',
        position: 'absolute',
        left: 5,
        top: y,
        fg: '#FFFF00',
      });
      renderer.root.add(loadingText);
    } else if (this.error) {
      const errorText = new TextRenderable(renderer, {
        id: 'error',
        content: `Error: ${this.error}`,
        position: 'absolute',
        left: 5,
        top: y,
        fg: '#FF0000',
      });
      renderer.root.add(errorText);
    } else if (this.data) {
      const dataText = new TextRenderable(renderer, {
        id: 'data',
        content: JSON.stringify(this.data),
        position: 'absolute',
        left: 5,
        top: y,
        fg: '#00FF00',
      });
      renderer.root.add(dataText);
    }
  }
}

// Usage
const loader = new AsyncDataLoader();

// Start loading
loader.load(async () => {
  const response = await fetch('https://api.example.com/data');
  return response.json();
});
```

### 8. Keyboard Shortcut Manager

Centralized keyboard handling:

```typescript
type KeyHandler = (key: KeyEvent) => void;

class ShortcutManager {
  private shortcuts: Map<string, KeyHandler> = new Map();
  private localShortcuts: Map<string, KeyHandler> = new Map();
  private renderer: any;

  constructor(renderer: any) {
    this.renderer = renderer;
    this.setupGlobalListeners();
  }

  private setupGlobalListeners() {
    this.renderer.keyInput.on('keypress', (key: KeyEvent) => {
      const keySignature = this.getKeySignature(key);

      // Try local shortcuts first (focused component)
      if (this.localShortcuts.has(keySignature)) {
        const handler = this.localShortcuts.get(keySignature);
        if (handler) {
          handler(key);
          return;
        }
      }

      // Then global shortcuts
      if (this.shortcuts.has(keySignature)) {
        const handler = this.shortcuts.get(keySignature);
        if (handler) {
          handler(key);
        }
      }
    });
  }

  registerGlobal(keyCombo: string, handler: KeyHandler) {
    this.shortcuts.set(keyCombo, handler);
  }

  registerLocal(keyCombo: string, handler: KeyHandler) {
    this.localShortcuts.set(keyCombo, handler);
  }

  private getKeySignature(key: KeyEvent): string {
    const parts: string[] = [];
    if (key.ctrl) parts.push('ctrl');
    if (key.shift) parts.push('shift');
    if (key.meta) parts.push('alt');
    parts.push(key.name);
    return parts.join('+');
  }
}

// Usage
const shortcuts = new ShortcutManager(renderer);

shortcuts.registerGlobal('ctrl+c', () => {
  console.log('Exit');
  process.exit(0);
});

shortcuts.registerGlobal('ctrl+s', () => {
  console.log('Save');
});

shortcuts.registerLocal('tab', () => {
  console.log('Move to next field');
});
```

---

## Complete Application Example: Interactive Todo CLI

```typescript
import {
  createCliRenderer,
  BoxRenderable,
  TextRenderable,
  InputRenderable,
  SelectRenderable,
  GroupRenderable,
  RenderableEvents,
  InputRenderableEvents,
  SelectRenderableEvents,
  type KeyEvent,
  type CliRenderer,
  t,
  bold,
  fg,
} from '@opentui/core';

interface Todo {
  id: number;
  title: string;
  completed: boolean;
}

class TodoCLI {
  private renderer: CliRenderer | null = null;
  private todos: Todo[] = [];
  private nextId = 1;
  private screen: 'list' | 'add' | 'detail' = 'list';
  private selectedTodoId: number | null = null;

  async run() {
    this.renderer = await createCliRenderer({
      targetFps: 30,
      exitOnCtrlC: true,
      consoleOptions: {
        position: 'bottom',
        sizePercent: 20,
      },
    });

    this.setupEventHandlers();
    this.addSampleTodos();
    this.render();
  }

  private addSampleTodos() {
    this.todos.push(
      { id: 1, title: 'Learn OpenTUI', completed: false },
      { id: 2, title: 'Build a CLI app', completed: false },
      { id: 3, title: 'Deploy to production', completed: false }
    );
    this.nextId = 4;
  }

  private render() {
    if (!this.renderer) return;

    this.renderer.root.removeAll();

    switch (this.screen) {
      case 'list':
        this.renderListScreen();
        break;
      case 'add':
        this.renderAddScreen();
        break;
      case 'detail':
        this.renderDetailScreen();
        break;
    }
  }

  private renderListScreen() {
    if (!this.renderer) return;

    // Header
    const header = new TextRenderable(this.renderer, {
      id: 'header',
      content: t`${bold(fg('#00FF00')('📋 Todo List'))}`,
      position: 'absolute',
      left: 2,
      top: 1,
    });
    this.renderer.root.add(header);

    // Todo items
    this.todos.forEach((todo, index) => {
      const checkbox = todo.completed ? '☑' : '☐';
      const content = `${checkbox} ${todo.title}`;
      const color = todo.completed ? '#666666' : '#FFFFFF';

      const item = new TextRenderable(this.renderer!, {
        id: `todo-${todo.id}`,
        content,
        position: 'absolute',
        left: 4,
        top: 4 + index,
        fg: color,
      });
      this.renderer.root.add(item);
    });

    // Instructions
    const instructions = new TextRenderable(this.renderer, {
      id: 'instructions',
      content: t`${bold('n')}: New | ${bold('Space')}: Toggle | ${bold('d')}: Delete | ${bold('q')}: Quit`,
      position: 'absolute',
      left: 2,
      bottom: 1,
      fg: '#00CCCC',
    });
    this.renderer.root.add(instructions);
  }

  private renderAddScreen() {
    if (!this.renderer) return;

    const dialog = new BoxRenderable(this.renderer, {
      id: 'add-dialog',
      position: 'absolute',
      left: 10,
      top: 5,
      width: 60,
      height: 8,
      borderStyle: 'rounded',
      borderColor: '#00FF00',
      backgroundColor: '#0a0a1a',
      title: 'Add New Todo',
      titleAlignment: 'center',
    });

    const input = new InputRenderable(this.renderer, {
      id: 'todo-input',
      position: 'absolute',
      left: 12,
      top: 7,
      width: 56,
      height: 3,
      placeholder: 'Enter todo title...',
      backgroundColor: '#1a1a2e',
      textColor: '#FFFFFF',
      placeholderColor: '#666666',
    });

    input.on(InputRenderableEvents.ENTER, (value: string) => {
      if (value.trim()) {
        this.todos.push({
          id: this.nextId++,
          title: value.trim(),
          completed: false,
        });
      }
      this.screen = 'list';
      this.render();
    });

    this.renderer.root.add(dialog);
    this.renderer.root.add(input);
    input.focus();
  }

  private renderDetailScreen() {
    if (!this.renderer) return;

    const todo = this.todos.find(t => t.id === this.selectedTodoId);
    if (!todo) {
      this.screen = 'list';
      this.render();
      return;
    }

    const dialog = new BoxRenderable(this.renderer, {
      id: 'detail-dialog',
      position: 'absolute',
      left: 10,
      top: 5,
      width: 60,
      height: 10,
      borderStyle: 'rounded',
      borderColor: '#00FFFF',
      backgroundColor: '#0a0a1a',
      title: 'Todo Detail',
      titleAlignment: 'center',
    });

    const title = new TextRenderable(this.renderer, {
      id: 'detail-title',
      content: t`${bold('Title:')} ${todo.title}`,
      position: 'absolute',
      left: 12,
      top: 7,
    });

    const status = new TextRenderable(this.renderer, {
      id: 'detail-status',
      content: t`${bold('Status:')} ${todo.completed ? fg('#00FF00')('Completed') : fg('#FFFF00')('Pending')}`,
      position: 'absolute',
      left: 12,
      top: 9,
    });

    this.renderer.root.add(dialog);
    this.renderer.root.add(title);
    this.renderer.root.add(status);
  }

  private setupEventHandlers() {
    if (!this.renderer) return;

    this.renderer.keyInput.on('keypress', (key: KeyEvent) => {
      if (key.name === 'escape' || (key.ctrl && key.name === 'c')) {
        process.exit(0);
      }

      if (this.screen === 'list') {
        this.handleListKeys(key);
      }
    });
  }

  private handleListKeys(key: KeyEvent) {
    if (key.name === 'n') {
      this.screen = 'add';
      this.render();
    } else if (key.name === 'space') {
      const firstIncomplete = this.todos.find(t => !t.completed);
      if (firstIncomplete) {
        firstIncomplete.completed = !firstIncomplete.completed;
        this.render();
      }
    } else if (key.name === 'd') {
      if (this.todos.length > 0) {
        this.todos.shift();
        this.render();
      }
    }
  }
}

const app = new TodoCLI();
app.run();
```

---

## Performance Considerations

1. **Avoid excessive renders**: Only re-render when state changes
2. **Use passive rendering**: Don't call `renderer.start()` unless needed
3. **Batch DOM updates**: Add multiple items in a container, not individually
4. **Limit FPS**: Lower target FPS for non-interactive apps
5. **Defer async operations**: Load data asynchronously, don't block rendering

---

**Last Updated:** November 2025
