/**
 * Output Processor Interface
 * 
 * This file defines the output processor interface that provides output generation and processing
 * services for agents. It extends the base manager interface with output-specific functionality.
 */

import type { BaseManager, ManagerConfig } from '../../../../agents/shared/base/managers/BaseManager';
import type { AgentBase } from '../../../../agents/shared/base/AgentBase';

/**
 * Configuration options for output processors
 */
export interface OutputProcessorConfig extends ManagerConfig {
  /** Whether this processor is enabled */
  enabled: boolean;
  
  /** Output modalities supported */
  supportedModalities?: Array<'text' | 'markdown' | 'html' | 'json' | 'image' | 'audio' | 'structured'>;
  
  /** Default output format */
  defaultFormat?: 'text' | 'markdown' | 'html' | 'json' | 'structured';
  
  /** Default language for output */
  defaultLanguage?: string;
  
  /** Output processing steps to apply */
  processingSteps?: Array<'format' | 'validate' | 'transform' | 'filter' | 'custom'>;
  
  /** Whether to maintain output history */
  maintainHistory?: boolean;
  
  /** Maximum history items to maintain */
  maxHistoryItems?: number;
  
  /** Content moderation level */
  contentModerationLevel?: 'none' | 'low' | 'medium' | 'high';
  
  /** Whether to include metadata in output */
  includeMetadata?: boolean;
  
  /** Whether to enable streaming output */
  enableStreaming?: boolean;
  
  /** Default templates by type */
  defaultTemplates?: Record<string, string>;
  
  /** Maximum output size in bytes */
  maxOutputSizeBytes?: number;
  
  /** Formatting options */
  formatting?: {
    /** Auto-format code blocks */
    formatCodeBlocks?: boolean;
    
    /** Code block style (markdown, html, etc.) */
    codeBlockStyle?: string;
    
    /** Whether to include syntax highlighting */
    syntaxHighlighting?: boolean;
    
    /** Default indent size */
    indentSize?: number;
  };
}

/**
 * Output message interface - represents a message to be sent
 */
export interface OutputMessage {
  /** Unique ID for the message */
  id: string;
  
  /** Agent identifier */
  agentId: string;
  
  /** Recipient identifier */
  recipientId: string;
  
  /** Timestamp when the message was created */
  timestamp: Date;
  
  /** Primary message content */
  content: string;
  
  /** Output modality */
  modality: 'text' | 'markdown' | 'html' | 'json' | 'image' | 'audio' | 'structured';
  
  /** Format-specific data */
  formatData?: unknown;
  
  /** Rendering hints */
  renderingHints?: {
    /** Preferred display type */
    displayType?: 'plain' | 'card' | 'panel' | 'notification' | 'custom';
    
    /** Style information */
    style?: Record<string, unknown>;
    
    /** Animation settings */
    animation?: {
      type: string;
      duration: number;
      delay?: number;
    };
    
    /** Accessibility information */
    accessibility?: {
      role?: string;
      ariaLabel?: string;
      altText?: string;
    };
  };
  
  /** Additional message metadata */
  metadata?: Record<string, unknown>;
  
  /** Message context such as conversation ID */
  context?: {
    conversationId?: string;
    replyToMessageId?: string;
    threadId?: string;
    sessionId?: string;
  };
  
  /** Message attachments */
  attachments?: Array<{
    id: string;
    type: string;
    url?: string;
    data?: unknown;
    metadata?: Record<string, unknown>;
  }>;
  
  /** Streaming configuration, if applicable */
  streaming?: {
    enabled: boolean;
    chunkSize?: number;
    delayMs?: number;
  };
  
  /** Message tags for categorization */
  tags?: string[];
}

/**
 * Processed output interface - represents the result of processing an output message
 */
export interface ProcessedOutput {
  /** Original output message */
  originalMessage: OutputMessage;
  
  /** Processed content */
  processedContent: string;
  
  /** Whether the content was modified during processing */
  wasModified: boolean;
  
  /** Moderation result, if applicable */
  moderationResult?: {
    /** Whether the output passed moderation */
    passed: boolean;
    
    /** Content that was modified or flagged */
    flaggedContent?: Array<{
      content: string;
      category: string;
      confidence: number;
      action: 'removed' | 'modified' | 'flagged';
    }>;
    
    /** Overall moderation score (0-1, higher means more potentially problematic) */
    score?: number;
  };
  
  /** List of processing steps applied */
  appliedProcessingSteps: string[];
  
  /** Processing metadata */
  processingMetadata: {
    /** Time taken to process in milliseconds */
    processingTimeMs: number;
    
    /** Errors encountered during processing */
    errors?: Array<{
      step: string;
      message: string;
      severity: 'warning' | 'error';
    }>;
  };
  
  /** Delivery metadata */
  deliveryMetadata?: {
    /** When the message was delivered */
    deliveredAt?: Date;
    
    /** Delivery status */
    status: 'pending' | 'delivering' | 'delivered' | 'failed';
    
    /** Error information if delivery failed */
    error?: {
      message: string;
      code?: string;
      details?: unknown;
    };
  };
}

/**
 * Output template interface
 */
export interface OutputTemplate {
  /** Template ID */
  id: string;
  
  /** Human-readable name */
  name: string;
  
  /** Template description */
  description: string;
  
  /** Template content with placeholders */
  content: string;
  
  /** Output modality */
  modality: OutputMessage['modality'];
  
  /** Variables that can be substituted in the template */
  variables: string[];
  
  /** Whether this template is enabled */
  enabled: boolean;
  
  /** Template category or type */
  category: string;
  
  /** Template version */
  version: string;
  
  /** Creation timestamp */
  createdAt: Date;
  
  /** Last updated timestamp */
  updatedAt: Date;
  
  /** Template metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Output processor step interface
 */
export interface OutputProcessorStep {
  /** Step ID */
  id: string;
  
  /** Human-readable name */
  name: string;
  
  /** Step description */
  description: string;
  
  /** Process function that takes output and returns processed output */
  process(content: string, context?: unknown): Promise<string>;
  
  /** Whether this step is enabled */
  enabled: boolean;
  
  /** Execution order (lower numbers run first) */
  order: number;
  
  /** Step category */
  category: 'format' | 'validate' | 'transform' | 'filter' | 'custom';
}

/**
 * Output validation result interface
 */
export interface OutputValidationResult {
  /** Whether the output is valid */
  valid: boolean;
  
  /** Validation issues found */
  issues?: Array<{
    code: string;
    message: string;
    severity: 'info' | 'warning' | 'error';
    location?: {
      startPos: number;
      endPos: number;
    };
  }>;
  
  /** Suggested corrections */
  suggestions?: Array<{
    originalText: string;
    suggestedText: string;
    reason: string;
  }>;
}

/**
 * Output processor interface
 */
export interface OutputProcessor extends BaseManager {
  /**
   * Process an output message
   * @param message The output message to process
   * @param options Processing options
   * @returns Promise resolving to the processed output
   */
  processOutput(
    message: OutputMessage,
    options?: {
      skipSteps?: string[];
      additionalContext?: unknown;
    }
  ): Promise<ProcessedOutput>;
  
  /**
   * Format content according to a specific format
   * @param content The content to format
   * @param format The target format
   * @param options Formatting options
   * @returns Promise resolving to the formatted content
   */
  formatContent(
    content: string,
    format: OutputMessage['modality'],
    options?: Record<string, unknown>
  ): Promise<string>;
  
  /**
   * Generate output using a template
   * @param templateId The template ID to use
   * @param variables The variables to substitute in the template
   * @param options Additional options
   * @returns Promise resolving to the generated output
   */
  generateFromTemplate(
    templateId: string,
    variables: Record<string, unknown>,
    options?: {
      fallbackTemplateId?: string;
      format?: OutputMessage['modality'];
    }
  ): Promise<OutputMessage>;
  
  /**
   * Register a template
   * @param template The template to register
   * @returns Promise resolving to the registered template
   */
  registerTemplate(template: Omit<OutputTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<OutputTemplate>;
  
  /**
   * Update a template
   * @param templateId The template ID to update
   * @param updates The updates to apply
   * @returns Promise resolving to the updated template
   */
  updateTemplate(
    templateId: string,
    updates: Partial<Omit<OutputTemplate, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<OutputTemplate>;
  
  /**
   * Get a template by ID
   * @param templateId The template ID to retrieve
   * @returns Promise resolving to the template or null if not found
   */
  getTemplate(templateId: string): Promise<OutputTemplate | null>;
  
  /**
   * List all registered templates
   * @param options Filter options
   * @returns Promise resolving to matching templates
   */
  listTemplates(options?: {
    category?: string;
    modality?: OutputMessage['modality'];
    enabled?: boolean;
    sortBy?: 'createdAt' | 'updatedAt' | 'name';
    sortDirection?: 'asc' | 'desc';
  }): Promise<OutputTemplate[]>;
  
  /**
   * Delete a template
   * @param templateId The template ID to delete
   * @returns Promise resolving to true if deleted, false if not found
   */
  deleteTemplate(templateId: string): Promise<boolean>;
  
  /**
   * Register a processor step
   * @param step The processor step to register
   * @returns Promise resolving to the registered step
   */
  registerProcessorStep(step: OutputProcessorStep): Promise<OutputProcessorStep>;
  
  /**
   * Unregister a processor step
   * @param stepId The step ID to unregister
   * @returns Promise resolving to true if unregistered, false if not found
   */
  unregisterProcessorStep(stepId: string): Promise<boolean>;
  
  /**
   * Get a processor step by ID
   * @param stepId The step ID to retrieve
   * @returns Promise resolving to the step or null if not found
   */
  getProcessorStep(stepId: string): Promise<OutputProcessorStep | null>;
  
  /**
   * List all registered processor steps
   * @param options Filter options
   * @returns Promise resolving to matching steps
   */
  listProcessorSteps(options?: {
    category?: OutputProcessorStep['category'];
    enabled?: boolean;
    sortBy?: 'order' | 'id' | 'name';
    sortDirection?: 'asc' | 'desc';
  }): Promise<OutputProcessorStep[]>;
  
  /**
   * Enable or disable a processor step
   * @param stepId The step ID to update
   * @param enabled Whether the step should be enabled
   * @returns Promise resolving to the updated step
   */
  setProcessorStepEnabled(stepId: string, enabled: boolean): Promise<OutputProcessorStep>;
  
  /**
   * Set the order of a processor step
   * @param stepId The step ID to update
   * @param order The new order value
   * @returns Promise resolving to the updated step
   */
  setProcessorStepOrder(stepId: string, order: number): Promise<OutputProcessorStep>;
  
  /**
   * Validate output content
   * @param content The content to validate
   * @param format The content format
   * @param options Validation options
   * @returns Promise resolving to the validation result
   */
  validateOutput(
    content: string,
    format: OutputMessage['modality'],
    options?: {
      strictMode?: boolean;
      customRules?: Array<{
        type: string;
        params?: unknown;
      }>;
    }
  ): Promise<OutputValidationResult>;
  
  /**
   * Add an output to history
   * @param output The processed output to add to history
   * @returns Promise resolving to the added history item ID
   */
  addToHistory(output: ProcessedOutput): Promise<string>;
  
  /**
   * Get output history
   * @param options History retrieval options
   * @returns Promise resolving to matching history items
   */
  getHistory(options?: {
    limit?: number;
    offset?: number;
    recipientId?: string;
    fromDate?: Date;
    toDate?: Date;
    conversationId?: string;
  }): Promise<ProcessedOutput[]>;
  
  /**
   * Clear output history
   * @param options Clear options
   * @returns Promise resolving to the number of history items cleared
   */
  clearHistory(options?: {
    recipientId?: string;
    olderThan?: Date;
    conversationId?: string;
  }): Promise<number>;
  
  /**
   * Get statistics about the output processor
   * @returns Promise resolving to output processor statistics
   */
  getStats(): Promise<{
    totalProcessedOutputs: number;
    outputsByModality: Record<string, number>;
    averageProcessingTimeMs: number;
    moderationStats?: {
      flaggedCount: number;
      flaggedPercentage: number;
      categoryCounts: Record<string, number>;
    };
    streamingStats?: {
      streamedCount: number;
      averageChunkCount: number;
    };
  }>;
} 