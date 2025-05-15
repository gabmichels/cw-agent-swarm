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
  ScheduledTask,
  TaskCreationOptions,
  TaskCreationResult,
  TaskExecutionResult,
  TaskStatus
} from './SchedulerManager.interface';
import { ManagerType } from './ManagerType';
import { BaseManager, AbstractBaseManager } from './BaseManager';
import { ManagerHealth } from './ManagerHealth';
import { AgentBase } from '../AgentBase.interface';

describe('SchedulerManager Interface', () => {
  // Mock implementation of the SchedulerManager interface for testing
  class MockSchedulerManager extends AbstractBaseManager implements SchedulerManager {
    private tasks: Map<string, ScheduledTask> = new Map();

    constructor() {
      super('mock-scheduler-manager', ManagerType.SCHEDULER, {} as AgentBase, { enabled: true });
    }

    async initialize(): Promise<boolean> {
      this._initialized = true;
      return true;
    }

    async shutdown(): Promise<void> {
      this._initialized = false;
    }

    async getHealth(): Promise<ManagerHealth> {
      return {
        status: 'healthy',
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
      const task: ScheduledTask = {
        id: 'task-123',
        title: options.title || 'Default Task',
        description: options.description || 'Default description',
        type: options.type || 'default',
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'pending',
        priority: options.priority || 0.5,
        retryAttempts: 0,
        dependencies: options.dependencies || [],
        metadata: options.metadata || {}
      };

      this.tasks.set(task.id, task);

      return {
        success: true,
        task
      };
    }

    async getTask(taskId: string): Promise<ScheduledTask | null> {
      return this.tasks.get(taskId) || null;
    }

    async getAllTasks(): Promise<ScheduledTask[]> {
      return Array.from(this.tasks.values());
    }

    async getActiveTasks(): Promise<ScheduledTask[]> {
      return Array.from(this.tasks.values()).filter(task => 
        task.status === 'running' || task.status === 'pending'
      );
    }

    async updateTask(taskId: string, updates: Partial<ScheduledTask>): Promise<ScheduledTask | null> {
      const task = this.tasks.get(taskId);
      if (!task) {
        return null;
      }

      const updatedTask: ScheduledTask = {
        ...task,
        ...updates,
        updatedAt: new Date()
      };

      this.tasks.set(taskId, updatedTask);
      return updatedTask;
    }

    async deleteTask(taskId: string): Promise<boolean> {
      return this.tasks.delete(taskId);
    }

    async executeTask(taskId: string): Promise<TaskExecutionResult> {
      const task = this.tasks.get(taskId);
      if (!task) {
        return {
          success: false,
          taskId,
          error: 'Task not found'
        };
      }

      task.status = 'completed';
      task.updatedAt = new Date();
      this.tasks.set(taskId, task);

      return {
        success: true,
        taskId,
        durationMs: 100
      };
    }

    async cancelTask(taskId: string): Promise<boolean> {
      const task = this.tasks.get(taskId);
      if (!task) {
        return false;
      }

      task.status = 'cancelled';
      task.updatedAt = new Date();
      this.tasks.set(taskId, task);
      return true;
    }

    async getDueTasks(): Promise<ScheduledTask[]> {
      return Array.from(this.tasks.values()).filter(task => 
        task.status === 'pending' || task.status === 'scheduled'
      );
    }

    async getRunningTasks(): Promise<ScheduledTask[]> {
      return Array.from(this.tasks.values()).filter(task => 
        task.status === 'running'
      );
    }

    async getPendingTasks(): Promise<ScheduledTask[]> {
      return Array.from(this.tasks.values()).filter(task => 
        task.status === 'pending'
      );
    }

    async getFailedTasks(): Promise<ScheduledTask[]> {
      return Array.from(this.tasks.values()).filter(task => 
        task.status === 'failed'
      );
    }

    async retryTask(taskId: string): Promise<TaskExecutionResult> {
      const task = this.tasks.get(taskId);
      if (!task) {
        return {
          success: false,
          taskId,
          error: 'Task not found'
        };
      }

      if (task.status !== 'failed') {
        return {
          success: false,
          taskId,
          error: 'Task is not in failed state'
        };
      }

      task.status = 'pending';
      task.retryAttempts++;
      task.updatedAt = new Date();
      this.tasks.set(taskId, task);

      return this.executeTask(taskId);
    }

    async getTasks(): Promise<ScheduledTask[]> {
      return Array.from(this.tasks.values());
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
      title: 'Test Task',
      description: 'Test description',
      type: 'test',
      priority: 0.8
    });

    expect(result.success).toBe(true);
    expect(result.task).toBeDefined();
    const taskId = result.task.id;
    expect(taskId).toBeDefined();

    const retrieved = await schedulerManager.getTask(taskId);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(taskId);
  });

  it('should execute tasks', async () => {
    const createResult = await schedulerManager.createTask({
      title: 'Test Task',
      description: 'Test description',
      type: 'test'
    });

    const taskId = createResult.task.id;
    const result = await schedulerManager.executeTask(taskId);
    expect(result.success).toBe(true);
    expect(result.taskId).toBe(taskId);
  });

  it('should cancel tasks', async () => {
    const createResult = await schedulerManager.createTask({
      title: 'Test Task',
      description: 'Test description',
      type: 'test'
    });

    const taskId = createResult.task.id;
    const cancelled = await schedulerManager.cancelTask(taskId);
    expect(cancelled).toBe(true);
  });

  it('should list active tasks', async () => {
    const tasks = await schedulerManager.getActiveTasks();
    expect(Array.isArray(tasks)).toBe(true);
  });
}); 