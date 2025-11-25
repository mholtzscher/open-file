# OpenTUI Box Components with Titles and Borders: Complete Research

## 📋 Overview

This research folder contains comprehensive documentation on how OpenTUI's `BoxRenderable` component handles borders, titles, and child content. It addresses the common issue where text content appears in the border area instead of inside the box's content area.

**Research Status:** ✅ Complete  
**OpenTUI Version:** 0.1.44+  
**Last Updated:** November 2025

---

## 📚 Contents

### 1. **QUICK_REFERENCE.md** - Start Here! ⭐

Quick answers to common questions:

- TL;DR fix for title/border issues
- Core concepts in 3 points
- Common mistakes and solutions
- Positioning math cheat sheet
- Debugging checklist

**Read this first if you want quick answers.**

### 2. **BOX_TITLE_BORDER_GUIDE.md** - Complete Guide

Deep dive into how boxes work:

- How the `title` prop works
- Box rendering internals (`renderSelf`, scissor rect)
- Why text appears in borders
- Correct patterns (3 approaches)
- Complete API reference
- Source code references

**Read this if you want to understand the implementation.**

### 3. **PRACTICAL_EXAMPLES.md** - Working Code

4 complete, runnable examples:

1. Simple Dialog Box
2. Form with Multiple Fields (Flex Layout)
3. Multi-Pane Layout with Titles
4. Nested Boxes with Titles

**Copy and adapt these for your use case.**

---

## 🎯 Quick Answer: Why Is My Text In The Border?

**The Issue:**

```typescript
const box = new BoxRenderable(renderer, {
  title: 'open-s3',
  borderStyle: 'rounded',
});
const text = new TextRenderable(renderer, { content: 'Text content' });
box.add(text);
// ❌ Text appears IN the border, title is ignored/overridden
```

**The Root Cause:**

1. The `title` prop is a **built-in border property**, not a child element
2. Children added to the box need **explicit positioning** with `position: "absolute"`
3. Without positioning, children render at the box's top-left, overlapping the border

**The Fix:**

```typescript
const box = new BoxRenderable(renderer, {
  id: 'box',
  position: 'absolute',
  left: 10,
  top: 5,
  width: 40,
  height: 10,
  title: 'open-s3',
  borderStyle: 'rounded',
  border: true,
});
renderer.root.add(box);

// ✅ Position text INSIDE the box
const text = new TextRenderable(renderer, {
  content: 'Text content',
  position: 'absolute',
  left: 12, // Inside box (10 + 2 for border)
  top: 7, // Below border and title (5 + 2)
});
renderer.root.add(text);
```

**Result:**

```
┌─ open-s3 ────────────┐
│ Text content         │
└──────────────────────┘
```

---

## 🔑 Key Concepts

### 1. Title vs Child Content

| Aspect             | Title                         | Child Content             |
| ------------------ | ----------------------------- | ------------------------- |
| **What is it**     | Border property               | Separate component        |
| **How to set**     | `title: "text"` prop          | Add TextRenderable child  |
| **Where rendered** | Inside border frame           | Inside content area       |
| **Positioning**    | Automatic (left/center/right) | Manual with `left`, `top` |

### 2. Three Rendering Layers

```
┌─────────────────────────────┐  ← Border (drawn by drawBox())
│ ┌─────────────────────────┐ │  ← Scissor rect (clipping area)
│ │ Title: "text"           │ │  ← Title (if set)
│ │                         │ │
│ │ Child content here      │ │  ← Children (positioned inside)
│ │                         │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

### 3. Scissor Rect (Automatic Clipping)

- OpenTUI automatically clips content to prevent it from rendering on the border
- **1-cell inset** from each border side
- You can still position children outside the box, but they'll be clipped
- Prevents accidental border overlap

---

## 🛠️ Three Patterns for Box Content

### Pattern 1: Absolute Positioning (Recommended for Simple Layouts)

```typescript
// Best for: Dialogs, simple forms, custom layouts
const box = new BoxRenderable(renderer, {
  position: 'absolute',
  left: 10,
  top: 5,
  width: 40,
  height: 10,
  title: 'Dialog',
  border: true,
});

const content = new TextRenderable(renderer, {
  content: 'Message',
  position: 'absolute',
  left: 12,
  top: 7, // +2 to account for border
});
```

### Pattern 2: Flex Layout with Padding (Best for Complex Forms)

```typescript
// Best for: Forms, multi-field layouts
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

### Pattern 3: Nested Boxes (Best for Hierarchical UIs)

```typescript
// Best for: Multi-pane layouts, dashboards
const outer = new BoxRenderable(renderer, {
  position: 'absolute',
  left: 5,
  top: 2,
  width: 60,
  height: 20,
  title: 'Main',
  border: true,
});
renderer.root.add(outer);

const inner = new BoxRenderable(renderer, {
  position: 'absolute',
  left: 8,
  top: 5, // Inside outer box
  width: 25,
  height: 10,
  title: 'Panel',
  border: true,
});
renderer.root.add(inner);
```

---

## ✅ Checklist: Is Your Box Correctly Configured?

- [ ] **Border property set?** `border: true` or `borderStyle` specified?
- [ ] **Title text set?** `title: "text"` on the box?
- [ ] **Children positioned?** Using `position: "absolute"` with `left` and `top`?
- [ ] **Coordinates account for border?** Child `left >= box.left + 1`, `top >= box.top + 1`?
- [ ] **Parent added to renderer?** `renderer.root.add(box)`?
- [ ] **Content area large enough?** Box height >= 3 (border + 1 cell for content)?
- [ ] **No z-index conflicts?** Children have higher z-index if they should be visible?

---

## 📖 How to Use This Research

### If you want to...

**Fix your box title issue quickly**
→ Read: QUICK_REFERENCE.md + Examples 1-2 from PRACTICAL_EXAMPLES.md

**Understand how it works under the hood**
→ Read: BOX_TITLE_BORDER_GUIDE.md (especially "How Box Rendering Works")

**See working examples you can copy**
→ Read: PRACTICAL_EXAMPLES.md (4 complete examples)

**Debug an issue**
→ Read: QUICK_REFERENCE.md (Debugging Checklist)

**Learn the source code structure**
→ Read: BOX_TITLE_BORDER_GUIDE.md (Source Code Reference section)

---

## 🔍 Technical Deep Dive

### Box Rendering Process

1. **renderSelf()** - Called by Renderable framework
   - Prepares box properties (colors, styles, title)
   - Calls `buffer.drawBox()` to render border and fill

2. **drawBox()** (Low-level, written in Zig)
   - Draws border characters using specified `borderStyle`
   - Renders `title` text within the border frame
   - Fills background color

3. **getScissorRect()** - Defines clipping area
   - Calculates content area boundaries
   - Insets by 1 cell for each active border
   - Used by child rendering to prevent overflow

### Source Files

- **Box.ts**: Main component implementation
- **Renderable.ts**: Base class with lifecycle
- **buffer.ts**: Low-level rendering interface
- **border.ts**: Border character definitions

### Key Methods

```typescript
BoxRenderable.renderSelf(buffer); // Render this box
BoxRenderable.getScissorRect(); // Get content clipping area
BoxRenderable.title(getter / setter); // Manage title text
BoxRenderable.border(getter / setter); // Manage border state
```

---

## 📊 Comparison: Title vs Layout

| Feature         | `title` Prop                | Child Component       |
| --------------- | --------------------------- | --------------------- |
| **Purpose**     | Label/title in border       | Main content          |
| **Rendering**   | Part of border frame        | Inside content area   |
| **Positioning** | Left/Center/Right alignment | Manual or flex layout |
| **Behavior**    | Fixed in border             | Can overflow/scroll   |
| **Example**     | `title: "Settings"`         | TextRenderable child  |

---

## 🔗 Related Resources

- **OpenTUI Official Repo**: https://github.com/sst/opentui
- **OpenTUI Docs**: https://opentui.com
- **OpenTUI Examples**: `/packages/core/src/examples/` in repo
- **timeline-example.ts**: Best example of box titles + content
- **input-select-layout-demo.ts**: Best example of flex layout

---

## 💡 Pro Tips

1. **Always use `position: "absolute"` for content positioning**
   - Makes your layout explicit and debuggable
   - Easier to reason about positioning

2. **Use padding with flex layouts**
   - Automatically accounts for borders
   - Cleaner than manual calculations

3. **Test with terminal size changes**
   - Use percentage sizing for flexible layouts
   - Verify content stays within bounds

4. **Layer with z-index**
   - Title (border): z-index 0 (automatic)
   - Content: z-index 1+ (explicit)
   - Overlays: z-index 100+ (high)

5. **Check scissor rect in debugger**
   - Understand your effective content area
   - Prevents positioning surprises

---

## 🐛 Common Issues & Fixes

| Issue                 | Cause                      | Solution                                  |
| --------------------- | -------------------------- | ----------------------------------------- |
| Text in border        | No positioning on child    | Add `position: "absolute"` + `left`/`top` |
| Title not visible     | `border: false` by default | Set `border: true`                        |
| Content cut off       | Outside scissor rect       | Adjust positioning                        |
| Flex children overlap | No padding set             | Add `padding: { ... }`                    |
| Borders not visible   | Wrong border style         | Set `border: true` explicitly             |

---

## 📝 Notes

- **Scissor rect only clips, doesn't position**
  - You must position children correctly
  - Scissor rect prevents rendering overflow only

- **Title takes up space**
  - Don't use title if you need every cell for content
  - Title is 1 cell tall

- **Borders are 1 cell wide**
  - Each border (top/right/bottom/left) = 1 cell
  - Account for all active borders in positioning math

- **Flexbox respects Yoga layout**
  - OpenTUI uses Yoga for layout calculations
  - Padding is respected by flex children
  - Gap controls spacing between children

---

## 📞 Need Help?

1. **Check the Quick Reference** - Most answers are there
2. **Look at Practical Examples** - Find a similar use case
3. **Read the Full Guide** - Understand the implementation
4. **Check source code** - See how OpenTUI does it
5. **Run the examples** - Experiment with modifications

---

## 📜 Document Status

- **Version**: 1.0
- **Created**: November 2025
- **OpenTUI Version**: 0.1.44+
- **Status**: Complete and verified with actual OpenTUI source code
- **Examples**: All tested patterns
- **Source**: Analyzed from github.com/sst/opentui

---

## 📋 Files in This Research

```
research/opentui-box-titles/
├── README.md                    (This file - overview)
├── QUICK_REFERENCE.md          (Fast answers & cheat sheets)
├── BOX_TITLE_BORDER_GUIDE.md   (Complete technical guide)
├── PRACTICAL_EXAMPLES.md        (Working code examples)
```

---

**Happy coding with OpenTUI! 🚀**
