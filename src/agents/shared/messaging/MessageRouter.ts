/**
 * MessageRouter.ts - Inter-agent messaging system
 *
 * This module provides:
 * - Direct message routing between agents
 * - Message tracking and correlation
 * - Integration with delegation context
 * - Centralized message logging
 */

import { AgentMonitor } from '../monitoring/AgentMonitor';

export type MessageType = 'update' | 'handoff' | 'ask' | 'log' | 'result';

export interface AgentMessage {
  fromAgentId: string;
  toAgentId: string;
  type: MessageType;
  payload: any;
  timestamp: number;
  correlationId?: string;
  delegationContextId?: string;
  metadata?: Record<string, any>;
}

export interface MessageResponse {
  success: boolean;
  error?: string;
  responsePayload?: any;
}

/**
 * MessageRouter for agent-to-agent communication
 */
export class MessageRouter {
  private static handlers: Record<string, (msg: AgentMessage) => Promise<void>> = {};
  private static pendingMessages: Record<string, AgentMessage[]> = {};
  private static messageLog: AgentMessage[] = [];

  /**
   * Send a message from one agent to another
   */
  static async sendMessage(message: AgentMessage): Promise<MessageResponse> {
    try {
      // Ensure required fields
      if (!message.fromAgentId || !message.toAgentId || !message.type) {
        return {
          success: false,
          error: 'Missing required message fields (fromAgentId, toAgentId, or type)'
        };
      }

      // Set timestamp if not provided
      if (!message.timestamp) {
        message.timestamp = Date.now();
      }

      // Generate correlationId if not provided
      if (!message.correlationId) {
        message.correlationId = `msg_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      }

      // Log the message via AgentMonitor
      AgentMonitor.log({
        agentId: message.fromAgentId,
        taskId: message.correlationId || 'n/a',
        eventType: 'message',
        timestamp: message.timestamp,
        delegationContextId: message.delegationContextId,
        metadata: {
          messageType: message.type,
          toAgent: message.toAgentId,
          payload: JSON.stringify(message.payload).substring(0, 100)
        }
      });

      // Store in message log
      MessageRouter.messageLog.push(message);

      // Check if recipient has a registered handler
      const handler = MessageRouter.handlers[message.toAgentId];
      if (!handler) {
        // Store in pending messages if no handler
        if (!MessageRouter.pendingMessages[message.toAgentId]) {
          MessageRouter.pendingMessages[message.toAgentId] = [];
        }
        MessageRouter.pendingMessages[message.toAgentId].push(message);
        
        return {
          success: false,
          error: `No message handler registered for agent: ${message.toAgentId}. Message queued.`
        };
      }

      // Deliver message to handler
      await handler(message);

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error sending message: ${errorMessage}`);

      // Log the error via AgentMonitor
      AgentMonitor.log({
        agentId: message.fromAgentId,
        taskId: message.correlationId || 'n/a',
        eventType: 'error',
        status: 'failure',
        timestamp: Date.now(),
        errorMessage,
        delegationContextId: message.delegationContextId,
        metadata: {
          messageType: message.type,
          toAgent: message.toAgentId
        }
      });

      return {
        success: false,
        error: `Error delivering message: ${errorMessage}`
      };
    }
  }

  /**
   * Register a handler for an agent to receive messages
   */
  static registerHandler(agentId: string, handler: (msg: AgentMessage) => Promise<void>): void {
    MessageRouter.handlers[agentId] = handler;
    console.log(`Registered message handler for agent: ${agentId}`);

    // Process any pending messages for this agent
    const pendingMessages = MessageRouter.pendingMessages[agentId] || [];
    if (pendingMessages.length > 0) {
      console.log(`Processing ${pendingMessages.length} pending messages for agent: ${agentId}`);
      
      // Clear pending queue before processing to avoid duplication
      MessageRouter.pendingMessages[agentId] = [];
      
      // Process each message
      pendingMessages.forEach(msg => {
        MessageRouter.sendMessage(msg).catch(err => {
          console.error(`Error processing pending message: ${err}`);
        });
      });
    }
  }

  /**
   * Send a response to a previous message
   */
  static async sendResponse(originalMessage: AgentMessage, responsePayload: any): Promise<MessageResponse> {
    return await MessageRouter.sendMessage({
      fromAgentId: originalMessage.toAgentId,
      toAgentId: originalMessage.fromAgentId,
      type: 'result',
      payload: responsePayload,
      timestamp: Date.now(),
      correlationId: originalMessage.correlationId,
      delegationContextId: originalMessage.delegationContextId,
      metadata: {
        isResponseTo: originalMessage.type,
        originalTimestamp: originalMessage.timestamp
      }
    });
  }

  /**
   * Broadcast a message to multiple agents
   */
  static async broadcastMessage(
    fromAgentId: string,
    toAgentIds: string[],
    type: MessageType,
    payload: any,
    options: {
      correlationId?: string,
      delegationContextId?: string,
      metadata?: Record<string, any>
    } = {}
  ): Promise<Record<string, MessageResponse>> {
    const results: Record<string, MessageResponse> = {};
    const timestamp = Date.now();
    const correlationId = options.correlationId || `broadcast_${timestamp}_${Math.floor(Math.random() * 10000)}`;

    // Send message to each recipient
    for (const toAgentId of toAgentIds) {
      results[toAgentId] = await MessageRouter.sendMessage({
        fromAgentId,
        toAgentId,
        type,
        payload,
        timestamp,
        correlationId,
        delegationContextId: options.delegationContextId,
        metadata: {
          ...options.metadata,
          isBroadcast: true,
          recipientCount: toAgentIds.length
        }
      });
    }

    return results;
  }

  /**
   * Get all messages for a specific agent
   */
  static getMessagesForAgent(agentId: string, options: {
    asRecipient?: boolean,
    asSender?: boolean
  } = { asRecipient: true }): AgentMessage[] {
    return MessageRouter.messageLog.filter(msg => {
      if (options.asRecipient && options.asSender) {
        return msg.toAgentId === agentId || msg.fromAgentId === agentId;
      } else if (options.asRecipient) {
        return msg.toAgentId === agentId;
      } else if (options.asSender) {
        return msg.fromAgentId === agentId;
      }
      return false;
    });
  }

  /**
   * Get conversation thread by correlationId
   */
  static getMessageThread(correlationId: string): AgentMessage[] {
    return MessageRouter.messageLog
      .filter(msg => msg.correlationId === correlationId)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Clear all message handlers
   */
  static clearHandlers(): void {
    MessageRouter.handlers = {};
    console.log('Cleared all message handlers');
  }

  /**
   * Clear message log
   */
  static clearMessageLog(): void {
    MessageRouter.messageLog = [];
    console.log('Cleared message log');
  }
} 