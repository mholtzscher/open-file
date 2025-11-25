# OpenTUI Flexbox - Quick Reference Card

## TL;DR

✅ **YES, OpenTUI has full flexbox support via Yoga layout engine**

### Quick Comparison

| Aspect               | Flexbox              | Absolute Positioning |
| -------------------- | -------------------- | -------------------- |
| **Automatic sizing** | ✅ Yes               | ❌ Manual            |
| **Terminal resize**  | ✅ Auto-recalculates | ❌ Must handle       |
| **Code complexity**  | ✅ Simple            | ❌ Complex           |
| **Maintenance**      | ✅ Easy              | ❌ Hard              |
| **Responsive**       | ✅ Built-in          | ❌ Additional work   |
| **Recommended**      | ✅ YES               | ⚠️ Only for overlays |

---

## One-Minute Example

### React (Recommended for S3 Explorer)

```jsx
<box id="app" flexDirection="column" width="100%" height="100%">
  {/* Header - fixed height, full width */}
  <box id="header" height={1} flexGrow={0} flexShrink={0}>
    <text>S3 Explorer</text>
  </box>

  {/* Content - takes all remaining space */}
  <box id="content" flexDirection="row" flexGrow={1} gap={1}>
    {/* Left pane - 50% width, grows with container */}
    <box id="left" flexGrow={1} flexBasis="50%" overflow="hidden" />

    {/* Right pane - fixed width of 30 chars */}
    <box id="right" width={30} flexGrow={0} flexShrink={0} overflow="hidden" />
  </box>

  {/* Footer - fixed height */}
  <box id="footer" height={1} flexGrow={0} flexShrink={0}>
    <text>Status: Ready</text>
  </box>
</box>
```

### Benefits Over Current Approach

**Before (Absolute Positioning)**:

- Manual coordinate calculations
- Must handle terminal resize
- Hard to maintain
- ~50 lines of layout code

**After (Flexbox)**:

- Automatic sizing
- Terminal resize handled by Yoga
- Easy to read
- ~15 lines of layout code

---

## Key Properties Cheat Sheet

### Container Properties

```jsx
// Direction & alignment
flexDirection="row"           // row | column | row-reverse | column-reverse
justifyContent="space-between" // flex-start | center | flex-end | space-between | space-around
alignItems="center"           // flex-start | center | flex-end | stretch

// Spacing
gap={1}                       // Space between children
padding={2}                   // Internal spacing
margin={1}                    // External spacing

// Sizing
width="100%"                  // Percentage or number
height={20}                   // Character lines
```

### Item Properties

```jsx
// Growing/shrinking
flexGrow={1}                  // 0 = fixed, 1+ = grows
flexShrink={1}                // 0 = don't shrink, 1+ = shrinks
flexBasis="50%"               // Preferred size: number or percentage

// Sizing
width={30}                    // Fixed character width
minWidth={10}                 // Minimum width
maxWidth={50}                 // Maximum width

// Positioning within container
alignSelf="center"            // Override parent's alignItems
```

---

## Common Patterns

### 1. Fixed Header + Flexible Content + Fixed Footer

```jsx
<box flexDirection="column" width="100%" height="100%">
  <box height={2} flexGrow={0} /> {/* Header - fixed */}
  <box flexGrow={1} overflow="hidden" /> {/* Content - grows */}
  <box height={1} flexGrow={0} /> {/* Footer - fixed */}
</box>
```

### 2. Side-by-Side Panes (Equal Width)

```jsx
<box flexDirection="row" gap={1}>
  <box flexGrow={1} overflow="hidden" /> {/* Left - 50% */}
  <box flexGrow={1} overflow="hidden" /> {/* Right - 50% */}
</box>
```

### 3. Side-by-Side Panes (Left Flexible, Right Fixed)

```jsx
<box flexDirection="row" gap={1}>
  <box flexGrow={1} overflow="hidden" /> {/* Left - takes space */}
  <box width={30} flexGrow={0} /> {/* Right - 30 chars */}
</box>
```

### 4. Three Panes with Proportional Sizing

```jsx
<box flexDirection="row" gap={1}>
  <box flexGrow={1} flexBasis="33%" /> {/* 33% */}
  <box flexGrow={1} flexBasis="33%" /> {/* 33% */}
  <box flexGrow={1} flexBasis="33%" /> {/* 33% */}
</box>
```

### 5. Centered Content

```jsx
<box
  flexDirection="column"
  justifyContent="center"    {/* Vertical center */}
  alignItems="center"         {/* Horizontal center */}
  width={40}
  height={10}
>
  <text>Centered Text</text>
</box>
```

---

## Property Values Quick Lookup

### `flexDirection`

- `"row"` - Horizontal, left to right
- `"column"` - Vertical, top to bottom
- `"row-reverse"` - Horizontal, right to left
- `"column-reverse"` - Vertical, bottom to top

### `justifyContent` (Main Axis Alignment)

- `"flex-start"` - Pack to start
- `"center"` - Center items
- `"flex-end"` - Pack to end
- `"space-between"` - Space between items
- `"space-around"` - Space around items
- `"space-evenly"` - Equal space between and around

### `alignItems` (Cross Axis Alignment)

- `"flex-start"` - Align to start
- `"center"` - Center items
- `"flex-end"` - Align to end
- `"stretch"` - Items stretch to fill

### Sizing Values

- `width={30}` - Fixed: 30 characters
- `width="50%"` - Percentage of parent
- `width="auto"` - Automatic/content-based
- `flexGrow={1}` - Grow to fill available space
- `flexGrow={0}` - Don't grow (fixed)

---

## Layout Property Support

| Property            | Works? | Notes                 |
| ------------------- | ------ | --------------------- |
| flexDirection       | ✅     | All renderables       |
| justifyContent      | ✅     | All renderables       |
| alignItems          | ✅     | All renderables       |
| gap                 | ✅     | Group, Box, ScrollBox |
| flexGrow            | ✅     | All renderables       |
| flexShrink          | ✅     | All renderables       |
| width/height        | ✅     | All renderables       |
| margin              | ✅     | All renderables       |
| padding             | ✅     | All renderables       |
| position="absolute" | ✅     | For overlays/modals   |

---

## Terminal Resize Handling

### With Flexbox (Automatic)

```jsx
// No code needed! Yoga automatically recalculates on terminal resize
<box flexDirection="row" width="100%" height="100%">
  <box flexGrow={1} /> {/* Automatically resizes */}
  <box flexGrow={1} /> {/* Automatically resizes */}
</box>
```

### With Absolute Positioning (Manual)

```typescript
// Must listen to resize and manually recalculate
renderer.on('resize', (width, height) => {
  leftPane.width = Math.floor(width / 2);
  rightPane.left = Math.floor(width / 2) + 1;
  // ... more calculations
});
```

**Verdict**: Flexbox wins! 🎉

---

## When to Use What

### Use Flexbox For

✅ Main layout structure (panes, sections)
✅ Responsive design
✅ Equal or proportional sizing
✅ Terminal resize support
✅ Professional, maintainable code

### Use Absolute Positioning For

⚠️ Overlays and modals
⚠️ Fixed positioning on top of content
⚠️ Precise pixel-perfect placement
⚠️ Z-index layering

---

## Common Mistakes to Avoid

❌ **Don't**: Use absolute positioning for main layout

```jsx
// BAD - manual calculations everywhere
<box position="absolute" left={0} top={0} width={leftWidth} height={contentHeight} />
```

✅ **Do**: Use flexbox for main layout

```jsx
// GOOD - simple and maintainable
<box flexDirection="row" gap={1}>
  <box flexGrow={1} />
  <box width={30} />
</box>
```

---

## Real-World Example: S3 Explorer Layout

### Current (Absolute Positioning)

```jsx
const leftWidth = Math.floor((width - 42) / 3);
const middleWidth = Math.floor((width - 42) / 3);

return (
  <>
    <box position="absolute" left={0} top={0} width={leftWidth} height={height} />
    <box position="absolute" left={leftWidth + 1} top={0} width={middleWidth} height={height} />
    <box
      position="absolute"
      left={leftWidth + middleWidth + 2}
      top={0}
      width={40}
      height={height}
    />
  </>
);
```

### Recommended (Flexbox)

```jsx
return (
  <box flexDirection="row" width="100%" height="100%" gap={1}>
    <box flexGrow={1} flexBasis="33%" />
    <box flexGrow={1} flexBasis="33%" />
    <box width={40} flexGrow={0} />
  </box>
);
```

**Result**: Simpler, cleaner, more maintainable! 🚀

---

## Resources

- **Full Guide**: `research/opentui/FLEXBOX_SUPPORT.md`
- **OpenTUI Docs**: https://opentui.com
- **Yoga Docs**: https://www.yogalayout.com/
- **CSS Flexbox**: https://www.w3.org/TR/css-flexbox-1/

---

## Quick Recommendation

**For S3 Explorer Multi-Pane Layout:**

🎯 **Switch to flexbox immediately**

- Reduces code complexity
- Better terminal resize handling
- More professional
- Easier to maintain and extend
- No performance penalty

---

**Last Updated**: November 2025  
**Status**: Research Complete  
**Confidence**: High (based on TypeScript definitions and architecture)
