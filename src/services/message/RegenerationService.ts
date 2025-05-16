import { MessageActionResult, MessageActionOptions } from './MessageActionService';

export interface RegenerationOptions {
  avoidContent?: string;
  instructions?: string;
  maxAttempts?: number;
}

export interface RegenerationServiceOptions {
  onRegenerationStarted?: (messageId: string) => void;
  onRegenerationComplete?: (messageId: string, newContent: string) => void;
  onRegenerationError?: (messageId: string, error: string) => void;
}

export class RegenerationService {
  private readonly DEFAULT_MAX_ATTEMPTS = 3;

  constructor(private options?: RegenerationServiceOptions) {}

  async regenerateMessage(
    options: MessageActionOptions & RegenerationOptions
  ): Promise<MessageActionResult> {
    const maxAttempts = options.maxAttempts || this.DEFAULT_MAX_ATTEMPTS;
    let attempts = 0;

    // Notify listeners that regeneration has started
    if (this.options?.onRegenerationStarted) {
      this.options.onRegenerationStarted(options.messageId);
    }

    while (attempts < maxAttempts) {
      try {
        const response = await fetch('/api/multi-agent/messages/regenerate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messageId: options.messageId,
            timestamp: options.timestamp,
            content: options.content,
            avoidContent: options.avoidContent,
            instructions: options.instructions
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to regenerate message');
        }

        // Notify listeners of successful regeneration
        if (this.options?.onRegenerationComplete) {
          this.options.onRegenerationComplete(options.messageId, data.content);
        }

        return {
          success: true,
          data: {
            content: data.content,
            attempt: attempts + 1
          }
        };
      } catch (error) {
        attempts++;
        
        // If we've exhausted all attempts, notify listeners and return error
        if (attempts === maxAttempts) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          
          if (this.options?.onRegenerationError) {
            this.options.onRegenerationError(options.messageId, errorMessage);
          }

          return {
            success: false,
            error: errorMessage
          };
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
      }
    }

    // This should never be reached due to the return in the error case above
    return {
      success: false,
      error: 'Maximum regeneration attempts exceeded'
    };
  }

  async getRegenerationHistory(messageId: string): Promise<string[]> {
    try {
      const response = await fetch(`/api/multi-agent/messages/${messageId}/regeneration-history`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get regeneration history');
      }

      return data.history;
    } catch (error) {
      console.error('Error getting regeneration history:', error);
      return [];
    }
  }
} 