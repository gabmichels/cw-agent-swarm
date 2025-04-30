# 🧠 Chloe Adaptive Tool Intelligence System

This module provides an advanced tool intelligence system for Chloe's agent architecture. It replaces the previous intent-based routing system with a more sophisticated, learning-based approach to tool selection and execution.

## Core Components

- **ToolManager**: The central registry and coordination point for all tools
- **ToolPerformanceTracker**: Tracks success rates and execution metrics for tools
- **ToolLearner**: Learns which tools perform best for different task types and contexts
- **SmartTool Wrappers**: Add performance tracking, retry logic, and fallback mechanisms to any tool

## Key Features

### 1. Performance Tracking

The system automatically tracks:
- Success/failure rates for each tool
- Execution times
- Context-specific performance metrics
- Historical parameters that led to success/failure

### 2. Adaptive Learning

Tools are selected dynamically based on:
- Historical performance for similar tasks
- Contextual relevance
- A/B testing to discover better alternatives
- Tool combination optimization

### 3. Failure Resilience

When tools fail, the system can:
- Automatically retry with adjusted parameters
- Select alternative "fallback" tools
- Create tool combinations that complement each other

## Using the Adaptive Tool System

### Basic Tool Registration

Tools should be registered with the `ToolManager` and assigned to one or more task types:

```typescript
import { getToolManager } from './tools/toolManager';

// Get the tool manager instance
const toolManager = getToolManager();

// Register a tool with task types it can handle
toolManager.registerTool(
  new MySearchTool(), 
  ['search', 'information_retrieval']
);
```

### Tool Selection Based on Task

When your agent needs to perform a task, let the system choose the best tool:

```typescript
// Get the best tool for a specific task with context
const bestTool = toolManager.getBestToolForTask(
  'search',  // Task type
  ['web', 'research']  // Context tags
);

// Execute the tool
if (bestTool) {
  const result = await bestTool.execute({ query: 'search query' });
}
```

### Tool Combinations

For complex tasks, use tool combinations that chain multiple tools together:

```typescript
// Create a tool combination
const comboTool = toolManager.createToolCombination(
  'research_and_summarize',  // Task type
  ['web_search', 'text_summarizer']  // Tools to combine
);

// Use like a regular tool
const results = await comboTool.execute({
  query: 'topic to research',
  length: 'medium'
});
```

### Feedback and Improvement

The system automatically learns from each tool execution, but you can also provide explicit feedback:

```typescript
import { getToolLearner } from './tools/toolLearning';

// Record a successful tool usage with custom score
getToolLearner().recordTrial({
  toolName: 'web_search',
  taskType: 'search', 
  resultScore: 0.9,  // 0-1 quality score
  contextTags: ['news', 'current_events']
});
```

## Testing

Run the included test script to see the system in action:

```
node src/agents/chloe/tools/testAdaptiveTool.js
```

## Architecture Notes

This system is designed to work seamlessly with LangChain's agent architecture. Rather than using a custom intent router, we now rely on LangChain's built-in planning and tool selection capabilities, enhanced with our performance tracking and learning system.

The previous `intentRouter.ts` approach required explicit intent mapping and manual parameter extraction, whereas this new approach is more dynamic and learning-based.

## Next Steps

- **Custom Tool Pipelines**: Create multi-step pipelines of tools that can be reused
- **Reinforcement Learning**: Implement proper RL for tool selection over simple heuristics
- **Human Feedback Integration**: Add explicit interfaces for human feedback to improve tool learning 