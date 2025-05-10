/**
 * scheduler.ts - Core scheduler interfaces for agents
 * 
 * This file defines the core interfaces and types for the agent scheduler system.
 */

/**
 * Represents a scheduled task
 */
export interface ScheduledTask {
  id: string;
  name: string;
  description: string;
  schedule: TaskSchedule;
  priority: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Represents a task schedule
 */
export interface TaskSchedule {
  type: 'one-time' | 'daily' | 'weekly' | 'monthly';
  time: string; // ISO time string
  days?: string[]; // For weekly/monthly schedules
  timezone?: string;
}

/**
 * Configuration options for the scheduler manager
 */
export interface SchedulerManagerConfig {
  maxConcurrentTasks: number;
  defaultPriority: number;
  timezone: string;
}

/**
 * Core scheduler manager interface
 */
export interface SchedulerManager {
  /**
   * Initialize the scheduler manager
   */
  initialize(): Promise<void>;

  /**
   * Shutdown the scheduler manager
   */
  shutdown(): Promise<void>;

  /**
   * Schedule a new task
   */
  scheduleTask(task: Omit<ScheduledTask, 'id' | 'createdAt' | 'updatedAt'>): Promise<ScheduledTask>;

  /**
   * Get all scheduled tasks
   */
  getScheduledTasks(): Promise<ScheduledTask[]>;

  /**
   * Get a specific scheduled task
   */
  getScheduledTask(id: string): Promise<ScheduledTask | null>;

  /**
   * Update a scheduled task
   */
  updateScheduledTask(id: string, updates: Partial<ScheduledTask>): Promise<ScheduledTask>;

  /**
   * Cancel a scheduled task
   */
  cancelScheduledTask(id: string): Promise<void>;

  /**
   * Run a scheduled task immediately
   */
  runScheduledTask(id: string): Promise<void>;
} 