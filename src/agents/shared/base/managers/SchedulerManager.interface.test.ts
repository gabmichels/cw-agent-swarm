/**
 * SchedulerManager.interface.test.ts - Tests for the SchedulerManager interface
 * 
 * This file contains tests to ensure the SchedulerManager interface is properly defined
 * and extends the BaseManager interface correctly.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  SchedulerManager, 
  SchedulerManagerConfig,
  TaskCreationOptions,
  TaskCreationResult,
} from './SchedulerManager.interface';
import { Task, TaskStatus, TaskScheduleType } from '../../../../lib/scheduler/models/Task.model';
import { TaskExecutionResult } from '../../../../lib/scheduler/models/TaskExecutionResult.model';
import { TaskFilter } from '../../../../lib/scheduler/models/TaskFilter.model';
import { ManagerType } from './ManagerType';
import { BaseManager, AbstractBaseManager } from './BaseManager';
import { ManagerHealth } from './ManagerHealth';
import { AgentBase } from '../AgentBase.interface';
import { TaskDependency } from '../../../../lib/scheduler/models/TaskDependency.model';

describe('SchedulerManager Interface', () => {
  // Mock implementation of the SchedulerManager interface for testing
  class MockSchedulerManager extends AbstractBaseManager implements SchedulerManager {
    private tasks: Map<string, Task> = new Map();

    constructor() {
      super(
        'mock-scheduler-manager',
        ManagerType.SCHEDULER, 
        {} as AgentBase, 
        { enabled: true }
      );
    }

    async initialize(): Promise<boolean> {
      return true;
    }

    async shutdown(): Promise<void> {
      // No-op
    }

    async getHealth(): Promise<ManagerHealth> {
      return {
        status: 'healthy',
        message: 'Scheduler manager is healthy',
        details: {
          lastCheck: new Date(),
          issues: [],
          metrics: {
            activeTasks: 0,
            completedTasks: 0,
            failedTasks: 0
          }
        }
      };
    }

    async createTask(options: TaskCreationOptions): Promise<TaskCreationResult> {
      const now = new Date();
      const taskId = `task-${now.getTime()}`;
      
      const task: Task = {
        id: taskId,
        name: options.name,
        description: options.description || '',
        scheduleType: options.scheduleType,
        status: TaskStatus.PENDING,
        createdAt: now,
        updatedAt: now,
        priority: options.priority || 0.5,
        handler: options.handler || (async () => undefined),
        scheduledTime: options.scheduledTime,
        metadata: options.metadata || {},
        interval: options.interval,
        dependencies: []
      };
      
      this.tasks.set(taskId, task);
      
      return {
        success: true,
        task
      };
    }

    async createTaskForAgent(options: TaskCreationOptions, agentId: string): Promise<TaskCreationResult> {
      const metadata = options.metadata || {};
      return this.createTask({
        ...options,
        metadata: {
          ...metadata,
          agentId: {
            namespace: 'agent',
            type: 'agent',
            id: agentId
          }
        }
      });
    }

    async getTask(taskId: string): Promise<Task | null> {
      return this.tasks.get(taskId) || null;
    }

    async findTasks(filter?: TaskFilter): Promise<Task[]> {
      // Simple implementation that doesn't actually filter
      return Array.from(this.tasks.values());
    }

    async findTasksForAgent(agentId: string, filter?: TaskFilter): Promise<Task[]> {
      // Return tasks for the specified agent
      return Array.from(this.tasks.values()).filter(task => {
        // Check if agentId exists in metadata
        if (task.metadata && 
            typeof task.metadata === 'object' && 
            task.metadata.agentId && 
            typeof task.metadata.agentId === 'object' &&
            'id' in task.metadata.agentId) {
          return task.metadata.agentId.id === agentId;
        }
        return false;
      });
    }

    async getActiveTasks(): Promise<Task[]> {
      return Array.from(this.tasks.values()).filter(
        (task) => task.status === TaskStatus.PENDING || task.status === TaskStatus.RUNNING
      );
    }

    async updateTask(task: Task): Promise<Task | null> {
      if (!this.tasks.has(task.id)) {
        return null;
      }
      
      task.updatedAt = new Date();
      this.tasks.set(task.id, task);
      return task;
    }

    async deleteTask(taskId: string): Promise<boolean> {
      return this.tasks.delete(taskId);
    }

    async executeTask(taskId: string): Promise<TaskExecutionResult> {
      return this.executeTaskNow(taskId);
    }

    async executeTaskNow(taskId: string): Promise<TaskExecutionResult> {
      const task = this.tasks.get(taskId);
      if (!task) {
        return {
          successful: false,
          taskId,
          status: TaskStatus.FAILED,
          startTime: new Date(),
          endTime: new Date(),
          duration: 0,
          error: {
            message: 'Task not found'
          },
          wasRetry: false,
          retryCount: 0
        };
      }

      task.status = TaskStatus.COMPLETED;
      task.updatedAt = new Date();
      this.tasks.set(taskId, task);

      return {
        successful: true,
        taskId,
        status: TaskStatus.COMPLETED,
        startTime: new Date(),
        endTime: new Date(),
        duration: 100,
        result: true,
        wasRetry: false,
        retryCount: 0
      };
    }

    async executeDueTasksForAgent(agentId: string): Promise<TaskExecutionResult[]> {
      const tasks = await this.findTasksForAgent(agentId);
      const dueTasks = tasks.filter(task => 
        task.status === TaskStatus.PENDING && 
        task.scheduledTime && 
        task.scheduledTime <= new Date()
      );
      
      const results: TaskExecutionResult[] = [];
      for (const task of dueTasks) {
        results.push(await this.executeTaskNow(task.id));
      }
      
      return results;
    }

    async cancelTask(taskId: string): Promise<boolean> {
      const task = this.tasks.get(taskId);
      if (!task) {
        return false;
      }
      
      task.status = TaskStatus.CANCELLED;
      task.updatedAt = new Date();
      this.tasks.set(taskId, task);
      return true;
    }

    async getDueTasks(): Promise<Task[]> {
      return Array.from(this.tasks.values()).filter(task => 
        task.status === TaskStatus.PENDING && task.scheduledTime && task.scheduledTime <= new Date()
      );
    }

    async getRunningTasks(): Promise<Task[]> {
      return Array.from(this.tasks.values()).filter(task => 
        task.status === TaskStatus.RUNNING
      );
    }

    async getPendingTasks(): Promise<Task[]> {
      return Array.from(this.tasks.values()).filter(task => 
        task.status === TaskStatus.PENDING
      );
    }

    async getFailedTasks(): Promise<Task[]> {
      return Array.from(this.tasks.values()).filter(task => 
        task.status === TaskStatus.FAILED
      );
    }

    async retryTask(taskId: string): Promise<TaskExecutionResult> {
      return this.retryTaskNow(taskId);
    }

    async retryTaskNow(taskId: string): Promise<TaskExecutionResult> {
      const task = this.tasks.get(taskId);
      if (!task) {
        return {
          successful: false,
          taskId,
          status: TaskStatus.FAILED,
          startTime: new Date(),
          endTime: new Date(),
          duration: 0,
          error: {
            message: 'Task not found'
          },
          wasRetry: false,
          retryCount: 0
        };
      }

      if (task.status !== TaskStatus.FAILED) {
        return {
          successful: false,
          taskId,
          status: TaskStatus.FAILED,
          startTime: new Date(),
          endTime: new Date(),
          duration: 0,
          error: {
            message: 'Task is not in failed state'
          },
          wasRetry: false,
          retryCount: 0
        };
      }

      task.status = TaskStatus.PENDING;
      task.updatedAt = new Date();
      this.tasks.set(taskId, task);

      return this.executeTaskNow(taskId);
    }

    async getTasks(): Promise<Task[]> {
      return Array.from(this.tasks.values());
    }

    async getMetrics(): Promise<any> {
      return {
        totalTasks: this.tasks.size,
        pendingTasks: this.tasks.size,
        runningTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        cancelledTasks: 0
      };
    }

    async reset(): Promise<boolean> {
      this.tasks.clear();
      return true;
    }
  }

  let schedulerManager: SchedulerManager;

  beforeEach(() => {
    schedulerManager = new MockSchedulerManager();
  });

  it('should implement BaseManager interface', () => {
    // Type check that SchedulerManager extends BaseManager
    const manager: BaseManager = schedulerManager;
    expect(manager).toBeDefined();
  });

  it('should have the correct manager type', () => {
    expect(schedulerManager.managerType).toBe(ManagerType.SCHEDULER);
  });

  it('should initialize successfully', async () => {
    const result = await schedulerManager.initialize();
    expect(result).toBe(true);
  });

  it('should get health status', async () => {
    const health = await schedulerManager.getHealth();
    expect(health.status).toBe('healthy');
    expect(health.details.issues).toHaveLength(0);
  });

  it('should create and retrieve tasks', async () => {
    const result = await schedulerManager.createTask({
      name: 'Test Task',
      description: 'Test description',
      scheduleType: TaskScheduleType.EXPLICIT,
      priority: 0.8,
      handler: async () => true
    });

    expect(result.success).toBe(true);
    expect(result.task).toBeDefined();
    const taskId = result.task.id;
    expect(taskId).toBeDefined();

    const retrieved = await schedulerManager.getTask(taskId);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(taskId);
  });

  it('should execute tasks successfully', async () => {
    const result = await schedulerManager.createTask({
      name: 'Test Task',
      description: 'Test description',
      scheduleType: TaskScheduleType.EXPLICIT,
      priority: 0.8,
      handler: async () => true
    });

    const taskId = result.task.id;
    const executeResult = await schedulerManager.executeTask(taskId);
    expect(executeResult.successful).toBe(true);
  });

  it('should update tasks', async () => {
    const result = await schedulerManager.createTask({
      name: 'Test Task',
      description: 'Test description',
      scheduleType: TaskScheduleType.EXPLICIT,
      priority: 0.8,
      handler: async () => true
    });

    const task = result.task;
    const updatedTask = {
      ...task,
      description: 'Updated description'
    };

    const updateResult = await schedulerManager.updateTask(updatedTask);
    expect(updateResult).not.toBeNull();
    expect(updateResult?.description).toBe('Updated description');
  });
}); 