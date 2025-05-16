import { MessageActionResult, MessageActionOptions } from './MessageActionService';

export interface KnowledgeEntry {
  id: string;
  content: string;
  tags: string[];
  category?: string;
  timestamp: Date;
  messageId: string;
}

export interface KnowledgeServiceOptions {
  onKnowledgeAdded?: (entry: KnowledgeEntry) => void;
  onKnowledgeRemoved?: (entryId: string) => void;
}

export class KnowledgeService {
  constructor(private options?: KnowledgeServiceOptions) {}

  async addToKnowledge(
    options: MessageActionOptions & { 
      tags?: string[];
      category?: string;
    }
  ): Promise<MessageActionResult> {
    try {
      const response = await fetch('/api/multi-agent/knowledge/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messageId: options.messageId,
          timestamp: options.timestamp,
          content: options.content,
          tags: options.tags,
          category: options.category
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add to knowledge base');
      }

      const entry: KnowledgeEntry = {
        id: data.id,
        content: options.content,
        tags: options.tags || [],
        category: options.category,
        timestamp: options.timestamp,
        messageId: options.messageId
      };

      // Notify listeners of new knowledge entry
      if (this.options?.onKnowledgeAdded) {
        this.options.onKnowledgeAdded(entry);
      }

      return {
        success: true,
        data: entry
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  async removeFromKnowledge(entryId: string): Promise<MessageActionResult> {
    try {
      const response = await fetch(`/api/multi-agent/knowledge/${entryId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove from knowledge base');
      }

      // Notify listeners of knowledge entry removal
      if (this.options?.onKnowledgeRemoved) {
        this.options.onKnowledgeRemoved(entryId);
      }

      return {
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  async getKnowledgeEntries(messageId: string): Promise<KnowledgeEntry[]> {
    try {
      const response = await fetch(`/api/multi-agent/knowledge/message/${messageId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get knowledge entries');
      }

      return data.entries;
    } catch (error) {
      console.error('Error getting knowledge entries:', error);
      return [];
    }
  }
} 