# Migration Guide: DefaultSchedulerManager to ModularSchedulerManager

## Overview

This document provides guidance for migrating from `DefaultSchedulerManager` to the new `ModularSchedulerManager` with a focus on ensuring proper agent ID assignment for all tasks.

## Key Migration Steps

### 1. Replace Scheduler Creation

```typescript
// Before
const scheduler = new DefaultSchedulerManager();

// After
const scheduler = await createSchedulerManager();
// OR for agent-specific scheduler
const agentScheduler = await createSchedulerManagerForAgent(config, 'agent-id');
```

### 2. CRITICAL: Always Use createTaskForAgent

When creating tasks, **always** use `createTaskForAgent` instead of `createTask` to ensure proper agent ID assignment:

```typescript
// Before
const task = await scheduler.createTask({
  name: 'My Task',
  // other task properties
});

// After - ALWAYS USE THIS PATTERN
const task = await scheduler.createTaskForAgent({
  name: 'My Task',
  // other task properties
}, 'agent-id');
```

### 3. Replace Task Filtering

```typescript
// Before
const tasks = await scheduler.findTasks({
  metadata: {
    agentId: 'agent-id' // Old flat structure
  }
});

// After
const tasks = await scheduler.findTasksForAgent('agent-id');
```

### 4. Replace Task Execution

```typescript
// Before
const allTasks = await scheduler.findTasks({
  metadata: {
    agentId: 'agent-id'
  },
  status: TaskStatus.PENDING
});
const results = await scheduler.executeTasks(allTasks);

// After
const results = await scheduler.executeDueTasksForAgent('agent-id');
```

## Common Migration Patterns

### Agent-Specific Operations

For agent-specific code, use the agent-specific scheduler:

```typescript
// Create an agent-specific scheduler
const agentScheduler = await createSchedulerManagerForAgent(config, 'agent-id');

// All operations automatically filter by agent ID
const tasks = await agentScheduler.findTasks({});
const results = await agentScheduler.executeDueTasks();
const newTask = await agentScheduler.createTask(taskData);
```

### Multi-Agent Systems

For systems managing multiple agents:

```typescript
// Create a standard scheduler
const scheduler = await createSchedulerManager(config);

// Use agent-specific methods
const agent1Tasks = await scheduler.findTasksForAgent('agent-1');
const agent2Tasks = await scheduler.findTasksForAgent('agent-2');

// Create tasks for specific agents
await scheduler.createTaskForAgent(taskData, 'agent-1');
await scheduler.createTaskForAgent(taskData, 'agent-2');

// Execute tasks for specific agents
await scheduler.executeDueTasksForAgent('agent-1');
await scheduler.executeDueTasksForAgent('agent-2');
```

## Audit Checklist

To ensure proper migration:

1. ✅ Replace all instances of `new DefaultSchedulerManager()` with `createSchedulerManager()` or `createSchedulerManagerForAgent()`
2. ✅ Replace all calls to `createTask()` with `createTaskForAgent()`
3. ✅ Update all task filtering to use `findTasksForAgent()`
4. ✅ Update all task execution to use `executeDueTasksForAgent()`
5. ✅ Verify that all tasks have proper agent ID metadata

## Common Migration Issues

### Missing Agent IDs

If tasks are created without agent IDs:

```typescript
// Wrong - Missing agent ID
await scheduler.createTask(taskData);

// Correct
await scheduler.createTaskForAgent(taskData, 'agent-id');
```

### Incorrect Metadata Structure

The new agent ID structure is nested:

```typescript
// Old structure (incorrect)
metadata: {
  agentId: 'agent-id'
}

// New structure (correct)
metadata: {
  agentId: {
    namespace: 'agent',
    type: 'agent',
    id: 'agent-id'
  }
}
```

### Testing Migration Success

Run this check to find tasks without proper agent IDs:

```typescript
const tasksWithoutAgentId = await scheduler.findTasks({
  metadata: {
    agentId: null
  }
});

if (tasksWithoutAgentId.length > 0) {
  console.warn(`Found ${tasksWithoutAgentId.length} tasks without agent IDs`);
}
``` 