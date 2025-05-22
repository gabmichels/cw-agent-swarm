/**
 * TaskDependency.model.ts
 * 
 * Defines the dependency model for tasks in the scheduler system.
 */

/**
 * TaskDependency represents a dependency relationship between tasks.
 * A task can depend on other tasks to be in specific states before it can be executed.
 */
export interface TaskDependency {
  /**
   * The ID of the task this depends on
   */
  taskId: string;
  
  /**
   * The status the dependent task must be in for this dependency to be satisfied
   */
  requiredStatus?: string;
  
  /**
   * Whether this dependency is blocking (i.e., task cannot run until dependency is satisfied)
   */
  blocking: boolean;
  
  /**
   * Optional metadata for the dependency
   */
  metadata?: Record<string, any>;
} 