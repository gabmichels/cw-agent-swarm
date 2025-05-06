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
}

const ChatMessages: React.FC<ChatMessagesProps> = ({ 
  messages, 
  isLoading = false, 
  onImageClick,
  onDeleteMessage
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  
  // Simplified message processing - just sort by timestamp
  const sortedMessages = useMemo(() => {
    if (!messages || !Array.isArray(messages)) {
      return [];
    }
    
    console.log('Processing messages for display:', messages.length);
    
    // Create a copy of messages to avoid mutating props
    let sortedMessages = [...messages];
    
    // Ensure all messages have valid timestamps
    sortedMessages = sortedMessages.map(message => {
      let timestamp = message.timestamp;
      
      // Convert string timestamps to Date objects
      if (typeof timestamp === 'string') {
        timestamp = new Date(timestamp);
      }
      
      // Handle invalid dates by using current time
      if (!timestamp || !(timestamp instanceof Date) || isNaN(timestamp.getTime())) {
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
      
      // If timestamps are equal, sort by ID if available to ensure consistent order
      if (timeA === timeB) {
        return (a.id || '') < (b.id || '') ? -1 : 1;
      }
      
      // Sort by time (ascending)
      return timeA - timeB;
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

  // Handle deleting a message
  const handleDeleteMessage = async (timestamp: Date): Promise<boolean> => {
    try {
      // Find the message by timestamp
      const targetMessage = sortedMessages.find(
        msg => msg.timestamp && msg.timestamp.getTime() === timestamp.getTime()
      );
      
      if (!targetMessage) {
        console.error('No message found with timestamp:', timestamp);
        return false;
      }
      
      // If we have an onDeleteMessage prop and message ID, use that
      if (onDeleteMessage && targetMessage.id) {
        return await onDeleteMessage(targetMessage.id);
      }
      
      return false;
    } catch (error) {
      console.error('Error in handleDeleteMessage:', error);
      return false;
    }
  };

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
      
      {/* Debug info - only show in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="text-xs text-gray-500 mb-2 p-2 border border-gray-700 rounded">
          Showing {sortedMessages.length} messages (Dev)
        </div>
      )}
    
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