/**
 * Chat Memory Service
 * 
 * This module implements the memory service for chat entities.
 */

import { BaseMemoryService, MemoryErrorCode } from "./base/service";
import { ChatMemoryEntity, ChatParticipant, ChatParticipantRole, ChatPermission, ChatStatus } from "../schema/chat";
import { Result, successResult } from "../../../lib/errors/base";
import { IMemoryRepository, SearchParams } from "./base/types";
import { FilterOperator } from "./filters/types";
import { StructuredId, IdGenerator } from "../../../utils/ulid";

/**
 * Message query options
 */
export interface MessageQueryOptions {
  limit?: number;
  offset?: number;
  fromDate?: Date;
  toDate?: Date;
  senderId?: string;
  includeMetadata?: boolean;
  sortDirection?: 'asc' | 'desc';
  threadedView?: boolean;
}

/**
 * Chat memory service implementation
 */
export class ChatMemoryService extends BaseMemoryService<ChatMemoryEntity> {
  /**
   * Create a new chat memory service
   */
  constructor(repository: IMemoryRepository<ChatMemoryEntity>) {
    super(repository);
  }
  
  /**
   * Add a participant to a chat
   */
  async addParticipant(
    chatId: StructuredId | string,
    participant: ChatParticipant
  ): Promise<Result<ChatMemoryEntity | null>> {
    try {
      // Get the chat
      const chat = await this.repository.getById(chatId);
      
      // If chat doesn't exist, return null
      if (!chat) {
        return successResult(null);
      }
      
      // Check if participant already exists
      const existingParticipants = chat.participants || [];
      const participantExists = existingParticipants.some(p => p.id === participant.id);
      
      // If participant already exists, just return the chat
      if (participantExists) {
        return successResult(chat);
      }
      
      // Add participant
      const updatedChat = await this.repository.update(
        chatId,
        {
          participants: [...existingParticipants, participant]
        }
      );
      
      return successResult(updatedChat);
    } catch (error) {
      return this.handleError(error, MemoryErrorCode.UPDATE_FAILED, {
        operation: 'addParticipant',
        chatId: typeof chatId === 'string' ? chatId : chatId.toString(),
        participantId: participant.id
      });
    }
  }
  
  /**
   * Remove a participant from a chat
   */
  async removeParticipant(
    chatId: StructuredId | string,
    participantId: string
  ): Promise<Result<ChatMemoryEntity | null>> {
    try {
      // Get the chat
      const chat = await this.repository.getById(chatId);
      
      // If chat doesn't exist, return null
      if (!chat) {
        return successResult(null);
      }
      
      // Check if participant exists
      const existingParticipants = chat.participants || [];
      const participantIndex = existingParticipants.findIndex(p => p.id === participantId);
      
      // If participant doesn't exist, just return the chat
      if (participantIndex === -1) {
        return successResult(chat);
      }
      
      // Remove participant
      const updatedParticipants = [
        ...existingParticipants.slice(0, participantIndex),
        ...existingParticipants.slice(participantIndex + 1)
      ];
      
      const updatedChat = await this.repository.update(
        chatId,
        {
          participants: updatedParticipants
        }
      );
      
      return successResult(updatedChat);
    } catch (error) {
      return this.handleError(error, MemoryErrorCode.UPDATE_FAILED, {
        operation: 'removeParticipant',
        chatId: typeof chatId === 'string' ? chatId : chatId.toString(),
        participantId
      });
    }
  }
  
  /**
   * Update a participant's role in a chat
   */
  async updateParticipantRole(
    chatId: StructuredId | string,
    participantId: string,
    role: ChatParticipantRole
  ): Promise<Result<ChatMemoryEntity | null>> {
    try {
      // Get the chat
      const chat = await this.repository.getById(chatId);
      
      // If chat doesn't exist, return null
      if (!chat) {
        return successResult(null);
      }
      
      // Check if participant exists
      const existingParticipants = chat.participants || [];
      const participantIndex = existingParticipants.findIndex(p => p.id === participantId);
      
      // If participant doesn't exist, return null
      if (participantIndex === -1) {
        return successResult(chat);
      }
      
      // Update participant's role
      const updatedParticipants = [...existingParticipants];
      updatedParticipants[participantIndex] = {
        ...updatedParticipants[participantIndex],
        role
      };
      
      const updatedChat = await this.repository.update(
        chatId,
        {
          participants: updatedParticipants
        }
      );
      
      return successResult(updatedChat);
    } catch (error) {
      return this.handleError(error, MemoryErrorCode.UPDATE_FAILED, {
        operation: 'updateParticipantRole',
        chatId: typeof chatId === 'string' ? chatId : chatId.toString(),
        participantId,
        role
      });
    }
  }
  
  /**
   * Find chats by participant
   */
  async findChatsByParticipant(participantId: string): Promise<Result<ChatMemoryEntity[]>> {
    try {
      // Using a search approach since filter with arrays is complex
      const params: SearchParams<ChatMemoryEntity> = {
        query: participantId,
        filter: {
          type: {
            operator: FilterOperator.EQUALS,
            value: "chat"
          }
        }
      };
      
      return await this.search(params);
    } catch (error) {
      return this.handleError(error, MemoryErrorCode.SEARCH_FAILED, {
        operation: 'findChatsByParticipant',
        participantId
      });
    }
  }
  
  /**
   * Find active chats
   */
  async findActiveChats(): Promise<Result<ChatMemoryEntity[]>> {
    try {
      // Search for chats with ACTIVE status
      const chats = await this.repository.filter(
        {
          status: {
            operator: FilterOperator.EQUALS,
            value: ChatStatus.ACTIVE
          }
        },
        { includeDeleted: false }
      );
      
      return successResult(chats);
    } catch (error) {
      return this.handleError(error, MemoryErrorCode.SEARCH_FAILED, {
        operation: 'findActiveChats'
      });
    }
  }
  
  /**
   * Find chats by metadata
   */
  async findChatsByMetadata(metadata: Partial<Record<string, unknown>>): Promise<Result<ChatMemoryEntity[]>> {
    try {
      // Convert metadata to filter conditions
      const filterConditions: any = {};
      
      // Add metadata fields to filter
      for (const [key, value] of Object.entries(metadata)) {
        filterConditions[`metadata.${key}`] = {
          operator: FilterOperator.EQUALS,
          value
        };
      }
      
      // Search for chats with the specified metadata
      const chats = await this.repository.filter(
        filterConditions,
        { includeDeleted: false }
      );
      
      return successResult(chats);
    } catch (error) {
      return this.handleError(error, MemoryErrorCode.SEARCH_FAILED, {
        operation: 'findChatsByMetadata',
        metadata
      });
    }
  }
  
  /**
   * Update chat status
   */
  async updateChatStatus(
    chatId: StructuredId | string,
    status: ChatStatus
  ): Promise<Result<ChatMemoryEntity | null>> {
    try {
      // Update chat status
      const chat = await this.repository.update(
        chatId,
        { status }
      );
      
      return successResult(chat);
    } catch (error) {
      return this.handleError(error, MemoryErrorCode.UPDATE_FAILED, {
        operation: 'updateChatStatus',
        chatId: typeof chatId === 'string' ? chatId : chatId.toString(),
        status
      });
    }
  }
  
  /**
   * Get messages for a chat
   * Note: In a real implementation, this would query a separate message collection
   */
  async getMessages(
    chatId: StructuredId | string,
    options?: MessageQueryOptions
  ): Promise<Result<any[]>> {
    try {
      // This would use a separate message service in a real implementation
      // For now, we return a placeholder
      return successResult([]);
    } catch (error) {
      return this.handleError(error, MemoryErrorCode.SEARCH_FAILED, {
        operation: 'getMessages',
        chatId: typeof chatId === 'string' ? chatId : chatId.toString()
      });
    }
  }
  
  /**
   * Add a message to a chat
   * Note: In a real implementation, this would add to a separate message collection
   */
  async addMessage(
    chatId: StructuredId | string,
    message: any
  ): Promise<Result<any>> {
    try {
      // This would use a separate message service in a real implementation
      // For now, we update the chat's message count
      const chat = await this.repository.getById(chatId);
      
      // If chat doesn't exist, return null
      if (!chat) {
        return successResult(null);
      }
      
      // Update chat's message count and last message time
      const updatedChat = await this.repository.update(
        chatId,
        {
          messageCount: (chat.messageCount || 0) + 1,
          lastMessageAt: new Date()
        }
      );
      
      // Return a placeholder message
      return successResult(message);
    } catch (error) {
      return this.handleError(error, MemoryErrorCode.CREATION_FAILED, {
        operation: 'addMessage',
        chatId: typeof chatId === 'string' ? chatId : chatId.toString()
      });
    }
  }
} 