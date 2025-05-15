/**
 * AgentSchedulerManager.ts - Adapter implementation of SchedulerManager for agents
 * 
 * This file provides an adapter implementation that bridges between the
 * SchedulerManager interface and the agent's existing scheduling systems.
 */

import { v4 as uuidv4 } from 'uuid';
import { SchedulerManager, ScheduledTask, TaskSchedule } from '../../interfaces/scheduler';
import { AgentMemory } from '../../shared/memory/AgentMemory';

/**
 * Error class for scheduler-related errors
 */
class SchedulerError extends Error {
  code: string;
  context: Record<string, unknown>;

  constructor(message: string, code = 'SCHEDULER_ERROR', context: Record<string, unknown> = {}) {
    super(message);
    this.name = 'SchedulerError';
    this.code = code;
    this.context = context;
  }
}

/**
 * Adapter implementation of SchedulerManager for agents
 */
export class AgentSchedulerManager implements SchedulerManager {
  private initialized: boolean = false;
  private managerId: string;
  private agentMemory: AgentMemory | null = null;
  private tasks: Map<string, ScheduledTask> = new Map();

  constructor() {
    this.managerId = `agent-scheduler-manager-${uuidv4()}`;
  }

  async initialize(): Promise<void> {
    this.initialized = true;
  }

  async shutdown(): Promise<void> {
    this.initialized = false;
    this.tasks.clear();
  }

  async scheduleTask(task: Omit<ScheduledTask, "id" | "createdAt" | "updatedAt">): Promise<ScheduledTask> {
    if (!this.initialized) {
      throw new SchedulerError('Scheduler not initialized');
    }
    const taskId = uuidv4();
    const now = new Date();
    const scheduledTask: ScheduledTask = {
      ...task,
      id: taskId,
      createdAt: now,
      updatedAt: now,
      status: 'pending'
    };
    this.tasks.set(taskId, scheduledTask);
    return scheduledTask;
  }

  async getScheduledTasks(): Promise<ScheduledTask[]> {
    if (!this.initialized) {
      throw new SchedulerError('Scheduler not initialized');
    }
    return Array.from(this.tasks.values());
  }

  async cancelTask(taskId: string): Promise<boolean> {
    if (!this.initialized) {
      throw new SchedulerError('Scheduler not initialized');
    }
    return this.tasks.delete(taskId);
  }

  async updateTaskSchedule(taskId: string, schedule: TaskSchedule): Promise<boolean> {
    if (!this.initialized) {
      throw new SchedulerError('Scheduler not initialized');
    }
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }
    task.schedule = schedule;
    task.updatedAt = new Date();
    this.tasks.set(taskId, task);
    return true;
  }

  async getTaskStatus(taskId: string): Promise<'pending' | 'in_progress' | 'completed' | 'failed'> {
    if (!this.initialized) {
      throw new SchedulerError('Scheduler not initialized');
    }
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new SchedulerError('Task not found');
    }
    return task.status;
  }

  async pauseTask(taskId: string): Promise<boolean> {
    if (!this.initialized) {
      throw new SchedulerError('Scheduler not initialized');
    }
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }
    task.status = 'pending';
    task.updatedAt = new Date();
    this.tasks.set(taskId, task);
    return true;
  }

  async resumeTask(taskId: string): Promise<boolean> {
    if (!this.initialized) {
      throw new SchedulerError('Scheduler not initialized');
    }
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }
    task.status = 'in_progress';
    task.updatedAt = new Date();
    this.tasks.set(taskId, task);
    return true;
  }

  async getScheduledTask(taskId: string): Promise<ScheduledTask | null> {
    if (!this.initialized) {
      throw new SchedulerError('Scheduler not initialized');
    }
    return this.tasks.get(taskId) || null;
  }

  async updateScheduledTask(id: string, updates: Partial<ScheduledTask>): Promise<ScheduledTask> {
    if (!this.initialized) {
      throw new SchedulerError('Scheduler not initialized');
    }
    const task = this.tasks.get(id);
    if (!task) {
      throw new SchedulerError('Task not found');
    }
    const updatedTask = {
      ...task,
      ...updates,
      updatedAt: new Date()
    };
    this.tasks.set(id, updatedTask);
    return updatedTask;
  }

  async cancelScheduledTask(id: string): Promise<void> {
    if (!this.initialized) {
      throw new SchedulerError('Scheduler not initialized');
    }
    const task = this.tasks.get(id);
    if (!task) {
      throw new SchedulerError('Task not found');
    }
    task.status = 'failed';
    task.updatedAt = new Date();
    this.tasks.set(id, task);
  }

  async runScheduledTask(id: string): Promise<void> {
    if (!this.initialized) {
      throw new SchedulerError('Scheduler not initialized');
    }
    const task = this.tasks.get(id);
    if (!task) {
      throw new SchedulerError('Task not found');
    }
    task.status = 'in_progress';
    task.updatedAt = new Date();
    this.tasks.set(id, task);
  }
} 