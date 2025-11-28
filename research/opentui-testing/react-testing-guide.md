# React Testing Guide for OpenTUI

## React-Specific Testing Setup

### Source File
`packages/react/src/test-utils.ts`

### Import Path
```typescript
import { testRender } from "@opentui/react/test-utils"
```

---

## Main API: testRender()

```typescript
async function testRender(
  node: ReactNode,
  testRendererOptions: TestRendererOptions
): Promise<ReturnType<typeof createTestRenderer>>
```

### What testRender() Does

1. Creates a test renderer (like core testing)
2. Sets up React environment flag: `IS_REACT_ACT_ENVIRONMENT`
3. Creates a React root with the custom reconciler
4. Wraps renders in `React.act()`
5. Handles cleanup on destroy

### Return Value

Same as `createTestRenderer()` with React-specific setup:

```typescript
{
  renderer: TestRenderer
  mockInput: MockInput
  mockMouse: MockMouse
  renderOnce: () => Promise<void>
  captureCharFrame: () => string
  resize: (width: number, height: number) => void
}
```

---

## Basic React Test

```typescript
import { describe, test, expect } from "bun:test"
import { testRender } from "@opentui/react/test-utils"

describe("MyReactComponent", () => {
  test("renders correctly", async () => {
    const testSetup = await testRender(
      <MyComponent message="Hello" />,
      { width: 80, height: 24 }
    )

    const { renderer, renderOnce, captureCharFrame } = testSetup

    await renderOnce()

    const frame = captureCharFrame()
    expect(frame).toContain("Hello")
  })
})
```

---

## React Patterns

### 1. Component with Props

```typescript
function Greeting({ name }: { name: string }) {
  return <Box>Hello, {name}!</Box>
}

test("renders greeting with props", async () => {
  const { renderOnce, captureCharFrame } = await testRender(
    <Greeting name="Alice" />,
    { width: 40, height: 10 }
  )

  await renderOnce()

  const frame = captureCharFrame()
  expect(frame).toContain("Hello, Alice!")
})
```

### 2. Component with State

```typescript
function Counter() {
  const [count, setCount] = React.useState(0)

  return (
    <Box>
      <Text>Count: {count}</Text>
      <Button onClick={() => setCount(c => c + 1)}>
        Increment
      </Button>
    </Box>
  )
}

test("counter updates on click", async () => {
  const { renderOnce, captureCharFrame, mockMouse } = 
    await testRender(<Counter />, { width: 40, height: 10 })

  // Initial render
  await renderOnce()
  expect(captureCharFrame()).toContain("Count: 0")

  // Click button (assuming it's at position 10, 2)
  await mockMouse.click(10, 2)
  await renderOnce()

  expect(captureCharFrame()).toContain("Count: 1")
})
```

### 3. Component with useEffect

```typescript
function AsyncData() {
  const [data, setData] = React.useState<string>("")

  React.useEffect(() => {
    setTimeout(() => setData("Loaded"), 100)
  }, [])

  return <Box>{data || "Loading..."}</Box>
}

test("renders loaded data after effect", async () => {
  const { renderOnce, captureCharFrame } = 
    await testRender(<AsyncData />, { width: 40, height: 10 })

  // Initial render
  await renderOnce()
  expect(captureCharFrame()).toContain("Loading...")

  // Wait for effect
  await new Promise(resolve => setTimeout(resolve, 150))
  await renderOnce()

  expect(captureCharFrame()).toContain("Loaded")
})
```

### 4. Component with Context

```typescript
const ThemeContext = React.createContext<"light" | "dark">("light")

function ThemedBox() {
  const theme = React.useContext(ThemeContext)
  return <Box>{theme}</Box>
}

test("respects context provider", async () => {
  const { renderOnce, captureCharFrame } = 
    await testRender(
      <ThemeContext.Provider value="dark">
        <ThemedBox />
      </ThemeContext.Provider>,
      { width: 40, height: 10 }
    )

  await renderOnce()
  expect(captureCharFrame()).toContain("dark")
})
```

### 5. Component with Keyboard Input

```typescript
function TextInput() {
  const [text, setText] = React.useState("")

  return (
    <Box>
      <Input 
        value={text}
        onChange={setText}
        placeholder="Type here..."
      />
      <Text>{text}</Text>
    </Box>
  )
}

test("handles keyboard input", async () => {
  const { renderOnce, captureCharFrame, mockInput } = 
    await testRender(<TextInput />, { width: 40, height: 10 })

  await renderOnce()

  // Focus and type
  mockInput.typeText("React Test")
  await renderOnce()

  const frame = captureCharFrame()
  expect(frame).toContain("React Test")
})
```

### 6. Component with Mouse Input

```typescript
function Button() {
  const [clicked, setClicked] = React.useState(false)

  return (
    <Box>
      <Button onClick={() => setClicked(!clicked)}>
        {clicked ? "Clicked!" : "Click me"}
      </Button>
    </Box>
  )
}

test("handles mouse click", async () => {
  const { renderOnce, captureCharFrame, mockMouse } = 
    await testRender(<Button />, { width: 40, height: 10 })

  await renderOnce()
  expect(captureCharFrame()).toContain("Click me")

  // Click button
  await mockMouse.click(5, 0)
  await renderOnce()

  expect(captureCharFrame()).toContain("Clicked!")
})
```

### 7. Component with useCallback

```typescript
function Searchbox({ onSearch }: { onSearch: (query: string) => void }) {
  const [query, setQuery] = React.useState("")
  
  const handleSearch = React.useCallback(() => {
    onSearch(query)
  }, [query, onSearch])

  return (
    <Box>
      <Input 
        value={query}
        onChange={setQuery}
      />
      <Button onClick={handleSearch}>Search</Button>
    </Box>
  )
}

test("calls callback on search", async () => {
  let searchedQuery = ""
  const handleSearch = (q: string) => {
    searchedQuery = q
  }

  const { renderOnce, mockInput, mockMouse } = 
    await testRender(
      <Searchbox onSearch={handleSearch} />,
      { width: 40, height: 10 }
    )

  mockInput.typeText("React")
  await renderOnce()

  // Click search button
  await mockMouse.click(10, 1)
  await renderOnce()

  expect(searchedQuery).toBe("React")
})
```

---

## Testing with act()

The `testRender()` function automatically wraps updates in `React.act()`, but you can also use it manually:

```typescript
import { act } from "react"

test("manual act wrapping", async () => {
  const { renderOnce, captureCharFrame, mockInput } = 
    await testRender(<MyComponent />, { width: 40, height: 10 })

  // act() is automatically used in renderOnce(), but for other 
  // React state updates, you might need:
  await act(async () => {
    mockInput.typeText("test")
    await renderOnce()
  })

  const frame = captureCharFrame()
  expect(frame).toContain("test")
})
```

---

## Common Testing Patterns

### Pattern 1: Component Lifecycle

```typescript
test("component lifecycle", async () => {
  const { renderOnce, captureCharFrame, renderer } = 
    await testRender(<MyComponent />, { width: 80, height: 24 })

  // Mount/render
  await renderOnce()
  expect(captureCharFrame()).toContain("initial")

  // Update
  // (trigger state change)
  await renderOnce()
  expect(captureCharFrame()).toContain("updated")

  // Unmount happens on renderer.destroy()
  renderer.destroy()
})
```

### Pattern 2: Event Handling Chain

```typescript
test("event handling chain", async () => {
  const { renderOnce, captureCharFrame, mockInput, mockMouse } = 
    await testRender(<Form />, { width: 80, height: 24 })

  await renderOnce()

  // User fills form with keyboard
  mockInput.typeText("John Doe")
  await renderOnce()

  // User clicks submit with mouse
  await mockMouse.click(20, 10)
  await renderOnce()

  // Verify submission happened
  expect(captureCharFrame()).toContain("Form submitted")
})
```

### Pattern 3: Conditional Rendering

```typescript
function ConditionalComponent({ show }: { show: boolean }) {
  return <Box>{show ? <Text>Visible</Text> : null}</Box>
}

test("conditional rendering", async () => {
  // First with show=false
  let testSetup = await testRender(
    <ConditionalComponent show={false} />,
    { width: 40, height: 10 }
  )

  await testSetup.renderOnce()
  expect(testSetup.captureCharFrame()).not.toContain("Visible")

  // Test with show=true
  testSetup = await testRender(
    <ConditionalComponent show={true} />,
    { width: 40, height: 10 }
  )

  await testSetup.renderOnce()
  expect(testSetup.captureCharFrame()).toContain("Visible")
})
```

### Pattern 4: List Rendering

```typescript
function ItemList({ items }: { items: string[] }) {
  return (
    <Box>
      {items.map((item, i) => (
        <Text key={i}>{item}</Text>
      ))}
    </Box>
  )
}

test("renders list items", async () => {
  const { renderOnce, captureCharFrame } = 
    await testRender(
      <ItemList items={["Apple", "Banana", "Cherry"]} />,
      { width: 40, height: 10 }
    )

  await renderOnce()
  const frame = captureCharFrame()

  expect(frame).toContain("Apple")
  expect(frame).toContain("Banana")
  expect(frame).toContain("Cherry")
})
```

---

## Cleanup Pattern

```typescript
import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { testRender } from "@opentui/react/test-utils"

describe("MyComponent", () => {
  let testSetup: Awaited<ReturnType<typeof testRender>>

  beforeEach(async () => {
    testSetup = await testRender(
      <MyComponent />,
      { width: 80, height: 24 }
    )
  })

  afterEach(() => {
    testSetup.renderer.destroy()
  })

  test("test 1", async () => {
    await testSetup.renderOnce()
    // ...
  })

  test("test 2", async () => {
    await testSetup.renderOnce()
    // ...
  })
})
```

---

## Debugging React Tests

### 1. Inspect Component Tree

```typescript
test("debug component tree", async () => {
  const { renderOnce, renderer } = 
    await testRender(<MyComponent />, { width: 80, height: 24 })

  await renderOnce()

  // Access Fiber tree for debugging
  // (depends on React version)
  console.log(renderer.root)
})
```

### 2. Multiple Renders

```typescript
test("trace rendering", async () => {
  const { renderOnce, captureCharFrame, renderer } = 
    await testRender(<Counter />, { width: 40, height: 10 })

  let frameCount = 0

  renderer.setFrameCallback(async () => {
    frameCount++
    console.log(`Frame ${frameCount}:`, captureCharFrame())
  })

  // Each renderOnce() will trigger frameCallback
  await renderOnce()
  await renderOnce()
  await renderOnce()
})
```

### 3. Inspect Buffer

```typescript
test("inspect render buffer", async () => {
  const { renderOnce, renderer } = 
    await testRender(<MyComponent />, { width: 80, height: 24 })

  await renderOnce()

  const buffer = renderer.currentRenderBuffer

  // Print character layer
  for (let y = 0; y < Math.min(5, buffer.height); y++) {
    let line = ""
    for (let x = 0; x < Math.min(40, buffer.width); x++) {
      const charCode = buffer.buffers.char[y * buffer.width + x]
      line += String.fromCodePoint(charCode)
    }
    console.log(line)
  }
})
```

---

## TypeScript Support

All test utilities have full TypeScript support:

```typescript
import { testRender } from "@opentui/react/test-utils"
import { createTestRenderer, type TestRenderer, type MockInput } 
  from "@opentui/core/testing"

// Type-safe usage
const testSetup = await testRender(
  <MyComponent />,
  { width: 80, height: 24 }
)

// All properties are type-checked
const renderer: TestRenderer = testSetup.renderer
const mockInput: MockInput = testSetup.mockInput
```

