/**
 * Interface for logging task-related events and information
 */
export interface TaskLogger {
  /**
   * Log a task event with status and optional details
   */
  logTask(task: string, status: string, details?: Record<string, unknown>): Promise<void>;

  /**
   * Log an error that occurred during task execution
   */
  logError(task: string, error: Error, context?: Record<string, unknown>): Promise<void>;

  /**
   * Log a warning or potential issue during task execution
   */
  logWarning(task: string, warning: string, context?: Record<string, unknown>): Promise<void>;

  /**
   * Log task progress or milestone
   */
  logProgress(task: string, progress: number, message?: string): Promise<void>;

  /**
   * Log task completion with results
   */
  logCompletion(task: string, results: Record<string, unknown>): Promise<void>;
} 