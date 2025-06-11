/**
 * SchedulerFactory.ts - Factory for Creating Scheduler Components
 * 
 * This file provides factory functions to simplify creation of scheduler components
 * and the ModularSchedulerManager. This helps with migration from DefaultSchedulerManager.
 */

import { ModularSchedulerManager } from '../implementations/ModularSchedulerManager';
import { MemoryTaskRegistry } from '../implementations/registry/MemoryTaskRegistry';
import { QdrantTaskRegistry } from '../implementations/registry/QdrantTaskRegistry';
import { BatchTaskRegistry } from '../implementations/registry/BatchTaskRegistry';
import { StrategyBasedTaskScheduler } from '../implementations/scheduler/StrategyBasedTaskScheduler';
import { ExplicitTimeStrategy } from '../implementations/strategies/ExplicitTimeStrategy';
import { IntervalStrategy } from '../implementations/strategies/IntervalStrategy';
import { PriorityBasedStrategy } from '../implementations/strategies/PriorityBasedStrategy';
import { CapacityBasedStrategy } from '../implementations/strategies/CapacityBasedStrategy';
import { BasicTaskExecutor } from '../implementations/executor/BasicTaskExecutor';
import { AgentAwareTaskExecutor } from '../implementations/executor/AgentAwareTaskExecutor';
import { MultiAgentTaskExecutor } from '../implementations/executor/MultiAgentTaskExecutor';
import { BasicDateTimeProcessor } from '../implementations/datetime/BasicDateTimeProcessor';
import { SchedulerConfig, DEFAULT_SCHEDULER_CONFIG } from '../models/SchedulerConfig.model';
import { Task, TaskStatus } from '../models/Task.model';
import { TaskExecutionResult } from '../models/TaskExecutionResult.model';
import { TaskFilter } from '../models/TaskFilter.model';
import { QdrantClient } from '@qdrant/js-client-rest';
import { TaskRegistry } from '../interfaces/TaskRegistry.interface';
import { AgentBase } from '../../../agents/shared/base/AgentBase.interface';
import { RuntimeAgentRegistry } from '../implementations/agent/RuntimeAgentRegistry';

/**
 * Registry type options for scheduler
 */
export enum RegistryType {
  MEMORY = 'memory',
  QDRANT = 'qdrant'
}

/**
 * Extended scheduler configuration including registry options
 */
export interface ExtendedSchedulerConfig extends SchedulerConfig {
  registryType: RegistryType;
  qdrantUrl?: string;
  qdrantApiKey?: string;
  qdrantCollectionName?: string;
  cacheMaxSize?: number;
  cacheTtlMs?: number;
  useBatching?: boolean;
  batchSize?: number;
}

/**
 * Default extended configuration
 */
export const DEFAULT_EXTENDED_CONFIG: ExtendedSchedulerConfig = {
  ...DEFAULT_SCHEDULER_CONFIG,
  registryType: RegistryType.QDRANT,
  qdrantUrl: 'http://localhost:6333',
  qdrantCollectionName: 'tasks',
  cacheMaxSize: 500,
  cacheTtlMs: 60000,
  useBatching: true,
  batchSize: 50
};

/**
 * Factory function to create a TaskRegistry based on configuration
 */
export async function createTaskRegistry(
  config: Partial<ExtendedSchedulerConfig> = {}
): Promise<TaskRegistry> {
  const fullConfig = { ...DEFAULT_EXTENDED_CONFIG, ...config };
  
  console.log("🔧 🔧 🔧 SCHEDULER FACTORY DEBUG:");
  console.log("Registry type:", fullConfig.registryType);
  console.log("Qdrant URL:", fullConfig.qdrantUrl);
  console.log("Collection name:", fullConfig.qdrantCollectionName);
  console.log("Full config:", JSON.stringify(fullConfig, null, 2));
  
  let registry: TaskRegistry;
  
  if (fullConfig.registryType === RegistryType.QDRANT) {
    console.log("✅ Creating QdrantTaskRegistry...");
    // Create Qdrant-based registry
    if (!fullConfig.qdrantUrl) {
      throw new Error('qdrantUrl is required for Qdrant registry');
    }
    
    try {
    const qdrantClient = new QdrantClient({
      url: fullConfig.qdrantUrl,
      apiKey: fullConfig.qdrantApiKey
    });
      
      console.log("📡 Qdrant client created, initializing registry...");
    
    // Create task registry with agent integration
    console.log("🔥 Creating QdrantTaskRegistry with REAL AGENT INTEGRATION");
    registry = new QdrantTaskRegistry(
      qdrantClient,
      'tasks',
      {
        maxSize: fullConfig.cacheMaxSize,
        ttlMs: fullConfig.cacheTtlMs
      }
    );
    console.log("✅ Task registry created with FULL agent.planAndExecute() integration");
    
      console.log("🔄 Calling registry.initialize()...");
    // Initialize the registry
    await (registry as QdrantTaskRegistry).initialize();
      console.log("✅ QdrantTaskRegistry initialized successfully!");
      
    } catch (error) {
      console.error("❌ ERROR creating/initializing QdrantTaskRegistry:", error);
      console.error("❌ Error stack:", (error as Error).stack);
      console.log("🔄 Falling back to MemoryTaskRegistry due to error");
      // Fall back to memory registry if Qdrant fails
      registry = new MemoryTaskRegistry();
    }
  } else {
    console.log("📝 Creating MemoryTaskRegistry (registry type was not QDRANT)");
    // Default to memory-based registry
    registry = new MemoryTaskRegistry();
  }
  
  // Wrap with batch operations if enabled
  if (fullConfig.useBatching) {
    console.log("📦 Wrapping registry with BatchTaskRegistry");
    registry = new BatchTaskRegistry(registry, fullConfig.batchSize);
  }
  
  console.log("🏁 Final registry type:", registry.constructor.name);
  console.log("🔧 🔧 🔧 SCHEDULER FACTORY DEBUG COMPLETE");
  
  return registry;
}

/**
 * Factory function to create a ModularSchedulerManager with standard components
 * 
 * This simplifies the migration from DefaultSchedulerManager by creating all
 * necessary components with sensible defaults.
 * 
 * @param config - Optional configuration to override defaults
 * @param agent - Optional agent instance to associate with the scheduler
 * @returns A fully initialized ModularSchedulerManager instance
 */
export async function createSchedulerManager(
  config?: Partial<ExtendedSchedulerConfig>,
  agent?: AgentBase
): Promise<ModularSchedulerManager> {
  // Create the date time processor
  const dateTimeProcessor = new BasicDateTimeProcessor();
  
  // Create the task registry
  const registry = await createTaskRegistry(config);
  
  // Create agent registry for capacity-based strategy
  const agentRegistry = new RuntimeAgentRegistry();
  
  // Create the scheduling strategies
  const explicitStrategy = new ExplicitTimeStrategy();
  const intervalStrategy = new IntervalStrategy();
  // Development-friendly PriorityBasedStrategy:
  // - Priority threshold 7 (so priority 7+ tasks execute immediately)
  // - Pending time 30 minutes (so lower priority tasks become due after 30 min)
  const priorityStrategy = new PriorityBasedStrategy(7, 30 * 60 * 1000);
  // Capacity-based strategy: Execute low-priority tasks when < 70% capacity used
  const capacityStrategy = new CapacityBasedStrategy(agentRegistry, 0.7, 7);
  
  // Create the scheduler with all strategies
  const scheduler = new StrategyBasedTaskScheduler([
    explicitStrategy,
    intervalStrategy,
    priorityStrategy,
    capacityStrategy
  ]);
  
  // Create the task executor - REAL AGENT EXECUTION!
  const executor = agent 
    ? new AgentAwareTaskExecutor(agent, config?.maxConcurrentTasks || 5)
    : new MultiAgentTaskExecutor(config?.maxConcurrentTasks || 20);
  
  // Log which executor is being used
  if (agent) {
    console.log(`🔥 Creating REAL AgentAwareTaskExecutor for agent ${agent.getId()}`);
  } else {
    console.log(`🔥 Creating REAL MultiAgentTaskExecutor for global scheduler`);
  }
  
  // Create the scheduler manager with all components
  let manager;
  try {
    // Development-friendly config overrides
    const devConfig = {
      schedulingIntervalMs: 60000, // Check every 60 seconds instead of 5 seconds
      maxConcurrentTasks: 5, // Start with 5 concurrent tasks for development
      defaultTaskTimeoutMs: 120000, // 2 minutes timeout for tasks
      ...config
    };
    
    manager = new ModularSchedulerManager(
    registry,
    scheduler,
    executor,
    dateTimeProcessor,
    devConfig,
    agent
  );
  } catch (constructorError: unknown) {
    console.error("[SCHEDULER FACTORY] ERROR in ModularSchedulerManager constructor:", constructorError);
    console.error("[SCHEDULER FACTORY] Constructor error stack:", (constructorError as Error).stack);
    throw constructorError;
  }
  
  // Initialize the manager
  try {
  await manager.initialize();
  } catch (initError: unknown) {
    console.error("[SCHEDULER FACTORY] ERROR in manager.initialize():", initError);
    console.error("[SCHEDULER FACTORY] Initialize error stack:", (initError as Error).stack);
    throw initError;
  }
  
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
  // Force agent-specific schedulers to use MemoryTaskRegistry to prevent conflicts
  // This avoids the issue where multiple agents see the same tasks in shared Qdrant
  const agentConfig = {
    ...config,
    registryType: RegistryType.MEMORY // Override to use memory registry for agent-specific schedulers
  };
  
  console.log(`🔧 Creating agent-specific scheduler for agent ${agentId} with MemoryTaskRegistry to avoid conflicts`);
  
  // Create the standard scheduler manager with memory registry
  const manager = await createSchedulerManager(agentConfig);
  
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
  
  // CRITICAL FIX: Set a mock agent object so the scheduler knows it's agent-specific
  // This ensures the scheduler uses agent-specific execution path
  const mockAgent = {
    getId: () => agentId
  };
  (agentAwareManager as any).agent = mockAgent;
  
  console.log(`✅ Set mock agent for scheduler manager - agent ID: ${agentId}`);
  
  // Store original methods to avoid recursive calls
  const originalExecuteDueTasks = manager.executeDueTasks.bind(manager);
  const originalExecuteDueTasksForAgent = manager.executeDueTasksForAgent.bind(manager);
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
      
      console.log(`🔍 Agent ${this.agentId} findTasks with filter:`, {
        originalFilter: filter,
        agentFilter: agentFilter,
        registryType: 'Memory'
      });
      
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
      
      console.log(`📝 Creating task for agent ${this.agentId}:`, {
        taskId: taskWithAgentId.id,
        taskName: taskWithAgentId.name,
        agentId: this.agentId,
        scheduledTime: taskWithAgentId.scheduledTime,
        metadata: taskWithAgentId.metadata
      });
      
      // Call the original createTask method to avoid recursion
      return await originalCreateTask(taskWithAgentId);
    },
    writable: true,
    configurable: true
  });
  
  // Override executeDueTasksForAgent to provide better logging and execution
  Object.defineProperty(agentAwareManager, 'executeDueTasksForAgent', {
    value: async function(agentId: string): Promise<TaskExecutionResult[]> {
      console.log(`🎯 Agent ${agentId} checking for due tasks...`);
      
      // Get pending tasks for this agent
      const pendingTasks = await this.findTasks({
        status: TaskStatus.PENDING
      });
      
      if (!pendingTasks.length) {
        console.log(`📭 Agent ${agentId} has no pending tasks`);
        return [];
      }
      
      console.log(`📋 Agent ${agentId} found ${pendingTasks.length} pending tasks`);
      
             // Check which tasks are due
       const now = new Date();
       const dueTasks = pendingTasks.filter((task: Task) => 
         task.scheduledTime && task.scheduledTime <= now
       );
       
       if (!dueTasks.length) {
         console.log(`⏰ Agent ${agentId} has no due tasks (${pendingTasks.length} pending but not yet due)`);
         return [];
       }
       
       console.log(`🚀 Agent ${agentId} executing ${dueTasks.length} due tasks:`, 
         dueTasks.map((t: Task) => ({ id: t.id, name: t.name, scheduledTime: t.scheduledTime })));
       
       // Execute each due task individually with detailed logging
       const results: TaskExecutionResult[] = [];
       for (const task of dueTasks) {
         try {
           console.log(`⏰ Agent ${agentId} executing task: ${task.id} (${task.name}) scheduled for ${task.scheduledTime}`);
           
           // Execute the task using the original method
           const result = await originalExecuteTaskNow(task.id);
           results.push(result);
           
           console.log(`✅ Agent ${agentId} task execution result:`, {
             taskId: task.id,
             successful: result.successful,
             status: result.status,
             duration: result.duration
           });
           
         } catch (error) {
           console.error(`❌ Agent ${agentId} failed to execute task ${task.id}:`, error);
           
           // Create a failed result
           const errorResult: TaskExecutionResult = {
             taskId: task.id,
             successful: false,
             status: TaskStatus.FAILED,
             startTime: new Date(),
             endTime: new Date(),
             duration: 0,
             error: error instanceof Error ? { message: error.message, code: 'TASK_EXECUTION_ERROR', stack: error.stack } : { message: String(error), code: 'TASK_EXECUTION_ERROR' },
             result: null,
             wasRetry: false,
             retryCount: 0
           };
           results.push(errorResult);
         }
       }
      
      console.log(`🏁 Agent ${agentId} completed execution of ${results.length} tasks - ${results.filter(r => r.successful).length} successful, ${results.filter(r => !r.successful).length} failed`);
      
      return results;
    },
    writable: true,
    configurable: true
  });
  
  console.log(`🎯 Agent-specific scheduler manager created for agent ${agentId} with enhanced logging and execution`);
  
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
  
  // Create agent registry for capacity-based strategy
  const agentRegistry = new RuntimeAgentRegistry();
  
  const explicitStrategy = new ExplicitTimeStrategy();
  const intervalStrategy = new IntervalStrategy();
  // Development-friendly PriorityBasedStrategy:
  // - Priority threshold 7 (so priority 7+ tasks execute immediately)
  // - Pending time 30 minutes (so lower priority tasks become due after 30 min)
  const priorityStrategy = new PriorityBasedStrategy(7, 30 * 60 * 1000);
  // Capacity-based strategy: Execute low-priority tasks when < 70% capacity used
  const capacityStrategy = new CapacityBasedStrategy(agentRegistry, 0.7, 7);
  
  const scheduler = new StrategyBasedTaskScheduler([
    explicitStrategy,
    intervalStrategy,
    priorityStrategy,
    capacityStrategy
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
      priorityStrategy,
      capacityStrategy
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