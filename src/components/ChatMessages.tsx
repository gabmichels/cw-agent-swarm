import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { Message, FileAttachment } from '../types';
import ChatBubble from './ChatBubble';
import { filterChatVisibleMessages, isInternalMessage } from '../utils/messageFilters';
import { MessageType } from '../constants/message';
import { smartSearchMessages } from '../utils/smartSearch';

// Extend Message type for internal use with optional id
interface MessageWithId extends Message {
  id?: string;
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
}

const ChatMessages: React.FC<ChatMessagesProps> = ({ 
  messages, 
  isLoading = false, 
  onImageClick,
  showInternalMessages = false,
  searchQuery = '',
  initialMessageId = '',
  pageSize = 20,
  preloadCount = 10
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
    
    console.log('Processing messages for display');
    
    // First, filter for visible messages based on internal/dev mode settings
    let visibleMessages = messages;
    
    // Only apply visibility filtering if not in dev mode with showInternalMessages
    if (!showInternalMessages) {
      visibleMessages = messages.filter(message => {
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
          // Filter market scanner insights
          messageText.startsWith('{"insight":') ||
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
      
      console.log(`Filtered ${messages.length - visibleMessages.length} internal messages`);
    }
    
    // We no longer filter messages based on search query
    // Search is now handled by the dropdown UI
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
    
    // Log container dimensions
    if (messagesContainerRef.current) {
      const { clientHeight, scrollHeight } = messagesContainerRef.current;
      console.debug(
        `Container dimensions: clientHeight=${clientHeight}, ` +
        `scrollHeight=${scrollHeight}, ` +
        `messagesVisible=${visibleMessages.length}`
      );
    }
  }, [messages, showInternalMessages, searchQuery, visibleMessages]);

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
    
    // Use a shorter time window for manual scroll detection (800ms instead of 1500ms)
    const hasManuallyScrolledRecently = Date.now() - lastManualScrollTime < 800;

    // Simplified auto-scroll logic:
    // - Always scroll when new messages are added, unless:
    // - 1. User is actively searching
    // - 2. User has explicitly scrolled up to read earlier messages
    // - 3. We're in the middle of jumping to a specific message
    const shouldScrollToBottom = hasNewMessages && 
                               !searchQuery && 
                               (!isScrollingUp || !hasManuallyScrolledRecently);
    
    if (shouldScrollToBottom) {
      console.log('Scrolling to bottom due to new message');
      scrollToBottom('auto');
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
  }, [messages.length, searchQuery, isScrollingUp, hasJumpedToMessage, processedMessages, 
     visibleRange, pageSize, lastManualScrollTime, scrollToBottom]);

  // Force scroll to bottom when loading completes
  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      // Scroll to bottom when loading finishes
      scrollToBottom('auto');
    }
  }, [isLoading, messages.length, scrollToBottom]);

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

  // Make sure we have valid messages to display
  if (!processedMessages || !Array.isArray(processedMessages) || processedMessages.length === 0) {
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
    
      {visibleMessages.map((message, index) => (
        <ChatBubble 
          key={`msg-${message.id || index}-${message.timestamp?.getTime() || index}`}
          message={message}
          onImageClick={onImageClick}
          isInternalMessage={message.isInternalMessage || false}
          searchHighlight={searchQuery}
          data-message-id={message.id || `msg-${index}`}
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