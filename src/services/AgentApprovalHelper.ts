/**
 * AgentApprovalHelper - Helper service for agents to send approval requests
 * 
 * This service allows agents to proactively send approval requests to users
 * when they want to perform tasks that require permission.
 */

import { approvalWorkflowService, ApprovalRequest } from './ApprovalWorkflowService';
import { CollaborativeTask } from '../agents/shared/collaboration/interfaces/HumanCollaboration.interface';
import { approvalMessagingService } from './ApprovalMessagingService';

export interface AgentApprovalRequestData {
  agentId: string;
  chatId: string;
  taskName: string;
  taskDescription: string;
  taskType: 'Tweet' | 'Email' | 'Post' | 'Strategic' | 'Data' | 'Tool' | 'Custom';
  draftContent?: string;
  scheduledTime?: Date;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  handler: (...args: unknown[]) => Promise<unknown>;
  handlerArgs?: unknown[];
}

export interface AgentMessage {
  id?: string;
  content: string;
  sender: {
    name: string;
    role: 'assistant' | 'user';
  };
  timestamp: Date;
  requiresApproval?: boolean;
  approvalContent?: {
    taskId: string;
    draftContent?: string;
    scheduledTime?: Date;
    taskType: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    approvalMessage: string;
  };
}

export class AgentApprovalHelper {
  private messagingService: any; // Will be injected
  
  constructor() {
    // Constructor
  }
  
  /**
   * Set the messaging service for sending messages to chat
   */
  public setMessagingService(messagingService: any): void {
    this.messagingService = messagingService;
  }
  
  /**
   * Check if a task needs approval without creating it
   */
  public checkNeedsApproval(taskData: AgentApprovalRequestData): boolean {
    try {
      // Create a collaborative task for approval checking
      const collaborativeTask: CollaborativeTask = {
        id: `temp-${Date.now()}`,
        goal: taskData.taskName,
        type: this.mapTaskTypeToCollaborativeType(taskData.taskType),
        params: {
          description: taskData.taskDescription,
          priority: this.mapPriorityToNumber(taskData.priority || 'medium'),
          draftContent: taskData.draftContent,
          scheduledTime: taskData.scheduledTime,
          taskType: taskData.taskType
        }
      };
      
      return approvalWorkflowService.checkTaskNeedsApproval(collaborativeTask);
    } catch (error) {
      console.error('Error checking approval requirement:', error);
      return false;
    }
  }
  
  /**
   * Request approval for a task by sending a message to the chat
   */
  public async requestApproval(taskData: AgentApprovalRequestData): Promise<string> {
    try {
      // First check if approval is needed
      if (!this.checkNeedsApproval(taskData)) {
        throw new Error('Task does not require approval');
      }
      
      // Create the approval request
      const approvalRequest = await approvalWorkflowService.createApprovalRequest(
        taskData.agentId,
        {
          name: taskData.taskName,
          description: taskData.taskDescription,
          draftContent: taskData.draftContent,
          scheduledTime: taskData.scheduledTime,
          taskType: taskData.taskType,
          priority: taskData.priority || 'medium',
          handler: taskData.handler,
          handlerArgs: taskData.handlerArgs
        },
        taskData.chatId
      );
      
      // Create the message with approval UI
      const message: AgentMessage = {
        content: this.formatApprovalMessage(approvalRequest),
        sender: {
          name: taskData.agentId,
          role: 'assistant'
        },
        timestamp: new Date(),
        requiresApproval: true,
        approvalContent: {
          taskId: approvalRequest.taskId,
          draftContent: approvalRequest.draftContent,
          scheduledTime: approvalRequest.scheduledTime,
          taskType: approvalRequest.taskType,
          priority: approvalRequest.priority,
          approvalMessage: approvalRequest.approvalMessage
        }
      };
      
      // Send the message to the chat
      if (this.messagingService) {
        await this.messagingService.sendMessage(taskData.chatId, message);
      } else {
        // Try using the approval messaging service as fallback
        try {
          await approvalMessagingService.sendApprovalMessage(
            taskData.chatId,
            taskData.agentId,
            'user', // Default user ID
            message
          );
        } catch (error) {
          console.warn('Messaging service not configured - approval message not sent');
        }
      }
      
      return approvalRequest.taskId;
      
    } catch (error) {
      console.error('Error requesting approval:', error);
      throw new Error(`Failed to request approval: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Example usage for agents - Tweet approval
   */
  public async requestTweetApproval(
    agentId: string,
    chatId: string,
    tweetContent: string,
    scheduledTime?: Date
  ): Promise<string> {
    return this.requestApproval({
      agentId,
      chatId,
      taskName: 'Post Tweet',
      taskDescription: `Post a tweet to social media${scheduledTime ? ` at ${scheduledTime.toLocaleString()}` : ''}`,
      taskType: 'Tweet',
      draftContent: tweetContent,
      scheduledTime,
      priority: 'medium',
      handler: async () => {
        // This would be the actual tweet posting logic
        console.log('Posting tweet:', tweetContent);
        return { success: true, tweetId: 'tweet-123' };
      },
      handlerArgs: [tweetContent]
    });
  }
  
  /**
   * Example usage for agents - Email approval
   */
  public async requestEmailApproval(
    agentId: string,
    chatId: string,
    emailData: {
      to: string;
      subject: string;
      body: string;
      scheduledTime?: Date;
    }
  ): Promise<string> {
    const emailContent = `To: ${emailData.to}\nSubject: ${emailData.subject}\n\n${emailData.body}`;
    
    return this.requestApproval({
      agentId,
      chatId,
      taskName: 'Send Email',
      taskDescription: `Send email to ${emailData.to}${emailData.scheduledTime ? ` at ${emailData.scheduledTime.toLocaleString()}` : ''}`,
      taskType: 'Email',
      draftContent: emailContent,
      scheduledTime: emailData.scheduledTime,
      priority: 'medium',
      handler: async () => {
        // This would be the actual email sending logic
        console.log('Sending email:', emailData);
        return { success: true, messageId: 'email-123' };
      },
      handlerArgs: [emailData]
    });
  }
  
  /**
   * Format approval message for display
   */
  private formatApprovalMessage(approvalRequest: ApprovalRequest): string {
    const timeStr = approvalRequest.scheduledTime 
      ? ` scheduled for ${approvalRequest.scheduledTime.toLocaleString()}` 
      : '';
    
    let message = `I'd like to ${approvalRequest.taskType.toLowerCase()}${timeStr}. Please review and approve:`;
    
    if (approvalRequest.draftContent) {
      message += `\n\n**Content:**\n${approvalRequest.draftContent}`;
    }
    
    return message;
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
      'Tool': 'tool_usage',
      'Custom': 'custom'
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
}

// Singleton instance for easy access
export const agentApprovalHelper = new AgentApprovalHelper(); 