/**
 * AgentWorkflowIntegration.ts - Enhances agent message processing with workflow triggers
 * 
 * Integrates external workflow triggers into agent message processing pipeline.
 * Follows IMPLEMENTATION_GUIDELINES.md: ULID, strict typing, DI, pure functions, immutability.
 */

import { ulid } from 'ulid';
import { AgentBase, AgentResponse, MessageProcessingOptions } from './AgentBase.interface';
import { 
  WorkflowTriggerService, 
  WorkflowTriggerMatch, 
  AgentWorkflowExecutionRequest,
  AgentWorkflowExecutionResult,
  WorkflowSuggestion
} from '../../../services/agents/WorkflowTriggerService';
import { createLogger } from '../../../lib/logging/winston-logger';

/**
 * Workflow integration response
 */
export interface WorkflowIntegrationResponse {
  readonly hasWorkflowMatch: boolean;
  readonly workflowMatch?: WorkflowTriggerMatch;
  readonly workflowResult?: AgentWorkflowExecutionResult;
  readonly workflowSuggestion?: WorkflowSuggestion;
  readonly shouldProceedWithNormalProcessing: boolean;
  readonly integrationMessage?: string;
}

/**
 * Workflow integration configuration
 */
export interface WorkflowIntegrationConfig {
  readonly enabled: boolean;
  readonly autoExecuteThreshold: number;
  readonly confirmationThreshold: number;
  readonly suggestionThreshold: number;
  readonly includeWorkflowResultInResponse: boolean;
  readonly fallbackToNormalProcessing: boolean;
}

/**
 * Default workflow integration configuration
 */
const DEFAULT_INTEGRATION_CONFIG: WorkflowIntegrationConfig = {
  enabled: true,
  autoExecuteThreshold: 0.85,
  confirmationThreshold: 0.65,
  suggestionThreshold: 0.40,
  includeWorkflowResultInResponse: true,
  fallbackToNormalProcessing: true
};

/**
 * AgentWorkflowIntegration - Enhances agents with workflow trigger capabilities
 */
export class AgentWorkflowIntegration {
  private readonly logger = createLogger({ moduleId: 'agent-workflow-integration' });
  private readonly config: WorkflowIntegrationConfig;

  constructor(
    private readonly workflowTriggerService: WorkflowTriggerService,
    config: Partial<WorkflowIntegrationConfig> = {}
  ) {
    this.config = { ...DEFAULT_INTEGRATION_CONFIG, ...config };
  }

  /**
   * Process message with workflow integration
   */
  async processMessageWithWorkflows(
    agent: AgentBase,
    message: string,
    options: MessageProcessingOptions = {}
  ): Promise<WorkflowIntegrationResponse> {
    try {
      if (!this.config.enabled) {
        return {
          hasWorkflowMatch: false,
          shouldProceedWithNormalProcessing: true,
          integrationMessage: 'Workflow integration is disabled'
        };
      }

      const agentId = agent.getAgentId();
      
      this.logger.debug('Processing message for workflow triggers', {
        agentId,
        messageLength: message.length,
        userId: options.userId
      });

      // Check for workflow triggers
      const workflowMatch = await this.workflowTriggerService.processUserMessage(
        agentId,
        message,
        {
          userId: options.userId,
          sessionId: options.chatId || options.messageId,
          skipRateLimit: false
        }
      );

      if (!workflowMatch) {
        return {
          hasWorkflowMatch: false,
          shouldProceedWithNormalProcessing: true,
          integrationMessage: 'No workflow matches found'
        };
      }

      this.logger.info('Workflow match found', {
        agentId,
        workflowId: workflowMatch.workflow.id.toString(),
        confidence: workflowMatch.confidence,
        matchType: workflowMatch.matchType
      });

      // Determine action based on confidence
      if (workflowMatch.confidence >= this.config.autoExecuteThreshold) {
        // Auto-execute high confidence matches
        return await this.executeWorkflowAutomatically(
          agentId,
          message,
          workflowMatch,
          options
        );
      } else if (workflowMatch.confidence >= this.config.confirmationThreshold) {
        // Request confirmation for medium confidence matches
        return this.requestWorkflowConfirmation(workflowMatch);
      } else if (workflowMatch.confidence >= this.config.suggestionThreshold) {
        // Suggest workflow for low confidence matches
        return await this.suggestWorkflow(agentId, message, [workflowMatch]);
      } else {
        // Proceed with normal processing
        return {
          hasWorkflowMatch: true,
          workflowMatch,
          shouldProceedWithNormalProcessing: true,
          integrationMessage: `Workflow match found but confidence too low (${(workflowMatch.confidence * 100).toFixed(1)}%)`
        };
      }

    } catch (error) {
      this.logger.error('Error in workflow integration', {
        agentId: agent.getAgentId(),
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        hasWorkflowMatch: false,
        shouldProceedWithNormalProcessing: this.config.fallbackToNormalProcessing,
        integrationMessage: `Workflow integration error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Execute workflow automatically for high confidence matches
   */
  private async executeWorkflowAutomatically(
    agentId: string,
    userMessage: string,
    workflowMatch: WorkflowTriggerMatch,
    options: MessageProcessingOptions
  ): Promise<WorkflowIntegrationResponse> {
    try {
      const executionRequest: AgentWorkflowExecutionRequest = {
        requestId: `wf_exec_req_${ulid()}`,
        agentId,
        userId: options.userId,
        sessionId: options.chatId || options.messageId,
        userMessage,
        workflow: workflowMatch.workflow,
        parameters: workflowMatch.suggestedParams,
        confidence: workflowMatch.confidence,
        requiresConfirmation: false,
        timestamp: new Date()
      };

      const workflowResult = await this.workflowTriggerService.executeWorkflow(executionRequest);

      this.logger.info('Workflow executed automatically', {
        agentId,
        executionId: workflowResult.executionId,
        success: workflowResult.success,
        durationMs: workflowResult.durationMs
      });

      return {
        hasWorkflowMatch: true,
        workflowMatch,
        workflowResult,
        shouldProceedWithNormalProcessing: !workflowResult.success && this.config.fallbackToNormalProcessing,
        integrationMessage: workflowResult.success 
          ? `Workflow "${workflowMatch.workflow.name}" executed successfully`
          : `Workflow execution failed: ${workflowResult.error?.message}`
      };

    } catch (error) {
      this.logger.error('Failed to execute workflow automatically', {
        agentId,
        workflowId: workflowMatch.workflow.id.toString(),
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        hasWorkflowMatch: true,
        workflowMatch,
        shouldProceedWithNormalProcessing: this.config.fallbackToNormalProcessing,
        integrationMessage: `Failed to execute workflow: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Request confirmation for medium confidence matches
   */
  private requestWorkflowConfirmation(workflowMatch: WorkflowTriggerMatch): WorkflowIntegrationResponse {
    return {
      hasWorkflowMatch: true,
      workflowMatch,
      shouldProceedWithNormalProcessing: false,
      integrationMessage: this.formatConfirmationMessage(workflowMatch)
    };
  }

  /**
   * Suggest workflow for low confidence matches
   */
  private async suggestWorkflow(
    agentId: string,
    userMessage: string,
    matches: readonly WorkflowTriggerMatch[]
  ): Promise<WorkflowIntegrationResponse> {
    const suggestion = await this.workflowTriggerService.generateWorkflowSuggestion(
      agentId,
      userMessage,
      matches
    );

    return {
      hasWorkflowMatch: true,
      workflowMatch: matches[0],
      workflowSuggestion: suggestion,
      shouldProceedWithNormalProcessing: true,
      integrationMessage: this.formatSuggestionMessage(suggestion)
    };
  }

  /**
   * Format workflow confirmation message
   */
  private formatConfirmationMessage(workflowMatch: WorkflowTriggerMatch): string {
    const confidence = (workflowMatch.confidence * 100).toFixed(1);
    const paramsList = Object.entries(workflowMatch.suggestedParams)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');

    return `I found a workflow that might help: **${workflowMatch.workflow.name}** (${confidence}% confidence)\n\n` +
           `**Description:** ${workflowMatch.workflow.description}\n` +
           `**Platform:** ${workflowMatch.workflow.platform}\n` +
           `**Parameters:** ${paramsList || 'None'}\n\n` +
           `Would you like me to execute this workflow?`;
  }

  /**
   * Format workflow suggestion message
   */
  private formatSuggestionMessage(suggestion: WorkflowSuggestion): string {
    const bestMatch = suggestion.matches[0];
    if (!bestMatch) {
      return 'No workflow suggestions available.';
    }

    const confidence = (bestMatch.confidence * 100).toFixed(1);
    
    return `💡 **Workflow Suggestion**\n\n` +
           `I noticed you might want to use: **${bestMatch.workflow.name}** (${confidence}% confidence)\n` +
           `${bestMatch.workflow.description}\n\n` +
           `**Reasoning:** ${suggestion.reasoning}\n\n` +
           `Let me know if you'd like me to set this up for you!`;
  }

  /**
   * Format workflow execution result for agent response
   */
  formatWorkflowResultForResponse(
    workflowResult: AgentWorkflowExecutionResult,
    workflowMatch: WorkflowTriggerMatch
  ): string {
    if (!this.config.includeWorkflowResultInResponse) {
      return '';
    }

    if (workflowResult.success) {
      let response = `✅ **Workflow Completed Successfully**\n\n`;
      response += `**Workflow:** ${workflowMatch.workflow.name}\n`;
      response += `**Platform:** ${workflowMatch.workflow.platform}\n`;
      response += `**Duration:** ${workflowResult.durationMs}ms\n`;
      
      if (workflowResult.costUsd) {
        response += `**Cost:** $${workflowResult.costUsd.toFixed(4)}\n`;
      }
      
      if (workflowResult.result) {
        response += `\n**Result:**\n${this.formatWorkflowResult(workflowResult.result)}`;
      }
      
      return response;
    } else {
      return `❌ **Workflow Failed**\n\n` +
             `**Workflow:** ${workflowMatch.workflow.name}\n` +
             `**Error:** ${workflowResult.error?.message || 'Unknown error'}\n` +
             `**Duration:** ${workflowResult.durationMs}ms`;
    }
  }

  /**
   * Format workflow result data
   */
  private formatWorkflowResult(result: unknown): string {
    if (typeof result === 'string') {
      return result;
    } else if (typeof result === 'object' && result !== null) {
      try {
        return JSON.stringify(result, null, 2);
      } catch {
        return String(result);
      }
    } else {
      return String(result);
    }
  }

  /**
   * Create enhanced agent response with workflow integration
   */
  createEnhancedAgentResponse(
    baseResponse: AgentResponse,
    integrationResponse: WorkflowIntegrationResponse
  ): AgentResponse {
    let enhancedContent = baseResponse.content;
    const enhancedMetadata = { ...baseResponse.metadata };

    // Add workflow integration information
    if (integrationResponse.hasWorkflowMatch) {
      enhancedMetadata.workflowIntegration = {
        hasMatch: true,
        confidence: integrationResponse.workflowMatch?.confidence,
        matchType: integrationResponse.workflowMatch?.matchType,
        workflowName: integrationResponse.workflowMatch?.workflow.name,
        workflowPlatform: integrationResponse.workflowMatch?.workflow.platform,
        executed: !!integrationResponse.workflowResult,
        success: integrationResponse.workflowResult?.success,
        executionId: integrationResponse.workflowResult?.executionId
      };

      // Add workflow result to response content if available
      if (integrationResponse.workflowResult && integrationResponse.workflowMatch) {
        const workflowResultText = this.formatWorkflowResultForResponse(
          integrationResponse.workflowResult,
          integrationResponse.workflowMatch
        );
        
        if (workflowResultText) {
          enhancedContent = workflowResultText + '\n\n' + enhancedContent;
        }
      }

      // Add integration message if no workflow was executed
      if (!integrationResponse.workflowResult && integrationResponse.integrationMessage) {
        enhancedContent = integrationResponse.integrationMessage + '\n\n' + enhancedContent;
      }
    }

    return {
      ...baseResponse,
      content: enhancedContent,
      metadata: enhancedMetadata
    };
  }

  /**
   * Check if workflow integration is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Update workflow integration configuration
   */
  updateConfig(newConfig: Partial<WorkflowIntegrationConfig>): void {
    Object.assign(this.config, newConfig);
    this.logger.info('Workflow integration configuration updated', { config: this.config });
  }

  /**
   * Get current configuration
   */
  getConfig(): WorkflowIntegrationConfig {
    return { ...this.config };
  }
} 