/**
 * Chat Memory Service Example
 * 
 * This is an example implementation of the BaseMemoryService for chat memory.
 * It demonstrates how to create a type-safe service with additional domain-specific methods.
 */

import { Result, successResult } from '../../../../../lib/errors/base';
import { BaseMemoryService, MemoryErrorCode } from '../service';
import { ChatMemoryEntity } from './chat-memory-repository';
import { IMemoryRepository } from '../types';
import { StructuredId } from '../../../../../utils/ulid';

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
   * Get chat history by chat ID
   */
  async getChatHistory(chatId: string): Promise<Result<ChatMemoryEntity[]>> {
    try {
      // The actual implementation would use a properly typed filter
      // This is a simplified version for the example
      return successResult([]);
    } catch (error) {
      return this.handleError(error, MemoryErrorCode.SEARCH_FAILED, {
        operation: 'getChatHistory',
        chatId
      });
    }
  }

  /**
   * Get the latest message in a chat
   */
  async getLatestMessage(chatId: string): Promise<Result<ChatMemoryEntity | null>> {
    try {
      // The actual implementation would use a properly typed filter with sorting
      // This is a simplified version for the example
      return successResult(null);
    } catch (error) {
      return this.handleError(error, MemoryErrorCode.SEARCH_FAILED, {
        operation: 'getLatestMessage',
        chatId
      });
    }
  }

  /**
   * Add a message to chat history
   */
  async addChatMessage(
    chatId: string,
    content: string,
    role: 'user' | 'assistant' | 'system',
    messageId?: string
  ): Promise<Result<ChatMemoryEntity>> {
    try {
      // Create new message
      const message = await this.repository.create({
        content,
        type: 'chat',
        metadata: {
          chatId,
          messageId,
          role
        }
      });
      
      return successResult(message);
    } catch (error) {
      return this.handleError(error, MemoryErrorCode.CREATION_FAILED, {
        operation: 'addChatMessage',
        chatId,
        role
      });
    }
  }

  /**
   * Mark a message as important
   */
  async markAsImportant(messageId: string | StructuredId): Promise<Result<boolean>> {
    try {
      // First get the existing message to preserve required fields
      const existingMessage = await this.repository.getById(messageId);
      if (!existingMessage) {
        return successResult(false);
      }
      
      // Update message with all required fields
      const message = await this.repository.update(messageId, {
        metadata: {
          ...existingMessage.metadata,
          isImportant: true
        }
      });
      
      return successResult(!!message);
    } catch (error) {
      return this.handleError(error, MemoryErrorCode.UPDATE_FAILED, {
        operation: 'markAsImportant',
        messageId: typeof messageId === 'string' ? messageId : messageId.toString()
      });
    }
  }

  /**
   * Add tags to a message
   */
  async addTags(messageId: string | StructuredId, tags: string[]): Promise<Result<boolean>> {
    try {
      // Get existing message
      const existingMessage = await this.repository.getById(messageId);
      if (!existingMessage) {
        return successResult(false);
      }
      
      // Get existing tags and merge with new tags (deduplicate)
      const existingTags = existingMessage.metadata.tags || [];
      
      // Combine and deduplicate tags without using Set spread
      const tagSet = new Set<string>();
      existingTags.forEach(tag => tagSet.add(tag));
      tags.forEach(tag => tagSet.add(tag));
      const uniqueTags = Array.from(tagSet);
      
      // Update message with all required fields
      const message = await this.repository.update(messageId, {
        metadata: {
          ...existingMessage.metadata,
          tags: uniqueTags
        }
      });
      
      return successResult(!!message);
    } catch (error) {
      return this.handleError(error, MemoryErrorCode.UPDATE_FAILED, {
        operation: 'addTags',
        messageId: typeof messageId === 'string' ? messageId : messageId.toString(),
        tags
      });
    }
  }
} 