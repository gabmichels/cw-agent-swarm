# Chloe Agent Constants

This directory contains centralized constants used throughout the Chloe agent system. This improves type safety, reduces bugs, and prepares Chloe for scalable multi-agent architecture.

## Purpose

Using enums and constants instead of hardcoded string literals provides several benefits:
- **Type Safety**: Prevents typos and ensures consistent usage
- **Refactorability**: Changing a value in one place updates it everywhere
- **Discoverability**: Makes it easy to find all possible values
- **Documentation**: Self-documents the intended values

## Organization

The constants are organized by domain:

- **memory.ts**: Constants related to memory types, categories, and importance levels
- **task.ts**: Constants related to task types and their statuses
- **action.ts**: Constants related to action routing and execution status
- **tool.ts**: Constants related to tool commands and execution results
- **agent.ts**: Constants for future multi-agent architecture support

## Usage Example

Instead of hardcoding string literals:

```typescript
// Before
function addMemory(content: string, type: string = 'message') {
  // Implementation
}

// Usage
addMemory('Some content', 'thought');
```

Use the constants for type safety:

```typescript
// After
import { MemoryType } from '../constants';

function addMemory(content: string, type: MemoryType = MemoryType.MESSAGE) {
  // Implementation
}

// Usage
addMemory('Some content', MemoryType.THOUGHT);
```

## Adding New Constants

When adding new features that require type constants:

1. Identify the appropriate file based on the domain
2. Add the new constant to the relevant enum
3. Update any existing code to use the new constant

If a completely new domain is needed, create a new file and add it to the exports in index.ts.

## Benefits for Multi-Agent Architecture

By centralizing these constants, we've prepared Chloe for a scalable multi-agent system:

- Agents can share common type definitions
- Messages between agents use consistent type values
- Components can be reused across different agent types
- New agent types can be added with minimal code duplication 