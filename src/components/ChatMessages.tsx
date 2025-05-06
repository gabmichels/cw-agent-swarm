import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { Message, FileAttachment } from '../types';
import ChatBubble from './ChatBubble';

// Simplified Message interface
interface MessageWithId extends Message {
  id?: string;
}

interface ChatMessagesProps {
  messages: MessageWithId[];
  isLoading?: boolean;
  onImageClick: (attachment: FileAttachment, e: React.MouseEvent) => void;
  onDeleteMessage?: (messageId: string) => Promise<boolean>;
  showInternalMessages?: boolean;
  pageSize?: number;
  preloadCount?: number;
  searchQuery?: string;
  initialMessageId?: string;
}

const ChatMessages: React.FC<ChatMessagesProps> = ({ 
  messages, 
  isLoading = false, 
  onImageClick,
  onDeleteMessage,
  showInternalMessages = false,
  pageSize = 20,
  preloadCount = 10,
  searchQuery = '',
  initialMessageId = ''
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  
  // Log the raw messages received for debugging
  useEffect(() => {
    console.log('ChatMessages received raw messages:', messages.length, messages);
  }, [messages]);
  
  // Simplified message processing - just sort by timestamp
  const sortedMessages = useMemo(() => {
    if (!messages || !Array.isArray(messages)) {
      console.warn('Messages is not an array or is empty:', messages);
      return [];
    }
    
    console.log('Processing messages for display, count:', messages.length);
    
    // Create a copy of messages to avoid mutating props
    let sortedMessages = [...messages];
    
    // Ensure all messages have valid timestamps
    sortedMessages = sortedMessages.map((message, index) => {
      let timestamp = message.timestamp;
      
      // Convert string timestamps to Date objects
      if (typeof timestamp === 'string') {
        timestamp = new Date(timestamp);
      }
      
      // Handle invalid dates by using current time
      if (!timestamp || !(timestamp instanceof Date) || isNaN(timestamp.getTime())) {
        console.warn(`Message at index ${index} has invalid timestamp:`, message.timestamp);
        timestamp = new Date();
      }
      
      return {
        ...message,
        timestamp
      };
    });
    
    // Sort messages by timestamp (oldest first)
    sortedMessages.sort((a, b) => {
      // Get timestamp values safely
      const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : 0;
      const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : 0;
      
      // Primary sort by timestamp
      if (timeA !== timeB) {
        return timeA - timeB;
      }
      
      // Secondary sort by ID for consistency when timestamps are equal
      const idA = a.id || '';
      const idB = b.id || '';
      return idA.localeCompare(idB);
    });
    
    console.log('Processed and sorted messages for display:', sortedMessages.length);
    
    // Debug: Log all message IDs
    sortedMessages.forEach((msg, idx) => {
      console.log(`Message ${idx + 1}/${sortedMessages.length}: ID=${msg.id}, timestamp=${msg.timestamp}, sender=${msg.sender}`);
    });
    
    return sortedMessages;
  }, [messages]);

  // Scroll to bottom function
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior });
        
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
      }
    }, 100);
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messagesContainerRef.current) {
      scrollToBottom();
    }
  }, [sortedMessages.length, scrollToBottom]);

  // Handle deleting a message - takes timestamp but uses ID for deletion
  const handleDeleteMessage = async (timestamp: Date): Promise<boolean> => {
    try {
      // Find the message by timestamp, but we'll use the ID for deletion
      const targetMessage = sortedMessages.find(
        msg => msg.timestamp && msg.timestamp.getTime() === timestamp.getTime()
      );
      
      if (!targetMessage) {
        console.error('No message found with timestamp:', timestamp);
        return false;
      }
      
      // Only proceed if the message has an ID
      if (!targetMessage.id) {
        console.error('Cannot delete message: no message ID available');
        return false;
      }
      
      console.log(`Found message with ID: ${targetMessage.id} for timestamp: ${timestamp.toISOString()}`);
      
      // Use the onDeleteMessage prop to delete by ID
      if (onDeleteMessage) {
        const result = await onDeleteMessage(targetMessage.id);
        console.log(`Deletion result for message ID ${targetMessage.id}:`, result);
        return result;
      }
      
      // No deletion handler provided
      console.error('No deletion handler provided');
      return false;
    } catch (error) {
      console.error('Error in handleDeleteMessage:', error);
      return false;
    }
  };

  // Watch for deletion events to refresh the UI
  useEffect(() => {
    const handleMessageDeleted = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.id) {
        console.log('Message deleted event detected for ID:', customEvent.detail.id);
      }
    };

    document.addEventListener('messageDeleted', handleMessageDeleted);
    return () => {
      document.removeEventListener('messageDeleted', handleMessageDeleted);
    };
  }, []);

  // Add effect to check if specific message (by ID) is present
  useEffect(() => {
    if (initialMessageId && sortedMessages.length > 0) {
      const foundMessage = sortedMessages.find(msg => msg.id === initialMessageId);
      if (foundMessage) {
        console.log(`Found requested message with ID: ${initialMessageId}`);
      } else {
        console.warn(`Message with ID ${initialMessageId} not found in the displayed messages`);
        console.log('Available message IDs:', sortedMessages.map(msg => msg.id));
      }
    }
  }, [initialMessageId, sortedMessages]);

  return (
    <div 
      ref={messagesContainerRef} 
      className="overflow-y-auto h-full space-y-4 pr-0 pl-4 pt-4 pb-4"
      role="log"
      aria-live="polite"
      style={{ 
        minHeight: '300px', 
        height: '100%',
        overflowY: 'auto',
        scrollbarWidth: 'thin',
        scrollbarColor: '#4a5568 #1a202c'
      }}
    >
      <style jsx>{`
        div {
          /* Webkit browsers like Chrome, Safari */
          &::-webkit-scrollbar {
            width: 8px;
          }
          &::-webkit-scrollbar-track {
            background: #1a202c;
          }
          &::-webkit-scrollbar-thumb {
            background-color: #4a5568;
            border-radius: 4px;
          }
          &::-webkit-scrollbar-thumb:hover {
            background-color: #718096;
          }
          
          /* Firefox */
          scrollbar-width: thin;
          scrollbar-color: #4a5568 #1a202c;
        }
      `}</style>
      
      {/* Debug info */}
      <div className="text-xs text-gray-500 mb-4 p-3 border border-gray-700 rounded bg-gray-800">
        <p className="font-bold mb-1">Debug Information:</p>
        <p>Displaying {sortedMessages.length} of {messages.length} messages</p>
        {initialMessageId && (
          <p>Looking for message ID: {initialMessageId} - 
            {sortedMessages.some(msg => msg.id === initialMessageId) ? ' Found!' : ' Not found'}
          </p>
        )}
        <p className="mt-1 mb-1">Message IDs:</p>
        <div className="max-h-20 overflow-y-auto">
          {sortedMessages.map((msg, idx) => (
            <div key={idx} className="flex items-center">
              <span className="mr-1">{idx + 1}.</span>
              <span className={initialMessageId === msg.id ? 'text-green-400 font-bold' : ''}>{msg.id}</span>
            </div>
          ))}
        </div>
      </div>
    
      {sortedMessages.map((message, index) => {
        // Generate a unique ID for this message if it doesn't have one
        const messageId = message.id || `msg_${index}_${Date.now()}`;
        
        return (
          <ChatBubble
            key={messageId}
            message={message}
            onImageClick={onImageClick}
            onDeleteMessage={handleDeleteMessage}
            data-message-id={messageId}
          />
        );
      })}
      
      {/* Loading indicator */}
      {isLoading && (
        <div className="flex justify-start mb-4">
          <div className="min-w-[75%] max-w-[80%] rounded-lg p-3 shadow bg-gray-700">
            <div className="flex items-center">
              <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"></div>
              <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce ml-1" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce ml-1" style={{ animationDelay: '0.4s' }}></div>
              <span className="ml-2 text-sm text-gray-300">Thinking...</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Scroll anchor div */}
      <div ref={messagesEndRef} className="h-1" />
    </div>
  );
};

export default ChatMessages; 