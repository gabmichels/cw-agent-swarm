/**
 * Default Output Processor Implementation
 * 
 * This file implements the default output processor that handles processing,
 * validation, and managing output messages.
 */

import { v4 as uuidv4 } from 'uuid';
import { AbstractBaseManager } from '../../base/managers/BaseManager';
import { 
  OutputProcessor,
  OutputProcessorConfig,
  OutputMessage,
  ProcessedOutput,
  OutputProcessorStep,
  OutputValidationResult,
  OutputTemplate
} from '../../base/managers/OutputProcessor.interface';
import { AgentBase } from '../../base/AgentBase.interface';
import { createConfigFactory } from '../../config';
import { OutputProcessorConfigSchema } from '../config/OutputProcessorConfigSchema';
import { ManagerType } from '../../base/managers/ManagerType';
import { ManagerHealth } from '../../base/managers/ManagerHealth';

/**
 * Default implementation of the OutputProcessor interface
 */
export class DefaultOutputProcessor extends AbstractBaseManager implements OutputProcessor {
  protected config: OutputProcessorConfig;
  private processorSteps: Map<string, OutputProcessorStep> = new Map();
  private history: ProcessedOutput[] = [];
  private configFactory = createConfigFactory(OutputProcessorConfigSchema);
  private templates: Map<string, OutputTemplate> = new Map();
  
  /**
   * Type property accessor for compatibility with OutputProcessor
   * Use managerType property to avoid infinite recursion
   */
  get type(): string {
    return this.managerType;
  }
  
  /**
   * Create a new DefaultOutputProcessor
   * @param agent The agent this processor belongs to
   * @param config Configuration options
   */
  constructor(
    agent: AgentBase,
    config: Partial<OutputProcessorConfig> = {}
  ) {
    super(
      `output-processor-${uuidv4()}`,
      ManagerType.OUTPUT,
      agent,
      { enabled: true }
    );
    
    // Validate and apply configuration with defaults
    this.config = this.configFactory.create({
      enabled: true,
      ...config
    }) as OutputProcessorConfig;
    
    // Initialize default processor steps based on configuration
    this.initializeDefaultProcessorSteps();
    
    // Initialize default templates
    if (this.config.defaultTemplates) {
      for (const [key, value] of Object.entries(this.config.defaultTemplates)) {
        this.templates.set(key, {
          id: key,
          content: value,
          name: key,
          description: `Default template: ${key}`,
          variables: [],
          category: 'default',
          version: '1.0.0',
          modality: 'markdown',
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }
  }
  
  /**
   * Update the manager configuration
   */
  // @ts-ignore - Override BaseManager updateConfig() method with specific type
  updateConfig<T extends OutputProcessorConfig>(config: Partial<T>): T {
    // Validate and merge configuration
    this.config = this.configFactory.create({
      ...this.config, 
      ...config
    }) as OutputProcessorConfig;
    
    // Reinitialize processor steps with new configuration
    if ('processingSteps' in config) {
      this.processorSteps.clear();
      this.initializeDefaultProcessorSteps();
    }
    
    // Update templates if needed
    if ('defaultTemplates' in config && config.defaultTemplates) {
      // Add or update templates
      for (const [key, value] of Object.entries(config.defaultTemplates)) {
        if (!this.templates.has(key)) {
          // Create new template
          this.templates.set(key, {
            id: key,
            content: value,
            name: key,
            description: `Default template: ${key}`,
            variables: [],
            category: 'default',
            version: '1.0.0',
            modality: 'markdown',
            enabled: true,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        } else {
          // Update existing template
          const template = this.templates.get(key)!;
          this.templates.set(key, {
            ...template,
            content: value,
            updatedAt: new Date()
          });
        }
      }
    }
    
    return this.config as unknown as T;
  }
  
  /**
   * Initialize the manager
   */
  async initialize(): Promise<boolean> {
    if (this._initialized) return true;
    
    try {
      // Re-initialize processor steps
      this.processorSteps.clear();
      this.initializeDefaultProcessorSteps();
      
      this._initialized = true;
      return true;
    } catch (error) {
      console.error(`[${this.managerId}] Failed to initialize output processor:`, error);
      return false;
    }
  }
  
  /**
   * Shut down the manager
   */
  async shutdown(): Promise<void> {
    // Clear any resources
    this.processorSteps.clear();
    this.history = [];
    this.templates.clear();
    this._initialized = false;
  }
  
  /**
   * Reset the manager
   */
  async reset(): Promise<boolean> {
    // Clear history
    this.history = [];
    
    // Clear processor steps and reinitialize
    this.processorSteps.clear();
    this.initializeDefaultProcessorSteps();
    
    // Reinitialize default templates
    this.templates.clear();
    if (this.config.defaultTemplates) {
      for (const [key, value] of Object.entries(this.config.defaultTemplates)) {
        this.templates.set(key, {
          id: key,
          content: value,
          name: key,
          description: `Default template: ${key}`,
          variables: [],
          category: 'default',
          version: '1.0.0',
          modality: 'markdown',
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }
    
    return true;
  }
  
  /**
   * Get manager health status
   */
  async getHealth(): Promise<ManagerHealth> {
    if (!this._initialized) {
      return {
        status: 'degraded',
        details: {
          lastCheck: new Date(),
          issues: [{
            severity: 'high',
            message: 'Output processor not initialized',
            detectedAt: new Date()
          }],
          metrics: {}
        }
      };
    }

    if (!this.config.enabled) {
      return {
        status: 'degraded',
        details: {
          lastCheck: new Date(),
          issues: [{
            severity: 'medium',
            message: 'Output processor is disabled',
            detectedAt: new Date()
          }],
          metrics: {}
        }
      };
    }

    // Get processor stats
    const stats = await this.getStats();
    
    return {
      status: 'healthy',
      details: {
        lastCheck: new Date(),
        issues: [],
        metrics: {
          ...stats,
          processorStepCount: this.processorSteps.size,
          templateCount: this.templates.size,
          historySize: this.history.length
        }
      }
    };
  }
  
  /**
   * Initialize default processor steps based on configuration
   */
  private initializeDefaultProcessorSteps(): void {
    // Initialize processor steps based on configured steps
    if (this.config.processingSteps?.includes('format')) {
      this.registerProcessorStep({
        id: 'format',
        name: 'Content Formatter',
        description: 'Formats output content for display',
        process: async (content: string) => {
          // Simple formatting for markdown code blocks
          if (this.config.formatting?.formatCodeBlocks && 
              this.config.defaultFormat === 'markdown') {
            
            // Replace code blocks with properly formatted markdown code blocks
            const codeBlockRegex = /```(\w+)?\s*\n([\s\S]*?)```/g;
            content = content.replace(codeBlockRegex, (match, language, code) => {
              const lang = language || '';
              return `\`\`\`${lang}\n${code.trim()}\n\`\`\``;
            });
          }
          
          return content;
        },
        enabled: true,
        order: 10,
        category: 'format'
      });
    }
    
    if (this.config.processingSteps?.includes('validate')) {
      this.registerProcessorStep({
        id: 'validate',
        name: 'Content Validator',
        description: 'Validates output content',
        process: async (content: string) => {
          // In a real implementation, would do more sophisticated validation
          // Here we just ensure there are no empty code blocks in markdown
          if (this.config.defaultFormat === 'markdown') {
            content = content.replace(/```\s*\n\s*```/g, '');
          }
          
          return content;
        },
        enabled: true,
        order: 20,
        category: 'validate'
      });
    }
    
    if (this.config.processingSteps?.includes('filter')) {
      this.registerProcessorStep({
        id: 'filter',
        name: 'Content Filter',
        description: 'Filters sensitive or inappropriate content',
        process: async (content: string) => {
          // Simple content filtering based on moderation level
          if (this.config.contentModerationLevel !== 'none') {
            const sensitivePatterns: Record<string, { pattern: RegExp; replacement: string }[]> = {
              low: [
                { pattern: /\b(password|secret)\b/gi, replacement: '[REDACTED]' }
              ],
              medium: [
                { pattern: /\b(password|secret|credit\s*card)\b/gi, replacement: '[REDACTED]' },
                { pattern: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, replacement: '[CARD NUMBER]' }
              ],
              high: [
                { pattern: /\b(password|secret|credit\s*card|ssn|social\s*security)\b/gi, replacement: '[REDACTED]' },
                { pattern: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, replacement: '[CARD NUMBER]' },
                { pattern: /\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/g, replacement: '[SSN]' },
                { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, replacement: '[EMAIL]' }
              ]
            };
            
            const patterns = sensitivePatterns[this.config.contentModerationLevel as keyof typeof sensitivePatterns] || [];
            
            // Apply all patterns
            for (const { pattern, replacement } of patterns) {
              content = content.replace(pattern, replacement);
            }
          }
          
          return content;
        },
        enabled: true,
        order: 30,
        category: 'filter'
      });
    }
    
    if (this.config.processingSteps?.includes('transform')) {
      this.registerProcessorStep({
        id: 'transform',
        name: 'Content Transformer',
        description: 'Transforms content format (e.g., markdown to HTML)',
        process: async (content: string) => {
          // Simple example transformation - would use a proper markdown parser in real implementation
          if (this.config.defaultFormat === 'markdown' && 
              this.config.supportedModalities?.includes('html')) {
            
            // Very basic markdown to HTML conversion (for demonstration)
            // Headers
            content = content.replace(/^# (.*$)/gm, '<h1>$1</h1>');
            content = content.replace(/^## (.*$)/gm, '<h2>$1</h2>');
            content = content.replace(/^### (.*$)/gm, '<h3>$1</h3>');
            
            // Bold
            content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            
            // Italics
            content = content.replace(/\*(.*?)\*/g, '<em>$1</em>');
            
            // Code blocks (very simplified)
            content = content.replace(/```(\w+)?\s*\n([\s\S]*?)```/g, 
              (match, language, code) => `<pre><code>${code}</code></pre>`);
          }
          
          return content;
        },
        enabled: true,
        order: 40,
        category: 'transform'
      });
    }
  }
  
  /**
   * Process an output message
   * @param message The output message to process
   * @param options Processing options
   * @returns Promise resolving to the processed output
   */
  async processOutput(
    message: OutputMessage,
    options?: {
      skipSteps?: string[];
      additionalContext?: unknown;
      targetFormat?: string;
    }
  ): Promise<ProcessedOutput> {
    if (!this.config.enabled) {
      throw new Error('Output processor is disabled');
    }
    
    // Record start time for processing metrics
    const startTime = Date.now();
    
    // Initialize processed output result
    const result: ProcessedOutput = {
      originalMessage: message,
      processedContent: message.content,
      wasModified: false,
      appliedProcessingSteps: [],
      processingMetadata: {
        processingTimeMs: 0
      }
    };
    
    try {
      // Sort processor steps by order
      const sortedSteps = Array.from(this.processorSteps.values())
        .filter(step => step.enabled && (!options?.skipSteps || !options.skipSteps.includes(step.id)))
        .sort((a, b) => a.order - b.order);
      
      // Apply each processor in order
      let currentContent = message.content;
      
      for (const step of sortedSteps) {
        try {
          result.appliedProcessingSteps.push(step.id);
          const processedContent = await step.process(currentContent, options?.additionalContext);
          
          if (processedContent !== currentContent) {
            result.wasModified = true;
            currentContent = processedContent;
          }
        } catch (error) {
          // Record the error but continue processing
          if (!result.processingMetadata.errors) {
            result.processingMetadata.errors = [];
          }
          
          result.processingMetadata.errors.push({
            step: step.id,
            message: error instanceof Error ? error.message : String(error),
            severity: 'warning'
          });
        }
      }
      
      // Update the result with processed content
      result.processedContent = currentContent;
      
      // Apply moderation if configured
      if (this.config.contentModerationLevel !== 'none' && !options?.skipSteps?.includes('moderation')) {
        this.applyContentModeration(result);
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
   * Apply content moderation to a processed output
   * @param output The output to moderate
   */
  private applyContentModeration(output: ProcessedOutput): void {
    // Initialize moderation result if needed
    if (!output.moderationResult) {
      output.moderationResult = {
        passed: true,
        flaggedContent: []
      };
    }
    
    // Define sensitive content categories based on moderation level
    const sensitiveCategories: Record<string, { pattern: RegExp; category: string; confidence: number }[]> = {
      low: [
        { pattern: /\b(password|secret)\b/gi, category: 'sensitive_info', confidence: 0.7 }
      ],
      medium: [
        { pattern: /\b(password|secret|credential|credit\s*card)\b/gi, category: 'sensitive_info', confidence: 0.8 },
        { pattern: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, category: 'payment_info', confidence: 0.9 }
      ],
      high: [
        { pattern: /\b(password|secret|credential|credit\s*card|ssn|social\s*security)\b/gi, category: 'sensitive_info', confidence: 0.9 },
        { pattern: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, category: 'payment_info', confidence: 0.95 },
        { pattern: /\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/g, category: 'ssn', confidence: 0.95 },
        { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, category: 'email', confidence: 0.8 }
      ]
    };
    
    const level = this.config.contentModerationLevel as keyof typeof sensitiveCategories;
    const categories = sensitiveCategories[level] || [];
    let overallScore = 0;
    
    // Check content against sensitive patterns
    for (const { pattern, category, confidence } of categories) {
      const matches = output.processedContent.match(pattern);
      
      if (matches) {
        for (const match of matches) {
          output.moderationResult.flaggedContent.push({
            content: match,
            category,
            confidence
          });
          
          if (confidence > overallScore) {
            overallScore = confidence;
          }
        }
        
        // If high moderation, mark as failing moderation
        if (level === 'high') {
          output.moderationResult.passed = false;
        }
      }
    }
    
    // We don't set score since it's not in the interface
  }
  
  /**
   * Register a processor step
   * @param step The processor step to register
   * @returns Promise resolving to the registered step
   */
  async registerProcessorStep(step: OutputProcessorStep): Promise<OutputProcessorStep> {
    this.processorSteps.set(step.id, step);
    return step;
  }
  
  /**
   * Unregister a processor step
   * @param stepId The processor step ID to unregister
   * @returns Promise resolving to true if unregistered, false if not found
   */
  async unregisterProcessorStep(stepId: string): Promise<boolean> {
    return this.processorSteps.delete(stepId);
  }
  
  /**
   * Get a processor step by ID
   * @param stepId The processor step ID to retrieve
   * @returns Promise resolving to the step or null if not found
   */
  async getProcessorStep(stepId: string): Promise<OutputProcessorStep | null> {
    return this.processorSteps.get(stepId) || null;
  }
  
  /**
   * List all registered processor steps
   * @param options Filter options
   * @returns Promise resolving to matching processor steps
   */
  async listProcessorSteps(options?: {
    enabled?: boolean;
    category?: string;
    sortBy?: 'order' | 'id' | 'name' | 'category';
    sortDirection?: 'asc' | 'desc';
  }): Promise<OutputProcessorStep[]> {
    let steps = Array.from(this.processorSteps.values());
    
    // Filter by enabled state if specified
    if (options?.enabled !== undefined) {
      steps = steps.filter(s => s.enabled === options.enabled);
    }
    
    // Filter by category if specified
    if (options?.category) {
      steps = steps.filter(s => s.category === options.category);
    }
    
    // Sort if specified
    if (options?.sortBy) {
      const sortKey = options.sortBy;
      const sortMultiplier = options.sortDirection === 'desc' ? -1 : 1;
      
      steps.sort((a, b) => {
        if (sortKey === 'order') {
          return (a.order - b.order) * sortMultiplier;
        } else if (sortKey === 'id') {
          return a.id.localeCompare(b.id) * sortMultiplier;
        } else if (sortKey === 'name') {
          return a.name.localeCompare(b.name) * sortMultiplier;
        } else if (sortKey === 'category') {
          return a.category.localeCompare(b.category) * sortMultiplier;
        }
        return 0;
      });
    }
    
    return steps;
  }
  
  /**
   * Create an output message
   * @param content The message content
   * @param recipientId The recipient identifier
   * @param options Additional options
   * @returns Promise resolving to the created message
   */
  async createOutputMessage(
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
  ): Promise<OutputMessage> {
    if (!this.config.enabled) {
      throw new Error('Output processor is disabled');
    }
    
    // Create message ID
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    // Determine modality
    const modality = options?.modality || this.config.defaultFormat as OutputMessage['modality'];
    
    // Create the message
    const message: OutputMessage = {
      id: messageId,
      recipientId,
      timestamp: new Date(),
      content,
      modality,
      context: options?.context ? {
        conversationId: options.context.conversationId as string,
        replyToMessageId: options.context.replyToMessageId as string,
        threadId: options.context.threadId as string,
        sessionId: options.context.sessionId as string
      } : undefined,
      attachments: options?.attachments?.map(attachment => ({
        id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        type: attachment.type,
        data: attachment.data,
        metadata: {}
      })),
      tags: options?.tags
    };
    
    // If metadata is enabled, add it
    if (this.config.includeMetadata) {
      message.metadata = {
        generator: this.managerId,
        generatedAt: new Date().toISOString(),
        format: modality,
        config: {
          processingSteps: this.config.processingSteps
        },
        agentId: this.agent.getAgentId() // Store agent ID in metadata instead
      };
    }
    
    return message;
  }
  
  /**
   * Set processor step enabled state
   * @param stepId The step ID to update
   * @param enabled Whether the step should be enabled
   * @returns Promise resolving to the updated step
   */
  async setProcessorStepEnabled(stepId: string, enabled: boolean): Promise<OutputProcessorStep> {
    const step = await this.getProcessorStep(stepId);
    if (!step) {
      throw new Error(`Processor step '${stepId}' not found`);
    }
    
    step.enabled = enabled;
    return step;
  }
  
  /**
   * Set processor step order
   * @param stepId The step ID to update
   * @param order The new order value
   * @returns Promise resolving to the updated step
   */
  async setProcessorStepOrder(stepId: string, order: number): Promise<OutputProcessorStep> {
    const step = await this.getProcessorStep(stepId);
    if (!step) {
      throw new Error(`Processor step '${stepId}' not found`);
    }
    
    step.order = order;
    return step;
  }
  
  /**
   * Validate output content
   * @param content The content to validate
   * @param format The content format
   * @param options Validation options
   * @returns Promise resolving to the validation result
   */
  async validateOutput(
    content: string,
    format: OutputMessage['modality'],
    options?: {
      strictMode?: boolean;
      customRules?: Array<{
        type: string;
        params?: unknown;
      }>;
    }
  ): Promise<OutputValidationResult> {
    if (!this.config.enabled) {
      throw new Error('Output processor is disabled');
    }
    
    // Initialize validation result with required fields
    const result: OutputValidationResult = {
      valid: true,
      hasBlockingIssues: false,
      issues: [] // Always initialize issues as an array
    };
    
    // Size validation
    const maxOutputSizeBytes = this.config.maxOutputSizeBytes as number | undefined;
    if (maxOutputSizeBytes && Buffer.byteLength(content, 'utf8') > maxOutputSizeBytes) {
      result.valid = false;
      result.hasBlockingIssues = true;
      result.issues.push({
        code: 'size_exceeded',
        message: `Output exceeds maximum size of ${maxOutputSizeBytes} bytes`,
        severity: 'error'
      });
    }
    
    // Format-specific validation
    switch (format) {
      case 'markdown':
        // Check for unclosed code blocks
        const codeBlockMatches = content.match(/```/g);
        if (codeBlockMatches && codeBlockMatches.length % 2 !== 0) {
          result.valid = false;
          result.hasBlockingIssues = true;
          result.issues.push({
            code: 'unclosed_code_block',
            message: 'Markdown contains unclosed code blocks',
            severity: 'error'
          });
        }
        break;
        
      case 'json':
        // Check for valid JSON
        try {
          JSON.parse(content);
        } catch (error) {
          result.valid = false;
          result.hasBlockingIssues = true;
          result.issues.push({
            code: 'invalid_json',
            message: 'Invalid JSON format',
            severity: 'error'
          });
        }
        break;
        
      case 'html':
        // Check for basic HTML issues like unclosed tags
        const unclosedTags = ['div', 'span', 'p', 'table', 'ul', 'ol', 'li', 'form', 'a']
          .filter(tag => {
            const openRegex = new RegExp(`<${tag}(?:\\s|>)`, 'gi');
            const closeRegex = new RegExp(`</${tag}>`, 'gi');
            const openCount = (content.match(openRegex) || []).length;
            const closeCount = (content.match(closeRegex) || []).length;
            return openCount !== closeCount;
          });
        
        if (unclosedTags.length > 0) {
          result.valid = false;
          result.hasBlockingIssues = true;
          result.issues.push({
            code: 'unclosed_html_tags',
            message: `HTML contains unclosed tags: ${unclosedTags.join(', ')}`,
            severity: 'error'
          });
        }
        break;
    }
    
    // Custom validation rules
    if (options?.customRules) {
      for (const rule of options.customRules) {
        switch (rule.type) {
          case 'length':
            const lengthParams = rule.params as { min?: number; max?: number } || {};
            if (lengthParams.min !== undefined && content.length < lengthParams.min) {
              result.valid = false;
              result.hasBlockingIssues = true;
              result.issues.push({
                code: 'length_too_short',
                message: `Output is too short (minimum ${lengthParams.min} characters)`,
                severity: 'error'
              });
            }
            if (lengthParams.max !== undefined && content.length > lengthParams.max) {
              result.valid = false;
              result.hasBlockingIssues = true;
              result.issues.push({
                code: 'length_too_long',
                message: `Output is too long (maximum ${lengthParams.max} characters)`,
                severity: 'error'
              });
            }
            break;
            
          case 'pattern':
            const patternParams = (rule.params as { pattern: string; message: string }) || { pattern: '', message: '' };
            if (patternParams.pattern && !new RegExp(patternParams.pattern).test(content)) {
              result.valid = false;
              result.hasBlockingIssues = true;
              result.issues.push({
                code: 'pattern_mismatch',
                message: patternParams.message || 'Output does not match required pattern',
                severity: 'error'
              });
            }
            break;
        }
      }
    }
    
    return result;
  }
  
  /**
   * Add an output to history
   * @param output The processed output to add to history
   * @returns Promise resolving to the added history item ID
   */
  async addToHistory(output: ProcessedOutput): Promise<string> {
    // Add to history
    this.history.push(output);
    
    // Trim history if it exceeds max size
    if (this.config.maxHistoryItems && this.history.length > this.config.maxHistoryItems) {
      this.history = this.history.slice(-this.config.maxHistoryItems);
    }
    
    return output.originalMessage.id;
  }
  
  /**
   * Get output history
   * @param options History retrieval options
   * @returns Promise resolving to matching history items
   */
  async getHistory(options?: {
    limit?: number;
    offset?: number;
    recipientId?: string;
    fromDate?: Date;
    toDate?: Date;
    conversationId?: string;
  }): Promise<ProcessedOutput[]> {
    let result = [...this.history];
    
    // Apply filters
    if (options?.recipientId) {
      result = result.filter(item => 
        item.originalMessage.recipientId === options.recipientId);
    }
    
    if (options?.fromDate) {
      result = result.filter(item => 
        item.originalMessage.timestamp >= options.fromDate!);
    }
    
    if (options?.toDate) {
      result = result.filter(item => 
        item.originalMessage.timestamp <= options.toDate!);
    }
    
    if (options?.conversationId) {
      result = result.filter(item => 
        item.originalMessage.context?.conversationId === options.conversationId);
    }
    
    // Apply pagination
    const offset = options?.offset || 0;
    const limit = options?.limit || result.length;
    
    return result.slice(offset, offset + limit);
  }
  
  /**
   * Clear output history
   * @param options Clear options
   * @returns Promise resolving to the number of history items cleared
   */
  async clearHistory(options?: {
    recipientId?: string;
    olderThan?: Date;
    conversationId?: string;
  }): Promise<number> {
    const originalLength = this.history.length;
    
    if (options) {
      // Selective clearing based on options
      this.history = this.history.filter(item => {
        if (options.recipientId && item.originalMessage.recipientId === options.recipientId) {
          return false;
        }
        
        if (options.olderThan && item.originalMessage.timestamp < options.olderThan) {
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
    
    return originalLength - this.history.length;
  }

  /**
   * Format content based on target format
   */
  async formatContent(
    content: string,
    format: "text" | "markdown" | "html" | "json" | "image" | "audio" | "structured",
    options?: Record<string, unknown>
  ): Promise<string> {
    if (!this.config.enabled) {
      throw new Error('Output processor is disabled');
    }
    
    // Handle different formats
    switch (format) {
      case 'markdown':
        // Format markdown content
        return this.formatMarkdown(content, options);
        
      case 'html':
        // Format HTML content
        return this.formatHtml(content, options);
        
      case 'json':
        // Format JSON content
        return this.formatJson(content, options);
        
      default:
        // For other formats, just return the content as is
        return content;
    }
  }
  
  /**
   * Format markdown content
   */
  private formatMarkdown(content: string, options?: Record<string, unknown>): string {
    // Simple formatting for markdown code blocks
    if (this.config.formatting?.formatCodeBlocks) {
      // Replace code blocks with properly formatted markdown code blocks
      const codeBlockRegex = /```(\w+)?\s*\n([\s\S]*?)```/g;
      content = content.replace(codeBlockRegex, (match, language, code) => {
        const lang = language || '';
        return `\`\`\`${lang}\n${code.trim()}\n\`\`\``;
      });
    }
    
    return content;
  }
  
  /**
   * Format HTML content
   */
  private formatHtml(content: string, options?: Record<string, unknown>): string {
    // Basic HTML formatting
    return content;
  }
  
  /**
   * Format JSON content
   */
  private formatJson(content: string, options?: Record<string, unknown>): string {
    try {
      // Parse and stringify to format the JSON
      const parsed = JSON.parse(content);
      const indentSize = options?.indentSize as number || 2; // Use options or default to 2
      return JSON.stringify(parsed, null, indentSize);
    } catch (error) {
      // If parsing fails, return the original content
      return content;
    }
  }

  /**
   * Generate output from a template
   */
  async generateFromTemplate(
    templateId: string,
    variables: Record<string, unknown>,
    options?: {
      fallbackTemplateId?: string;
      format?: 'text' | 'markdown' | 'html' | 'json' | 'image' | 'audio' | 'structured';
    }
  ): Promise<OutputMessage> {
    if (!this.config.enabled) {
      throw new Error('Output processor is disabled');
    }
    
    // Find the template
    const template = this.templates.get(templateId);
    
    // If template not found, try fallback
    if (!template) {
      if (options?.fallbackTemplateId) {
        const fallbackTemplate = this.templates.get(options.fallbackTemplateId);
        if (!fallbackTemplate) {
          throw new Error(`Templates '${templateId}' and '${options.fallbackTemplateId}' not found`);
        }
        return this.createMessageFromTemplate(fallbackTemplate, variables, options?.format);
      }
      throw new Error(`Template '${templateId}' not found`);
    }
    
    return this.createMessageFromTemplate(template, variables, options?.format);
  }
  
  /**
   * Create message from template
   */
  private createMessageFromTemplate(
    template: OutputTemplate,
    variables: Record<string, unknown>,
    format?: 'text' | 'markdown' | 'html' | 'json' | 'image' | 'audio' | 'structured'
  ): OutputMessage {
    // Replace variables in template content
    let content = template.content;
    
    // Replace variables like {{varName}}
    content = content.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return variables[key] !== undefined ? String(variables[key]) : `{{${key}}}`;
    });
    
    // Create the message
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    return {
      id: messageId,
      recipientId: variables.recipientId as string || 'user',
      timestamp: new Date(),
      content,
      modality: format || template.modality,
      metadata: {
        templateId: template.id,
        generator: this.managerId,
        agentId: this.agent.getAgentId() // Store agent ID in metadata
      }
    };
  }

  /**
   * Register a new template
   */
  async registerTemplate(
    template: Omit<OutputTemplate, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<OutputTemplate> {
    if (!this.config.enabled) {
      throw new Error('Output processor is disabled');
    }
    
    const id = template.name.toLowerCase().replace(/\s+/g, '_');
    
    if (this.templates.has(id)) {
      throw new Error(`Template with name '${template.name}' already exists`);
    }
    
    const newTemplate: OutputTemplate = {
      ...template,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.templates.set(id, newTemplate);
    return newTemplate;
  }

  /**
   * Update an existing template
   */
  async updateTemplate(
    templateId: string, 
    updates: Partial<Omit<OutputTemplate, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<OutputTemplate> {
    if (!this.config.enabled) {
      throw new Error('Output processor is disabled');
    }
    
    const template = this.templates.get(templateId);
    
    if (!template) {
      throw new Error(`Template '${templateId}' not found`);
    }
    
    const updatedTemplate: OutputTemplate = {
      ...template,
      ...updates,
      id: template.id,
      createdAt: template.createdAt,
      updatedAt: new Date()
    };
    
    this.templates.set(templateId, updatedTemplate);
    return updatedTemplate;
  }

  /**
   * Get a template by ID
   */
  async getTemplate(templateId: string): Promise<OutputTemplate | null> {
    if (!this.config.enabled) {
      throw new Error('Output processor is disabled');
    }
    
    return this.templates.get(templateId) || null;
  }

  /**
   * List all templates
   */
  async listTemplates(options?: {
    category?: string;
    modality?: 'text' | 'markdown' | 'html' | 'json' | 'image' | 'audio' | 'structured';
    enabled?: boolean;
    sortBy?: 'name' | 'createdAt' | 'updatedAt';
    sortDirection?: 'asc' | 'desc';
  }): Promise<OutputTemplate[]> {
    if (!this.config.enabled) {
      throw new Error('Output processor is disabled');
    }
    
    let templates = Array.from(this.templates.values());
    
    // Apply filters
    if (options) {
      if (options.category !== undefined) {
        templates = templates.filter(t => t.category === options.category);
      }
      
      if (options.modality !== undefined) {
        templates = templates.filter(t => t.modality === options.modality);
      }
      
      if (options.enabled !== undefined) {
        templates = templates.filter(t => t.enabled === options.enabled);
      }
      
      // Apply sorting
      if (options.sortBy) {
        const sortKey = options.sortBy;
        const direction = options.sortDirection === 'desc' ? -1 : 1;
        
        templates.sort((a, b) => {
          if (sortKey === 'name') {
            return a.name.localeCompare(b.name) * direction;
          } else if (sortKey === 'createdAt') {
            return (a.createdAt.getTime() - b.createdAt.getTime()) * direction;
          } else if (sortKey === 'updatedAt') {
            return (a.updatedAt.getTime() - b.updatedAt.getTime()) * direction;
          }
          return 0;
        });
      }
    }
    
    return templates;
  }

  /**
   * Delete a template
   * @param templateId The template ID to delete
   * @returns Promise resolving to true if deleted, false if not found
   */
  async deleteTemplate(templateId: string): Promise<boolean> {
    if (!this.config.enabled) {
      throw new Error('Output processor is disabled');
    }
    
    return this.templates.delete(templateId);
  }

  /**
   * Get statistics about this manager
   */
  async getStats(): Promise<{
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
  }> {
    const totalOutputs = this.history.length;
    
    // Count outputs by modality
    const outputsByModality = this.history.reduce((acc, item) => {
      const modality = item.originalMessage.modality;
      acc[modality] = (acc[modality] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Calculate average processing time
    const averageProcessingTimeMs = totalOutputs > 0 ?
      this.history.reduce((sum, item) => sum + item.processingMetadata.processingTimeMs, 0) / totalOutputs : 0;
    
    // Calculate moderation stats if there are any moderated outputs
    const moderatedOutputs = this.history.filter(item => item.moderationResult);
    const flaggedOutputs = moderatedOutputs.filter(item => 
      item.moderationResult && !item.moderationResult.passed);
    
    let moderationStats;
    if (moderatedOutputs.length > 0) {
      // Count categories
      const categoryCounts = moderatedOutputs.reduce((acc, item) => {
        if (!item.moderationResult?.flaggedContent) return acc;
        
        item.moderationResult.flaggedContent.forEach(content => {
          acc[content.category] = (acc[content.category] || 0) + 1;
        });
        return acc;
      }, {} as Record<string, number>);
      
      moderationStats = {
        flaggedCount: flaggedOutputs.length,
        flaggedPercentage: (flaggedOutputs.length / moderatedOutputs.length) * 100,
        categoryCounts
      };
    }
    
    // Calculate streaming stats (if any)
    // Since streaming isn't in the OutputMessage type, check metadata instead
    const streamedOutputs = this.history.filter(item => 
      item.originalMessage.metadata && 
      (item.originalMessage.metadata as any).streaming && 
      (item.originalMessage.metadata as any).streaming.enabled);
    
    let streamingStats;
    if (streamedOutputs.length > 0) {
      streamingStats = {
        streamedCount: streamedOutputs.length,
        streamedPercentage: (streamedOutputs.length / totalOutputs) * 100,
        averageChunkCount: 0 // Would calculate from actual streaming data
      };
    }
    
    return {
      totalProcessedOutputs: totalOutputs,
      outputsByModality,
      averageProcessingTimeMs,
      ...(moderationStats && { moderationStats }),
      ...(streamingStats && { streamingStats })
    };
  }

  /**
   * Override getConfig to use the correct output processor config type
   */
  getConfig<T extends OutputProcessorConfig>(): T {
    return this.config as T;
  }

  /**
   * Override setEnabled to return synchronously instead of a Promise
   */
  // @ts-ignore - Method signature differs from the base class but fulfills the OutputProcessor interface
  setEnabled(enabled: boolean): boolean {
    this.config.enabled = enabled;
    return this.config.enabled;
  }
} 