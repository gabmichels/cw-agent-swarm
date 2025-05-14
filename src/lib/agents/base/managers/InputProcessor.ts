/**
 * Input Processor Interface
 * 
 * This file defines the input processor interface that provides input processing services
 * for agents. It extends the base manager interface with input-specific functionality.
 */

import type { BaseManager, ManagerConfig } from './BaseManager';
import type { AgentBase } from '../AgentBase';

/**
 * Configuration options for input processors
 */
export interface InputProcessorConfig extends ManagerConfig {
  /** Whether this processor is enabled */
  enabled: boolean;
  
  /** Input modalities supported */
  supportedModalities?: Array<'text' | 'image' | 'audio' | 'video' | 'file' | 'structured'>;
  
  /** Maximum input size in bytes */
  maxInputSizeBytes?: number;
  
  /** Input preprocessing steps to apply */
  preprocessingSteps?: Array<'normalize' | 'sanitize' | 'trim' | 'tokenize' | 'extract_entities' | 'custom'>;
  
  /** Content filtering level */
  contentFilteringLevel?: 'none' | 'low' | 'medium' | 'high';
  
  /** Whether to perform automatic language detection */
  detectLanguage?: boolean;
  
  /** Default input language */
  defaultLanguage?: string;
  
  /** Whether to allow streaming inputs */
  allowStreaming?: boolean;
  
  /** Timeout for input processing in milliseconds */
  processingTimeoutMs?: number;
  
  /** Whether to maintain input history */
  maintainHistory?: boolean;
  
  /** Maximum history items to maintain */
  maxHistoryItems?: number;
  
  /** Sanitization options */
  sanitization?: {
    /** Whether to remove HTML */
    removeHtml?: boolean;
    
    /** Whether to remove scripts */
    removeScripts?: boolean;
    
    /** Whether to remove personal identifiable information */
    removePii?: boolean;
    
    /** Custom sanitization rules */
    customRules?: Array<{
      pattern: string | RegExp;
      replacement: string;
    }>;
  };
}

/**
 * Input message interface - represents the raw input received
 */
export interface InputMessage {
  /** Unique ID for the message */
  id: string;
  
  /** Sender identifier */
  senderId: string;
  
  /** Timestamp when the message was created */
  timestamp: Date;
  
  /** Primary message content */
  content: string;
  
  /** Input modality */
  modality: 'text' | 'image' | 'audio' | 'video' | 'file' | 'structured';
  
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
  
  /** Message tags for categorization */
  tags?: string[];
}

/**
 * Processed input interface - represents the result of processing raw input
 */
export interface ProcessedInput {
  /** Original input message */
  originalMessage: InputMessage;
  
  /** Processed content */
  processedContent: string;
  
  /** Detected language */
  detectedLanguage?: string;
  
  /** Confidence of language detection (0-1) */
  languageConfidence?: number;
  
  /** Input tokens (if tokenization was applied) */
  tokens?: string[];
  
  /** Extracted entities */
  entities?: Array<{
    text: string;
    type: string;
    startPos: number;
    endPos: number;
    metadata?: Record<string, unknown>;
  }>;
  
  /** Input sentiment analysis */
  sentiment?: {
    score: number; // -1 to 1
    magnitude?: number;
    label?: 'positive' | 'negative' | 'neutral';
  };
  
  /** Content safety analysis */
  contentSafety?: {
    safe: boolean;
    categories?: Record<string, number>; // Category to confidence mapping
    flaggedContent?: Array<{
      content: string;
      category: string;
      confidence: number;
    }>;
  };
  
  /** User intent classification */
  intent?: {
    primary: string;
    confidence: number;
    secondary?: string[];
  };
  
  /** Processing metadata */
  processingMetadata: {
    /** Time taken to process in milliseconds */
    processingTimeMs: number;
    
    /** Preprocessing steps applied */
    appliedSteps: string[];
    
    /** Whether content was modified during processing */
    contentModified: boolean;
    
    /** Errors encountered during processing */
    errors?: Array<{
      step: string;
      message: string;
      severity: 'warning' | 'error';
    }>;
  };
}

/**
 * Input preprocessing step interface
 */
export interface InputPreprocessor {
  /** Preprocessor ID */
  id: string;
  
  /** Human-readable name */
  name: string;
  
  /** Preprocessor description */
  description: string;
  
  /** Process function that takes input and returns processed input */
  process(input: string, context?: unknown): Promise<string>;
  
  /** Whether this preprocessor is enabled */
  enabled: boolean;
  
  /** Execution order (lower numbers run first) */
  order: number;
}

/**
 * Input validation result interface
 */
export interface InputValidationResult {
  /** Whether the input is valid */
  valid: boolean;
  
  /** Validation issues found */
  issues?: Array<{
    code: string;
    message: string;
    severity: 'info' | 'warning' | 'error';
    metadata?: Record<string, unknown>;
  }>;
  
  /** Suggested corrections */
  suggestions?: Array<{
    originalText: string;
    suggestedText: string;
    reason: string;
  }>;
  
  /** Whether the issues are blockers or just warnings */
  hasBlockingIssues: boolean;
}

/**
 * Input processor interface
 */
export interface InputProcessor extends BaseManager {
  /**
   * Process a raw input message
   * @param message The input message to process
   * @param options Processing options
   * @returns Promise resolving to the processed input
   */
  processInput(
    message: InputMessage,
    options?: {
      skipSteps?: string[];
      additionalContext?: unknown;
      processingTimeoutMs?: number;
    }
  ): Promise<ProcessedInput>;
  
  /**
   * Validate an input message
   * @param message The input message to validate
   * @param options Validation options
   * @returns Promise resolving to the validation result
   */
  validateInput(
    message: InputMessage | string,
    options?: {
      rules?: Array<{
        type: string;
        params?: unknown;
      }>;
      strictMode?: boolean;
    }
  ): Promise<InputValidationResult>;
  
  /**
   * Register a custom preprocessor
   * @param preprocessor The preprocessor to register
   * @returns Promise resolving to the registered preprocessor
   */
  registerPreprocessor(preprocessor: InputPreprocessor): Promise<InputPreprocessor>;
  
  /**
   * Unregister a preprocessor
   * @param preprocessorId The preprocessor ID to unregister
   * @returns Promise resolving to true if unregistered, false if not found
   */
  unregisterPreprocessor(preprocessorId: string): Promise<boolean>;
  
  /**
   * Get a preprocessor by ID
   * @param preprocessorId The preprocessor ID to retrieve
   * @returns Promise resolving to the preprocessor or null if not found
   */
  getPreprocessor(preprocessorId: string): Promise<InputPreprocessor | null>;
  
  /**
   * List all registered preprocessors
   * @param options Filter options
   * @returns Promise resolving to matching preprocessors
   */
  listPreprocessors(options?: {
    enabled?: boolean;
    sortBy?: 'order' | 'id' | 'name';
    sortDirection?: 'asc' | 'desc';
  }): Promise<InputPreprocessor[]>;
  
  /**
   * Enable or disable a preprocessor
   * @param preprocessorId The preprocessor ID to update
   * @param enabled Whether the preprocessor should be enabled
   * @returns Promise resolving to the updated preprocessor
   */
  setPreprocessorEnabled(preprocessorId: string, enabled: boolean): Promise<InputPreprocessor>;
  
  /**
   * Set the order of a preprocessor
   * @param preprocessorId The preprocessor ID to update
   * @param order The new order value
   * @returns Promise resolving to the updated preprocessor
   */
  setPreprocessorOrder(preprocessorId: string, order: number): Promise<InputPreprocessor>;
  
  /**
   * Add an input to history
   * @param input The processed input to add to history
   * @returns Promise resolving to the added history item ID
   */
  addToHistory(input: ProcessedInput): Promise<string>;
  
  /**
   * Get input history
   * @param options History retrieval options
   * @returns Promise resolving to matching history items
   */
  getHistory(options?: {
    limit?: number;
    offset?: number;
    senderId?: string;
    fromDate?: Date;
    toDate?: Date;
    conversationId?: string;
  }): Promise<ProcessedInput[]>;
  
  /**
   * Clear input history
   * @param options Clear options
   * @returns Promise resolving to the number of history items cleared
   */
  clearHistory(options?: {
    senderId?: string;
    olderThan?: Date;
    conversationId?: string;
  }): Promise<number>;
  
  /**
   * Get statistics about the input processor
   * @returns Promise resolving to input processor statistics
   */
  getStats(): Promise<{
    totalProcessedInputs: number;
    averageProcessingTimeMs: number;
    validInputPercentage: number;
    invalidInputPercentage: number;
    topInputModalities: Array<{
      modality: string;
      count: number;
      percentage: number;
    }>;
    detectedLanguages: Record<string, number>;
  }>;
} 