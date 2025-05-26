/**
 * OutputProcessingCoordinator.ts - Coordinates output processing and formatting
 * 
 * This component is responsible for:
 * - Output formatting and validation
 * - Response generation coordination
 * - Output routing and delivery
 * - Response quality assurance
 */

import { AgentBase } from '../base/AgentBase.interface';
import { AgentResponse } from '../base/AgentBase.interface';
import { OutputProcessor } from '../base/managers/OutputProcessor.interface';
import { ManagerType } from '../base/managers/ManagerType';
import { createLogger } from '../../../lib/logging/winston-logger';

/**
 * Output processing result
 */
export interface OutputProcessingResult {
  success: boolean;
  processedContent: string;
  originalContent: string;
  formatters: string[];
  validationResults: OutputValidationResult[];
  metadata: Record<string, unknown>;
  warnings: string[];
  errors: string[];
  deliveryInfo?: {
    method: string;
    timestamp: Date;
    status: 'pending' | 'delivered' | 'failed';
  };
}

/**
 * Output validation result
 */
export interface OutputValidationResult {
  ruleName: string;
  passed: boolean;
  message: string;
  severity: 'info' | 'warning' | 'error';
  details?: Record<string, unknown>;
}

/**
 * Output formatter configuration
 */
export interface OutputFormatter {
  name: string;
  enabled: boolean;
  priority: number;
  format: (content: string, response: AgentResponse) => Promise<string>;
  validate?: (content: string) => boolean;
  supportedTypes: string[];
}

/**
 * Output validation rule
 */
export interface OutputValidationRule {
  name: string;
  enabled: boolean;
  priority: number;
  validate: (content: string, response: AgentResponse) => Promise<OutputValidationResult>;
  required: boolean;
}

/**
 * Output delivery configuration
 */
export interface OutputDeliveryConfig {
  method: 'direct' | 'async' | 'streaming' | 'batch';
  retryAttempts: number;
  retryDelay: number;
  timeout: number;
  enableCompression: boolean;
  enableEncryption: boolean;
}

/**
 * Output processing configuration
 */
export interface OutputProcessingConfig {
  enableValidation: boolean;
  enableFormatting: boolean;
  enableQualityAssurance: boolean;
  maxOutputLength: number;
  enableContentSanitization: boolean;
  enableSensitiveDataRedaction: boolean;
  defaultFormat: 'text' | 'markdown' | 'html' | 'json';
  enableMetrics: boolean;
  delivery: OutputDeliveryConfig;
  sensitivePatterns: string[];
}

/**
 * Error class for output processing errors
 */
export class OutputProcessingError extends Error {
  public readonly code: string;
  public readonly context: Record<string, unknown>;

  constructor(message: string, code = 'OUTPUT_PROCESSING_ERROR', context: Record<string, unknown> = {}) {
    super(message);
    this.name = 'OutputProcessingError';
    this.code = code;
    this.context = context;
  }
}

/**
 * OutputProcessingCoordinator class - Coordinates output processing and formatting
 */
export class OutputProcessingCoordinator {
  private logger: ReturnType<typeof createLogger>;
  private agent: AgentBase;
  private config: OutputProcessingConfig;
  private formatters: Map<string, OutputFormatter> = new Map();
  private validationRules: Map<string, OutputValidationRule> = new Map();
  private processingStats: {
    totalProcessed: number;
    successfulProcessed: number;
    failedProcessed: number;
    averageProcessingTime: number;
    totalDelivered: number;
    failedDeliveries: number;
  };

  constructor(agent: AgentBase, config: Partial<OutputProcessingConfig> = {}) {
    this.agent = agent;
    this.logger = createLogger({
      moduleId: 'output-processing-coordinator',
    });
    
    // Set default configuration
    this.config = {
      enableValidation: true,
      enableFormatting: true,
      enableQualityAssurance: true,
      maxOutputLength: 50000,
      enableContentSanitization: true,
      enableSensitiveDataRedaction: true,
      defaultFormat: 'text',
      enableMetrics: true,
      delivery: {
        method: 'direct',
        retryAttempts: 3,
        retryDelay: 1000,
        timeout: 30000,
        enableCompression: false,
        enableEncryption: false
      },
      sensitivePatterns: [
        '(password|secret|token|key)\\s*[:=]\\s*[\\w\\-]+',
        '(api[_\\s]?key|access[_\\s]?token)\\s*[:=]\\s*[\\w\\-]+',
        '(credit[_\\s]?card|ssn|social[_\\s]?security)',
        '\\b\\d{4}[\\s\\-]?\\d{4}[\\s\\-]?\\d{4}[\\s\\-]?\\d{4}\\b', // Credit card pattern
        '\\b\\d{3}[\\s\\-]?\\d{2}[\\s\\-]?\\d{4}\\b' // SSN pattern
      ],
      ...config
    };

    // Initialize processing stats
    this.processingStats = {
      totalProcessed: 0,
      successfulProcessed: 0,
      failedProcessed: 0,
      averageProcessingTime: 0,
      totalDelivered: 0,
      failedDeliveries: 0
    };

    // Initialize default formatters and validation rules
    this.initializeDefaultFormatters();
    this.initializeDefaultValidationRules();
  }

  /**
   * Process output content with formatting and validation
   */
  async processOutput(
    response: AgentResponse
  ): Promise<OutputProcessingResult> {
    const startTime = Date.now();
    
    try {
      this.logger.info('Starting output processing');
      
      const result: OutputProcessingResult = {
        success: false,
        processedContent: response.content,
        originalContent: response.content,
        formatters: [],
        validationResults: [],
        metadata: {
          startTime: new Date().toISOString(),
          originalMetadata: response.metadata
        },
        warnings: [],
        errors: []
      };

      // Step 1: Content sanitization
      if (this.config.enableContentSanitization) {
        result.processedContent = await this.sanitizeContent(result.processedContent);
      }

      // Step 2: Sensitive data redaction
      if (this.config.enableSensitiveDataRedaction) {
        result.processedContent = await this.redactSensitiveData(result.processedContent);
      }

      // Step 3: Apply formatters
      if (this.config.enableFormatting) {
        const formattingResult = await this.applyFormatters(result.processedContent, response);
        result.processedContent = formattingResult.content;
        result.formatters = formattingResult.applied;
      }

      // Step 4: Validate output
      if (this.config.enableValidation) {
        const validationResults = await this.validateOutput(result.processedContent, response);
        result.validationResults = validationResults;
        
        // Check for critical validation failures
        const criticalErrors = validationResults.filter(v => !v.passed && v.severity === 'error');
        if (criticalErrors.length > 0) {
          result.errors = criticalErrors.map(e => e.message);
          throw new OutputProcessingError(
            `Output validation failed: ${criticalErrors.map(e => e.message).join(', ')}`,
            'VALIDATION_FAILED',
            { validationResults: criticalErrors }
          );
        }
        
        // Collect warnings
        const warnings = validationResults.filter(v => !v.passed && v.severity === 'warning');
        result.warnings = warnings.map(w => w.message);
      }

      // Step 5: Quality assurance
      if (this.config.enableQualityAssurance) {
        const qaResult = await this.performQualityAssurance(result.processedContent, response);
        if (!qaResult.passed) {
          result.warnings.push(...qaResult.warnings);
          if (qaResult.critical) {
            result.errors.push(...qaResult.errors);
            throw new OutputProcessingError(
              'Output failed quality assurance',
              'QUALITY_ASSURANCE_FAILED',
              { qaResult }
            );
          }
        }
      }

      // Step 6: Route to output processor if available
      const outputProcessor = this.agent.getManager<OutputProcessor>(ManagerType.OUTPUT_PROCESSOR);
      if (outputProcessor) {
        try {
          // Create output message for processor
          const outputMessage = {
            id: `output_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            recipientId: 'user',
            timestamp: new Date(),
            content: result.processedContent,
            modality: 'text' as const,
            metadata: response.metadata || ({ __placeholder: true } as Record<string, unknown>)
          };
          
          const processorResult = await outputProcessor.processOutput(outputMessage);
          result.processedContent = processorResult.processedContent;
          result.metadata = {
            ...result.metadata,
            outputProcessorUsed: true,
            processorMetadata: processorResult.processingMetadata
          };
        } catch (error) {
          this.logger.warn('Output processor failed, continuing with coordinator result:', { error: error instanceof Error ? error.message : String(error) });
          result.warnings.push(`Output processor failed: ${(error as Error).message}`);
        }
      }

      // Step 7: Prepare for delivery
      const deliveryInfo = await this.prepareDelivery(result.processedContent, response);
      result.deliveryInfo = deliveryInfo;

      // Update final metadata
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      result.metadata = {
        ...result.metadata,
        endTime: new Date().toISOString(),
        processingTime,
        contentLength: result.processedContent.length,
        formatterCount: result.formatters.length
      };

      result.success = true;
      this.updateProcessingStats(true, processingTime);
      
      this.logger.info(`Output processing completed successfully in ${processingTime}ms`);
      return result;
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateProcessingStats(false, processingTime);
      
      this.logger.error('Error during output processing:', { error: error instanceof Error ? error.message : String(error) });
      
      return {
        success: false,
        processedContent: response.content,
        originalContent: response.content,
        formatters: [],
        validationResults: [],
        metadata: {
          error: true,
          errorMessage: (error as Error).message,
          processingTime,
          originalMetadata: response.metadata
        },
        warnings: [],
        errors: [(error as Error).message]
      };
    }
  }

  /**
   * Sanitize output content
   */
  private async sanitizeContent(content: string): Promise<string> {
    let sanitized = content;
    
    // Remove potentially dangerous HTML/script content
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '[SCRIPT_REMOVED]');
    sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '[IFRAME_REMOVED]');
    sanitized = sanitized.replace(/javascript:/gi, 'javascript-blocked:');
    
    // Remove potential XSS vectors
    sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '[EVENT_HANDLER_REMOVED]');
    
    return sanitized;
  }

  /**
   * Redact sensitive data from content
   */
  private async redactSensitiveData(content: string): Promise<string> {
    let redacted = content;
    
    for (const pattern of this.config.sensitivePatterns) {
      const regex = new RegExp(pattern, 'gi');
      redacted = redacted.replace(regex, '[REDACTED]');
    }
    
    return redacted;
  }

  /**
   * Apply formatters to output content
   */
  private async applyFormatters(
    content: string,
    response: AgentResponse
  ): Promise<{ content: string; applied: string[] }> {
    let formattedContent = content;
    const appliedFormatters: string[] = [];
    
    // Determine content type from response metadata
    const contentType = response.metadata?.type as string || this.config.defaultFormat;
    
    // Sort formatters by priority
    const sortedFormatters = Array.from(this.formatters.values())
      .filter(formatter => formatter.enabled)
      .filter(formatter => formatter.supportedTypes.includes(contentType) || formatter.supportedTypes.includes('*'))
      .sort((a, b) => b.priority - a.priority);
    
    for (const formatter of sortedFormatters) {
      try {
        // Check if formatter should be applied
        if (formatter.validate && !formatter.validate(formattedContent)) {
          continue;
        }
        
        const previousContent = formattedContent;
        formattedContent = await formatter.format(formattedContent, response);
        
        if (formattedContent !== previousContent) {
          appliedFormatters.push(formatter.name);
          this.logger.info(`Applied formatter: ${formatter.name}`);
        }
        
      } catch (error) {
        this.logger.warn(`Formatter ${formatter.name} failed:`, { error: error instanceof Error ? error.message : String(error) });
      }
    }
    
    return {
      content: formattedContent,
      applied: appliedFormatters
    };
  }

  /**
   * Validate output content
   */
  private async validateOutput(
    content: string,
    response: AgentResponse
  ): Promise<OutputValidationResult[]> {
    const results: OutputValidationResult[] = [];
    
    // Sort validation rules by priority
    const sortedRules = Array.from(this.validationRules.values())
      .filter(rule => rule.enabled)
      .sort((a, b) => b.priority - a.priority);
    
    for (const rule of sortedRules) {
      try {
        const result = await rule.validate(content, response);
        results.push(result);
        
        // Stop on critical errors if rule is required
        if (!result.passed && result.severity === 'error' && rule.required) {
          break;
        }
      } catch (error) {
        this.logger.warn(`Validation rule ${rule.name} failed:`, { error: error instanceof Error ? error.message : String(error) });
        results.push({
          ruleName: rule.name,
          passed: false,
          message: `Validation rule failed: ${(error as Error).message}`,
          severity: 'error'
        });
      }
    }
    
    return results;
  }

  /**
   * Perform quality assurance checks
   */
  private async performQualityAssurance(
    content: string,
    response: AgentResponse
  ): Promise<{
    passed: boolean;
    critical: boolean;
    warnings: string[];
    errors: string[];
    score: number;
  }> {
    const warnings: string[] = [];
    const errors: string[] = [];
    let score = 100;
    
    // Check content length
    if (content.length === 0) {
      errors.push('Output content is empty');
      score -= 50;
    } else if (content.length > this.config.maxOutputLength) {
      errors.push(`Output exceeds maximum length of ${this.config.maxOutputLength} characters`);
      score -= 30;
    }
    
    // Check for coherence (basic checks)
    if (content.length > 10) {
      const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
      if (sentences.length === 0) {
        warnings.push('Output appears to lack proper sentence structure');
        score -= 10;
      }
    }
    
    // Check for repetition
    const words = content.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    const repetitionRatio = uniqueWords.size / words.length;
    if (repetitionRatio < 0.3 && words.length > 20) {
      warnings.push('Output contains high repetition');
      score -= 15;
    }
    
    // Check for completeness (basic heuristic)
    if (content.endsWith('...') || content.includes('[incomplete]')) {
      warnings.push('Output appears to be incomplete');
      score -= 20;
    }
    
    const critical = errors.length > 0;
    const passed = score >= 70 && !critical;
    
    return {
      passed,
      critical,
      warnings,
      errors,
      score
    };
  }

  /**
   * Prepare output for delivery
   */
  private async prepareDelivery(
    content: string,
    response: AgentResponse
  ): Promise<{
    method: string;
    timestamp: Date;
    status: 'pending' | 'delivered' | 'failed';
  }> {
    const deliveryInfo = {
      method: this.config.delivery.method,
      timestamp: new Date(),
      status: 'pending' as const
    };
    
    try {
      // Simulate delivery preparation based on method
      switch (this.config.delivery.method) {
        case 'direct':
          // Direct delivery - immediate
          (deliveryInfo as any).status = 'delivered';
          this.processingStats.totalDelivered++;
          break;
          
        case 'async':
          // Async delivery - queue for later
          deliveryInfo.status = 'pending';
          break;
          
        case 'streaming':
          // Streaming delivery - prepare chunks
          deliveryInfo.status = 'pending';
          break;
          
        case 'batch':
          // Batch delivery - add to batch
          deliveryInfo.status = 'pending';
          break;
      }
      
    } catch (error) {
      this.logger.error('Error preparing delivery:', { error: error instanceof Error ? error.message : String(error) });
      (deliveryInfo as any).status = 'failed';
      this.processingStats.failedDeliveries++;
    }
    
    return deliveryInfo;
  }

  /**
   * Initialize default formatters
   */
  private initializeDefaultFormatters(): void {
    // Markdown formatter
    this.addFormatter({
      name: 'markdown',
      enabled: true,
      priority: 80,
      supportedTypes: ['markdown', 'text'],
      format: async (content: string) => {
        // Basic markdown formatting
        let formatted = content;
        
        // Convert **bold** to proper markdown
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '**$1**');
        
        // Convert *italic* to proper markdown
        formatted = formatted.replace(/\*(.*?)\*/g, '*$1*');
        
        // Ensure proper line breaks
        formatted = formatted.replace(/\n\n+/g, '\n\n');
        
        return formatted;
      }
    });

    // HTML sanitizer formatter
    this.addFormatter({
      name: 'html_sanitizer',
      enabled: true,
      priority: 90,
      supportedTypes: ['html', '*'],
      format: async (content: string) => {
        // Remove dangerous HTML elements
        let sanitized = content;
        
        // Remove script tags
        sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        
        // Remove event handlers
        sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
        
        // Remove javascript: URLs
        sanitized = sanitized.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');
        
        return sanitized;
      }
    });

    // JSON formatter
    this.addFormatter({
      name: 'json_formatter',
      enabled: true,
      priority: 70,
      supportedTypes: ['json'],
      format: async (content: string) => {
        try {
          // Try to parse and reformat JSON
          const parsed = JSON.parse(content);
          return JSON.stringify(parsed, null, 2);
        } catch {
          // If not valid JSON, return as-is
          return content;
        }
      },
      validate: (content: string) => {
        try {
          JSON.parse(content);
          return true;
        } catch {
          return false;
        }
      }
    });
  }

  /**
   * Initialize default validation rules
   */
  private initializeDefaultValidationRules(): void {
    // Length validation
    this.addValidationRule({
      name: 'length_check',
      enabled: true,
      priority: 100,
      required: true,
      validate: async (content: string) => {
        const isValid = content.length <= this.config.maxOutputLength;
        return {
          ruleName: 'length_check',
          passed: isValid,
          message: isValid 
            ? 'Output length is valid' 
            : `Output exceeds maximum length of ${this.config.maxOutputLength} characters`,
          severity: isValid ? 'info' : 'error',
          details: { length: content.length, maxLength: this.config.maxOutputLength }
        };
      }
    });

    // Content completeness validation
    this.addValidationRule({
      name: 'completeness_check',
      enabled: true,
      priority: 80,
      required: false,
      validate: async (content: string) => {
        const hasIncompleteMarkers = content.includes('[incomplete]') || 
                                   content.includes('[truncated]') ||
                                   content.endsWith('...');
        
        return {
          ruleName: 'completeness_check',
          passed: !hasIncompleteMarkers,
          message: hasIncompleteMarkers 
            ? 'Output appears to be incomplete' 
            : 'Output appears complete',
          severity: hasIncompleteMarkers ? 'warning' : 'info'
        };
      }
    });

    // Sensitive data validation
    this.addValidationRule({
      name: 'sensitive_data_check',
      enabled: this.config.enableSensitiveDataRedaction,
      priority: 90,
      required: false,
      validate: async (content: string) => {
        for (const pattern of this.config.sensitivePatterns) {
          const regex = new RegExp(pattern, 'i');
          if (regex.test(content)) {
            return {
              ruleName: 'sensitive_data_check',
              passed: false,
              message: 'Output may contain sensitive data',
              severity: 'warning',
              details: { pattern }
            };
          }
        }
        
        return {
          ruleName: 'sensitive_data_check',
          passed: true,
          message: 'No sensitive data detected',
          severity: 'info'
        };
      }
    });
  }

  /**
   * Add custom formatter
   */
  addFormatter(formatter: OutputFormatter): void {
    this.formatters.set(formatter.name, formatter);
    this.logger.info(`Added formatter: ${formatter.name}`);
  }

  /**
   * Add custom validation rule
   */
  addValidationRule(rule: OutputValidationRule): void {
    this.validationRules.set(rule.name, rule);
    this.logger.info(`Added validation rule: ${rule.name}`);
  }

  /**
   * Remove formatter
   */
  removeFormatter(name: string): boolean {
    const removed = this.formatters.delete(name);
    if (removed) {
      this.logger.info(`Removed formatter: ${name}`);
    }
    return removed;
  }

  /**
   * Remove validation rule
   */
  removeValidationRule(name: string): boolean {
    const removed = this.validationRules.delete(name);
    if (removed) {
      this.logger.info(`Removed validation rule: ${name}`);
    }
    return removed;
  }

  /**
   * Update processing statistics
   */
  private updateProcessingStats(success: boolean, processingTime: number): void {
    this.processingStats.totalProcessed++;
    
    if (success) {
      this.processingStats.successfulProcessed++;
    } else {
      this.processingStats.failedProcessed++;
    }
    
    // Update average processing time
    const totalSuccessful = this.processingStats.successfulProcessed;
    const currentAverage = this.processingStats.averageProcessingTime;
    
    if (success && totalSuccessful > 0) {
      this.processingStats.averageProcessingTime = 
        ((currentAverage * (totalSuccessful - 1)) + processingTime) / totalSuccessful;
    }
  }

  /**
   * Get processing statistics
   */
  getStatistics(): typeof this.processingStats {
    return { ...this.processingStats };
  }

  /**
   * Get current configuration
   */
  getConfig(): OutputProcessingConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<OutputProcessingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Output processing configuration updated');
  }

  /**
   * Get available formatters
   */
  getFormatters(): OutputFormatter[] {
    return Array.from(this.formatters.values());
  }

  /**
   * Get available validation rules
   */
  getValidationRules(): OutputValidationRule[] {
    return Array.from(this.validationRules.values());
  }
} 