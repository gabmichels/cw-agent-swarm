import { 
  MessageActionService, 
  MessageActionResult, 
  MessageActionOptions, 
  MessageImportance,
  MessageReliability
} from './MessageActionService';

export class MessageActionHandler implements MessageActionService {
  private async makeRequest(endpoint: string, method: string, body: unknown): Promise<MessageActionResult> {
    try {
      const response = await fetch(`/api/multi-agent/${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Request failed');
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

  async flagImportance(options: MessageActionOptions & { importance: MessageImportance }): Promise<MessageActionResult> {
    return this.makeRequest('messages/flag-importance', 'POST', {
      messageId: options.messageId,
      timestamp: options.timestamp,
      content: options.content,
      importance: options.importance
    });
  }

  async flagReliability(options: MessageActionOptions & { reliability: MessageReliability }): Promise<MessageActionResult> {
    return this.makeRequest('messages/flag-reliability', 'POST', {
      messageId: options.messageId,
      timestamp: options.timestamp,
      content: options.content,
      reliability: options.reliability
    });
  }

  async addToKnowledge(options: MessageActionOptions & { tags?: string[]; category?: string; }): Promise<MessageActionResult> {
    return this.makeRequest('knowledge/add', 'POST', {
      messageId: options.messageId,
      timestamp: options.timestamp,
      content: options.content,
      tags: options.tags,
      category: options.category
    });
  }

  async regenerateMessage(options: MessageActionOptions & { avoidContent?: string; instructions?: string; }): Promise<MessageActionResult> {
    return this.makeRequest('messages/regenerate', 'POST', {
      messageId: options.messageId,
      timestamp: options.timestamp,
      content: options.content,
      avoidContent: options.avoidContent,
      instructions: options.instructions
    });
  }

  async exportToCoda(options: MessageActionOptions & { title?: string; format?: 'markdown' | 'plain'; }): Promise<MessageActionResult> {
    return this.makeRequest('export/coda', 'POST', {
      messageId: options.messageId,
      timestamp: options.timestamp,
      content: options.content,
      title: options.title,
      format: options.format
    });
  }

  async deleteMessage(options: Pick<MessageActionOptions, 'messageId' | 'timestamp'>): Promise<MessageActionResult> {
    return this.makeRequest(`messages/${options.messageId}`, 'DELETE', {
      timestamp: options.timestamp
    });
  }

  async copyMessage(options: Pick<MessageActionOptions, 'content'>): Promise<MessageActionResult> {
    try {
      await navigator.clipboard.writeText(options.content);
      return {
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to copy to clipboard'
      };
    }
  }
} 