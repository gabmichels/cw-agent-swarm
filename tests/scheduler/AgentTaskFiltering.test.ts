/**
 * AgentTaskFiltering.test.ts
 * Tests to demonstrate agent ID filtering for tasks
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createSchedulerManager } from '../../src/lib/scheduler/factories/SchedulerFactory';
import { ModularSchedulerManager } from '../../src/lib/scheduler/implementations/ModularSchedulerManager';
import { Task, TaskStatus, TaskScheduleType } from '../../src/lib/scheduler/models/Task.model';

describe('Agent Task Filtering', () => {
  let scheduler: ModularSchedulerManager;
  const executedTasks: Record<string, string[]> = {
    'agent-1': [],
    'agent-2': []
  };
  
  // Create a task handler that tracks execution by agent
  const createTaskHandler = (taskName: string, agentId: string) => {
    return async () => {
      console.log(`Executing task: ${taskName} for agent: ${agentId}`);
      executedTasks[agentId].push(taskName);
      return { success: true, result: `Executed ${taskName} for ${agentId}` };
    };
  };
  
  beforeEach(async () => {
    // Reset executed tasks
    executedTasks['agent-1'] = [];
    executedTasks['agent-2'] = [];
    
    // Create scheduler
    scheduler = await createSchedulerManager({
      enabled: true,
      enableAutoScheduling: false,
      schedulingIntervalMs: 1000,
      maxConcurrentTasks: 5
    });
  });
  
  afterEach(async () => {
    await scheduler.reset();
  });
  
  it('should demonstrate the current lack of agent filtering', async () => {
    // Create tasks for different agents
    const agent1Task: Task = {
      id: '',
      name: 'Agent 1 Task',
      description: 'Task that should only be executed by Agent 1',
      scheduleType: TaskScheduleType.EXPLICIT,
      handler: createTaskHandler('Agent 1 Task', 'agent-1'),
      status: TaskStatus.PENDING,
      priority: 5,
      scheduledTime: new Date(Date.now() - 1000), // Due in the past
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        agentId: {
          namespace: 'agent',
          type: 'agent',
          id: 'agent-1' // This should be used for filtering
        }
      }
    };
    
    const agent2Task: Task = {
      id: '',
      name: 'Agent 2 Task',
      description: 'Task that should only be executed by Agent 2',
      scheduleType: TaskScheduleType.EXPLICIT,
      handler: createTaskHandler('Agent 2 Task', 'agent-2'),
      status: TaskStatus.PENDING,
      priority: 5,
      scheduledTime: new Date(Date.now() - 1000), // Due in the past
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        agentId: {
          namespace: 'agent',
          type: 'agent',
          id: 'agent-2' // This should be used for filtering
        }
      }
    };
    
    // Add tasks to scheduler
    await scheduler.createTask(agent1Task);
    await scheduler.createTask(agent2Task);
    
    // Execute all due tasks without filtering
    const results = await scheduler.executeDueTasks();
    
    // Currently, both tasks will be executed regardless of agent ID
    expect(results.length).toBe(2);
    
    // This shows the issue - both tasks are executed without agent filtering
    expect(executedTasks['agent-1'].length + executedTasks['agent-2'].length).toBe(2);
  });
  
  it('should demonstrate how agent filtering should work', async () => {
    // Create tasks for different agents
    const agent1Task: Task = {
      id: '',
      name: 'Agent 1 Task',
      description: 'Task that should only be executed by Agent 1',
      scheduleType: TaskScheduleType.EXPLICIT,
      handler: createTaskHandler('Agent 1 Task', 'agent-1'),
      status: TaskStatus.PENDING,
      priority: 5,
      scheduledTime: new Date(Date.now() - 1000), // Due in the past
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        agentId: {
          namespace: 'agent',
          type: 'agent',
          id: 'agent-1'
        }
      }
    };
    
    const agent2Task: Task = {
      id: '',
      name: 'Agent 2 Task',
      description: 'Task that should only be executed by Agent 2',
      scheduleType: TaskScheduleType.EXPLICIT,
      handler: createTaskHandler('Agent 2 Task', 'agent-2'),
      status: TaskStatus.PENDING,
      priority: 5,
      scheduledTime: new Date(Date.now() - 1000), // Due in the past
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        agentId: {
          namespace: 'agent',
          type: 'agent',
          id: 'agent-2'
        }
      }
    };
    
    // Add tasks to scheduler
    await scheduler.createTask(agent1Task);
    await scheduler.createTask(agent2Task);
    
    // PROPOSED SOLUTION: Filter tasks by agent ID before execution
    
    // Get all pending tasks
    const allPendingTasks = await scheduler.findTasks({ status: TaskStatus.PENDING });
    
    // Filter tasks for Agent 1
    const agent1Tasks = allPendingTasks.filter(task => 
      task.metadata?.agentId && (task.metadata.agentId as { id: string }).id === 'agent-1'
    );
    
    // Execute only Agent 1's tasks
    for (const task of agent1Tasks) {
      await scheduler.executeTaskNow(task.id);
    }
    
    // Verify only Agent 1's tasks were executed
    expect(executedTasks['agent-1'].length).toBe(1);
    expect(executedTasks['agent-2'].length).toBe(0);
    
    // Filter tasks for Agent 2
    const agent2Tasks = allPendingTasks.filter(task => 
      task.metadata?.agentId && (task.metadata.agentId as { id: string }).id === 'agent-2'
    );
    
    // Execute only Agent 2's tasks
    for (const task of agent2Tasks) {
      await scheduler.executeTaskNow(task.id);
    }
    
    // Verify Agent 2's tasks were executed
    expect(executedTasks['agent-2'].length).toBe(1);
  });
  
  it('should propose an extension to the TaskFilter interface', async () => {
    // This test demonstrates how the TaskFilter interface should be extended
    
    // Create tasks for different agents
    const agent1Task: Task = {
      id: '',
      name: 'Agent 1 Task',
      description: 'Task that should only be executed by Agent 1',
      scheduleType: TaskScheduleType.EXPLICIT,
      handler: createTaskHandler('Agent 1 Task', 'agent-1'),
      status: TaskStatus.PENDING,
      priority: 5,
      scheduledTime: new Date(Date.now() - 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        agentId: {
          namespace: 'agent',
          type: 'agent',
          id: 'agent-1'
        }
      }
    };
    
    const agent2Task: Task = {
      id: '',
      name: 'Agent 2 Task',
      description: 'Task that should only be executed by Agent 2',
      scheduleType: TaskScheduleType.EXPLICIT,
      handler: createTaskHandler('Agent 2 Task', 'agent-2'),
      status: TaskStatus.PENDING,
      priority: 5,
      scheduledTime: new Date(Date.now() - 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        agentId: {
          namespace: 'agent',
          type: 'agent',
          id: 'agent-2'
        }
      }
    };
    
    // Add tasks to scheduler
    await scheduler.createTask(agent1Task);
    await scheduler.createTask(agent2Task);
    
    // PROPOSED SOLUTION: Extend TaskFilter to support metadata filtering
    
    // This is how the interface extension would look:
    /*
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
    */
    
    // This is how the findTasks method would be implemented:
    /*
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
    */
    
    // For now, we'll simulate this behavior:
    const mockFindTasksForAgent = async (agentId: string) => {
      const allTasks = await scheduler.findTasks({});
      return allTasks.filter(task => 
        task.metadata?.agentId && (task.metadata.agentId as { id: string }).id === agentId
      );
    };
    
    // Test the mock implementation
    const agent1Tasks = await mockFindTasksForAgent('agent-1');
    expect(agent1Tasks.length).toBe(1);
    expect(agent1Tasks[0].name).toBe('Agent 1 Task');
    
    const agent2Tasks = await mockFindTasksForAgent('agent-2');
    expect(agent2Tasks.length).toBe(1);
    expect(agent2Tasks[0].name).toBe('Agent 2 Task');
  });
}); 