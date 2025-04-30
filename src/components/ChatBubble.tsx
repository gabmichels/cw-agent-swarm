import React, { useState } from 'react';
import { Message, FileAttachment } from '../types';
import MarkdownRenderer from './MarkdownRenderer';
import { Copy, FileText, MoreVertical, Star, Database } from 'lucide-react';

interface ChatBubbleProps {
  message: Message;
  onImageClick: (attachment: FileAttachment, e: React.MouseEvent) => void;
}

interface ContextMenuState {
  visible: boolean;
  position: 'top' | 'bottom';
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ 
  message, 
  onImageClick
}) => {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

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

  // Add to knowledge database
  const addToKnowledge = async (content: string) => {
    try {
      showToast('Adding to knowledge database...');
      setContextMenu(null);
      
      const response = await fetch('/api/knowledge/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          source: 'chat',
          timestamp: message.timestamp?.toISOString() || new Date().toISOString()
        }),
      });
      
      const data = await response.json();
      if (data.success) {
        showToast('Added to knowledge database!');
      } else {
        showToast('Failed to add to knowledge database');
      }
    } catch (error) {
      console.error('Error adding to knowledge:', error);
      showToast('Error adding to knowledge database');
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

  return (
    <div className={`flex ${message.sender === 'You' ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[75%] rounded-lg p-3 shadow ${
        message.sender === 'You' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-white'
      } relative`}>
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

        <MarkdownRenderer 
          content={message.content} 
          className={message.sender === 'You' 
            ? 'prose-sm prose-invert prose-headings:text-white prose-p:text-white prose-strong:text-white prose-em:text-white prose-a:text-blue-200'
            : 'prose-sm prose-invert'
          }
        />
        
        {/* Render attachments if present */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.attachments.map((attachment, idx) => (
              <div key={idx} className="relative">
                {attachment.type === 'image' && attachment.preview ? (
                  <img 
                    src={attachment.preview} 
                    alt={attachment.filename || 'Image'} 
                    className="max-h-40 max-w-40 rounded border border-gray-500 cursor-pointer hover:opacity-90"
                    onClick={(e) => handleImageClick(attachment, e)}
                  />
                ) : (
                  <div className="p-2 bg-gray-800 rounded border border-gray-600">
                    {attachment.filename || 'File'}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        
        {/* Show memory context if available */}
        {message.memory && message.memory.length > 0 && (
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer text-blue-300">View Memory Context</summary>
            <div className="mt-2 p-2 bg-gray-800 rounded text-xs">
              {Array.isArray(message.memory) 
                ? message.memory.map((mem, i) => (
                    <div key={i} className="mb-2 last:mb-0">
                      <MarkdownRenderer 
                        content={typeof mem === 'string' ? mem : mem.content || ''} 
                        className="prose-xs prose-invert" 
                      />
                    </div>
                  ))
                : 'No memory context available'}
            </div>
          </details>
        )}
        
        {/* Show thoughts if available */}
        {message.thoughts && message.thoughts.length > 0 && (
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer text-purple-300">View Thoughts</summary>
            <div className="mt-2 p-2 bg-gray-800 rounded text-xs">
              {message.thoughts.map((thought, i) => (
                <div key={i} className="mb-2 last:mb-0">
                  <MarkdownRenderer content={thought} className="prose-xs prose-invert" />
                </div>
              ))}
            </div>
          </details>
        )}
        
        <div className="text-xs mt-1 text-gray-300">
          {message.timestamp ? message.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
        </div>
      </div>
    </div>
  );
};

export default ChatBubble; 