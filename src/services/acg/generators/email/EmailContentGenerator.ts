import { ulid } from 'ulid';
import {
  ContentType,
  GenerationContext,
  GeneratedContent,
  ValidationResult,
  ContentData,
  ContentMetadata,
  GenerationMethod,
  UserContentPreferences,
  AsyncContentGenerationResult,
  ContentGenerationResult
} from '../../types/ContentGenerationTypes';
import {
  GenerationCapability
} from '../../types/GenerationCapabilities';
import {
  ILLMContentGenerator,
  ILLMService,
  LLMResponse,
  GeneratorDependencies,
  GeneratorConfiguration,
  HealthStatus,
  GeneratorUsageStats,
  LLMGenerationOptions
} from '../../interfaces/IContentGenerator';
import { ACGErrorFactory } from '../../errors/ContentGenerationError';

/**
 * Email content generator using LLM for intelligent email content creation
 * Supports EMAIL_SUBJECT, EMAIL_BODY, EMAIL_REPLY, EMAIL_FORWARD content types
 */
export class EmailContentGenerator implements ILLMContentGenerator {
  readonly id = 'email-llm-generator';
  readonly name = 'Email Content Generator';
  readonly version = '1.0.0';
  readonly supportedTypes: readonly ContentType[] = [
    ContentType.EMAIL_SUBJECT,
    ContentType.EMAIL_BODY,
    ContentType.EMAIL_REPLY,
    ContentType.EMAIL_FORWARD
  ];
  readonly capabilities: readonly GenerationCapability[] = [
    GenerationCapability.LLM_POWERED,
    GenerationCapability.CONTEXT_AWARE,
    GenerationCapability.USER_PREFERENCE_AWARE,
    GenerationCapability.PLATFORM_AWARE
  ];
  readonly priority = 80;
  readonly enabled = true;
  readonly configuration: GeneratorConfiguration;

  // Dependencies
  private dependencies?: GeneratorDependencies;
  private usageStats: GeneratorUsageStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageLatencyMs: 0,
    averageConfidenceScore: 0,
    cacheHitRate: 0,
    contentTypeDistribution: {
      [ContentType.EMAIL_SUBJECT]: 0,
      [ContentType.EMAIL_BODY]: 0,
      [ContentType.EMAIL_REPLY]: 0,
      [ContentType.EMAIL_FORWARD]: 0,
      [ContentType.DOCUMENT_TEXT]: 0,
      [ContentType.DOCUMENT_SPREADSHEET]: 0,
      [ContentType.DOCUMENT_PRESENTATION]: 0,
      [ContentType.SOCIAL_POST]: 0,
      [ContentType.SOCIAL_COMMENT]: 0,
      [ContentType.SOCIAL_MESSAGE]: 0,
      [ContentType.CALENDAR_EVENT]: 0,
      [ContentType.CALENDAR_AGENDA]: 0,
      [ContentType.CALENDAR_INVITE]: 0,
      [ContentType.CUSTOM_TEMPLATE]: 0
    }
  };

  constructor(config?: Partial<GeneratorConfiguration>) {
    this.configuration = {
      maxRetries: 3,
      timeoutMs: 30000,
      fallbackEnabled: true,
      cachingEnabled: true,
      validationEnabled: true,
      qualityThreshold: 0.7,
      customSettings: {},
      ...config
    };
  }

  get llmService(): ILLMService {
    if (!this.dependencies?.llmService) {
      throw new Error('LLM service not initialized');
    }
    return this.dependencies.llmService;
  }

  async initialize(dependencies: GeneratorDependencies): Promise<void> {
    this.dependencies = dependencies;

    // Verify LLM service is available
    if (!dependencies.llmService) {
      throw new Error('LLM service is required for EmailContentGenerator');
    }

    const isAvailable = await dependencies.llmService.isAvailable();
    if (!isAvailable) {
      throw new Error('LLM service is not available');
    }

    dependencies.logger.info('EmailContentGenerator initialized', {
      generatorId: this.id,
      supportedTypes: this.supportedTypes
    });
  }

  async generate(context: GenerationContext): AsyncContentGenerationResult {
    const startTime = Date.now();
    this.usageStats.totalRequests++;

    try {
      // Extract content type from context (should be passed in metadata)
      const contentType = this.extractContentType(context);

      if (!this.supportedTypes.includes(contentType)) {
        throw ACGErrorFactory.createGeneratorNotFoundError({
          contentType,
          requestedCapabilities: [],
          availableGenerators: [this.id]
        });
      }

      // Update distribution stats
      this.usageStats.contentTypeDistribution[contentType]++;

      // Build prompt based on content type
      const prompt = await this.buildPrompt(context);

      // Generate content using LLM
      const llmOptions: LLMGenerationOptions = {
        maxTokens: this.getTokenLimit(contentType),
        temperature: 0.7,
        timeoutMs: this.configuration.timeoutMs
      };

      const llmResponse = await this.llmService.generateResponse(prompt, llmOptions);

      // Parse response into structured content
      const generatedContent = await this.parseResponse(llmResponse, context);

      // Update success stats
      this.usageStats.successfulRequests++;
      this.usageStats.averageLatencyMs =
        (this.usageStats.averageLatencyMs * (this.usageStats.successfulRequests - 1) +
          (Date.now() - startTime)) / this.usageStats.successfulRequests;

      return {
        success: true,
        data: generatedContent,
        metrics: {
          requestId: ulid(),
          startTime: new Date(startTime),
          endTime: new Date(),
          durationMs: Date.now() - startTime,
          memoryUsed: process.memoryUsage().heapUsed,
          cacheHit: false,
          retryCount: 0,
          success: true
        }
      };

    } catch (error) {
      this.usageStats.failedRequests++;

      const generationError = error instanceof Error
        ? ACGErrorFactory.createLLMError(error.message, {
          cause: error
        })
        : ACGErrorFactory.createLLMError('Unknown generation error', {});

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
          requestId: ulid(),
          startTime: new Date(startTime),
          endTime: new Date(),
          durationMs: Date.now() - startTime,
          memoryUsed: process.memoryUsage().heapUsed,
          cacheHit: false,
          retryCount: 0,
          success: false
        }
      };
    }
  }

  async buildPrompt(context: GenerationContext): Promise<string> {
    const contentType = this.extractContentType(context);

    // Extract key information from context
    const originalMessage = context.originalMessage;
    const entities = context.extractedEntities;
    const userPrefs = context.userPreferences;
    const platformConstraints = context.platformConstraints;

    // Build prompt based on content type
    switch (contentType) {
      case ContentType.EMAIL_SUBJECT:
        return this.buildSubjectPrompt(originalMessage, entities, userPrefs, platformConstraints);

      case ContentType.EMAIL_BODY:
        return this.buildBodyPrompt(originalMessage, entities, userPrefs, platformConstraints);

      case ContentType.EMAIL_REPLY:
        return this.buildReplyPrompt(originalMessage, entities, userPrefs, context.conversationHistory as any[]);

      case ContentType.EMAIL_FORWARD:
        return this.buildForwardPrompt(originalMessage, entities, userPrefs);

      default:
        throw new Error(`Unsupported content type: ${contentType}`);
    }
  }

  async parseResponse(response: LLMResponse, context: GenerationContext): Promise<GeneratedContent> {
    const contentType = this.extractContentType(context);
    let content = response.content.trim();

    // Post-process email body content to ensure greeting is present
    if (contentType === ContentType.EMAIL_BODY) {
      content = this.ensureEmailGreeting(content, context);
    }

    // Convert to HTML if needed
    const htmlContent = this.convertToHtml(content, contentType);

    return {
      id: ulid(),
      type: contentType,
      content: {
        text: content,
        html: htmlContent
      },
      metadata: {
        generatedAt: new Date(),
        method: GenerationMethod.LLM_POWERED,
        confidence: this.calculateConfidence(response, context),
        processingTimeMs: 0, // Will be calculated by caller
        tokensUsed: response.tokensUsed,
        modelUsed: response.model,
        fallbackUsed: false
      }
    };
  }

  /**
   * Ensure email body has proper greeting
   */
  private ensureEmailGreeting(content: string, context: GenerationContext): string {
    const entities = context.extractedEntities || {};
    const userPrefs = context.userPreferences || {} as UserContentPreferences;
    const tone = userPrefs.tone || 'professional';

    // Extract recipient information
    const recipients = entities.recipient || entities.recipients;
    const recipientEmail = Array.isArray(recipients) ? recipients[0] : recipients;
    const recipientName = this.extractNameFromEmail(recipientEmail) || 'there';

    // Get expected greeting
    const greetingStyle = this.getGreetingStyle(tone, recipientName);
    const expectedGreeting = greetingStyle.greeting;

    // Check if content already starts with a proper greeting
    const lines = content.split('\n');
    const firstLine = lines[0]?.trim();

    // Common greeting patterns to check for
    const greetingPatterns = [
      /^(Dear|Hello|Hi|Hey)\s+/i,
      /^(Good morning|Good afternoon|Good evening)/i
    ];

    const hasGreeting = greetingPatterns.some(pattern => pattern.test(firstLine || ''));

    // If no greeting found, prepend the expected greeting
    if (!hasGreeting) {
      // Log the addition of greeting (using console.log since logger is not available in this context)
      console.log('Adding missing greeting to email body', {
        expectedGreeting,
        firstLine,
        tone
      });

      // Add greeting with proper spacing
      content = `${expectedGreeting}\n\n${content}`;
    }

    return content;
  }

  async canGenerate(contentType: ContentType, context: GenerationContext): Promise<boolean> {
    if (!this.supportedTypes.includes(contentType)) {
      return false;
    }

    // Check if we have sufficient context
    if (!context.originalMessage?.trim()) {
      return false;
    }

    // Check if LLM service is available
    if (!this.dependencies?.llmService) {
      return false;
    }

    return await this.dependencies.llmService.isAvailable();
  }

  async validate(content: GeneratedContent): Promise<ValidationResult> {
    if (!this.dependencies?.validator) {
      // Basic validation without validator
      return {
        isValid: content.content.text ? content.content.text.length > 0 : false,
        score: content.content.text ? 0.8 : 0,
        issues: [],
        suggestions: [],
        platformCompliance: {}
      };
    }

    return await this.dependencies.validator.validate(content);
  }

  async estimateGenerationTime(context: GenerationContext): Promise<number> {
    const contentType = this.extractContentType(context);
    const baseTime = 2000; // 2 seconds base

    // Calculate complexity based on context
    const contextComplexity = this.calculateContextComplexity(context);

    // Type-specific multipliers
    const typeMultiplier: Record<string, number> = {
      [ContentType.EMAIL_SUBJECT]: 0.5,
      [ContentType.EMAIL_BODY]: 1.5,
      [ContentType.EMAIL_REPLY]: 1.2,
      [ContentType.EMAIL_FORWARD]: 1.0
    };

    return baseTime * (typeMultiplier[contentType] || 1) * (1 + contextComplexity * 0.3);
  }

  async shutdown(): Promise<void> {
    this.dependencies?.logger.info('EmailContentGenerator shutting down', {
      generatorId: this.id,
      stats: this.usageStats
    });
  }

  async getHealthStatus(): Promise<HealthStatus> {
    const isLLMAvailable = this.dependencies?.llmService
      ? await this.dependencies.llmService.isAvailable()
      : false;

    const status = isLLMAvailable ? 'healthy' : 'unhealthy';

    return {
      status,
      message: isLLMAvailable ? 'All systems operational' : 'LLM service unavailable',
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
          : 0,
        requestsPerMinute: 0, // Would need time-windowed tracking
        memoryUsageMB: process.memoryUsage().heapUsed / 1024 / 1024
      }
    };
  }

  async getUsageStats(): Promise<GeneratorUsageStats> {
    return { ...this.usageStats };
  }

  // ===== Private Helper Methods =====

  private extractContentType(context: GenerationContext): ContentType {
    // Try to extract from context metadata or entities
    const typeHint = context.extractedEntities?.contentType as ContentType;
    if (typeHint && this.supportedTypes.includes(typeHint)) {
      return typeHint;
    }

    // Default to email body if not specified
    return ContentType.EMAIL_BODY;
  }

  private buildSubjectPrompt(
    originalMessage: string,
    entities: Record<string, unknown>,
    userPrefs?: any,
    platformConstraints?: any
  ): string {
    const tone = userPrefs?.tone || 'professional';
    const maxLength = platformConstraints?.maxLength || 78; // Standard email subject length

    return `Generate a concise and compelling email subject line based on the following request:

Request: "${originalMessage}"

Email details:
${JSON.stringify(entities, null, 2)}

Requirements:
- Tone: ${tone}
- Maximum length: ${maxLength} characters
- Be specific and actionable
- Avoid spam-like words (avoid "FREE", "URGENT", excessive caps)
- Make it clear and professional
- If the request mentions specific topics (like Bitcoin, investment, etc.), include them
- If asking for multiple points/reasons, hint at that in the subject
- Make it compelling enough to encourage opening

Examples of good subjects:
- "10 Key Reasons Bitcoin Represents a Strong Investment Opportunity"
- "Investment Analysis: Why Bitcoin Deserves Your Consideration"
- "Strategic Investment Insights: The Bitcoin Opportunity"

Generate only the subject line, no additional text, quotes, or formatting.`;
  }

  private buildBodyPrompt(
    originalMessage: string,
    entities: Record<string, unknown>,
    userPrefs?: any,
    platformConstraints?: any
  ): string {
    const tone = userPrefs?.tone || 'professional';
    const length = userPrefs?.length || 'medium';
    const style = userPrefs?.style || 'detailed';

    // Extract recipient information
    const recipients = entities.recipient || entities.recipients;
    const recipientEmail = Array.isArray(recipients) ? recipients[0] : recipients;
    const recipientName = this.extractNameFromEmail(recipientEmail) || 'there';

    // Extract sender information for personalization
    const senderName = String(entities.senderName || entities.senderFirstName || 'Assistant');
    const senderFirstName = String(entities.senderFirstName || 'Assistant');
    const senderLastName = String(entities.senderLastName || '');
    const fullSenderName = senderFirstName && senderLastName ?
      `${senderFirstName} ${senderLastName}` :
      senderName;

    // Tone-specific greeting and closing
    const greetingStyle = this.getGreetingStyle(tone, recipientName);
    const closingStyle = this.getClosingStyle(tone, fullSenderName);

    return `Generate a ${tone}, well-formatted email body based on the following request:

Request: "${originalMessage}"

Email details extracted:
${JSON.stringify(entities, null, 2)}

MANDATORY FORMATTING REQUIREMENTS - MUST BE FOLLOWED EXACTLY:
1. MUST start with the exact greeting: "${greetingStyle.greeting}"
2. MUST use clear paragraph breaks (double line breaks between paragraphs)
3. MUST structure content with logical flow and clear sections
4. MUST use numbered lists or bullet points when presenting multiple items
5. MUST include proper spacing for readability
6. MUST end with the exact closing: "${closingStyle.closing}"

EMAIL SPECIFICATIONS:
- Tone: ${tone}
- Length: ${length}
- Style: ${style}

CONTENT REQUIREMENTS:
- Be clear, concise, and actionable
- Use proper email etiquette appropriate for ${tone} tone
- If the request asks for multiple points (like "10 reasons"), format them as a numbered list
- Include context and background when appropriate
- Make it engaging and informative
- Sound like it's coming from ${senderFirstName} personally

TONE-SPECIFIC GUIDELINES:
${this.getToneGuidelines(tone)}

EXACT REQUIRED FORMAT (DO NOT DEVIATE):
${greetingStyle.greeting}

[Opening paragraph with context - make it personal and relevant]

[Main content with proper paragraph breaks]

If listing multiple items:
1. First point with explanation
2. Second point with explanation
3. [etc.]

[Closing paragraph that sounds natural and personal]

${closingStyle.closing}

CRITICAL: You MUST start with "${greetingStyle.greeting}" and end with "${closingStyle.closing}" exactly as shown. Generate only the email body content, no subject line. Ensure proper formatting with line breaks and paragraph structure.`;
  }

  /**
   * Extract name from email address for personalization
   */
  private extractNameFromEmail(email: string | undefined): string | undefined {
    if (!email || typeof email !== 'string') return undefined;

    // Extract name part before @ symbol
    const namePart = email.split('@')[0];

    // Convert common patterns to readable names
    if (namePart) {
      // Handle patterns like "john.doe", "john_doe", "johndoe"
      const name = namePart
        .replace(/[._-]/g, ' ')
        .split(' ')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');

      return name;
    }

    return undefined;
  }

  /**
   * Get tone-appropriate greeting
   */
  private getGreetingStyle(tone: string, recipientName: string): { greeting: string } {
    const name = recipientName === 'there' ? recipientName : recipientName;

    switch (tone) {
      case 'formal':
        return { greeting: `Dear ${name === 'there' ? 'Sir/Madam' : name},` };
      case 'casual':
        return { greeting: `Hey ${name}!` };
      case 'friendly':
        return { greeting: `Hi ${name},` };
      case 'professional':
      default:
        return { greeting: `Hello ${name},` };
    }
  }

  /**
   * Get tone-appropriate closing
   */
  private getClosingStyle(tone: string, senderName: string): { closing: string } {
    switch (tone) {
      case 'formal':
        return { closing: `Respectfully yours,\n${senderName}` };
      case 'casual':
        return { closing: `Cheers,\n${senderName}` };
      case 'friendly':
        return { closing: `Warm regards,\n${senderName}` };
      case 'professional':
      default:
        return { closing: `Best regards,\n${senderName}` };
    }
  }

  /**
   * Get tone-specific writing guidelines
   */
  private getToneGuidelines(tone: string): string {
    switch (tone) {
      case 'formal':
        return `- Use formal language and complete sentences
- Avoid contractions (use "do not" instead of "don't")
- Be respectful and courteous
- Use proper titles and formal address`;

      case 'casual':
        return `- Use conversational language and contractions
- Be friendly and approachable
- Keep it concise and to the point
- Use everyday language`;

      case 'friendly':
        return `- Be warm and personable
- Show genuine interest and care
- Use positive language
- Be helpful and supportive`;

      case 'professional':
      default:
        return `- Be clear and direct
- Maintain professional courtesy
- Focus on value and benefits
- Be informative and helpful`;
    }
  }

  private buildReplyPrompt(
    originalMessage: string,
    entities: Record<string, unknown>,
    userPrefs?: any,
    conversationHistory?: any[]
  ): string {
    const tone = userPrefs?.tone || 'professional';
    const historyContext = conversationHistory?.slice(-3) || [];

    return `Generate a professional email reply based on the following:

Original request: "${originalMessage}"

Context from conversation:
${historyContext.map(entry => `${entry.sender}: ${entry.content}`).join('\n')}

Requirements:
- Tone: ${tone}
- Reference the previous conversation appropriately
- Be responsive to the specific points raised
- Include proper greeting and closing
- Be concise but complete

Generate only the reply email body.`;
  }

  private buildForwardPrompt(
    originalMessage: string,
    entities: Record<string, unknown>,
    userPrefs?: any
  ): string {
    const tone = userPrefs?.tone || 'professional';

    return `Generate a forwarding message for an email based on:

Request: "${originalMessage}"

Requirements:
- Tone: ${tone}
- Add appropriate context for why you're forwarding
- Include a brief introduction
- Be professional and clear

Generate only the forwarding message text.`;
  }

  private convertToHtml(text: string, contentType: ContentType): string {
    // Enhanced text to HTML conversion for better email formatting
    let html = text.trim();

    // Handle numbered lists (1. 2. 3. etc.)
    html = html.replace(/^(\d+\.\s+)(.+)$/gm, '<li>$2</li>');
    html = html.replace(/(<li>[\s\S]*<\/li>)/g, '<ol>$1</ol>');

    // Handle bullet points (- * • etc.)
    html = html.replace(/^[\-\*•]\s+(.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>[\s\S]*<\/li>)/g, '<ul>$1</ul>');

    // Convert double line breaks to paragraph breaks
    html = html.replace(/\n\n+/g, '</p><p>');

    // Convert single line breaks to <br> tags
    html = html.replace(/\n/g, '<br>');

    // Wrap in paragraph tags
    html = '<p>' + html + '</p>';

    // Clean up empty paragraphs and fix list formatting
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p>(<[ou]l>)/g, '$1');
    html = html.replace(/(<\/[ou]l>)<\/p>/g, '$1');

    // Handle email signatures (lines starting with "Best regards," etc.)
    html = html.replace(/<p>(Best regards,|Sincerely,|Kind regards,|Thank you,)<br>/gi, '<p><strong>$1</strong><br>');

    return html;
  }

  private calculateContextComplexity(context: GenerationContext): number {
    let complexity = 0;

    // Message length factor
    complexity += Math.min(context.originalMessage.length / 1000, 0.5);

    // Entity count factor
    complexity += Math.min(Object.keys(context.extractedEntities || {}).length / 10, 0.3);

    // Conversation history factor
    complexity += Math.min((context.conversationHistory?.length || 0) / 5, 0.2);

    return complexity;
  }

  private getTokenLimit(contentType: ContentType): number {
    const tokenLimits: Record<string, number> = {
      [ContentType.EMAIL_SUBJECT]: 20,
      [ContentType.EMAIL_BODY]: 500,
      [ContentType.EMAIL_REPLY]: 400,
      [ContentType.EMAIL_FORWARD]: 200
    };

    return tokenLimits[contentType] || 300;
  }

  /**
   * Calculate confidence score for generated content
   */
  private calculateConfidence(response: LLMResponse, context: GenerationContext): number {
    let baseConfidence = response.confidence || 0.8;

    // Adjust confidence based on context quality
    const contextComplexity = this.calculateContextComplexity(context);

    // Higher complexity can reduce confidence slightly
    const complexityAdjustment = Math.max(0, 0.1 - contextComplexity * 0.05);

    // Ensure confidence is within valid range
    return Math.max(0.1, Math.min(1.0, baseConfidence + complexityAdjustment));
  }
}