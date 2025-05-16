import { MessageActionResult, MessageActionOptions } from './MessageActionService';

export interface ExportFormat {
  markdown: 'markdown';
  plain: 'plain';
}

export interface ExportOptions {
  title?: string;
  format?: keyof ExportFormat;
  platform: 'coda' | 'notion' | 'other';
}

export interface ExportServiceOptions {
  onExportStarted?: (messageId: string, platform: string) => void;
  onExportComplete?: (messageId: string, platform: string, url: string) => void;
  onExportError?: (messageId: string, platform: string, error: string) => void;
}

export class ExportService {
  constructor(private options?: ExportServiceOptions) {}

  async exportToCoda(
    options: MessageActionOptions & { 
      title?: string;
      format?: keyof ExportFormat;
    }
  ): Promise<MessageActionResult> {
    return this.export({
      ...options,
      platform: 'coda'
    });
  }

  private async export(
    options: MessageActionOptions & ExportOptions
  ): Promise<MessageActionResult> {
    // Notify listeners that export has started
    if (this.options?.onExportStarted) {
      this.options.onExportStarted(options.messageId, options.platform);
    }

    try {
      const response = await fetch(`/api/multi-agent/export/${options.platform}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messageId: options.messageId,
          timestamp: options.timestamp,
          content: options.content,
          title: options.title,
          format: options.format
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to export to ${options.platform}`);
      }

      // Notify listeners of successful export
      if (this.options?.onExportComplete) {
        this.options.onExportComplete(options.messageId, options.platform, data.url);
      }

      return {
        success: true,
        data: {
          url: data.url,
          title: data.title
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      // Notify listeners of export error
      if (this.options?.onExportError) {
        this.options.onExportError(options.messageId, options.platform, errorMessage);
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  async getExportHistory(messageId: string): Promise<{
    platform: string;
    url: string;
    timestamp: Date;
  }[]> {
    try {
      const response = await fetch(`/api/multi-agent/messages/${messageId}/export-history`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get export history');
      }

      return data.history;
    } catch (error) {
      console.error('Error getting export history:', error);
      return [];
    }
  }
} 