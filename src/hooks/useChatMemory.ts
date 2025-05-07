import { useState, useCallback, useEffect, useMemo } from 'react';
import { MemoryType } from '../server/memory/config';
import useMemory from './useMemory';
import { Message } from '../types';
import { MessageType } from '../constants/message';
import { generateChatId } from '../utils/uuid';

/**
 * Parameters for the useChatMemory hook
 */
interface UseChatMemoryParams {
  userId: string;
  chatId?: string; // Optional chat ID, if not provided will use default for the user
  limit?: number;
  includeInternalMessages?: boolean;
}

/**
 * A specialized hook for chat-related memory operations
 * Provides functions for retrieving and managing chat history
 */
export default function useChatMemory({
  userId,
  chatId = "chat-chloe-gab", // Default to our hardcoded chatId
  limit = 100,
  includeInternalMessages = false
}: UseChatMemoryParams) {
  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState<Error | null>(null);
  
  // Use the base memory hook for operations
  const { searchMemories, addMemory, deleteMemory } = useMemory([MemoryType.MESSAGE]);
  
  // Calculate default chatId if not provided explicitly
  const defaultChatId = useMemo(() => generateChatId(userId), [userId]);
  const effectiveChatId = chatId || defaultChatId;
  
  /**
   * Load the chat history for a user
   */
  const loadChatHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    setHistoryError(null);
    
    try {
      console.log(`Loading chat history for user ${userId} in chat ${effectiveChatId} with limit ${limit}`);
      
      // Search with empty string to get all messages for this user
      // Don't set any complex filters - just get all messages and filter client-side
      const memories = await searchMemories({
        query: '',
        types: [MemoryType.MESSAGE],
        limit: limit,
        hybridRatio: 0
      });
      
      console.log(`Retrieved ${memories.length} raw memory items before filtering`);
      
      // Log a few sample messages to help diagnose filtering issues
      if (memories.length > 0) {
        console.log('Sample memory format:', JSON.stringify(memories[0], null, 2).substring(0, 500) + '...');
      }
      
      // Filter messages client-side for this user and chat
      const filteredMemories = memories.filter((memory: any) => {
        // Get metadata
        const metadata = memory.payload?.metadata || {};
        
        // For debugging: Log the memory we're filtering
        console.log('Filtering memory:', {
          id: memory.id?.substring(0, 8),
          userId: typeof metadata.userId === 'object' ? metadata.userId.id : metadata.userId,
          chatId: typeof metadata.chatId === 'object' ? metadata.chatId.id : metadata.chatId,
          effectiveChatId,
        });
        
        // Match user ID if provided in metadata
        if (metadata.userId) {
          const userIdToMatch = typeof metadata.userId === 'object' ? metadata.userId.id : metadata.userId;
          if (userIdToMatch !== userId && userIdToMatch !== 'gab') {
            return false;
          }
        }
        
        // Match chat ID if we're filtering by a specific chat
        if (effectiveChatId && metadata.chatId) {
          // Handle both string and object formats for chatId
          if (typeof metadata.chatId === 'object' && metadata.chatId !== null) {
            // Handle structured ID format: { namespace: 'chat', type: 'chat', id: 'chat-chloe-gab' }
            return metadata.chatId.id === effectiveChatId;
          } else {
            // Handle string format directly
            return metadata.chatId === effectiveChatId;
          }
        }
        
        // If we got here and there's a chatId filter but no chatId in metadata, exclude the message
        if (effectiveChatId && !metadata.chatId) {
          return false;
        }
        
        // If not showing internal messages, filter them out
        if (!includeInternalMessages && metadata.isInternalMessage === true) {
          return false;
        }
        
        return true;
      });
      
      console.log(`Filtered to ${filteredMemories.length} messages for user ${userId} in chat ${effectiveChatId}`);
      
      // If no messages were found, try a fallback approach with an API call
      if (filteredMemories.length === 0) {
        console.log(`No messages found with client-side filtering, trying API endpoint directly for chat ${effectiveChatId}`);
        try {
          const apiUrl = `/api/chat/history?userId=${encodeURIComponent(userId)}&chatId=${encodeURIComponent(effectiveChatId)}`;
          console.log(`Calling API directly: ${apiUrl}`);
          
          const response = await fetch(apiUrl);
          if (response.ok) {
            const data = await response.json();
            if (data.status === 'success' && data.history && data.history.length > 0) {
              console.log(`API returned ${data.history.length} messages from direct call`);
              // Convert API messages to our format
              const apiMessages = data.history.map((msg: any) => ({
                id: msg.id,
                sender: msg.sender,
                content: msg.content,
                timestamp: new Date(msg.timestamp),
                messageType: msg.sender === 'You' ? MessageType.USER : MessageType.AGENT,
                metadata: msg.metadata || {}
              }));
              
              // Sort and set chat history
              apiMessages.sort((a: any, b: any) => a.timestamp.getTime() - b.timestamp.getTime());
              setChatHistory(apiMessages);
              setIsLoadingHistory(false);
              return; // Exit early since we set the chat history directly
            }
          }
        } catch (err) {
          console.warn('Error with fallback API call:', err);
          // Continue with normal flow if fallback fails
        }
      }
      
      // Convert memories to Message objects
      const messages: Message[] = filteredMemories.map((memory: {
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
      
      console.log(`Final chat history has ${messages.length} messages`);
      setChatHistory(messages);
    } catch (error) {
      console.error('Error loading chat history:', error);
      setHistoryError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsLoadingHistory(false);
    }
  }, [userId, effectiveChatId, limit, includeInternalMessages, searchMemories]);
  
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