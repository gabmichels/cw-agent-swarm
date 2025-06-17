/**
 * ApprovalMessagingService - Integrates approval system with chat messaging
 * 
 * This service handles sending approval requests as chat messages and processing
 * approval decisions from the chat UI.
 */

import { AgentMessage } from './AgentApprovalHelper';

export interface ChatService {
  addMessage(message: {
    chatId: string;
    userId: string;
    agentId: string;
    content: string;
    messageType: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ id: string; timestamp: Date }>;
}

export class ApprovalMessagingService {
  private chatService: ChatService | null = null;

  /**
   * Set the chat service for sending messages
   */
  public setChatService(chatService: ChatService): void {
    this.chatService = chatService;
  }

  /**
   * Send an approval request message to the chat
   */
  public async sendApprovalMessage(
    chatId: string,
    agentId: string,
    userId: string,
    message: AgentMessage
  ): Promise<string> {
    if (!this.chatService) {
      throw new Error('Chat service not configured');
    }

    try {
      const chatMessage = await this.chatService.addMessage({
        chatId,
        userId,
        agentId,
        content: message.content,
        messageType: 'approval_request',
        metadata: {
          requiresApproval: message.requiresApproval,
          approvalContent: message.approvalContent,
          timestamp: message.timestamp.toISOString(),
          sender: message.sender
        }
      });

      return chatMessage.id;
    } catch (error) {
      console.error('Error sending approval message:', error);
      throw new Error(`Failed to send approval message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send a regular message to the chat
   */
  public async sendMessage(
    chatId: string,
    agentId: string,
    userId: string,
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<string> {
    if (!this.chatService) {
      throw new Error('Chat service not configured');
    }

    try {
      const chatMessage = await this.chatService.addMessage({
        chatId,
        userId,
        agentId,
        content,
        messageType: 'agent_message',
        metadata
      });

      return chatMessage.id;
    } catch (error) {
      console.error('Error sending message:', error);
      throw new Error(`Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send a notification about approval decision
   */
  public async sendApprovalDecisionNotification(
    chatId: string,
    agentId: string,
    userId: string,
    taskName: string,
    approved: boolean,
    notes?: string
  ): Promise<string> {
    const content = approved 
      ? `✅ **Task Approved**: ${taskName}\n${notes ? `\n**Notes**: ${notes}` : ''}\n\nThe task has been scheduled for execution.`
      : `❌ **Task Rejected**: ${taskName}\n${notes ? `\n**Reason**: ${notes}` : ''}\n\nThe task has been cancelled.`;

    return this.sendMessage(chatId, agentId, userId, content, {
      messageType: 'approval_decision',
      taskName,
      approved,
      notes
    });
  }
}

// Singleton instance
export const approvalMessagingService = new ApprovalMessagingService(); 