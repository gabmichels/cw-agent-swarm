/**
 * OutputProcessor.interface.ts - Output Processor Interface
 * 
 * This file defines the output processor interface that handles processing,
 * formatting, and delivery of agent outputs. It extends the base manager interface
 * with output processing specific functionality.
 */

import { BaseManager, ManagerConfig } from './BaseManager';

/**
 * Output data structure
 */
export interface OutputData {
  /** Unique identifier for this output */
  id: string;
  
  /** Raw output content */
  content: string | Record<string, unknown>;
  
  /** When this output was generated */
  timestamp: Date;
  
  /** Intended destination for this output */
  destination: string;
  
  /** Output content type */
  contentType: string;
  
  /** Associated input ID if applicable */
  inputId?: string;
  
  /** Metadata associated with this output */
  metadata?: Record<string, unknown>;
}

/**
 * Output message interface - represents the raw output to be sent
 */
export interface OutputMessage {
  /** Unique ID for the message */
  id: string;
  
  /** Recipient identifier */
  recipientId: string;
  
  /** Timestamp when the message was created */
  timestamp: Date;
  
  /** Primary message content */
  content: string;
  
  /** Output modality */
  modality: 'text' | 'markdown' | 'html' | 'json' | 'image' | 'audio' | 'structured';
  
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
    data: unknown;
    metadata?: Record<string, unknown>;
  }>;
  
  /** Message tags for categorization */
  tags?: string[];
}

/**
 * Processed output structure
 */
export interface ProcessedOutput {
  /** Original output message */
  originalMessage: OutputMessage;
  
  /** Processed content */
  processedContent: string;
  
  /** Whether the content was modified during processing */
  wasModified: boolean;
  
  /** Processing steps that were applied */
  appliedProcessingSteps: string[];
  
  /** Content moderation result if applicable */
  moderationResult?: {
    passed: boolean;
    flaggedContent: Array<{
      content: string;
      category: string;
      confidence: number;
    }>;
  };
  
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
}

/**
 * Output processing step interface
 */
export interface OutputProcessorStep {
  /** Step ID */
  id: string;
  
  /** Human-readable name */
  name: string;
  
  /** Step description */
  description: string;
  
  /** Process function that takes content and returns processed content */
  process(content: string, context?: unknown): Promise<string>;
  
  /** Whether this step is enabled */
  enabled: boolean;
  
  /** Execution order (lower numbers run first) */
  order: number;
  
  /** Processing category */
  category: string;
}

/**
 * Output validation result
 */
export interface OutputValidationResult {
  /** Whether the output is valid */
  valid: boolean;
  
  /** Whether any issues are blocking */
  hasBlockingIssues: boolean;
  
  /** Validation issues */
  issues: Array<{
    code: string;
    message: string;
    severity: 'info' | 'warning' | 'error';
    position?: {
      start: number;
      end: number;
    };
  }>;
  
  /** Suggestions for improvement */
  suggestions?: Array<{
    text: string;
    reason: string;
  }>;
}

/**
 * Output template
 */
export interface OutputTemplate {
  /** Template ID */
  id: string;
  
  /** Template name */
  name: string;
  
  /** Template description */
  description: string;
  
  /** Template content with variable placeholders */
  content: string;
  
  /** Template variables */
  variables: Array<{
    name: string;
    description?: string;
    defaultValue?: string;
    required?: boolean;
  }>;
  
  /** Template category */
  category: string;
  
  /** Template version */
  version: string;
  
  /** Template output modality */
  modality: 'text' | 'markdown' | 'html' | 'json' | 'image' | 'audio' | 'structured';
  
  /** Whether the template is enabled */
  enabled: boolean;
  
  /** When the template was created */
  createdAt: Date;
  
  /** When the template was last updated */
  updatedAt: Date;
}

/**
 * Output format options
 */
export interface OutputFormatOptions {
  /** Target format type */
  formatType: 'text' | 'html' | 'json' | 'markdown' | 'csv' | string;
  
  /** Format-specific options */
  options?: Record<string, unknown>;
  
  /** Style customizations */
  style?: Record<string, unknown>;
}

/**
 * Output delivery options
 */
export interface OutputDeliveryOptions {
  /** Delivery method to use */
  method: 'sync' | 'async' | 'callback' | 'stream' | string;
  
  /** Target destination */
  destination: string;
  
  /** Delivery headers if applicable */
  headers?: Record<string, string>;
  
  /** Delivery protocol options */
  protocolOptions?: Record<string, unknown>;
}

/**
 * Output delivery result
 */
export interface OutputDeliveryResult {
  /** Whether delivery was successful */
  success: boolean;
  
  /** Output ID */
  outputId: string;
  
  /** When the delivery completed */
  timestamp: Date;
  
  /** Delivery destination */
  destination: string;
  
  /** Status message */
  message: string;
  
  /** Delivery method used */
  method: string;
  
  /** Response details if any */
  response?: Record<string, unknown>;
}

/**
 * Configuration options for output processors
 */
export interface OutputProcessorConfig extends ManagerConfig {
  /** Whether this processor is enabled */
  enabled: boolean;
  
  /** Default content type if not specified */
  defaultContentType?: string;
  
  /** Default output format */
  defaultFormat?: string | OutputFormatOptions;
  
  /** Default delivery options */
  defaultDelivery?: OutputDeliveryOptions;
  
  /** Output processing steps to apply */
  processingSteps?: Array<'format' | 'validate' | 'filter' | 'transform'>;
  
  /** Content moderation level */
  contentModerationLevel?: 'none' | 'low' | 'medium' | 'high';
  
  /** Whether to maintain output history */
  maintainHistory?: boolean;
  
  /** Maximum history items to maintain */
  maxHistoryItems?: number;
  
  /** Supported output modalities */
  supportedModalities?: Array<'text' | 'markdown' | 'html' | 'json' | 'image' | 'audio' | 'structured'>;
  
  /** Default templates */
  defaultTemplates?: Record<string, string>;
  
  /** Formatting options */
  formatting?: {
    /** Whether to apply smart formatting */
    smartFormatting?: boolean;
    
    /** Maximum output length */
    maxLength?: number;
    
    /** Character encoding to use */
    encoding?: string;
    
    /** Whether to format code blocks */
    formatCodeBlocks?: boolean;
  };
  
  /** Output queue settings */
  queueSettings?: {
    /** Whether to enable queueing */
    enabled: boolean;
    
    /** Maximum queue size */
    maxSize?: number;
    
    /** Processing strategy */
    strategy?: 'fifo' | 'priority' | 'batch';
  };
  
  /** Rate limiting options */
  rateLimiting?: {
    /** Whether to enable rate limiting */
    enabled: boolean;
    
    /** Maximum outputs per minute */
    maxPerMinute?: number;
    
    /** Maximum outputs per hour */
    maxPerHour?: number;
  };
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
      targetFormat?: string;
    }
  ): Promise<ProcessedOutput>;
  
  /**
   * Register a processor step
   * @param step The processor step to register
   * @returns Promise resolving to the registered step
   */
  registerProcessorStep(step: OutputProcessorStep): Promise<OutputProcessorStep>;
  
  /**
   * Unregister a processor step
   * @param stepId The processor step ID to unregister
   * @returns Promise resolving to true if unregistered, false if not found
   */
  unregisterProcessorStep(stepId: string): Promise<boolean>;
  
  /**
   * Get a processor step by ID
   * @param stepId The processor step ID to retrieve
   * @returns Promise resolving to the processor step or null if not found
   */
  getProcessorStep(stepId: string): Promise<OutputProcessorStep | null>;
  
  /**
   * List all registered processor steps
   * @param options Filter options
   * @returns Promise resolving to matching processor steps
   */
  listProcessorSteps(options?: {
    enabled?: boolean;
    category?: string;
    sortBy?: 'order' | 'id' | 'name' | 'category';
    sortDirection?: 'asc' | 'desc';
  }): Promise<OutputProcessorStep[]>;
  
  /**
   * Create an output message
   * @param content The message content
   * @param recipientId The recipient ID
   * @param options Message creation options
   * @returns Promise resolving to the created message
   */
  createOutputMessage(
    content: string,
    recipientId: string,
    options?: {
      modality?: 'text' | 'markdown' | 'html' | 'json' | 'image' | 'audio' | 'structured';
      context?: Record<string, unknown>;
      attachments?: Array<{
        type: string;
        data: unknown;
      }>;
      tags?: string[];
    }
  ): Promise<OutputMessage>;
  
  /**
   * Enable or disable a processor step
   * @param stepId The processor step ID to update
   * @param enabled Whether the step should be enabled
   * @returns Promise resolving to the updated step
   */
  setProcessorStepEnabled(stepId: string, enabled: boolean): Promise<OutputProcessorStep>;
  
  /**
   * Set the order of a processor step
   * @param stepId The processor step ID to update
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
   * Add output to history
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
   * Format content to the specified format
   * @param content The content to format
   * @param format The target format
   * @param options Formatting options
   * @returns Promise resolving to the formatted content
   */
  formatContent(
    content: string,
    format: "text" | "markdown" | "html" | "json" | "image" | "audio" | "structured",
    options?: Record<string, unknown>
  ): Promise<string>;
  
  /**
   * Generate output from a template
   * @param templateId The template ID to use
   * @param variables Variables to apply to the template
   * @param options Generation options
   * @returns Promise resolving to the generated output message
   */
  generateFromTemplate(
    templateId: string,
    variables: Record<string, unknown>,
    options?: {
      fallbackTemplateId?: string;
      format?: 'text' | 'markdown' | 'html' | 'json' | 'image' | 'audio' | 'structured';
    }
  ): Promise<OutputMessage>;
  
  /**
   * Register a template
   * @param template The template to register
   * @returns Promise resolving to the registered template
   */
  registerTemplate(
    template: Omit<OutputTemplate, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<OutputTemplate>;
  
  /**
   * Update a template
   * @param templateId The template ID to update
   * @param updates Updates to apply
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
   * List all templates
   * @param options Filter options
   * @returns Promise resolving to matching templates
   */
  listTemplates(options?: {
    category?: string;
    modality?: 'text' | 'markdown' | 'html' | 'json' | 'image' | 'audio' | 'structured';
    enabled?: boolean;
    sortBy?: 'name' | 'createdAt' | 'updatedAt';
    sortDirection?: 'asc' | 'desc';
  }): Promise<OutputTemplate[]>;
  
  /**
   * Delete a template
   * @param templateId The template ID to delete
   * @returns Promise resolving to true if deleted, false if not found
   */
  deleteTemplate(templateId: string): Promise<boolean>;
  
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
      streamedPercentage: number;
      averageChunkCount: number;
    };
  }>;
  
  /**
   * Get the processor configuration
   * @returns The processor configuration
   */
  getConfig<T extends OutputProcessorConfig>(): T;
  
  /**
   * Enable or disable the processor
   * @param enabled Whether the processor should be enabled
   * @returns Whether the state changed
   */
  setEnabled(enabled: boolean): boolean;
} 