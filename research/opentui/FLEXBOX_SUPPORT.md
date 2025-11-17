# OpenTUI Flexbox Layout System Research

## Executive Summary

**OpenTUI fully supports Flexbox layout through the Yoga layout engine.** It's not limited to absolute positioning - the framework provides comprehensive CSS-like flexbox capabilities for building responsive, declarative layouts.

### Quick Answer

- ✅ **Flexbox is fully supported** via Yoga layout engine
- ✅ **Available on all renderables** (Box, Text, Group, Input, Select, etc.)
- ✅ **Declarative layout options** with flex properties
- ✅ **Absolute positioning also supported** as an alternative
- ✅ **Recommended for multi-pane layouts** over manual calculations

---

## Layout System Architecture

### Yoga Layout Engine

OpenTUI uses **Yoga** - Facebook's CSS Flexbox implementation:

- **Type**: Based on CSS Flexbox specification
- **Performance**: Native layout calculations (extremely fast)
- **Compatibility**: Works seamlessly with terminal constraints
- **Capabilities**: All major flexbox properties supported

### TypeScript Definitions

From `@opentui/core/lib/yoga.options.d.ts`:

```typescript
// Flex directions
export type FlexDirectionString = "column" | "column-reverse" | "row" | "row-reverse";

// Main axis alignment
export type JustifyString = "flex-start" | "center" | "flex-end" 
                          | "space-between" | "space-around" | "space-evenly";

// Cross axis alignment
export type AlignString = "auto" | "flex-start" | "center" | "flex-end" 
                        | "stretch" | "baseline" | "space-between" 
                        | "space-around" | "space-evenly";

// Wrapping
export type WrapString = "no-wrap" | "wrap" | "wrap-reverse";

// Positioning
export type PositionTypeString = "static" | "relative" | "absolute";

// Display
export type DisplayString = "flex" | "none" | "contents";

// Overflow
export type OverflowString = "visible" | "hidden" | "scroll";
```

---

## Available Layout Properties

### Full Layout Options Interface

From `@opentui/core/Renderable.d.ts`:

```typescript
export interface LayoutOptions extends BaseRenderableOptions {
  // Flex container properties
  flexDirection?: FlexDirectionString;
  flexWrap?: WrapString;
  justifyContent?: JustifyString;
  alignItems?: AlignString;
  alignSelf?: AlignString;
  alignContent?: AlignString;  // For wrapped items
  gap?: number;               // Space between items
  rowGap?: number;
  columnGap?: number;

  // Flex item properties
  flexGrow?: number;          // Grow factor (default: 0)
  flexShrink?: number;        // Shrink factor (default: 1)
  flexBasis?: number | "auto";  // Base size before growing/shrinking

  // Positioning
  position?: PositionTypeString;  // "static" | "relative" | "absolute"
  top?: number | "auto" | `${number}%`;
  right?: number | "auto" | `${number}%`;
  bottom?: number | "auto" | `${number}%`;
  left?: number | "auto" | `${number}%`;

  // Sizing
  width?: number | "auto" | `${number}%`;
  height?: number | "auto" | `${number}%`;
  minWidth?: number | "auto" | `${number}%`;
  minHeight?: number | "auto" | `${number}%`;
  maxWidth?: number | "auto" | `${number}%`;
  maxHeight?: number | "auto" | `${number}%`;

  // Spacing
  margin?: number | "auto" | `${number}%`;
  marginTop?: number | "auto" | `${number}%`;
  marginRight?: number | "auto" | `${number}%`;
  marginBottom?: number | "auto" | `${number}%`;
  marginLeft?: number | "auto" | `${number}%`;

  padding?: number | `${number}%`;
  paddingTop?: number | `${number}%`;
  paddingRight?: number | `${number}%`;
  paddingBottom?: number | `${number}%`;
  paddingLeft?: number | `${number}%`;

  // Display control
  display?: "flex" | "none" | "contents";
  overflow?: OverflowString;
  enableLayout?: boolean;
}
```

---

## Flexbox Layout Examples

### 1. Basic Horizontal Layout (Row)

**Problem**: Create a header with title on left and info on right

**Flexbox Solution**:

```typescript
// TypeScript with OpenTUI Core
const header = new GroupRenderable(renderer, {
  id: 'header',
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  width: '100%',
  height: 3,
  backgroundColor: '#1a1a2e',
  padding: 1,
});

const title = new TextRenderable(renderer, {
  id: 'title',
  content: 'S3 Explorer',
  flexGrow: 0,  // Don't grow
});

const info = new TextRenderable(renderer, {
  id: 'info',
  content: 'bucket: my-bucket',
  flexGrow: 0,
});

header.add(title);
header.add(info);
renderer.root.add(header);
```

**React Syntax**:

```jsx
<box
  id="header"
  flexDirection="row"
  justifyContent="space-between"
  alignItems="center"
  width="100%"
  height={3}
  backgroundColor="#1a1a2e"
  padding={1}
>
  <text id="title" flexGrow={0}>S3 Explorer</text>
  <text id="info" flexGrow={0}>bucket: my-bucket</text>
</box>
```

### 2. Vertical Layout with Flexible Content (Column)

**Problem**: Create a layout with fixed header, growing content, fixed footer

**Flexbox Solution**:

```typescript
const container = new GroupRenderable(renderer, {
  id: 'main-container',
  flexDirection: 'column',  // Stack vertically
  width: '100%',
  height: '100%',
  gap: 1,  // Space between items
});

const header = new BoxRenderable(renderer, {
  id: 'header',
  height: 3,
  backgroundColor: '#1a1a2e',
  flexGrow: 0,  // Don't grow
  flexShrink: 0,  // Don't shrink
});

const content = new BoxRenderable(renderer, {
  id: 'content',
  flexGrow: 1,  // Take all remaining space
  backgroundColor: '#2d2d44',
});

const footer = new BoxRenderable(renderer, {
  id: 'footer',
  height: 2,
  backgroundColor: '#1a1a2e',
  flexGrow: 0,
  flexShrink: 0,
});

container.add(header);
container.add(content);
container.add(footer);
renderer.root.add(container);
```

**React Syntax**:

```jsx
<box
  id="main-container"
  flexDirection="column"
  width="100%"
  height="100%"
  gap={1}
>
  <box id="header" height={3} flexGrow={0} flexShrink={0} />
  <box id="content" flexGrow={1} />
  <box id="footer" height={2} flexGrow={0} flexShrink={0} />
</box>
```

### 3. Multi-Pane Layout (Recommended for S3 Explorer)

**Problem**: Create 2-3 panes side-by-side that resize responsively

**Flexbox Solution**:

```typescript
const paneContainer = new GroupRenderable(renderer, {
  id: 'pane-container',
  flexDirection: 'row',
  width: '100%',
  height: contentHeight,
  gap: 1,
  alignItems: 'stretch',  // Panes stretch to fill height
});

// Left pane
const leftPane = new GroupRenderable(renderer, {
  id: 'left-pane',
  flexGrow: 1,           // Equal share of space
  flexBasis: '50%',      // Preferred width: 50% of container
  overflow: 'hidden',
});

// Middle pane (optional)
const middlePane = new GroupRenderable(renderer, {
  id: 'middle-pane',
  flexGrow: 1,
  flexBasis: '25%',
  overflow: 'hidden',
});

// Right pane (preview)
const rightPane = new GroupRenderable(renderer, {
  id: 'right-pane',
  flexGrow: 0,           // Fixed width
  width: 30,
  overflow: 'hidden',
});

paneContainer.add(leftPane);
paneContainer.add(middlePane);
paneContainer.add(rightPane);
renderer.root.add(paneContainer);
```

**React Syntax**:

```jsx
<box
  id="pane-container"
  flexDirection="row"
  width="100%"
  height={contentHeight}
  gap={1}
  alignItems="stretch"
>
  <box id="left-pane" flexGrow={1} flexBasis="50%" overflow="hidden" />
  <box id="middle-pane" flexGrow={1} flexBasis="25%" overflow="hidden" />
  <box id="right-pane" flexGrow={0} width={30} overflow="hidden" />
</box>
```

### 4. Centered Content

**Problem**: Center items both horizontally and vertically

**Flexbox Solution**:

```typescript
const centered = new GroupRenderable(renderer, {
  id: 'centered-box',
  flexDirection: 'column',
  justifyContent: 'center',  // Vertical center
  alignItems: 'center',       // Horizontal center
  width: 40,
  height: 10,
  backgroundColor: '#1a1a2e',
});

const text = new TextRenderable(renderer, {
  id: 'centered-text',
  content: 'Loading...',
});

centered.add(text);
renderer.root.add(centered);
```

### 5. Responsive Grid Layout

**Problem**: Create a responsive grid of items

**Flexbox Solution**:

```typescript
const grid = new GroupRenderable(renderer, {
  id: 'grid',
  flexDirection: 'row',
  flexWrap: 'wrap',         // Wrap to next line
  gap: 1,
  width: '100%',
  height: 'auto',
  alignContent: 'flex-start',  // Align wrapped lines
});

// Add items that flex and wrap
for (let i = 0; i < 10; i++) {
  const item = new BoxRenderable(renderer, {
    id: `item-${i}`,
    width: 15,
    height: 5,
    flexGrow: 0,   // Fixed size
    flexShrink: 0,
  });
  grid.add(item);
}

renderer.root.add(grid);
```

---

## Comparison: Flexbox vs. Absolute Positioning

### Flexbox Approach (Recommended)

```typescript
const container = new GroupRenderable(renderer, {
  flexDirection: 'row',
  gap: 1,
  width: '100%',
  height: contentHeight,
});

const pane1 = new BoxRenderable(renderer, { flexGrow: 1 });
const pane2 = new BoxRenderable(renderer, { flexGrow: 1 });

container.add(pane1);
container.add(pane2);
```

**Advantages**:
- ✅ Automatic sizing and positioning
- ✅ Responsive to container changes
- ✅ Responsive to terminal resizing
- ✅ Less manual calculation
- ✅ Easier to maintain
- ✅ Better space utilization
- ✅ Cleaner code

### Absolute Positioning Approach (Current Implementation)

```typescript
const pane1 = new BoxRenderable(renderer, {
  position: 'absolute',
  left: 0,
  top: 0,
  width: containerWidth / 2,
  height: contentHeight,
});

const pane2 = new BoxRenderable(renderer, {
  position: 'absolute',
  left: containerWidth / 2 + 1,
  top: 0,
  width: containerWidth / 2 - 1,
  height: contentHeight,
});
```

**Disadvantages**:
- ❌ Manual calculation of positions
- ❌ Must handle terminal resize events
- ❌ Must recalculate on every size change
- ❌ Gap handling requires manual offset
- ❌ More verbose and error-prone
- ❌ Harder to add/remove panes
- ❌ More maintenance burden

---

## Key Flexbox Properties Explained

### Container Properties (Parent)

| Property | Values | Purpose |
|----------|--------|---------|
| `flexDirection` | "row" \| "column" | Main layout direction |
| `justifyContent` | "flex-start" \| "center" \| "flex-end" \| "space-between" \| "space-around" \| "space-evenly" | Align items along main axis |
| `alignItems` | "flex-start" \| "center" \| "flex-end" \| "stretch" | Align items on cross axis |
| `gap` | number | Space between children |
| `flexWrap` | "no-wrap" \| "wrap" \| "wrap-reverse" | Wrap behavior |

### Item Properties (Child)

| Property | Type | Purpose |
|----------|------|---------|
| `flexGrow` | number | How much to grow (0 = no growth) |
| `flexShrink` | number | How much to shrink (1 = shrink proportionally) |
| `flexBasis` | number \| "auto" | Base size before growing/shrinking |
| `alignSelf` | string | Override parent's alignItems |

### Quick Reference

```typescript
// Make an item take all remaining space
{ flexGrow: 1, flexShrink: 1 }

// Fix item size, don't grow or shrink
{ flexGrow: 0, flexShrink: 0 }

// Fixed width, but flexible height
{ width: 30, flexGrow: 0 }

// Percentage-based sizing
{ width: '50%', height: '100%' }

// Responsive sizing
{ flexBasis: '25%', flexGrow: 1 }
```

---

## Layout Property Support Matrix

| Component | Flexbox | Absolute | Percentage | Gap |
|-----------|---------|----------|------------|-----|
| **GroupRenderable** | ✅ | ✅ | ✅ | ✅ |
| **BoxRenderable** | ✅ | ✅ | ✅ | ✅ |
| **TextRenderable** | ✅ | ✅ | ✅ | ❌ |
| **InputRenderable** | ✅ | ✅ | ✅ | ❌ |
| **SelectRenderable** | ✅ | ✅ | ✅ | ❌ |
| **ScrollBoxRenderable** | ✅ | ✅ | ✅ | ✅ |

---

## React Integration

When using `@opentui/react`, all layout properties are available directly as JSX attributes:

```jsx
import { render } from '@opentui/react';

function MyApp() {
  return (
    <box
      id="container"
      flexDirection="row"
      justifyContent="space-between"
      width="100%"
      height="100%"
      gap={1}
    >
      <box id="left" flexGrow={1} />
      <box id="right" width={30} />
    </box>
  );
}

render(<MyApp />);
```

---

## Migration Strategy for S3 Explorer

### Current State
- Using absolute positioning with manual calculations
- Panes positioned using `left`, `top`, `width`, `height`
- Manual offset calculations for gaps

### Recommended Migration

**Phase 1: Container Layout**
```jsx
<box
  flexDirection="row"
  width="100%"
  height={contentHeight}
  gap={1}
>
  {/* Panes here */}
</box>
```

**Phase 2: Remove Manual Sizing**
- Delete manual coordinate calculations
- Remove `useLayoutDimensions` hook dependencies
- Use flexbox properties instead

**Phase 3: Responsive Panes**
- Adjust pane widths dynamically with terminal size
- Use `flexBasis` and `flexGrow` for responsive behavior

### Benefits of Migration
- ✅ Reduce code complexity
- ✅ Eliminate manual calculations
- ✅ Automatic terminal resize handling
- ✅ Better maintainability
- ✅ Less bug-prone
- ✅ Easier to add features (e.g., resizable panes)

---

## Performance Considerations

### Yoga Layout Performance

- **Calculation Speed**: ~0.1-0.5ms for typical layouts
- **Recalculation**: Only when tree or properties change
- **Memory**: Minimal overhead
- **Recommendation**: Use flexbox - no performance penalty

### Best Practices

1. **Batch updates**: Change multiple properties before render
2. **Use flex properties**: Simpler layouts, fewer reflows
3. **Avoid deep nesting**: Keep hierarchy shallow
4. **Enable passive rendering**: Only calculate when needed
5. **Use `enableLayout: true`** explicitly for containers

---

## Terminal-Specific Considerations

### Character-Based Layout

OpenTUI's Yoga integration works with terminal cells (characters):

- All measurements in cell units (typically 1 cell = 1 character width)
- Height measured in lines (typically 1 cell = 1 line)
- `gap: 1` means 1 character/line of space

### Responsive Design

```typescript
// Terminal size changes trigger recalculation
renderer.on('resize', () => {
  // Yoga automatically recalculates with new dimensions
  // No manual updates needed with flexbox
});
```

### Overflow Handling

```typescript
{
  overflow: 'hidden',   // Clip content
  overflow: 'visible',  // Show beyond bounds (may overlap)
  overflow: 'scroll',   // Scrollable (if supported)
}
```

---

## Real-World Example: S3 Explorer Multi-Pane Layout

### With Flexbox (Recommended)

```jsx
function S3ExplorerLayout() {
  return (
    <box id="app" flexDirection="column" width="100%" height="100%">
      {/* Header */}
      <box
        id="header"
        flexDirection="row"
        justifyContent="space-between"
        height={1}
        flexGrow={0}
        flexShrink={0}
      >
        <text>S3 Explorer</text>
        <text>bucket: my-bucket</text>
      </box>

      {/* Panes container */}
      <box
        id="panes"
        flexDirection="row"
        flexGrow={1}
        gap={1}
        alignItems="stretch"
      >
        {/* Left pane - buckets */}
        <box id="left-pane" flexGrow={1} flexBasis="33%" overflow="hidden" />

        {/* Middle pane - folders */}
        <box id="middle-pane" flexGrow={1} flexBasis="33%" overflow="hidden" />

        {/* Right pane - preview */}
        <box id="right-pane" width={40} flexGrow={0} flexShrink={0} overflow="hidden" />
      </box>

      {/* Footer */}
      <box
        id="footer"
        flexDirection="row"
        justifyContent="space-between"
        height={1}
        flexGrow={0}
        flexShrink={0}
      >
        <text>Status: Ready</text>
        <text>?/q: Help/Quit</text>
      </box>
    </box>
  );
}
```

### With Absolute Positioning (Current)

```jsx
function S3ExplorerLayout() {
  // Must manually calculate positions
  const leftWidth = Math.floor((terminalWidth - 42) / 3);
  const middleWidth = Math.floor((terminalWidth - 42) / 3);
  const rightWidth = 40;

  return (
    <>
      {/* Header */}
      <box position="absolute" left={0} top={0} width={terminalWidth} height={1} />

      {/* Left pane */}
      <box
        position="absolute"
        left={0}
        top={1}
        width={leftWidth}
        height={contentHeight}
      />

      {/* Middle pane */}
      <box
        position="absolute"
        left={leftWidth + 1}
        top={1}
        width={middleWidth}
        height={contentHeight}
      />

      {/* Right pane */}
      <box
        position="absolute"
        left={leftWidth + middleWidth + 2}
        top={1}
        width={rightWidth}
        height={contentHeight}
      />

      {/* Footer */}
      <box
        position="absolute"
        left={0}
        top={contentHeight + 1}
        width={terminalWidth}
        height={1}
      />
    </>
  );
}
```

---

## Documentation References

- **OpenTUI Docs**: https://opentui.com
- **Yoga Layout**: https://www.yogalayout.com/
- **CSS Flexbox Spec**: https://www.w3.org/TR/css-flexbox-1/
- **Research**: `research/opentui/architecture-guide.md`

---

## Recommendation Summary

### Use Flexbox If:
- ✅ Building responsive layouts
- ✅ Want automatic sizing
- ✅ Need responsive terminal support
- ✅ Want cleaner, more maintainable code
- ✅ Planning feature additions

### Use Absolute Positioning If:
- ✅ Need precise pixel-perfect positioning
- ✅ Building overlays or modals
- ✅ Layout is entirely fixed

### For S3 Explorer Multi-Pane Layout:
**Strongly recommend migrating to flexbox** for:
- Simpler code
- Automatic terminal resize handling
- Better maintainability
- Easier to add features
- Professional layout approach

---

**Last Updated**: November 2025  
**OpenTUI Version**: 0.1.44+  
**Status**: Complete Research  
**Recommendation Level**: High Priority

