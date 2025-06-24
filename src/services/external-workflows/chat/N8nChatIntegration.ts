/**
 * N8nChatIntegration.ts - Integration service for N8N workflows in chat system
 * 
 * Connects the WorkflowChatCommandHandler with the agent workflow processing system,
 * enabling seamless N8N workflow execution from chat messages.
 * Follows IMPLEMENTATION_GUIDELINES.md: ULID, strict typing, DI, pure functions, immutability.
 */

import { ulid } from 'ulid';
import { createLogger } from '../../../lib/logging/winston-logger';
import { ExecutionIdGenerator } from '../../../types/workflow';
import { ExecutionTrackingService } from '../execution/ExecutionTrackingService';
import { WorkflowExecutionService } from '../execution/WorkflowExecutionService';
import { WorkflowParameterParser } from '../execution/WorkflowParameterParser';
import { N8nConnectionManager } from '../integrations/N8nConnectionManager';
import { ChatContext, WorkflowChatCommand, WorkflowChatCommandHandler, WorkflowChatResponse } from './WorkflowChatCommandHandler';

// === Integration Interfaces ===

export interface AgentWorkflowChatResponse {
  readonly integrationId: string; // ULID format: wf_int_[ULID]
  readonly hasWorkflowCommand: boolean;
  readonly workflowResponse?: WorkflowChatResponse;
  readonly shouldBypassNormalProcessing: boolean;
  readonly enhancedMessage?: string;
  readonly executionContext?: WorkflowExecutionContext;
  readonly suggestions?: readonly string[];
  readonly clarificationNeeded?: boolean;
  readonly errorMessage?: string;
  readonly metadata: Record<string, unknown>;
}

export interface WorkflowExecutionContext {
  readonly executionId?: string;
  readonly workflowId: string;
  readonly workflowName: string;
  readonly status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  readonly startedAt: Date;
  readonly estimatedCompletion?: Date;
  readonly progress?: number;
  readonly lastUpdate: Date;
}

export interface ChatIntegrationOptions {
  readonly userId: string;
  readonly chatId: string;
  readonly messageId: string;
  readonly conversationHistory?: readonly string[];
  readonly agentId?: string;
  readonly sessionData?: Record<string, unknown>;
  readonly enableAutoExecution?: boolean;
  readonly enableWorkflowSuggestions?: boolean;
}

// === Configuration ===

export interface N8nChatIntegrationConfig {
  readonly enabled: boolean;
  readonly autoExecutionThreshold: number;
  readonly maxConcurrentExecutions: number;
  readonly executionTimeoutMs: number;
  readonly enableProgressTracking: boolean;
  readonly enableExecutionHistory: boolean;
  readonly maxSuggestions: number;
  readonly chatResponseFormat: 'detailed' | 'concise' | 'technical';
}

const DEFAULT_CONFIG: N8nChatIntegrationConfig = {
  enabled: true,
  autoExecutionThreshold: 0.85,
  maxConcurrentExecutions: 5,
  executionTimeoutMs: 300000, // 5 minutes
  enableProgressTracking: true,
  enableExecutionHistory: true,
  maxSuggestions: 3,
  chatResponseFormat: 'detailed'
};

// === Integration Interface ===

export interface IN8nChatIntegration {
  processAgentMessage(message: string, options: ChatIntegrationOptions): Promise<AgentWorkflowChatResponse>;
  checkWorkflowExecutionStatus(executionId: string, userId: string): Promise<WorkflowExecutionContext | null>;
  getUserActiveExecutions(userId: string): Promise<readonly WorkflowExecutionContext[]>;
  suggestWorkflowsForMessage(message: string, options: ChatIntegrationOptions): Promise<readonly string[]>;
  cancelUserExecution(executionId: string, userId: string): Promise<boolean>;
}

// === Implementation ===

export class N8nChatIntegration implements IN8nChatIntegration {
  private readonly serviceName = 'N8nChatIntegration';
  private readonly logger = createLogger({ moduleId: this.serviceName });
  private readonly config: N8nChatIntegrationConfig;
  private readonly activeExecutions = new Map<string, WorkflowExecutionContext>();

  constructor(
    private readonly commandHandler: WorkflowChatCommandHandler,
    private readonly parameterParser: WorkflowParameterParser,
    private readonly executionService: WorkflowExecutionService,
    private readonly trackingService: ExecutionTrackingService,
    private readonly connectionManager: N8nConnectionManager,
    config: Partial<N8nChatIntegrationConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.logger.info(`[${this.serviceName}] Initialized with config`, {
      enabled: this.config.enabled,
      autoExecutionThreshold: this.config.autoExecutionThreshold,
      maxConcurrentExecutions: this.config.maxConcurrentExecutions
    });
  }

  // === Main Integration Method ===

  async processAgentMessage(
    message: string,
    options: ChatIntegrationOptions
  ): Promise<AgentWorkflowChatResponse> {
    const integrationId = `wf_int_${ulid()}`;

    this.logger.info(`[${this.serviceName}] Processing agent message for workflows`, {
      integrationId,
      messageLength: message.length,
      userId: options.userId,
      chatId: options.chatId
    });

    if (!this.config.enabled) {
      return this.createNoWorkflowResponse(integrationId, 'N8N chat integration is disabled');
    }

    try {
      // 1. Create chat context
      const chatContext: ChatContext = {
        userId: options.userId,
        chatId: options.chatId,
        messageId: options.messageId,
        conversationHistory: options.conversationHistory,
        sessionData: options.sessionData
      };

      // 2. Detect workflow command
      const workflowCommand = await this.commandHandler.detectWorkflowCommand(message, chatContext);

      if (!workflowCommand) {
        // Check if we should suggest workflows
        if (this.config.maxSuggestions > 0 && this.shouldSuggestWorkflows(message)) {
          const suggestions = await this.suggestWorkflowsForMessage(message, options);

          if (suggestions.length > 0) {
            return {
              integrationId,
              hasWorkflowCommand: false,
              shouldBypassNormalProcessing: false,
              suggestions,
              enhancedMessage: this.formatWorkflowSuggestions(message, suggestions),
              metadata: { suggestedWorkflows: suggestions.length }
            };
          }
        }

        return this.createNoWorkflowResponse(integrationId, 'No workflow command detected');
      }

      this.logger.info(`[${this.serviceName}] Workflow command detected`, {
        integrationId,
        commandId: workflowCommand.commandId,
        type: workflowCommand.type,
        confidence: workflowCommand.confidence,
        workflowRef: workflowCommand.workflowReference.value
      });

      // 3. Check user permissions and connections
      const hasValidConnection = await this.validateUserWorkflowAccess(options.userId, workflowCommand);
      if (!hasValidConnection) {
        return this.createErrorResponse(
          integrationId,
          'You need to connect your N8N instance first. Please set up your N8N connection in the settings.',
          workflowCommand
        );
      }

      // 4. Check execution limits
      const canExecute = await this.checkExecutionLimits(options.userId, workflowCommand);
      if (!canExecute) {
        return this.createErrorResponse(
          integrationId,
          `Maximum concurrent executions (${this.config.maxConcurrentExecutions}) reached. Please wait for other workflows to complete.`,
          workflowCommand
        );
      }

      // 5. Process the workflow command
      const workflowResponse = await this.commandHandler.processWorkflowCommand(workflowCommand, chatContext);

      // 6. Create execution context if workflow was executed
      let executionContext: WorkflowExecutionContext | undefined;
      if (workflowResponse.success && workflowResponse.executionId) {
        executionContext = await this.createExecutionContext(
          workflowResponse.executionId,
          workflowCommand,
          options.userId
        );

        // Track active execution
        if (executionContext) {
          this.activeExecutions.set(workflowResponse.executionId, executionContext);
        }
      }

      // 7. Format enhanced response
      const enhancedMessage = this.formatWorkflowResponse(workflowResponse, workflowCommand);

      const response: AgentWorkflowChatResponse = {
        integrationId,
        hasWorkflowCommand: true,
        workflowResponse,
        shouldBypassNormalProcessing: workflowResponse.success && !workflowResponse.clarificationNeeded,
        enhancedMessage,
        executionContext,
        suggestions: workflowResponse.suggestions,
        clarificationNeeded: workflowResponse.clarificationNeeded,
        metadata: {
          commandType: workflowCommand.type,
          workflowId: workflowCommand.workflowReference.value,
          confidence: workflowCommand.confidence,
          executionId: workflowResponse.executionId,
          processingSuccess: workflowResponse.success
        }
      };

      this.logger.info(`[${this.serviceName}] Agent message processing completed`, {
        integrationId,
        hasWorkflowCommand: true,
        success: workflowResponse.success,
        shouldBypass: response.shouldBypassNormalProcessing,
        executionId: workflowResponse.executionId
      });

      return response;

    } catch (error) {
      this.logger.error(`[${this.serviceName}] Error processing agent message`, {
        integrationId,
        error: error instanceof Error ? error.message : String(error)
      });

      return this.createErrorResponse(
        integrationId,
        `Failed to process workflow request: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        error
      );
    }
  }

  // === Execution Status Management ===

  async checkWorkflowExecutionStatus(
    executionId: string,
    userId: string
  ): Promise<WorkflowExecutionContext | null> {
    try {
      // Check if we have cached context
      const cachedContext = this.activeExecutions.get(executionId);
      if (cachedContext) {
        // Update status from execution service
        const executionIdObj = ExecutionIdGenerator.parse(executionId);
        const currentStatus = await this.executionService.getExecutionStatus(executionIdObj);

        const updatedContext: WorkflowExecutionContext = {
          ...cachedContext,
          status: this.mapExecutionStatus(currentStatus.status),
          lastUpdate: new Date(),
          progress: this.calculateProgress(currentStatus)
        };

        // Update cache
        this.activeExecutions.set(executionId, updatedContext);
        return updatedContext;
      }

      // Fetch from execution service
      const executionIdObj = ExecutionIdGenerator.parse(executionId);
      const execution = await this.executionService.getExecutionStatus(executionIdObj);
      const context: WorkflowExecutionContext = {
        executionId,
        workflowId: execution.workflowId,
        workflowName: execution.workflowId, // TODO: Get actual workflow name
        status: this.mapExecutionStatus(execution.status),
        startedAt: execution.startedAt,
        estimatedCompletion: this.estimateCompletion(execution),
        progress: this.calculateProgress(execution),
        lastUpdate: new Date()
      };

      return context;

    } catch (error) {
      this.logger.error(`[${this.serviceName}] Error checking execution status`, {
        executionId,
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  async getUserActiveExecutions(userId: string): Promise<readonly WorkflowExecutionContext[]> {
    try {
      // Get user executions from tracking service - using proper filters structure
      const userExecutions = await this.trackingService.getExecutionHistory(
        userId,
        { status: ['running'] }
      );

      const activeContexts: WorkflowExecutionContext[] = [];

      for (const execution of userExecutions.executions) {
        const context = await this.checkWorkflowExecutionStatus(execution.executionId, userId);
        if (context && context.status === 'running') {
          activeContexts.push(context);
        }
      }

      this.logger.debug(`[${this.serviceName}] Retrieved active executions`, {
        userId,
        activeCount: activeContexts.length
      });

      return activeContexts;

    } catch (error) {
      this.logger.error(`[${this.serviceName}] Error getting user active executions`, {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  // === Workflow Suggestions ===

  async suggestWorkflowsForMessage(
    message: string,
    options: ChatIntegrationOptions
  ): Promise<readonly string[]> {
    try {
      const chatContext: ChatContext = {
        userId: options.userId,
        chatId: options.chatId,
        messageId: options.messageId,
        conversationHistory: options.conversationHistory,
        sessionData: options.sessionData
      };

      const suggestions = await this.commandHandler.suggestWorkflows(message, chatContext);

      return suggestions.slice(0, this.config.maxSuggestions);

    } catch (error) {
      this.logger.error(`[${this.serviceName}] Error generating workflow suggestions`, {
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  // === Execution Management ===

  async cancelUserExecution(executionId: string, userId: string): Promise<boolean> {
    try {
      const executionIdObj = ExecutionIdGenerator.parse(executionId);
      const success = await this.executionService.cancelExecution(executionIdObj);

      if (success) {
        // Update local tracking
        const context = this.activeExecutions.get(executionId);
        if (context) {
          const updatedContext: WorkflowExecutionContext = {
            ...context,
            status: 'cancelled',
            lastUpdate: new Date()
          };
          this.activeExecutions.set(executionId, updatedContext);
        }

        this.logger.info(`[${this.serviceName}] Execution cancelled successfully`, {
          executionId,
          userId
        });
      }

      return success;

    } catch (error) {
      this.logger.error(`[${this.serviceName}] Error cancelling execution`, {
        executionId,
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  // === Private Helper Methods ===

  private createNoWorkflowResponse(
    integrationId: string,
    reason: string
  ): AgentWorkflowChatResponse {
    return {
      integrationId,
      hasWorkflowCommand: false,
      shouldBypassNormalProcessing: false,
      metadata: { reason }
    };
  }

  private createErrorResponse(
    integrationId: string,
    errorMessage: string,
    command?: WorkflowChatCommand,
    originalError?: unknown
  ): AgentWorkflowChatResponse {
    return {
      integrationId,
      hasWorkflowCommand: !!command,
      shouldBypassNormalProcessing: false,
      errorMessage,
      enhancedMessage: errorMessage,
      metadata: {
        error: true,
        originalError: originalError instanceof Error ? originalError.message : String(originalError),
        commandId: command?.commandId
      }
    };
  }

  private async validateUserWorkflowAccess(
    userId: string,
    command: WorkflowChatCommand
  ): Promise<boolean> {
    try {
      // Check if user has N8N connections
      const userConnections = await this.connectionManager.getUserConnections(userId);
      if (userConnections.length === 0) {
        return false;
      }

      // For execute commands, also check if they have access to the specific workflow
      if (command.type === 'execute_workflow') {
        return await this.executionService.validateUserAccess(userId, command.workflowReference.value);
      }

      return true;

    } catch (error) {
      this.logger.warn(`[${this.serviceName}] Error validating user workflow access`, {
        userId,
        command: command.commandId,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  private async checkExecutionLimits(
    userId: string,
    command: WorkflowChatCommand
  ): Promise<boolean> {
    if (command.type !== 'execute_workflow') {
      return true; // No limits for non-execution commands
    }

    try {
      const activeExecutions = await this.getUserActiveExecutions(userId);
      return activeExecutions.length < this.config.maxConcurrentExecutions;

    } catch (error) {
      this.logger.warn(`[${this.serviceName}] Error checking execution limits`, {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      return true; // Allow execution if we can't check limits
    }
  }

  private async createExecutionContext(
    executionId: string,
    command: WorkflowChatCommand,
    userId: string
  ): Promise<WorkflowExecutionContext | undefined> {
    try {
      const executionIdObj = ExecutionIdGenerator.parse(executionId);
      const execution = await this.executionService.getExecutionStatus(executionIdObj);

      return {
        executionId,
        workflowId: execution.workflowId,
        workflowName: command.workflowReference.value,
        status: this.mapExecutionStatus(execution.status),
        startedAt: execution.startedAt,
        estimatedCompletion: this.estimateCompletion(execution),
        progress: this.calculateProgress(execution),
        lastUpdate: new Date()
      };

    } catch (error) {
      this.logger.error(`[${this.serviceName}] Error creating execution context`, {
        executionId,
        commandId: command.commandId,
        error: error instanceof Error ? error.message : String(error)
      });
      return undefined;
    }
  }

  private shouldSuggestWorkflows(message: string): boolean {
    const suggestionKeywords = [
      'help', 'what can', 'what workflows', 'automate', 'automation',
      'task', 'process', 'integration', 'connect'
    ];

    const normalizedMessage = message.toLowerCase();
    return suggestionKeywords.some(keyword => normalizedMessage.includes(keyword));
  }

  private formatWorkflowSuggestions(message: string, suggestions: readonly string[]): string {
    if (suggestions.length === 0) {
      return message;
    }

    const suggestionText = suggestions.length === 1
      ? `I found a workflow that might help: "${suggestions[0]}"`
      : `I found ${suggestions.length} workflows that might help:\n${suggestions.map(s => `• ${s}`).join('\n')}`;

    return `${message}\n\n💡 ${suggestionText}\n\nWould you like me to run any of these workflows?`;
  }

  private formatWorkflowResponse(
    response: WorkflowChatResponse,
    command: WorkflowChatCommand
  ): string {
    if (!response.success) {
      return `❌ ${response.message}`;
    }

    switch (this.config.chatResponseFormat) {
      case 'concise':
        return `✅ ${response.message}`;

      case 'technical':
        return `✅ ${response.message}\n\n**Details:**\n• Command: ${command.type}\n• Workflow: ${command.workflowReference.value}\n• Confidence: ${(command.confidence * 100).toFixed(1)}%${response.executionId ? `\n• Execution ID: ${response.executionId}` : ''}`;

      case 'detailed':
      default:
        let formatted = `✅ ${response.message}`;

        if (response.executionId) {
          formatted += `\n\n🔄 **Execution Details:**\n• Workflow: ${command.workflowReference.value}\n• Status: Running\n• Execution ID: ${response.executionId}`;

          if (this.config.enableProgressTracking) {
            formatted += '\n• You can check progress by asking "what\'s the status of my workflow?"';
          }
        }

        if (response.suggestions && response.suggestions.length > 0) {
          formatted += `\n\n💡 **Related workflows:** ${response.suggestions.join(', ')}`;
        }

        return formatted;
    }
  }

  private mapExecutionStatus(status: string): WorkflowExecutionContext['status'] {
    switch (status.toLowerCase()) {
      case 'pending':
      case 'queued':
        return 'pending';
      case 'running':
      case 'executing':
        return 'running';
      case 'completed':
      case 'success':
      case 'finished':
        return 'completed';
      case 'failed':
      case 'error':
        return 'failed';
      case 'cancelled':
      case 'canceled':
      case 'stopped':
        return 'cancelled';
      default:
        return 'pending';
    }
  }

  private calculateProgress(execution: any): number {
    // Simple progress calculation - could be enhanced with real execution progress
    if (execution.status === 'completed') return 100;
    if (execution.status === 'failed' || execution.status === 'cancelled') return 0;

    // Estimate progress based on duration
    if (execution.startedAt && execution.duration) {
      const elapsed = Date.now() - new Date(execution.startedAt).getTime();
      const estimated = execution.duration * 1.5; // Add 50% buffer
      return Math.min(Math.max((elapsed / estimated) * 100, 10), 90);
    }

    return 25; // Default progress for running executions
  }

  private estimateCompletion(execution: any): Date | undefined {
    if (!execution.startedAt) return undefined;

    // Simple estimation - could be enhanced with historical data
    const baselineMs = 120000; // 2 minutes default
    const startTime = new Date(execution.startedAt).getTime();
    return new Date(startTime + baselineMs);
  }
} 