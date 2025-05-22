/**
 * SchedulerFactory.ts - Factory for Creating Scheduler Components
 * 
 * This file provides factory functions to simplify creation of scheduler components
 * and the ModularSchedulerManager. This helps with migration from DefaultSchedulerManager.
 */

import { ModularSchedulerManager } from '../implementations/ModularSchedulerManager';
import { MemoryTaskRegistry } from '../implementations/registry/MemoryTaskRegistry';
import { StrategyBasedTaskScheduler } from '../implementations/scheduler/StrategyBasedTaskScheduler';
import { ExplicitTimeStrategy } from '../implementations/strategies/ExplicitTimeStrategy';
import { IntervalStrategy } from '../implementations/strategies/IntervalStrategy';
import { PriorityBasedStrategy } from '../implementations/strategies/PriorityBasedStrategy';
import { BasicTaskExecutor } from '../implementations/executor/BasicTaskExecutor';
import { BasicDateTimeProcessor } from '../implementations/datetime/BasicDateTimeProcessor';
import { SchedulerConfig, DEFAULT_SCHEDULER_CONFIG } from '../models/SchedulerConfig.model';
import { Task, TaskStatus } from '../models/Task.model';
import { TaskExecutionResult } from '../models/TaskExecutionResult.model';
import { TaskFilter } from '../models/TaskFilter.model';

/**
 * Factory function to create a ModularSchedulerManager with standard components
 * 
 * This simplifies the migration from DefaultSchedulerManager by creating all
 * necessary components with sensible defaults.
 * 
 * @param config - Optional configuration to override defaults
 * @returns A fully initialized ModularSchedulerManager instance
 */
export async function createSchedulerManager(config?: Partial<SchedulerConfig>): Promise<ModularSchedulerManager> {
  // Create the date time processor
  const dateTimeProcessor = new BasicDateTimeProcessor();
  
  // Create the task registry
  const registry = new MemoryTaskRegistry();
  
  // Create the scheduling strategies
  const explicitStrategy = new ExplicitTimeStrategy();
  const intervalStrategy = new IntervalStrategy();
  const priorityStrategy = new PriorityBasedStrategy();
  
  // Create the scheduler with all strategies
  const scheduler = new StrategyBasedTaskScheduler([
    explicitStrategy,
    intervalStrategy,
    priorityStrategy
  ]);
  
  // Create the task executor
  const executor = new BasicTaskExecutor();
  
  // Create the scheduler manager with all components
  const manager = new ModularSchedulerManager(
    registry,
    scheduler,
    executor,
    dateTimeProcessor,
    config
  );
  
  // Initialize the manager
  await manager.initialize();
  
  return manager;
}

/**
 * Factory function to create a ModularSchedulerManager with agent ID support
 * 
 * This creates a scheduler manager that automatically filters tasks by agent ID.
 * 
 * @param config - Optional configuration to override defaults
 * @param agentId - The ID of the agent to filter tasks for
 * @returns A fully initialized ModularSchedulerManager instance with agent filtering
 */
export async function createSchedulerManagerForAgent(
  config?: Partial<SchedulerConfig>,
  agentId?: string
): Promise<ModularSchedulerManager> {
  // Create the standard scheduler manager
  const manager = await createSchedulerManager(config);
  
  // If no agent ID is provided, return the standard manager
  if (!agentId) {
    return manager;
  }
  
  // Store the agent ID for filtering
  const agentAwareManager = manager as ModularSchedulerManager & { 
    agentId: string;
    findTasksForAgent: (agentId: string, filter?: TaskFilter) => Promise<Task[]>;
  };
  agentAwareManager.agentId = agentId;
  
  // Store original methods to avoid recursive calls
  const originalExecuteDueTasks = manager.executeDueTasks.bind(manager);
  const originalCreateTask = manager.createTask.bind(manager);
  const originalFindTasks = manager.findTasks.bind(manager);
  const originalExecuteTaskNow = manager.executeTaskNow.bind(manager);
  
  // Override the findTasks method to filter by agent ID
  // We need to directly override the method on the object
  Object.defineProperty(agentAwareManager, 'findTasks', {
    value: async function(filter: TaskFilter = {}): Promise<Task[]> {
      // Create a new filter that includes the agent ID
      const agentFilter: TaskFilter = {
        ...filter,
        metadata: {
          ...filter.metadata,
          agentId: {
            id: this.agentId
          }
        }
      };
      
      // Use the original findTasks with the agent filter
      return await originalFindTasks(agentFilter);
    },
    writable: true,
    configurable: true
  });
  
  // Override the createTask method to automatically add agent ID
  Object.defineProperty(agentAwareManager, 'createTask', {
    value: async function(task: Task): Promise<Task> {
      // Ensure metadata exists
      const metadata = task.metadata || {};
      
      // Set the agent ID in metadata
      const taskWithAgentId: Task = {
        ...task,
        metadata: {
          ...metadata,
          agentId: {
            namespace: 'agent',
            type: 'agent',
            id: this.agentId
          }
        }
      };
      
      // Call the original createTask method to avoid recursion
      return await originalCreateTask(taskWithAgentId);
    },
    writable: true,
    configurable: true
  });
  
  // Override the executeDueTasks method to filter by agent ID
  Object.defineProperty(agentAwareManager, 'executeDueTasks', {
    value: async function(): Promise<TaskExecutionResult[]> {
      // Get pending tasks for this agent
      const pendingTasks = await this.findTasks({
        status: TaskStatus.PENDING
      });
      
      if (!pendingTasks.length) {
        return [];
      }
      
      // Execute each due task individually
      const results: TaskExecutionResult[] = [];
      for (const task of pendingTasks) {
        // Check if the task is due (has a scheduled time in the past)
        const now = new Date();
        if (task.scheduledTime && task.scheduledTime <= now) {
          // Execute the task
          const result = await originalExecuteTaskNow(task.id);
          results.push(result);
        }
      }
      
      return results;
    },
    writable: true,
    configurable: true
  });
  
  return agentAwareManager;
}

/**
 * Factory function to create only the scheduler components without initializing them
 * 
 * This is useful when you need more control over the initialization process.
 * 
 * @returns All components needed for a ModularSchedulerManager
 */
export function createSchedulerComponents() {
  const dateTimeProcessor = new BasicDateTimeProcessor();
  const registry = new MemoryTaskRegistry();
  
  const explicitStrategy = new ExplicitTimeStrategy();
  const intervalStrategy = new IntervalStrategy();
  const priorityStrategy = new PriorityBasedStrategy();
  
  const scheduler = new StrategyBasedTaskScheduler([
    explicitStrategy,
    intervalStrategy,
    priorityStrategy
  ]);
  
  const executor = new BasicTaskExecutor();
  
  return {
    dateTimeProcessor,
    registry,
    scheduler,
    executor,
    strategies: {
      explicitStrategy,
      intervalStrategy,
      priorityStrategy
    }
  };
}

/**
 * Migration helper for replacing DefaultSchedulerManager
 * 
 * @param config - Optional configuration to override defaults
 * @returns A fully initialized ModularSchedulerManager instance
 * @deprecated Use createSchedulerManager instead. This is only for easing migration.
 */
export async function createDefaultSchedulerManagerReplacement(
  config?: Partial<SchedulerConfig>
): Promise<ModularSchedulerManager> {
  return createSchedulerManager(config);
} 