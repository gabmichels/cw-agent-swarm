import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import BookmarksTab from '../BookmarksTab';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('BookmarksTab', () => {
  const mockBookmarkedMessages = [
    {
      id: 'mem_1',
      messageId: 'msg_1',
      content: 'First bookmarked message with some content',
      timestamp: '2024-01-01T12:00:00.000Z',
      bookmarkedAt: '2024-01-01T12:30:00.000Z',
      role: 'user',
      agentId: 'agent_1',
      userId: 'user_1',
      chatId: 'chat_1',
      importance: 'high',
      tags: ['important', 'project']
    },
    {
      id: 'mem_2',
      messageId: 'msg_2',
      content: 'Second bookmarked message from assistant',
      timestamp: '2024-01-01T13:00:00.000Z',
      bookmarkedAt: '2024-01-01T13:30:00.000Z',
      role: 'assistant',
      agentId: 'agent_1',
      userId: 'user_1',
      chatId: 'chat_1',
      importance: 'medium',
      tags: ['analysis']
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial loading', () => {
    it('should display loading state initially', () => {
      mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<BookmarksTab />);

      expect(screen.getByText('Loading bookmarked messages...')).toBeInTheDocument();
      expect(screen.getByTestId('loading-spinner') || screen.getByLabelText(/loading/i)).toBeInTheDocument();
    });

    it('should load and display bookmarked messages successfully', async () => {
      const mockResponse = {
        success: true,
        messages: mockBookmarkedMessages,
        pagination: {
          total: 2,
          limit: 50,
          offset: 0,
          hasMore: false
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      render(<BookmarksTab />);

      await waitFor(() => {
        expect(screen.getByText('Bookmarked Messages')).toBeInTheDocument();
        expect(screen.getByText('(2)')).toBeInTheDocument();
      });

      expect(screen.getByText('First bookmarked message with some content')).toBeInTheDocument();
      expect(screen.getByText('Second bookmarked message from assistant')).toBeInTheDocument();
      expect(mockFetch).toHaveBeenCalledWith('/api/multi-agent/messages/bookmarks');
    });

    it('should display error state when API fails', async () => {
      const mockErrorResponse = {
        success: false,
        error: 'Failed to load bookmarked messages'
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => mockErrorResponse
      });

      render(<BookmarksTab />);

      await waitFor(() => {
        expect(screen.getByText(/Error: Failed to load bookmarked messages/)).toBeInTheDocument();
        expect(screen.getByText('Try Again')).toBeInTheDocument();
      });
    });

    it('should display error state when network error occurs', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      render(<BookmarksTab />);

      await waitFor(() => {
        expect(screen.getByText(/Error: Failed to load bookmarked messages/)).toBeInTheDocument();
      });
    });
  });

  describe('empty state', () => {
    it('should display empty state when no bookmarks exist', async () => {
      const mockResponse = {
        success: true,
        messages: [],
        pagination: {
          total: 0,
          limit: 50,
          offset: 0,
          hasMore: false
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      render(<BookmarksTab />);

      await waitFor(() => {
        expect(screen.getByText('No bookmarked messages')).toBeInTheDocument();
        expect(screen.getByText('Start bookmarking messages to see them here.')).toBeInTheDocument();
      });
    });

    it('should display filtered empty state when search has no results', async () => {
      const mockResponse = {
        success: true,
        messages: mockBookmarkedMessages,
        pagination: { total: 2, limit: 50, offset: 0, hasMore: false }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      render(<BookmarksTab />);

      await waitFor(() => {
        expect(screen.getByText('Bookmarked Messages')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search bookmarked messages...');
      await userEvent.type(searchInput, 'nonexistent');

      await waitFor(() => {
        expect(screen.getByText('No bookmarks match your search.')).toBeInTheDocument();
      });
    });
  });

  describe('search functionality', () => {
    beforeEach(async () => {
      const mockResponse = {
        success: true,
        messages: mockBookmarkedMessages,
        pagination: { total: 2, limit: 50, offset: 0, hasMore: false }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      render(<BookmarksTab />);

      await waitFor(() => {
        expect(screen.getByText('Bookmarked Messages')).toBeInTheDocument();
      });
    });

    it('should filter messages by content', async () => {
      const searchInput = screen.getByPlaceholderText('Search bookmarked messages...');
      await userEvent.type(searchInput, 'assistant');

      await waitFor(() => {
        expect(screen.getByText('Second bookmarked message from assistant')).toBeInTheDocument();
        expect(screen.queryByText('First bookmarked message with some content')).not.toBeInTheDocument();
      });
    });

    it('should filter messages by role', async () => {
      const searchInput = screen.getByPlaceholderText('Search bookmarked messages...');
      await userEvent.type(searchInput, 'user');

      await waitFor(() => {
        expect(screen.getByText('First bookmarked message with some content')).toBeInTheDocument();
        expect(screen.queryByText('Second bookmarked message from assistant')).not.toBeInTheDocument();
      });
    });

    it('should filter messages by tags', async () => {
      const searchInput = screen.getByPlaceholderText('Search bookmarked messages...');
      await userEvent.type(searchInput, 'analysis');

      await waitFor(() => {
        expect(screen.getByText('Second bookmarked message from assistant')).toBeInTheDocument();
        expect(screen.queryByText('First bookmarked message with some content')).not.toBeInTheDocument();
      });
    });

    it('should clear search when clear button is clicked', async () => {
      const searchInput = screen.getByPlaceholderText('Search bookmarked messages...');
      await userEvent.type(searchInput, 'assistant');

      await waitFor(() => {
        expect(screen.queryByText('First bookmarked message with some content')).not.toBeInTheDocument();
      });

      const clearButton = screen.getByLabelText('Clear search');
      await userEvent.click(clearButton);

      await waitFor(() => {
        expect(searchInput).toHaveValue('');
        expect(screen.getByText('First bookmarked message with some content')).toBeInTheDocument();
        expect(screen.getByText('Second bookmarked message from assistant')).toBeInTheDocument();
      });
    });

    it('should be case insensitive', async () => {
      const searchInput = screen.getByPlaceholderText('Search bookmarked messages...');
      await userEvent.type(searchInput, 'ASSISTANT');

      await waitFor(() => {
        expect(screen.getByText('Second bookmarked message from assistant')).toBeInTheDocument();
        expect(screen.queryByText('First bookmarked message with some content')).not.toBeInTheDocument();
      });
    });
  });

  describe('message display and interaction', () => {
    beforeEach(async () => {
      const mockResponse = {
        success: true,
        messages: mockBookmarkedMessages,
        pagination: { total: 2, limit: 50, offset: 0, hasMore: false }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      render(<BookmarksTab />);

      await waitFor(() => {
        expect(screen.getByText('Bookmarked Messages')).toBeInTheDocument();
      });
    });

    it('should display message metadata correctly', () => {
      // Check role icons and labels
      expect(screen.getByText('user')).toBeInTheDocument();
      expect(screen.getByText('assistant')).toBeInTheDocument();

      // Check importance badges
      expect(screen.getByText('high')).toBeInTheDocument();
      expect(screen.getByText('medium')).toBeInTheDocument();

      // Check tags
      expect(screen.getByText('important')).toBeInTheDocument();
      expect(screen.getByText('project')).toBeInTheDocument();
      expect(screen.getByText('analysis')).toBeInTheDocument();

      // Check timestamps
      expect(screen.getByText(/Message:/)).toBeInTheDocument();
      expect(screen.getByText(/Bookmarked:/)).toBeInTheDocument();
    });

    it('should expand and collapse long messages', async () => {
      const longMessage = 'a'.repeat(300); // Create a long message
      const mockResponseWithLongMessage = {
        success: true,
        messages: [{
          ...mockBookmarkedMessages[0],
          content: longMessage
        }],
        pagination: { total: 1, limit: 50, offset: 0, hasMore: false }
      };

      mockFetch.mockClear();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponseWithLongMessage
      });

      render(<BookmarksTab />);

      await waitFor(() => {
        expect(screen.getByText('Show more')).toBeInTheDocument();
      });

      const showMoreButton = screen.getByText('Show more');
      await userEvent.click(showMoreButton);

      await waitFor(() => {
        expect(screen.getByText('Show less')).toBeInTheDocument();
      });

      const showLessButton = screen.getByText('Show less');
      await userEvent.click(showLessButton);

      await waitFor(() => {
        expect(screen.getByText('Show more')).toBeInTheDocument();
      });
    });

    it('should remove bookmark when remove button is clicked', async () => {
      const mockRemoveResponse = {
        success: true,
        data: {
          messageId: 'msg_1',
          isBookmarked: false
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRemoveResponse
      });

      const removeButtons = screen.getAllByTitle('Remove bookmark');
      await userEvent.click(removeButtons[0]);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/multi-agent/messages/bookmark', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messageId: 'msg_1',
            isBookmarked: false
          }),
        });
      });

      // Message should be removed from the list
      await waitFor(() => {
        expect(screen.queryByText('First bookmarked message with some content')).not.toBeInTheDocument();
      });
    });

    it('should handle remove bookmark error gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const removeButtons = screen.getAllByTitle('Remove bookmark');
      await userEvent.click(removeButtons[0]);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Error removing bookmark:', expect.any(Error));
      });

      // Message should still be in the list
      expect(screen.getByText('First bookmarked message with some content')).toBeInTheDocument();

      consoleSpy.mockRestore();
    });
  });

  describe('refresh functionality', () => {
    it('should reload bookmarks when refresh button is clicked', async () => {
      const mockResponse = {
        success: true,
        messages: mockBookmarkedMessages,
        pagination: { total: 2, limit: 50, offset: 0, hasMore: false }
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      });

      render(<BookmarksTab />);

      await waitFor(() => {
        expect(screen.getByText('Bookmarked Messages')).toBeInTheDocument();
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);

      const refreshButton = screen.getByTitle('Refresh bookmarks');
      await userEvent.click(refreshButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });
    });

    it('should retry loading when Try Again button is clicked', async () => {
      // First call fails
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      render(<BookmarksTab />);

      await waitFor(() => {
        expect(screen.getByText('Try Again')).toBeInTheDocument();
      });

      // Second call succeeds
      const mockResponse = {
        success: true,
        messages: mockBookmarkedMessages,
        pagination: { total: 2, limit: 50, offset: 0, hasMore: false }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const tryAgainButton = screen.getByText('Try Again');
      await userEvent.click(tryAgainButton);

      await waitFor(() => {
        expect(screen.getByText('Bookmarked Messages')).toBeInTheDocument();
        expect(screen.getByText('First bookmarked message with some content')).toBeInTheDocument();
      });
    });
  });

  describe('navigation functionality', () => {
    it('should call onSelectMessage when Go to message is clicked', async () => {
      const mockOnSelectMessage = vi.fn();

      const mockResponse = {
        success: true,
        messages: mockBookmarkedMessages,
        pagination: { total: 2, limit: 50, offset: 0, hasMore: false }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      render(<BookmarksTab onSelectMessage={mockOnSelectMessage} />);

      await waitFor(() => {
        expect(screen.getByText('Bookmarked Messages')).toBeInTheDocument();
      });

      const goToMessageButtons = screen.getAllByText('Go to message');
      await userEvent.click(goToMessageButtons[0]);

      expect(mockOnSelectMessage).toHaveBeenCalledWith('msg_1');
    });

    it('should not display Go to message button when onSelectMessage is not provided', async () => {
      const mockResponse = {
        success: true,
        messages: mockBookmarkedMessages,
        pagination: { total: 2, limit: 50, offset: 0, hasMore: false }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      render(<BookmarksTab />);

      await waitFor(() => {
        expect(screen.getByText('Bookmarked Messages')).toBeInTheDocument();
      });

      expect(screen.queryByText('Go to message')).not.toBeInTheDocument();
    });
  });

  describe('performance and edge cases', () => {
    it('should handle messages without tags gracefully', async () => {
      const messagesWithoutTags = mockBookmarkedMessages.map(msg => ({
        ...msg,
        tags: undefined
      }));

      const mockResponse = {
        success: true,
        messages: messagesWithoutTags,
        pagination: { total: 2, limit: 50, offset: 0, hasMore: false }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      render(<BookmarksTab />);

      await waitFor(() => {
        expect(screen.getByText('Bookmarked Messages')).toBeInTheDocument();
        expect(screen.getByText('First bookmarked message with some content')).toBeInTheDocument();
      });

      // Should not display any tag elements
      expect(screen.queryByText('important')).not.toBeInTheDocument();
      expect(screen.queryByText('analysis')).not.toBeInTheDocument();
    });

    it('should handle messages without importance gracefully', async () => {
      const messagesWithoutImportance = mockBookmarkedMessages.map(msg => ({
        ...msg,
        importance: undefined
      }));

      const mockResponse = {
        success: true,
        messages: messagesWithoutImportance,
        pagination: { total: 2, limit: 50, offset: 0, hasMore: false }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      render(<BookmarksTab />);

      await waitFor(() => {
        expect(screen.getByText('Bookmarked Messages')).toBeInTheDocument();
      });

      // Should not display importance badges
      expect(screen.queryByText('high')).not.toBeInTheDocument();
      expect(screen.queryByText('medium')).not.toBeInTheDocument();
    });

    it('should handle invalid date strings gracefully', async () => {
      const messagesWithInvalidDates = mockBookmarkedMessages.map(msg => ({
        ...msg,
        timestamp: 'invalid-date',
        bookmarkedAt: 'also-invalid'
      }));

      const mockResponse = {
        success: true,
        messages: messagesWithInvalidDates,
        pagination: { total: 2, limit: 50, offset: 0, hasMore: false }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      render(<BookmarksTab />);

      await waitFor(() => {
        expect(screen.getByText('Bookmarked Messages')).toBeInTheDocument();
      });

      // Should display the invalid date strings as-is
      expect(screen.getByText(/invalid-date/)).toBeInTheDocument();
      expect(screen.getByText(/also-invalid/)).toBeInTheDocument();
    });

    it('should handle very long message content performance', async () => {
      const veryLongMessage = 'a'.repeat(10000);
      const messageWithLongContent = {
        ...mockBookmarkedMessages[0],
        content: veryLongMessage
      };

      const mockResponse = {
        success: true,
        messages: [messageWithLongContent],
        pagination: { total: 1, limit: 50, offset: 0, hasMore: false }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const startTime = Date.now();
      render(<BookmarksTab />);

      await waitFor(() => {
        expect(screen.getByText('Bookmarked Messages')).toBeInTheDocument();
      });

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(2000); // Should render within 2 seconds
    });
  });
}); 