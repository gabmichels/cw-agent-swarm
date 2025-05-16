import { MessageActionResult, MessageActionOptions, MessageImportance } from './MessageActionService';

export interface ImportanceServiceOptions {
  onImportanceChange?: (messageId: string, importance: MessageImportance) => void;
}

export class ImportanceService {
  constructor(private options?: ImportanceServiceOptions) {}

  async flagImportance(
    options: MessageActionOptions & { importance: MessageImportance }
  ): Promise<MessageActionResult> {
    try {
      const response = await fetch('/api/multi-agent/messages/flag-importance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messageId: options.messageId,
          timestamp: options.timestamp,
          content: options.content,
          importance: options.importance
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to flag importance');
      }

      // Notify listeners of importance change
      if (this.options?.onImportanceChange) {
        this.options.onImportanceChange(options.messageId, options.importance);
      }

      return {
        success: true,
        data
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  async getMessageImportance(messageId: string): Promise<MessageImportance> {
    try {
      const response = await fetch(`/api/multi-agent/messages/${messageId}/importance`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get message importance');
      }

      return data.importance;
    } catch (error) {
      console.error('Error getting message importance:', error);
      return MessageImportance.MEDIUM; // Default importance
    }
  }
} 