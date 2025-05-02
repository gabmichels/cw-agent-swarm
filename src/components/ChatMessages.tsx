import React, { useEffect, useRef } from 'react';
import { Message, FileAttachment } from '../types';
import ChatBubble from './ChatBubble';
import { filterChatVisibleMessages, isInternalMessage } from '../utils/messageFilters';
import { MessageType } from '../constants/message';

interface ChatMessagesProps {
  messages: Message[];
  isLoading?: boolean;
  onImageClick: (attachment: FileAttachment, e: React.MouseEvent) => void;
  showInternalMessages?: boolean; // Dev mode flag to show internal messages
}

const ChatMessages: React.FC<ChatMessagesProps> = ({ 
  messages, 
  isLoading = false, 
  onImageClick,
  showInternalMessages = false
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Debug logging
  useEffect(() => {
    console.debug(
      `ChatMessages received ${messages?.length || 0} messages, ` +
      `showInternal=${showInternalMessages}`
    );
  }, [messages, showInternalMessages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Enhanced filtering logic to better handle internal messages
  const visibleMessages = React.useMemo(() => {
    if (!messages || !Array.isArray(messages)) {
      return [];
    }
    
    // In dev mode with showInternalMessages enabled, show all messages
    if (showInternalMessages) {
      return messages;
    }
    
    // Otherwise apply strict filtering
    return messages.filter(message => {
      // Check for isInternalMessage flag
      if (message.isInternalMessage === true) {
        return false;
      }
      
      // Check if message has a reflection or thought message type
      if (message.messageType) {
        // These message types should not be visible in chat UI
        const internalTypes = [
          MessageType.THOUGHT,
          MessageType.REFLECTION,
          MessageType.SYSTEM,
          MessageType.TOOL_LOG,
          MessageType.MEMORY_LOG
        ];
        
        if (internalTypes.includes(message.messageType)) {
          return false;
        }
      }
      
      // Check message content for internal message markers
      const rawContent = message.content || '';
      const messageText = typeof rawContent === 'string' ? rawContent.toLowerCase() : '';
      
      // Filter out based on content patterns
      if (
        // Timestamp patterns often indicate internal messages
        messageText.startsWith('[20') || 
        // Common thought patterns
        messageText.startsWith('thought:') ||
        messageText.startsWith('reflection:') ||
        messageText.startsWith('thinking:') ||
        messageText.startsWith('message:') ||
        messageText.startsWith('processing message:') ||
        // More reflection patterns
        messageText.startsWith('reflection on') ||
        // Important thought patterns
        messageText.startsWith('!important! thought:') ||
        messageText.startsWith('!important!') ||
        // System messages
        messageText.includes('performance review:') ||
        messageText.includes('success rate:') ||
        messageText.includes('task completion:') ||
        // Filter markdown content
        messageText.startsWith('# ')
      ) {
        return false;
      }
      
      // Check for metadata indicating markdown source
      if (message.metadata) {
        if (
          message.metadata.source === 'file' || 
          message.metadata.filePath || 
          message.metadata.isKnowledge
        ) {
          return false;
        }
      }
      
      // Check for sender patterns indicating internal messages
      if (message.sender) {
        const senderLower = message.sender.toLowerCase();
        const internalSenders = ['system', 'internal', 'thought', 'reflection'];
        
        if (internalSenders.includes(senderLower)) {
          return false;
        }
      }
      
      // Use the existing filter util as a backup
      return !isInternalMessage(message);
    });
  }, [messages, showInternalMessages]);

  // Make sure we have valid messages to display
  if (!visibleMessages || !Array.isArray(visibleMessages) || visibleMessages.length === 0) {
    return (
      <div className="space-y-12">
        {isLoading ? (
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
        ) : (
          <div className="flex justify-start mb-4">
            <div className="min-w-[75%] max-w-[80%] rounded-lg p-3 shadow bg-gray-700">
              <p className="text-gray-300">No messages yet. Start your conversation to see messages appear here.</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {/* Debug info - only show in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="text-xs text-gray-500 mb-2 p-2 border border-gray-700 rounded">
          Showing {visibleMessages.length} of {messages?.length || 0} messages (Dev)
        </div>
      )}
    
      {visibleMessages.map((message, index) => (
        <ChatBubble 
          key={`msg-${index}-${message.timestamp?.getTime() || index}`}
          message={message}
          onImageClick={onImageClick}
          isInternalMessage={message.isInternalMessage || false}
        />
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
      
      {/* Scroll anchor div - always place at the end of messages */}
      <div ref={messagesEndRef} className="h-1" />
    </div>
  );
};

export default ChatMessages; 