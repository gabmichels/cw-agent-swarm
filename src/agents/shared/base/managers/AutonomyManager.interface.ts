import { IManager } from '../../../../lib/shared/types/agentTypes';
import { ScheduledTask } from '../../../../lib/shared/types/agentTypes';

/**
 * Interface for managing agent autonomy
 */
export interface AutonomyManager extends IManager {
  /**
   * Get all scheduled tasks
   */
  getScheduledTasks(): Promise<ScheduledTask[]>;

  /**
   * Add a new scheduled task
   */
  addScheduledTask(task: ScheduledTask): Promise<void>;

  /**
   * Remove a scheduled task
   */
  removeScheduledTask(taskId: string): Promise<void>;

  /**
   * Enable/disable a scheduled task
   */
  setTaskEnabled(taskId: string, enabled: boolean): Promise<void>;

  /**
   * Run a task immediately
   */
  runTaskNow(taskId: string): Promise<void>;

  /**
   * Get the current autonomy mode status
   */
  getAutonomyMode(): boolean;

  /**
   * Enable/disable autonomy mode
   */
  setAutonomyMode(enabled: boolean): void;
} 