# ChloeGraph - Advanced Planning System

This directory contains the implementation for Chloe's planning and execution system.

## Overview

ChloeGraph is an enhanced implementation with advanced planning capabilities, including sub-goal decomposition, execution tracking, and dynamic reflection.

## Features

- Task decomposition into sub-goals
- Dynamic planning and execution
- Reflection capabilities
- Error handling and recovery
- Execution tracing
- Streaming support

## Usage

The planning system can be used via the main Chloe agent interface:

```typescript
// Using ChloeGraph implementation
const result = await agent.planAndExecute('Create a social media strategy');
```

## Implementation Details

The system follows a structured architecture with these key components:

1. **Planning** - Breaking down goals into manageable tasks
2. **Execution** - Performing each task with appropriate tools
3. **Reflection** - Analyzing progress and adjusting as needed
4. **Finalization** - Producing a final result

The implementation uses a structured approach with interfaces like `PlanningState`, `SubGoal`, and `PlanningTask` for better type safety and organization.

## Testing

A test script is included to verify the implementation:

```
npx ts-node src/agents/chloe/graph/test.ts
``` 