**Reverse Engineer Application Specification (Language-Agnostic)**

Analyze this codebase and produce a comprehensive specification document that would enable reimplementation in any language or framework.

**Critical Constraint: Abstraction Level**

This document must be **completely language and framework agnostic**:

- ❌ NO references to specific languages (TypeScript, JavaScript, Python, etc.)
- ❌ NO framework-specific terminology (React hooks, Redux, Express middleware, etc.)
- ❌ NO library names or APIs (Ink, Zustand, Zod, etc.)
- ❌ NO code snippets or syntax examples
- ❌ NO file paths or directory structures
- ✅ USE universal concepts: "reactive state," "component," "event handler," "validation layer"
- ✅ DESCRIBE behaviors, not implementations
- ✅ TRANSLATE framework patterns to generic equivalents (e.g., "React context" → "dependency injection / shared state container")

**Document Structure:**

1. **Executive Summary** - Core purpose, target users, and key value proposition

2. **Architecture Overview**
   - High-level system design and component relationships
   - Data flow (described conceptually or via diagrams)
   - Architectural patterns in universal terms (e.g., "observer pattern," "command pattern," not "useEffect")

3. **Core Domain Model**
   - Primary entities, their attributes, and relationships
   - State management approach (conceptually)
   - Key data structures with field descriptions (as tables or prose, not type definitions)

4. **Feature Specifications** - For each major feature:
   - Functional requirements (what it does)
   - User interactions and workflows
   - Validation rules and constraints
   - Edge cases and error handling
   - Dependencies on other features

5. **External Integrations**
   - Provider/backend systems supported
   - Authentication/credential handling patterns
   - Protocol-level details (REST, SSH, etc.) without library specifics

6. **UI/UX Specifications**
   - Screen/view inventory with descriptions
   - Navigation patterns and state transitions
   - Input model (keyboard shortcuts, mouse interactions)
   - Theming/styling system requirements

7. **Configuration & Extensibility**
   - User-configurable options
   - Extension points and plugin architecture (if any)

8. **Non-Functional Requirements**
   - Performance considerations
   - Error handling philosophy
   - Logging/telemetry approach

**Guidelines:**

- Write as if explaining to someone who has never seen the source code
- When you encounter a framework-specific pattern, describe the _problem it solves_ and the _behavior it provides_
- Include concrete examples of user workflows, not code
- Flag any behaviors that seem tightly coupled to the current implementation
