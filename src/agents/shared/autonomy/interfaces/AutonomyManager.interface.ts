/**
 * AutonomyManager.interface.ts
 * 
 * Defines the interface for the autonomy manager that enables self-directed
 * operation, scheduling, and proactive task management.
 */

import { BaseManager, ManagerConfig } from '../../base/managers/BaseManager';
import { AgentBase } from '../../base/AgentBase.interface';
import { AutonomySystem, AutonomySystemConfig, AutonomyStatus, AutonomyCapabilities, 
  AutonomyDiagnostics, TaskStatistics, AutonomousExecutionOptions, AutonomousExecutionResult 
} from './AutonomySystem.interface';
import { ScheduledTask } from '../../../../lib/shared/types/agentTypes';

/**
 * Configuration for the autonomy manager
 */
export interface AutonomyManagerConfig extends ManagerConfig {
  /** Core autonomy system configuration */
  autonomyConfig: AutonomySystemConfig;
  
  /** Additional configuration properties */
  [key: string]: unknown;
}

/**
 * The autonomy manager interface
 * 
 * This manager handles autonomous operation, scheduling, and proactive task management
 * for the agent.
 */
export interface AutonomyManager extends BaseManager {
  /**
   * Get the underlying autonomy system
   */
  getAutonomySystem(): AutonomySystem;
  
  /**
   * Get the current status of the autonomy system
   */
  getStatus(): AutonomyStatus;
  
  /**
   * Enable or disable autonomous mode
   * 
   * @param enabled Whether to enable autonomous mode
   * @returns Promise resolving to true if the mode was changed successfully
   */
  setAutonomyMode(enabled: boolean): Promise<boolean>;
  
  /**
   * Get the current autonomy mode
   * 
   * @returns True if autonomous mode is enabled
   */
  getAutonomyMode(): boolean;
  
  /**
   * Get the scheduled tasks managed by the autonomy system
   * 
   * @returns Array of scheduled tasks
   */
  getTasks(): Promise<ScheduledTask[]>;
  
  /**
   * Schedule a new task
   * 
   * @param task The task to schedule
   * @returns Promise resolving to true if the task was scheduled successfully
   */
  scheduleTask(task: ScheduledTask): Promise<boolean>;
  
  /**
   * Run a task immediately
   * 
   * @param taskId ID of the task to run
   * @returns Promise resolving to true if the task was executed successfully
   */
  runTask(taskId: string): Promise<boolean>;
  
  /**
   * Cancel a scheduled task
   * 
   * @param taskId ID of the task to cancel
   * @returns Promise resolving to true if the task was cancelled successfully
   */
  cancelTask(taskId: string): Promise<boolean>;
  
  /**
   * Enable or disable a task
   * 
   * @param taskId ID of the task to update
   * @param enabled Whether the task should be enabled
   * @returns Promise resolving to true if the task was updated successfully
   */
  setTaskEnabled(taskId: string, enabled: boolean): Promise<boolean>;
  
  /**
   * Run diagnostics on the autonomy system
   * 
   * @returns Diagnostic information about the system
   */
  diagnose(): Promise<AutonomyDiagnostics>;
  
  /**
   * Plan and execute a goal autonomously
   * 
   * @param options Options for autonomous execution
   * @returns Promise resolving to the result of the execution
   */
  planAndExecute(options: AutonomousExecutionOptions): Promise<AutonomousExecutionResult>;
  
  /**
   * Run daily autonomous tasks
   * 
   * @returns Promise resolving to true if tasks were executed successfully
   */
  runDailyTasks(): Promise<boolean>;
  
  /**
   * Run weekly reflection
   * 
   * @returns Promise resolving to true if reflection was executed successfully
   */
  runWeeklyReflection(): Promise<boolean>;
  
  /**
   * Get statistics about task usage
   * 
   * @returns Promise resolving to task statistics
   */
  getTaskStatistics(): Promise<TaskStatistics>;
  
  /**
   * Get the capabilities of the autonomy system
   * 
   * @returns Autonomy capabilities
   */
  getCapabilities(): AutonomyCapabilities;
  
  /**
   * Generate a task based on a goal
   * 
   * @param goal The goal to generate a task for
   * @param options Options for task generation
   * @returns Promise resolving to the generated task or null if generation failed
   */
  generateTask(goal: string, options?: {
    schedule?: string;
    priority?: number;
    category?: string;
    tags?: string[];
  }): Promise<ScheduledTask | null>;
} 