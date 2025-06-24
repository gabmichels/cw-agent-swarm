/**
 * N8nWorkflowChatIntegration.ts - Agent-level integration for N8N workflow execution via chat
 * 
 * Integrates N8N workflow execution capabilities into agent message processing pipeline,
 * enabling natural language workflow execution through chat commands.
 * Follows IMPLEMENTATION_GUIDELINES.md: ULID, strict typing, DI, pure functions, immutability.
 */

import { ulid } from 'ulid';
import { createLogger } from '../../../lib/logging/winston-logger';
import { AgentWorkflowChatResponse, ChatIntegrationOptions, N8nChatIntegration } from '../../../services/external-workflows/chat/N8nChatIntegration';
import { ChatContext, WorkflowChatCommand, WorkflowChatCommandHandler } from '../../../services/external-workflows/chat/WorkflowChatCommandHandler';
import { ExecutionTrackingService } from '../../../services/external-workflows/execution/ExecutionTrackingService';
import { WorkflowExecutionService } from '../../../services/external-workflows/execution/WorkflowExecutionService';
import { WorkflowParameterParser } from '../../../services/external-workflows/execution/WorkflowParameterParser';
import { N8nConnectionManager } from '../../../services/external-workflows/integrations/N8nConnectionManager';
import { AgentResponse, MessageProcessingOptions } from '../base/AgentBase.interface';

// === Agent Integration Interfaces ===

export interface N8nWorkflowAgentResponse {
  readonly integrationId: string; // ULID format: n8n_agent_[ULID]
  readonly hasWorkflowIntegration: boolean;
  readonly shouldBypassNormalProcessing: boolean;
  readonly enhancedAgentResponse: AgentResponse;
  readonly workflowContext?: WorkflowAgentContext;
  readonly executionMetadata?: WorkflowExecutionMetadata;
  readonly userFeedback?: UserFeedback;
}

export interface WorkflowAgentContext {
  readonly workflowCommand?: WorkflowChatCommand;
  readonly chatIntegrationResponse?: AgentWorkflowChatResponse;
  readonly executionId?: string;
  readonly workflowId?: string;
  readonly workflowName?: string;
  readonly executionStatus?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  readonly confidence: number;
  readonly requiresUserConfirmation: boolean;
}

export interface WorkflowExecutionMetadata {
  readonly executionStartTime?: Date;
  readonly estimatedCompletion?: Date;
  readonly progress?: number;
  readonly stepCount?: number;
  readonly currentStep?: string;
  readonly logs?: readonly string[];
  readonly costEstimate?: number;
  readonly resourceUsage?: Record<string, unknown>;
}

export interface UserFeedback {
  readonly suggestedActions?: readonly string[];
  readonly clarificationQuestions?: readonly string[];
  readonly helpfulTips?: readonly string[];
  readonly troubleshootingSteps?: readonly string[];
  readonly followUpOptions?: readonly string[];
}

// === Configuration ===

export interface N8nWorkflowAgentConfig {
  readonly enabled: boolean;
  readonly autoProcessWorkflowCommands: boolean;
  readonly enableProgressTracking: boolean;
  readonly enableWorkflowSuggestions: boolean;
  readonly maxConcurrentWorkflows: number;
  readonly defaultConfirmationRequired: boolean;
  readonly enhanceAgentResponses: boolean;
  readonly provideFeedbackOptions: boolean;
  readonly timeoutSeconds: number;
}

const DEFAULT_CONFIG: N8nWorkflowAgentConfig = {
  enabled: true,
  autoProcessWorkflowCommands: true,
  enableProgressTracking: true,
  enableWorkflowSuggestions: true,
  maxConcurrentWorkflows: 3,
  defaultConfirmationRequired: true,
  enhanceAgentResponses: true,
  provideFeedbackOptions: true,
  timeoutSeconds: 300
};

// === Agent Integration Interface ===

export interface IN8nWorkflowChatIntegration {
  processAgentMessage(
    agentId: string,
    message: string,
    options: MessageProcessingOptions
  ): Promise<N8nWorkflowAgentResponse>;

  checkAgentWorkflowStatus(
    agentId: string,
    executionId: string,
    userId: string
  ): Promise<WorkflowAgentContext | null>;

  handleWorkflowConfirmation(
    agentId: string,
    confirmationResponse: string,
    workflowContext: WorkflowAgentContext,
    options: MessageProcessingOptions
  ): Promise<N8nWorkflowAgentResponse>;

  suggestWorkflowsForAgent(
    agentId: string,
    message: string,
    options: MessageProcessingOptions
  ): Promise<readonly string[]>;

  cancelAgentWorkflow(
    agentId: string,
    executionId: string,
    userId: string
  ): Promise<boolean>;
}

// === Implementation ===

export class N8nWorkflowChatIntegration implements IN8nWorkflowChatIntegration {
  private readonly serviceName = 'N8nWorkflowChatIntegration';
  private readonly logger = createLogger({ moduleId: this.serviceName });
  private readonly config: N8nWorkflowAgentConfig;

  // Pending confirmations cache
  private readonly pendingConfirmations = new Map<string, WorkflowAgentContext>();

  constructor(
    private readonly commandHandler: WorkflowChatCommandHandler,
    private readonly chatIntegration: N8nChatIntegration,
    private readonly parameterParser: WorkflowParameterParser,
    private readonly executionService: WorkflowExecutionService,
    private readonly trackingService: ExecutionTrackingService,
    private readonly connectionManager: N8nConnectionManager,
    config: Partial<N8nWorkflowAgentConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.logger.info(`[${this.serviceName}] Initialized N8N workflow agent integration`, {
      enabled: this.config.enabled,
      autoProcess: this.config.autoProcessWorkflowCommands,
      maxConcurrent: this.config.maxConcurrentWorkflows
    });
  }

  // === Main Agent Message Processing ===

  async processAgentMessage(
    agentId: string,
    message: string,
    options: MessageProcessingOptions
  ): Promise<N8nWorkflowAgentResponse> {
    const integrationId = `n8n_agent_${ulid()}`;

    this.logger.info(`[${this.serviceName}] Processing agent message for N8N workflows`, {
      integrationId,
      agentId,
      messageLength: message.length,
      userId: options.userId
    });

    if (!this.config.enabled) {
      return this.createNoIntegrationResponse(integrationId, message, 'N8N workflow integration is disabled');
    }

    try {
      // 1. Convert message processing options to chat integration options
      const chatOptions: ChatIntegrationOptions = {
        userId: options.userId || 'unknown',
        chatId: (options.chatId as string) || (options.conversationId as string) || 'unknown',
        messageId: (options.messageId as string) || (options.requestId as string) || 'unknown',
        conversationHistory: options.conversationHistory as readonly string[] | undefined,
        agentId,
        sessionData: options.metadata as Record<string, unknown> | undefined,
        enableAutoExecution: this.config.autoProcessWorkflowCommands,
        enableWorkflowSuggestions: this.config.enableWorkflowSuggestions
      };

      // 2. Check if this is a confirmation response for pending workflow
      const confirmationResponse = await this.checkForConfirmationResponse(message, chatOptions);
      if (confirmationResponse) {
        return confirmationResponse;
      }

      // 3. Process message through chat integration
      const chatIntegrationResponse = await this.chatIntegration.processAgentMessage(message, chatOptions);

      // 4. Convert to agent response format
      const agentResponse = this.createAgentResponseFromChatIntegration(
        chatIntegrationResponse,
        message,
        options
      );

      // 5. Create workflow context if applicable
      const workflowContext = chatIntegrationResponse.hasWorkflowCommand
        ? await this.createWorkflowAgentContext(chatIntegrationResponse, agentId, chatOptions)
        : undefined;

      // 6. Handle pending confirmations
      if (workflowContext?.requiresUserConfirmation) {
        await this.storePendingConfirmation(chatOptions.userId, workflowContext);
      }

      // 7. Enhance agent response with workflow information
      const enhancedAgentResponse = this.config.enhanceAgentResponses
        ? await this.enhanceAgentResponse(agentResponse, workflowContext, chatIntegrationResponse)
        : agentResponse;

      // 8. Generate user feedback
      const userFeedback = this.config.provideFeedbackOptions
        ? this.generateUserFeedback(workflowContext, chatIntegrationResponse)
        : undefined;

      const result: N8nWorkflowAgentResponse = {
        integrationId,
        hasWorkflowIntegration: chatIntegrationResponse.hasWorkflowCommand,
        shouldBypassNormalProcessing: chatIntegrationResponse.shouldBypassNormalProcessing,
        enhancedAgentResponse,
        workflowContext,
        executionMetadata: workflowContext?.executionId
          ? await this.createExecutionMetadata(workflowContext.executionId, agentId)
          : undefined,
        userFeedback
      };

      this.logger.info(`[${this.serviceName}] Agent message processing completed`, {
        integrationId,
        hasWorkflow: result.hasWorkflowIntegration,
        shouldBypass: result.shouldBypassNormalProcessing,
        executionId: workflowContext?.executionId,
        requiresConfirmation: workflowContext?.requiresUserConfirmation
      });

      return result;

    } catch (error) {
      this.logger.error(`[${this.serviceName}] Error processing agent message`, {
        integrationId,
        agentId,
        error: error instanceof Error ? error.message : String(error)
      });

      return this.createErrorResponse(
        integrationId,
        message,
        options,
        `N8N workflow processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // === Workflow Status Checking ===

  async checkAgentWorkflowStatus(
    agentId: string,
    executionId: string,
    userId: string
  ): Promise<WorkflowAgentContext | null> {
    try {
      this.logger.debug(`[${this.serviceName}] Checking workflow status for agent`, {
        agentId,
        executionId,
        userId
      });

      const executionContext = await this.chatIntegration.checkWorkflowExecutionStatus(executionId, userId);
      if (!executionContext) {
        return null;
      }

      return {
        executionId,
        workflowId: executionContext.workflowId,
        workflowName: executionContext.workflowName,
        executionStatus: executionContext.status,
        confidence: 1.0, // High confidence for existing executions
        requiresUserConfirmation: false
      };

    } catch (error) {
      this.logger.error(`[${this.serviceName}] Error checking workflow status`, {
        agentId,
        executionId,
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  // === Workflow Confirmation Handling ===

  async handleWorkflowConfirmation(
    agentId: string,
    confirmationResponse: string,
    workflowContext: WorkflowAgentContext,
    options: MessageProcessingOptions
  ): Promise<N8nWorkflowAgentResponse> {
    const integrationId = `n8n_agent_${ulid()}`;

    this.logger.info(`[${this.serviceName}] Handling workflow confirmation`, {
      integrationId,
      agentId,
      executionId: workflowContext.executionId,
      workflowId: workflowContext.workflowId
    });

    try {
      const isConfirmed = this.parseConfirmationResponse(confirmationResponse);

      if (!isConfirmed) {
        // User declined workflow execution
        const agentResponse: AgentResponse = {
          content: `Workflow execution cancelled. No problem! Let me know if you'd like to try something else.`,
          metadata: {
            workflowCancelled: true,
            workflowId: workflowContext.workflowId,
            reason: 'user_declined'
          }
        };

        return {
          integrationId,
          hasWorkflowIntegration: true,
          shouldBypassNormalProcessing: true,
          enhancedAgentResponse: agentResponse
        };
      }

      // User confirmed - execute the workflow
      if (workflowContext.workflowCommand) {
        const chatContext: ChatContext = {
          userId: options.userId || 'unknown',
          chatId: options.chatId || 'unknown',
          messageId: options.messageId || 'unknown'
        };

        const executionResponse = await this.commandHandler.processWorkflowCommand(
          workflowContext.workflowCommand,
          chatContext
        );

        const agentResponse: AgentResponse = {
          content: executionResponse.success
            ? `✅ Great! I've started your workflow "${workflowContext.workflowName}". ${executionResponse.message}`
            : `❌ Sorry, there was an issue starting your workflow: ${executionResponse.message}`,
          metadata: {
            workflowExecuted: executionResponse.success,
            executionId: executionResponse.executionId,
            workflowId: workflowContext.workflowId,
            workflowName: workflowContext.workflowName
          }
        };

        // Update workflow context with execution results
        const updatedContext: WorkflowAgentContext = {
          ...workflowContext,
          executionId: executionResponse.executionId,
          executionStatus: executionResponse.success ? 'running' : 'failed',
          requiresUserConfirmation: false
        };

        return {
          integrationId,
          hasWorkflowIntegration: true,
          shouldBypassNormalProcessing: true,
          enhancedAgentResponse: agentResponse,
          workflowContext: updatedContext,
          executionMetadata: executionResponse.executionId
            ? await this.createExecutionMetadata(executionResponse.executionId, agentId)
            : undefined
        };
      }

      throw new Error('No workflow command available for confirmation');

    } catch (error) {
      this.logger.error(`[${this.serviceName}] Error handling workflow confirmation`, {
        integrationId,
        agentId,
        error: error instanceof Error ? error.message : String(error)
      });

      return this.createErrorResponse(
        integrationId,
        confirmationResponse,
        options,
        `Failed to process workflow confirmation: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // === Workflow Suggestions ===

  async suggestWorkflowsForAgent(
    agentId: string,
    message: string,
    options: MessageProcessingOptions
  ): Promise<readonly string[]> {
    if (!this.config.enableWorkflowSuggestions) {
      return [];
    }

    try {
      const chatOptions: ChatIntegrationOptions = {
        userId: options.userId || 'unknown',
        chatId: options.chatId || 'unknown',
        messageId: options.messageId || 'unknown',
        agentId
      };

      return await this.chatIntegration.suggestWorkflowsForMessage(message, chatOptions);

    } catch (error) {
      this.logger.error(`[${this.serviceName}] Error generating workflow suggestions`, {
        agentId,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  // === Workflow Cancellation ===

  async cancelAgentWorkflow(
    agentId: string,
    executionId: string,
    userId: string
  ): Promise<boolean> {
    try {
      this.logger.info(`[${this.serviceName}] Cancelling workflow for agent`, {
        agentId,
        executionId,
        userId
      });

      return await this.chatIntegration.cancelUserExecution(executionId, userId);

    } catch (error) {
      this.logger.error(`[${this.serviceName}] Error cancelling workflow`, {
        agentId,
        executionId,
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  // === Private Helper Methods ===

  private createNoIntegrationResponse(
    integrationId: string,
    message: string,
    reason: string
  ): N8nWorkflowAgentResponse {
    return {
      integrationId,
      hasWorkflowIntegration: false,
      shouldBypassNormalProcessing: false,
      enhancedAgentResponse: {
        content: message, // Pass through original message
        metadata: { n8nIntegrationSkipped: true, reason }
      }
    };
  }

  private createErrorResponse(
    integrationId: string,
    message: string,
    options: MessageProcessingOptions,
    errorMessage: string
  ): N8nWorkflowAgentResponse {
    return {
      integrationId,
      hasWorkflowIntegration: false,
      shouldBypassNormalProcessing: false,
      enhancedAgentResponse: {
        content: `I encountered an issue with workflow processing. Here's your original message: "${message}"`,
        metadata: {
          error: true,
          errorMessage,
          originalOptions: options
        }
      }
    };
  }

  private createAgentResponseFromChatIntegration(
    chatResponse: AgentWorkflowChatResponse,
    originalMessage: string,
    options: MessageProcessingOptions
  ): AgentResponse {
    let content = originalMessage; // Default fallback

    if (chatResponse.enhancedMessage) {
      content = chatResponse.enhancedMessage;
    } else if (chatResponse.errorMessage) {
      content = chatResponse.errorMessage;
    } else if (chatResponse.workflowResponse) {
      content = chatResponse.workflowResponse.message;
    }

    const baseMetadata = (options.metadata && typeof options.metadata === 'object')
      ? options.metadata as Record<string, unknown>
      : {};

    return {
      content,
      metadata: {
        ...baseMetadata,
        n8nIntegration: true,
        hasWorkflowCommand: chatResponse.hasWorkflowCommand,
        workflowSuccess: chatResponse.workflowResponse?.success,
        executionId: chatResponse.workflowResponse?.executionId,
        suggestions: chatResponse.suggestions,
        clarificationNeeded: chatResponse.clarificationNeeded,
        integrationMetadata: chatResponse.metadata
      }
    };
  }

  private async createWorkflowAgentContext(
    chatResponse: AgentWorkflowChatResponse,
    agentId: string,
    chatOptions: ChatIntegrationOptions
  ): Promise<WorkflowAgentContext | undefined> {
    if (!chatResponse.hasWorkflowCommand || !chatResponse.workflowResponse) {
      return undefined;
    }

    const workflowResponse = chatResponse.workflowResponse;
    const command = workflowResponse.command;

    if (!command) {
      return undefined;
    }

    return {
      workflowCommand: command,
      chatIntegrationResponse: chatResponse,
      executionId: workflowResponse.executionId,
      workflowId: command.workflowReference.value,
      workflowName: command.workflowReference.value,
      executionStatus: workflowResponse.executionId ? 'running' : 'pending',
      confidence: command.confidence,
      requiresUserConfirmation: command.confirmationRequired || workflowResponse.clarificationNeeded || false
    };
  }

  private async createExecutionMetadata(
    executionId: string,
    agentId: string
  ): Promise<WorkflowExecutionMetadata | undefined> {
    if (!this.config.enableProgressTracking) {
      return undefined;
    }

    try {
      // Get execution details from tracking service
      const execution = await this.trackingService.getExecution(executionId);
      if (!execution) {
        return undefined;
      }

      return {
        executionStartTime: execution.startedAt,
        estimatedCompletion: execution.completedAt,
        progress: 0, // Default progress
        logs: [], // Default empty logs
        resourceUsage: execution.metadata
      };

    } catch (error) {
      this.logger.warn(`[${this.serviceName}] Failed to create execution metadata`, {
        executionId,
        agentId,
        error: error instanceof Error ? error.message : String(error)
      });
      return undefined;
    }
  }

  private async enhanceAgentResponse(
    agentResponse: AgentResponse,
    workflowContext: WorkflowAgentContext | undefined,
    chatResponse: AgentWorkflowChatResponse
  ): Promise<AgentResponse> {
    let enhancedContent = agentResponse.content;

    // Add workflow status information
    if (workflowContext?.executionId && workflowContext.executionStatus === 'running') {
      enhancedContent += `\n\n🔄 **Workflow Status**: Your workflow "${workflowContext.workflowName}" is now running.`;

      if (this.config.enableProgressTracking) {
        enhancedContent += ` I'll keep you updated on its progress.`;
      }
    }

    // Add suggestions if available
    if (chatResponse.suggestions && chatResponse.suggestions.length > 0) {
      enhancedContent += `\n\n💡 **You might also like**: ${chatResponse.suggestions.join(', ')}`;
    }

    // Add follow-up options
    if (workflowContext?.executionId) {
      enhancedContent += `\n\n📋 **Commands you can use**:\n`;
      enhancedContent += `• "Check workflow status" - See current progress\n`;
      enhancedContent += `• "Cancel workflow" - Stop the execution\n`;
      enhancedContent += `• "Show my workflows" - List all available workflows`;
    }

    return {
      ...agentResponse,
      content: enhancedContent
    };
  }

  private generateUserFeedback(
    workflowContext: WorkflowAgentContext | undefined,
    chatResponse: AgentWorkflowChatResponse
  ): UserFeedback | undefined {
    const feedbackData: {
      suggestedActions?: string[];
      clarificationQuestions?: readonly string[];
      helpfulTips?: string[];
      followUpOptions?: string[];
    } = {};

    // Generate suggested actions
    const suggestedActions: string[] = [];
    if (workflowContext?.executionId) {
      suggestedActions.push('Check workflow progress');
      suggestedActions.push('View execution logs');
      suggestedActions.push('Cancel if needed');
    } else if (!chatResponse.hasWorkflowCommand) {
      suggestedActions.push('Try saying "run my workflow"');
      suggestedActions.push('List available workflows');
    }

    // Generate clarification questions if needed
    const clarificationQuestions = chatResponse.workflowResponse?.clarificationQuestions || [];

    // Generate helpful tips
    const helpfulTips: string[] = [];
    if (!chatResponse.hasWorkflowCommand) {
      helpfulTips.push('You can use natural language like "run the email automation workflow"');
      helpfulTips.push('Or be specific: "execute workflow-123 with email=user@example.com"');
    }

    // Generate follow-up options
    const followUpOptions: string[] = [];
    if (workflowContext?.executionStatus === 'completed') {
      followUpOptions.push('View execution results');
      followUpOptions.push('Run the workflow again');
      followUpOptions.push('Modify workflow parameters');
    }

    if (suggestedActions.length > 0) feedbackData.suggestedActions = suggestedActions;
    if (clarificationQuestions.length > 0) feedbackData.clarificationQuestions = clarificationQuestions;
    if (helpfulTips.length > 0) feedbackData.helpfulTips = helpfulTips;
    if (followUpOptions.length > 0) feedbackData.followUpOptions = followUpOptions;

    return Object.keys(feedbackData).length > 0 ? feedbackData as UserFeedback : undefined;
  }

  private async checkForConfirmationResponse(
    message: string,
    chatOptions: ChatIntegrationOptions
  ): Promise<N8nWorkflowAgentResponse | null> {
    const pendingContext = this.pendingConfirmations.get(chatOptions.userId);
    if (!pendingContext) {
      return null;
    }

    const isConfirmationResponse = this.isConfirmationMessage(message);
    if (!isConfirmationResponse) {
      return null;
    }

    // Remove from pending confirmations
    this.pendingConfirmations.delete(chatOptions.userId);

    // Convert chat options to message processing options
    const options: MessageProcessingOptions = {
      userId: chatOptions.userId,
      chatId: chatOptions.chatId,
      messageId: chatOptions.messageId,
      metadata: chatOptions.sessionData
    };

    // Handle the confirmation
    return await this.handleWorkflowConfirmation(
      chatOptions.agentId || 'unknown',
      message,
      pendingContext,
      options
    );
  }

  private async storePendingConfirmation(
    userId: string,
    workflowContext: WorkflowAgentContext
  ): Promise<void> {
    this.pendingConfirmations.set(userId, workflowContext);

    // Auto-cleanup after timeout
    setTimeout(() => {
      this.pendingConfirmations.delete(userId);
    }, this.config.timeoutSeconds * 1000);
  }

  private isConfirmationMessage(message: string): boolean {
    const confirmationKeywords = [
      'yes', 'y', 'yeah', 'yep', 'ok', 'okay', 'sure', 'go ahead', 'proceed',
      'no', 'n', 'nope', 'cancel', 'stop', 'abort', 'nevermind'
    ];

    const normalizedMessage = message.toLowerCase().trim();
    return confirmationKeywords.some(keyword => normalizedMessage.includes(keyword));
  }

  private parseConfirmationResponse(response: string): boolean {
    const positiveKeywords = ['yes', 'y', 'yeah', 'yep', 'ok', 'okay', 'sure', 'go ahead', 'proceed', 'confirm'];
    const normalizedResponse = response.toLowerCase().trim();

    return positiveKeywords.some(keyword => normalizedResponse.includes(keyword));
  }
} 