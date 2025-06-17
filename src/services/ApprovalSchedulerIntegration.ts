/**
 * ApprovalSchedulerIntegration - Connects approval system to task scheduler
 * 
 * This service handles the integration between the approval workflow and
 * the task scheduler, ensuring approved tasks are properly executed.
 */

import { approvalWorkflowService } from './ApprovalWorkflowService';
import { approvalMessagingService } from './ApprovalMessagingService';

export interface SchedulerManager {
  createTask(task: any): Promise<any>;
  updateTask(task: any): Promise<any>;
  getTask(taskId: string): Promise<any>;
  findTasks(filter: any): Promise<any[]>;
  executeTaskNow(taskId: string): Promise<any>;
}

export class ApprovalSchedulerIntegration {
  private schedulerManager: SchedulerManager | null = null;

  /**
   * Set the scheduler manager for task operations
   */
  public setSchedulerManager(schedulerManager: SchedulerManager): void {
    this.schedulerManager = schedulerManager;
    // Also set it in the approval workflow service
    approvalWorkflowService.setSchedulerManager(schedulerManager);
  }

  /**
   * Initialize the integration by connecting services
   */
  public async initialize(): Promise<void> {
    console.log('🔧 Initializing Approval-Scheduler Integration...');
    
    // Set up the messaging service in the approval helper
    // This would be done when the actual chat service is available
    console.log('📡 Messaging service integration ready');
    
    console.log('✅ Approval-Scheduler Integration initialized');
  }

  /**
   * Handle approval decision and manage task execution
   */
  public async processApprovalDecision(
    taskId: string,
    approved: boolean,
    userId: string,
    notes?: string,
    chatId?: string
  ): Promise<void> {
    try {
      console.log(`Processing approval decision for task ${taskId}: ${approved ? 'approved' : 'rejected'}`);
      
      // Process the decision through the workflow service
      await approvalWorkflowService.handleApprovalDecision({
        taskId,
        approved,
        userId,
        notes
      });

      // Get task details for notification
      let taskName = 'Unknown Task';
      if (this.schedulerManager) {
        try {
          const task = await this.schedulerManager.getTask(taskId);
          if (task) {
            taskName = task.name || taskName;
          }
        } catch (error) {
          console.warn('Could not retrieve task details for notification:', error);
        }
      }

      // Send notification to chat if chat ID is provided
      if (chatId) {
        try {
          await approvalMessagingService.sendApprovalDecisionNotification(
            chatId,
            'system',
            userId,
            taskName,
            approved,
            notes
          );
        } catch (error) {
          console.warn('Could not send approval decision notification:', error);
        }
      }

      console.log(`✅ Approval decision processed successfully for task ${taskId}`);
      
    } catch (error) {
      console.error('Error processing approval decision:', error);
      throw error;
    }
  }

  /**
   * Get pending approval requests from the scheduler
   */
  public async getPendingApprovals(chatId?: string): Promise<any[]> {
    if (!this.schedulerManager) {
      console.warn('Scheduler manager not configured - returning empty approvals');
      return [];
    }

    try {
      // Find tasks that need approval
      const pendingTasks = await this.schedulerManager.findTasks({
        approvalRequired: true,
        approvalStatus: 'pending',
        ...(chatId && { approvalChatId: chatId })
      });

      return pendingTasks.map((task: any) => ({
        id: task.id,
        taskId: task.id,
        taskName: task.name,
        taskDescription: task.description,
        taskType: this.extractTaskType(task),
        priority: this.mapNumberToPriority(task.priority || 5),
        draftContent: task.draftContent,
        scheduledTime: task.scheduledTime?.toISOString(),
        requestedAt: task.approvalRequestedAt?.toISOString() || task.createdAt?.toISOString(),
        requestedBy: 'AI Agent',
        chatId: task.approvalChatId || chatId || 'unknown',
        status: 'pending'
      }));
      
    } catch (error) {
      console.error('Error getting pending approvals from scheduler:', error);
      return [];
    }
  }

  /**
   * Execute an approved task immediately
   */
  public async executeApprovedTask(taskId: string): Promise<any> {
    if (!this.schedulerManager) {
      throw new Error('Scheduler manager not configured');
    }

    try {
      console.log(`Executing approved task: ${taskId}`);
      const result = await this.schedulerManager.executeTaskNow(taskId);
      console.log(`✅ Task ${taskId} executed successfully`);
      return result;
    } catch (error) {
      console.error(`Error executing approved task ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Get scheduler status
   */
  public getSchedulerStatus(): { connected: boolean; manager: string } {
    return {
      connected: this.schedulerManager !== null,
      manager: this.schedulerManager ? 'Connected' : 'Not Connected'
    };
  }

  /**
   * Extract task type from task object
   */
  private extractTaskType(task: any): string {
    if (task.metadata?.taskType) return task.metadata.taskType;
    if (task.taskType) return task.taskType;
    
    // Infer from task name/description
    const name = (task.name || '').toLowerCase();
    const desc = (task.description || '').toLowerCase();
    
    if (name.includes('tweet') || desc.includes('tweet')) return 'tweet';
    if (name.includes('email') || desc.includes('email')) return 'email';
    if (name.includes('post') || desc.includes('post')) return 'post';
    
    return 'task';
  }

  /**
   * Map priority number to string
   */
  private mapNumberToPriority(priority: number): 'low' | 'medium' | 'high' | 'urgent' {
    if (priority >= 9) return 'urgent';
    if (priority >= 7) return 'high';
    if (priority >= 4) return 'medium';
    return 'low';
  }
}

// Singleton instance
export const approvalSchedulerIntegration = new ApprovalSchedulerIntegration(); 