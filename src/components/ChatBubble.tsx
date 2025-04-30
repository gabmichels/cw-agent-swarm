import React, { useState, useEffect } from 'react';
import { Message, FileAttachment } from '../types';
import MarkdownRenderer from './MarkdownRenderer';
import { Copy, FileText, MoreVertical, Star, Database } from 'lucide-react';

interface ChatBubbleProps {
  message: Message;
  onImageClick: (attachment: FileAttachment, e: React.MouseEvent) => void;
  isInternalMessage?: boolean; // Flag indicating if this is an internal thought/reflection
}

interface ContextMenuState {
  visible: boolean;
  position: 'top' | 'bottom';
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ 
  message, 
  onImageClick,
  isInternalMessage = false
}) => {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  
  // Debug logging on mount
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.debug('Rendering message:', {
        sender: message.sender,
        content: message.content?.substring(0, 30),
        isInternal: isInternalMessage,
        type: message.messageType
      });
    }
  }, [message, isInternalMessage]);

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
      
      const response = await fetch('/api/memory/add-knowledge', {
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
      <div className={`max-w-[75%] rounded-lg p-3 shadow ${
        isInternalMessage 
          ? 'bg-gray-900 text-gray-300 border border-amber-500' // Visual style for internal messages
          : senderName === 'You' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-white'
      } relative`}>
        {/* Add an indicator if this is an internal message */}
        {isInternalMessage && (
          <div className="text-xs text-amber-400 font-mono mb-1">
            {message.messageType || 'INTERNAL'}
          </div>
        )}
        
        {/* Message content */}
        <div className={`prose prose-sm ${
          isInternalMessage ? 'prose-amber' : 'prose-invert'
        }`}>
          <MarkdownRenderer content={message.content} />
        </div>
        
        {/* Attachments if any */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 space-y-2">
            {message.attachments.map((attachment, index) => (
              <div 
                key={index} 
                className="rounded bg-gray-800 p-2 hover:bg-gray-750 transition cursor-pointer"
                onClick={(e) => handleImageClick(attachment, e)}
              >
                {attachment.type === 'image' ? (
                  <div>
                    <img 
                      src={attachment.preview} 
                      alt={attachment.filename || 'Image attachment'} 
                      className="max-h-64 max-w-full rounded"
                    />
                    <div className="text-xs text-gray-400 mt-1">{attachment.filename}</div>
                  </div>
                ) : (
                  <div className="flex items-center">
                    <FileText className="mr-2 text-gray-400" size={16} />
                    <span className="text-sm">{attachment.filename}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        
        {/* Context menu button in top-right */}
        <div className="absolute top-2 right-2">
          <button 
            onClick={handleContextMenuClick}
            className="text-gray-400 hover:text-white ml-2 p-1 rounded hover:bg-gray-600"
            title="Options"
          >
            <MoreVertical size={16} />
          </button>
          
          {/* Context Menu */}
          {contextMenu && (
            <div 
              className={`absolute ${contextMenu.position === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'} right-0
                bg-gray-800 rounded-md shadow-lg py-1 border border-gray-700 z-50 w-44`}
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-700 flex items-center"
                onClick={() => copyToClipboard(message.content)}
              >
                <Copy size={14} className="mr-2" /> Copy Text
              </button>
              <button 
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-700 flex items-center"
                onClick={() => flagAsImportant(message.content)}
              >
                <Star size={14} className="mr-2" /> Flag as Important
              </button>
              <button 
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-700 flex items-center"
                onClick={() => addToKnowledge(message.content)}
              >
                <Database size={14} className="mr-2" /> Add to Knowledge
              </button>
              <button 
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-700 flex items-center"
                onClick={() => exportToCoda(message.content)}
              >
                <FileText size={14} className="mr-2" /> Export to Coda
              </button>
            </div>
          )}
        </div>
        
        {/* Show timestamp */}
        <div className="text-xs text-gray-400 mt-1">{formattedTime}</div>
      </div>
    </div>
  );
};

export default ChatBubble; 