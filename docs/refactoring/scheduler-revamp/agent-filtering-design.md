# Agent ID Filtering in Scheduler System: Design Document

## 🎯 Problem Statement

The current ModularSchedulerManager implementation does not properly filter tasks by agent ID, which could lead to tasks being executed by unintended agents in a multi-agent system. This document outlines the design for implementing proper agent ID filtering in the scheduler system.

## 🔍 Current Implementation Issues

1. **Task Creation**: When creating tasks, the agent ID is often hardcoded as "default" in the metadata rather than using the actual agent ID:
   ```typescript
   metadata: {
     agentId: {
       namespace: "agent",
       type: "agent",
       id: "default" // Should be the actual agent ID
     }
   }
   ```

2. **Task Filtering**: There's no automatic filtering mechanism to ensure agents only execute their own tasks. The `findTasks()` method doesn't specifically handle agent-based filtering.

3. **Task Execution**: When executing due tasks, all tasks are considered regardless of which agent they belong to.

## 📝 Design Solution

### 1. Extended TaskFilter Interface

Extend the TaskFilter interface to support metadata filtering with agent ID:

```typescript
interface TaskFilter {
  id?: string;
  name?: string;
  status?: TaskStatus;
  priority?: number;
  scheduleType?: TaskScheduleType;
  metadata?: {
    agentId?: {
      id?: string;
    };
    [key: string]: unknown;
  };
}
```

### 2. Agent-Specific Task Methods

Add agent-specific methods to the ModularSchedulerManager:

```typescript
/**
 * Find tasks for a specific agent
 * @param agentId The ID of the agent
 * @param filter Additional filter criteria
 * @returns Tasks matching the filter for the specified agent
 */
async findTasksForAgent(agentId: string, filter: TaskFilter = {}): Promise<Task[]> {
  const combinedFilter = {
    ...filter,
    metadata: {
      ...filter.metadata,
      agentId: {
        id: agentId
      }
    }
  };
  return this.findTasks(combinedFilter);
}

/**
 * Execute due tasks for a specific agent
 * @param agentId The ID of the agent
 * @returns Execution results for the tasks that were executed
 */
async executeDueTasksForAgent(agentId: string): Promise<TaskExecutionResult[]> {
  // Get all due tasks
  const dueTasks = await this.taskScheduler.getDueTasks();
  
  // Filter tasks for the specified agent
  const agentTasks = dueTasks.filter(task => 
    task.metadata?.agentId?.id === agentId
  );
  
  // Execute the agent's tasks
  return this.taskExecutor.executeTasks(agentTasks);
}
```

### 3. Task Creation with Correct Agent ID

Update the task creation process to include the correct agent ID:

```typescript
/**
 * Create a task for a specific agent
 * @param task The task to create
 * @param agentId The ID of the agent
 * @returns The created task
 */
async createTaskForAgent(task: Task, agentId: string): Promise<Task> {
  // Ensure metadata exists
  if (!task.metadata) {
    task.metadata = {};
  }
  
  // Set the agent ID in metadata
  task.metadata.agentId = {
    namespace: 'agent',
    type: 'agent',
    id: agentId
  };
  
  // Create the task
  return this.createTask(task);
}
```

### 4. Scheduler Factory with Agent ID Support

Update the scheduler factory to include agent ID support:

```typescript
/**
 * Create a scheduler manager with agent ID support
 * @param config The scheduler configuration
 * @param agentId The ID of the agent
 * @returns A scheduler manager instance
 */
export async function createSchedulerManagerForAgent(
  config: SchedulerConfig, 
  agentId: string
): Promise<ModularSchedulerManager> {
  const scheduler = await createSchedulerManager(config);
  
  // Store the agent ID for filtering
  scheduler['agentId'] = agentId;
  
  // Override the executeDueTasks method to filter by agent ID
  const originalExecuteDueTasks = scheduler.executeDueTasks.bind(scheduler);
  scheduler.executeDueTasks = async function() {
    // Get all due tasks
    const dueTasks = await this.taskScheduler.getDueTasks();
    
    // Filter tasks for this agent
    const agentTasks = dueTasks.filter(task => 
      task.metadata?.agentId?.id === this['agentId']
    );
    
    // Execute the agent's tasks
    return this.taskExecutor.executeTasks(agentTasks);
  };
  
  return scheduler;
}
```

## 🧪 Testing Strategy

1. **Unit Tests**:
   - Test `findTasksForAgent` to ensure it correctly filters tasks by agent ID
   - Test `executeDueTasksForAgent` to verify only the specified agent's tasks are executed
   - Test `createTaskForAgent` to confirm the agent ID is properly set in metadata

2. **Integration Tests**:
   - Test multiple scheduler instances with different agent IDs
   - Verify tasks are only executed by their intended agent
   - Test concurrent execution of tasks by different agents

3. **Migration Tests**:
   - Test migration of existing tasks to include proper agent IDs
   - Verify backward compatibility with tasks that don't have agent IDs

## 📋 Implementation Plan

1. Update the TaskFilter interface to support metadata filtering
2. Implement agent-specific methods in ModularSchedulerManager
3. Create a utility for migrating existing tasks to include agent IDs
4. Update the scheduler factory to support agent ID filtering
5. Add tests to verify agent ID filtering works correctly
6. Update documentation to reflect the new agent ID filtering capabilities

## 🔄 Migration Strategy

For existing tasks without proper agent IDs:

1. Identify the agent that created each task (if possible)
2. Update task metadata to include the correct agent ID
3. For tasks where the agent can't be identified, assign them to a default agent
4. Provide a utility function to help with this migration:

```typescript
/**
 * Migrate tasks to include agent IDs
 * @param tasks The tasks to migrate
 * @param defaultAgentId The default agent ID to use if none can be determined
 * @returns The migrated tasks
 */
export function migrateTasksWithAgentIds(
  tasks: Task[], 
  defaultAgentId: string
): Task[] {
  return tasks.map(task => {
    // Skip tasks that already have an agent ID
    if (task.metadata?.agentId?.id) {
      return task;
    }
    
    // Ensure metadata exists
    if (!task.metadata) {
      task.metadata = {};
    }
    
    // Set the agent ID in metadata
    task.metadata.agentId = {
      namespace: 'agent',
      type: 'agent',
      id: defaultAgentId
    };
    
    return task;
  });
}
```

## 📊 Expected Outcomes

1. Tasks will only be executed by their intended agent
2. Multi-agent systems will have proper task isolation
3. Task filtering will be more efficient
4. The scheduler system will be more robust and reliable
5. Agents will have a clear view of their own tasks 