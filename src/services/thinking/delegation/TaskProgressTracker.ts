import { EventEmitter } from 'events';
import { DelegatedTask, TaskStatus } from './DelegationManager';

/**
 * Milestone in task execution
 */
export interface TaskMilestone {
  /**
   * Unique ID for the milestone
   */
  id: string;
  
  /**
   * Description of the milestone
   */
  description: string;
  
  /**
   * Status of the milestone
   */
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  
  /**
   * Order of the milestone (lower = earlier)
   */
  order: number;
  
  /**
   * When the milestone was created
   */
  createdAt: Date;
  
  /**
   * When the milestone was started
   */
  startedAt?: Date;
  
  /**
   * When the milestone was completed
   */
  completedAt?: Date;
}

/**
 * Progress event in task execution
 */
export interface ProgressEvent {
  /**
   * Unique ID for the event
   */
  id: string;
  
  /**
   * Task ID this event belongs to
   */
  taskId: string;
  
  /**
   * Type of event
   */
  type: 'status_change' | 'milestone' | 'progress_update' | 'note' | 'error';
  
  /**
   * Description of the event
   */
  description: string;
  
  /**
   * When the event occurred
   */
  timestamp: Date;
  
  /**
   * Associated milestone ID (if any)
   */
  milestoneId?: string;
  
  /**
   * Event data
   */
  data?: Record<string, any>;
}

/**
 * TaskProgressTracker result for getTaskProgress
 */
export interface TaskProgressInfo {
  /**
   * Task ID
   */
  taskId: string;
  
  /**
   * Current status
   */
  status: TaskStatus;
  
  /**
   * Overall progress (0-1)
   */
  progress: number;
  
  /**
   * Current milestone
   */
  currentMilestone?: {
    id: string;
    description: string;
    status: string;
  };
  
  /**
   * All milestones
   */
  milestones: TaskMilestone[];
  
  /**
   * Recent events
   */
  recentEvents: ProgressEvent[];
  
  /**
   * Start time
   */
  startedAt?: Date;
  
  /**
   * Estimated completion time
   */
  estimatedCompletionTime?: Date;
  
  /**
   * Completion time (if done)
   */
  completedAt?: Date;
  
  /**
   * Agent ID executing the task
   */
  executingAgentId?: string;
  
  /**
   * Agent name
   */
  executingAgentName?: string;
}

interface TaskEvents {
  taskRegistered: (task: DelegatedTask) => void;
  taskStatusUpdated: (update: { taskId: string; status: TaskStatus }) => void;
}

/**
 * Service for tracking task progress and emitting progress events
 */
export class TaskProgressTracker extends EventEmitter {
  private tasks: Map<string, DelegatedTask>;
  
  constructor() {
    super();
    this.tasks = new Map();
  }
  
  /**
   * Register a new task to track
   */
  registerTask(task: DelegatedTask): void {
    this.tasks.set(task.id, task);
    this.emit('taskRegistered', task);
  }
  
  /**
   * Update task status
   */
  updateTaskStatus(taskId: string, status: TaskStatus): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = status;
      this.emit('taskStatusUpdated', { taskId, status });
    }
  }
  
  /**
   * Get task by ID
   */
  getTask(taskId: string): DelegatedTask | undefined {
    return this.tasks.get(taskId);
  }
  
  /**
   * Get all tracked tasks
   */
  getAllTasks(): DelegatedTask[] {
    return Array.from(this.tasks.values());
  }

  // Override EventEmitter methods with proper types
  declare emit: (event: string | symbol, ...args: any[]) => boolean;
  declare on: (event: string | symbol, listener: (...args: any[]) => void) => this;
  declare once: (event: string | symbol, listener: (...args: any[]) => void) => this;
  declare removeListener: (event: string | symbol, listener: (...args: any[]) => void) => this;
} 