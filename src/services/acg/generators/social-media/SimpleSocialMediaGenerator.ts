/**
 * SimpleSocialMediaGenerator.ts - Basic social media content generator
 * 
 * A streamlined implementation for social media content generation that
 * properly integrates with the ACG system.
 */

import { ulid } from 'ulid';
import {
  ACGErrorFactory,
  ContentGenerationError
} from '../../errors/ContentGenerationError';
import {
  GeneratorConfiguration,
  GeneratorDependencies,
  GeneratorUsageStats,
  HealthStatus,
  ILLMContentGenerator,
  ILLMService,
  LLMResponse
} from '../../interfaces/IContentGenerator';
import {
  AsyncContentGenerationResult,
  ContentData,
  ContentMetadata,
  ContentType,
  GeneratedContent,
  GenerationContext,
  GenerationMethod,
  ValidationIssueType,
  ValidationResult
} from '../../types/ContentGenerationTypes';
import {
  GenerationCapability
} from '../../types/GenerationCapabilities';

export class SimpleSocialMediaGenerator implements ILLMContentGenerator {
  readonly id = 'simple-social-media-generator';
  readonly name = 'Simple Social Media Generator';
  readonly version = '1.0.0';
  readonly supportedTypes: readonly ContentType[] = [
    ContentType.SOCIAL_POST,
    ContentType.SOCIAL_COMMENT,
    ContentType.SOCIAL_MESSAGE
  ] as const;
  readonly capabilities: readonly GenerationCapability[] = [
    GenerationCapability.LLM_POWERED,
    GenerationCapability.CONTEXT_AWARE,
    GenerationCapability.PLATFORM_AWARE
  ];
  readonly priority = 8;
  readonly enabled = true;

  readonly configuration: GeneratorConfiguration = {
    maxRetries: 3,
    timeoutMs: 30000,
    fallbackEnabled: true,
    cachingEnabled: true,
    validationEnabled: true,
    qualityThreshold: 0.7,
    customSettings: {
      maxPostLength: 280,
      includeHashtags: true,
      defaultTone: 'engaging'
    }
  };

  private dependencies?: GeneratorDependencies;
  private usageStats: GeneratorUsageStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageLatencyMs: 0,
    averageConfidenceScore: 0,
    cacheHitRate: 0,
    contentTypeDistribution: {
      [ContentType.SOCIAL_POST]: 0,
      [ContentType.SOCIAL_COMMENT]: 0,
      [ContentType.SOCIAL_MESSAGE]: 0
    } as Record<ContentType, number>
  };

  constructor(readonly llmService: ILLMService) { }

  async initialize(dependencies: GeneratorDependencies): Promise<void> {
    this.dependencies = dependencies;

    const isAvailable = await this.llmService.isAvailable();
    if (!isAvailable) {
      throw new Error('LLM service is not available for social media content generation');
    }

    this.dependencies.logger.info('Social media content generator initialized', {
      generatorId: this.id,
      supportedTypes: this.supportedTypes,
      capabilities: this.capabilities
    });
  }

  async shutdown(): Promise<void> {
    this.dependencies?.logger.info('Social media content generator shutting down', {
      generatorId: this.id,
      usageStats: this.usageStats
    });
  }

  async generate(context: GenerationContext): AsyncContentGenerationResult {
    const startTime = Date.now();
    const requestId = ulid();

    try {
      this.usageStats.totalRequests++;
      const contentType = ContentType.SOCIAL_POST; // Default to social post
      this.usageStats.contentTypeDistribution[contentType]++;

      const prompt = await this.buildPrompt(context);
      const llmResponse = await this.llmService.generateResponse(prompt, {
        maxTokens: 100,
        temperature: 0.7,
        timeoutMs: this.configuration.timeoutMs
      });

      const generatedContent = await this.parseResponse(llmResponse, context);
      this.usageStats.successfulRequests++;
      const durationMs = Date.now() - startTime;
      this.usageStats.averageLatencyMs =
        (this.usageStats.averageLatencyMs * (this.usageStats.totalRequests - 1) + durationMs) / this.usageStats.totalRequests;

      return {
        success: true,
        data: generatedContent,
        metrics: {
          requestId,
          startTime: new Date(startTime),
          endTime: new Date(),
          durationMs,
          memoryUsed: process.memoryUsage().heapUsed,
          cacheHit: false,
          retryCount: 0,
          success: true
        }
      };

    } catch (error) {
      this.usageStats.failedRequests++;
      const durationMs = Date.now() - startTime;

      const generationError = error instanceof ContentGenerationError
        ? error
        : ACGErrorFactory.createLLMError(
          error instanceof Error ? error.message : 'Unknown error in social media generation',
          {
            requestId,
            contentType: ContentType.SOCIAL_POST,
            cause: error as Error
          }
        );

      return {
        success: false,
        error: {
          code: generationError.code,
          message: generationError.message,
          details: generationError.context,
          requestId: generationError.requestId,
          timestamp: generationError.timestamp,
          recoverable: generationError.retryable,
          retryAfter: generationError.retryAfter
        },
        metrics: {
          requestId,
          startTime: new Date(startTime),
          endTime: new Date(),
          durationMs,
          memoryUsed: process.memoryUsage().heapUsed,
          cacheHit: false,
          retryCount: 0,
          success: false
        }
      };
    }
  }

  async canGenerate(contentType: ContentType, context: GenerationContext): Promise<boolean> {
    return this.supportedTypes.includes(contentType) &&
      !!context.originalMessage?.trim() &&
      await this.llmService.isAvailable();
  }

  async validate(content: GeneratedContent): Promise<ValidationResult> {
    const issues: Array<{
      type: ValidationIssueType;
      severity: 'low' | 'medium' | 'high' | 'critical';
      message: string;
      suggestion?: string;
    }> = [];

    const text = content.content.text || '';

    if (text.length < 10) {
      issues.push({
        type: ValidationIssueType.LENGTH_TOO_SHORT,
        severity: 'high',
        message: 'Social media content is too short',
        suggestion: 'Generate longer, more engaging content'
      });
    }

    if (text.length > 280) {
      issues.push({
        type: ValidationIssueType.LENGTH_EXCEEDED,
        severity: 'medium',
        message: 'Content exceeds Twitter character limit',
        suggestion: 'Trim content to fit platform requirements'
      });
    }

    return {
      isValid: issues.filter(i => i.severity === 'critical' || i.severity === 'high').length === 0,
      score: Math.max(0.1, 1.0 - issues.length * 0.2),
      issues,
      suggestions: issues.map(i => i.suggestion).filter(Boolean) as string[],
      platformCompliance: {
        twitter: text.length <= 280,
        linkedin: text.length <= 3000,
        facebook: text.length <= 63206
      }
    };
  }

  async estimateGenerationTime(context: GenerationContext): Promise<number> {
    return 3000; // 3 seconds for social media content
  }

  async getHealthStatus(): Promise<HealthStatus> {
    const isLLMAvailable = await this.llmService.isAvailable();

    return {
      status: isLLMAvailable ? 'healthy' : 'degraded',
      lastChecked: new Date(),
      dependencies: {
        llmService: {
          status: isLLMAvailable ? 'available' : 'unavailable',
          lastChecked: new Date()
        }
      },
      performance: {
        averageLatencyMs: this.usageStats.averageLatencyMs,
        successRate: this.usageStats.totalRequests > 0
          ? this.usageStats.successfulRequests / this.usageStats.totalRequests
          : 1,
        requestsPerMinute: 0, // Would need time tracking
        memoryUsageMB: process.memoryUsage().heapUsed / 1024 / 1024
      }
    };
  }

  async getUsageStats(): Promise<GeneratorUsageStats> {
    return { ...this.usageStats };
  }

  async buildPrompt(context: GenerationContext): Promise<string> {
    const originalMessage = context.originalMessage;
    const platform = (context as any).platforms?.[0] || 'twitter';
    const baseContent = (context as any).baseContent || '';
    const expansionInstructions = (context as any).expansionInstructions || [];

    let prompt = `You are an expert social media content creator. `;

    if (baseContent && expansionInstructions.length > 0) {
      // Hybrid scenario
      prompt += `Create a social media post that includes this content: "${baseContent}" and expands on it with: ${expansionInstructions.join(', ')}. `;
    } else if (baseContent) {
      // Enhancement scenario
      prompt += `Enhance this social media content: "${baseContent}". `;
    } else {
      // Full generation scenario
      prompt += `Create engaging social media content based on: "${originalMessage}". `;
    }

    prompt += `Optimize for ${platform}. `;

    if (platform === 'twitter') {
      prompt += `Keep it under 280 characters, make it engaging and conversational. `;
    } else if (platform === 'linkedin') {
      prompt += `Use a professional tone, aim for 150-400 characters, include relevant hashtags. `;
    }

    prompt += `Return only the social media post content, properly formatted.`;

    return prompt;
  }

  async parseResponse(response: LLMResponse, context: GenerationContext): Promise<GeneratedContent> {
    let content = response.content.trim();

    // Remove quotes if wrapped
    content = content.replace(/^["']|["']$/g, '');

    // Platform optimization
    const platform = (context as any).platforms?.[0] || 'twitter';
    if (platform === 'twitter' && content.length > 280) {
      content = content.substring(0, 277) + '...';
    }

    const generatedContent: GeneratedContent = {
      id: ulid(),
      type: ContentType.SOCIAL_POST,
      content: {
        text: content,
        format: 'text',
        metadata: {
          platform,
          characterCount: content.length,
          optimizedForEngagement: true
        }
      } as ContentData,
      metadata: {
        generatedAt: new Date(),
        method: GenerationMethod.LLM_POWERED,
        confidence: response.confidence || 0.8,
        processingTimeMs: 0,
        fallbackUsed: false
      } as ContentMetadata,
      validation: {
        isValid: content.length > 10,
        score: response.confidence || 0.8,
        issues: [],
        suggestions: [],
        platformCompliance: {
          twitter: content.length <= 280,
          linkedin: content.length <= 3000,
          facebook: content.length <= 63206
        }
      }
    };

    return generatedContent;
  }
} 