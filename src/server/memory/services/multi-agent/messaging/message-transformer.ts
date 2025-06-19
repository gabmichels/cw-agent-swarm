/**
 * Message Transformer
 * 
 * This component is responsible for transforming messages between different formats
 * based on agent capabilities and requirements. It adapts message content to be 
 * compatible with different agent types.
 */

import { StructuredId } from '../../../../../utils/ulid';
import { AnyMemoryService } from '../../memory/memory-service-wrappers';
import { MemoryType } from '@/server/memory/config/types';

/**
 * Message format types supported by the system
 */
export enum MessageFormat {
  TEXT = 'text',
  MARKDOWN = 'markdown',
  JSON = 'json',
  HTML = 'html',
  STRUCTURED = 'structured'
}

/**
 * Content enrichment types
 */
export enum EnrichmentType {
  CONTEXT = 'context',
  METADATA = 'metadata',
  HISTORY = 'history',
  CAPABILITIES = 'capabilities',
  KNOWLEDGE = 'knowledge'
}

/**
 * Message transformation options
 */
export interface TransformationOptions {
  sourceFormat: MessageFormat;
  targetFormat: MessageFormat;
  preserveFormatting?: boolean;
  includeMetadata?: boolean;
  enrichments?: EnrichmentType[];
  maxLength?: number;
  contextDepth?: number;
}

/**
 * Message to be transformed
 */
export interface TransformableMessage {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  format: MessageFormat;
  metadata?: Record<string, unknown>;
  contextItems?: ContextItem[];
}

/**
 * Context item for message enrichment
 */
export interface ContextItem {
  type: string;
  content: string | Record<string, unknown>;
  relevance?: number; // 0.0 to 1.0
  source?: string;
}

/**
 * Result of a transformation operation
 */
export interface TransformationResult {
  success: boolean;
  originalMessage: TransformableMessage;
  transformedMessage: TransformableMessage;
  warnings?: string[];
  errors?: string[];
}

/**
 * Extended search memory params with sort option
 */
interface ExtendedSearchMemoryParams {
  type: MemoryType;
  filter?: Record<string, unknown>;
  limit?: number;
  sort?: {
    field: string;
    direction: 'asc' | 'desc';
  };
}

/**
 * Interface for message transformation components
 */
export interface IMessageTransformer {
  /**
   * Transform a message from one format to another
   */
  transformMessage(
    message: TransformableMessage,
    options: TransformationOptions
  ): Promise<TransformationResult>;
  
  /**
   * Enrich a message with additional context
   */
  enrichMessage(
    message: TransformableMessage, 
    enrichmentTypes: EnrichmentType[]
  ): Promise<TransformationResult>;
  
  /**
   * Get supported transformation paths
   */
  getSupportedTransformations(): Promise<Array<{
    sourceFormat: MessageFormat;
    targetFormat: MessageFormat;
  }>>;
}

/**
 * Message Transformer implementation
 */
export class MessageTransformer implements IMessageTransformer {
  // Define memory type constants for consistency
  private readonly MEMORY_TYPE_AGENT = 'agent' as MemoryType;
  
  /**
   * Create a new message transformer
   */
  constructor(
    private readonly memoryService: AnyMemoryService
  ) {}
  
  /**
   * Transform a message from one format to another
   */
  async transformMessage(
    message: TransformableMessage,
    options: TransformationOptions
  ): Promise<TransformationResult> {
    try {
      // Check if the transformation is supported
      const supported = await this.isTransformationSupported(
        options.sourceFormat,
        options.targetFormat
      );
      
      if (!supported) {
        return {
          success: false,
          originalMessage: message,
          transformedMessage: message,
          errors: [`Transformation from ${options.sourceFormat} to ${options.targetFormat} is not supported`]
        };
      }
      
      // Apply the transformation
      const transformedContent = await this.applyTransformation(
        message.content,
        options
      );
      
      // Apply enrichments if requested
      let contextItems = message.contextItems || [];
      if (options.enrichments && options.enrichments.length > 0) {
        const enrichmentResult = await this.enrichMessage(
          message,
          options.enrichments
        );
        
        if (enrichmentResult.success) {
          contextItems = enrichmentResult.transformedMessage.contextItems || [];
        }
      }
      
      // Create the transformed message
      const transformedMessage: TransformableMessage = {
        id: message.id,
        senderId: message.senderId,
        recipientId: message.recipientId,
        content: transformedContent,
        format: options.targetFormat,
        metadata: options.includeMetadata ? message.metadata : undefined,
        contextItems: contextItems
      };
      
      return {
        success: true,
        originalMessage: message,
        transformedMessage
      };
    } catch (error) {
      console.error('Error transforming message:', error);
      return {
        success: false,
        originalMessage: message,
        transformedMessage: message,
        errors: [error instanceof Error ? error.message : 'Unknown transformation error']
      };
    }
  }
  
  /**
   * Enrich a message with additional context
   */
  async enrichMessage(
    message: TransformableMessage, 
    enrichmentTypes: EnrichmentType[]
  ): Promise<TransformationResult> {
    try {
      // Start with existing context items
      const contextItems = [...(message.contextItems || [])];
      const warnings: string[] = [];
      
      // Apply each requested enrichment
      for (const enrichmentType of enrichmentTypes) {
        try {
          const newContextItems = await this.applyEnrichment(
            message,
            enrichmentType
          );
          
          contextItems.push(...newContextItems);
        } catch (error) {
          warnings.push(`Failed to apply enrichment ${enrichmentType}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      // Create the enriched message
      const transformedMessage: TransformableMessage = {
        ...message,
        contextItems
      };
      
      return {
        success: true,
        originalMessage: message,
        transformedMessage,
        warnings: warnings.length > 0 ? warnings : undefined
      };
    } catch (error) {
      console.error('Error enriching message:', error);
      return {
        success: false,
        originalMessage: message,
        transformedMessage: message,
        errors: [error instanceof Error ? error.message : 'Unknown enrichment error']
      };
    }
  }
  
  /**
   * Get supported transformation paths
   */
  async getSupportedTransformations(): Promise<Array<{
    sourceFormat: MessageFormat;
    targetFormat: MessageFormat;
  }>> {
    // Define supported transformations
    return [
      { sourceFormat: MessageFormat.TEXT, targetFormat: MessageFormat.MARKDOWN },
      { sourceFormat: MessageFormat.TEXT, targetFormat: MessageFormat.HTML },
      { sourceFormat: MessageFormat.TEXT, targetFormat: MessageFormat.JSON },
      
      { sourceFormat: MessageFormat.MARKDOWN, targetFormat: MessageFormat.TEXT },
      { sourceFormat: MessageFormat.MARKDOWN, targetFormat: MessageFormat.HTML },
      
      { sourceFormat: MessageFormat.JSON, targetFormat: MessageFormat.TEXT },
      { sourceFormat: MessageFormat.JSON, targetFormat: MessageFormat.STRUCTURED },
      
      { sourceFormat: MessageFormat.HTML, targetFormat: MessageFormat.TEXT },
      { sourceFormat: MessageFormat.HTML, targetFormat: MessageFormat.MARKDOWN },
      
      { sourceFormat: MessageFormat.STRUCTURED, targetFormat: MessageFormat.JSON },
      { sourceFormat: MessageFormat.STRUCTURED, targetFormat: MessageFormat.TEXT }
    ];
  }
  
  /**
   * Private: Check if a transformation is supported
   */
  private async isTransformationSupported(
    sourceFormat: MessageFormat,
    targetFormat: MessageFormat
  ): Promise<boolean> {
    // If source and target are the same, it's always supported
    if (sourceFormat === targetFormat) {
      return true;
    }
    
    // Get the list of supported transformations
    const supportedTransformations = await this.getSupportedTransformations();
    
    // Check if the requested transformation is in the list
    return supportedTransformations.some(
      t => t.sourceFormat === sourceFormat && t.targetFormat === targetFormat
    );
  }
  
  /**
   * Private: Apply transformation to message content
   */
  private async applyTransformation(
    content: string,
    options: TransformationOptions
  ): Promise<string> {
    const { sourceFormat, targetFormat, preserveFormatting, maxLength } = options;
    
    // If source and target are the same, return the content as is
    if (sourceFormat === targetFormat) {
      return this.truncateContent(content, maxLength);
    }
    
    // Apply the appropriate transformation based on source and target formats
    switch (`${sourceFormat}_to_${targetFormat}`) {
      case `${MessageFormat.TEXT}_to_${MessageFormat.MARKDOWN}`:
        return this.truncateContent(this.textToMarkdown(content, preserveFormatting), maxLength);
        
      case `${MessageFormat.TEXT}_to_${MessageFormat.HTML}`:
        return this.truncateContent(this.textToHtml(content, preserveFormatting), maxLength);
        
      case `${MessageFormat.TEXT}_to_${MessageFormat.JSON}`:
        return this.truncateContent(this.textToJson(content), maxLength);
        
      case `${MessageFormat.MARKDOWN}_to_${MessageFormat.TEXT}`:
        return this.truncateContent(this.markdownToText(content), maxLength);
        
      case `${MessageFormat.MARKDOWN}_to_${MessageFormat.HTML}`:
        return this.truncateContent(this.markdownToHtml(content), maxLength);
        
      case `${MessageFormat.JSON}_to_${MessageFormat.TEXT}`:
        return this.truncateContent(this.jsonToText(content), maxLength);
        
      case `${MessageFormat.JSON}_to_${MessageFormat.STRUCTURED}`:
        return this.truncateContent(this.jsonToStructured(content), maxLength);
        
      case `${MessageFormat.HTML}_to_${MessageFormat.TEXT}`:
        return this.truncateContent(this.htmlToText(content), maxLength);
        
      case `${MessageFormat.HTML}_to_${MessageFormat.MARKDOWN}`:
        return this.truncateContent(this.htmlToMarkdown(content), maxLength);
        
      case `${MessageFormat.STRUCTURED}_to_${MessageFormat.JSON}`:
        return this.truncateContent(this.structuredToJson(content), maxLength);
        
      case `${MessageFormat.STRUCTURED}_to_${MessageFormat.TEXT}`:
        return this.truncateContent(this.structuredToText(content), maxLength);
        
      default:
        throw new Error(`Unsupported transformation: ${sourceFormat} to ${targetFormat}`);
    }
  }
  
  /**
   * Private: Apply enrichment to a message
   */
  private async applyEnrichment(
    message: TransformableMessage,
    enrichmentType: EnrichmentType
  ): Promise<ContextItem[]> {
    switch (enrichmentType) {
      case EnrichmentType.CONTEXT:
        return this.enrichWithContext(message);
        
      case EnrichmentType.METADATA:
        return this.enrichWithMetadata(message);
        
      case EnrichmentType.HISTORY:
        return this.enrichWithHistory(message);
        
      case EnrichmentType.CAPABILITIES:
        return this.enrichWithCapabilities(message);
        
      case EnrichmentType.KNOWLEDGE:
        return this.enrichWithKnowledge(message);
        
      default:
        throw new Error(`Unsupported enrichment type: ${enrichmentType}`);
    }
  }
  
  // Transformation methods
  
  /**
   * Transform text to markdown
   */
  private textToMarkdown(content: string, preserveFormatting = true): string {
    // Simple implementation - in a real scenario, this would be more sophisticated
    if (!preserveFormatting) {
      return content;
    }
    
    // Add markdown paragraph formatting
    return content
      .split('\n\n')
      .map(paragraph => paragraph.trim())
      .filter(paragraph => paragraph.length > 0)
      .join('\n\n');
  }
  
  /**
   * Transform text to HTML
   */
  private textToHtml(content: string, preserveFormatting = true): string {
    if (!preserveFormatting) {
      return content;
    }
    
    // Replace newlines with <br> and wrap paragraphs in <p> tags
    return content
      .split('\n\n')
      .map(paragraph => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
      .join('');
  }
  
  /**
   * Transform text to JSON
   */
  private textToJson(content: string): string {
    // Simple text-to-JSON transformation
    return JSON.stringify({ text: content });
  }
  
  /**
   * Transform markdown to text
   */
  private markdownToText(content: string): string {
    // Simple markdown-to-text transformation
    // Remove common markdown syntax
    return content
      .replace(/#{1,6}\s+/g, '') // headers
      .replace(/\*\*(.*?)\*\*/g, '$1') // bold
      .replace(/\*(.*?)\*/g, '$1') // italic
      .replace(/\[(.*?)\]\((.*?)\)/g, '$1 ($2)') // links
      .replace(/```([\s\S]*?)```/g, '$1') // code blocks
      .replace(/`(.*?)`/g, '$1'); // inline code
  }
  
  /**
   * Transform markdown to HTML
   */
  private markdownToHtml(content: string): string {
    // Simple markdown-to-HTML transformation
    return content
      .replace(/#{6}\s+(.*?)$/gm, '<h6>$1</h6>')
      .replace(/#{5}\s+(.*?)$/gm, '<h5>$1</h5>')
      .replace(/#{4}\s+(.*?)$/gm, '<h4>$1</h4>')
      .replace(/#{3}\s+(.*?)$/gm, '<h3>$1</h3>')
      .replace(/#{2}\s+(.*?)$/gm, '<h2>$1</h2>')
      .replace(/#{1}\s+(.*?)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
  }
  
  /**
   * Transform JSON to text
   */
  private jsonToText(content: string): string {
    try {
      const json = JSON.parse(content);
      
      // If the JSON has a 'text' field, use that
      if (json.text) {
        return json.text;
      }
      
      // Otherwise, pretty-print the JSON
      return JSON.stringify(json, null, 2);
    } catch (error) {
      // If parsing fails, return the original content
      return content;
    }
  }
  
  /**
   * Transform JSON to structured format
   */
  private jsonToStructured(content: string): string {
    // In a real implementation, this would transform JSON to a specific structured format
    // For now, we'll just validate the JSON and return it
    try {
      const json = JSON.parse(content);
      return JSON.stringify(json);
    } catch (error) {
      throw new Error('Invalid JSON input for structured transformation');
    }
  }
  
  /**
   * Transform HTML to text
   */
  private htmlToText(content: string): string {
    // Simple HTML-to-text transformation
    return content
      .replace(/<[^>]*>/g, '') // Remove all HTML tags
      .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
      .replace(/&lt;/g, '<') // Replace &lt;
      .replace(/&gt;/g, '>') // Replace &gt;
      .replace(/&amp;/g, '&') // Replace &amp;
      .replace(/\s+/g, ' ') // Collapse whitespace
      .trim();
  }
  
  /**
   * Transform HTML to markdown
   */
  private htmlToMarkdown(content: string): string {
    // Simple HTML-to-markdown transformation
    return content
      .replace(/<h1>(.*?)<\/h1>/g, '# $1')
      .replace(/<h2>(.*?)<\/h2>/g, '## $1')
      .replace(/<h3>(.*?)<\/h3>/g, '### $1')
      .replace(/<h4>(.*?)<\/h4>/g, '#### $1')
      .replace(/<h5>(.*?)<\/h5>/g, '##### $1')
      .replace(/<h6>(.*?)<\/h6>/g, '###### $1')
      .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
      .replace(/<em>(.*?)<\/em>/g, '*$1*')
      .replace(/<a href="(.*?)">(.*?)<\/a>/g, '[$2]($1)')
      .replace(/<code>(.*?)<\/code>/g, '`$1`')
      .replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/g, '```\n$1\n```')
      .replace(/<br>/g, '\n')
      .replace(/<\/p><p>/g, '\n\n');
  }
  
  /**
   * Transform structured format to JSON
   */
  private structuredToJson(content: string): string {
    // In a real implementation, this would transform a specific structured format to JSON
    // For now, we'll just validate the content as JSON and return it
    try {
      const structured = JSON.parse(content);
      return JSON.stringify(structured);
    } catch (error) {
      throw new Error('Invalid structured input for JSON transformation');
    }
  }
  
  /**
   * Transform structured format to text
   */
  private structuredToText(content: string): string {
    try {
      const structured = JSON.parse(content);
      
      // If there's a text field, use that
      if (structured.text) {
        return structured.text;
      }
      
      // Otherwise, convert the structure to a readable text format
      return JSON.stringify(structured, null, 2);
    } catch (error) {
      throw new Error('Invalid structured input for text transformation');
    }
  }
  
  /**
   * Truncate content to maximum length
   */
  private truncateContent(content: string, maxLength?: number): string {
    if (!maxLength || content.length <= maxLength) {
      return content;
    }
    
    // Truncate and add ellipsis
    return content.substring(0, maxLength - 3) + '...';
  }
  
  // Enrichment methods
  
  /**
   * Enrich with conversation context
   */
  private async enrichWithContext(message: TransformableMessage): Promise<ContextItem[]> {
    // In a real implementation, this would gather relevant context
    // For now, return a simple context item
    return [{
      type: 'context',
      content: 'This is additional conversation context',
      relevance: 0.8,
      source: 'context_service'
    }];
  }
  
  /**
   * Enrich with metadata
   */
  private async enrichWithMetadata(message: TransformableMessage): Promise<ContextItem[]> {
    // Use message metadata if available
    if (!message.metadata) {
      return [];
    }
    
    return [{
      type: 'metadata',
      content: message.metadata,
      relevance: 1.0,
      source: 'message_metadata'
    }];
  }
  
  /**
   * Enrich with conversation history
   */
  private async enrichWithHistory(message: TransformableMessage): Promise<ContextItem[]> {
    try {
      // Get recent messages from the conversation
      const recentMessages = await this.memoryService.searchMemories({
        type: MemoryType.MESSAGE,
        filter: {
          'metadata.chatId': message.metadata?.chatId,
        },
        limit: 5,
        sort: { field: 'timestamp', direction: 'desc' }
      } as ExtendedSearchMemoryParams);
      
      if (recentMessages.length === 0) {
        return [];
      }
      
      // Convert to context items
      return recentMessages.map(msg => ({
        type: 'history',
        content: msg.payload.text || '',
        relevance: 0.9,
        source: 'conversation_history'
      }));
    } catch (error) {
      console.error('Error enriching with history:', error);
      return [];
    }
  }
  
  /**
   * Enrich with agent capabilities
   */
  private async enrichWithCapabilities(message: TransformableMessage): Promise<ContextItem[]> {
    try {
      // Get the recipient agent's capabilities
      const agentId = message.recipientId;
      
      const agents = await this.memoryService.searchMemories({
        type: this.MEMORY_TYPE_AGENT,
        filter: { id: agentId }
      });
      
      if (agents.length === 0) {
        return [];
      }
      
      const agent = agents[0];
      const metadata = agent.payload.metadata as unknown as Record<string, unknown>;
      const capabilities = metadata.capabilities as unknown as Array<Record<string, unknown>> || [];
      
      return [{
        type: 'capabilities',
        content: { capabilities }, // Wrap in an object to satisfy the type
        relevance: 1.0,
        source: 'agent_capabilities'
      }];
    } catch (error) {
      console.error('Error enriching with capabilities:', error);
      return [];
    }
  }
  
  /**
   * Enrich with knowledge base information
   */
  private async enrichWithKnowledge(message: TransformableMessage): Promise<ContextItem[]> {
    // This would retrieve relevant knowledge from a knowledge base
    // For now, return a placeholder
    return [{
      type: 'knowledge',
      content: 'This is relevant knowledge from the knowledge base',
      relevance: 0.7,
      source: 'knowledge_service'
    }];
  }
} 