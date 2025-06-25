/**
 * Enhanced Workspace Agent Integration with Error Management
 * 
 * Extends the existing WorkspaceAgentIntegration with:
 * - Real error handling for workspace tool failures
 * - Permission error classification and recovery
 * - User notifications for workspace issues
 * - Integration with enhanced tool service
 */

import { ulid } from 'ulid';
import { AgentBase } from '../../../agents/shared/base/AgentBase';
import { ManagerType } from '../../../agents/shared/base/managers/ManagerType';
import { ToolManager } from '../../../agents/shared/base/managers/ToolManager.interface';
import {
  WorkspacePermissionContextBuilder,
  WorkspacePermissionMetadataBuilder
} from '../../../lib/errors/context/ErrorContextBuilder';
import {
  BaseError,
  ErrorFactory,
  ErrorSeverity,
  ErrorType
} from '../../../lib/errors/types/BaseError';
import {
  IErrorClassificationEngine
} from '../../errors/ErrorClassificationEngine';
import {
  IErrorNotificationService
} from '../../errors/ErrorNotificationService';
import {
  IErrorManagementService
} from '../../errors/interfaces/IErrorManagementService';
import {
  IRecoveryStrategyManager
} from '../../errors/RecoveryStrategyManager';
import {
  EnhancedToolService,
  IEnhancedToolService,
  ToolExecutionContext
} from '../../tools/EnhancedToolService';
import { AgentWorkspacePermissionService } from '../AgentWorkspacePermissionService';
import { AgentContext, AgentTool, WorkspaceAgentTools } from '../tools/WorkspaceAgentTools';

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
 * Enhanced workspace capability result
 */
export interface EnhancedWorkspaceResult {
  readonly success: boolean;
  readonly data?: unknown;
  readonly error?: string;
  readonly errorId?: string;
  readonly userMessage?: string;
  readonly actionableButtons?: Array<{
    readonly label: string;
    readonly action: string;
    readonly style: 'primary' | 'secondary' | 'danger';
  }>;
  readonly retryable: boolean;
  readonly executionTime: number;
}

/**
 * Workspace integration configuration
 */
export interface WorkspaceIntegrationConfig {
  readonly enableErrorRecovery: boolean;
  readonly enableUserNotifications: boolean;
  readonly maxRetries: number;
  readonly timeoutMs: number;
  readonly logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Enhanced workspace agent integration service
 */
export class EnhancedWorkspaceAgentIntegration {
  private readonly workspaceTools: WorkspaceAgentTools;
  private readonly permissionService: AgentWorkspacePermissionService;
  private readonly integratedAgents: Set<string> = new Set();
  private readonly toolServices: Map<string, IEnhancedToolService> = new Map();

  constructor(
    private readonly logger: ILogger,
    private readonly errorManagementService: IErrorManagementService,
    private readonly classificationEngine: IErrorClassificationEngine,
    private readonly recoveryStrategyManager: IRecoveryStrategyManager,
    private readonly notificationService: IErrorNotificationService,
    private readonly config: WorkspaceIntegrationConfig = {
      enableErrorRecovery: true,
      enableUserNotifications: true,
      maxRetries: 3,
      timeoutMs: 30000,
      logLevel: 'info'
    }
  ) {
    this.workspaceTools = new WorkspaceAgentTools();
    this.permissionService = new AgentWorkspacePermissionService();
  }

  /**
   * Initialize enhanced workspace integration for an agent
   */
  async initializeAgentWorkspace(agent: AgentBase): Promise<void> {
    try {
      const agentId = agent.getAgentId();

      if (this.integratedAgents.has(agentId)) {
        this.logger.debug(`Enhanced workspace already integrated for agent ${agentId}`);
        return;
      }

      this.logger.info(`Initializing enhanced workspace integration for agent ${agentId}`);

      // Get agent's workspace capabilities
      const capabilities = await this.permissionService.getAgentWorkspaceCapabilities(agentId);

      if (capabilities.length === 0) {
        this.logger.info(`No workspace capabilities found for agent ${agentId}`);
        return;
      }

      // Get the agent's tool manager
      const toolManager = agent.getManager<ToolManager>(ManagerType.TOOL);
      if (!toolManager) {
        throw new Error(`Agent ${agentId} does not have a tool manager`);
      }

      // Create enhanced tool service for this agent
      const enhancedToolService = new EnhancedToolService(
        this.logger,
        this.errorManagementService,
        this.classificationEngine,
        this.recoveryStrategyManager
      );

      this.toolServices.set(agentId, enhancedToolService);

      // Register enhanced workspace tools
      await this.registerEnhancedWorkspaceTools(agentId, enhancedToolService, capabilities);

      // Mark as integrated
      this.integratedAgents.add(agentId);

      this.logger.info(`Enhanced workspace integration completed for agent ${agentId}`, {
        capabilityCount: capabilities.length,
        errorRecoveryEnabled: this.config.enableErrorRecovery,
        notificationsEnabled: this.config.enableUserNotifications
      });

    } catch (error) {
      await this.handleIntegrationError(agent.getAgentId(), error);
      throw error;
    }
  }

  /**
   * Execute workspace command with enhanced error handling
   */
  async executeWorkspaceCommand(
    agentId: string,
    toolName: string,
    parameters: Record<string, unknown>,
    context: {
      readonly userId: string;
      readonly sessionId?: string;
      readonly conversationId?: string;
      readonly connectionId?: string;
      readonly workspaceId?: string;
    }
  ): Promise<EnhancedWorkspaceResult> {
    const startTime = new Date();

    try {
      // Get enhanced tool service for agent
      const toolService = this.toolServices.get(agentId);
      if (!toolService) {
        throw new Error(`No enhanced tool service found for agent ${agentId}`);
      }

      // Create execution context
      const executionContext: ToolExecutionContext = {
        toolId: toolName,
        toolName,
        agentId,
        userId: context.userId,
        sessionId: context.sessionId,
        conversationId: context.conversationId,
        requestId: ulid(),
        workspaceId: context.workspaceId,
        connectionId: context.connectionId,
        startTime
      };

      // Execute with enhanced error handling
      const result = await toolService.executeWorkspaceTool(
        toolName,
        parameters,
        executionContext
      );

      const executionTime = new Date().getTime() - startTime.getTime();

      if (result.success) {
        this.logger.info('Workspace command executed successfully', {
          agentId,
          toolName,
          executionTime
        });

        return {
          success: true,
          data: result.output,
          retryable: false,
          executionTime
        };
      } else {
        return {
          success: false,
          error: result.error,
          errorId: result.errorId,
          userMessage: result.classification?.userMessage || result.error,
          actionableButtons: this.generateActionableButtons(result.classification?.category),
          retryable: result.classification?.retryable || false,
          executionTime
        };
      }

    } catch (error) {
      return await this.handleWorkspaceCommandError(agentId, toolName, parameters, context, error, startTime);
    }
  }

  /**
   * Get workspace tool health for an agent
   */
  async getWorkspaceToolHealth(agentId: string): Promise<{
    readonly totalTools: number;
    readonly healthyTools: number;
    readonly failingTools: Array<{
      readonly toolName: string;
      readonly errorRate: number;
      readonly lastError?: BaseError;
    }>;
    readonly overallHealth: 'healthy' | 'degraded' | 'critical';
  }> {
    try {
      const capabilities = await this.permissionService.getAgentWorkspaceCapabilities(agentId);
      const toolService = this.toolServices.get(agentId);

      if (!toolService) {
        return {
          totalTools: 0,
          healthyTools: 0,
          failingTools: [],
          overallHealth: 'critical'
        };
      }

      const availableTools = await this.workspaceTools.getAvailableTools(agentId);
      const failingTools: Array<{
        readonly toolName: string;
        readonly errorRate: number;
        readonly lastError?: BaseError;
      }> = [];

      let healthyCount = 0;

      for (const tool of availableTools) {
        const health = await toolService.getToolHealthStatus(tool.name);

        if (health.isHealthy) {
          healthyCount++;
        } else {
          failingTools.push({
            toolName: tool.name,
            errorRate: health.errorRate,
            lastError: health.lastError
          });
        }
      }

      const totalTools = availableTools.length;
      const healthyRatio = totalTools > 0 ? healthyCount / totalTools : 0;

      let overallHealth: 'healthy' | 'degraded' | 'critical';
      if (healthyRatio >= 0.8) {
        overallHealth = 'healthy';
      } else if (healthyRatio >= 0.5) {
        overallHealth = 'degraded';
      } else {
        overallHealth = 'critical';
      }

      return {
        totalTools,
        healthyTools: healthyCount,
        failingTools,
        overallHealth
      };

    } catch (error) {
      this.logger.error('Failed to get workspace tool health', {
        agentId,
        error
      });

      return {
        totalTools: 0,
        healthyTools: 0,
        failingTools: [],
        overallHealth: 'critical'
      };
    }
  }

  /**
   * Disconnect workspace integration for an agent
   */
  async disconnectAgentWorkspace(agentId: string): Promise<void> {
    try {
      // Remove from integrated agents
      this.integratedAgents.delete(agentId);

      // Clean up tool service
      this.toolServices.delete(agentId);

      this.logger.info(`Workspace integration disconnected for agent ${agentId}`);
    } catch (error) {
      this.logger.error('Failed to disconnect workspace integration', {
        agentId,
        error
      });
      throw error;
    }
  }

  /**
   * Get integration status for an agent
   */
  isAgentIntegrated(agentId: string): boolean {
    return this.integratedAgents.has(agentId);
  }

  /**
   * Register enhanced workspace tools with error handling
   */
  private async registerEnhancedWorkspaceTools(
    agentId: string,
    toolService: IEnhancedToolService,
    capabilities: any[]
  ): Promise<void> {
    const availableTools = await this.workspaceTools.getAvailableTools(agentId);

    for (const agentTool of availableTools) {
      try {
        // Create enhanced wrapper for the tool
        const enhancedTool = {
          id: agentTool.name.toLowerCase().replace(/\s+/g, '_'),
          name: agentTool.name,
          description: agentTool.description,
          category: 'workspace' as any,
          enabled: true,
          schema: agentTool.parameters,
          execute: async (params: Record<string, unknown>) => {
            const startTime = Date.now();
            try {
              const result = await this.executeAgentToolWithErrorHandling(
                agentTool,
                params,
                {
                  agentId,
                  userId: 'unknown',
                  conversationId: '',
                  metadata: {}
                },
                agentId
              );
              const endTime = Date.now();
              return {
                id: ulid() as any,
                toolId: agentTool.name,
                success: true,
                data: result,
                metrics: {
                  startTime,
                  endTime,
                  durationMs: endTime - startTime
                }
              };
            } catch (error) {
              const endTime = Date.now();
              return {
                id: ulid() as any,
                toolId: agentTool.name,
                success: false,
                error: {
                  message: error instanceof Error ? error.message : String(error),
                  code: 'EXECUTION_FAILED',
                  details: error
                },
                metrics: {
                  startTime,
                  endTime,
                  durationMs: endTime - startTime
                }
              };
            }
          }
        };

        await toolService.registerTool(enhancedTool);

        // Register executor with error handling wrapper
        await toolService.registerToolExecutor(
          enhancedTool.id,
          async (params: Record<string, unknown>) => {
            return await enhancedTool.execute(params);
          }
        );

        this.logger.debug(`Registered enhanced workspace tool: ${agentTool.name} for agent ${agentId}`);
      } catch (error) {
        this.logger.warn(`Failed to register enhanced tool ${agentTool.name}:`, { error });
      }
    }

    this.logger.info(`Registered ${availableTools.length} enhanced workspace tools for agent ${agentId}`);
  }

  /**
   * Execute agent tool with enhanced error handling
   */
  private async executeAgentToolWithErrorHandling(
    agentTool: AgentTool,
    parameters: Record<string, unknown>,
    context: AgentContext,
    agentId: string
  ): Promise<unknown> {
    try {
      // Execute the original tool
      const result = await agentTool.execute(parameters, context);

      // Log successful execution
      this.logger.debug('Workspace tool executed successfully', {
        toolName: agentTool.name,
        agentId
      });

      return result;
    } catch (error) {
      // Enhanced error handling for workspace tools
      throw await this.enhanceWorkspaceToolError(error, agentTool, parameters, context, agentId);
    }
  }

  /**
   * Enhance workspace tool errors with proper classification
   */
  private async enhanceWorkspaceToolError(
    error: unknown,
    agentTool: AgentTool,
    parameters: Record<string, unknown>,
    context: AgentContext,
    agentId: string
  ): Promise<Error> {
    try {
      // Build workspace permission context
      const permissionContext = new WorkspacePermissionContextBuilder()
        .withAgentId(agentId)
        .withUserId(context.userId)
        .withWorkspaceProvider('unknown')
        .withOperation(agentTool.name)
        .withRequiredCapability('unknown')
        .withRequiredAccessLevel('WRITE')
        .withSessionId('')
        .withConversationId(context.conversationId || '')
        .withRequestId(ulid())
        .build();

      const permissionMetadata = new WorkspacePermissionMetadataBuilder()
        .withConnectionExists(false)
        .withTokenValid(false)
        .build();

      // Create structured error
      const structuredError = ErrorFactory.createError({
        type: this.determineWorkspaceErrorType(error),
        message: error instanceof Error ? error.message : String(error),
        context: permissionContext,
        metadata: permissionMetadata,
        stackTrace: error instanceof Error ? error.stack : undefined,
        severity: this.determineWorkspaceErrorSeverity(error),
        retryable: this.isWorkspaceErrorRetryable(error),
        maxRetries: this.config.maxRetries
      });

      // Log and classify error
      await this.errorManagementService.logError(structuredError);
      const classification = await this.classificationEngine.classifyError(structuredError);

      // Send notification if enabled
      if (this.config.enableUserNotifications) {
        await this.notificationService.sendErrorNotification(structuredError, classification);
      }

      // Return enhanced error with user-friendly message
      const enhancedError = new Error(classification.userMessage);
      (enhancedError as any).originalError = error;
      (enhancedError as any).errorId = structuredError.id;
      (enhancedError as any).classification = classification;

      return enhancedError;
    } catch (enhancementError) {
      // Fallback if error enhancement fails
      this.logger.error('Failed to enhance workspace tool error', {
        originalError: error,
        enhancementError
      });

      return error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * Handle integration errors
   */
  private async handleIntegrationError(agentId: string, error: unknown): Promise<void> {
    this.logger.error('Workspace integration error', {
      agentId,
      error: error instanceof Error ? error.message : String(error)
    });

    // Could trigger notifications or recovery here
    if (this.config.enableUserNotifications) {
      // Notification logic could be added here
    }
  }

  /**
   * Handle workspace command execution errors
   */
  private async handleWorkspaceCommandError(
    agentId: string,
    toolName: string,
    parameters: Record<string, unknown>,
    context: any,
    error: unknown,
    startTime: Date
  ): Promise<EnhancedWorkspaceResult> {
    const executionTime = new Date().getTime() - startTime.getTime();

    this.logger.error('Workspace command execution failed', {
      agentId,
      toolName,
      error: error instanceof Error ? error.message : String(error),
      executionTime
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      userMessage: 'The workspace operation failed. Please try again.',
      actionableButtons: [
        {
          label: 'Retry',
          action: 'retry',
          style: 'primary'
        },
        {
          label: 'Check Permissions',
          action: 'check_permissions',
          style: 'secondary'
        }
      ],
      retryable: true,
      executionTime
    };
  }

  /**
   * Generate actionable buttons based on error category
   */
  private generateActionableButtons(category?: string): Array<{
    readonly label: string;
    readonly action: string;
    readonly style: 'primary' | 'secondary' | 'danger';
  }> {
    const buttons: Array<{
      readonly label: string;
      readonly action: string;
      readonly style: 'primary' | 'secondary' | 'danger';
    }> = [];

    if (category === 'PERMISSION_ERROR') {
      buttons.push(
        {
          label: 'Request Access',
          action: 'request_access',
          style: 'primary'
        },
        {
          label: 'Check Permissions',
          action: 'check_permissions',
          style: 'secondary'
        }
      );
    } else if (category === 'CONNECTION_ERROR') {
      buttons.push(
        {
          label: 'Reconnect',
          action: 'reconnect',
          style: 'primary'
        },
        {
          label: 'Check Connection',
          action: 'check_connection',
          style: 'secondary'
        }
      );
    } else if (category === 'RATE_LIMIT_ERROR') {
      buttons.push(
        {
          label: 'Wait & Retry',
          action: 'wait_retry',
          style: 'primary'
        }
      );
    } else {
      buttons.push(
        {
          label: 'Retry',
          action: 'retry',
          style: 'primary'
        }
      );
    }

    return buttons;
  }

  /**
   * Determine workspace error type
   */
  private determineWorkspaceErrorType(error: unknown): ErrorType {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      if (message.includes('permission') || message.includes('unauthorized')) {
        return ErrorType.PERMISSION_DENIED;
      }

      if (message.includes('network') || message.includes('connection')) {
        return ErrorType.NETWORK_ERROR;
      }

      if (message.includes('rate limit')) {
        return ErrorType.RATE_LIMIT_ERROR;
      }

      if (message.includes('api') || message.includes('external')) {
        return ErrorType.EXTERNAL_SERVICE_ERROR;
      }
    }

    return ErrorType.TOOL_EXECUTION;
  }

  /**
   * Determine workspace error severity
   */
  private determineWorkspaceErrorSeverity(error: unknown): ErrorSeverity {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      if (message.includes('critical') || message.includes('fatal')) {
        return ErrorSeverity.CRITICAL;
      }

      if (message.includes('permission') || message.includes('unauthorized')) {
        return ErrorSeverity.MEDIUM;
      }

      if (message.includes('network') || message.includes('timeout')) {
        return ErrorSeverity.LOW;
      }
    }

    return ErrorSeverity.HIGH;
  }

  /**
   * Check if workspace error is retryable
   */
  private isWorkspaceErrorRetryable(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      // Non-retryable errors
      if (message.includes('permission') ||
        message.includes('unauthorized') ||
        message.includes('not found') ||
        message.includes('invalid')) {
        return false;
      }

      // Retryable errors
      if (message.includes('network') ||
        message.includes('timeout') ||
        message.includes('temporarily') ||
        message.includes('rate limit')) {
        return true;
      }
    }

    return true; // Default to retryable
  }
} 