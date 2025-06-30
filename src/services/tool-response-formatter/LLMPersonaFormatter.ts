/**
 * Integration with OutputProcessingCoordinator formatter system
 * 
 * This formatter hooks into the existing OutputProcessingCoordinator system
 * to provide LLM-powered, persona-aware response formatting for tool executions.
 * Uses the adapter pattern to integrate with existing architecture.
 */

import { ulid } from 'ulid';
import { AgentResponse } from '../../agents/shared/base/AgentBase.interface';
import { PersonaInfo } from '../../agents/shared/messaging/PromptFormatter';
import { OutputFormatter } from '../../agents/shared/processors/OutputProcessingCoordinator';
import { createLogger } from '../../lib/logging/winston-logger';
import { ToolExecutionResult } from '../../lib/tools/types';
import { LLMToolResponseFormatter } from './LLMToolResponseFormatter';
import {
  IToolResponseConfigService,
  MessagePreferences,
  RecentMessage,
  ToolCategory,
  ToolResponseConfig,
  ToolResponseContext
} from './types';

/**
 * Integration with OutputProcessingCoordinator formatter system
 */
export class LLMPersonaFormatter implements OutputFormatter {
  readonly name = 'llm_persona_formatter';
  readonly enabled = true;
  readonly priority = 100; // Highest priority to process before other formatters
  readonly supportedTypes = ['*']; // All content types

  private readonly logger: ReturnType<typeof createLogger>;

  constructor(
    private readonly toolResponseFormatter: LLMToolResponseFormatter,
    private readonly configService: IToolResponseConfigService
  ) {
    this.logger = createLogger({
      moduleId: 'llm-persona-formatter',
    });
  }

  /**
   * Format content using LLM-powered persona-aware formatting
   */
  async format(content: string, response: AgentResponse): Promise<string> {
    try {
      // Extract tool result from response metadata
      const toolResult = this.extractToolResult(response);
      if (!toolResult) {
        this.logger.debug('No tool result found in response metadata, skipping LLM formatting');
        return content; // No tool result to format
      }

      // Get agent configuration
      const agentId = this.extractAgentId(response);
      if (!agentId) {
        this.logger.warn('No agent ID found in response metadata, skipping LLM formatting');
        return content;
      }

      // Check if LLM formatting is enabled for this agent/tool
      const config = await this.configService.getConfig(agentId);
      if (!config.enableLLMFormatting) {
        this.logger.debug('LLM formatting disabled for agent, skipping', { agentId });
        return content;
      }

      // Build comprehensive context for formatting
      const context = await this.buildToolResponseContext(content, response, toolResult, config);
      if (!context) {
        this.logger.warn('Failed to build tool response context, using original content');
        return content;
      }

      // Generate formatted response
      this.logger.info('Applying LLM persona formatting', {
        agentId: context.agentId,
        toolId: context.toolResult.toolId,
        contextId: context.id
      });

      const formattedResponse = await this.toolResponseFormatter.formatResponse(context);

      this.logger.info('LLM persona formatting completed successfully', {
        agentId: context.agentId,
        toolId: context.toolResult.toolId,
        contextId: context.id,
        responseId: formattedResponse.id,
        qualityScore: formattedResponse.qualityScore,
        fallbackUsed: formattedResponse.fallbackUsed
      });

      return formattedResponse.content;

    } catch (error) {
      // Log error but don't fail - return original content as graceful fallback
      this.logger.error('LLM persona formatting failed, using original content as fallback', {
        error: error instanceof Error ? error.message : String(error),
        agentId: this.extractAgentId(response),
        contentLength: content.length
      });

      return content;
    }
  }

  /**
   * Validate if content should be processed by this formatter
   */
  validate(content: string): boolean {
    // Always validate as true - we handle our own validation and fallback logic
    return true;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Extract tool execution result from response metadata
   */
  private extractToolResult(response: AgentResponse): ToolExecutionResult | null {
    try {
      const toolResult = response.metadata?.toolResult as ToolExecutionResult;

      // Validate required fields for tool result
      if (!toolResult || typeof toolResult.success !== 'boolean' || !toolResult.toolId) {
        return null;
      }

      return toolResult;
    } catch (error) {
      this.logger.debug('Failed to extract tool result from response metadata', {
        error: error instanceof Error ? error.message : String(error),
        hasMetadata: !!response.metadata
      });
      return null;
    }
  }

  /**
   * Extract agent ID from response metadata
   */
  private extractAgentId(response: AgentResponse): string | null {
    try {
      const agentId = response.metadata?.agentId as string;
      return agentId || null;
    } catch (error) {
      this.logger.debug('Failed to extract agent ID from response metadata', {
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Build comprehensive tool response context
   */
  private async buildToolResponseContext(
    content: string,
    response: AgentResponse,
    toolResult: ToolExecutionResult,
    config: ToolResponseConfig
  ): Promise<ToolResponseContext | null> {
    try {
      const contextId = ulid();

      // Extract required context from response metadata
      const agentId = this.extractAgentId(response)!; // Already validated
      const agentPersona = this.extractAgentPersona(response);
      const agentCapabilities = this.extractAgentCapabilities(response);
      const userId = this.extractUserId(response);
      const userPreferences = this.extractUserPreferences(response);
      const conversationHistory = this.extractConversationHistory(response);
      const originalUserMessage = this.extractOriginalUserMessage(response);
      const executionIntent = this.extractExecutionIntent(response);

      // Detect tool category from tool ID
      const toolCategory = this.detectToolCategory(toolResult.toolId);

      return {
        id: contextId,
        timestamp: new Date(),
        toolResult,
        toolCategory,
        executionIntent: executionIntent || 'unknown',
        originalUserMessage: originalUserMessage || content,
        agentId,
        agentPersona: agentPersona || this.getDefaultPersona(),
        agentCapabilities: agentCapabilities || [],
        userId: userId || 'unknown',
        userPreferences: userPreferences || this.getDefaultUserPreferences(),
        conversationHistory: conversationHistory || [],
        responseConfig: config,
        fallbackEnabled: true
      };

    } catch (error) {
      this.logger.error('Failed to build tool response context', {
        error: error instanceof Error ? error.message : String(error),
        toolId: toolResult.toolId
      });
      return null;
    }
  }

  /**
   * Extract agent persona from response metadata
   */
  private extractAgentPersona(response: AgentResponse): PersonaInfo | null {
    try {
      return (response.metadata?.agentPersona as PersonaInfo) || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract agent capabilities from response metadata
   */
  private extractAgentCapabilities(response: AgentResponse): string[] | null {
    try {
      const capabilities = response.metadata?.agentCapabilities as string[];
      return Array.isArray(capabilities) ? capabilities : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract user ID from response metadata
   */
  private extractUserId(response: AgentResponse): string | null {
    try {
      return (response.metadata?.userId as string) || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract user preferences from response metadata
   */
  private extractUserPreferences(response: AgentResponse): MessagePreferences | null {
    try {
      return (response.metadata?.userPreferences as MessagePreferences) || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract conversation history from response metadata
   */
  private extractConversationHistory(response: AgentResponse): RecentMessage[] | null {
    try {
      const history = response.metadata?.conversationHistory as RecentMessage[];
      return Array.isArray(history) ? history : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract original user message from response metadata
   */
  private extractOriginalUserMessage(response: AgentResponse): string | null {
    try {
      return (response.metadata?.originalMessage as string) || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract execution intent from response metadata
   */
  private extractExecutionIntent(response: AgentResponse): string | null {
    try {
      return (response.metadata?.originalIntent as string) || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Detect tool category from tool ID
   */
  private detectToolCategory(toolId: string): ToolCategory {
    const lowerToolId = toolId.toLowerCase();

    // Workspace tools
    if (lowerToolId.includes('email') ||
      lowerToolId.includes('calendar') ||
      lowerToolId.includes('drive') ||
      lowerToolId.includes('sheets') ||
      lowerToolId.includes('docs')) {
      return ToolCategory.WORKSPACE;
    }

    // Social media tools
    if (lowerToolId.includes('twitter') ||
      lowerToolId.includes('linkedin') ||
      lowerToolId.includes('social') ||
      lowerToolId.includes('instagram') ||
      lowerToolId.includes('facebook')) {
      return ToolCategory.SOCIAL_MEDIA;
    }

    // External API tools
    if (lowerToolId.includes('apify') ||
      lowerToolId.includes('api') ||
      lowerToolId.includes('web') ||
      lowerToolId.includes('http') ||
      lowerToolId.includes('fetch')) {
      return ToolCategory.EXTERNAL_API;
    }

    // Workflow tools
    if (lowerToolId.includes('n8n') ||
      lowerToolId.includes('zapier') ||
      lowerToolId.includes('workflow') ||
      lowerToolId.includes('automation')) {
      return ToolCategory.WORKFLOW;
    }

    // Research tools
    if (lowerToolId.includes('research') ||
      lowerToolId.includes('analysis') ||
      lowerToolId.includes('scan') ||
      lowerToolId.includes('search') ||
      lowerToolId.includes('data')) {
      return ToolCategory.RESEARCH;
    }

    return ToolCategory.CUSTOM;
  }

  /**
   * Get default persona when none is available
   */
  private getDefaultPersona(): PersonaInfo {
    return {
      background: 'A helpful AI assistant',
      personality: 'Professional, friendly, and helpful',
      communicationStyle: 'Clear, concise, and supportive',
      expertise: ['general assistance', 'task completion'],
      preferences: {}
    };
  }

  /**
   * Get default user preferences when none are available
   */
  private getDefaultUserPreferences(): MessagePreferences {
    return {
      preferredTone: 'friendly',
      maxMessageLength: 500,
      enableEmojis: false,
      includeMetrics: false,
      communicationStyle: 'conversational'
    };
  }
} 