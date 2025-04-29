# ChloeGraph - Advanced Planning System

This directory contains implementations for Chloe's planning and execution system.

## Overview

The planning system has two implementations:

1. **ChloeGraph** (graph.ts) - The original implementation providing a simplified LangGraph-style workflow with planning and execution capabilities.

2. **ChloePlanningGraph** (chloeGraph.ts) - An enhanced implementation with advanced planning capabilities, including sub-goal decomposition, execution tracking, and dynamic reflection.

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
// Using original ChloeGraph
const result = await agent.planAndExecute('Create a social media strategy');

// Using new ChloePlanningGraph
const result = await agent.planAndExecuteWithGraph('Create a social media strategy', { trace: true });
```

## Implementation Details

Both systems follow a similar architecture with these key components:

1. **Planning** - Breaking down goals into manageable tasks
2. **Execution** - Performing each task with appropriate tools
3. **Reflection** - Analyzing progress and adjusting as needed
4. **Finalization** - Producing a final result

The newer ChloePlanningGraph implementation uses a more structured approach with interfaces like `PlanningState`, `SubGoal`, and `PlanningTask` for better type safety and organization.

## Testing

A test script is included to verify both implementations:

```
npx ts-node src/agents/chloe/graph/test.ts
``` 