import { useState, useCallback, useEffect } from 'react';
import { MemoryType } from '../server/memory/config';
import useMemory from './useMemory';
import { Message } from '../types';
import { MessageType } from '../constants/message';

/**
 * Parameters for the useChatMemory hook
 */
interface UseChatMemoryParams {
  userId: string;
  limit?: number;
  includeInternalMessages?: boolean;
}

/**
 * A specialized hook for chat-related memory operations
 * Provides functions for retrieving and managing chat history
 */
export default function useChatMemory({
  userId,
  limit = 50,
  includeInternalMessages = false
}: UseChatMemoryParams) {
  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState<Error | null>(null);
  
  // Use the base memory hook for operations
  const { searchMemories, addMemory, deleteMemory } = useMemory([MemoryType.MESSAGE]);
  
  /**
   * Load the chat history for a user
   */
  const loadChatHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    setHistoryError(null);
    
    try {
      // Fetch message memories with user ID filter
      const filter: any = {
        must: [
          {
            key: 'metadata.userId',
            match: { value: userId }
          }
        ]
      };
      
      // If we're excluding internal messages, add that filter
      if (!includeInternalMessages) {
        filter.must.push({
          key: 'metadata.isInternalMessage',
          match: { exists: false }
        });
        
        // Also add check for when the field exists but is false
        filter.must.push({
          key: 'metadata.isInternalMessage',
          match: { value: "false" }
        });
      }
      
      // Search with empty string to get all messages for this user
      const memories = await searchMemories({
        query: '',
        types: [MemoryType.MESSAGE],
        limit,
        // Search options to get chronological order
        hybridRatio: 0 // Use text search only (no vector similarity)
      });
      
      // Convert memories to Message objects
      const messages: Message[] = memories.map((memory: {
        id: string;
        payload: {
          text: string;
          timestamp: string;
          metadata?: {
            role?: string;
            isInternalMessage?: boolean;
            [key: string]: any;
          };
        };
      }) => ({
        id: memory.id,
        sender: memory.payload.metadata?.role === 'user' ? 'You' : 'Assistant',
        content: memory.payload.text,
        timestamp: new Date(memory.payload.timestamp),
        messageType: memory.payload.metadata?.role === 'user' 
          ? MessageType.USER 
          : MessageType.AGENT,
        metadata: memory.payload.metadata
      }));
      
      // Sort messages by timestamp
      messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      
      setChatHistory(messages);
    } catch (error) {
      console.error('Error loading chat history:', error);
      setHistoryError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsLoadingHistory(false);
    }
  }, [userId, limit, includeInternalMessages, searchMemories]);
  
  /**
   * Add a new message to chat history
   */
  const addChatMessage = useCallback(async (message: Message) => {
    try {
      // Determine role from message type or sender
      const role = message.messageType === MessageType.USER || message.sender === 'You' 
        ? 'user' 
        : 'assistant';
      
      // Add memory using standardized API
      const result = await addMemory({
        type: MemoryType.MESSAGE,
        content: message.content,
        metadata: {
          role,
          userId,
          timestamp: message.timestamp.toISOString(),
          isInternalMessage: message.isInternalMessage || false,
          messageType: message.messageType,
          ...(message.metadata || {})
        }
      });
      
      // Update local state with the new message that includes server-generated ID
      if (result && result.id) {
        setChatHistory(prev => [
          ...prev, 
          { ...message, id: result.id }
        ]);
      }
      
      return result;
    } catch (error) {
      console.error('Error adding chat message:', error);
      throw error;
    }
  }, [userId, addMemory]);
  
  /**
   * Delete a message from chat history
   */
  const deleteChatMessage = useCallback(async (messageId: string) => {
    try {
      await deleteMemory({
        id: messageId,
        type: MemoryType.MESSAGE
      });
      
      // Update local state by removing the deleted message
      setChatHistory(prev => prev.filter(msg => msg.id !== messageId));
      return true;
    } catch (error) {
      console.error('Error deleting chat message:', error);
      throw error;
    }
  }, [deleteMemory]);
  
  // Load chat history on component mount or when dependencies change
  useEffect(() => {
    loadChatHistory();
  }, [loadChatHistory]);
  
  return {
    chatHistory,
    isLoadingHistory,
    historyError,
    loadChatHistory,
    addChatMessage,
    deleteChatMessage
  };
} 