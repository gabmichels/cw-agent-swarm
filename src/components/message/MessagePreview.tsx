import React from 'react';
import { X, MessageCircle, User, Bot, Paperclip } from 'lucide-react';
import { Message } from '../../types';

interface MessagePreviewProps {
  message: Message;
  onRemove: () => void;
  onClick: () => void;
  className?: string;
}

const MessagePreview: React.FC<MessagePreviewProps> = ({
  message,
  onRemove,
  onClick,
  className = ''
}) => {
  // Format timestamp
  const formatTime = (timestamp: Date | string | number) => {
    const date = new Date(timestamp);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Truncate content for preview
  const truncateContent = (content: string, maxLength: number = 100) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  // Determine sender info
  const getSenderInfo = () => {
    if (typeof message.sender === 'string') {
      return {
        name: message.sender,
        isUser: message.sender === 'You' || message.sender === 'User',
        icon: message.sender === 'You' || message.sender === 'User' ? User : Bot
      };
    }
    
    return {
      name: message.sender?.name || 'Unknown',
      isUser: message.sender?.role === 'user',
      icon: message.sender?.role === 'user' ? User : Bot
    };
  };

  const senderInfo = getSenderInfo();
  const SenderIcon = senderInfo.icon;

  return (
    <div
      className={`relative bg-gray-700 border border-gray-600 rounded-lg p-3 cursor-pointer hover:bg-gray-650 transition-colors ${className}`}
      onClick={onClick}
    >
      {/* Remove button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute top-2 right-2 p-1 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
        title="Remove reply"
      >
        <X className="h-3 w-3" />
      </button>

      {/* Reply indicator */}
      <div className="flex items-center gap-2 mb-2">
        <MessageCircle className="h-4 w-4 text-blue-400" />
        <span className="text-xs text-blue-400 font-medium">Replying to:</span>
      </div>

      {/* Sender info */}
      <div className="flex items-center gap-2 mb-2">
        <SenderIcon className={`h-4 w-4 ${senderInfo.isUser ? 'text-green-400' : 'text-purple-400'}`} />
        <span className="text-sm font-medium text-gray-300">{senderInfo.name}</span>
        <span className="text-xs text-gray-500">
          {message.timestamp ? formatTime(message.timestamp) : 'Unknown time'}
        </span>
      </div>

      {/* Message content preview */}
      <div className="text-sm text-gray-300 leading-relaxed">
        {truncateContent(message.content || 'No content')}
      </div>

      {/* Attachments indicator */}
      {message.attachments && message.attachments.length > 0 && (
        <div className="mt-2 flex items-center gap-1 text-xs text-blue-400">
          <Paperclip className="h-3 w-3" />
          <span>{message.attachments.length} attachment{message.attachments.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Click hint */}
      <div className="mt-2 text-xs text-gray-500 italic">
        Click to navigate to message
      </div>
    </div>
  );
};

export default MessagePreview; 