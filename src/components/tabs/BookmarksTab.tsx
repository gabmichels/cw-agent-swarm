import React, { useState, useEffect, useCallback } from 'react';
import { Bookmark, RefreshCw, Clock, User, Bot, Search, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Message } from '../../types';
import MarkdownRenderer from '../MarkdownRenderer';

interface BookmarkedMessage {
  id: string;
  messageId: string;
  content: string;
  timestamp: string;
  bookmarkedAt: string;
  role: string;
  agentId?: string;
  userId?: string;
  chatId?: string;
  importance?: string;
  tags?: string[];
}

interface BookmarksTabProps {
  onSelectMessage?: (messageId: string) => void;
}

const BookmarksTab: React.FC<BookmarksTabProps> = ({ onSelectMessage }) => {
  const [bookmarkedMessages, setBookmarkedMessages] = useState<BookmarkedMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());

  const loadBookmarkedMessages = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/multi-agent/messages/bookmarks');
      const data = await response.json();
      
      if (data.success) {
        setBookmarkedMessages(data.messages || []);
      } else {
        setError(data.error || 'Failed to load bookmarked messages');
      }
    } catch (err) {
      console.error('Error loading bookmarked messages:', err);
      setError('Failed to load bookmarked messages');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBookmarkedMessages();
  }, [loadBookmarkedMessages]);

  const handleRemoveBookmark = async (messageId: string) => {
    try {
      const response = await fetch('/api/multi-agent/messages/bookmark', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messageId,
          isBookmarked: false
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        // Remove from local state
        setBookmarkedMessages(prev => prev.filter(msg => msg.messageId !== messageId));
      } else {
        console.error('Failed to remove bookmark:', data.error);
      }
    } catch (error) {
      console.error('Error removing bookmark:', error);
    }
  };

  const toggleMessageExpansion = (messageId: string) => {
    setExpandedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  const filteredMessages = bookmarkedMessages.filter(message =>
    message.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    message.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (message.tags && message.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const truncateContent = (content: string, maxLength: number = 200) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-gray-400">
        <RefreshCw className="h-8 w-8 animate-spin mb-4" />
        <p>Loading bookmarked messages...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-red-400">
        <p className="mb-4">Error: {error}</p>
        <button
          onClick={loadBookmarkedMessages}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Bookmark className="h-5 w-5 text-yellow-400" />
            <h2 className="text-lg font-semibold">Bookmarked Messages</h2>
            <span className="text-sm text-gray-400">({filteredMessages.length})</span>
          </div>
          <button
            onClick={loadBookmarkedMessages}
            className="p-2 rounded hover:bg-gray-800 transition-colors"
            title="Refresh bookmarks"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search bookmarked messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-md pl-10 pr-10 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Bookmark className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg mb-2">No bookmarked messages</p>
            <p className="text-sm">
              {searchQuery 
                ? 'No bookmarks match your search.' 
                : 'Start bookmarking messages to see them here.'
              }
            </p>
          </div>
        ) : (
          filteredMessages.map((message) => {
            const isExpanded = expandedMessages.has(message.messageId);
            const shouldTruncate = message.content.length > 200;
            
            return (
              <div
                key={message.id || message.messageId || `bookmark-${Math.random()}`}
                className="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors"
              >
                {/* Message Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    {message.role === 'assistant' ? (
                      <Bot className="h-4 w-4 text-blue-400" />
                    ) : (
                      <User className="h-4 w-4 text-green-400" />
                    )}
                    <span className="text-sm font-medium capitalize">
                      {message.role}
                    </span>
                    {message.importance && (
                      <span className={`text-xs px-2 py-1 rounded ${
                        message.importance === 'high' 
                          ? 'bg-red-900 text-red-300'
                          : message.importance === 'medium'
                          ? 'bg-yellow-900 text-yellow-300'
                          : 'bg-gray-900 text-gray-300'
                      }`}>
                        {message.importance}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveBookmark(message.messageId)}
                    className="p-1 rounded hover:bg-gray-700 transition-colors text-yellow-400 hover:text-yellow-300"
                    title="Remove bookmark"
                  >
                    <Bookmark className="h-4 w-4 fill-current" />
                  </button>
                </div>

                {/* Message Content */}
                <div className="mb-3">
                  <MarkdownRenderer
                    content={isExpanded || !shouldTruncate 
                      ? message.content 
                      : truncateContent(message.content)
                    }
                    className="w-full"
                  />
                  
                  {shouldTruncate && (
                    <button
                      onClick={() => toggleMessageExpansion(message.messageId)}
                      className="mt-2 flex items-center space-x-1 text-blue-400 hover:text-blue-300 text-sm"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="h-4 w-4" />
                          <span>Show less</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4" />
                          <span>Show more</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Tags */}
                {message.tags && message.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {message.tags.map((tag, index) => (
                      <span
                        key={`${message.messageId || message.id}-tag-${index}-${tag}`}
                        className="text-xs bg-blue-900 text-blue-300 px-2 py-1 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Message Footer */}
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-1">
                      <Clock className="h-3 w-3" />
                      <span>Message: {formatDate(message.timestamp)}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Bookmark className="h-3 w-3" />
                      <span>Bookmarked: {formatDate(message.bookmarkedAt)}</span>
                    </div>
                  </div>
                  {onSelectMessage && (
                    <button
                      onClick={() => {
                        console.log('BookmarksTab: Calling onSelectMessage with:', message.messageId, 'message object:', message);
                        onSelectMessage(message.messageId);
                      }}
                      className="text-blue-400 hover:text-blue-300 hover:underline"
                    >
                      Go to message
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default BookmarksTab; 