/**
 * Enhanced Tool Service with Error Management Integration
 * 
 * Replaces the existing fallback executor logic with comprehensive error handling:
 * - Real error logging and classification
 * - User notifications for tool failures
 * - Recovery strategies with retry logic
 * - Workspace permission error handling
 * - Integration with error management service
 */

import { ulid } from 'ulid';
import {
  ToolExecutionContextBuilder,
  ToolExecutionMetadataBuilder,
  WorkspacePermissionContextBuilder,
  WorkspacePermissionMetadataBuilder
} from '../../lib/errors/context/ErrorContextBuilder';
import {
  BaseError,
  ErrorFactory,
  ErrorSeverity,
  ErrorType
} from '../../lib/errors/types/BaseError';
import { Tool } from '../../lib/tools/types';
import {
  ErrorClassificationResult,
  IErrorClassificationEngine
} from '../errors/ErrorClassificationEngine';
import {
  IErrorManagementService
} from '../errors/interfaces/IErrorManagementService';
import {
  IRecoveryStrategyManager
} from '../errors/RecoveryStrategyManager';

/**
 * Logger interface for structured logging
 */
interface ILogger {
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
  debug(message: string, metadata?: Record<string, unknown>): void;
}

/**
 * Enhanced tool execution options
 */
export interface EnhancedToolExecutionOptions {
  readonly toolId: string;
  readonly parameters: Record<string, unknown>;
  readonly agentId: string;
  readonly userId: string;
  readonly sessionId?: string;
  readonly conversationId?: string;
  readonly requestId?: string;
  readonly retryPolicy?: {
    readonly maxRetries: number;
    readonly enableRecovery: boolean;
    readonly enableNotifications: boolean;
  };
}

/**
 * Enhanced tool execution result
 */
export interface EnhancedToolExecutionResult {
  readonly success: boolean;
  readonly output?: unknown;
  readonly error?: string;
  readonly duration: number;
  readonly metadata: {
    readonly toolId: string;
    readonly startTime: string;
    readonly endTime: string;
    readonly parameters: Record<string, unknown>;
    readonly errorId?: string;
  };
  readonly errorId?: string;
  readonly classification?: ErrorClassificationResult;
  readonly recoveryAttempted: boolean;
  readonly retryCount: number;
  readonly totalExecutionTime: number;
}

/**
 * Tool execution context for error handling
 */
export interface ToolExecutionContext {
  readonly toolId: string;
  readonly toolName: string;
  readonly agentId: string;
  readonly userId: string;
  readonly sessionId?: string;
  readonly conversationId?: string;
  readonly requestId?: string;
  readonly workspaceId?: string;
  readonly connectionId?: string;
  readonly startTime: Date;
}

/**
 * Enhanced tool service interface
 */
export interface IEnhancedToolService {
  executeToolWithErrorHandling(options: EnhancedToolExecutionOptions): Promise<EnhancedToolExecutionResult>;
  executeWorkspaceTool(
    toolId: string,
    parameters: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<EnhancedToolExecutionResult>;
  getToolExecutionHistory(agentId: string, limit?: number): Promise<readonly BaseError[]>;
  getToolHealthStatus(toolId: string): Promise<{
    readonly isHealthy: boolean;
    readonly errorRate: number;
    readonly averageExecutionTime: number;
    readonly lastError?: BaseError;
  }>;
  registerTool(tool: Tool): Promise<void>;
  registerToolExecutor(toolId: string, executor: Function): Promise<void>;
}

/**
 * Enhanced tool service implementation
 */
export class EnhancedToolService implements IEnhancedToolService {
  private readonly tools: Map<string, Tool> = new Map();
  private readonly executors: Map<string, Function> = new Map();

  constructor(
    private readonly logger: ILogger,
    private readonly errorManagementService: IErrorManagementService,
    private readonly classificationEngine: IErrorClassificationEngine,
    private readonly recoveryStrategyManager: IRecoveryStrategyManager
  ) { }

  /**
   * Register a tool with the service
   */
  async registerTool(tool: Tool): Promise<void> {
    this.tools.set(tool.id, tool);
    this.logger.info('Tool registered', {
      toolId: tool.id,
      name: tool.name,
      category: tool.category
    });
  }

  /**
   * Register a tool executor
   */
  async registerToolExecutor(toolId: string, executor: Function): Promise<void> {
    this.executors.set(toolId, executor);
    this.logger.debug('Tool executor registered', { toolId });
  }

  /**
   * Execute tool with comprehensive error handling
   */
  async executeToolWithErrorHandling(
    options: EnhancedToolExecutionOptions
  ): Promise<EnhancedToolExecutionResult> {
    const startTime = new Date();
    const tool = this.tools.get(options.toolId);

    if (!tool) {
      return await this.handleToolNotFound(options, startTime);
    }

    const executor = this.executors.get(options.toolId);
    if (!executor) {
      return await this.handleExecutorNotFound(options, tool, startTime);
    }

    // Create execution context
    const context: ToolExecutionContext = {
      toolId: options.toolId,
      toolName: tool.name,
      agentId: options.agentId,
      userId: options.userId,
      sessionId: options.sessionId,
      conversationId: options.conversationId,
      requestId: options.requestId || ulid(),
      startTime
    };

    try {
      // Validate parameters
      this.validateParameters(tool, options.parameters);

      // Execute with recovery strategy
      const result = await this.recoveryStrategyManager.executeWithRecovery(
        () => this.executeToolInternal(executor, options.parameters, context),
        ErrorType.TOOL_EXECUTION,
        {
          toolId: options.toolId,
          toolName: tool.name,
          agentId: options.agentId,
          parameters: options.parameters
        }
      );

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      // Update tool metadata on success
      this.updateToolMetadata(tool, startTime, endTime, true);

      this.logger.info('Tool execution successful', {
        toolId: options.toolId,
        agentId: options.agentId,
        duration
      });

      return {
        success: true,
        output: result,
        duration,
        metadata: {
          toolId: options.toolId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          parameters: options.parameters
        },
        errorId: undefined,
        classification: undefined,
        recoveryAttempted: false,
        retryCount: 0,
        totalExecutionTime: duration
      };

    } catch (error) {
      return await this.handleToolExecutionError(error, options, tool, context, startTime);
    }
  }

  /**
   * Execute workspace tool with specific error handling
   */
  async executeWorkspaceTool(
    toolId: string,
    parameters: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<EnhancedToolExecutionResult> {
    const options: EnhancedToolExecutionOptions = {
      toolId,
      parameters,
      agentId: context.agentId,
      userId: context.userId,
      sessionId: context.sessionId,
      conversationId: context.conversationId,
      requestId: context.requestId
    };

    try {
      const result = await this.executeToolWithErrorHandling(options);

      // Add workspace-specific context to result
      if (result.errorId && context.workspaceId) {
        // Additional workspace error handling could be added here
      }

      return result;
    } catch (error) {
      // Handle workspace-specific errors
      if (this.isWorkspacePermissionError(error)) {
        return await this.handleWorkspacePermissionError(error, options, context);
      }

      throw error;
    }
  }

  /**
   * Get tool execution history for an agent
   */
  async getToolExecutionHistory(agentId: string, limit: number = 50): Promise<readonly BaseError[]> {
    try {
      const searchCriteria = {
        agentId,
        errorType: ErrorType.TOOL_EXECUTION,
        limit
      };
      return await this.errorManagementService.searchErrors(searchCriteria);
    } catch (error) {
      this.logger.error('Failed to get tool execution history', {
        agentId,
        error
      });
      return [];
    }
  }

  /**
   * Get tool health status
   */
  async getToolHealthStatus(toolId: string): Promise<{
    readonly isHealthy: boolean;
    readonly errorRate: number;
    readonly averageExecutionTime: number;
    readonly lastError?: BaseError;
  }> {
    try {
      const searchCriteria = {
        errorType: ErrorType.TOOL_EXECUTION,
        fromDate: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
      };
      const errors = await this.errorManagementService.searchErrors(searchCriteria);
      const toolErrors = errors.filter(e => {
        const context = e.context as any;
        return context.toolId === toolId;
      });

      const tool = this.tools.get(toolId);
      const averageExecutionTime = (tool?.metadata as any)?.averageExecutionTime || 0;
      const successRate = (tool?.metadata as any)?.successRate || 1;
      const errorRate = 1 - Number(successRate);

      return {
        isHealthy: errorRate < 0.1 && toolErrors.length < 10,
        errorRate,
        averageExecutionTime: Number(averageExecutionTime),
        lastError: toolErrors[0]
      };
    } catch (error) {
      this.logger.error('Failed to get tool health status', {
        toolId,
        error
      });

      return {
        isHealthy: false,
        errorRate: 1,
        averageExecutionTime: 0
      };
    }
  }

  /**
   * Handle tool not found error
   */
  private async handleToolNotFound(
    options: EnhancedToolExecutionOptions,
    startTime: Date
  ): Promise<EnhancedToolExecutionResult> {
    const context = new ToolExecutionContextBuilder()
      .withAgentId(options.agentId)
      .withUserId(options.userId)
      .withToolId(options.toolId)
      .withToolName('unknown')
      .withOperation('tool_execution')
      .withSessionId(options.sessionId || '')
      .withConversationId(options.conversationId || '')
      .withRequestId(options.requestId || ulid())
      .build();

    const error = ErrorFactory.createError({
      type: ErrorType.TOOL_EXECUTION,
      message: `Tool ${options.toolId} not found`,
      context,
      userMessage: 'The requested operation is not available',
      errorCode: 'TOOL_NOT_FOUND',
      severity: ErrorSeverity.HIGH,
      retryable: false,
      maxRetries: 0
    });

    const classification = await this.classificationEngine.classifyError(error);
    const loggedError = await this.errorManagementService.logError(error);

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    return {
      success: false,
      output: null,
      error: classification.userMessage,
      duration,
      metadata: {
        toolId: options.toolId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        parameters: options.parameters
      },
      errorId: loggedError.errorId,
      classification,
      recoveryAttempted: false,
      retryCount: 0,
      totalExecutionTime: duration
    };
  }

  /**
   * Handle executor not found error (replaces fallback logic)
   */
  private async handleExecutorNotFound(
    options: EnhancedToolExecutionOptions,
    tool: Tool,
    startTime: Date
  ): Promise<EnhancedToolExecutionResult> {
    const context = new ToolExecutionContextBuilder()
      .withAgentId(options.agentId)
      .withUserId(options.userId)
      .withToolId(options.toolId)
      .withToolName(tool.name)
      .withOperation('tool_execution')
      .withSessionId(options.sessionId || '')
      .withConversationId(options.conversationId || '')
      .withRequestId(options.requestId || ulid())
      .build();

    const metadata = new ToolExecutionMetadataBuilder()
      .withToolRegistered(true)
      .withPermissionsGranted(false)
      .withInputValidated(true)
      .build();

    const error = ErrorFactory.createError({
      type: ErrorType.TOOL_EXECUTION,
      message: `No executor found for tool ${options.toolId}`,
      context,
      metadata,
      userMessage: `The ${tool.name} feature is currently unavailable`,
      errorCode: 'EXECUTOR_NOT_FOUND',
      severity: ErrorSeverity.HIGH,
      retryable: false,
      maxRetries: 0
    });

    const classification = await this.classificationEngine.classifyError(error);
    const loggedError = await this.errorManagementService.logError(error);

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    this.logger.error('Tool executor not found - NO LONGER USING FALLBACK', {
      toolId: options.toolId,
      toolName: tool.name,
      agentId: options.agentId,
      errorId: loggedError.errorId
    });

    return {
      success: false,
      output: null,
      error: classification.userMessage,
      duration,
      metadata: {
        toolId: options.toolId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        parameters: options.parameters
      },
      errorId: loggedError.errorId,
      classification,
      recoveryAttempted: false,
      retryCount: 0,
      totalExecutionTime: duration
    };
  }

  /**
   * Handle tool execution error
   */
  private async handleToolExecutionError(
    error: unknown,
    options: EnhancedToolExecutionOptions,
    tool: Tool,
    context: ToolExecutionContext,
    startTime: Date
  ): Promise<EnhancedToolExecutionResult> {
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    // Build error context
    const errorContext = new ToolExecutionContextBuilder()
      .withAgentId(options.agentId)
      .withUserId(options.userId)
      .withToolId(options.toolId)
      .withToolName(tool.name)
      .withSessionId(options.sessionId || '')
      .withConversationId(options.conversationId || '')
      .withRequestId(options.requestId || ulid())
      .build();

    const errorMetadata = new ToolExecutionMetadataBuilder()
      .withToolRegistered(true)
      .withPermissionsGranted(true)
      .withInputValidated(true)
      .withTimeoutOccurred(false)
      .build();

    // Create structured error
    const structuredError = ErrorFactory.createError({
      type: ErrorType.TOOL_EXECUTION,
      message: error instanceof Error ? error.message : String(error),
      context: errorContext,
      metadata: errorMetadata,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: this.determineSeverity(error),
      retryable: this.isRetryableError(error),
      maxRetries: 3
    });

    // Classify and log error
    const classification = await this.classificationEngine.classifyError(structuredError);
    const loggedError = await this.errorManagementService.logError(structuredError);

    // Update tool metadata on failure
    this.updateToolMetadata(tool, startTime, endTime, false);

    this.logger.error('Tool execution failed', {
      toolId: options.toolId,
      agentId: options.agentId,
      errorId: loggedError.errorId,
      severity: classification.severity,
      retryable: classification.retryable
    });

    return {
      success: false,
      output: null,
      error: classification.userMessage,
      duration,
      metadata: {
        toolId: options.toolId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        parameters: options.parameters,
        errorId: loggedError.errorId
      },
      errorId: loggedError.errorId,
      classification,
      recoveryAttempted: false,
      retryCount: 0,
      totalExecutionTime: duration
    };
  }

  /**
   * Handle workspace permission errors
   */
  private async handleWorkspacePermissionError(
    error: unknown,
    options: EnhancedToolExecutionOptions,
    context: ToolExecutionContext
  ): Promise<EnhancedToolExecutionResult> {
    const startTime = context.startTime;
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    // Build workspace permission context
    const permissionContext = new WorkspacePermissionContextBuilder()
      .withAgentId(options.agentId)
      .withUserId(options.userId)
      .withWorkspaceProvider('unknown')
      .withOperation(context.toolName)
      .withRequiredCapability('unknown')
      .withRequiredAccessLevel('WRITE')
      .withSessionId(options.sessionId || '')
      .withConversationId(options.conversationId || '')
      .withRequestId(options.requestId || ulid())
      .build();

    const permissionMetadata = new WorkspacePermissionMetadataBuilder()
      .withConnectionExists(false)
      .withTokenValid(false)
      .build();

    const structuredError = ErrorFactory.createError({
      type: ErrorType.PERMISSION_DENIED,
      message: error instanceof Error ? error.message : String(error),
      context: permissionContext,
      metadata: permissionMetadata,
      severity: ErrorSeverity.MEDIUM,
      retryable: false,
      maxRetries: 0
    });

    const classification = await this.classificationEngine.classifyError(structuredError);
    const loggedError = await this.errorManagementService.logError(structuredError);

    return {
      success: false,
      output: null,
      error: classification.userMessage,
      duration,
      metadata: {
        toolId: options.toolId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        parameters: options.parameters,
        errorId: loggedError.errorId
      },
      errorId: loggedError.errorId,
      classification,
      recoveryAttempted: false,
      retryCount: 0,
      totalExecutionTime: duration
    };
  }

  /**
   * Execute tool internally
   */
  private async executeToolInternal(
    executor: Function,
    parameters: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<unknown> {
    return await executor(parameters, context);
  }

  /**
   * Validate tool parameters
   */
  private validateParameters(tool: Tool, parameters: Record<string, unknown>): void {
    // Basic parameter validation - could be enhanced
    const toolSchema = (tool as any).parameters;
    if (toolSchema?.required) {
      for (const required of toolSchema.required) {
        if (!(required in parameters)) {
          throw new Error(`Missing required parameter: ${required}`);
        }
      }
    }
  }

  /**
   * Update tool metadata
   */
  private updateToolMetadata(tool: Tool, startTime: Date, endTime: Date, success: boolean): void {
    if (!tool.metadata) {
      tool.metadata = {
        lastUsed: startTime.toISOString(),
        usageCount: 0,
        averageExecutionTime: 0,
        successRate: 1
      };
    }

    const metadata = tool.metadata as any;
    const duration = endTime.getTime() - startTime.getTime();
    const usageCount = Number(metadata.usageCount) + 1;
    const currentSuccessRate = Number(metadata.successRate) || 1;

    metadata.lastUsed = startTime.toISOString();
    metadata.usageCount = usageCount;
    metadata.averageExecutionTime =
      (Number(metadata.averageExecutionTime) * (usageCount - 1) + duration) / usageCount;
    metadata.successRate =
      (currentSuccessRate * (usageCount - 1) + (success ? 1 : 0)) / usageCount;
  }

  /**
   * Determine error severity based on error type
   */
  private determineSeverity(error: unknown): ErrorSeverity {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      if (message.includes('permission') || message.includes('unauthorized')) {
        return ErrorSeverity.MEDIUM;
      }

      if (message.includes('network') || message.includes('timeout')) {
        return ErrorSeverity.LOW;
      }

      if (message.includes('critical') || message.includes('fatal')) {
        return ErrorSeverity.CRITICAL;
      }
    }

    return ErrorSeverity.HIGH; // Default for tool execution errors
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      // Non-retryable errors
      if (message.includes('permission') ||
        message.includes('unauthorized') ||
        message.includes('not found') ||
        message.includes('invalid parameter')) {
        return false;
      }

      // Retryable errors
      if (message.includes('network') ||
        message.includes('timeout') ||
        message.includes('temporarily unavailable') ||
        message.includes('rate limit')) {
        return true;
      }
    }

    return true; // Default to retryable for unknown errors
  }

  /**
   * Check if error is a workspace permission error
   */
  private isWorkspacePermissionError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return message.includes('workspace') &&
        (message.includes('permission') || message.includes('access'));
    }
    return false;
  }
} 