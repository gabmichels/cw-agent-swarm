import React from 'react';
import { render } from '@testing-library/react';
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ChatBubbleMenu from '../ChatBubbleMenu';
import { MessageImportance, MessageReliability } from '../../services/message/MessageActionService';
import { Toast } from '../ui/toast';
import { Message } from '../../types';

// Mock the services
jest.mock('../../services/message/MessageActionHandler');
jest.mock('../../services/message/ImportanceService');
jest.mock('../../services/message/KnowledgeService');
jest.mock('../../services/message/RegenerationService');
jest.mock('../../services/message/ExportService');
jest.mock('../../services/message/ReliabilityService');
jest.mock('../ui/toast');

describe('ChatBubbleMenu', () => {
  const mockMessage: Message = {
    id: 'test-message-id',
    content: 'Test message content',
    timestamp: new Date(),
    sender: {
      id: 'test-sender-id',
      name: 'Test Sender',
      role: 'user'
    }
  };

  const defaultProps = {
    message: mockMessage,
    isAssistantMessage: true,
    showVersionControls: false,
    currentVersionIndex: 0,
    totalVersions: 1
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all buttons for assistant messages', () => {
    render(<ChatBubbleMenu {...defaultProps} />);

    expect(screen.getByTitle('Copy text')).toBeInTheDocument();
    expect(screen.getByTitle('Flag as unreliable')).toBeInTheDocument();
    expect(screen.getByTitle('Regenerate response')).toBeInTheDocument();
    expect(screen.getByTitle('Flag as important')).toBeInTheDocument();
    expect(screen.getByTitle('Add to knowledge base')).toBeInTheDocument();
    expect(screen.getByTitle('Export to Coda')).toBeInTheDocument();
  });

  it('renders only relevant buttons for user messages', () => {
    render(<ChatBubbleMenu {...defaultProps} isAssistantMessage={false} />);

    expect(screen.getByTitle('Copy text')).toBeInTheDocument();
    expect(screen.getByTitle('Flag as important')).toBeInTheDocument();
    expect(screen.getByTitle('Add to knowledge base')).toBeInTheDocument();
    expect(screen.getByTitle('Export to Coda')).toBeInTheDocument();

    expect(screen.queryByTitle('Flag as unreliable')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Regenerate response')).not.toBeInTheDocument();
  });

  it('shows version controls when enabled', () => {
    render(
      <ChatBubbleMenu
        {...defaultProps}
        showVersionControls={true}
        currentVersionIndex={1}
        totalVersions={3}
      />
    );

    expect(screen.getByTitle('Previous version')).toBeInTheDocument();
    expect(screen.getByTitle('Next version')).toBeInTheDocument();
    expect(screen.getByText('2/3')).toBeInTheDocument();
  });

  it('disables version controls at boundaries', () => {
    render(
      <ChatBubbleMenu
        {...defaultProps}
        showVersionControls={true}
        currentVersionIndex={0}
        totalVersions={2}
      />
    );

    const prevButton = screen.getByTitle('Previous version');
    const nextButton = screen.getByTitle('Next version');

    expect(prevButton).toBeDisabled();
    expect(nextButton).not.toBeDisabled();
  });

  describe('Button actions', () => {
    it('copies text to clipboard', async () => {
      render(<ChatBubbleMenu {...defaultProps} />);

      await userEvent.click(screen.getByTitle('Copy text'));

      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Copied to clipboard',
          type: 'success'
        })
      );
    });

    it('flags message as unreliable', async () => {
      render(<ChatBubbleMenu {...defaultProps} />);

      await userEvent.click(screen.getByTitle('Flag as unreliable'));

      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Message marked as unreliable',
          type: 'success'
        })
      );
    });

    it('flags message as important', async () => {
      render(<ChatBubbleMenu {...defaultProps} />);

      await userEvent.click(screen.getByTitle('Flag as important'));

      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Message marked as highly important',
          type: 'success'
        })
      );
    });

    it('adds message to knowledge base', async () => {
      render(<ChatBubbleMenu {...defaultProps} />);

      await userEvent.click(screen.getByTitle('Add to knowledge base'));

      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Added to knowledge base',
          type: 'success'
        })
      );
    });

    it('exports message to Coda', async () => {
      render(<ChatBubbleMenu {...defaultProps} />);

      await userEvent.click(screen.getByTitle('Export to Coda'));

      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Exported to coda',
          type: 'success'
        })
      );
    });

    it('regenerates message', async () => {
      render(<ChatBubbleMenu {...defaultProps} />);

      await userEvent.click(screen.getByTitle('Regenerate response'));

      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Regenerating message...',
          type: 'info'
        })
      );
    });
  });

  describe('Loading states', () => {
    it('shows loading spinner during actions', async () => {
      render(<ChatBubbleMenu {...defaultProps} />);

      await userEvent.click(screen.getByTitle('Flag as important'));

      expect(screen.getByRole('button', { name: /flag as important/i })).toBeDisabled();
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();

      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });
  });

  describe('Error handling', () => {
    it('shows error toast on action failure', async () => {
      // Mock the service to fail
      jest.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('API error');
      (global.fetch as jest.Mock).mockRejectedValueOnce(error);

      render(<ChatBubbleMenu {...defaultProps} />);

      await userEvent.click(screen.getByTitle('Flag as important'));

      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Failed to flag importance: API error',
          type: 'error'
        })
      );
    });
  });
}); 