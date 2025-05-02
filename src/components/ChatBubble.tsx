import React, { useState, useEffect } from 'react';
import { Message, FileAttachment } from '../types';
import MarkdownRenderer from './MarkdownRenderer';
import { highlightSearchMatches } from '../utils/smartSearch';
import ChatBubbleMenu from './ChatBubbleMenu';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ChatBubbleProps {
  message: Message;
  onImageClick: (attachment: FileAttachment, e: React.MouseEvent) => void;
  isInternalMessage?: boolean; // Flag indicating if this is an internal thought/reflection
  searchHighlight?: string; // Search query text to highlight
  'data-message-id'?: string; // Added property for message identification
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ 
  message, 
  onImageClick,
  isInternalMessage = false,
  searchHighlight = '',
  'data-message-id': dataMessageId
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [highlightedContent, setHighlightedContent] = useState<string | null>(null);
  // Track message versions and current version index
  const [messageVersions, setMessageVersions] = useState<string[]>([message.content || '']);
  const [currentVersionIndex, setCurrentVersionIndex] = useState(0);
  
  // Process search highlighting when content or search terms change
  useEffect(() => {
    if (searchHighlight && message.content) {
      try {
        const highlighted = highlightSearchMatches(message.content, searchHighlight, {
          highlightClass: 'bg-yellow-300 dark:bg-yellow-600 text-black dark:text-white rounded px-1'
        });
        setHighlightedContent(highlighted);
      } catch (e) {
        console.error('Error highlighting search matches:', e);
        setHighlightedContent(null);
      }
    } else {
      setHighlightedContent(null);
    }
  }, [message.content, searchHighlight]);
  
  // Debug logging on mount
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.debug('Rendering message:', {
        sender: message.sender,
        content: message.content?.substring(0, 30),
        isInternal: isInternalMessage,
        type: message.messageType,
        searchHighlight: searchHighlight ? `"${searchHighlight}"` : 'none'
      });
    }
  }, [message, isInternalMessage, searchHighlight]);

  useEffect(() => {
    // Safety check for empty messages
    if (!message.content) return;

    // Special handling for markdown content in user messages
    // This ensures markdown with code blocks displays properly in user bubbles
    if (message.sender === 'You' && 
        (message.content.includes('```') || 
         message.content.includes('#') || 
         message.content.includes('---'))) {
      
      console.debug('User message contains markdown, ensuring proper rendering');
      
      // Force a redraw of the message content
      const updatedContent = message.content;
      setMessageVersions([updatedContent]);
      setCurrentVersionIndex(0);
    }
  }, [message.content, message.sender]);

  // Safety check - if we somehow received an invalid message
  if (!message || !message.content) {
    console.warn('Received invalid message in ChatBubble:', message);
    return null;
  }

  // Toggle menu visibility
  const toggleMenu = () => {
    setShowMenu(!showMenu);
  };

  // Copy message content to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      // Show toast notification
      showToast('Copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  };

  // Flag message as highly important
  const flagAsImportant = async (content: string) => {
    try {
      showToast('Flagging message as highly important...');
      
      const response = await fetch('/api/memory/flag-important', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          timestamp: message.timestamp?.toISOString() || new Date().toISOString()
        }),
      });
      
      const data = await response.json();
      if (data.success) {
        showToast('Message flagged as highly important!');
      } else {
        showToast('Failed to flag message');
      }
    } catch (error) {
      console.error('Error flagging message:', error);
      showToast('Error flagging message');
    }
  };

  // Flag message as unreliable (thumbs down)
  const flagAsUnreliable = async (content: string) => {
    try {
      showToast('Flagging message as unreliable...');
      
      const response = await fetch('/api/memory/flag-unreliable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          messageId: message.id,
          timestamp: message.timestamp?.toISOString() || new Date().toISOString()
        }),
      });
      
      const data = await response.json();
      if (data.success) {
        showToast('Message flagged as unreliable! Future retrievals will exclude this content.');
      } else {
        showToast('Failed to flag message');
      }
    } catch (error) {
      console.error('Error flagging message as unreliable:', error);
      showToast('Error flagging message');
    }
  };

  // Request regeneration (after thumbs down)
  const requestRegeneration = async (content: string) => {
    try {
      showToast('Requesting regeneration...');
      
      const response = await fetch('/api/chat/regenerate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messageId: message.id,
          avoidContent: content,
          timestamp: message.timestamp?.toISOString() || new Date().toISOString()
        }),
      });
      
      const data = await response.json();
      if (data.success) {
        showToast('Regenerating response...');
        
        // In a real application, you would either:
        // 1. Get the regenerated response directly in the API response
        // 2. Set up a WebSocket connection to receive the regenerated response
        // 3. Poll an endpoint to check for the regenerated response
        
        // For this implementation, we'll either:
        if (data.regeneratedContent) {
          // If the API returns regenerated content directly
          setMessageVersions(prev => [...prev, data.regeneratedContent]);
          setCurrentVersionIndex(prev => prev + 1);
          showToast('Response regenerated!');
        } else {
          // Simulate a websocket/polling response for demo purposes
          // In production, replace this with actual websocket or polling logic
          setTimeout(() => {
            // This is a temporary implementation until backend integration is complete
            const regeneratedContent = `${content}\n\n---\n\n**[Regenerated Response]**\n\nThis is a regenerated response that avoids the issues in the previous version. It provides more accurate information based on verified sources.`;
            
            setMessageVersions(prev => [...prev, regeneratedContent]);
            setCurrentVersionIndex(prev => prev + 1);
            showToast('Response regenerated!');
          }, 1500);
        }
      } else {
        showToast('Failed to regenerate response');
      }
    } catch (error) {
      console.error('Error requesting regeneration:', error);
      showToast('Error requesting regeneration');
    }
  };

  // Add to knowledge base
  const addToKnowledge = async (content: string) => {
    try {
      showToast('Adding to knowledge base...');
      
      // Safely extract any metadata from the message
      const metadata = (message as any).metadata || {};
      const tags = metadata.tags || [];
      const category = metadata.category || 'general';
      
      const response = await fetch('/api/memory/add-knowledge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          timestamp: message.timestamp?.toISOString() || new Date().toISOString(),
          addedBy: 'user',
          tags,
          category
        }),
      });
      
      const data = await response.json();
      if (data.success) {
        showToast('Added to knowledge base!');
      } else {
        showToast('Failed to add to knowledge base');
      }
    } catch (error) {
      console.error('Error adding to knowledge base:', error);
      showToast('Error adding to knowledge base');
    }
  };

  // Export to Coda
  const exportToCoda = async (content: string) => {
    try {
      showToast('Exporting to Coda...');
      
      // Call the API to generate a title and create the document
      const response = await fetch('/api/tools/coda-export-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: content
        }),
      });
      
      const data = await response.json();
      if (data.success) {
        showToast(`Exported to Coda: ${data.title || 'Document'}`);
      } else {
        showToast('Failed to export to Coda');
      }
    } catch (error) {
      console.error('Error exporting to Coda:', error);
      showToast('Error exporting to Coda');
    }
  };

  // Simple toast notification
  const showToast = (message: string) => {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-4 right-4 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-opacity duration-300';
    toast.innerText = message;
    document.body.appendChild(toast);
    
    // Remove after 3 seconds
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 300);
    }, 3000);
  };

  // Handle image click to show in modal
  const handleImageClick = (attachment: FileAttachment, e: React.MouseEvent) => {
    onImageClick(attachment, e);
  };

  // Determine the sender display name
  const senderName = message.sender === 'You' || message.sender === 'user' 
    ? 'You' 
    : message.sender === 'chloe' || message.sender === 'Chloe' || message.sender === 'agent' || message.sender === 'assistant'
    ? 'Chloe'
    : message.sender;
    
  // Handle timestamp display
  const formattedTime = message.timestamp instanceof Date 
    ? message.timestamp.toLocaleTimeString() 
    : typeof message.timestamp === 'string'
    ? new Date(message.timestamp).toLocaleTimeString()
    : 'Unknown time';

  // Check if this is an assistant message (not a user message)
  const isAssistantMessage = senderName !== 'You';

  // Navigate to previous version
  const goToPreviousVersion = () => {
    if (currentVersionIndex > 0) {
      setCurrentVersionIndex(currentVersionIndex - 1);
    }
  };

  // Navigate to next version
  const goToNextVersion = () => {
    if (currentVersionIndex < messageVersions.length - 1) {
      setCurrentVersionIndex(currentVersionIndex + 1);
    }
  };

  // Get current content based on version index
  const currentContent = messageVersions[currentVersionIndex] || '';
  
  // Check if this is a user message
  const isUserMessage = senderName === 'You';

  // Determine CSS classes for message alignment and styling
  const alignmentClasses = isUserMessage 
    ? 'ml-auto' 
    : 'mr-auto';
  
  const bgColorClasses = isUserMessage
    ? 'bg-blue-600 text-white' 
    : 'bg-gray-800 text-white';

  // Get timestamp from message
  const timestamp = message.timestamp instanceof Date 
    ? message.timestamp 
    : new Date(message.timestamp || Date.now());

  const mainContent = highlightedContent || messageVersions[currentVersionIndex];
  
  return (
    <div 
      className={`flex ${senderName === 'You' ? 'justify-end' : 'justify-start'} mb-4`}
      onMouseEnter={() => setShowMenu(true)}
      onMouseLeave={() => setShowMenu(false)}
      id={message.id ? `message-${message.id}` : undefined}
    >
      <div className={`flex flex-col ${senderName === 'You' ? 'items-end' : 'items-start'} max-w-2xl mr-3`}>
        <div className={`w-full rounded-lg p-3 shadow ${bgColorClasses}`}>
          {/* Message content */}
          <div className="mb-1 relative">
            <MarkdownRenderer 
              content={mainContent} 
              onImageClick={handleImageClick} 
              isUserMessage={isUserMessage}
            />
            
            {/* Message metadata with version indicators */}
            <div className="text-xs opacity-70 flex justify-between items-center mt-2">
              <span>{senderName}</span>
              <div className="flex items-center">
                {messageVersions.length > 1 && (
                  <div className="flex items-center mr-2">
                    <span className="mr-1">Version {currentVersionIndex + 1}/{messageVersions.length}</span>
                  </div>
                )}
                <span>{formattedTime}</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Always render the menu but control visibility with CSS opacity */}
        <div className={`transition-opacity duration-200 ${showMenu ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <ChatBubbleMenu
            message={{...message, content: currentContent}}
            onCopyText={copyToClipboard}
            onFlagUnreliable={flagAsUnreliable}
            onRegenerate={requestRegeneration}
            onFlagImportant={flagAsImportant}
            onAddToKnowledge={addToKnowledge}
            onExportToCoda={exportToCoda}
            isAssistantMessage={isAssistantMessage}
            showVersionControls={messageVersions.length > 1}
            currentVersionIndex={currentVersionIndex}
            totalVersions={messageVersions.length}
            onPreviousVersion={goToPreviousVersion}
            onNextVersion={goToNextVersion}
          />
        </div>
      </div>
    </div>
  );
};

export default ChatBubble; 