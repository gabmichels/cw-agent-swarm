/**
 * Default Input Processor Implementation
 * 
 * This file implements the default input processor that handles processing,
 * validation, and managing input messages.
 */

import { v4 as uuidv4 } from 'uuid';
import { 
  InputProcessor,
  InputProcessorConfig,
  InputMessage,
  ProcessedInput,
  InputPreprocessor,
  InputValidationResult
} from '../../base/managers/InputProcessor.interface';
import { AgentBase } from '../../base/AgentBase.interface';
import { createConfigFactory } from '../../config';
import { InputProcessorConfigSchema } from '../config/InputProcessorConfigSchema';
import { AbstractBaseManager } from '../../base/managers/BaseManager';
import { ManagerType } from '../../base/managers/ManagerType';

/**
 * Default implementation of the InputProcessor interface
 */
export class DefaultInputProcessor extends AbstractBaseManager implements InputProcessor {
  protected config: InputProcessorConfig;
  private preprocessors: Map<string, InputPreprocessor> = new Map();
  private history: ProcessedInput[] = [];
  private configFactory = createConfigFactory(InputProcessorConfigSchema);
  
  /**
   * Type property accessor for compatibility with InputProcessor
   * Use managerType property to avoid infinite recursion
   */
  get type(): string {
    return this.managerType;
  }
  
  /**
   * Create a new DefaultInputProcessor
   * @param agent The agent this processor belongs to
   * @param config Configuration options
   */
  constructor(
    agent: AgentBase,
    config: Partial<InputProcessorConfig> = {}
  ) {
    super(
      `input-processor-${uuidv4()}`,
      ManagerType.INPUT,
      agent,
      { enabled: true }
    );
    
    // Validate and apply configuration with defaults
    this.config = this.configFactory.create({
      enabled: true,
      ...config
    }) as InputProcessorConfig;
    
    // Initialize default preprocessors based on configuration
    this.initializeDefaultPreprocessors();
  }

  /**
   * Update the manager configuration
   */
  updateConfig<T extends InputProcessorConfig>(config: Partial<T>): T {
    // Validate and merge configuration
    this.config = this.configFactory.create({
      ...this.config, 
      ...config
    }) as InputProcessorConfig;
    
    // Reinitialize preprocessors with new configuration
    this.preprocessors.clear();
    this.initializeDefaultPreprocessors();
    
    return this.config as unknown as T;
  }

  /**
   * Initialize the manager
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) return true;
    
    try {
      // Re-initialize preprocessors
      this.preprocessors.clear();
      this.initializeDefaultPreprocessors();
      
      this.initialized = true;
      return true;
    } catch (error) {
      console.error(`[${this.managerId}] Failed to initialize input processor:`, error);
      return false;
    }
  }

  /**
   * Shut down the manager
   */
  async shutdown(): Promise<void> {
    // Clear any resources
    this.preprocessors.clear();
    this.history = [];
    this.initialized = false;
  }

  /**
   * Reset the manager
   */
  async reset(): Promise<boolean> {
    // Clear history
    this.history = [];
    
    // Clear preprocessors and reinitialize
    this.preprocessors.clear();
    this.initializeDefaultPreprocessors();
    
    return true;
  }

  /**
   * Get manager health status
   */
  async getHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    message?: string;
    metrics?: Record<string, unknown>;
  }> {
    if (!this.initialized) {
      return {
        status: 'degraded',
        message: 'Input processor not initialized'
      };
    }

    if (!this.config.enabled) {
      return {
        status: 'degraded',
        message: 'Input processor is disabled'
      };
    }

    // Get processor stats
    const stats = await this.getStats();
    
    return {
      status: 'healthy',
      message: 'Input processor is healthy',
      metrics: {
        preprocessorCount: this.preprocessors.size,
        historySize: this.history.length,
        ...stats
      }
    };
  }

  /**
   * Get statistics about the manager
   */
  async getStats(): Promise<{
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
  }> {
    // Calculate basic stats
    const totalInputs = this.history.length;
    const validInputs = this.history.filter(item => 
      !item.processingMetadata.errors || item.processingMetadata.errors.length === 0).length;
    
    // Initialize required return structure
    return {
      totalProcessedInputs: totalInputs,
      averageProcessingTimeMs: totalInputs > 0 ? 
        this.history.reduce((sum, item) => sum + item.processingMetadata.processingTimeMs, 0) / totalInputs : 0,
      validInputPercentage: totalInputs > 0 ? (validInputs / totalInputs) * 100 : 100,
      invalidInputPercentage: totalInputs > 0 ? ((totalInputs - validInputs) / totalInputs) * 100 : 0,
      topInputModalities: this.getTopModalities(),
      detectedLanguages: this.getDetectedLanguages()
    };
  }

  /**
   * Initialize default preprocessors based on configuration
   */
  private initializeDefaultPreprocessors(): void {
    // Initialize preprocessors based on configured steps
    if (this.config.preprocessingSteps?.includes('normalize')) {
      this.registerPreprocessor({
        id: 'normalize',
        name: 'Text Normalizer',
        description: 'Normalizes input text (whitespace, case, etc.)',
        process: async (input: string) => {
          // Simple normalization: trim whitespace
          return input.trim();
        },
        enabled: true,
        order: 10
      });
    }
    
    if (this.config.preprocessingSteps?.includes('sanitize')) {
      this.registerPreprocessor({
        id: 'sanitize',
        name: 'Content Sanitizer',
        description: 'Sanitizes input content for safety',
        process: async (input: string) => {
          // Apply sanitization based on config
          let result = input;
          
          if (this.config.sanitization?.removeHtml) {
            // Simple HTML stripping (a real implementation would use a proper HTML sanitizer)
            result = result.replace(/<[^>]*>?/gm, '');
          }
          
          if (this.config.sanitization?.removeScripts) {
            // Remove script tags and JS event handlers
            result = result.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
            result = result.replace(/on\w+="[^"]*"/gi, '');
          }
          
          // Apply custom sanitization rules
          this.config.sanitization?.customRules?.forEach(rule => {
            if (rule.pattern && rule.replacement) {
              const pattern = typeof rule.pattern === 'string' 
                ? new RegExp(rule.pattern, 'g') 
                : rule.pattern;
              result = result.replace(pattern, rule.replacement);
            }
          });
          
          return result;
        },
        enabled: true,
        order: 20
      });
    }
    
    if (this.config.preprocessingSteps?.includes('trim')) {
      this.registerPreprocessor({
        id: 'trim',
        name: 'Content Trimmer',
        description: 'Trims content to appropriate length',
        process: async (input: string) => {
          // Simple length limiting
          const maxChars = Math.floor(this.config.maxInputSizeBytes! / 2); // Rough approximation for character count
          return input.length > maxChars ? input.substring(0, maxChars) : input;
        },
        enabled: true,
        order: 30
      });
    }
  }
  
  /**
   * Process a raw input message
   * @param message The input message to process
   * @param options Processing options
   * @returns Promise resolving to the processed input
   */
  async processInput(
    message: InputMessage,
    options?: {
      skipSteps?: string[];
      additionalContext?: unknown;
      processingTimeoutMs?: number;
    }
  ): Promise<ProcessedInput> {
    if (!this.config.enabled) {
      throw new Error('Input processor is disabled');
    }
    
    // Record start time for processing metrics
    const startTime = Date.now();
    
    // Initialize processed input result
    const result: ProcessedInput = {
      originalMessage: message,
      processedContent: message.content,
      processingMetadata: {
        processingTimeMs: 0,
        appliedSteps: [],
        contentModified: false
      }
    };
    
    // Determine timeout
    const timeoutMs = options?.processingTimeoutMs || this.config.processingTimeoutMs;
    
    try {
      // Sort preprocessors by order
      const sortedPreprocessors = Array.from(this.preprocessors.values())
        .filter(p => p.enabled && (!options?.skipSteps || !options.skipSteps.includes(p.id)))
        .sort((a, b) => a.order - b.order);
      
      // Apply each processor in order
      let currentContent = message.content;
      
      for (const preprocessor of sortedPreprocessors) {
        try {
          result.processingMetadata.appliedSteps.push(preprocessor.id);
          const processedContent = await preprocessor.process(currentContent, options?.additionalContext);
          
          if (processedContent !== currentContent) {
            result.processingMetadata.contentModified = true;
            currentContent = processedContent;
          }
        } catch (error) {
          // Record the error but continue processing
          if (!result.processingMetadata.errors) {
            result.processingMetadata.errors = [];
          }
          
          result.processingMetadata.errors.push({
            step: preprocessor.id,
            message: error instanceof Error ? error.message : String(error),
            severity: 'warning'
          });
        }
      }
      
      // Update the result with processed content
      result.processedContent = currentContent;
      
      // Detect language if enabled and not already done
      if (this.config.detectLanguage && !result.detectedLanguage) {
        // Simple language detection mock (would use a real detection service)
        // Just detecting English or non-English based on common English words
        const englishWords = ['the', 'and', 'is', 'in', 'it', 'to', 'of', 'for', 'with'];
        const wordCount = englishWords.reduce((count, word) => {
          const regex = new RegExp(`\\b${word}\\b`, 'gi');
          const matches = currentContent.match(regex);
          return count + (matches ? matches.length : 0);
        }, 0);
        
        // If enough English words are detected, assume it's English
        const isEnglish = wordCount > 3;
        result.detectedLanguage = isEnglish ? 'en' : this.config.defaultLanguage;
        result.languageConfidence = isEnglish ? 0.8 : 0.5;
      }
      
      // Store in history if enabled
      if (this.config.maintainHistory) {
        await this.addToHistory(result);
      }
      
    } catch (error) {
      // Handle critical errors
      if (!result.processingMetadata.errors) {
        result.processingMetadata.errors = [];
      }
      
      result.processingMetadata.errors.push({
        step: 'general',
        message: error instanceof Error ? error.message : String(error),
        severity: 'error'
      });
    } finally {
      // Update processing time
      result.processingMetadata.processingTimeMs = Date.now() - startTime;
    }
    
    return result;
  }
  
  /**
   * Validate an input message
   * @param message The input message to validate
   * @param options Validation options
   * @returns Promise resolving to the validation result
   */
  async validateInput(
    message: InputMessage | string,
    options?: {
      rules?: Array<{
        type: string;
        params?: unknown;
      }>;
      strictMode?: boolean;
    }
  ): Promise<InputValidationResult> {
    if (!this.config.enabled) {
      throw new Error('Input processor is disabled');
    }
    
    const contentToValidate = typeof message === 'string' 
      ? message 
      : message.content;
    
    // Create validation result matching the interface
    const result: InputValidationResult = {
      valid: true,
      hasBlockingIssues: false,
      issues: []
    };
    
    // Size validation
    if (this.config.maxInputSizeBytes && Buffer.byteLength(contentToValidate, 'utf8') > this.config.maxInputSizeBytes) {
      result.valid = false;
      result.hasBlockingIssues = true;
      result.issues!.push({
        code: 'size_exceeded',
        message: `Input exceeds maximum size of ${this.config.maxInputSizeBytes} bytes`,
        severity: 'error'
      });
    }
    
    // Content filtering based on level
    if (this.config.contentFilteringLevel && this.config.contentFilteringLevel !== 'none') {
      // Simple content filtering (in a real implementation, would use more sophisticated filtering)
      const sensitivePatterns: Record<string, RegExp[]> = {
        low: [/\b(password|secret|credit\s*card)\b/i],
        medium: [/\b(password|secret|credit\s*card|ssn|social\s*security)\b/i, /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/],
        high: [/\b(password|secret|credit\s*card|ssn|social\s*security|address|phone|email)\b/i, /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/, /\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/]
      };
      
      // Get patterns for the configured level
      const patterns = sensitivePatterns[this.config.contentFilteringLevel as keyof typeof sensitivePatterns] || [];
      
      // Check for matches
      for (const pattern of patterns) {
        if (pattern.test(contentToValidate)) {
          if (this.config.contentFilteringLevel === 'high') {
            result.valid = false;
            result.hasBlockingIssues = true;
            result.issues!.push({
              code: 'sensitive_content',
              message: 'Input contains potentially sensitive information',
              severity: 'error'
            });
          } else {
            result.issues!.push({
              code: 'sensitive_content',
              message: 'Input may contain sensitive information',
              severity: 'warning'
            });
          }
          break;
        }
      }
    }
    
    // Custom validation rules
    if (options?.rules) {
      for (const rule of options.rules) {
        switch (rule.type) {
          case 'length':
            const lengthParams = rule.params as { min?: number; max?: number } || {};
            if (lengthParams.min !== undefined && contentToValidate.length < lengthParams.min) {
              result.valid = false;
              result.hasBlockingIssues = true;
              result.issues!.push({
                code: 'length_too_short',
                message: `Input is too short (minimum ${lengthParams.min} characters)`,
                severity: 'error'
              });
            }
            if (lengthParams.max !== undefined && contentToValidate.length > lengthParams.max) {
              result.valid = false;
              result.hasBlockingIssues = true;
              result.issues!.push({
                code: 'length_too_long',
                message: `Input is too long (maximum ${lengthParams.max} characters)`,
                severity: 'error'
              });
            }
            break;
            
          case 'pattern':
            const patternParams = (rule.params as { pattern: string; message: string }) || { pattern: '', message: '' };
            if (patternParams.pattern && !new RegExp(patternParams.pattern).test(contentToValidate)) {
              result.valid = false;
              result.hasBlockingIssues = true;
              result.issues!.push({
                code: 'pattern_mismatch',
                message: patternParams.message || 'Input does not match required pattern',
                severity: 'error'
              });
            }
            break;
            
          // Additional rule types could be implemented here
        }
      }
    }
    
    return result;
  }
  
  /**
   * Register a custom preprocessor
   * @param preprocessor The preprocessor to register
   * @returns Promise resolving to the registered preprocessor
   */
  async registerPreprocessor(preprocessor: InputPreprocessor): Promise<InputPreprocessor> {
    this.preprocessors.set(preprocessor.id, preprocessor);
    return preprocessor;
  }
  
  /**
   * Unregister a preprocessor
   * @param preprocessorId The preprocessor ID to unregister
   * @returns Promise resolving to true if unregistered, false if not found
   */
  async unregisterPreprocessor(preprocessorId: string): Promise<boolean> {
    return this.preprocessors.delete(preprocessorId);
  }
  
  /**
   * Get a preprocessor by ID
   * @param preprocessorId The preprocessor ID to retrieve
   * @returns Promise resolving to the preprocessor or null if not found
   */
  async getPreprocessor(preprocessorId: string): Promise<InputPreprocessor | null> {
    return this.preprocessors.get(preprocessorId) || null;
  }
  
  /**
   * List all registered preprocessors
   * @param options Filter options
   * @returns Promise resolving to matching preprocessors
   */
  async listPreprocessors(options?: {
    enabled?: boolean;
    sortBy?: 'order' | 'id' | 'name';
    sortDirection?: 'asc' | 'desc';
  }): Promise<InputPreprocessor[]> {
    let preprocessors = Array.from(this.preprocessors.values());
    
    // Filter by enabled state if specified
    if (options?.enabled !== undefined) {
      preprocessors = preprocessors.filter(p => p.enabled === options.enabled);
    }
    
    // Sort if specified
    if (options?.sortBy) {
      const sortKey = options.sortBy;
      const sortMultiplier = options.sortDirection === 'desc' ? -1 : 1;
      
      preprocessors.sort((a, b) => {
        if (sortKey === 'order') {
          return (a.order - b.order) * sortMultiplier;
        } else if (sortKey === 'id') {
          return a.id.localeCompare(b.id) * sortMultiplier;
        } else if (sortKey === 'name') {
          return a.name.localeCompare(b.name) * sortMultiplier;
        }
        return 0;
      });
    }
    
    return preprocessors;
  }
  
  /**
   * Enable or disable a preprocessor
   */
  async setPreprocessorEnabled(preprocessorId: string, enabled: boolean): Promise<InputPreprocessor> {
    const preprocessor = await this.getPreprocessor(preprocessorId);
    if (!preprocessor) {
      throw new Error(`Preprocessor ${preprocessorId} not found`);
    }
    
    preprocessor.enabled = enabled;
    return preprocessor;
  }
  
  /**
   * Set preprocessor order
   */
  async setPreprocessorOrder(preprocessorId: string, order: number): Promise<InputPreprocessor> {
    const preprocessor = await this.getPreprocessor(preprocessorId);
    if (!preprocessor) {
      throw new Error(`Preprocessor ${preprocessorId} not found`);
    }
    
    preprocessor.order = order;
    return preprocessor;
  }
  
  /**
   * Add a processed input to history
   * @param input The processed input to add to history
   * @returns Promise resolving to the added history item ID
   */
  async addToHistory(input: ProcessedInput): Promise<string> {
    // Add to history
    this.history.push(input);
    
    // Trim history if it exceeds max size
    if (this.config.maxHistoryItems && this.history.length > this.config.maxHistoryItems) {
      this.history = this.history.slice(-this.config.maxHistoryItems);
    }
    
    // Return input ID (or generate one if not present)
    return input.originalMessage.id || `input_${Date.now()}`;
  }
  
  /**
   * Get the input history
   * @returns The input history
   */
  async getHistory(options?: {
    limit?: number;
    offset?: number;
    senderId?: string;
    fromDate?: Date;
    toDate?: Date;
    conversationId?: string;
  }): Promise<ProcessedInput[]> {
    let results = [...this.history];
    
    // Apply filters
    if (options) {
      if (options.senderId) {
        results = results.filter(item => 
          item.originalMessage.senderId === options.senderId);
      }
      
      if (options.fromDate) {
        results = results.filter(item => 
          item.originalMessage.timestamp >= options.fromDate!);
      }
      
      if (options.toDate) {
        results = results.filter(item => 
          item.originalMessage.timestamp <= options.toDate!);
      }
      
      if (options.conversationId) {
        results = results.filter(item => 
          item.originalMessage.context?.conversationId === options.conversationId);
      }
      
      // Apply pagination
      if (options.offset !== undefined || options.limit !== undefined) {
        const offset = options.offset || 0;
        const limit = options.limit || results.length;
        results = results.slice(offset, offset + limit);
      }
    }
    
    return results;
  }
  
  /**
   * Clear the input history
   * @param options Clear options
   * @returns Promise resolving to the number of cleared items
   */
  async clearHistory(options?: {
    senderId?: string;
    olderThan?: Date;
    conversationId?: string;
  }): Promise<number> {
    const originalCount = this.history.length;
    
    if (options) {
      // Apply selective clearing based on options
      this.history = this.history.filter(item => {
        // Keep items that don't match the filter criteria
        if (options.senderId && item.originalMessage.senderId === options.senderId) {
          return false;
        }
        
        if (options.olderThan && new Date(item.originalMessage.timestamp) < options.olderThan) {
          return false;
        }
        
        if (options.conversationId && 
            item.originalMessage.context?.conversationId === options.conversationId) {
          return false;
        }
        
        return true;
      });
    } else {
      // Clear all history
      this.history = [];
    }
    
    return originalCount - this.history.length;
  }

  /**
   * Get the top input modalities
   */
  private getTopModalities(): Array<{
    modality: string;
    count: number;
    percentage: number;
  }> {
    if (this.history.length === 0) {
      return [];
    }
    
    // Count modalities
    const modalityCounts: Record<string, number> = {};
    
    this.history.forEach(item => {
      const modality = item.originalMessage.modality || 'text';
      modalityCounts[modality] = (modalityCounts[modality] || 0) + 1;
    });
    
    // Convert to array and sort
    return Object.entries(modalityCounts)
      .map(([modality, count]) => ({
        modality,
        count,
        percentage: (count / this.history.length) * 100
      }))
      .sort((a, b) => b.count - a.count);
  }
  
  /**
   * Get detected languages
   */
  private getDetectedLanguages(): Record<string, number> {
    const languageCounts: Record<string, number> = {};
    
    this.history.forEach(item => {
      if (item.detectedLanguage) {
        languageCounts[item.detectedLanguage] = (languageCounts[item.detectedLanguage] || 0) + 1;
      }
    });
    
    return languageCounts;
  }
} 