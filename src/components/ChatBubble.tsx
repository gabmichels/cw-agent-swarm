import React, { useState, useEffect } from 'react';
import { Message, FileAttachment } from '../types';
import MarkdownRenderer from './MarkdownRenderer';
import { highlightSearchMatches } from '../utils/smartSearch';
import ChatBubbleMenu from './ChatBubbleMenu';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { FileAttachmentType } from '../constants/file';
import { toast } from 'react-hot-toast';

interface ChatBubbleProps {
  message: Message;
  onImageClick: (attachment: FileAttachment, e: React.MouseEvent) => void;
  onDeleteMessage?: (messageTimestamp: Date) => Promise<boolean>;
  isInternalMessage?: boolean; // Flag indicating if this is an internal thought/reflection
  searchHighlight?: string; // Search query text to highlight
  'data-message-id'?: string; // Added property for message identification
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ 
  message, 
  onImageClick,
  onDeleteMessage,
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
        sender: typeof message.sender === 'object' ? message.sender.name : message.sender,
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
    if (typeof message.sender === 'object' && message.sender.role === 'user' && 
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
      
      if (message.id) {
        // Use the standardized memory API if we have a message ID
        const response = await fetch(`/api/memory/${message.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'message', // Use the appropriate memory type
            metadata: {
              importance: 'high', // Set importance level for standardized memory
              flagged: true // Mark as flagged in standardized system
            }
          }),
        });
        
        const data = await response.json();
        if (data.success) {
          showToast('Message flagged as highly important!');
        } else {
          showToast('Failed to flag message');
        }
      } else {
        // Legacy approach if no message ID is available
        const response = await fetch('/api/memory/flag-important', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content,
            timestamp: message.timestamp
          }),
        });
        
        const data = await response.json();
        if (data.success) {
          showToast('Message flagged as highly important!');
        } else {
          showToast('Failed to flag message');
        }
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
          timestamp: message.timestamp
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
          timestamp: message.timestamp
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
      const metadata = message.metadata || {};
      const tags = metadata.tags || [];
      const category = metadata.category || 'general';
      
      // Use the standardized memory API
      const response = await fetch('/api/memory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'knowledge', // Use the appropriate memory type from MemoryType
          content: content,
          metadata: {
            source: 'chat',
            sourceId: message.id || undefined,
            sourceTimestamp: message.timestamp,
            tags: tags,
            importance: 'medium',
            category,
            addedBy: 'user'
          }
        }),
      });
      
      const data = await response.json();
      if (data.success || data.id) {
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
  let senderName: string;
  if (typeof message.sender === 'string') {
    senderName = message.sender === 'You' || message.sender === 'user' ? 'You' : message.sender;
  } else if (message.sender && typeof message.sender === 'object') {
    senderName = message.sender.name || (message.sender.role === 'user' ? 'You' : 'Assistant');
  } else {
    senderName = 'Unknown';
  }
    
  // Handle timestamp display - improved validation with debug logging
  const formattedTime = (() => {
    // Debug log the raw timestamp
    console.log(`ChatBubble raw timestamp for message ${message.id}:`, {
      value: message.timestamp,
      type: typeof message.timestamp
    });
    
    try {
      // First validate what type of timestamp we have and create a valid date
      let date: Date | null = null;
      
      if (message.timestamp instanceof Date) {
        date = message.timestamp;
        console.log(`Date instance: ${date.toISOString()}`);
      }
      else if (typeof message.timestamp === 'number') {
        date = new Date(message.timestamp);
        console.log(`Numeric timestamp ${message.timestamp} -> ${date.toISOString()}`);
      }
      else if (typeof message.timestamp === 'string') {
        // Handle numeric strings first (most common from database)
        if (/^\d+$/.test(message.timestamp)) {
          const parsedTimestamp = parseInt(message.timestamp, 10);
          date = new Date(parsedTimestamp);
          console.log(`String-numeric timestamp ${message.timestamp} -> ${parsedTimestamp} -> ${date.toISOString()}`);
        } else {
          // Try standard date parsing
          date = new Date(message.timestamp);
          console.log(`String date timestamp ${message.timestamp} -> ${date.toISOString()}`);
        }
      }
      
      // Validate the date before using it
      if (!date || isNaN(date.getTime())) {
        console.error('Invalid date from timestamp:', message.timestamp);
        return 'Unknown time';
      }
      
      // Format a valid date
      const formatted = date.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      console.log(`Final formatted time: ${formatted}`);
      return formatted;
    } catch (err) {
      console.error('Error formatting time:', err, 'for timestamp:', message.timestamp);
      return 'Unknown time';
    }
  })();

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

  // Get timestamp from message with proper validation
  const timestamp = (() => {
    try {
      if (message.timestamp instanceof Date) {
        return message.timestamp;
      }
      
      if (typeof message.timestamp === 'number') {
        return new Date(message.timestamp);
      }
      
      if (typeof message.timestamp === 'string') {
        const date = new Date(message.timestamp);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
      
      // Default fallback
      return new Date();
    } catch (err) {
      console.warn('Error processing timestamp:', err);
      return new Date();
    }
  })();

  const mainContent = highlightedContent || messageVersions[currentVersionIndex];
  
  // Handle delete message
  const handleDeleteMessage = async (timestamp: Date) => {
    if (onDeleteMessage) {
      return onDeleteMessage(timestamp);
    }
    return false;
  };

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
            
            {/* Display message attachments */}
            {message.attachments && message.attachments.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {message.attachments.map((attachment, index) => {
                  // Enhanced URL handling - handle various URL formats and ensure they're valid
                  // Log the attachment to help debug
                  console.log(`Rendering attachment:`, attachment);
                  
                  // Get the file ID (without extension if present)
                  const fileId = attachment.fileId || 
                    (attachment.url ? attachment.url.split('/').pop() : null);
                  
                  // Process image URL with multiple fallback strategies
                  let imageUrl = attachment.preview || attachment.url;
                  
                  // Choose the best URL source based on available information
                  if (!imageUrl && fileId) {
                    // Check if we have an explicit storage location
                    const attachmentMeta = (attachment as any).metadata || {};
                    if (attachmentMeta.storage === 'minio' || attachmentMeta.bucket) {
                      // Prefer MinIO storage endpoint
                      const bucket = attachmentMeta.bucket || 'chat-attachments';
                      imageUrl = `/api/storage/${bucket}/${fileId}`;
                      console.log(`Using MinIO storage endpoint: ${imageUrl}`);
                    } else {
                      // Try direct storage URL if MinIO isn't explicitly specified
                      imageUrl = `/storage/chat-attachments/${fileId}`;
                      console.log(`Using direct storage URL: ${imageUrl}`);
                    }
                  }
                  
                  console.log(`Final image URL: ${imageUrl}`);
                  
                  return (
                    <div key={index} className="relative" onClick={(e) => handleImageClick(attachment, e)}>
                      {attachment.type === FileAttachmentType.IMAGE && (
                        <div className="relative cursor-pointer hover:opacity-90 transition-opacity">
                          <img 
                            src={imageUrl} 
                            alt={attachment.filename || 'Image attachment'} 
                            className="max-w-full h-auto rounded-md border border-gray-600 shadow-sm max-h-48"
                            onError={(e) => {
                              // Change from error to warning level logging
                              console.warn('Image could not be loaded:', imageUrl);
                              
                              // Track this image's load attempts to prevent infinite retry loops
                              const imgElement = e.target as HTMLImageElement;
                              const attemptCount = parseInt(imgElement.dataset.attempts || '0', 10);
                              
                              // Limit retry attempts to prevent infinite loops
                              if (attemptCount >= 3) {
                                // Use a data URL for broken image placeholder as final fallback
                                console.warn('All fallbacks failed after 3 attempts, using placeholder image');
                                imgElement.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCIgdmlld0JveD0iMCAwIDI0IDI0IiBzdHJva2Utd2lkdGg9IjEuNSIgc3Ryb2tlPSIjZmYyODI1IiBmaWxsPSJub25lIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPgogIDxyZWN0IHg9IjMiIHk9IjMiIHdpZHRoPSIxOCIgaGVpZ2h0PSIxOCIgcng9IjIiIHJ5PSIyIiAvPgogIDxsaW5lIHgxPSIzIiB5MT0iMyIgeDI9IjIxIiB5Mj0iMjEiIC8+CiAgPGxpbmUgeDE9IjMiIHkxPSIyMSIgeDI9IjIxIiB5Mj0iMyIgLz4KICA8Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxIiAvPgo8L3N2Zz4=';
                                imgElement.alt = 'Image unavailable';
                                return;
                              }
                              
                              // Store the attempt count
                              imgElement.dataset.attempts = (attemptCount + 1).toString();
                              
                              // If the image fails, try multiple alternative approaches
                              if (fileId) {
                                // Try alternative URL patterns based on file ID
                                const fallbackUrls = [
                                  `/api/storage/chat-attachments/${fileId}`,  // Try MinIO storage first
                                  `/api/files/view/${fileId}`,               
                                  `/storage/chat-attachments/${fileId}`,      // Direct URL without extension
                                  `/api/files/${fileId}`                      // Generic files endpoint
                                ];
                                
                                // Use a different fallback URL based on the attempt count
                                if (attemptCount < fallbackUrls.length) {
                                  const nextUrl = fallbackUrls[attemptCount];
                                  console.warn(`Trying alternative URL (attempt ${attemptCount + 1}): ${nextUrl}`);
                                  imgElement.src = nextUrl;
                                  return;
                                }
                              }
                              
                              // If we've exhausted fileId-based URLs or don't have a fileId, 
                              // use a generic broken image placeholder
                              imgElement.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCIgdmlld0JveD0iMCAwIDI0IDI0IiBzdHJva2Utd2lkdGg9IjEuNSIgc3Ryb2tlPSIjZmYyODI1IiBmaWxsPSJub25lIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPgogIDxyZWN0IHg9IjMiIHk9IjMiIHdpZHRoPSIxOCIgaGVpZ2h0PSIxOCIgcng9IjIiIHJ5PSIyIiAvPgogIDxsaW5lIHgxPSIzIiB5MT0iMyIgeDI9IjIxIiB5Mj0iMjEiIC8+CiAgPGxpbmUgeDE9IjMiIHkxPSIyMSIgeDI9IjIxIiB5Mj0iMyIgLz4KICA8Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxIiAvPgo8L3N2Zz4=';
                              imgElement.alt = 'Image unavailable';
                            }}
                          />
                          {attachment.filename && (
                            <div className="text-xs mt-1 text-gray-300 truncate max-w-xs">
                              {attachment.filename}
                            </div>
                          )}
                        </div>
                      )}
                      {attachment.type === FileAttachmentType.PDF && (
                        <div className="bg-red-700 text-white rounded p-2 cursor-pointer hover:bg-red-600 transition-colors">
                          <span className="font-bold">PDF:</span> {attachment.filename || 'Document'}
                        </div>
                      )}
                      {attachment.type === FileAttachmentType.DOCUMENT && (
                        <div className="bg-blue-700 text-white rounded p-2 cursor-pointer hover:bg-blue-600 transition-colors">
                          <span className="font-bold">DOC:</span> {attachment.filename || 'Document'}
                        </div>
                      )}
                      {attachment.type === FileAttachmentType.TEXT && (
                        <div className="bg-gray-700 text-white rounded p-2 cursor-pointer hover:bg-gray-600 transition-colors">
                          <span className="font-bold">TXT:</span> {attachment.filename || 'Text file'}
                        </div>
                      )}
                      {attachment.type === FileAttachmentType.OTHER && (
                        <div className="bg-purple-700 text-white rounded p-2 cursor-pointer hover:bg-purple-600 transition-colors">
                          <span className="font-bold">FILE:</span> {attachment.filename || 'File'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            
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
            isAssistantMessage={message.sender.role === 'assistant'}
            showVersionControls={messageVersions.length > 1}
            currentVersionIndex={currentVersionIndex}
            totalVersions={messageVersions.length}
            onPreviousVersion={goToPreviousVersion}
            onNextVersion={goToNextVersion}
            onCopyText={copyToClipboard}
            onFlagUnreliable={flagAsUnreliable}
            onRegenerate={requestRegeneration}
            onFlagImportant={flagAsImportant}
            onAddToKnowledge={addToKnowledge}
            onExportToCoda={exportToCoda}
            onDeleteMessage={onDeleteMessage ? handleDeleteMessage : undefined}
            messageId={message.id}
            onDeleteMemory={undefined}
          />
        </div>
      </div>
    </div>
  );
};

export default ChatBubble; 