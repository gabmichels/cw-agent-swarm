/**
 * ApprovalWorkflowService - Handles the complete approval workflow
 * 
 * This service manages the workflow from task creation requiring approval
 * to sending approval requests to users and handling their decisions.
 */

import { Task, TaskStatus, TaskScheduleType, createTask } from '../lib/scheduler/models/Task.model';
import { ApprovalConfigurationManager } from '../agents/shared/collaboration/approval/ApprovalConfigurationManager';
import { CollaborativeTask } from '../agents/shared/collaboration/interfaces/HumanCollaboration.interface';

export interface ApprovalRequest {
  taskId: string;
  approvalMessage: string;
  draftContent?: string;
  scheduledTime?: Date;
  taskType: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export interface ApprovalDecision {
  taskId: string;
  approved: boolean;
  userId: string;
  notes?: string;
}

export class ApprovalWorkflowService {
  private approvalManager: ApprovalConfigurationManager;
  private schedulerManager: any; // Will be injected
  
  constructor() {
    this.approvalManager = ApprovalConfigurationManager.getInstance();
  }
  
  /**
   * Set the scheduler manager for task operations
   */
  public setSchedulerManager(schedulerManager: any): void {
    this.schedulerManager = schedulerManager;
  }
  
  /**
   * Create a task that requires approval and generate an approval request
   */
  public async createApprovalRequest(
    agentId: string,
    taskData: {
      name: string;
      description: string;
      draftContent?: string;
      scheduledTime?: Date;
      taskType: string;
      priority: 'low' | 'medium' | 'high' | 'urgent';
      handler: (...args: unknown[]) => Promise<unknown>;
      handlerArgs?: unknown[];
    },
    chatId: string
  ): Promise<ApprovalRequest> {
    try {
      // Create a collaborative task for approval checking
      const collaborativeTask: CollaborativeTask = {
        id: `temp-${Date.now()}`,
        goal: taskData.name,
        type: this.mapTaskTypeToCollaborativeType(taskData.taskType),
        params: {
          description: taskData.description,
          priority: this.mapPriorityToNumber(taskData.priority),
          draftContent: taskData.draftContent,
          scheduledTime: taskData.scheduledTime,
          taskType: taskData.taskType
        }
      };
      
      // Check if approval is required
      const approvalCheck = this.approvalManager.checkApprovalRequired(collaborativeTask);
      
      if (!approvalCheck.required) {
        throw new Error('Task does not require approval');
      }
      
      // Create the task with approval fields
      const task = createTask({
        name: taskData.name,
        description: taskData.description,
        scheduleType: taskData.scheduledTime ? TaskScheduleType.EXPLICIT : TaskScheduleType.PRIORITY,
        scheduledTime: taskData.scheduledTime,
        priority: this.mapPriorityToNumber(taskData.priority),
        status: TaskStatus.PENDING,
        handler: taskData.handler,
        handlerArgs: taskData.handlerArgs,
        approvalRequired: true,
        approvalStatus: 'pending',
        draftContent: taskData.draftContent,
        approvalChatId: chatId,
        approvalRequestedAt: new Date()
      });
      
      // Create approval entry in the approval system
      const approvalEntry = this.approvalManager.recordApprovalRequest(
        task.id,
        task.name,
        approvalCheck.rule!
      );
      
      // Update task with approval entry ID
      task.approvalEntryId = approvalEntry.id;
      
      // Create task in scheduler
      if (this.schedulerManager) {
        await this.schedulerManager.createTask(task);
      }
      
      // Format approval message
      const approvalMessage = this.formatApprovalMessage(task, approvalCheck.rule!);
      task.approvalMessage = approvalMessage;
      
      return {
        taskId: task.id,
        approvalMessage,
        draftContent: taskData.draftContent,
        scheduledTime: taskData.scheduledTime,
        taskType: taskData.taskType,
        priority: taskData.priority
      };
      
    } catch (error) {
      console.error('Error creating approval request:', error);
      throw new Error(`Failed to create approval request: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Handle an approval decision from the user
   */
  public async handleApprovalDecision(decision: ApprovalDecision): Promise<void> {
    try {
      if (!this.schedulerManager) {
        throw new Error('Scheduler manager not configured');
      }
      
      // Get the task
      const task = await this.schedulerManager.getTask(decision.taskId);
      if (!task) {
        throw new Error(`Task not found: ${decision.taskId}`);
      }
      
      // Record the approval decision
      if (task.approvalEntryId) {
        this.approvalManager.recordApprovalDecision(
          task.approvalEntryId,
          decision.approved,
          decision.userId,
          'user',
          decision.notes
        );
      }
      
      // Update task with approval decision
      const updatedTask: Partial<Task> = {
        ...task,
        approvalStatus: decision.approved ? 'approved' : 'rejected',
        approvedBy: decision.userId,
        approvalNotes: decision.notes,
        approvalDecidedAt: new Date(),
        updatedAt: new Date()
      };
      
      if (decision.approved) {
        // If approved, keep the task as pending for execution
        updatedTask.status = TaskStatus.PENDING;
      } else {
        // If rejected, cancel the task
        updatedTask.status = TaskStatus.CANCELLED;
      }
      
      // Update the task
      await this.schedulerManager.updateTask(updatedTask);
      
    } catch (error) {
      console.error('Error handling approval decision:', error);
      throw new Error(`Failed to handle approval decision: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Get all pending approval requests for a specific chat
   */
  public async getPendingApprovals(chatId: string): Promise<ApprovalRequest[]> {
    try {
      if (!this.schedulerManager) {
        return [];
      }
      
      // Get all tasks that need approval for this chat
      const tasks = await this.schedulerManager.findTasks({
        approvalRequired: true,
        approvalStatus: 'pending',
        approvalChatId: chatId
      });
      
      return tasks.map((task: Task) => ({
        taskId: task.id,
        approvalMessage: task.approvalMessage || `Approval required for: ${task.name}`,
        draftContent: task.draftContent,
        scheduledTime: task.scheduledTime,
        taskType: this.extractTaskType(task),
        priority: this.mapNumberToPriority(task.priority)
      }));
      
    } catch (error) {
      console.error('Error getting pending approvals:', error);
      return [];
    }
  }
  
  /**
   * Check if a task requires approval
   */
  public checkTaskNeedsApproval(task: CollaborativeTask): boolean {
    const approvalCheck = this.approvalManager.checkApprovalRequired(task);
    return approvalCheck.required;
  }
  
  /**
   * Format approval message for display
   */
  private formatApprovalMessage(task: Task, rule: any): string {
    const timeStr = task.scheduledTime ? ` scheduled for ${task.scheduledTime.toLocaleString()}` : '';
    const contentPreview = task.draftContent ? `\n\nContent preview:\n"${task.draftContent.substring(0, 200)}${task.draftContent.length > 200 ? '...' : ''}"` : '';
    
    return `🔐 **Approval Required**\n\n**Task:** ${task.name}${timeStr}\n**Reason:** ${rule.reason}${contentPreview}\n\nPlease review and approve or reject this task.`;
  }
  
  /**
   * Map task type to collaborative task type
   */
  private mapTaskTypeToCollaborativeType(taskType: string): string {
    const typeMap: Record<string, string> = {
      'Tweet': 'external_post',
      'Email': 'external_post',
      'Post': 'external_post',
      'Strategic': 'strategic_task',
      'Data': 'data_modification',
      'Tool': 'tool_usage'
    };
    
    return typeMap[taskType] || 'custom';
  }
  
  /**
   * Map priority string to number
   */
  private mapPriorityToNumber(priority: string): number {
    const priorityMap: Record<string, number> = {
      'low': 2,
      'medium': 5,
      'high': 8,
      'urgent': 10
    };
    
    return priorityMap[priority] || 5;
  }
  
  /**
   * Map priority number to string
   */
  private mapNumberToPriority(priority: number): 'low' | 'medium' | 'high' | 'urgent' {
    if (priority >= 10) return 'urgent';
    if (priority >= 8) return 'high';
    if (priority >= 5) return 'medium';
    return 'low';
  }
  
  /**
   * Extract task type from task data
   */
  private extractTaskType(task: Task): string {
    // Try to extract from metadata or fall back to description analysis
    if (task.metadata?.taskType) {
      return task.metadata.taskType as string;
    }
    
    // Simple heuristics based on task name/description
    const name = task.name.toLowerCase();
    if (name.includes('tweet')) return 'Tweet';
    if (name.includes('email')) return 'Email';
    if (name.includes('post')) return 'Post';
    if (name.includes('strategic')) return 'Strategic';
    
    return 'Task';
  }
}

// Singleton instance
export const approvalWorkflowService = new ApprovalWorkflowService(); 