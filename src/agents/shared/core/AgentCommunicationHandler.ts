/**
 * AgentCommunicationHandler.ts - Handles agent communication and message processing
 * 
 * This component is responsible for:
 * - Message processing and routing
 * - Input/output coordination
 * - Communication protocol handling
 * - Message validation and sanitization
 */

import { AgentBase } from '../base/AgentBase.interface';
import { AgentResponse, MessageProcessingOptions } from '../base/AgentBase.interface';
import { InputProcessor } from '../base/managers/InputProcessor.interface';
import { OutputProcessor } from '../base/managers/OutputProcessor.interface';
import { ManagerType } from '../base/managers/ManagerType';
import { createLogger } from '../../../lib/logging/winston-logger';

/**
 * Message types supported by the communication handler
 */
export enum MessageType {
  TEXT = 'text',
  COMMAND = 'command',
  QUERY = 'query',
  SYSTEM = 'system',
  ERROR = 'error',
  NOTIFICATION = 'notification'
}

/**
 * Message priority levels
 */
export enum MessagePriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent'
}

/**
 * Communication protocol types
 */
export enum CommunicationProtocol {
  DIRECT = 'direct',
  ASYNC = 'async',
  STREAMING = 'streaming',
  BATCH = 'batch'
}

/**
 * Message structure for internal processing
 */
export interface ProcessedMessage {
  id: string;
  content: string;
  type: MessageType;
  priority: MessagePriority;
  protocol: CommunicationProtocol;
  timestamp: Date;
  metadata: Record<string, unknown>;
  attachments?: Array<{
    type: string;
    data: unknown;
    metadata: Record<string, unknown>;
  }>;
  context?: {
    conversationId?: string;
    sessionId?: string;
    userId?: string;
    agentId?: string;
  };
}

/**
 * Message validation result
 */
export interface MessageValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitizedContent?: string;
}

/**
 * Communication configuration
 */
export interface CommunicationConfig {
  enableInputValidation: boolean;
  enableOutputSanitization: boolean;
  maxMessageLength: number;
  allowedProtocols: CommunicationProtocol[];
  rateLimiting: {
    enabled: boolean;
    maxMessagesPerMinute: number;
    maxMessagesPerHour: number;
  };
  security: {
    enableContentFiltering: boolean;
    blockedPatterns: string[];
    allowedDomains: string[];
  };
}

/**
 * Error class for communication-related errors
 */
export class CommunicationError extends Error {
  public readonly code: string;
  public readonly context: Record<string, unknown>;

  constructor(message: string, code = 'COMMUNICATION_ERROR', context: Record<string, unknown> = {}) {
    super(message);
    this.name = 'CommunicationError';
    this.code = code;
    this.context = context;
  }
}

/**
 * AgentCommunicationHandler class - Handles agent communication and message processing
 */
export class AgentCommunicationHandler {
  private logger: ReturnType<typeof createLogger>;
  private agent: AgentBase;
  private config: CommunicationConfig;
  private messageQueue: ProcessedMessage[] = [];
  private rateLimitTracker: Map<string, { count: number; lastReset: Date }> = new Map();
  private processingQueue: Promise<void> = Promise.resolve();
  private statistics = {
    totalMessages: 0,
    processingTimes: [] as number[]
  };
  private processingMessages: Set<string> = new Set(); // Circuit breaker for infinite loops

  constructor(agent: AgentBase, config: Partial<CommunicationConfig> = {}) {
    this.agent = agent;
    this.logger = createLogger({
      moduleId: 'agent-communication-handler',
    });
    
    // Set default configuration
    this.config = {
      enableInputValidation: true,
      enableOutputSanitization: true,
      maxMessageLength: 10000,
      allowedProtocols: [
        CommunicationProtocol.DIRECT,
        CommunicationProtocol.ASYNC,
        CommunicationProtocol.STREAMING
      ],
      rateLimiting: {
        enabled: true,
        maxMessagesPerMinute: 60,
        maxMessagesPerHour: 1000
      },
      security: {
        enableContentFiltering: true,
        blockedPatterns: [
          '(password|secret|token|key)\\s*[:=]\\s*[\\w\\-]+',
          '(api[_\\s]?key|access[_\\s]?token)\\s*[:=]\\s*[\\w\\-]+',
          '(credit[_\\s]?card|ssn|social[_\\s]?security)'
        ],
        allowedDomains: []
      },
      ...config
    };
  }

  /**
   * Process incoming message
   */
  async processMessage(
    content: string,
    options: MessageProcessingOptions = {}
  ): Promise<AgentResponse> {
    const startTime = Date.now();
    let messageKey: string | null = null;
    
    try {
      this.logger.info('Processing incoming message');
      
      // Track message
      this.statistics.totalMessages++;
      
      // Create processed message
      const processedMessage = await this.createProcessedMessage(content, options);
      
      // Circuit breaker: Only block if we detect a true infinite loop
      // Use message ID to detect actual circular processing, not just similar content
      const now = Date.now();
      const sessionId = processedMessage.context?.sessionId || processedMessage.context?.userId || 'default';
      
      // Use message ID for precise duplicate detection - only block exact same message
      messageKey = `${sessionId}-${processedMessage.id}`;
      
      // Only block if we're processing the exact same message ID
      if (this.processingMessages.has(messageKey)) {
        this.logger.warn('True circular processing detected - same message ID processed twice', {
          messageKey: messageKey.substring(0, 100) + '...',
          messageId: processedMessage.id,
          content: processedMessage.content.substring(0, 100) + '...'
        });
        return {
          content: 'Circular message processing detected and prevented',
          metadata: {
            messageId: processedMessage.id,
            loopPrevented: true,
            timestamp: new Date().toISOString()
          }
        };
      }
      
      // Add to processing set
      this.processingMessages.add(messageKey);
      
      // Validate message
      const validationResult = await this.validateMessage(processedMessage);
      if (!validationResult.isValid) {
        throw new CommunicationError(
          `Message validation failed: ${validationResult.errors.join(', ')}`,
          'VALIDATION_FAILED',
          { errors: validationResult.errors, warnings: validationResult.warnings }
        );
      }
      
      // Check rate limiting
      if (this.config.rateLimiting.enabled) {
        const rateLimitCheck = this.checkRateLimit(processedMessage);
        if (!rateLimitCheck.allowed) {
          this.logger.error('Rate limit exceeded');
          throw new CommunicationError(
            'Rate limit exceeded',
            'RATE_LIMIT_EXCEEDED',
            { rateLimitInfo: rateLimitCheck }
          );
        }
      }
      
      // Route message based on protocol
      const response = await this.routeMessage(processedMessage, options);
      
      // Sanitize output if enabled
      if (this.config.enableOutputSanitization) {
        response.content = this.sanitizeOutput(response.content);
      }
      
      // Track processing time
      const processingTime = Date.now() - startTime;
      this.statistics.processingTimes.push(processingTime);
      
      this.logger.info('Message processed successfully');
      return response;
      
    } catch (error) {
      this.logger.error('Error processing message:', { error: error instanceof Error ? error.message : String(error) });
      
      return {
        content: `Error processing message: ${(error as Error).message}`,
        metadata: {
          error: true,
          errorCode: (error as CommunicationError).code || 'UNKNOWN_ERROR',
          timestamp: new Date().toISOString()
        }
      };
    } finally {
      // Clean up processing set
      if (messageKey) {
        this.processingMessages.delete(messageKey);
      }
    }
  }

  /**
   * Send message through output processor
   */
  async sendMessage(
    content: string,
    options: {
      type?: MessageType;
      priority?: MessagePriority;
      protocol?: CommunicationProtocol;
      metadata?: Record<string, unknown>;
    } = {}
  ): Promise<AgentResponse> {
    try {
      this.logger.info('Sending outgoing message');
      
      // Get output processor
      const outputProcessor = this.agent.getManager<OutputProcessor>(ManagerType.OUTPUT_PROCESSOR);
      
      if (outputProcessor) {
        // Create output message for processor
        const outputMessage = await outputProcessor.createOutputMessage(content, 'user', {
          modality: 'text',
          context: options.metadata || {},
          tags: [options.type || MessageType.TEXT]
        });
        
        // Process through output processor
        const result = await outputProcessor.processOutput(outputMessage);
        
        return {
          content: result.processedContent,
          metadata: {
            outputProcessed: true,
            timestamp: new Date().toISOString(),
            processingTime: result.processingMetadata.processingTimeMs
          }
        };
      } else {
        // Direct output without processing
        return {
          content: this.sanitizeOutput(content),
          metadata: {
            outputProcessed: false,
            timestamp: new Date().toISOString(),
            ...options.metadata
          }
        };
      }
      
    } catch (error) {
      this.logger.error('Error sending message:', { error: error instanceof Error ? error.message : String(error) });
      throw new CommunicationError(
        `Failed to send message: ${(error as Error).message}`,
        'SEND_FAILED'
      );
    }
  }

  /**
   * Create processed message from raw input
   */
  private async createProcessedMessage(
    content: string,
    options: MessageProcessingOptions
  ): Promise<ProcessedMessage> {
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Determine message type
    let messageType = MessageType.TEXT;
    if (content.startsWith('/')) {
      messageType = MessageType.COMMAND;
    } else if (content.includes('?')) {
      messageType = MessageType.QUERY;
    }
    
    // Determine priority
    let priority = MessagePriority.NORMAL;
    if (options.priority) {
      priority = options.priority as MessagePriority;
    } else if (messageType === MessageType.COMMAND) {
      priority = MessagePriority.HIGH;
    }
    
    return {
      id: messageId,
      content,
      type: messageType,
      priority,
      protocol: CommunicationProtocol.DIRECT,
      timestamp: new Date(),
      metadata: (options.metadata as Record<string, unknown>) || ({ __placeholder: true } as Record<string, unknown>),
      attachments: options.attachments ? options.attachments.map(att => ({
        type: att.type,
        data: att,
        metadata: {
          filename: att.filename,
          size: att.size,
          mimeType: att.mimeType,
          fileId: att.fileId,
          preview: att.preview,
          has_full_preview: att.has_full_preview,
          is_image_for_vision: att.is_image_for_vision
        }
      })) : undefined,
      context: {
        conversationId: options.conversationId as string | undefined,
        sessionId: options.sessionId as string | undefined,
        userId: options.userId,
        agentId: this.agent.getId()
      }
    };
  }

  /**
   * Validate incoming message
   */
  private async validateMessage(message: ProcessedMessage): Promise<MessageValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check message length
    if (message.content.length > this.config.maxMessageLength) {
      errors.push(`Message exceeds maximum length of ${this.config.maxMessageLength} characters`);
    }
    
    // Check for blocked patterns
    if (this.config.security.enableContentFiltering) {
      for (const pattern of this.config.security.blockedPatterns) {
        const regex = new RegExp(pattern);
        if (regex.test(message.content)) {
          errors.push('Message contains blocked content pattern');
          break;
        }
      }
    }
    
    // Check protocol support
    if (!this.config.allowedProtocols.includes(message.protocol)) {
      errors.push(`Protocol ${message.protocol} is not allowed`);
    }
    
    // Additional validation through input processor
    if (this.config.enableInputValidation) {
      const inputProcessor = this.agent.getManager<InputProcessor>(ManagerType.INPUT_PROCESSOR);
      if (inputProcessor && typeof inputProcessor.validateInput === 'function') {
        try {
          const inputValidation = await inputProcessor.validateInput(message.content, {
            strictMode: true
          });
          
          if (!inputValidation.valid) {
            if (inputValidation.issues) {
              errors.push(...inputValidation.issues.filter(issue => issue.severity === 'error').map(issue => issue.message));
              warnings.push(...inputValidation.issues.filter(issue => issue.severity === 'warning').map(issue => issue.message));
            }
          }
        } catch (error) {
          warnings.push(`Input validation failed: ${(error as Error).message}`);
        }
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitizedContent: this.sanitizeInput(message.content)
    };
  }

  /**
   * Check rate limiting for message
   */
  private checkRateLimit(message: ProcessedMessage): {
    allowed: boolean;
    remainingMinute: number;
    remainingHour: number;
    resetTime: Date;
  } {
    const userId = message.context?.userId || 'anonymous';
    const now = new Date();
    
    // Get or create rate limit tracker
    let tracker = this.rateLimitTracker.get(userId);
    if (!tracker || now.getTime() - tracker.lastReset.getTime() > 60000) {
      tracker = { count: 0, lastReset: now };
      this.rateLimitTracker.set(userId, tracker);
    }
    
    // Check limits
    const minuteLimit = this.config.rateLimiting.maxMessagesPerMinute;
    const hourLimit = this.config.rateLimiting.maxMessagesPerHour;
    
    const allowed = tracker.count < minuteLimit;
    
    if (allowed) {
      tracker.count++;
    }
    
    return {
      allowed,
      remainingMinute: Math.max(0, minuteLimit - tracker.count),
      remainingHour: Math.max(0, hourLimit - tracker.count), // Simplified for demo
      resetTime: new Date(tracker.lastReset.getTime() + 60000)
    };
  }

  /**
   * Route message based on protocol and type
   */
  private async routeMessage(
    message: ProcessedMessage,
    options: MessageProcessingOptions
  ): Promise<AgentResponse> {
    switch (message.protocol) {
      case CommunicationProtocol.DIRECT:
        return this.processDirect(message, options);
      
      case CommunicationProtocol.ASYNC:
        return this.processAsync(message, options);
      
      case CommunicationProtocol.STREAMING:
        return this.processStreaming(message, options);
      
      case CommunicationProtocol.BATCH:
        return this.processBatch(message, options);
      
      default:
        throw new CommunicationError(
          `Unsupported protocol: ${message.protocol}`,
          'UNSUPPORTED_PROTOCOL'
        );
    }
  }

  /**
   * Process message directly
   */
  private async processDirect(
    message: ProcessedMessage,
    options: MessageProcessingOptions
  ): Promise<AgentResponse> {
    // Use input processor if available
    const inputProcessor = this.agent.getManager<InputProcessor>(ManagerType.INPUT_PROCESSOR);
    
    let processedContent = message.content;
    let processingMetadata: Record<string, unknown> = {};
    
    if (inputProcessor) {
      try {
        // Create input message for processor
        const inputMessage = {
          id: message.id,
          senderId: message.context?.userId || 'unknown',
          timestamp: message.timestamp,
          content: message.content,
          modality: 'text' as const,
          metadata: message.metadata,
          context: message.context
        };
        
        const inputResult = await inputProcessor.processInput(inputMessage);
        
        processedContent = inputResult.processedContent;
        processingMetadata = inputResult.processingMetadata || {};
      } catch (error) {
        this.logger.warn('Input processor failed, using raw content:', { error: error instanceof Error ? error.message : String(error) });
      }
    }
    
    // Return processed message without triggering LLM call
    // The communication handler should only process and route messages
    return {
      content: processedContent,
      metadata: Object.assign(
        {},
        options.metadata || {},
        processingMetadata,
        {
          messageId: message.id,
          messageType: message.type,
          priority: message.priority,
          processed: true,
          timestamp: new Date().toISOString()
        }
      )
    };
  }

  /**
   * Process message asynchronously
   */
  private async processAsync(
    message: ProcessedMessage,
    options: MessageProcessingOptions
  ): Promise<AgentResponse> {
    // Add to processing queue
    this.messageQueue.push(message);
    
    // Process queue asynchronously
    this.processingQueue = this.processingQueue.then(async () => {
      if (this.messageQueue.length > 0) {
        const queuedMessage = this.messageQueue.shift();
        if (queuedMessage) {
          try {
            await this.processDirect(queuedMessage, options);
          } catch (error) {
            this.logger.error('Error processing queued message:', { error: error instanceof Error ? error.message : String(error) });
          }
        }
      }
    });
    
    return {
      content: 'Message queued for asynchronous processing',
      metadata: {
        messageId: message.id,
        queued: true,
        queuePosition: this.messageQueue.length,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Process message with streaming
   */
  private async processStreaming(
    message: ProcessedMessage,
    options: MessageProcessingOptions
  ): Promise<AgentResponse> {
    // For now, process directly but mark as streaming
    const response = await this.processDirect(message, options);
    
    return {
      ...response,
      metadata: {
        ...response.metadata,
        streaming: true,
        messageId: message.id
      }
    };
  }

  /**
   * Process message in batch
   */
  private async processBatch(
    message: ProcessedMessage,
    options: MessageProcessingOptions
  ): Promise<AgentResponse> {
    // Add to batch queue (simplified implementation)
    this.messageQueue.push(message);
    
    return {
      content: 'Message added to batch processing queue',
      metadata: {
        messageId: message.id,
        batched: true,
        batchSize: this.messageQueue.length,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Sanitize input content
   */
  private sanitizeInput(content: string): string {
    // Remove potentially dangerous content
    let sanitized = content;
    
    // Remove script tags
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    
    // Remove potential SQL injection patterns
    sanitized = sanitized.replace(/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\b)/gi, '[SQL_COMMAND]');
    
    // Remove potential XSS patterns
    sanitized = sanitized.replace(/javascript:/gi, 'javascript-blocked:');
    
    return sanitized;
  }

  /**
   * Sanitize output content
   */
  private sanitizeOutput(content: string): string {
    // Remove sensitive information patterns
    let sanitized = content;
    
    // Mask potential passwords/tokens
    for (const pattern of this.config.security.blockedPatterns) {
      const regex = new RegExp(pattern, 'gi');
      sanitized = sanitized.replace(regex, '[REDACTED]');
    }
    
    return sanitized;
  }

  /**
   * Get communication statistics
   */
  getStatistics(): {
    totalMessages: number;
    queuedMessages: number;
    rateLimitedUsers: number;
    averageProcessingTime: number;
  } {
    const avgProcessingTime = this.statistics.processingTimes.length > 0
      ? this.statistics.processingTimes.reduce((sum, time) => sum + time, 0) / this.statistics.processingTimes.length
      : 0;
      
    return {
      totalMessages: this.statistics.totalMessages,
      queuedMessages: this.messageQueue.length,
      rateLimitedUsers: this.rateLimitTracker.size,
      averageProcessingTime: avgProcessingTime
    };
  }

  /**
   * Clear message queue
   */
  clearQueue(): void {
    this.messageQueue = [];
    this.logger.info('Message queue cleared');
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<CommunicationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Communication configuration updated');
  }

  /**
   * Get current configuration
   */
  getConfig(): CommunicationConfig {
    return { ...this.config };
  }
} 