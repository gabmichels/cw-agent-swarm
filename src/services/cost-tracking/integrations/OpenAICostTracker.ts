import { CostTrackingService } from '../CostTrackingService';
import { logger } from '../../../lib/logging';

/**
 * Wrapper service that automatically tracks costs for OpenAI API usage
 */
export class OpenAICostTracker {
  private costTracker: CostTrackingService;

  constructor(costTracker: CostTrackingService) {
    this.costTracker = costTracker;
  }

  /**
   * Track cost for OpenAI API completion
   */
  async trackCompletion(params: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    operation: string;
    requestId?: string;
    initiatedBy: { type: 'agent' | 'user' | 'system'; id: string; name?: string };
    sessionId?: string;
    departmentId?: string;
  }): Promise<void> {
    try {
      await this.costTracker.recordOpenAICost({
        model: params.model,
        inputTokens: params.inputTokens,
        outputTokens: params.outputTokens,
        operation: params.operation,
        initiatedBy: params.initiatedBy,
        sessionId: params.sessionId,
        departmentId: params.departmentId
      });

      logger.debug('OpenAI cost tracked successfully', {
        model: params.model,
        inputTokens: params.inputTokens,
        outputTokens: params.outputTokens,
        operation: params.operation,
        requestId: params.requestId
      });
    } catch (error) {
      logger.error('Failed to track OpenAI cost', {
        error: error instanceof Error ? error.message : String(error),
        model: params.model,
        operation: params.operation,
        requestId: params.requestId
      });
    }
  }

  /**
   * Track cost for chat completion
   */
  async trackChatCompletion(params: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    inputTokens: number;
    outputTokens: number;
    initiatedBy: { type: 'agent' | 'user' | 'system'; id: string; name?: string };
    sessionId?: string;
    departmentId?: string;
    requestId?: string;
  }): Promise<void> {
    await this.trackCompletion({
      model: params.model,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      operation: 'chat_completion',
      requestId: params.requestId,
      initiatedBy: params.initiatedBy,
      sessionId: params.sessionId,
      departmentId: params.departmentId
    });
  }

  /**
   * Track cost for embeddings
   */
  async trackEmbeddings(params: {
    model: string;
    inputTokens: number;
    texts: string[];
    initiatedBy: { type: 'agent' | 'user' | 'system'; id: string; name?: string };
    sessionId?: string;
    departmentId?: string;
    requestId?: string;
  }): Promise<void> {
    await this.trackCompletion({
      model: params.model,
      inputTokens: params.inputTokens,
      outputTokens: 0, // Embeddings don't generate output tokens
      operation: 'embeddings',
      requestId: params.requestId,
      initiatedBy: params.initiatedBy,
      sessionId: params.sessionId,
      departmentId: params.departmentId
    });
  }

  /**
   * Track cost for function calling
   */
  async trackFunctionCall(params: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    functionName: string;
    initiatedBy: { type: 'agent' | 'user' | 'system'; id: string; name?: string };
    sessionId?: string;
    departmentId?: string;
    requestId?: string;
  }): Promise<void> {
    await this.trackCompletion({
      model: params.model,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      operation: `function_call:${params.functionName}`,
      requestId: params.requestId,
      initiatedBy: params.initiatedBy,
      sessionId: params.sessionId,
      departmentId: params.departmentId
    });
  }

  /**
   * Track cost for image generation
   */
  async trackImageGeneration(params: {
    model: string;
    size: string;
    quality: string;
    count: number;
    prompt: string;
    initiatedBy: { type: 'agent' | 'user' | 'system'; id: string; name?: string };
    sessionId?: string;
    departmentId?: string;
    requestId?: string;
  }): Promise<void> {
    try {
      const cost = this.calculateImageGenerationCost(params.model, params.size, params.quality, params.count);
      
      await this.costTracker.recordCost({
        category: 'openai_api' as any,
        service: 'openai',
        operation: 'image_generation',
        costUsd: cost,
        unitsConsumed: params.count,
        unitType: 'api_calls' as any,
        costPerUnit: cost / params.count,
        initiatedBy: params.initiatedBy,
        sessionId: params.sessionId,
        metadata: {
          toolParameters: {
            model: params.model,
            size: params.size,
            quality: params.quality,
            prompt: params.prompt
          },
          departmentId: params.departmentId,
          tags: ['openai', 'image_generation', params.model]
        }
      });

      logger.debug('OpenAI image generation cost tracked successfully', {
        model: params.model,
        size: params.size,
        quality: params.quality,
        count: params.count,
        cost,
        requestId: params.requestId
      });
    } catch (error) {
      logger.error('Failed to track OpenAI image generation cost', {
        error: error instanceof Error ? error.message : String(error),
        model: params.model,
        requestId: params.requestId
      });
    }
  }

  /**
   * Estimate cost before making API call
   */
  estimateCompletionCost(params: {
    model: string;
    estimatedInputTokens: number;
    estimatedOutputTokens: number;
  }): {
    estimatedCost: number;
    costBreakdown: {
      inputCost: number;
      outputCost: number;
    };
    costTier: 'free' | 'low' | 'medium' | 'high' | 'premium';
  } {
    const pricing = this.getModelPricing();
    const modelPricing = pricing[params.model] || pricing['gpt-3.5-turbo'];

    const inputCost = (params.estimatedInputTokens / 1000) * modelPricing.input;
    const outputCost = (params.estimatedOutputTokens / 1000) * modelPricing.output;
    const estimatedCost = inputCost + outputCost;

    return {
      estimatedCost,
      costBreakdown: {
        inputCost,
        outputCost
      },
      costTier: this.determineCostTier(estimatedCost)
    };
  }

  /**
   * Get current token usage for a session
   */
  async getSessionTokenUsage(sessionId: string, timeWindow?: { start: Date; end: Date }): Promise<{
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    totalCost: number;
    requestCount: number;
  }> {
    // This would query the cost tracking service for session data
    // For now, return placeholder data
    return {
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalCost: 0,
      requestCount: 0
    };
  }

  /**
   * Get cost breakdown by model for a time period
   */
  async getModelCostBreakdown(params: {
    startDate: Date;
    endDate: Date;
    departmentId?: string;
  }): Promise<Record<string, {
    totalCost: number;
    totalTokens: number;
    requestCount: number;
    averageCostPerRequest: number;
  }>> {
    // This would query the cost tracking service for model breakdown
    // For now, return placeholder data
    return {};
  }

  private calculateImageGenerationCost(model: string, size: string, quality: string, count: number): number {
    // DALL-E pricing (approximate as of 2024)
    const pricing: Record<string, Record<string, Record<string, number>>> = {
      'dall-e-3': {
        '1024x1024': { 'standard': 0.04, 'hd': 0.08 },
        '1024x1792': { 'standard': 0.08, 'hd': 0.12 },
        '1792x1024': { 'standard': 0.08, 'hd': 0.12 }
      },
      'dall-e-2': {
        '1024x1024': { 'standard': 0.02 },
        '512x512': { 'standard': 0.018 },
        '256x256': { 'standard': 0.016 }
      }
    };

    const modelPricing = pricing[model] || pricing['dall-e-2'];
    const sizePricing = modelPricing[size] || modelPricing['1024x1024'];
    const qualityPricing = sizePricing[quality] || sizePricing['standard'];

    return qualityPricing * count;
  }

  private getModelPricing(): Record<string, { input: number; output: number }> {
    // OpenAI pricing per 1K tokens (approximate as of 2024)
    return {
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-4-turbo': { input: 0.01, output: 0.03 },
      'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
      'text-embedding-ada-002': { input: 0.0001, output: 0 }
    };
  }

  private determineCostTier(cost: number): 'free' | 'low' | 'medium' | 'high' | 'premium' {
    if (cost <= 0) return 'free';
    if (cost <= 0.01) return 'low';
    if (cost <= 0.10) return 'medium';
    if (cost <= 1.00) return 'high';
    return 'premium';
  }
} 