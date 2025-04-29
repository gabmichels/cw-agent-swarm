# ChloeGraph - Advanced Planning System

This directory contains the implementation for Chloe's planning and execution system.

## Overview

ChloeGraph is an enhanced implementation with advanced planning capabilities, including sub-goal decomposition, execution tracking, and dynamic reflection. It follows a modular, node-based architecture inspired by LangGraph.

## Features

- Task decomposition into sub-goals
- Dynamic planning and execution
- Reflection capabilities
- Error handling and recovery
- Execution tracing
- Modular node architecture

## Architecture

The system follows a modular approach with these key components:

- `ChloeGraph`: The main class that sets up and manages the state graph
- `StateGraph`: A custom implementation of a state graph that manages transitions between nodes
- `Nodes`: Individual functional components that handle specific parts of the planning and execution process

### Node Types

Each node represents a specific step in the planning and execution workflow:

- `planTaskNode`: Decomposes a goal into sub-goals
- `decideNextStepNode`: Determines the next action to take
- `executeStepNode`: Executes a specific sub-goal
- `reflectOnProgressNode`: Evaluates progress and adjusts the plan if needed
- `finalizeNode`: Completes the task and generates a summary

## Usage

The planning system can be used via the main Chloe agent interface:

```typescript
// Using ChloeGraph implementation
const result = await agent.planAndExecute('Create a social media strategy');

// Or directly with the ChloeGraph
const graph = createChloeGraph({
  model: llm,
  memory: chloeMemory,
  taskLogger: logger,
  tools: availableTools
});

const result = await graph.execute("Create a marketing plan for our new product");
```

## Implementation Details

The system is designed to be:

1. **Modular**: Each component has a single responsibility
2. **Flexible**: Can easily accommodate new node types and execution paths
3. **Maintainable**: Clear separation of concerns makes debugging and extending easier
4. **Well-documented**: Each component and function includes JSDoc comments

### Flow Control

The execution flow follows this pattern:

1. Plan the task by breaking it down into sub-goals
2. Decide the next step to take
3. Execute sub-goals one by one
4. Periodically reflect on progress and adjust the plan
5. Finalize the task with a comprehensive summary

Custom routing logic determines which node is executed next, allowing for dynamic workflow changes based on the current state.

## Testing

A test script is included to verify the implementation:

```
npx ts-node src/agents/chloe/graph/test.ts
``` 