# Agent ID Filtering Design

## Problem Statement

The scheduler system needs to support filtering tasks by agent ID to ensure that:

1. Each agent only sees and processes its own tasks
2. Tasks can be created and assigned to specific agents
3. Tasks can be executed by their assigned agents only
4. Queries for tasks can be filtered by agent ID

## Current Implementation Issues

The current implementation lacks robust agent ID filtering capabilities:

1. The `TaskFilter` interface didn't properly support filtering by nested metadata objects like agent ID
2. The `ModularSchedulerManager` lacked agent-specific methods for task management
3. There was no clear way to create agent-specific scheduler instances

## Design Solution

### Extended Interfaces

#### Enhanced TaskFilter Interface

The `TaskFilter` interface has been enhanced to support nested metadata filtering, particularly for agent ID:

```typescript
export interface TaskFilter {
  // ... existing fields ...
  
  metadata?: {
    /**
     * Filter by agent ID in metadata
     */
    agentId?: {
      /**
       * The agent ID to filter by
       */
      id?: string;
      
      /**
       * The agent namespace to filter by
       */
      namespace?: string;
      
      /**
       * The agent type to filter by
       */
      type?: string;
    };
    
    /**
     * Filter by any other metadata fields
     */
    [key: string]: unknown;
  };
  
  // ... existing fields ...
}
```

#### New Agent-Specific Methods

The `ModularSchedulerManager` class now includes the following agent-specific methods:

```typescript
/**
 * Find tasks for a specific agent
 * 
 * @param agentId - The ID of the agent
 * @param filter - Additional filter criteria
 * @returns Array of tasks for the specified agent
 */
findTasksForAgent(agentId: string, filter?: TaskFilter): Promise<Task[]>;

/**
 * Create a task for a specific agent
 * 
 * @param task - The task to create
 * @param agentId - The ID of the agent
 * @returns The created task
 */
createTaskForAgent(task: Task, agentId: string): Promise<Task>;

/**
 * Execute due tasks for a specific agent
 * 
 * @param agentId - The ID of the agent
 * @returns Array of execution results for tasks that were executed
 */
executeDueTasksForAgent(agentId: string): Promise<TaskExecutionResult[]>;
```

### Factory Function for Agent-Specific Schedulers

A new factory function `createSchedulerManagerForAgent` has been added to create agent-specific scheduler instances:

```typescript
/**
 * Create a ModularSchedulerManager with agent ID support
 * 
 * @param config - Optional configuration to override defaults
 * @param agentId - The ID of the agent to filter tasks for
 * @returns A fully initialized ModularSchedulerManager instance with agent filtering
 */
createSchedulerManagerForAgent(
  config?: Partial<SchedulerConfig>,
  agentId?: string
): Promise<ModularSchedulerManager>;
```

This function creates a scheduler that automatically:
- Adds the agent ID to all created tasks
- Filters tasks by the agent ID when querying
- Only executes tasks for the specified agent

## Implementation Details

### Metadata Structure for Agent ID

Agent IDs are stored in task metadata using the following structure:

```typescript
metadata: {
  agentId: {
    namespace: 'agent',
    type: 'agent',
    id: 'agent-123'
  }
}
```

This structure allows for:
- Filtering by agent ID
- Future extensions for different agent types or namespaces
- Compatibility with other metadata fields

### Enhanced Filtering Logic

The `MemoryTaskRegistry` implementation has been updated to support nested object filtering in metadata:

```typescript
if (filter.metadata) {
  tasks = tasks.filter(task => {
    if (!task.metadata) return false;
    
    return Object.entries(filter.metadata!).every(([key, value]) => {
      // Handle nested objects (like agentId)
      if (value !== null && typeof value === 'object') {
        // ... nested object filtering logic ...
      }
      
      // Simple property comparison
      return task.metadata![key] === value;
    });
  });
}
```

## Testing Strategy

The implementation is tested with the following scenarios:

1. Creating tasks with agent ID through agent-specific methods
2. Finding tasks for specific agents
3. Executing tasks for specific agents
4. Verifying that agent IDs are properly added to tasks
5. Ensuring tasks are only executed by their assigned agents

## Migration Approach

Existing code can migrate to using agent-specific filtering in the following ways:

1. Use the new agent-specific methods directly:
   ```typescript
   const agentTasks = await scheduler.findTasksForAgent('agent-123');
   const newTask = await scheduler.createTaskForAgent(task, 'agent-123');
   const results = await scheduler.executeDueTasksForAgent('agent-123');
   ```

2. Use the agent-specific scheduler factory:
   ```typescript
   const agentScheduler = await createSchedulerManagerForAgent(config, 'agent-123');
   // All operations on this scheduler will be filtered by agent ID
   ```

## Next Steps

1. Audit existing task creation code to ensure agent IDs are properly set
2. Update query code to use the new agent filtering capabilities
3. Consider adding additional agent metadata fields (capabilities, status, etc.)
4. Implement agent-specific metrics and monitoring 