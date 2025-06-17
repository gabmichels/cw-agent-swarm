/**
 * ChatApprovalHandler - Handles approval decisions from the chat UI
 * 
 * This service processes approval decisions made by users in the chat
 * and communicates with the approval workflow service.
 */

import { approvalWorkflowService } from './ApprovalWorkflowService';

export interface ChatApprovalDecision {
  taskId: string;
  approved: boolean;
  userId: string;
  notes?: string;
}

export class ChatApprovalHandler {
  
  /**
   * Handle an approval decision from the chat UI
   */
  public async handleApprovalDecision(
    approved: boolean,
    taskId: string,
    userId: string,
    notes?: string
  ): Promise<void> {
    try {
      // Process the approval decision
      await approvalWorkflowService.handleApprovalDecision({
        taskId,
        approved,
        userId,
        notes
      });
      
      console.log(`Approval decision processed: ${approved ? 'approved' : 'rejected'} by ${userId} for task ${taskId}`);
      
      // You could add additional logic here, such as:
      // - Sending notifications
      // - Logging to analytics
      // - Updating UI state
      
    } catch (error) {
      console.error('Error handling approval decision:', error);
      throw error;
    }
  }
  
  /**
   * Get pending approvals for a chat
   */
  public async getPendingApprovalsForChat(chatId: string) {
    try {
      return await approvalWorkflowService.getPendingApprovals(chatId);
    } catch (error) {
      console.error('Error getting pending approvals:', error);
      return [];
    }
  }
  
  /**
   * Create a standardized approval decision handler for React components
   */
  public createApprovalDecisionHandler(userId: string) {
    return async (approved: boolean, taskId: string, notes?: string) => {
      return this.handleApprovalDecision(approved, taskId, userId, notes);
    };
  }
}

// Singleton instance
 