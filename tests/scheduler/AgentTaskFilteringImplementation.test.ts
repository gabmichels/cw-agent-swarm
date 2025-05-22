/**
 * AgentTaskFilteringImplementation.test.ts
 * Tests for the agent ID filtering implementation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createSchedulerManager } from '../../src/lib/scheduler/factories/SchedulerFactory';
import { ModularSchedulerManager } from '../../src/lib/scheduler/implementations/ModularSchedulerManager';
import { Task, TaskStatus, TaskScheduleType } from '../../src/lib/scheduler/models/Task.model';

describe('Agent ID Filtering Implementation', () => {
  let standardScheduler: ModularSchedulerManager;
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
    
    // Create standard scheduler
    standardScheduler = await createSchedulerManager({
      enabled: true,
      enableAutoScheduling: false,
      schedulingIntervalMs: 1000,
      maxConcurrentTasks: 5
    });
  });
  
  afterEach(async () => {
    await standardScheduler.reset();
  });
  
  it('should automatically add agent ID to tasks created through createTaskForAgent', async () => {
    // Create a task using createTaskForAgent
    const task: Task = {
      id: '',
      name: 'Agent 1 Task',
      description: 'Task that should only be executed by Agent 1',
      scheduleType: TaskScheduleType.EXPLICIT,
      handler: createTaskHandler('Agent 1 Task', 'agent-1'),
      status: TaskStatus.PENDING,
      priority: 5,
      scheduledTime: new Date(Date.now() - 1000), // Due in the past
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const createdTask = await standardScheduler.createTaskForAgent(task, 'agent-1');
    
    // Verify the agent ID was added to the task
    expect(createdTask.metadata).toBeDefined();
    expect(createdTask.metadata?.agentId).toBeDefined();
    expect((createdTask.metadata?.agentId as { id: string }).id).toBe('agent-1');
  });
  
  it('should find tasks for the specific agent using findTasksForAgent', async () => {
    // Create tasks for different agents
    const agent1Task: Task = {
      id: '',
      name: 'Agent 1 Task',
      description: 'Task for Agent 1',
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
      description: 'Task for Agent 2',
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
    
    // Add tasks directly to the standard scheduler
    await standardScheduler.createTask(agent1Task);
    await standardScheduler.createTask(agent2Task);
    
    // Find tasks using findTasksForAgent
    const agent1Tasks = await standardScheduler.findTasksForAgent('agent-1');
    const agent2Tasks = await standardScheduler.findTasksForAgent('agent-2');
    
    // Verify each agent only finds its own tasks
    expect(agent1Tasks.length).toBe(1);
    expect(agent1Tasks[0].name).toBe('Agent 1 Task');
    
    expect(agent2Tasks.length).toBe(1);
    expect(agent2Tasks[0].name).toBe('Agent 2 Task');
  });
  
  it('should execute tasks for the specific agent using executeDueTasksForAgent', async () => {
    // Create tasks for different agents
    const agent1Task: Task = {
      id: '',
      name: 'Agent 1 Task',
      description: 'Task for Agent 1',
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
      description: 'Task for Agent 2',
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
    
    // Add tasks directly to the standard scheduler
    await standardScheduler.createTask(agent1Task);
    await standardScheduler.createTask(agent2Task);
    
    // Execute tasks using executeDueTasksForAgent
    const agent1Results = await standardScheduler.executeDueTasksForAgent('agent-1');
    const agent2Results = await standardScheduler.executeDueTasksForAgent('agent-2');
    
    // Verify each agent only executed its own tasks
    expect(agent1Results.length).toBe(1);
    expect(executedTasks['agent-1'].length).toBe(1);
    expect(executedTasks['agent-1'][0]).toBe('Agent 1 Task');
    
    expect(agent2Results.length).toBe(1);
    expect(executedTasks['agent-2'].length).toBe(1);
    expect(executedTasks['agent-2'][0]).toBe('Agent 2 Task');
  });
}); 