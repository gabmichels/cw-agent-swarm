/**
 * Conversation Manager
 * 
 * This module provides functionality for managing persistent conversations between agents and users.
 */

import { ChatMemoryEntity, ChatParticipant, ChatParticipantRole, ChatPermission, ChatStatus } from "../../schema/chat";
import { StructuredId, IdGenerator } from "../../../../utils/ulid";
import { ChatMemoryService, MessageQueryOptions } from "../chat-memory-service";
import { IMemoryRepository } from "../base/types";
import { Result, failureResult, successResult } from "../../../../lib/errors/base";
import { AppError } from "../../../../lib/errors/base";

/**
 * Message format for conversation
 */
export interface Message {
  id: string;
  content: string;
  senderId: string;
  senderType: "user" | "agent";
  timestamp: Date;
  metadata?: Record<string, unknown>;
  threadId?: string;
  replyToId?: string;
}

/**
 * Conversation creation options
 */
export interface ConversationOptions {
  name: string;
  description?: string;
  purpose?: string;
  initialParticipants?: ChatParticipant[];
  visibility?: "public" | "private" | "restricted";
  enableBranching?: boolean;
  recordTranscript?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Conversation manager for handling chat persistence
 */
export class ConversationManager {
  private chatService: ChatMemoryService;
  private messageStore: Map<string, Message[]> = new Map();
  
  /**
   * Create a new conversation manager
   * @param chatRepository Repository for chat storage
   */
  constructor(chatRepository: IMemoryRepository<ChatMemoryEntity>) {
    this.chatService = new ChatMemoryService(chatRepository);
  }
  
  /**
   * Create a new conversation
   * @param options Conversation options
   * @param createdBy The creator's ID
   * @returns Result containing the created conversation or error
   */
  async createConversation(
    options: ConversationOptions,
    createdBy: string = "system"
  ): Promise<Result<ChatMemoryEntity>> {
    // Generate unique chat ID
    const chatId = IdGenerator.generate("chat");
    
    // Prepare timestamp for participants
    const now = new Date();
    
    // Prepare owner participant if not already in initial participants
    let initialParticipants = options.initialParticipants || [];
    if (!initialParticipants.some(p => p.id === createdBy)) {
      initialParticipants = [
        {
          id: createdBy,
          type: "user",
          role: ChatParticipantRole.OWNER,
          joinedAt: now,
          lastActiveAt: now,
          permissions: [
            ChatPermission.READ,
            ChatPermission.WRITE,
            ChatPermission.INVITE,
            ChatPermission.REMOVE,
            ChatPermission.MANAGE
          ]
        },
        ...initialParticipants
      ];
    }
    
    // Prepare chat data
    const chatData: Omit<ChatMemoryEntity, "id" | "createdAt" | "updatedAt" | "schemaVersion"> = {
      name: options.name,
      description: options.description || "",
      purpose: options.purpose || options.description || options.name,
      createdBy,
      participants: initialParticipants,
      settings: {
        visibility: options.visibility || "private",
        allowAnonymousMessages: false,
        enableBranching: options.enableBranching || false,
        recordTranscript: options.recordTranscript !== undefined ? options.recordTranscript : true
      },
      status: ChatStatus.ACTIVE,
      lastMessageAt: now,
      messageCount: 0,
      contextIds: [],
      content: options.purpose || options.description || options.name,
      type: "chat",
      metadata: {
        tags: [],
        category: [],
        priority: "medium",
        sensitivity: "internal",
        language: ["en"],
        version: "1.0.0",
        ...(options.metadata || {})
      }
    };
    
    // Create the conversation
    const result = await this.chatService.create(chatData);
    
    // Initialize message store for this conversation
    if (result.data) {
      this.messageStore.set(result.data.id.toString(), []);
    }
    
    return result;
  }
  
  /**
   * Add a message to a conversation
   * @param chatId The chat ID
   * @param message The message to add
   * @returns Result containing the added message
   */
  async addMessage(
    chatId: StructuredId | string,
    message: Omit<Message, "id" | "timestamp">
  ): Promise<Result<Message>> {
    try {
      // Generate message ID
      const messageId = IdGenerator.generate("msg").toString();
      const timestamp = new Date();
      
      // Create full message
      const fullMessage: Message = {
        id: messageId,
        content: message.content,
        senderId: message.senderId,
        senderType: message.senderType,
        timestamp,
        metadata: message.metadata || {},
        threadId: message.threadId,
        replyToId: message.replyToId
      };
      
      // Add to message store
      const chatIdStr = typeof chatId === "string" ? chatId : chatId.toString();
      const messages = this.messageStore.get(chatIdStr) || [];
      messages.push(fullMessage);
      this.messageStore.set(chatIdStr, messages);
      
      // Update chat in database
      await this.chatService.addMessage(chatId, fullMessage);
      
      // Update participant's last active time
      await this.updateParticipantActivity(chatId, message.senderId);
      
      return successResult(fullMessage);
    } catch (error) {
      return failureResult(new AppError(
        `Failed to add message to chat ${typeof chatId === "string" ? chatId : chatId.toString()}`,
        "MESSAGE_ADD_FAILED",
        { chatId, error }
      ));
    }
  }
  
  /**
   * Get messages from a conversation
   * @param chatId The chat ID
   * @param options Query options
   * @returns Result containing array of messages
   */
  async getMessages(
    chatId: StructuredId | string,
    options: MessageQueryOptions = {}
  ): Promise<Result<Message[]>> {
    try {
      const chatIdStr = typeof chatId === "string" ? chatId : chatId.toString();
      let messages = this.messageStore.get(chatIdStr) || [];
      
      // Apply filtering
      if (options.fromDate) {
        messages = messages.filter(m => m.timestamp >= options.fromDate!);
      }
      
      if (options.toDate) {
        messages = messages.filter(m => m.timestamp <= options.toDate!);
      }
      
      if (options.senderId) {
        messages = messages.filter(m => m.senderId === options.senderId);
      }
      
      // Apply sorting
      if (options.sortDirection === "asc") {
        messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      } else {
        messages.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      }
      
      // Apply pagination
      if (options.offset || options.limit) {
        const offset = options.offset || 0;
        const limit = options.limit || messages.length;
        messages = messages.slice(offset, offset + limit);
      }
      
      // Handle threaded view
      if (options.threadedView && messages.length > 0) {
        const threadMap = new Map<string, Message[]>();
        
        // Group by thread
        messages.forEach(message => {
          const threadId = message.threadId || message.id;
          if (!threadMap.has(threadId)) {
            threadMap.set(threadId, []);
          }
          threadMap.get(threadId)!.push(message);
        });
        
        // Sort threads by most recent activity
        const sortedThreads = Array.from(threadMap.entries())
          .sort(([, a], [, b]) => {
            const aLatest = Math.max(...a.map(m => m.timestamp.getTime()));
            const bLatest = Math.max(...b.map(m => m.timestamp.getTime()));
            return bLatest - aLatest;
          });
        
        // Flatten while preserving thread grouping
        messages = sortedThreads.flatMap(([, msgs]) => 
          msgs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
        );
      }
      
      // Remove metadata if not requested
      if (!options.includeMetadata) {
        messages = messages.map(m => ({
          ...m,
          metadata: undefined
        }));
      }
      
      return successResult(messages);
    } catch (error) {
      return failureResult(new AppError(
        `Failed to retrieve messages from chat ${typeof chatId === "string" ? chatId : chatId.toString()}`,
        "MESSAGE_RETRIEVAL_FAILED",
        { chatId, options, error }
      ));
    }
  }
  
  /**
   * Get a specific message by ID
   * @param chatId The chat ID
   * @param messageId The message ID
   * @returns Result containing the message or null if not found
   */
  async getMessageById(
    chatId: StructuredId | string,
    messageId: string
  ): Promise<Result<Message | null>> {
    try {
      const chatIdStr = typeof chatId === "string" ? chatId : chatId.toString();
      const messages = this.messageStore.get(chatIdStr) || [];
      const message = messages.find(m => m.id === messageId);
      
      return successResult(message || null);
    } catch (error) {
      return failureResult(new AppError(
        `Failed to retrieve message ${messageId} from chat ${typeof chatId === "string" ? chatId : chatId.toString()}`,
        "MESSAGE_RETRIEVAL_FAILED",
        { chatId, messageId, error }
      ));
    }
  }
  
  /**
   * Create a new thread in a conversation
   * @param chatId The chat ID
   * @param subject Subject or title for the thread
   * @param initialMessage Initial message for the thread
   * @returns Result containing the thread's first message
   */
  async createThread(
    chatId: StructuredId | string,
    subject: string,
    initialMessage: Omit<Message, "id" | "timestamp" | "threadId">
  ): Promise<Result<Message>> {
    try {
      // Check if chat allows branching/threading
      const chatResult = await this.chatService.getById(chatId);
      
      if (chatResult.error || !chatResult.data) {
        return failureResult(new AppError(
          `Chat ${typeof chatId === "string" ? chatId : chatId.toString()} not found`,
          "CHAT_NOT_FOUND",
          { chatId }
        ));
      }
      
      const chat = chatResult.data;
      
      if (!chat.settings.enableBranching) {
        return failureResult(new AppError(
          `Chat ${typeof chatId === "string" ? chatId : chatId.toString()} does not allow branching/threading`,
          "THREADING_NOT_ENABLED",
          { chatId }
        ));
      }
      
      // Generate thread ID
      const threadId = IdGenerator.generate("thrd").toString();
      
      // Add initial message with thread ID and subject in metadata
      return await this.addMessage(chatId, {
        ...initialMessage,
        threadId,
        metadata: {
          ...(initialMessage.metadata || {}),
          subject,
          isThreadStart: true
        }
      });
    } catch (error) {
      return failureResult(new AppError(
        `Failed to create thread in chat ${typeof chatId === "string" ? chatId : chatId.toString()}`,
        "THREAD_CREATION_FAILED",
        { chatId, subject, error }
      ));
    }
  }
  
  /**
   * Reply to a specific message
   * @param chatId The chat ID
   * @param replyToId The message being replied to
   * @param message The reply message
   * @returns Result containing the reply message
   */
  async replyToMessage(
    chatId: StructuredId | string,
    replyToId: string,
    message: Omit<Message, "id" | "timestamp" | "replyToId">
  ): Promise<Result<Message>> {
    try {
      // Get original message to determine thread ID
      const originalMsgResult = await this.getMessageById(chatId, replyToId);
      
      if (originalMsgResult.error) {
        return originalMsgResult as Result<Message>;
      }
      
      const originalMessage = originalMsgResult.data;
      
      if (!originalMessage) {
        return failureResult(new AppError(
          `Message ${replyToId} not found in chat ${typeof chatId === "string" ? chatId : chatId.toString()}`,
          "MESSAGE_NOT_FOUND",
          { chatId, messageId: replyToId }
        ));
      }
      
      // Use original message's thread ID or its own ID as thread ID
      const threadId = originalMessage.threadId || originalMessage.id;
      
      // Add reply
      return await this.addMessage(chatId, {
        ...message,
        threadId,
        replyToId
      });
    } catch (error) {
      return failureResult(new AppError(
        `Failed to reply to message ${replyToId} in chat ${typeof chatId === "string" ? chatId : chatId.toString()}`,
        "REPLY_FAILED",
        { chatId, replyToId, error }
      ));
    }
  }
  
  /**
   * Update a participant's last active timestamp
   * @param chatId The chat ID
   * @param participantId The participant ID
   * @returns Result indicating success or failure
   */
  private async updateParticipantActivity(
    chatId: StructuredId | string,
    participantId: string
  ): Promise<Result<boolean>> {
    try {
      // Get the chat
      const chatResult = await this.chatService.getById(chatId);
      
      if (chatResult.error || !chatResult.data) {
        return failureResult(new AppError(
          `Chat ${typeof chatId === "string" ? chatId : chatId.toString()} not found`,
          "CHAT_NOT_FOUND",
          { chatId }
        ));
      }
      
      const chat = chatResult.data;
      
      // Find the participant
      const participants = chat.participants || [];
      const participantIndex = participants.findIndex(p => p.id === participantId);
      
      if (participantIndex === -1) {
        return failureResult(new AppError(
          `Participant ${participantId} not found in chat ${typeof chatId === "string" ? chatId : chatId.toString()}`,
          "PARTICIPANT_NOT_FOUND",
          { chatId, participantId }
        ));
      }
      
      // Update the participant's last active time
      const now = new Date();
      const updatedParticipants = [...participants];
      updatedParticipants[participantIndex] = {
        ...updatedParticipants[participantIndex],
        lastActiveAt: now
      };
      
      // Update the chat
      await this.chatService.update(chatId, {
        participants: updatedParticipants
      });
      
      return successResult(true);
    } catch (error) {
      return failureResult(new AppError(
        `Failed to update participant activity`,
        "UPDATE_PARTICIPANT_FAILED",
        { chatId, participantId, error }
      ));
    }
  }
  
  /**
   * Export conversation history
   * @param chatId The chat ID
   * @returns Result containing exported conversation data
   */
  async exportConversation(
    chatId: StructuredId | string
  ): Promise<Result<{
    chat: ChatMemoryEntity,
    messages: Message[]
  }>> {
    try {
      // Get the chat
      const chatResult = await this.chatService.getById(chatId);
      
      if (chatResult.error || !chatResult.data) {
        return failureResult(new AppError(
          `Chat ${typeof chatId === "string" ? chatId : chatId.toString()} not found`,
          "CHAT_NOT_FOUND",
          { chatId }
        ));
      }
      
      // Get all messages
      const messagesResult = await this.getMessages(chatId, {
        sortDirection: "asc",
        includeMetadata: true
      });
      
      if (messagesResult.error) {
        return failureResult(messagesResult.error);
      }
      
      // Ensure we have messages array (even if empty)
      const messages = messagesResult.data || [];
      
      return successResult({
        chat: chatResult.data,
        messages
      });
    } catch (error) {
      return failureResult(new AppError(
        `Failed to export conversation`,
        "EXPORT_FAILED",
        { chatId, error }
      ));
    }
  }
} 