import React, { useState, useEffect } from 'react';
import { Message, FileAttachment } from '../types';
import MarkdownRenderer from './MarkdownRenderer';
import { Copy, FileText, MoreVertical, Star, Database } from 'lucide-react';
import { highlightSearchMatches } from '../utils/smartSearch';

interface ChatBubbleProps {
  message: Message;
  onImageClick: (attachment: FileAttachment, e: React.MouseEvent) => void;
  isInternalMessage?: boolean; // Flag indicating if this is an internal thought/reflection
  searchHighlight?: string; // Search query text to highlight
}

interface ContextMenuState {
  visible: boolean;
  position: 'top' | 'bottom';
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ 
  message, 
  onImageClick,
  isInternalMessage = false,
  searchHighlight = ''
}) => {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [highlightedContent, setHighlightedContent] = useState<string | null>(null);
  
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

  // Safety check - if we somehow received an invalid message
  if (!message || !message.content) {
    console.warn('Received invalid message in ChatBubble:', message);
    return null;
  }

  // Show/hide context menu
  const handleContextMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Determine if we should show the menu above or below
    const position = window.innerHeight - e.clientY < 100 ? 'top' : 'bottom';
    
    // Toggle menu visibility
    setContextMenu(contextMenu ? null : { visible: true, position });
  };

  // Copy message content to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      // Show toast notification
      showToast('Copied to clipboard!');
      setContextMenu(null);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  };

  // Flag message as highly important
  const flagAsImportant = async (content: string) => {
    try {
      showToast('Flagging message as highly important...');
      setContextMenu(null);
      
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

  // Add to knowledge base
  const addToKnowledge = async (content: string) => {
    try {
      showToast('Adding to knowledge base...');
      setContextMenu(null);
      
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
      setContextMenu(null);
      
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

  return (
    <div className={`flex ${senderName === 'You' ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`flex flex-col ${senderName === 'You' ? 'items-end' : 'items-start'}`}>
        <div className={`w-auto max-w-none rounded-lg p-3 shadow ${
          isInternalMessage 
            ? 'bg-gray-900 text-gray-300 border border-amber-500' // Visual style for internal messages
          : senderName === 'You'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-700 text-white'
        }`}>
          {/* Message content */}
          <div className="mb-1 relative pr-6 group">
            {/* Render message with or without highlighting - DISABLED FOR NOW */}
            {/*
            {searchHighlight && highlightedContent ? (
              <div 
                className="prose dark:prose-invert max-w-none prose-sm"
                dangerouslySetInnerHTML={{ __html: highlightedContent }}
              />
            ) : (
            */}
              <MarkdownRenderer content={message.content} onImageClick={handleImageClick} />
            {/*}*/}
            
            <button 
              onClick={handleContextMenuClick}
              className="absolute top-0 right-0 p-1 rounded-full text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-gray-800 hover:text-white transition-opacity"
              aria-label="Message options"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            
            {/* Context menu */}
            {contextMenu && contextMenu.visible && (
              <div 
                className={`absolute ${
                  contextMenu.position === 'top' 
                    ? 'bottom-full mb-1' 
                    : 'top-full mt-1'
                } right-0 z-10 w-48 bg-gray-800 rounded-md shadow-lg py-1`}
              >
                <button 
                  onClick={() => copyToClipboard(message.content || '')}
                  className="flex items-center w-full px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy text
                </button>
                
                <button 
                  onClick={() => flagAsImportant(message.content || '')}
                  className="flex items-center w-full px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                >
                  <Star className="h-4 w-4 mr-2" />
                  Flag as important
                </button>
                
                <button 
                  onClick={() => addToKnowledge(message.content || '')}
                  className="flex items-center w-full px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                >
                  <Database className="h-4 w-4 mr-2" />
                  Add to knowledge
                </button>
                
                <button 
                  onClick={() => exportToCoda(message.content || '')}
                  className="flex items-center w-full px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Export to Coda
                </button>
              </div>
            )}
          </div>
        
          {/* Message metadata */}
          <div className="text-xs opacity-70 flex justify-between items-center">
            <span>{senderName}</span>
            <span>{formattedTime}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatBubble; 