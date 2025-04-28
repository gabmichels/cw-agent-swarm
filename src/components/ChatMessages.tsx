import React, { useEffect, useRef, useState } from 'react';
import MarkdownRenderer from './MarkdownRenderer';
import { Message, FileAttachment } from '../types';

interface ChatMessagesProps {
  messages: Message[];
}

const ChatMessages: React.FC<ChatMessagesProps> = ({ messages }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Log messages with attachments whenever messages prop changes
  useEffect(() => {
    const messagesWithAttachments = messages.filter(
      msg => msg.attachments && msg.attachments.length > 0
    );
    
    if (messagesWithAttachments.length > 0) {
      console.log(`Found ${messagesWithAttachments.length} messages with attachments`);
      messagesWithAttachments.forEach((msg, i) => {
        console.log(`Message ${i + 1} attachments:`, 
          msg.attachments?.map(att => ({
            type: att.type,
            filename: att.filename,
            hasPreview: !!att.preview?.length
          }))
        );
      });
    } else {
      console.log("No messages with attachments found in the current set");
    }
  }, [messages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleImageClick = (preview: string) => {
    setSelectedImage(preview);
  };

  const handleCloseDialog = () => {
    setSelectedImage(null);
  };

  // Helper to check if an attachment is an image and has a valid preview
  const isValidImageAttachment = (attachment: any): boolean => {
    return (
      attachment && 
      attachment.type === 'image' && 
      typeof attachment.preview === 'string' && 
      attachment.preview.length > 0
    );
  };

  return (
    <>
      {messages.map((message, index) => (
        <div key={index} className={`flex ${message.sender === 'You' ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[75%] rounded-lg p-3 shadow ${
            message.sender === 'You' ? 'bg-blue-600 text-white' : 'bg-gray-700'
          }`}>
            <MarkdownRenderer 
              content={message.content} 
              className={message.sender === 'You' ? 'prose-headings:text-white prose-p:text-white prose-strong:text-white prose-em:text-white prose-a:text-blue-200' : ''}
            />
            
            {/* Check for file attachments */}
            {message.attachments && message.attachments.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {message.attachments.map((attachment, index) => (
                  <div key={index} className="relative group">
                    {attachment.type === 'image' ? (
                      <div className="relative">
                        {attachment.preview && !attachment.truncated ? (
                          <img 
                            src={attachment.preview} 
                            alt={`Attached image: ${attachment.filename || 'Image'}`}
                            className="max-h-48 max-w-48 rounded-md object-cover border border-gray-700 hover:border-blue-400"
                            onClick={() => handleImageClick(attachment.preview)}
                          />
                        ) : (
                          <div className="h-48 w-48 rounded-md border border-gray-700 bg-gray-800 flex items-center justify-center text-center p-2">
                            <div>
                              <div className="text-yellow-400 text-2xl mb-2">🖼️</div>
                              <div className="text-sm text-gray-300">Image preview unavailable</div>
                              <div className="text-xs text-gray-400 mt-1">{attachment.filename || 'Image'}</div>
                            </div>
                          </div>
                        )}
                        <div className="absolute bottom-1 right-1 bg-black bg-opacity-60 rounded px-2 py-1 text-xs">
                          📸 {attachment.filename || 'Image'}
                        </div>
                      </div>
                    ) : attachment.type === 'pdf' ? (
                      <div className="relative bg-gray-800 rounded-md border border-gray-700 p-2 flex items-center">
                        <div className="text-red-400 text-2xl mr-2">📄</div>
                        <div>
                          <div className="text-sm">{attachment.filename || 'PDF Document'}</div>
                          {attachment.preview && (
                            <div className="text-xs text-gray-400 mt-1 truncate max-w-[200px]">{attachment.preview}</div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="relative bg-gray-800 rounded-md border border-gray-700 p-2 flex items-center">
                        <div className="text-gray-400 text-2xl mr-2">📄</div>
                        <div>
                          <div className="text-sm">{attachment.filename || 'Document'}</div>
                          {attachment.preview && (
                            <div className="text-xs text-gray-400 mt-1 truncate max-w-[200px]">{attachment.preview}</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
      <div ref={messagesEndRef} />

      {selectedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={handleCloseDialog}>
          <div className="max-w-4xl max-h-screen overflow-auto bg-gray-900 rounded-lg p-2" onClick={(e) => e.stopPropagation()}>
            <img src={selectedImage} alt="Enlarged attachment" className="max-w-full max-h-[80vh]" />
            <button 
              className="absolute top-4 right-4 bg-gray-800 text-white rounded-full p-2 hover:bg-gray-700"
              onClick={handleCloseDialog}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatMessages; 