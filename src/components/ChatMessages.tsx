import React, { useEffect, useRef } from 'react';
import { Message, FileAttachment } from '../types';
import ChatBubble from './ChatBubble';
import { filterChatVisibleMessages } from '../utils/messageFilters';

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

  // Filter messages to only show those appropriate for the chat UI
  const visibleMessages = showInternalMessages ? messages : filterChatVisibleMessages(messages || []);

  // Make sure we have valid messages to display
  if (!visibleMessages || !Array.isArray(visibleMessages) || visibleMessages.length === 0) {
    return (
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex justify-start mb-4">
            <div className="max-w-[75%] rounded-lg p-3 shadow bg-gray-700">
              <div className="flex items-center">
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"></div>
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce ml-1" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce ml-1" style={{ animationDelay: '0.4s' }}></div>
                <span className="ml-2 text-sm text-gray-300">Thinking...</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex justify-start">
            <div className="max-w-[75%] rounded-lg p-3 shadow bg-gray-700">
              <div className="text-gray-300">Start a conversation with Chloe...</div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} className="h-1" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
          <div className="max-w-[75%] rounded-lg p-3 shadow bg-gray-700">
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