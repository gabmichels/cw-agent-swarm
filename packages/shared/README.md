# @crowd-wisdom/shared

Shared types, utilities, and constants for the Crowd Wisdom Employees platform.

## Overview

This package contains common code that's reused across other packages in the monorepo:

- Types: Common TypeScript interfaces and type definitions
- Constants: Shared constant values
- Utilities: Helper functions for common operations

## Usage

```typescript
// Import types
import { AgentConfig, Message, Task } from '@crowd-wisdom/shared';

// Import constants
import { SYSTEM_PROMPTS, DEFAULT_LLM_TEMPERATURE } from '@crowd-wisdom/shared';

// Import utilities
import { formatDate, truncateText } from '@crowd-wisdom/shared';
```

## Development

```bash
# Install dependencies
pnpm install

# Build the package
pnpm build

# Run type checking
pnpm check-types

# Run linting
pnpm lint
``` 