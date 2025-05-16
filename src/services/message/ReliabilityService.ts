import { MessageActionResult, MessageActionOptions, MessageReliability } from './MessageActionService';

export interface ReliabilityServiceOptions {
  onReliabilityChange?: (messageId: string, reliability: MessageReliability) => void;
}

export class ReliabilityService {
  constructor(private options?: ReliabilityServiceOptions) {}

  async flagReliability(
    options: MessageActionOptions & { reliability: MessageReliability }
  ): Promise<MessageActionResult> {
    try {
      const response = await fetch('/api/multi-agent/messages/flag-reliability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messageId: options.messageId,
          timestamp: options.timestamp,
          content: options.content,
          reliability: options.reliability
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to flag reliability');
      }

      // Notify listeners of reliability change
      if (this.options?.onReliabilityChange) {
        this.options.onReliabilityChange(options.messageId, options.reliability);
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

  async getMessageReliability(messageId: string): Promise<MessageReliability> {
    try {
      const response = await fetch(`/api/multi-agent/messages/${messageId}/reliability`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get message reliability');
      }

      return data.reliability;
    } catch (error) {
      console.error('Error getting message reliability:', error);
      return MessageReliability.UNKNOWN;
    }
  }

  async getReliabilityStats(messageId: string): Promise<{
    totalFlags: number;
    reliableCount: number;
    unreliableCount: number;
    lastUpdated: Date;
  }> {
    try {
      const response = await fetch(`/api/multi-agent/messages/${messageId}/reliability-stats`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get reliability stats');
      }

      return {
        totalFlags: data.totalFlags,
        reliableCount: data.reliableCount,
        unreliableCount: data.unreliableCount,
        lastUpdated: new Date(data.lastUpdated)
      };
    } catch (error) {
      console.error('Error getting reliability stats:', error);
      return {
        totalFlags: 0,
        reliableCount: 0,
        unreliableCount: 0,
        lastUpdated: new Date()
      };
    }
  }
} 