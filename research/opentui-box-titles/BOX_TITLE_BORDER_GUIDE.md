# OpenTUI Box Component: Title & Border Behavior Guide

## Quick Summary

**The Issue:** When you add text children directly to a `BoxRenderable` with a `title` prop and `borderStyle`, the text may appear in the border/title area instead of the content area.

**The Solution:** The `title` prop is intended ONLY for the box's built-in border title. Children added to the box are rendered in the content area controlled by the box's **scissor rect** (clipping region), which automatically accounts for the border.

---

## Understanding Box Titles in OpenTUI

### 1. The `title` Prop is Built-in to BoxRenderable

The `title` prop on `BoxRenderable` is **not** a child element. It's a rendering property that's drawn as part of the box's border:

```typescript
export interface BoxOptions<TRenderable extends Renderable = BoxRenderable> {
  backgroundColor?: string | RGBA
  borderStyle?: BorderStyle
  border?: boolean | BorderSides[]
  borderColor?: string | RGBA
  customBorderChars?: BorderCharacters
  shouldFill?: boolean
  title?: string                    // ← Built-in title in border
  titleAlignment?: "left" | "center" | "right"
  // ... other options
}
```

### 2. How Box Rendering Works

The `BoxRenderable` has a custom rendering method in the source:

```typescript
// From Box.ts
protected renderSelf(buffer: OptimizedBuffer): void {
  const currentBorderColor = this._focused ? this._focusedBorderColor : this._borderColor

  buffer.drawBox({
    x: this.x,
    y: this.y,
    width: this.width,
    height: this.height,
    borderStyle: this._borderStyle,
    customBorderChars: this._customBorderChars,
    border: this._border,
    borderColor: currentBorderColor,
    backgroundColor: this._backgroundColor,
    shouldFill: this.shouldFill,
    title: this._title,              // ← Drawn in border
    titleAlignment: this._titleAlignment,
  })
}
```

**Key Point:** The title is drawn by the low-level `buffer.drawBox()` function as part of the border rendering, NOT as a child component.

### 3. Content Area is Protected by Scissor Rect

OpenTUI uses a **scissor rect** (clipping region) to prevent children from rendering on top of the border:

```typescript
// From Box.ts
protected getScissorRect(): { x: number; y: number; width: number; height: number } {
  const baseRect = super.getScissorRect()

  if (!this.borderSides.top && !this.borderSides.right && !this.borderSides.bottom && !this.borderSides.left) {
    return baseRect
  }

  // Inset the content area by 1 cell for each border
  const leftInset = this.borderSides.left ? 1 : 0
  const rightInset = this.borderSides.right ? 1 : 0
  const topInset = this.borderSides.top ? 1 : 0
  const bottomInset = this.borderSides.bottom ? 1 : 0

  return {
    x: baseRect.x + leftInset,
    y: baseRect.y + topInset,
    width: Math.max(0, baseRect.width - leftInset - rightInset),
    height: Math.max(0, baseRect.height - topInset - bottomInset),
  }
}
```

**How it works:**
1. When a box has a border, the scissor rect is inset by 1 cell
2. This prevents children from rendering in the border area
3. Children are automatically clipped to stay within the content area

---

## Real-World Examples from OpenTUI

### Example 1: Box with Title Only (No Text Children)

```typescript
const boxObject = new BoxRenderable(renderer, {
  id: "box-object",
  position: "absolute",
  left: 10,
  top: 8,
  width: 8,
  height: 4,
  backgroundColor: "#FF6B6B",
  borderStyle: "single",
  borderColor: "#FFFFFF",
  title: "Box",                    // ← Title in border
  titleAlignment: "center",
})
this.parentContainer.add(boxObject)
```

**Rendering:**
```
┌─ Box ─┐
│       │
│       │
└───────┘
```

### Example 2: Box with Title AND Text Content (Correct Approach)

```typescript
// Create container box
const statusBox = new BoxRenderable(renderer, {
  id: "status",
  position: "absolute",
  left: 2,
  top: 24,
  width: 60,
  height: 14,
  backgroundColor: "#1a1a2e",
  borderStyle: "single",
  borderColor: "#FFFFFF",
  title: "Animation Values",     // ← Title in border
  titleAlignment: "center",
})
this.parentContainer.add(statusBox)

// Add TEXT CHILDREN with absolute positioning INSIDE the box
const statusLine1 = new TextRenderable(renderer, {
  id: "status-line1",
  content: "Timeline: Initializing...",
  position: "absolute",
  left: 4,    // ← Positioned inside box with padding
  top: 25,    // ← Below the border and title
  fg: "#FFFFFF",
})
this.parentContainer.add(statusLine1)
```

**Key Points:**
1. The `title` prop is in the border
2. Children use `position: "absolute"` with explicit `left` and `top`
3. Children are positioned INSIDE the box's scissor rect
4. The scissor rect automatically prevents overflow into the border

**Rendering:**
```
┌─ Animation Values ─────────────────────────────────┐
│ Timeline: Initializing...                          │
│ Box Position: x=0.0, y=0.0                         │
│ Box Scale/Rot: scale=1.0, rot=0.0                  │
└────────────────────────────────────────────────────┘
```

---

## Why Text Might Appear in the Border

### Scenario 1: Children Not Positioned Correctly

```typescript
// ❌ WRONG: Text will render at box coordinates, potentially overlapping border
const box = new BoxRenderable(renderer, {
  id: "box",
  position: "absolute",
  left: 10,
  top: 5,
  width: 30,
  height: 10,
  borderStyle: "rounded",
  title: "Title",
})

const text = new TextRenderable(renderer, {
  id: "text",
  content: "Content",
  // No position specified - defaults to box's top-left!
})

box.add(text)
```

**Problem:** Text inherits the box's position, rendering on top of the border.

### Scenario 2: Using Flex Layout Without Padding

```typescript
// ❌ PROBLEMATIC: Flex children might position at box edge
const box = new BoxRenderable(renderer, {
  id: "box",
  flexDirection: "column",
  width: 40,
  height: 10,
  borderStyle: "rounded",
  title: "Title",
  border: true,
})

const text = new TextRenderable(renderer, {
  id: "text",
  content: "Content",
  // Flex layout - might place at box edge
})

box.add(text)
```

**Problem:** Flex layout doesn't automatically account for the border visually. The scissor rect prevents rendering, but layout might be off.

---

## Correct Patterns for Boxes with Titles

### Pattern 1: Absolute Positioning Inside Box (Recommended)

```typescript
// Container with title and border
const box = new BoxRenderable(renderer, {
  id: "dialog",
  position: "absolute",
  left: 10,
  top: 5,
  width: 40,
  height: 12,
  backgroundColor: "#1a1a2e",
  borderStyle: "rounded",
  borderColor: "#00FF00",
  title: "Settings",
  titleAlignment: "center",
  border: true,
})
renderer.root.add(box)

// Add text children with explicit positioning inside the box
const label = new TextRenderable(renderer, {
  id: "label",
  content: "Configuration:",
  position: "absolute",
  left: 12,              // Inside box (box.left + 2 for padding)
  top: 7,                // Below border and title
  fg: "#FFFFFF",
})
renderer.root.add(label)

const value = new TextRenderable(renderer, {
  id: "value",
  content: "Enabled",
  position: "absolute",
  left: 12,
  top: 8,
  fg: "#00FF00",
})
renderer.root.add(value)
```

### Pattern 2: Flex Layout with Manual Padding (For Complex Layouts)

```typescript
const container = new GroupRenderable(renderer, {
  id: "container",
  flexDirection: "column",
  width: 50,
  height: 15,
})

const box = new BoxRenderable(renderer, {
  id: "box",
  borderStyle: "single",
  borderColor: "#FFFFFF",
  title: "Form",
  titleAlignment: "center",
  border: true,
  padding: {              // Use padding to account for border
    top: 1,
    left: 2,
    right: 2,
    bottom: 1,
  },
  flexDirection: "column",
  gap: 1,
})

// Add children to the box - flex layout will respect padding
const input1 = new InputRenderable(renderer, {
  id: "input1",
  placeholder: "First field",
})
box.add(input1)

const input2 = new InputRenderable(renderer, {
  id: "input2",
  placeholder: "Second field",
})
box.add(input2)

container.add(box)
renderer.root.add(container)
```

### Pattern 3: GroupRenderable for Nested Content

```typescript
const box = new BoxRenderable(renderer, {
  id: "panel",
  position: "absolute",
  left: 5,
  top: 3,
  width: 60,
  height: 20,
  backgroundColor: "#0a0a1a",
  borderStyle: "rounded",
  borderColor: "#00FF00",
  title: "Panel Title",
  titleAlignment: "center",
  border: true,
})
renderer.root.add(box)

// Create a group for content inside the box
const contentGroup = new GroupRenderable(renderer, {
  id: "content",
  position: "absolute",
  left: 7,               // Offset from box.left to account for border
  top: 5,                // Offset from box.top to account for border/title
  width: 54,             // box.width - 2*border
  height: 15,            // box.height - border - title - padding
  flexDirection: "column",
  gap: 1,
})

// Add children to the group
const header = new TextRenderable(renderer, {
  id: "header",
  content: "Header",
  fg: "#00FF00",
})
contentGroup.add(header)

const text1 = new TextRenderable(renderer, {
  id: "text1",
  content: "Line 1",
  fg: "#FFFFFF",
})
contentGroup.add(text1)

box.add(contentGroup)
```

---

## Box Component Properties Reference

### Border & Title Properties

```typescript
interface BoxOptions {
  // Border configuration
  border?: boolean | BorderSides[]           // Enable/disable border
  borderStyle?: "single" | "double" | "rounded" | "heavy"
  borderColor?: string | RGBA
  focusedBorderColor?: string | RGBA
  customBorderChars?: BorderCharacters

  // Title configuration
  title?: string                              // Text to show in border
  titleAlignment?: "left" | "center" | "right"

  // Content styling
  backgroundColor?: string | RGBA
  shouldFill?: boolean                        // Fill background

  // Layout (Yoga/Flexbox)
  padding?: { top?: number; left?: number; right?: number; bottom?: number }
  gap?: number | `${number}%`
  flexDirection?: "row" | "column"
  alignItems?: "flex-start" | "center" | "flex-end" | "stretch"
  justifyContent?: "flex-start" | "center" | "flex-end" | "space-between"
}
```

### Important: Padding vs Border

- **Border** (1 cell): Visual frame drawn by `drawBox()`, accounts for `title`
- **Padding** (Yoga prop): Internal spacing for flexbox children
- **Scissor Rect**: Automatic clipping that keeps children inside the border

---

## Debugging Checklist

If text is appearing in the border when it shouldn't:

- [ ] **Is the `title` prop being rendered correctly?** Check that `title` is actually intended as the border title, not child content
- [ ] **Are children using absolute positioning?** If so, verify `left` and `top` values place them inside the box
- [ ] **Are children sized correctly?** Check `width` and `height` don't extend past the box's content area
- [ ] **Is padding applied?** Use `padding` on the box to give flex children proper spacing from the border
- [ ] **Check scissor rect math:** For a box with border at position (10, 5), size (40, 10):
  - Content area starts at: (11, 6) due to 1-cell border inset
  - Content area size: (38, 8) after inset from all sides
- [ ] **Verify border is actually enabled:** Set `border: true` explicitly if using `borderStyle`
- [ ] **Check z-index:** Ensure children have higher z-index than the border if they should appear on top

---

## OpenTUI Box Source Code Reference

**Key Classes:**
- `BoxRenderable` (packages/core/src/renderables/Box.ts)
- `Renderable` base class (packages/core/src/Renderable.ts)

**Key Methods:**
- `BoxRenderable.renderSelf()` - Draws the box and border
- `BoxRenderable.getScissorRect()` - Defines the content clipping region
- `buffer.drawBox()` - Low-level border rendering in Zig

---

## Real-World Examples from OpenTUI Repository

**Timeline Example** (`timeline-example.ts`):
- Shows boxes with titles displayed on border
- Content rendered using separate TextRenderables with absolute positioning
- Pattern: Box title + positioned text children

**Input/Select Layout Demo** (`input-select-layout-demo.ts`):
- Demonstrates flex layout with bordered containers
- Uses padding to account for borders
- Pattern: Bordered boxes with flex children

---

## Summary Table

| Approach | Best For | Pros | Cons |
|----------|----------|------|------|
| **Title + Absolute Children** | Simple content boxes, dialogs | Clear separation, easy to position | Manual positioning needed |
| **Flex Layout + Padding** | Complex layouts, forms | Responsive, automatic layout | Requires padding setup |
| **GroupRenderable Inside Box** | Nested hierarchies | Organized structure | Extra nesting level |

---

**Status:** Research Complete  
**OpenTUI Version:** 0.1.44+  
**Last Updated:** November 2025

