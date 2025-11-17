# OpenTUI Box Titles: Quick Reference

## TL;DR - Fix Your Box Title Issue

### Problem
```typescript
// ❌ WRONG - Text appears in border or is ignored
const box = new BoxRenderable(renderer, {
  title: "My Title",
  borderStyle: "rounded",
});
const text = new TextRenderable(renderer, { content: "Content" });
box.add(text);
```

### Solution
```typescript
// ✅ CORRECT - Title in border, content positioned inside
const box = new BoxRenderable(renderer, {
  id: "box",
  position: "absolute",
  left: 10,
  top: 5,
  width: 40,
  height: 10,
  title: "My Title",           // ← In border
  titleAlignment: "center",
  borderStyle: "rounded",
  border: true,
});
renderer.root.add(box);

const text = new TextRenderable(renderer, {
  id: "content",
  content: "Content",
  position: "absolute",
  left: 12,                    // ← Inside box (10 + 2)
  top: 7,                      // ← Below border+title
  fg: "#FFFFFF",
});
renderer.root.add(text);
```

---

## Core Concepts

### 1. `title` is NOT a child element
- It's a **border property** that renders as part of the box frame
- Use `title` prop, not by adding a text child

### 2. Scissor rect automatically protects content
- OpenTUI clips children to stay within box bounds
- 1-cell inset from each border side
- You still need to position children correctly for visibility

### 3. Children need explicit positioning
- Use `position: "absolute"` with `left` and `top`
- Calculate for border (1 cell) + title (1 cell if title exists)
- Can be positioned anywhere, not just inside the box

---

## Quick Solutions

### Dialog Box (Title + Content)
```typescript
const box = new BoxRenderable(renderer, {
  id: 'dialog',
  position: 'absolute', left: 10, top: 5,
  width: 40, height: 10,
  title: 'Dialog',
  borderStyle: 'rounded',
  border: true,
});
renderer.root.add(box);

// Position content INSIDE
const content = new TextRenderable(renderer, {
  content: 'Message here',
  position: 'absolute',
  left: 12, top: 7,  // +2 for border/title
});
renderer.root.add(content);
```

### Flex Layout (Title + Flex Children)
```typescript
const box = new BoxRenderable(renderer, {
  borderStyle: 'single',
  title: 'Form',
  border: true,
  padding: { top: 1, left: 2, right: 2, bottom: 1 },
  flexDirection: 'column',
  gap: 1,
});

// Children automatically respect padding
const input = new InputRenderable(renderer, { placeholder: 'Name' });
box.add(input);
```

### Multiple Boxes (Title + Nested Content)
```typescript
// Outer box
const outer = new BoxRenderable(renderer, {
  position: 'absolute', left: 5, top: 2,
  width: 50, height: 15,
  title: 'Outer',
  border: true,
});
renderer.root.add(outer);

// Inner box (positioned inside outer)
const inner = new BoxRenderable(renderer, {
  position: 'absolute',
  left: 8, top: 5,        // Inside outer box
  width: 25, height: 8,
  title: 'Inner',
  border: true,
});
renderer.root.add(inner);
```

---

## Box Properties Cheat Sheet

```typescript
const box = new BoxRenderable(renderer, {
  // Positioning
  position: 'absolute',
  left: 10,
  top: 5,
  width: 40,
  height: 10,
  
  // Border & Title
  border: true,
  borderStyle: 'single' | 'double' | 'rounded' | 'heavy',
  borderColor: '#FFFFFF',
  title: 'Title Text',
  titleAlignment: 'left' | 'center' | 'right',
  
  // Appearance
  backgroundColor: '#1a1a2e',
  shouldFill: true,
  
  // Layout (if using flex children)
  padding: { top: 1, left: 2, right: 2, bottom: 1 },
  flexDirection: 'column' | 'row',
  gap: 1,
  alignItems: 'center' | 'flex-start' | 'flex-end',
});
```

---

## Positioning Math

For box at **(left, top)** with **size (width, height)**:

```
Border takes 1 cell on each side
Title takes 1 cell (if present)

Example: Box at (10, 5), size (40, 10), with border + title
┌─ Title ──────────────────────┐
│                              │
└──────────────────────────────┘

Content area:
- Starts at: (11, 6)     // (left+1, top+1)
- Width: 38              // (width-2)
- Height: 8              // (height-2)

Safe positioning for children:
- Minimum left: 12       // left + 2
- Minimum top: 7         // top + 2 (border + title)
```

---

## Common Mistakes

| Mistake | Problem | Fix |
|---------|---------|-----|
| No `position: "absolute"` on child | Child renders at box origin | Add `position: 'absolute'` |
| Wrong coordinates | Content overlaps border | Add +2 to `left`, +2 to `top` |
| Using text as child instead of title | Title isn't visible | Use `title` prop on box |
| No `border: true` | No box visible | Set `border: true` |
| Flex children overlap border | Content in border area | Add `padding` to box |
| Z-index conflicts | Borders hidden behind content | Adjust z-index values |

---

## When to Use Each Approach

### Absolute Positioning
```typescript
// Best for: Dialogs, simple forms, manual layouts
// Pros: Full control, clear positioning
// Cons: Manual calculations needed

const box = new BoxRenderable(renderer, { /* ... */ });
const text = new TextRenderable(renderer, {
  position: 'absolute',
  left: 12, top: 7,
});
```

### Flex Layout
```typescript
// Best for: Complex forms, responsive layouts
// Pros: Automatic positioning, scales well
// Cons: Less direct control

const box = new BoxRenderable(renderer, {
  flexDirection: 'column',
  padding: { /* ... */ },
});
```

### Nested Boxes
```typescript
// Best for: Multi-pane UIs, hierarchical layouts
// Pros: Organized structure
// Cons: Extra nesting level

const outer = new BoxRenderable(renderer, { /* ... */ });
const inner = new BoxRenderable(renderer, { /* ... */ });
renderer.root.add(outer);
renderer.root.add(inner);
```

---

## Debugging Checklist

Text appearing in border?
- [ ] Is `title` prop being set? (Good - means title works)
- [ ] Are children using `position: "absolute"`?
- [ ] Is `left` coordinate >= box.left + 2?
- [ ] Is `top` coordinate >= box.top + 2?
- [ ] Is `border: true` set?

---

## API Reference

### BoxOptions
```typescript
interface BoxOptions {
  // Core
  id?: string
  position?: 'absolute' | 'relative'
  left?: number
  top?: number
  width?: number | string
  height?: number | string
  
  // Border & Title
  border?: boolean | BorderSides[]
  borderStyle?: 'single' | 'double' | 'rounded' | 'heavy'
  borderColor?: string | RGBA
  focusedBorderColor?: string | RGBA
  customBorderChars?: BorderCharacters
  title?: string
  titleAlignment?: 'left' | 'center' | 'right'
  
  // Appearance
  backgroundColor?: string | RGBA
  shouldFill?: boolean
  zIndex?: number
  
  // Layout
  padding?: { top?: number; left?: number; right?: number; bottom?: number }
  gap?: number | `${number}%`
  flexDirection?: 'row' | 'column'
  justifyContent?: 'flex-start' | 'center' | 'flex-end' | 'space-between'
  alignItems?: 'flex-start' | 'center' | 'flex-end' | 'stretch'
  flexGrow?: number
  flexShrink?: number
}
```

### TextRenderable (for content inside box)
```typescript
interface TextRenderableOptions {
  id?: string
  content: string
  position?: 'absolute' | 'relative'
  left?: number
  top?: number
  fg?: string | RGBA         // Foreground color
  attributes?: TextAttributes
}
```

---

## Resources

- **Full Guide**: `BOX_TITLE_BORDER_GUIDE.md`
- **Examples**: `PRACTICAL_EXAMPLES.md`
- **Source**: https://github.com/sst/opentui
- **Docs**: https://opentui.com

---

**OpenTUI v0.1.44+ | Quick Reference v1.0**

