/**
 * LLMServiceAdapter.ts - Adapter for existing LLM services to work with ACG
 * 
 * Bridges the existing AgentLLMService interface with the ILLMService interface
 * required by ACG generators. Follows adapter pattern and dependency injection.
 */

import {
  ILLMService,
  LLMGenerationOptions,
  LLMResponse,
  LLMStructuredResponse
} from '../interfaces/IContentGenerator';
import { AgentLLMService } from '../../messaging/message-generator';

export class LLMServiceAdapter implements ILLMService {
  constructor(
    private readonly agentLLMService: AgentLLMService
  ) { }

  async generateResponse(
    prompt: string,
    options?: LLMGenerationOptions
  ): Promise<LLMResponse> {
    try {
      // Build system prompt with options
      const systemPrompt = this.buildSystemPrompt(options);

      // Generate response using existing service
      const content = await this.agentLLMService.generateResponse(
        systemPrompt,
        prompt,
        {
          model: options?.model,
          maxTokens: options?.maxTokens,
          temperature: options?.temperature,
          topP: options?.topP,
          stopSequences: options?.stopSequences,
          timeoutMs: options?.timeoutMs
        }
      );

      // Estimate tokens (rough approximation)
      const tokensUsed = this.estimateTokens(prompt + content);

      return {
        content: content.trim(),
        model: options?.model || 'gpt-3.5-turbo',
        tokensUsed,
        finishReason: 'completed',
        confidence: this.calculateConfidence(content)
      };

    } catch (error) {
      throw new Error(`LLM generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateStructuredResponse<T>(
    prompt: string,
    schema: T,
    options?: LLMGenerationOptions
  ): Promise<LLMStructuredResponse<T>> {
    // For now, generate regular response and attempt to parse
    // In a full implementation, this would use structured output features
    const response = await this.generateResponse(prompt, options);

    try {
      // Attempt to parse as JSON
      const structuredData = JSON.parse(response.content) as T;

      return {
        ...response,
        structuredData
      };
    } catch (error) {
      // If parsing fails, return the response with null structured data
      return {
        ...response,
        structuredData: null as T
      };
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Test with a simple prompt
      await this.agentLLMService.generateResponse(
        'You are a test assistant.',
        'Say "OK"',
        { timeoutMs: 5000 }
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  async getModels(): Promise<readonly string[]> {
    // Return common models - in a full implementation, this would query the service
    return [
      'gpt-3.5-turbo',
      'gpt-4',
      'gpt-4-turbo'
    ] as const;
  }

  // ===== Private Helper Methods =====

  private buildSystemPrompt(options?: LLMGenerationOptions): string {
    let systemPrompt = 'You are a helpful AI assistant specializing in content generation.';

    if (options?.temperature !== undefined) {
      if (options.temperature < 0.3) {
        systemPrompt += ' Provide precise, consistent responses.';
      } else if (options.temperature > 0.7) {
        systemPrompt += ' Be creative and varied in your responses.';
      }
    }

    if (options?.maxTokens) {
      systemPrompt += ` Keep responses concise and under ${options.maxTokens} tokens.`;
    }

    return systemPrompt;
  }

  private estimateTokens(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }

  private calculateConfidence(content: string): number {
    // Simple confidence calculation based on content characteristics
    let confidence = 0.8; // Base confidence

    // Reduce confidence for very short responses
    if (content.length < 10) {
      confidence -= 0.3;
    }

    // Reduce confidence for responses with uncertainty markers
    const uncertaintyMarkers = [
      'i think', 'maybe', 'perhaps', 'might be', 'could be',
      'not sure', 'unclear', 'difficult to say'
    ];

    const lowerContent = content.toLowerCase();
    for (const marker of uncertaintyMarkers) {
      if (lowerContent.includes(marker)) {
        confidence -= 0.1;
        break;
      }
    }

    // Increase confidence for structured responses
    if (content.includes('\n') && content.length > 50) {
      confidence += 0.1;
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }
} 