import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { Message, FileAttachment } from '../types';
import ChatBubble from './ChatBubble';
import { filterChatVisibleMessages, isInternalMessage } from '../utils/messageFilters';
import { MessageType } from '../constants/message';
import { smartSearchMessages } from '../utils/smartSearch';

// Extend Message type for internal use with optional id
interface MessageWithId extends Message {
  id?: string;
  payload?: {
    text?: string;
    type?: string;
    timestamp?: string;
    metadata?: {
      role?: string;
      isForChat?: boolean;
      isInternal?: boolean;
      [key: string]: any;
    };
    [key: string]: any;
  };
  type?: string;
}

interface ChatMessagesProps {
  messages: MessageWithId[];
  isLoading?: boolean;
  onImageClick: (attachment: FileAttachment, e: React.MouseEvent) => void;
  showInternalMessages?: boolean; // Dev mode flag to show internal messages
  searchQuery?: string; // Added search query prop
  initialMessageId?: string; // Allow jumping to a specific message ID
  pageSize?: number; // Number of messages to load at once
  preloadCount?: number; // Number of messages to preload
  onDeleteMessage?: (messageId: string) => Promise<boolean>; // Add callback for deleting messages
}

/**
 * Helper function to determine if a message is a system message (not visible to users)
 */
const isSystemMessage = (messageType: string): boolean => {
  // List of message types that are considered system messages
  const systemMessageTypes = [
    MessageType.THOUGHT,
    MessageType.REFLECTION,
    MessageType.SYSTEM,
    MessageType.TOOL_LOG,
    MessageType.MEMORY_LOG
  ];
  
  return systemMessageTypes.includes(messageType as MessageType);
};

const ChatMessages: React.FC<ChatMessagesProps> = ({ 
  messages, 
  isLoading = false, 
  onImageClick,
  showInternalMessages = false,
  searchQuery = '',
  initialMessageId = '',
  pageSize = 20,
  preloadCount = 10,
  onDeleteMessage
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState<{ start: number; end: number }>({ 
    start: 0, 
    end: 0 
  });
  const [isScrollingUp, setIsScrollingUp] = useState(false);
  const [lastScrollTop, setLastScrollTop] = useState(0);
  const [hasJumpedToMessage, setHasJumpedToMessage] = useState(false);
  const [prevMessageCount, setPrevMessageCount] = useState(0);
  const [lastManualScrollTime, setLastManualScrollTime] = useState(0);

  // Apply filters for internal messages and search
  const processedMessages = useMemo(() => {
    if (!messages || !Array.isArray(messages)) {
      return [];
    }
    
    console.log('Processing messages for display:', messages.length);
    
    // Debug the message structure to understand what format we're receiving
    if (process.env.NODE_ENV === 'development' && messages.length > 0) {
      const sample = messages[0];
      console.log('Message sample structure:', {
        id: sample.id,
        sender: sample.sender,
        hasContent: !!sample.content,
        contentPreview: sample.content?.substring(0, 30),
        timestamp: sample.timestamp,
        hasMetadata: !!sample.metadata,
        metadataKeys: sample.metadata ? Object.keys(sample.metadata) : [],
        fullSample: sample
      });
    }
    
    // First, filter for visible messages based on internal/dev mode settings
    let visibleMessages = messages;
    
    // Handle both standard Message objects and memory-sourced objects
    visibleMessages = messages.filter(message => {
      // Skip invalid messages
      if (!message) return false;
      
      try {
        // For memory-based messages, check for payload structure
        if (message.payload) {
          const payload = message.payload as any;
          
          // Skip if explicitly marked as not for chat
          if (payload.metadata?.isForChat === false) {
            return false;
          }
          
          // Skip if explicitly marked as internal
          if (payload.metadata?.isInternal === true) {
            return false;
          }
          
          // For memory objects, check for type properties
          const memoryType = payload.type || message.type;
          if (memoryType && memoryType !== 'message') {
            return false;
          }
        }
        
        // Standard message checks
        if (!showInternalMessages) {
          // Check for isInternalMessage flag
          if (message.isInternalMessage === true) {
            return false;
          }
          
          // Check for metadata
          if (message.metadata) {
            // Skip if explicitly marked as not for chat
            if (message.metadata.isForChat === false) {
              return false;
            }
            
            // Skip if explicitly marked as internal
            if (message.metadata.isInternal === true) {
              return false;
            }
          }
          
          // Check message type
          if (message.messageType) {
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
          
          // Check content for internal message patterns
          if (message.content) {
            const messageText = typeof message.content === 'string' 
              ? message.content.toLowerCase() 
              : '';
            
            // Internal message content patterns
            const internalPatterns = [
              '[20', // timestamp pattern
              'thought:', 
              'reflection:', 
              'thinking:',
              'message:',
              'processing message:',
              'reflection on',
              '{"insight":',
              '!important! thought:',
              '!important!',
              'performance review:',
              'success rate:',
              'task completion:'
            ];
            
            if (internalPatterns.some(pattern => messageText.startsWith(pattern))) {
              return false;
            }
            
            // Filter markdown headings
            if (messageText.startsWith('# ')) {
              return false;
            }
          }
          
          // Check sender
          if (message.sender) {
            const senderLower = message.sender.toLowerCase();
            const internalSenders = ['system', 'internal', 'thought', 'reflection'];
            
            if (internalSenders.includes(senderLower)) {
              return false;
            }
          }
        }
        
        return true;
      } catch (error) {
        console.error('Error processing message for display:', error, message);
        return false;
      }
    });
    
    // Extract content and sender from memory structure if needed
    visibleMessages = visibleMessages.map(message => {
      // Skip processing if not needed
      if (message.content && message.sender) {
        return message;
      }
      
      try {
        // Handle memory payload structure
        if (message.payload) {
          const payload = message.payload as any;
          
          // Create a normalized message from memory structure
          return {
            ...message,
            id: message.id || payload.id || `msg_${Date.now()}`,
            content: message.content || payload.text || '',
            sender: message.sender || 
                   (payload.metadata?.role === 'user' ? 'You' : 'Assistant'),
            timestamp: message.timestamp || 
                      (payload.timestamp ? new Date(payload.timestamp) : new Date())
          };
        }
        
        return message;
      } catch (error) {
        console.error('Error normalizing message:', error, message);
        return message;
      }
    });
    
    console.log(`Filtered to ${visibleMessages.length} visible messages`);
    return visibleMessages;
  }, [messages, showInternalMessages]);

  // Determine which messages to display based on pagination
  const visibleMessages = useMemo(() => {
    if (!processedMessages.length) return [];
    
    const { start, end } = visibleRange;
    // If no range is set yet or invalid range, show at least the last 20 messages
    if (start === 0 && end === 0) {
      const displayEnd = processedMessages.length;
      const displayStart = Math.max(0, displayEnd - pageSize);
      return processedMessages.slice(displayStart, displayEnd);
    }
    
    return processedMessages.slice(start, end);
  }, [processedMessages, visibleRange, pageSize]);
  
  // Debug logging
  useEffect(() => {
    console.debug(
      `ChatMessages received ${messages?.length || 0} messages, ` +
      `showInternal=${showInternalMessages}` +
      (searchQuery ? `, searchQuery="${searchQuery}"` : '')
    );
    
    // More detailed logging for debugging message visibility issues
    if (process.env.NODE_ENV === 'development') {
      if (messages && Array.isArray(messages) && messages.length > 0) {
        // Sample the first few messages for detailed logging
        const sampleSize = Math.min(3, messages.length);
        console.debug(`Message samples (first ${sampleSize}):`);
        
        for (let i = 0; i < sampleSize; i++) {
          const msg = messages[i];
          console.debug(`Message ${i}:`, {
            id: msg.id || 'no-id',
            sender: msg.sender,
            contentPreview: msg.content?.substring(0, 30) + '...',
            isInternalMessage: msg.isInternalMessage,
            metadata: msg.metadata,
            messageType: msg.messageType,
            timestamp: msg.timestamp
          });
        }
        
        console.debug(`Filtered to ${processedMessages.length} messages after visibility rules`);
      }
    }
    
    // Log container dimensions
    if (messagesContainerRef.current) {
      const { clientHeight, scrollHeight } = messagesContainerRef.current;
      console.debug(
        `Container dimensions: clientHeight=${clientHeight}, ` +
        `scrollHeight=${scrollHeight}, ` +
        `messagesVisible=${visibleMessages.length}`
      );
    }
  }, [messages, showInternalMessages, searchQuery, visibleMessages, processedMessages]);

  // Initialize visible range - start with most recent messages
  useEffect(() => {
    if (processedMessages.length > 0) {
      if (initialMessageId) {
        // Find the message index by ID
        const messageIndex = processedMessages.findIndex(m => m.id === initialMessageId);
        if (messageIndex !== -1) {
          // Calculate range around the found message
          const start = Math.max(0, messageIndex - preloadCount);
          const end = Math.min(processedMessages.length, messageIndex + pageSize - preloadCount);
          setVisibleRange({ start, end });
          setHasJumpedToMessage(true);
        } else {
          // If message not found, show most recent messages
          const end = processedMessages.length;
          const start = Math.max(0, end - pageSize);
          setVisibleRange({ start, end });
        }
      } else {
        // No specific message requested, show most recent messages
        const end = processedMessages.length;
        const start = Math.max(0, end - pageSize);
        setVisibleRange({ start, end });
      }
    }
  }, [processedMessages, initialMessageId, pageSize, preloadCount]);

  // Scroll handling for lazy loading
  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return;
    
    // Record the time of this manual scroll
    setLastManualScrollTime(Date.now());
    
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    
    // Calculate scroll position - 0 is at top, 1 is at bottom
    const scrollPosition = scrollTop / (scrollHeight - clientHeight || 1);
    
    // Detect scroll direction
    const scrollDirection = scrollTop < lastScrollTop ? 'up' : 'down';
    setLastScrollTop(scrollTop);
    
    // User has scrolled away from the bottom - disable auto-scrolling
    const isAtBottom = scrollPosition > 0.9;
    if (!isAtBottom) {
      setIsScrollingUp(true);
    } else if (scrollDirection === 'down' && isAtBottom) {
      // User has scrolled back to the bottom - re-enable auto-scrolling
      setIsScrollingUp(false);
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`Scroll: pos=${scrollPosition.toFixed(2)}, dir=${scrollDirection}, atBottom=${isAtBottom}, preventAutoScroll=${isScrollingUp}`);
    }
    
    // Near top - load previous messages (when scrolling up and near top)
    if (scrollTop < 200 && visibleRange.start > 0) {
      const newStart = Math.max(0, visibleRange.start - preloadCount);
      setVisibleRange(prev => {
        // Preserve scroll position when adding content at the top
        if (newStart < prev.start) {
          const currentScrollPos = scrollTop;
          requestAnimationFrame(() => {
            if (messagesContainerRef.current) {
              const newScrollHeight = messagesContainerRef.current.scrollHeight;
              messagesContainerRef.current.scrollTop = 
                currentScrollPos + (newScrollHeight - scrollHeight);
            }
          });
        }
        return { ...prev, start: newStart };
      });
    }
    
    // Near bottom - load next messages if not at the end
    if (scrollHeight - scrollTop - clientHeight < 200 && 
        visibleRange.end < processedMessages.length) {
      setVisibleRange(prev => ({
        ...prev,
        end: Math.min(processedMessages.length, prev.end + preloadCount)
      }));
    }
  }, [lastScrollTop, visibleRange, processedMessages.length, preloadCount]);

  // Reliable scroll to bottom function
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    // Use setTimeout to ensure the DOM has updated
    setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior });
        
        // Add a backup direct scroll to the container as well
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
        
        // Add a secondary timeout as ultimate backup
        setTimeout(() => {
          if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
            
            if (messagesContainerRef.current) {
              messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
            }
          }
        }, 300);
      }
    }, 100);
  }, []);

  // Set up scroll listener
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      
      // Initial check to see if we need to load more in either direction
      handleScroll();
      
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  // Scroll to bottom for new messages with improved logic
  useEffect(() => {
    // Check if we have new messages by comparing current count with previous count
    const hasNewMessages = messages.length > prevMessageCount;
    setPrevMessageCount(messages.length);
    
    // Only auto-scroll in these cases:
    // 1. We have new messages and the user hasn't manually scrolled up
    // 2. Loading has just completed and this is the initial render
    // 3. Never auto-scroll when user is searching or has jumped to a specific message
    
    // Check if the user is near the bottom already (within 100px)
    const isNearBottom = messagesContainerRef.current && 
      (messagesContainerRef.current.scrollHeight - messagesContainerRef.current.scrollTop - 
       messagesContainerRef.current.clientHeight) < 100;
    
    const shouldAutoScroll = 
      // Auto-scroll for new messages only if user is already at the bottom
      (hasNewMessages && (isNearBottom || !isScrollingUp)) || 
      // Auto-scroll when messages are first loaded
      (isLoading === false && messages.length > 0 && prevMessageCount === 0);
    
    // Never auto-scroll during search or when jumping to messages
    const shouldNotScroll = !!searchQuery || !!initialMessageId || hasJumpedToMessage;
    
    if (shouldAutoScroll && !shouldNotScroll) {
      // Use a short delay to ensure the DOM has updated
      setTimeout(() => {
        scrollToBottom(hasNewMessages ? 'smooth' : 'auto');
      }, 50);
    }
    
    // Reset the jump flag after the first render
    if (hasJumpedToMessage) {
      setHasJumpedToMessage(false);
    }
    
    // Make sure visible range is set
    if (processedMessages.length > 0 && visibleRange.start === 0 && visibleRange.end === 0) {
      const end = processedMessages.length;
      const start = Math.max(0, end - pageSize);
      setVisibleRange({ start, end });
    }
  }, [messages.length, isLoading, prevMessageCount, searchQuery, isScrollingUp, 
     hasJumpedToMessage, processedMessages, initialMessageId, scrollToBottom, 
     visibleRange, pageSize]);

  // Scroll to the selected message when initialMessageId changes
  useEffect(() => {
    if (initialMessageId && processedMessages.length > 0) {
      // Find the message by ID
      const messageIndex = processedMessages.findIndex(m => m.id === initialMessageId);
      
      if (messageIndex !== -1) {
        console.log(`Found selected message at index ${messageIndex}, scrolling to it`);
        
        // Set the visible range around this message
        const start = Math.max(0, messageIndex - preloadCount);
        const end = Math.min(processedMessages.length, messageIndex + pageSize - preloadCount);
        setVisibleRange({ start, end });
        
        // Find the DOM element for this message and scroll to it
        setTimeout(() => {
          const messageElement = document.getElementById(`message-${initialMessageId}`);
          if (messageElement) {
            messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Add a highlight effect temporarily
            messageElement.classList.add('bg-blue-900', 'transition-colors', 'duration-500');
            setTimeout(() => {
              messageElement.classList.remove('bg-blue-900', 'transition-colors', 'duration-500');
            }, 2000);
          }
        }, 100);
      } else {
        console.log(`Message with ID ${initialMessageId} not found`);
      }
    }
  }, [initialMessageId, processedMessages, pageSize, preloadCount]);

  // Handle deleting a message
  const handleDeleteMessage = async (timestamp: Date): Promise<boolean> => {
    try {
      // Find the message by timestamp
      const targetMessage = processedMessages.find(msg => {
        if (!msg.timestamp) return false;
        
        // Handle different timestamp formats
        const msgTime = msg.timestamp instanceof Date 
          ? msg.timestamp.getTime() 
          : new Date(msg.timestamp).getTime();
        
        const targetTime = timestamp instanceof Date
          ? timestamp.getTime()
          : new Date(timestamp).getTime();
        
        return !isNaN(msgTime) && !isNaN(targetTime) && msgTime === targetTime;
      });
      
      if (!targetMessage) {
        console.error('No message found with timestamp:', timestamp);
        return false;
      }
      
      console.log('Deleting message:', { 
        id: targetMessage.id, 
        timestamp: timestamp instanceof Date ? timestamp.toISOString() : timestamp
      });
      
      // If we have an onDeleteMessage prop and message ID, use that (standardized memory)
      if (onDeleteMessage && targetMessage.id) {
        return await onDeleteMessage(targetMessage.id);
      }
      
      // Construct endpoint with parameters
      let endpoint = '/api/chat/message?';
      let hasParams = false;
      
      // Prioritize ID if available (most reliable)
      if (targetMessage.id) {
        endpoint += `messageId=${encodeURIComponent(targetMessage.id)}`;
        hasParams = true;
      }
      
      // Always include timestamp as a fallback for backward compatibility
      if (timestamp) {
        // Format timestamp - handle different formats
        let timestampStr = '';
        if (timestamp instanceof Date) {
          timestampStr = timestamp.toISOString();
        } else if (typeof timestamp === 'string') {
          timestampStr = timestamp;
        } else if (typeof timestamp === 'number') {
          timestampStr = new Date(timestamp).toISOString();
        }
        
        if (timestampStr) {
          endpoint += `${hasParams ? '&' : ''}timestamp=${encodeURIComponent(timestampStr)}`;
        }
      }
      
      console.log(`Calling delete endpoint: ${endpoint}`);
      
      // Call the API to delete the message
      const response = await fetch(endpoint, {
        method: 'DELETE',
      });
      
      // Parse response as text first to avoid JSON parse errors
      const responseText = await response.text();
      let responseData: any = null;
      
      try {
        if (responseText && responseText.trim().startsWith('{')) {
          responseData = JSON.parse(responseText);
        }
      } catch (parseError) {
        console.error('Error parsing delete response:', parseError, responseText);
      }
      
      if (!response.ok) {
        console.error('Error deleting message:', responseData || responseText);
        return false;
      }
      
      // Log successful deletion
      console.log('Message deleted successfully:', responseData || 'No response data');
      
      // Dispatch a custom event for the parent component to handle UI updates
      const messageDeletedEvent = new CustomEvent('messageDeleted', { 
        detail: { 
          messageId: targetMessage.id,
          timestamp: timestamp instanceof Date ? timestamp.toISOString() : timestamp
        }
      });
      document.dispatchEvent(messageDeletedEvent);
      
      return true;
    } catch (error) {
      console.error('Error in handleDeleteMessage:', error);
      return false;
    }
  };

  // Make sure we have valid messages to display
  if (!processedMessages || !Array.isArray(processedMessages) || processedMessages.length === 0) {
    // Add more debug info to help diagnose issues
    if (process.env.NODE_ENV === 'development') {
      console.warn("No messages to display. Debug info:", {
        messagesProvided: !!messages,
        messagesIsArray: Array.isArray(messages),
        messagesLength: messages?.length || 0,
        processedLength: processedMessages?.length || 0,
        isLoadingProp: isLoading,
        searchQuery: searchQuery || 'none'
      });
    }
    
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
        ) : searchQuery ? (
          <div className="flex justify-start mb-4">
            <div className="min-w-[75%] max-w-[80%] rounded-lg p-3 shadow bg-gray-700">
              <p className="text-gray-300">No messages match your search for "{searchQuery}"</p>
            </div>
          </div>
        ) : (
          <div className="flex justify-start mb-4">
            <div className="min-w-[75%] max-w-[80%] rounded-lg p-3 shadow bg-gray-700">
              <p className="text-gray-300">No messages yet. Start your conversation to see messages appear here.</p>
              {process.env.NODE_ENV === 'development' && (
                <div className="mt-2 p-2 border border-gray-600 rounded text-xs text-gray-400">
                  <p>Debug Info:</p>
                  <ul className="list-disc pl-4 mt-1">
                    <li>Raw message count: {messages?.length || 0}</li>
                    <li>Processed message count: {processedMessages?.length || 0}</li>
                    <li>isLoading: {isLoading ? 'true' : 'false'}</li>
                    <li>searchQuery: {searchQuery || 'none'}</li>
                    <li>showInternalMessages: {showInternalMessages ? 'true' : 'false'}</li>
                  </ul>
                  <p className="mt-2">Check console for more details.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

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
      
      {/* Search results banner */}
      {searchQuery && (
        <div className="sticky top-0 z-10 bg-blue-900 text-white text-sm p-2 rounded mb-4 flex justify-between items-center">
          <span>Showing {processedMessages.length} results for "{searchQuery}"</span>
        </div>
      )}
      
      {/* Debug info - only show in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="text-xs text-gray-500 mb-2 p-2 border border-gray-700 rounded">
          Showing {visibleMessages.length} of {processedMessages.length} processed messages 
          (total: {messages?.length || 0})
          {searchQuery ? ` (filtered by search: "${searchQuery}")` : ''} (Dev)
        </div>
      )}
    
      {visibleMessages.map((message, index) => {
        const isInternalMessage = !showInternalMessages && (
          (message.messageType !== undefined && isSystemMessage(message.messageType)) || 
          message.isInternalMessage === true
        );
        
        // Skip rendering internal messages unless we're showing them
        if (isInternalMessage && !showInternalMessages) {
          return null;
        }
        
        // Generate a unique ID for this message if it doesn't have one
        const messageId = message.id || `msg_${index}_${Date.now()}`;
        
        return (
          <ChatBubble
            key={messageId}
            message={message}
            onImageClick={onImageClick}
            onDeleteMessage={handleDeleteMessage}
            isInternalMessage={isInternalMessage}
            searchHighlight={searchQuery}
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
      
      {/* Scroll anchor div - always place at the end of messages */}
      <div ref={messagesEndRef} className="h-1" />
    </div>
  );
};

export default ChatMessages; 