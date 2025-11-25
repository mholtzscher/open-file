# OpenTUI Box Titles Research - Document Index

## 🗂️ Quick Navigation

| Document                                                   | Purpose                      | Time   | Best For                |
| ---------------------------------------------------------- | ---------------------------- | ------ | ----------------------- |
| **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)**               | Fast answers & cheat sheets  | 5 min  | Getting unstuck quickly |
| **[BOX_TITLE_BORDER_GUIDE.md](BOX_TITLE_BORDER_GUIDE.md)** | Complete technical reference | 20 min | Understanding internals |
| **[PRACTICAL_EXAMPLES.md](PRACTICAL_EXAMPLES.md)**         | Working code examples        | 15 min | Copy-paste solutions    |
| **[README.md](README.md)**                                 | Overview & navigation        | 10 min | Getting oriented        |

---

## 🎯 Choose Your Path

### Path 1: "I need to fix this NOW" ⚡ (7 minutes)

1. Read: [QUICK_REFERENCE.md](QUICK_REFERENCE.md) → Section "TL;DR"
2. Copy: [PRACTICAL_EXAMPLES.md](PRACTICAL_EXAMPLES.md) → Example 1
3. Modify for your use case
4. Done!

### Path 2: "I want to understand this" 🧠 (45 minutes)

1. Read: [README.md](README.md) → All sections
2. Study: [BOX_TITLE_BORDER_GUIDE.md](BOX_TITLE_BORDER_GUIDE.md) → All sections
3. Review: [PRACTICAL_EXAMPLES.md](PRACTICAL_EXAMPLES.md) → All examples
4. Done!

### Path 3: "I'm debugging an issue" 🔧 (15 minutes)

1. Read: [QUICK_REFERENCE.md](QUICK_REFERENCE.md) → "Common Mistakes" table
2. Use: [QUICK_REFERENCE.md](QUICK_REFERENCE.md) → "Debugging Checklist"
3. Refer: [BOX_TITLE_BORDER_GUIDE.md](BOX_TITLE_BORDER_GUIDE.md) → "Why Text Might Appear in Border"
4. Done!

### Path 4: "I need the complete API" 📚 (30 minutes)

1. Read: [QUICK_REFERENCE.md](QUICK_REFERENCE.md) → "API Reference"
2. Study: [BOX_TITLE_BORDER_GUIDE.md](BOX_TITLE_BORDER_GUIDE.md) → "Box Component Properties Reference"
3. Reference: [PRACTICAL_EXAMPLES.md](PRACTICAL_EXAMPLES.md) → All examples for context
4. Done!

---

## 📄 Document Breakdown

### QUICK_REFERENCE.md

**Size:** 312 lines  
**Focus:** Fast answers and cheat sheets

**Contains:**

- TL;DR problem/solution
- Core concepts (3 main points)
- Three quick solution patterns with code
- Box properties cheat sheet
- Positioning math reference
- Common mistakes table
- API reference
- Debugging checklist

**When to use:**

- Need answer quickly
- Looking for specific code pattern
- Can't remember the details
- Debugging specific issue

**Example sections:**

```
- TL;DR - Fix Your Box Title Issue
- Quick Solutions (Dialog, Flex, Nested)
- Positioning Math
- Common Mistakes table
- Debugging Checklist
```

---

### BOX_TITLE_BORDER_GUIDE.md

**Size:** 459 lines  
**Focus:** Complete technical reference

**Contains:**

- How the `title` prop works
- How box rendering works internally
- Why text appears in border (with scenarios)
- Three correct patterns with full code
- Box properties reference
- Debugging checklist
- OpenTUI source code references
- Real-world examples from OpenTUI repo

**When to use:**

- Need to understand how it works
- Want to see implementation details
- Need source code references
- Learning OpenTUI internals

**Example sections:**

```
- Understanding Box Titles in OpenTUI
- How Box Rendering Works
- Scissor Rect (Clipping Region)
- Why Text Might Appear in Border
- Correct Patterns for Boxes with Titles
- Real-World Examples from OpenTUI
```

---

### PRACTICAL_EXAMPLES.md

**Size:** 557 lines  
**Focus:** Working code examples

**Contains:**

- 4 complete, runnable examples
- Simple Dialog Box (Example 1)
- Form with Multiple Fields (Example 2)
- Multi-Pane Layout (Example 3)
- Nested Boxes (Example 4)
- Expected output for each
- Key takeaways section
- Pattern explanations

**When to use:**

- Need working code to copy
- Want to see patterns in action
- Looking for specific use case
- Need complete example to start from

**Example code:**

```typescript
// Each example includes:
// 1. Complete, runnable code
// 2. Comments explaining key points
// 3. Expected output/rendering
// 4. Variations and notes
```

---

### README.md

**Size:** 367 lines  
**Focus:** Overview and navigation

**Contains:**

- Quick answer to your issue
- Three key concepts explained
- Three patterns overview
- Configuration checklist
- How to use this research
- Technical deep dive overview
- Comparison tables
- Common issues & fixes
- Document status

**When to use:**

- First time reading the research
- Need overview before diving in
- Want to understand structure
- Need to find specific topic

**Example sections:**

```
- Quick Answer: Why Is My Text In The Border?
- Key Concepts
- Three Patterns for Box Content
- Checklist: Is Your Box Correctly Configured?
- How to Use This Research
```

---

## 🔍 Find By Topic

### "How do I position content in a box?"

→ [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - Positioning Math  
→ [PRACTICAL_EXAMPLES.md](PRACTICAL_EXAMPLES.md) - Example 1

### "What's the difference between title and content?"

→ [README.md](README.md) - Key Concepts  
→ [BOX_TITLE_BORDER_GUIDE.md](BOX_TITLE_BORDER_GUIDE.md) - Understanding Box Titles

### "Why is text appearing in my border?"

→ [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - TL;DR  
→ [BOX_TITLE_BORDER_GUIDE.md](BOX_TITLE_BORDER_GUIDE.md) - Why Text Might Appear in Border

### "How do I create a form with a border?"

→ [PRACTICAL_EXAMPLES.md](PRACTICAL_EXAMPLES.md) - Example 2

### "What's a scissor rect?"

→ [BOX_TITLE_BORDER_GUIDE.md](BOX_TITLE_BORDER_GUIDE.md) - Content Area is Protected by Scissor Rect

### "Show me a multi-pane layout"

→ [PRACTICAL_EXAMPLES.md](PRACTICAL_EXAMPLES.md) - Example 3

### "What properties can I set on a box?"

→ [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - Box Properties Cheat Sheet  
→ [BOX_TITLE_BORDER_GUIDE.md](BOX_TITLE_BORDER_GUIDE.md) - Box Component Properties Reference

### "How do I debug positioning issues?"

→ [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - Debugging Checklist

### "What's the math for positioning?"

→ [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - Positioning Math

### "Can you show source code references?"

→ [BOX_TITLE_BORDER_GUIDE.md](BOX_TITLE_BORDER_GUIDE.md) - OpenTUI Box Source Code Reference

---

## 📊 Document Statistics

| Document                  | Lines     | Sections | Code Examples |
| ------------------------- | --------- | -------- | ------------- |
| QUICK_REFERENCE.md        | 312       | 8        | 12            |
| BOX_TITLE_BORDER_GUIDE.md | 459       | 10       | 15            |
| PRACTICAL_EXAMPLES.md     | 557       | 5        | 4 (complete)  |
| README.md                 | 367       | 12       | 8             |
| **TOTAL**                 | **1,695** | **35**   | **39**        |

---

## ✅ Research Verification

This research is:

- ✅ Based on OpenTUI v0.1.44+ source code
- ✅ Verified with real examples from OpenTUI repo
- ✅ Includes actual working code patterns
- ✅ References actual source files
- ✅ Created November 2025
- ✅ Complete and ready to use

---

## 🚀 Getting Started

### Fastest Start (If You're In a Hurry)

```bash
1. Read: QUICK_REFERENCE.md (top section)
2. Copy: Example 1 from PRACTICAL_EXAMPLES.md
3. Modify for your needs
```

### Proper Start (If You Have Time)

```bash
1. Read: README.md (overview)
2. Read: QUICK_REFERENCE.md (reference)
3. Study: One relevant example from PRACTICAL_EXAMPLES.md
4. Keep: BOX_TITLE_BORDER_GUIDE.md for reference
```

### Deep Learning (If You Want Full Understanding)

```bash
1. Read: README.md (overview)
2. Read: BOX_TITLE_BORDER_GUIDE.md (technical)
3. Study: All PRACTICAL_EXAMPLES.md (patterns)
4. Reference: QUICK_REFERENCE.md (lookup)
```

---

## 📞 Using This Research

### In Your Code

```typescript
// Pattern: Absolute Positioning (from PRACTICAL_EXAMPLES.md)
const box = new BoxRenderable(renderer, {
  id: 'box',
  position: 'absolute',
  left: 10,
  top: 5,
  width: 40,
  height: 10,
  title: 'Title',
  border: true,
});

const content = new TextRenderable(renderer, {
  content: 'Content',
  position: 'absolute',
  left: 12,
  top: 7,
});
```

### In Your Documentation

```
Reference this research:
- For box title and border information
- For OpenTUI boxing patterns
- For correct positioning calculations
- For debugging box layout issues
```

### In Your Team

```
Share this research with:
- Other developers using OpenTUI
- Team members debugging box issues
- Anyone learning OpenTUI
- Documentation/knowledge base
```

---

## 🔗 External References

- **OpenTUI GitHub**: https://github.com/sst/opentui
- **OpenTUI Homepage**: https://opentui.com
- **OpenTUI Examples**: `/packages/core/src/examples/` in repo
- **Best Example**: `timeline-example.ts` - Shows box titles + content

---

## 📝 Document Version

| Aspect          | Details           |
| --------------- | ----------------- |
| Version         | 1.0               |
| Created         | November 2025     |
| OpenTUI Version | 0.1.44+           |
| Status          | Complete          |
| Last Updated    | November 17, 2025 |

---

## 🎯 Key Takeaway

**The Problem:** Text appearing in box border instead of content area

**The Cause:** Unpositioned children render at box origin, overlapping border

**The Solution:** Use `position: "absolute"` with `left: box.left + 2` and `top: box.top + 2`

**Where to Learn:**

- Quick fix: QUICK_REFERENCE.md
- How it works: BOX_TITLE_BORDER_GUIDE.md
- Working examples: PRACTICAL_EXAMPLES.md

---

**Research Complete ✅**  
**Ready to use 🚀**  
**All files tested and verified ✓**
