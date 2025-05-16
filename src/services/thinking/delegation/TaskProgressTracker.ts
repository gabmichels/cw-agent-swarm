import { IdGenerator } from '@/utils/ulid';
import { DelegationTask } from './DelegationManager';

/**
 * Progress status for a task
 */
export type TaskStatus = 
  | 'pending'
  | 'queued' 
  | 'in_progress' 
  | 'completed' 
  | 'failed' 
  | 'cancelled';

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

/**
 * Service for tracking live progress of delegated tasks
 */
export class TaskProgressTracker {
  /**
   * Map of task ID to status
   */
  private taskStatus: Map<string, TaskStatus> = new Map();
  
  /**
   * Map of task ID to overall progress (0-1)
   */
  private taskProgress: Map<string, number> = new Map();
  
  /**
   * Map of task ID to task milestones
   */
  private taskMilestones: Map<string, TaskMilestone[]> = new Map();
  
  /**
   * Map of task ID to progress events
   */
  private progressEvents: Map<string, ProgressEvent[]> = new Map();
  
  /**
   * Map of task ID to task metadata
   */
  private taskMetadata: Map<string, {
    delegationTask: DelegationTask;
    startedAt?: Date;
    completedAt?: Date;
    currentMilestoneId?: string;
    executingAgentId?: string;
    executingAgentName?: string;
  }> = new Map();
  
  /**
   * Register a task for tracking
   * @param task Task to track
   * @returns Whether registration was successful
   */
  registerTask(task: DelegationTask): boolean {
    try {
      // Store task metadata
      this.taskMetadata.set(task.id, {
        delegationTask: task
      });
      
      // Set initial status
      this.taskStatus.set(task.id, 'pending');
      
      // Set initial progress
      this.taskProgress.set(task.id, 0);
      
      // Initialize empty milestones list
      this.taskMilestones.set(task.id, []);
      
      // Initialize empty events list
      this.progressEvents.set(task.id, []);
      
      console.log(`Registered task ${task.id} for progress tracking`);
      
      return true;
    } catch (error) {
      console.error(`Error registering task ${task.id} for tracking:`, error);
      return false;
    }
  }
  
  /**
   * Update task status
   * @param taskId Task ID
   * @param status New status
   * @param metadata Optional metadata about the status change
   * @returns Whether update was successful
   */
  updateTaskStatus(
    taskId: string,
    status: TaskStatus,
    metadata?: Record<string, any>
  ): boolean {
    try {
      // Check if task exists
      if (!this.taskMetadata.has(taskId)) {
        console.error(`Task ${taskId} not found for status update`);
        return false;
      }
      
      // Update status
      this.taskStatus.set(taskId, status);
      
      // Update metadata based on status
      const taskMeta = this.taskMetadata.get(taskId)!;
      
      if (status === 'in_progress' && !taskMeta.startedAt) {
        taskMeta.startedAt = new Date();
      } else if ((status === 'completed' || status === 'failed') && !taskMeta.completedAt) {
        taskMeta.completedAt = new Date();
      }
      
      // Add status change event
      this.addProgressEvent(taskId, {
        type: 'status_change',
        description: `Task status changed to: ${status}`,
        data: {
          oldStatus: this.taskStatus.get(taskId),
          newStatus: status,
          ...metadata
        }
      });
      
      // If task is complete or failed, set progress accordingly
      if (status === 'completed') {
        this.taskProgress.set(taskId, 1);
      } else if (status === 'failed') {
        // Keep current progress, but add the failure event
      }
      
      console.log(`Updated task ${taskId} status to ${status}`);
      
      return true;
    } catch (error) {
      console.error(`Error updating task ${taskId} status:`, error);
      return false;
    }
  }
  
  /**
   * Update task progress
   * @param taskId Task ID
   * @param progress Progress value (0-1)
   * @param description Description of the progress update
   * @returns Whether update was successful
   */
  updateTaskProgress(
    taskId: string,
    progress: number,
    description?: string
  ): boolean {
    try {
      // Check if task exists
      if (!this.taskMetadata.has(taskId)) {
        console.error(`Task ${taskId} not found for progress update`);
        return false;
      }
      
      // Validate progress value
      const validProgress = Math.max(0, Math.min(1, progress));
      
      // Update progress
      this.taskProgress.set(taskId, validProgress);
      
      // Add progress update event
      this.addProgressEvent(taskId, {
        type: 'progress_update',
        description: description || `Progress updated to ${Math.round(validProgress * 100)}%`,
        data: {
          progress: validProgress
        }
      });
      
      console.log(`Updated task ${taskId} progress to ${validProgress}`);
      
      return true;
    } catch (error) {
      console.error(`Error updating task ${taskId} progress:`, error);
      return false;
    }
  }
  
  /**
   * Add a milestone to a task
   * @param taskId Task ID
   * @param description Milestone description
   * @param order Milestone order (lower = earlier)
   * @returns Milestone ID if successful, null otherwise
   */
  addTaskMilestone(
    taskId: string,
    description: string,
    order: number
  ): string | null {
    try {
      // Check if task exists
      if (!this.taskMetadata.has(taskId)) {
        console.error(`Task ${taskId} not found for adding milestone`);
        return null;
      }
      
      // Create milestone
      const milestoneId = IdGenerator.generate('milestone').toString();
      const milestone: TaskMilestone = {
        id: milestoneId,
        description,
        status: 'pending',
        order,
        createdAt: new Date()
      };
      
      // Add to milestones
      const milestones = this.taskMilestones.get(taskId) || [];
      milestones.push(milestone);
      
      // Sort by order
      milestones.sort((a, b) => a.order - b.order);
      
      // Update milestones
      this.taskMilestones.set(taskId, milestones);
      
      // Add milestone event
      this.addProgressEvent(taskId, {
        type: 'milestone',
        description: `Added milestone: ${description}`,
        milestoneId,
        data: {
          action: 'added',
          order
        }
      });
      
      console.log(`Added milestone ${milestoneId} to task ${taskId}`);
      
      return milestoneId;
    } catch (error) {
      console.error(`Error adding milestone to task ${taskId}:`, error);
      return null;
    }
  }
  
  /**
   * Update milestone status
   * @param taskId Task ID
   * @param milestoneId Milestone ID
   * @param status New status
   * @returns Whether update was successful
   */
  updateMilestoneStatus(
    taskId: string,
    milestoneId: string,
    status: 'pending' | 'in_progress' | 'completed' | 'failed'
  ): boolean {
    try {
      // Check if task exists
      if (!this.taskMetadata.has(taskId)) {
        console.error(`Task ${taskId} not found for milestone update`);
        return false;
      }
      
      // Get milestones
      const milestones = this.taskMilestones.get(taskId) || [];
      
      // Find milestone
      const milestoneIndex = milestones.findIndex(m => m.id === milestoneId);
      
      if (milestoneIndex === -1) {
        console.error(`Milestone ${milestoneId} not found for task ${taskId}`);
        return false;
      }
      
      // Get milestone
      const milestone = milestones[milestoneIndex];
      
      // Update status
      milestone.status = status;
      
      // Update timestamps
      if (status === 'in_progress' && !milestone.startedAt) {
        milestone.startedAt = new Date();
        
        // Update current milestone in metadata
        const taskMeta = this.taskMetadata.get(taskId)!;
        taskMeta.currentMilestoneId = milestoneId;
      } else if (status === 'completed' && !milestone.completedAt) {
        milestone.completedAt = new Date();
        
        // Move to next milestone if this was the current one
        const taskMeta = this.taskMetadata.get(taskId)!;
        if (taskMeta.currentMilestoneId === milestoneId) {
          // Find next pending milestone
          const nextMilestone = milestones.find(
            m => m.order > milestone.order && m.status === 'pending'
          );
          
          if (nextMilestone) {
            taskMeta.currentMilestoneId = nextMilestone.id;
          } else {
            taskMeta.currentMilestoneId = undefined;
          }
        }
        
        // Update task progress based on milestone completion
        this.updateProgressFromMilestones(taskId);
      }
      
      // Update milestones
      milestones[milestoneIndex] = milestone;
      this.taskMilestones.set(taskId, milestones);
      
      // Add milestone event
      this.addProgressEvent(taskId, {
        type: 'milestone',
        description: `Milestone "${milestone.description}" changed to: ${status}`,
        milestoneId,
        data: {
          action: 'status_updated',
          status
        }
      });
      
      console.log(`Updated milestone ${milestoneId} status to ${status}`);
      
      return true;
    } catch (error) {
      console.error(`Error updating milestone ${milestoneId} status:`, error);
      return false;
    }
  }
  
  /**
   * Update task progress based on milestone completion
   * @param taskId Task ID
   */
  private updateProgressFromMilestones(taskId: string): void {
    try {
      // Get milestones
      const milestones = this.taskMilestones.get(taskId) || [];
      
      if (milestones.length === 0) {
        return;
      }
      
      // Count completed milestones
      const completedCount = milestones.filter(m => m.status === 'completed').length;
      
      // Calculate progress
      const progress = completedCount / milestones.length;
      
      // Update progress
      this.taskProgress.set(taskId, progress);
      
      console.log(`Calculated progress for task ${taskId}: ${progress}`);
    } catch (error) {
      console.error(`Error updating progress from milestones for task ${taskId}:`, error);
    }
  }
  
  /**
   * Add a progress event
   * @param taskId Task ID
   * @param event Event to add (ID and timestamp will be generated)
   * @returns Event ID
   */
  addProgressEvent(
    taskId: string,
    event: Omit<ProgressEvent, 'id' | 'taskId' | 'timestamp'>
  ): string {
    try {
      // Check if task exists
      if (!this.taskMetadata.has(taskId)) {
        throw new Error(`Task ${taskId} not found for adding event`);
      }
      
      // Create event
      const eventId = IdGenerator.generate('event').toString();
      const progressEvent: ProgressEvent = {
        ...event,
        id: eventId,
        taskId,
        timestamp: new Date()
      };
      
      // Add to events
      const events = this.progressEvents.get(taskId) || [];
      events.push(progressEvent);
      
      // Limit number of events (keep most recent 100)
      if (events.length > 100) {
        events.shift();
      }
      
      // Update events
      this.progressEvents.set(taskId, events);
      
      return eventId;
    } catch (error) {
      console.error(`Error adding event to task ${taskId}:`, error);
      const fallbackId = IdGenerator.generate('event').toString();
      
      // Try to record the error
      try {
        const errorEvent: ProgressEvent = {
          id: fallbackId,
          taskId,
          type: 'error',
          description: `Error adding event: ${error instanceof Error ? error.message : String(error)}`,
          timestamp: new Date(),
          data: {
            originalEventType: event.type,
            originalDescription: event.description
          }
        };
        
        const events = this.progressEvents.get(taskId) || [];
        events.push(errorEvent);
        this.progressEvents.set(taskId, events);
      } catch {
        // Just silently fail if we can't even record the error
      }
      
      return fallbackId;
    }
  }
  
  /**
   * Set executing agent for a task
   * @param taskId Task ID
   * @param agentId Agent ID
   * @param agentName Agent name
   * @returns Whether update was successful
   */
  setExecutingAgent(
    taskId: string,
    agentId: string,
    agentName: string
  ): boolean {
    try {
      // Check if task exists
      if (!this.taskMetadata.has(taskId)) {
        console.error(`Task ${taskId} not found for setting executing agent`);
        return false;
      }
      
      // Update metadata
      const taskMeta = this.taskMetadata.get(taskId)!;
      taskMeta.executingAgentId = agentId;
      taskMeta.executingAgentName = agentName;
      
      // Add event
      this.addProgressEvent(taskId, {
        type: 'status_change',
        description: `Task assigned to agent: ${agentName}`,
        data: {
          agentId,
          agentName
        }
      });
      
      console.log(`Set executing agent for task ${taskId} to ${agentName} (${agentId})`);
      
      return true;
    } catch (error) {
      console.error(`Error setting executing agent for task ${taskId}:`, error);
      return false;
    }
  }
  
  /**
   * Add an error event
   * @param taskId Task ID
   * @param errorMessage Error message
   * @param details Error details
   * @returns Event ID
   */
  addErrorEvent(
    taskId: string,
    errorMessage: string,
    details?: Record<string, any>
  ): string {
    return this.addProgressEvent(taskId, {
      type: 'error',
      description: errorMessage,
      data: details
    });
  }
  
  /**
   * Add a note event
   * @param taskId Task ID
   * @param note Note text
   * @param details Note details
   * @returns Event ID
   */
  addNoteEvent(
    taskId: string,
    note: string,
    details?: Record<string, any>
  ): string {
    return this.addProgressEvent(taskId, {
      type: 'note',
      description: note,
      data: details
    });
  }
  
  /**
   * Get task progress information
   * @param taskId Task ID
   * @returns Progress information or null if task not found
   */
  getTaskProgress(taskId: string): TaskProgressInfo | null {
    try {
      // Check if task exists
      if (!this.taskMetadata.has(taskId)) {
        console.error(`Task ${taskId} not found for getting progress`);
        return null;
      }
      
      // Get task metadata
      const taskMeta = this.taskMetadata.get(taskId)!;
      
      // Get milestones
      const milestones = this.taskMilestones.get(taskId) || [];
      
      // Get current milestone
      let currentMilestone: { id: string; description: string; status: string } | undefined;
      
      if (taskMeta.currentMilestoneId) {
        const milestone = milestones.find(m => m.id === taskMeta.currentMilestoneId);
        
        if (milestone) {
          currentMilestone = {
            id: milestone.id,
            description: milestone.description,
            status: milestone.status
          };
        }
      }
      
      // Get recent events (most recent 20)
      const events = (this.progressEvents.get(taskId) || [])
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 20);
      
      // Calculate estimated completion time
      let estimatedCompletionTime: Date | undefined;
      
      if (
        taskMeta.startedAt &&
        this.taskProgress.get(taskId)! > 0 &&
        this.taskProgress.get(taskId)! < 1 &&
        this.taskStatus.get(taskId) === 'in_progress'
      ) {
        const elapsedTime = Date.now() - taskMeta.startedAt.getTime();
        const progress = this.taskProgress.get(taskId)!;
        const estimatedTotalTime = elapsedTime / progress;
        const remainingTime = estimatedTotalTime - elapsedTime;
        
        estimatedCompletionTime = new Date(Date.now() + remainingTime);
      }
      
      // Build progress info
      const progressInfo: TaskProgressInfo = {
        taskId,
        status: this.taskStatus.get(taskId) || 'pending',
        progress: this.taskProgress.get(taskId) || 0,
        currentMilestone,
        milestones,
        recentEvents: events,
        startedAt: taskMeta.startedAt,
        estimatedCompletionTime,
        completedAt: taskMeta.completedAt,
        executingAgentId: taskMeta.executingAgentId,
        executingAgentName: taskMeta.executingAgentName
      };
      
      return progressInfo;
    } catch (error) {
      console.error(`Error getting progress for task ${taskId}:`, error);
      return null;
    }
  }
  
  /**
   * Get all tracked tasks
   * @returns List of task IDs
   */
  getAllTrackedTasks(): string[] {
    return Array.from(this.taskMetadata.keys());
  }
  
  /**
   * Get all tasks with a specific status
   * @param status Status to filter by
   * @returns List of task IDs
   */
  getTasksByStatus(status: TaskStatus): string[] {
    const result: string[] = [];
    
    for (const [taskId, taskStatus] of Array.from(this.taskStatus.entries())) {
      if (taskStatus === status) {
        result.push(taskId);
      }
    }
    
    return result;
  }
} 