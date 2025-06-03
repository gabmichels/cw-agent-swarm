import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { Message, FileAttachment } from '../types';
import ChatBubble from './ChatBubble';

// Type for messages with timestamp
type MessageWithSortTime = Message & {
  timestamp: Date | string | number;
};

interface ChatMessagesProps {
  messages: Message[];
  isLoading?: boolean;
  onImageClick: (attachment: FileAttachment, e: React.MouseEvent) => void;
  onDeleteMessage?: (messageId: string) => Promise<boolean>;
  onReplyToMessage?: (message: Message) => void;
  onNavigateToMessage?: (messageId: string) => void;
  showInternalMessages?: boolean;
  pageSize?: number;
  preloadCount?: number;
  searchQuery?: string;
  initialMessageId?: string;
  highlightedMessageId?: string; // New prop for highlighting messages
}

const ChatMessages: React.FC<ChatMessagesProps> = React.memo(({ 
  messages, 
  isLoading = false, 
  onImageClick,
  onDeleteMessage,
  onReplyToMessage,
  onNavigateToMessage,
  showInternalMessages = false,
  pageSize = 20,
  preloadCount = 10,
  searchQuery = '',
  initialMessageId = '',
  highlightedMessageId = ''
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  
  // Process and sort messages - optimized without console.log
  const sortedMessages = useMemo(() => {
    if (!messages || !Array.isArray(messages)) {
      return [];
    }
    
    // Process messages to ensure consistent sender format
    const processedMessages = messages.map(msg => ({
      ...msg,
      // Ensure sender is consistently an object
      sender: typeof msg.sender === 'string'
        ? { id: msg.sender, name: msg.sender, role: msg.sender === 'You' ? 'user' : 'assistant' as 'user' | 'assistant' | 'system' }
        : msg.sender
    }));

    // Sort messages by timestamp
    processedMessages.sort((a: MessageWithSortTime, b: MessageWithSortTime) => {
      const aTime = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
      const bTime = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
      return aTime - bTime;
    });
    
    return processedMessages;
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

  // Navigate to specific message
  const navigateToMessage = useCallback((messageId: string) => {
    const messageElement = messageRefs.current.get(messageId);
    if (messageElement && messagesContainerRef.current) {
      // Scroll to the message
      messageElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
      
      // Add highlight effect
      messageElement.classList.add('message-highlight');
      
      // Remove highlight after animation
      setTimeout(() => {
        messageElement.classList.remove('message-highlight');
      }, 2000);
      
      // Call the callback if provided
      if (onNavigateToMessage) {
        onNavigateToMessage(messageId);
      }
    }
  }, [onNavigateToMessage]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messagesContainerRef.current) {
      scrollToBottom();
    }
  }, [sortedMessages.length, scrollToBottom]);

  // Handle navigation requests
  useEffect(() => {
    if (highlightedMessageId) {
      navigateToMessage(highlightedMessageId);
    }
  }, [highlightedMessageId, navigateToMessage]);

  // Handle deleting a message - takes timestamp but uses ID for deletion
  const handleDeleteMessage = async (timestamp: Date): Promise<boolean> => {
    try {
      // Find the message by timestamp, but we'll use the ID for deletion
      const targetMessage = sortedMessages.find(
        msg => msg.timestamp && msg.timestamp.getTime() === timestamp.getTime()
      );
      
      if (!targetMessage) {
        return false;
      }
      
      // Only proceed if the message has an ID
      if (!targetMessage.id) {
        return false;
      }
      
      // Use the onDeleteMessage prop to delete by ID if available
      if (onDeleteMessage) {
        try {
          const result = await onDeleteMessage(targetMessage.id);
          return result;
        } catch (error) {
          // Continue even if parent handler fails
        }
      }
      
      // If no handler or handler failed, we'll still consider this successful
      // since the API call in ChatBubbleMenu will handle the actual deletion
      return true;
    } catch (error) {
      return false;
    }
  };

  // Watch for deletion events to refresh the UI
  useEffect(() => {
    const handleMessageDeleted = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.id) {
        // Message deleted, UI will be refreshed by parent component
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
      if (!foundMessage) {
        // Message not found - could log to console in development only
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
        
        .message-highlight {
          animation: messageHighlight 2s ease-in-out;
        }
        
        @keyframes messageHighlight {
          0% { background-color: rgba(59, 130, 246, 0.3); }
          50% { background-color: rgba(59, 130, 246, 0.1); }
          100% { background-color: transparent; }
        }
      `}</style>
    
      {sortedMessages.map((message, index) => (
        <div
          key={message.id || `msg_${index}`}
          ref={(el) => {
            if (el && message.id) {
              messageRefs.current.set(message.id, el);
            }
          }}
          data-message-id={message.id || `msg_${index}`}
        >
          <ChatBubble
            message={message}
            onImageClick={onImageClick}
            onDeleteMessage={handleDeleteMessage}
            onReplyToMessage={onReplyToMessage}
          />
        </div>
      ))}
      
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
      
      {/* Scroll anchor div - reduced height for less bottom spacing */}
      <div ref={messagesEndRef} className="h-1" />
    </div>
  );
});

export default ChatMessages; 