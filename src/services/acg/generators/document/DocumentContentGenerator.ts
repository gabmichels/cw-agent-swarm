/**
 * DocumentContentGenerator.ts - LLM-powered document content generation
 * 
 * Handles intelligent generation of document content including text documents,
 * spreadsheets, presentations, and other document types when content is missing
 * from user requests.
 */

import { ulid } from 'ulid';
import {
  ILLMContentGenerator,
  IContentGenerator,
  GeneratorDependencies,
  GeneratorConfiguration,
  HealthStatus,
  GeneratorUsageStats,
  ILLMService,
  LLMResponse
} from '../../interfaces/IContentGenerator';
import {
  ContentType,
  GenerationContext,
  GeneratedContent,
  ValidationResult,
  ValidationIssueType,
  AsyncContentGenerationResult,
  ContentData,
  ContentMetadata,
  GenerationMethod,
  ContentGenerationResult
} from '../../types/ContentGenerationTypes';
import {
  GenerationCapability,
  DOCUMENT_GENERATOR_CAPABILITIES
} from '../../types/GenerationCapabilities';
import {
  ContentGenerationError,
  ACGErrorFactory
} from '../../errors/ContentGenerationError';

export class DocumentContentGenerator implements ILLMContentGenerator {
  readonly id = 'document-content-generator';
  readonly name = 'Document Content Generator';
  readonly version = '1.0.0';
  readonly supportedTypes: readonly ContentType[] = [
    ContentType.DOCUMENT_TEXT,
    ContentType.DOCUMENT_SPREADSHEET,
    ContentType.DOCUMENT_PRESENTATION
  ] as const;
  readonly capabilities = DOCUMENT_GENERATOR_CAPABILITIES;
  readonly priority = 7;
  readonly enabled = true;

  readonly configuration: GeneratorConfiguration = {
    maxRetries: 3,
    timeoutMs: 20000,
    fallbackEnabled: true,
    cachingEnabled: true,
    validationEnabled: true,
    qualityThreshold: 0.7,
    customSettings: {
      maxDocumentLength: 10000,
      maxOutlineItems: 20,
      includeFormatting: true,
      defaultStructure: 'professional',
      antiHallucinationEnabled: true
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
      [ContentType.DOCUMENT_TEXT]: 0,
      [ContentType.DOCUMENT_SPREADSHEET]: 0,
      [ContentType.DOCUMENT_PRESENTATION]: 0
    } as Record<ContentType, number>
  };

  constructor(readonly llmService: ILLMService) { }

  async initialize(dependencies: GeneratorDependencies): Promise<void> {
    this.dependencies = dependencies;

    const isAvailable = await this.llmService.isAvailable();
    if (!isAvailable) {
      throw new Error('LLM service is not available for document content generation');
    }

    this.dependencies.logger.info('Document content generator initialized', {
      generatorId: this.id,
      supportedTypes: this.supportedTypes,
      capabilities: this.capabilities
    });
  }

  async shutdown(): Promise<void> {
    this.dependencies?.logger.info('Document content generator shutting down', {
      generatorId: this.id,
      usageStats: this.usageStats
    });
  }

  async generate(context: GenerationContext): AsyncContentGenerationResult {
    const startTime = Date.now();
    const requestId = ulid();

    try {
      this.usageStats.totalRequests++;
      await this.validateContext(context);
      const contentType = this.determineContentType(context);
      this.usageStats.contentTypeDistribution[contentType]++;

      const prompt = await this.buildPrompt(context);
      const llmResponse = await this.llmService.generateResponse(prompt, {
        maxTokens: this.getMaxTokensForType(contentType),
        temperature: 0.6,
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
          error instanceof Error ? error.message : 'Unknown error in document generation',
          {
            requestId,
            contentType: this.determineContentType(context),
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
    const maxLength = this.getMaxLengthForType(content.type);

    if (text.length > maxLength) {
      issues.push({
        type: ValidationIssueType.LENGTH_EXCEEDED,
        severity: 'high',
        message: `Content length ${text.length} exceeds maximum ${maxLength}`,
        suggestion: `Reduce content by ${text.length - maxLength} characters`
      });
    }

    if (text.length < 10) {
      issues.push({
        type: ValidationIssueType.LENGTH_TOO_SHORT,
        severity: 'high',
        message: 'Content is too short to be meaningful',
        suggestion: 'Generate more substantial content'
      });
    }

    let score = 1.0;
    for (const issue of issues) {
      switch (issue.severity) {
        case 'critical': score -= 0.4; break;
        case 'high': score -= 0.3; break;
        case 'medium': score -= 0.2; break;
        case 'low': score -= 0.1; break;
      }
    }
    score = Math.max(0, score);

    return {
      isValid: issues.length === 0 || score >= this.configuration.qualityThreshold,
      score,
      issues,
      suggestions: issues.map(i => i.suggestion).filter(Boolean) as string[],
      platformCompliance: {
        word: text.length <= 1000000,
        googleDocs: text.length <= 1000000,
        pdf: text.length <= 500000
      }
    };
  }

  async estimateGenerationTime(context: GenerationContext): Promise<number> {
    const contentType = this.determineContentType(context);
    const baseTime = 3000;

    const typeMultiplier = {
      [ContentType.DOCUMENT_TEXT]: 2.0,
      [ContentType.DOCUMENT_SPREADSHEET]: 1.5,
      [ContentType.DOCUMENT_PRESENTATION]: 1.2
    };

    const contextComplexity = Math.min(context.originalMessage.length / 150, 3);
    const multiplier = contentType in typeMultiplier ? typeMultiplier[contentType as keyof typeof typeMultiplier] : 1;
    return baseTime * multiplier * (1 + contextComplexity * 0.3);
  }

  async getHealthStatus(): Promise<HealthStatus> {
    const now = new Date();
    const llmAvailable = await this.llmService.isAvailable();

    return {
      status: llmAvailable ? 'healthy' : 'unhealthy',
      message: llmAvailable ? 'All systems operational' : 'LLM service unavailable',
      lastChecked: now,
      dependencies: {
        llmService: {
          status: llmAvailable ? 'available' : 'unavailable',
          lastChecked: now
        }
      },
      performance: {
        averageLatencyMs: this.usageStats.averageLatencyMs,
        successRate: this.usageStats.totalRequests > 0
          ? this.usageStats.successfulRequests / this.usageStats.totalRequests
          : 0,
        requestsPerMinute: 0,
        memoryUsageMB: process.memoryUsage().heapUsed / 1024 / 1024
      }
    };
  }

  async getUsageStats(): Promise<GeneratorUsageStats> {
    return { ...this.usageStats };
  }

  async buildPrompt(context: GenerationContext): Promise<string> {
    const contentType = this.determineContentType(context);
    const userMessage = context.originalMessage;
    const tone = context.userPreferences?.tone || 'professional';
    const length = context.userPreferences?.length || 'medium';

    const antiHallucinationPrompt = this.configuration.customSettings.antiHallucinationEnabled
      ? `\n\nIMPORTANT: Only use information provided in the context. If you don't have specific information, say "I don't have that information" rather than making up details.`
      : '';

    switch (contentType) {
      case ContentType.DOCUMENT_TEXT:
        return this.buildDocumentPrompt(userMessage, tone, length) + antiHallucinationPrompt;
      case ContentType.DOCUMENT_SPREADSHEET:
        return this.buildSpreadsheetPrompt(userMessage, tone) + antiHallucinationPrompt;
      case ContentType.DOCUMENT_PRESENTATION:
        return this.buildPresentationPrompt(userMessage, tone) + antiHallucinationPrompt;
      default:
        throw new Error(`Unsupported content type: ${contentType}`);
    }
  }

  async parseResponse(response: LLMResponse, context: GenerationContext): Promise<GeneratedContent> {
    const contentType = this.determineContentType(context);
    const requestId = ulid();

    let cleanedContent = response.content.trim();
    cleanedContent = this.cleanLLMResponse(cleanedContent, contentType);

    const contentData: ContentData = {
      text: cleanedContent,
      structured: {
        contentType,
        originalRequest: context.originalMessage,
        generatedAt: new Date().toISOString()
      }
    };

    const metadata: ContentMetadata = {
      generatedAt: new Date(),
      method: GenerationMethod.LLM_POWERED,
      confidence: response.confidence || 0.8,
      processingTimeMs: 0,
      tokensUsed: response.tokensUsed,
      modelUsed: response.model,
      fallbackUsed: false
    };

    return {
      id: requestId,
      type: contentType,
      content: contentData,
      metadata
    };
  }

  private async validateContext(context: GenerationContext): Promise<void> {
    if (!context.originalMessage?.trim()) {
      throw ACGErrorFactory.createInsufficientContextError({
        contentType: this.determineContentType(context),
        requiredContext: ['originalMessage'],
        providedContext: Object.keys(context)
      });
    }
  }

  private determineContentType(context: GenerationContext): ContentType {
    const message = context.originalMessage.toLowerCase();

    if (context.extractedEntities?.contentType) {
      return context.extractedEntities.contentType as ContentType;
    }

    if (message.includes('presentation') || message.includes('slide')) {
      return ContentType.DOCUMENT_PRESENTATION;
    }

    if (message.includes('spreadsheet') || message.includes('excel') || message.includes('sheet')) {
      return ContentType.DOCUMENT_SPREADSHEET;
    }

    return ContentType.DOCUMENT_TEXT;
  }

  private buildDocumentPrompt(userMessage: string, tone: string, length: string): string {
    const lengthGuidance = {
      short: 'Keep it concise (1-2 paragraphs)',
      medium: 'Moderate length (3-5 paragraphs)',
      long: 'Comprehensive (5-8 paragraphs)'
    };

    return `Generate a professional document based on this request:

User Request: "${userMessage}"

Requirements:
- ${tone} tone throughout
- ${lengthGuidance[length as keyof typeof lengthGuidance] || lengthGuidance.medium}
- Clear structure with headings if appropriate
- Professional formatting
- Factual and accurate content
- Maximum 10,000 characters

Generate the complete document content:`;
  }

  private buildSpreadsheetPrompt(userMessage: string, tone: string): string {
    return `Generate a spreadsheet structure based on this request:

User Request: "${userMessage}"

Requirements:
- Clear column headers
- Logical data organization
- ${tone} approach to naming
- Include data types for each column
- Suggest formulas if relevant
- Maximum 15 columns

Generate the spreadsheet structure:`;
  }

  private buildPresentationPrompt(userMessage: string, tone: string): string {
    return `Generate a presentation outline based on this request:

User Request: "${userMessage}"

Requirements:
- Slide-by-slide structure
- ${tone} tone
- Clear slide titles
- Key points for each slide
- Logical flow
- Include introduction and conclusion
- Maximum 15 slides

Generate the presentation outline:`;
  }

  private cleanLLMResponse(content: string, contentType: ContentType): string {
    const cleaningPatterns = [
      /^(Document:|Outline:|Structure:|Summary:)\s*/i,
      /^Here's?\s+(the|an?)\s+(document|outline|structure|summary)[:\s]*/i,
      /^Generated\s+(document|outline|structure|summary)[:\s]*/i,
      /```[^`]*```/g
    ];

    let cleaned = content;
    for (const pattern of cleaningPatterns) {
      cleaned = cleaned.replace(pattern, '');
    }

    return cleaned.trim();
  }

  private getMaxTokensForType(contentType: ContentType): number {
    const tokenLimits = {
      [ContentType.DOCUMENT_TEXT]: 2000,
      [ContentType.DOCUMENT_SPREADSHEET]: 600,
      [ContentType.DOCUMENT_PRESENTATION]: 1000
    };

    return contentType in tokenLimits ? tokenLimits[contentType as keyof typeof tokenLimits] : 1000;
  }

  private getMaxLengthForType(contentType: ContentType): number {
    const lengthLimits = {
      [ContentType.DOCUMENT_TEXT]: 10000,
      [ContentType.DOCUMENT_SPREADSHEET]: 2000,
      [ContentType.DOCUMENT_PRESENTATION]: 4000
    };

    return contentType in lengthLimits ? lengthLimits[contentType as keyof typeof lengthLimits] : 5000;
  }
} 