import { MessageActionResult, MessageActionOptions } from './MessageActionService';

export interface BookmarkServiceOptions {
  onBookmarkChange?: (messageId: string, isBookmarked: boolean) => void;
}

export class BookmarkService {
  constructor(private options?: BookmarkServiceOptions) {}

  async toggleBookmark(
    options: MessageActionOptions & { isBookmarked: boolean }
  ): Promise<MessageActionResult> {
    try {
      const requestBody = {
        messageId: options.messageId,
        timestamp: options.timestamp,
        content: options.content,
        isBookmarked: options.isBookmarked
      };
      
      const response = await fetch('/api/multi-agent/messages/bookmark', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update bookmark');
      }

      // Notify listeners of bookmark change
      if (this.options?.onBookmarkChange) {
        this.options.onBookmarkChange(options.messageId, options.isBookmarked);
      }

      return {
        success: true,
        data: data.data
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  async getMessageBookmarkStatus(messageId: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/multi-agent/messages/bookmark?messageId=${messageId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get bookmark status');
      }

      return data.isBookmarked || false;
    } catch (error) {
      console.error('Error getting bookmark status:', error);
      return false; // Default to not bookmarked
    }
  }

  async getBookmarkedMessages(): Promise<MessageActionResult> {
    try {
      const response = await fetch('/api/multi-agent/messages/bookmarks');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get bookmarked messages');
      }

      return {
        success: true,
        data: data.messages || []
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
} 