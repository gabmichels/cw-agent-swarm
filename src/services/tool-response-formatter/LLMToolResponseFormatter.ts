/**
 * LLM-powered tool response formatter with persona integration
 * 
 * This service transforms tool execution results into persona-aware conversational
 * responses using LLM generation. Follows implementation guidelines with dependency
 * injection, pure functions, strict typing, and comprehensive error handling.
 */

import { ulid } from 'ulid';
import { PromptFormatter } from '../../agents/shared/messaging/PromptFormatter';
import { createLogger } from '../../lib/logging/winston-logger';
import { AgentLLMService } from '../messaging/message-generator';
import {
  FormattedToolResponse,
  IPromptTemplateService,
  IResponseCache,
  IToolResponseFormatter,
  LLMGenerationError,
  ResponseStyle,
  ResponseStyleType,
  ToolCategory,
  ToolResponseContext,
  ToolResponseFormattingError,
  ULID
} from './types';

/**
 * LLM-powered tool response formatter with persona integration
 */
export class LLMToolResponseFormatter implements IToolResponseFormatter {
  private readonly logger: ReturnType<typeof createLogger>;

  constructor(
    private readonly llmService: AgentLLMService,
    private readonly promptTemplateService: IPromptTemplateService,
    private readonly responseCache: IResponseCache
  ) {
    this.logger = createLogger({
      moduleId: 'llm-tool-response-formatter',
    });
  }

  /**
   * Format tool execution result into conversational response
   */
  async formatResponse(context: ToolResponseContext): Promise<FormattedToolResponse> {
    const startTime = Date.now();

    try {
      this.logger.info('Starting tool response formatting', {
        contextId: context.id,
        toolCategory: context.toolCategory,
        agentId: context.agentId,
        toolId: context.toolResult.toolId
      });

      // Check cache first if enabled
      if (context.responseConfig.enableCaching) {
        const cached = await this.getCachedResponse(context);
        if (cached) {
          this.logger.info('Using cached response', { contextId: context.id });
          return this.addCacheHitMetrics(cached);
        }
      }

      // Generate system prompt with persona integration
      const systemPrompt = await this.buildSystemPrompt(context);

      // Generate input context for LLM
      const inputContext = this.buildInputContext(context);

      // Generate response using LLM
      const rawResponse = await this.generateLLMResponse(
        systemPrompt,
        inputContext,
        context
      );

      // Post-process and validate response
      const processedResponse = await this.postProcessResponse(rawResponse, context);

      // Calculate quality score
      const qualityScore = this.calculateQualityScore(processedResponse, context);

      // Create formatted response
      const result: FormattedToolResponse = {
        id: this.generateResponseId(),
        content: processedResponse,
        responseStyle: context.responseConfig.responseStyle,
        generationMetrics: {
          generationTime: Date.now() - startTime,
          promptTokens: this.estimateTokens(systemPrompt),
          responseTokens: this.estimateTokens(processedResponse),
          cacheHit: false
        },
        qualityScore,
        fallbackUsed: false,
        timestamp: new Date()
      };

      // Cache if enabled
      if (context.responseConfig.enableCaching) {
        await this.cacheResponse(context, result);
      }

      this.logger.info('Tool response formatting completed successfully', {
        contextId: context.id,
        responseId: result.id,
        generationTime: result.generationMetrics.generationTime,
        qualityScore: result.qualityScore
      });

      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error('Tool response formatting failed', {
        contextId: context.id,
        error: error instanceof Error ? error.message : String(error),
        processingTime
      });

      if (error instanceof ToolResponseFormattingError) {
        throw error;
      }

      throw new ToolResponseFormattingError(
        'Tool response generation failed',
        'GENERATION_FAILED',
        {
          contextId: context.id,
          originalError: error,
          processingTime
        }
      );
    }
  }

  /**
   * Get available response styles for a tool category
   */
  async getAvailableStyles(category: ToolCategory): Promise<readonly ResponseStyle[]> {
    try {
      const templates = await this.promptTemplateService.getAllTemplates();
      const categoryTemplates = templates.filter(t => t.category === category && t.enabled);

      const styles = categoryTemplates.map(template => ({
        name: template.style,
        description: this.getStyleDescription(template.style),
        templateId: template.id,
        characteristics: this.getStyleCharacteristics(template.style)
      }));

      // Remove duplicates and return immutable array
      const uniqueStyles = styles.filter((style, index, self) =>
        index === self.findIndex(s => s.name === style.name)
      );

      return Object.freeze(uniqueStyles);

    } catch (error) {
      this.logger.error('Failed to get available styles', {
        category,
        error: error instanceof Error ? error.message : String(error)
      });

      // Return default styles as fallback
      return Object.freeze([
        {
          name: 'conversational',
          description: 'Friendly, engaging, and easy to understand',
          templateId: 'default_conversational',
          characteristics: ['friendly', 'clear', 'engaging']
        }
      ]);
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Build system prompt with persona integration
   */
  private async buildSystemPrompt(context: ToolResponseContext): Promise<string> {
    try {
      const template = await this.promptTemplateService.getTemplate(
        context.toolCategory,
        context.responseConfig.responseStyle
      );

      const formattedPrompt = await PromptFormatter.formatSystemPrompt({
        basePrompt: template.systemPrompt,
        persona: context.agentPersona,
        includeCapabilities: true,
        additionalContext: [
          `Tool Category: ${context.toolCategory}`,
          `Response Style: ${context.responseConfig.responseStyle}`,
          `User Intent: ${context.executionIntent}`,
          `Include Emojis: ${context.responseConfig.includeEmojis}`,
          `Include Metrics: ${context.responseConfig.includeMetrics}`,
          `Include Next Steps: ${context.responseConfig.includeNextSteps}`
        ]
      });

      // Ensure we always return a valid string
      if (!formattedPrompt || typeof formattedPrompt !== 'string' || formattedPrompt.trim().length === 0) {
        this.logger.warn('PromptFormatter returned invalid result, using fallback', {
          contextId: context.id,
          formattedPrompt: formattedPrompt
        });
        return this.buildFallbackSystemPrompt(context);
      }

      return formattedPrompt;

    } catch (error) {
      this.logger.warn('Failed to build system prompt, using fallback', {
        contextId: context.id,
        error: error instanceof Error ? error.message : String(error)
      });

      // Fallback system prompt
      return this.buildFallbackSystemPrompt(context);
    }
  }

  /**
   * Build input context for LLM generation
   */
  private buildInputContext(context: ToolResponseContext): string {
    const toolResult = context.toolResult;
    const recentContext = context.conversationHistory
      .slice(-3)
      .map(msg => `${msg.sender}: ${msg.content}`)
      .join('\n');

    return `ORIGINAL USER REQUEST: "${context.originalUserMessage}"

TOOL EXECUTION RESULT:
- Tool: ${toolResult.toolId}
- Success: ${toolResult.success}
- Execution Time: ${toolResult.metrics?.durationMs}ms
${toolResult.success ? `- Result: ${JSON.stringify(toolResult.data, null, 2)}` : ''}
${!toolResult.success ? `- Error: ${toolResult.error?.message}` : ''}

RECENT CONVERSATION:
${recentContext}

RESPONSE REQUIREMENTS:
- Match agent persona and communication style exactly
- Be specific about what was accomplished
- Include relevant details from the tool result
- Suggest logical next steps if appropriate
- Use ${context.responseConfig.responseStyle} tone
${context.responseConfig.includeEmojis ? '- Include appropriate emojis' : '- No emojis'}
${context.responseConfig.includeMetrics ? '- Include relevant performance metrics' : '- Focus on outcomes, not metrics'}
- Keep response under ${context.responseConfig.maxResponseLength} characters

Generate a conversational response that feels natural and helpful.`;
  }

  /**
   * Generate LLM response with error handling
   */
  private async generateLLMResponse(
    systemPrompt: string,
    inputContext: string,
    context: ToolResponseContext
  ): Promise<string> {
    try {
      const response = await this.llmService.generateResponse(
        systemPrompt,
        inputContext,
        {
          agentId: context.agentId,
          toolId: context.toolResult.toolId,
          contextId: context.id
        }
      );

      if (!response || response.trim().length === 0) {
        throw new LLMGenerationError(
          'LLM returned empty response',
          { contextId: context.id }
        );
      }

      return response.trim();

    } catch (error) {
      this.logger.error('LLM generation failed', {
        contextId: context.id,
        error: error instanceof Error ? error.message : String(error)
      });

      throw new LLMGenerationError(
        `LLM response generation failed: ${error instanceof Error ? error.message : String(error)}`,
        { contextId: context.id, originalError: error }
      );
    }
  }

  /**
   * Post-process and validate response
   */
  private async postProcessResponse(
    response: string,
    context: ToolResponseContext
  ): Promise<string> {
    let processed = response;

    // Trim and clean up
    processed = processed.trim();

    // Apply length constraints
    if (processed.length > context.responseConfig.maxResponseLength) {
      const truncateIndex = context.responseConfig.maxResponseLength - 3;
      processed = processed.substring(0, truncateIndex) + '...';

      this.logger.warn('Response truncated due to length limit', {
        contextId: context.id,
        originalLength: response.length,
        maxLength: context.responseConfig.maxResponseLength
      });
    }

    // Remove emojis if not desired
    if (!context.responseConfig.includeEmojis) {
      processed = processed.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
    }

    // Basic validation
    if (processed.length < 10) {
      throw new ToolResponseFormattingError(
        'Processed response too short',
        'RESPONSE_TOO_SHORT',
        { contextId: context.id, length: processed.length }
      );
    }

    return processed;
  }

  /**
   * Calculate quality score for response
   */
  private calculateQualityScore(response: string, context: ToolResponseContext): number {
    let score = 0.5; // Base score

    // Length appropriateness (0.2 max)
    const idealLength = context.responseConfig.maxResponseLength * 0.7;
    const lengthRatio = Math.min(response.length / idealLength, 1);
    score += lengthRatio * 0.2;

    // Content relevance indicators (0.2 max)
    const toolMentioned = response.toLowerCase().includes(context.toolResult.toolId.toLowerCase());
    const intentMentioned = context.executionIntent.split(' ').some(word =>
      response.toLowerCase().includes(word.toLowerCase())
    );
    if (toolMentioned) score += 0.1;
    if (intentMentioned) score += 0.1;

    // Style adherence (0.1 max)
    const style = context.responseConfig.responseStyle;
    if (style === 'casual' && (response.includes('!') || response.includes('😊'))) score += 0.1;
    if (style === 'business' && response.length > 50) score += 0.1;
    if (style === 'technical' && response.includes('ms')) score += 0.1;
    if (style === 'conversational' && response.length > 30) score += 0.1;

    return Math.min(score, 1.0);
  }

  /**
   * Generate cache key for response
   */
  private generateCacheKey(context: ToolResponseContext): string {
    const keyComponents = [
      context.toolResult.toolId,
      context.toolCategory,
      context.responseConfig.responseStyle,
      context.agentId,
      JSON.stringify(context.toolResult.data),
      context.toolResult.success.toString()
    ];

    return `tool_response:${keyComponents.join(':')}`;
  }

  /**
   * Get cached response if available
   */
  private async getCachedResponse(context: ToolResponseContext): Promise<FormattedToolResponse | null> {
    try {
      const cacheKey = this.generateCacheKey(context);
      return await this.responseCache.get(cacheKey);
    } catch (error) {
      this.logger.warn('Cache retrieval failed', {
        contextId: context.id,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Cache formatted response
   */
  private async cacheResponse(context: ToolResponseContext, response: FormattedToolResponse): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(context);
      await this.responseCache.set(cacheKey, response, context.responseConfig.cacheTTLSeconds);
    } catch (error) {
      this.logger.warn('Response caching failed', {
        contextId: context.id,
        responseId: response.id,
        error: error instanceof Error ? error.message : String(error)
      });
      // Don't throw - caching failure shouldn't break the response
    }
  }

  /**
   * Add cache hit metrics to response
   */
  private addCacheHitMetrics(response: FormattedToolResponse): FormattedToolResponse {
    return {
      ...response,
      generationMetrics: {
        ...response.generationMetrics,
        cacheHit: true,
        generationTime: 0
      }
    };
  }

  /**
   * Generate ULID for response
   */
  private generateResponseId(): ULID {
    return ulid();
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(text: string | undefined | null): number {
    if (!text || typeof text !== 'string') {
      return 0;
    }
    return Math.ceil(text.length / 4);
  }

  /**
   * Get style description
   */
  private getStyleDescription(style: ResponseStyleType): string {
    const descriptions = {
      conversational: 'Friendly, engaging, and easy to understand',
      business: 'Professional, focused, and results-oriented',
      technical: 'Precise, detailed, and specification-focused',
      casual: 'Relaxed, informal, and approachable'
    };
    return descriptions[style];
  }

  /**
   * Get style characteristics
   */
  private getStyleCharacteristics(style: ResponseStyleType): readonly string[] {
    const characteristics = {
      conversational: ['friendly', 'clear', 'engaging', 'helpful'],
      business: ['professional', 'concise', 'actionable', 'results-focused'],
      technical: ['precise', 'detailed', 'analytical', 'specification-driven'],
      casual: ['relaxed', 'informal', 'approachable', 'fun']
    };
    return Object.freeze(characteristics[style]);
  }

  /**
   * Build fallback system prompt when template service fails
   */
  private buildFallbackSystemPrompt(context: ToolResponseContext): string {
    return `You are ${context.agentPersona.background || 'a helpful AI assistant'}.

Communication Style: ${context.agentPersona.communicationStyle || 'friendly and professional'}
Response Style: ${context.responseConfig.responseStyle}

Your task is to provide a ${context.responseConfig.responseStyle} response about a tool execution result.
Focus on being helpful, accurate, and matching your personality.
${context.responseConfig.includeEmojis ? 'Use appropriate emojis to enhance the message.' : 'Do not use emojis.'}
${context.responseConfig.includeNextSteps ? 'Include logical next steps when appropriate.' : ''}
Keep responses under ${context.responseConfig.maxResponseLength} characters.`;
  }
} 