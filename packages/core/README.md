# @crowd-wisdom/core

Core functionality for the Crowd Wisdom Employees platform.

## TypeScript Configuration

This package currently uses `// @ts-ignore` comments for some imports and function calls related to LangChain and LangGraph. These will be resolved when:

1. We finalize our dependency versions
2. Update our types to match the actual LangChain/LangGraph API
3. Implement proper TypeScript declarations for our interfaces

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

## Known TypeScript Issues

1. `@langchain/langgraph` typings are not fully compatible with our usage
2. Some of the StateGraph API calls need proper typing
3. We need proper type definitions for the message formats

These issues will be addressed in future updates. 