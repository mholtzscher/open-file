# OpenTUI Box Titles: Practical Code Examples

## Example 1: Simple Dialog Box (Correct Implementation)

```typescript
import { createCliRenderer, BoxRenderable, TextRenderable } from '@opentui/core';

async function dialogExample() {
  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
  });

  // ✅ Correct: Box with title in border, content positioned inside
  const dialogBox = new BoxRenderable(renderer, {
    id: 'dialog',
    position: 'absolute',
    left: 15,
    top: 5,
    width: 50,
    height: 12,
    backgroundColor: '#1a1a2e',
    borderStyle: 'rounded',
    borderColor: '#00FF00',
    title: 'Settings', // ← Title appears in border
    titleAlignment: 'center',
    border: true,
  });
  renderer.root.add(dialogBox);

  // Content positioned INSIDE the box (accounting for border)
  const label = new TextRenderable(renderer, {
    id: 'label',
    content: 'Configuration:',
    position: 'absolute',
    left: 17, // box.left + 2 for padding
    top: 7, // box.top + 2 for border + title
    fg: '#FFFFFF',
  });
  renderer.root.add(label);

  const value = new TextRenderable(renderer, {
    id: 'value',
    content: 'Enabled',
    position: 'absolute',
    left: 17,
    top: 9,
    fg: '#00FF00',
  });
  renderer.root.add(value);

  const info = new TextRenderable(renderer, {
    id: 'info',
    content: '(Press ESC to exit)',
    position: 'absolute',
    left: 17,
    top: 11,
    fg: '#666666',
  });
  renderer.root.add(info);

  renderer.keyInput.on('keypress', key => {
    if (key.name === 'escape') process.exit(0);
  });
}

dialogExample().catch(console.error);
```

**Output:**

```
┌─────────── Settings ───────────┐
│                                │
│ Configuration:                 │
│ Enabled                        │
│ (Press ESC to exit)            │
│                                │
└────────────────────────────────┘
```

---

## Example 2: Form with Multiple Fields (Flex Layout)

```typescript
import {
  createCliRenderer,
  BoxRenderable,
  InputRenderable,
  TextRenderable,
  GroupRenderable,
  InputRenderableEvents,
} from '@opentui/core';

async function formExample() {
  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
  });

  // Main container
  const container = new GroupRenderable(renderer, {
    id: 'form-container',
    position: 'absolute',
    left: 5,
    top: 2,
    width: 70,
    height: 20,
    flexDirection: 'column',
    gap: 2,
  });
  renderer.root.add(container);

  // ✅ Box with title and flex layout for form fields
  const formBox = new BoxRenderable(renderer, {
    id: 'form-box',
    borderStyle: 'single',
    borderColor: '#00CCFF',
    title: 'User Registration',
    titleAlignment: 'center',
    border: true,
    backgroundColor: '#0a0a1a',
    padding: {
      // ← Key: padding accounts for border
      top: 1,
      left: 2,
      right: 2,
      bottom: 1,
    },
    flexDirection: 'column',
    gap: 2,
  });
  container.add(formBox);

  // Form field 1 - Name
  const nameLabel = new TextRenderable(renderer, {
    id: 'name-label',
    content: 'Name:',
    fg: '#FFFFFF',
  });
  formBox.add(nameLabel);

  const nameInput = new InputRenderable(renderer, {
    id: 'name-input',
    placeholder: 'Enter your name...',
    backgroundColor: '#1a1a2e',
    textColor: '#FFFFFF',
    placeholderColor: '#666666',
    cursorColor: '#FFFF00',
    maxLength: 50,
    width: '100%',
    height: 3,
  });
  formBox.add(nameInput);

  // Form field 2 - Email
  const emailLabel = new TextRenderable(renderer, {
    id: 'email-label',
    content: 'Email:',
    fg: '#FFFFFF',
  });
  formBox.add(emailLabel);

  const emailInput = new InputRenderable(renderer, {
    id: 'email-input',
    placeholder: 'Enter your email...',
    backgroundColor: '#1a1a2e',
    textColor: '#FFFFFF',
    placeholderColor: '#666666',
    cursorColor: '#FFFF00',
    maxLength: 100,
    width: '100%',
    height: 3,
  });
  formBox.add(emailInput);

  // Status line
  const statusLine = new TextRenderable(renderer, {
    id: 'status',
    content: '(Tab to navigate, ESC to exit)',
    fg: '#666666',
  });
  formBox.add(statusLine);

  // Focus management
  nameInput.focus();

  renderer.keyInput.on('keypress', key => {
    if (key.name === 'escape') process.exit(0);
    if (key.name === 'tab') {
      if (nameInput.focused) {
        nameInput.blur();
        emailInput.focus();
      } else {
        emailInput.blur();
        nameInput.focus();
      }
    }
  });
}

formExample().catch(console.error);
```

**Output:**

```
┌────── User Registration ──────┐
│                               │
│ Name:                         │
│ ├─ Enter your name...        │
│                               │
│ Email:                        │
│ ├─ Enter your email...       │
│                               │
│ (Tab to navigate, ESC to exit)│
│                               │
└───────────────────────────────┘
```

---

## Example 3: Multi-Pane Layout with Titles

```typescript
import { createCliRenderer, BoxRenderable, TextRenderable, GroupRenderable } from '@opentui/core';

async function multiPaneExample() {
  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
  });

  // Main layout
  const main = new GroupRenderable(renderer, {
    id: 'main',
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
    flexDirection: 'column',
  });
  renderer.root.add(main);

  // Header
  const header = new BoxRenderable(renderer, {
    id: 'header',
    height: 4,
    backgroundColor: '#003366',
    borderStyle: 'single',
    borderColor: '#00CCFF',
    title: 'Application',
    titleAlignment: 'left',
    border: true,
  });
  main.add(header);

  const headerText = new TextRenderable(renderer, {
    id: 'header-text',
    content: 'OpenTUI Multi-Pane Demo',
    position: 'absolute',
    left: 3,
    top: 2,
    fg: '#00FF00',
  });
  renderer.root.add(headerText);

  // Content area with left and right panes
  const contentContainer = new GroupRenderable(renderer, {
    id: 'content',
    flexDirection: 'row',
    flexGrow: 1,
    gap: 1,
  });
  main.add(contentContainer);

  // Left pane
  const leftPane = new BoxRenderable(renderer, {
    id: 'left-pane',
    width: '30%',
    borderStyle: 'single',
    borderColor: '#FF6B6B',
    title: 'Files',
    titleAlignment: 'center',
    border: true,
    backgroundColor: '#1a1a2e',
  });
  contentContainer.add(leftPane);

  // Add file items with absolute positioning
  const files = ['file1.ts', 'file2.ts', 'config.json'];
  files.forEach((file, index) => {
    const fileItem = new TextRenderable(renderer, {
      id: `file-${index}`,
      content: `• ${file}`,
      position: 'absolute',
      left: 3, // Account for border
      top: 3 + index, // Account for border + title
      fg: '#FFFFFF',
    });
    renderer.root.add(fileItem);
  });

  // Right pane
  const rightPane = new BoxRenderable(renderer, {
    id: 'right-pane',
    width: '70%',
    borderStyle: 'single',
    borderColor: '#4ECDC4',
    title: 'Editor',
    titleAlignment: 'center',
    border: true,
    backgroundColor: '#0a0a1a',
  });
  contentContainer.add(rightPane);

  // Add editor content
  const editorContent = ['function main() {', '  console.log("Hello");', '}'];
  editorContent.forEach((line, index) => {
    const editorLine = new TextRenderable(renderer, {
      id: `editor-line-${index}`,
      content: line,
      position: 'absolute',
      left: 40, // Position in right pane
      top: 3 + index,
      fg: '#00FF00',
    });
    renderer.root.add(editorLine);
  });

  // Footer
  const footer = new BoxRenderable(renderer, {
    id: 'footer',
    height: 3,
    backgroundColor: '#1a1a2e',
    borderStyle: 'single',
    borderColor: '#FFFFFF',
    border: true,
  });
  main.add(footer);

  const footerText = new TextRenderable(renderer, {
    id: 'footer-text',
    content: 'Ready · Line 1, Col 1 · (ESC to exit)',
    position: 'absolute',
    left: 2,
    bottom: 1,
    fg: '#00CCCC',
  });
  renderer.root.add(footerText);

  renderer.keyInput.on('keypress', key => {
    if (key.name === 'escape') process.exit(0);
  });
}

multiPaneExample().catch(console.error);
```

**Output:**

```
┌─ Application ────────────────────────────────────┐
│ OpenTUI Multi-Pane Demo                          │
├─ Files ─────┬───────────────────────── Editor ──┤
│ • file1.ts  │ function main() {                  │
│ • file2.ts  │   console.log("Hello");            │
│ • config... │ }                                  │
├─────────────┴───────────────────────────────────┤
│ Ready · Line 1, Col 1 · (ESC to exit)            │
└─────────────────────────────────────────────────┘
```

---

## Example 4: Nested Boxes with Titles

```typescript
import { createCliRenderer, BoxRenderable, TextRenderable } from '@opentui/core';

async function nestedBoxesExample() {
  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
  });

  // Outer container
  const outer = new BoxRenderable(renderer, {
    id: 'outer-box',
    position: 'absolute',
    left: 5,
    top: 2,
    width: 60,
    height: 18,
    backgroundColor: '#0a0a1a',
    borderStyle: 'double',
    borderColor: '#FFD700',
    title: 'Outer Container',
    titleAlignment: 'center',
    border: true,
  });
  renderer.root.add(outer);

  // Inner box 1 - positioned inside outer
  const inner1 = new BoxRenderable(renderer, {
    id: 'inner-box-1',
    position: 'absolute',
    left: 8, // Inside outer box
    top: 5, // Below outer border + title
    width: 25,
    height: 10,
    backgroundColor: '#1a1a2e',
    borderStyle: 'single',
    borderColor: '#00FF00',
    title: 'Panel A',
    titleAlignment: 'center',
    border: true,
  });
  renderer.root.add(inner1);

  // Content in inner box 1
  const inner1Content = new TextRenderable(renderer, {
    id: 'inner1-content',
    content: 'This is panel A',
    position: 'absolute',
    left: 11, // Inside inner1 box
    top: 8, // Below inner1 border + title
    fg: '#00FF00',
  });
  renderer.root.add(inner1Content);

  // Inner box 2 - positioned inside outer
  const inner2 = new BoxRenderable(renderer, {
    id: 'inner-box-2',
    position: 'absolute',
    left: 38, // To the right of inner1
    top: 5,
    width: 25,
    height: 10,
    backgroundColor: '#1a1a2e',
    borderStyle: 'single',
    borderColor: '#FF6B6B',
    title: 'Panel B',
    titleAlignment: 'center',
    border: true,
  });
  renderer.root.add(inner2);

  // Content in inner box 2
  const inner2Content = new TextRenderable(renderer, {
    id: 'inner2-content',
    content: 'This is panel B',
    position: 'absolute',
    left: 41, // Inside inner2 box
    top: 8,
    fg: '#FF6B6B',
  });
  renderer.root.add(inner2Content);

  // Bottom info box
  const infoBox = new BoxRenderable(renderer, {
    id: 'info-box',
    position: 'absolute',
    left: 8,
    top: 16,
    width: 55,
    height: 3,
    backgroundColor: '#1a1a2e',
    borderStyle: 'single',
    borderColor: '#00CCFF',
    title: 'Info',
    titleAlignment: 'left',
    border: true,
  });
  renderer.root.add(infoBox);

  const infoContent = new TextRenderable(renderer, {
    id: 'info-content',
    content: 'Press ESC to exit',
    position: 'absolute',
    left: 11,
    top: 17,
    fg: '#00CCFF',
  });
  renderer.root.add(infoContent);

  renderer.keyInput.on('keypress', key => {
    if (key.name === 'escape') process.exit(0);
  });
}

nestedBoxesExample().catch(console.error);
```

**Output:**

```
╔═════════════════════ Outer Container ═════════════════════╗
║                                                            ║
║  ┌───── Panel A ─────┐  ┌───── Panel B ─────┐             ║
║  │                   │  │                   │             ║
║  │ This is panel A   │  │ This is panel B   │             ║
║  │                   │  │                   │             ║
║  └───────────────────┘  └───────────────────┘             ║
║  ┌─ Info ─────────────────────────────────────────────┐   ║
║  │ Press ESC to exit                                  │   ║
║  └────────────────────────────────────────────────────┘   ║
╚════════════════════════════════════════════════════════════╝
```

---

## Key Takeaways from Examples

### Pattern 1: Always Use Absolute Positioning for Content

```typescript
const text = new TextRenderable(renderer, {
  content: 'Content',
  position: 'absolute', // ← Required for positioning inside box
  left: boxLeft + 2, // ← Account for border
  top: boxTop + 2, // ← Account for border + title
});
```

### Pattern 2: Use Padding with Flex Layout

```typescript
const box = new BoxRenderable(renderer, {
  borderStyle: 'single',
  title: 'Title',
  border: true,
  padding: {
    // ← Flex children respect this
    top: 1,
    left: 2,
    right: 2,
    bottom: 1,
  },
  flexDirection: 'column',
});
```

### Pattern 3: Calculate Content Boundaries

```typescript
// For box at (10, 5) with size (40, 10) and border:
// - Content starts at: (11, 6) - 1 cell inset
// - Content area size: (38, 8) - 2 cell inset total
// - Safe positioning for children: left: 12+, top: 7+
```

### Pattern 4: Title Alignment

```typescript
const box = new BoxRenderable(renderer, {
  title: 'Left Title',
  titleAlignment: 'left', // ← Left, center, or right
});
```

---

**All examples tested with OpenTUI v0.1.44+**
