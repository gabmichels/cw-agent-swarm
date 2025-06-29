/**
 * WorkspaceACGIntegration.ts - Integration layer for ACG with workspace commands
 * 
 * This service integrates the Agent Content Generation (ACG) system with the existing
 * WorkspaceNLPProcessor to handle content generation for missing email subjects, bodies,
 * and other workspace content when users provide incomplete requests.
 */

import { ulid } from 'ulid';
import {
  WorkspaceCommand,
  WorkspaceCommandType,
  WorkspaceNLPProcessor
} from '../../workspace/integration/WorkspaceNLPProcessor';
import { IContentGenerationService } from '../interfaces/IContentGenerationService';
import {
  ContentType,
  GenerationContext,
  GeneratedContent,
  GenerationRequest
} from '../types/ContentGenerationTypes';
import { ContentGenerationError, ACGErrorFactory } from '../errors/ContentGenerationError';
import { createLogger } from '../../../lib/logging/winston-logger';

export interface ACGEnhancedWorkspaceCommand extends WorkspaceCommand {
  /** Whether content generation was applied */
  contentGenerated?: boolean;
  /** Generated content details */
  generatedContent?: {
    subject?: GeneratedContent;
    body?: GeneratedContent;
    reply?: GeneratedContent;
  };
  /** Whether the command needs user confirmation due to generated content */
  requiresConfirmation?: boolean;
}

export interface ACGIntegrationOptions {
  /** Whether to auto-generate missing content */
  enableAutoGeneration?: boolean;
  /** Whether to require user confirmation for generated content */
  requireConfirmation?: boolean;
  /** Maximum generation time in milliseconds */
  maxGenerationTimeMs?: number;
  /** Fallback to original command if generation fails */
  fallbackOnError?: boolean;
}

/**
 * Integration service for ACG with workspace operations
 */
export class WorkspaceACGIntegration {
  private readonly logger: ReturnType<typeof createLogger>;

  constructor(
    private readonly nlpProcessor: WorkspaceNLPProcessor,
    private readonly contentGenerationService: IContentGenerationService,
    private readonly options: ACGIntegrationOptions = {}
  ) {
    this.logger = createLogger({
      moduleId: 'workspace-acg-integration'
    });

    // Set default options
    this.options = {
      enableAutoGeneration: true,
      requireConfirmation: false,
      maxGenerationTimeMs: 30000,
      fallbackOnError: true,
      ...options
    };
  }

  /**
   * Parse workspace command with ACG enhancement
   * This is the main integration point that enhances the existing NLP processor
   */
  async parseCommandWithACG(
    text: string,
    userId?: string,
    agentId?: string
  ): Promise<ACGEnhancedWorkspaceCommand | null> {
    const startTime = Date.now();
    const requestId = ulid();

    try {
      this.logger.info('Starting ACG-enhanced command parsing', {
        requestId,
        textLength: text.length,
        userId,
        agentId
      });

      // First, parse with the existing NLP processor
      const baseCommand = await this.nlpProcessor.parseCommand(text);

      if (!baseCommand) {
        this.logger.debug('No workspace command detected', { requestId, text });
        return null;
      }

      // Check if this command type benefits from content generation
      if (!this.shouldEnhanceCommand(baseCommand)) {
        this.logger.debug('Command does not require ACG enhancement', {
          requestId,
          commandType: baseCommand.type
        });
        return baseCommand as ACGEnhancedWorkspaceCommand;
      }

      // Check if content generation is needed
      const generationNeeds = this.analyzeGenerationNeeds(baseCommand);

      if (generationNeeds.length === 0) {
        this.logger.debug('No content generation needed', {
          requestId,
          commandType: baseCommand.type,
          entities: baseCommand.entities
        });
        return baseCommand as ACGEnhancedWorkspaceCommand;
      }

      // Generate missing content if auto-generation is enabled
      if (!this.options.enableAutoGeneration) {
        this.logger.debug('Auto-generation disabled, returning original command', {
          requestId,
          generationNeeds
        });
        return baseCommand as ACGEnhancedWorkspaceCommand;
      }

      const enhancedCommand = await this.generateMissingContent(
        baseCommand,
        generationNeeds,
        requestId,
        userId,
        agentId
      );

      const durationMs = Date.now() - startTime;
      this.logger.info('ACG-enhanced command parsing completed', {
        requestId,
        commandType: baseCommand.type,
        generationNeeds,
        contentGenerated: enhancedCommand.contentGenerated,
        durationMs
      });

      return enhancedCommand;

    } catch (error) {
      const durationMs = Date.now() - startTime;

      this.logger.error('ACG command parsing failed', {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs
      });

      // Fallback to original command if enabled
      if (this.options.fallbackOnError) {
        const baseCommand = await this.nlpProcessor.parseCommand(text);
        return baseCommand as ACGEnhancedWorkspaceCommand;
      }

      throw error;
    }
  }

  /**
   * Determine if a command should be enhanced with content generation
   */
  private shouldEnhanceCommand(command: WorkspaceCommand): boolean {
    const enhancedCommandTypes = [
      WorkspaceCommandType.SEND_EMAIL,
      WorkspaceCommandType.REPLY_EMAIL,
      WorkspaceCommandType.FORWARD_EMAIL
    ];

    return enhancedCommandTypes.includes(command.type);
  }

  /**
   * Analyze what content needs to be generated for a command
   */
  private analyzeGenerationNeeds(command: WorkspaceCommand): ContentType[] {
    const needs: ContentType[] = [];

    switch (command.type) {
      case WorkspaceCommandType.SEND_EMAIL:
        if (!command.entities.subject) {
          needs.push(ContentType.EMAIL_SUBJECT);
        }
        if (!command.entities.body) {
          needs.push(ContentType.EMAIL_BODY);
        }
        break;

      case WorkspaceCommandType.REPLY_EMAIL:
        if (!command.entities.body) {
          needs.push(ContentType.EMAIL_REPLY);
        }
        if (!command.entities.subject) {
          needs.push(ContentType.EMAIL_SUBJECT);
        }
        break;

      case WorkspaceCommandType.FORWARD_EMAIL:
        if (!command.entities.body) {
          needs.push(ContentType.EMAIL_FORWARD);
        }
        break;
    }

    return needs;
  }

  /**
   * Generate missing content for a workspace command
   */
  private async generateMissingContent(
    baseCommand: WorkspaceCommand,
    generationNeeds: ContentType[],
    requestId: string,
    userId?: string,
    agentId?: string
  ): Promise<ACGEnhancedWorkspaceCommand> {
    const enhancedCommand: ACGEnhancedWorkspaceCommand = {
      ...baseCommand,
      contentGenerated: false,
      generatedContent: {},
      requiresConfirmation: this.options.requireConfirmation
    };

    try {
      // Generate content for each needed type
      for (const contentType of generationNeeds) {
        const generationContext = this.buildGenerationContext(
          baseCommand,
          contentType,
          userId,
          agentId
        );

        const generationRequest: GenerationRequest = {
          id: ulid(),
          agentId: agentId || 'system',
          toolId: 'workspace-email',
          contentType,
          context: generationContext,
          priority: 5,
          metadata: {
            createdAt: new Date(),
            userId: userId || 'system',
            source: 'nlp_detected',
            retryCount: 0
          }
        };

        this.logger.debug('Generating content', {
          requestId,
          contentType,
          generationRequestId: generationRequest.id
        });

        const result = await this.contentGenerationService.generateContent(generationRequest);

        if (result.success) {
          if (result.data) {
            // Apply generated content to the command
            this.applyGeneratedContent(enhancedCommand, contentType, result.data);
            enhancedCommand.contentGenerated = true;

            this.logger.info('Content generated successfully', {
              requestId,
              contentType,
              generationRequestId: generationRequest.id,
              confidence: result.data.metadata.confidence
            });
          } else {
            this.logger.warn('Content generation succeeded but no data returned', {
              requestId,
              contentType
            });
          }
        } else {
          this.logger.warn('Content generation failed', {
            requestId,
            contentType,
            error: result.error.message
          });

          // Continue with other content types - partial generation is acceptable
        }
      }

      return enhancedCommand;

    } catch (error) {
      this.logger.error('Content generation process failed', {
        requestId,
        generationNeeds,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Return enhanced command with whatever content was generated
      return enhancedCommand;
    }
  }

  /**
   * Build generation context from workspace command
   */
  private buildGenerationContext(
    command: WorkspaceCommand,
    contentType: ContentType,
    userId?: string,
    agentId?: string
  ): GenerationContext {
    // Detect tone from the original message
    const detectedTone = this.detectToneFromMessage(command.originalText);

    // Get user information for personalization
    const userInfo = this.getUserInfo(userId);

    return {
      originalMessage: command.originalText,
      extractedEntities: {
        contentType: contentType,
        recipient: command.entities.recipients,
        subject: command.entities.subject,
        action: command.entities.action,
        // Add user info for personalization
        senderName: userInfo.displayName || userInfo.firstName || userInfo.username,
        senderFirstName: userInfo.firstName,
        senderLastName: userInfo.lastName,
        senderEmail: userInfo.email
      },
      userPreferences: {
        tone: detectedTone,
        length: 'medium',
        style: 'detailed',
        includeEmojis: false,
        language: 'en'
      },
      conversationHistory: [], // Could be enhanced with actual history
    };
  }

  /**
   * Detect tone from user message
   */
  private detectToneFromMessage(message: string): 'professional' | 'casual' | 'friendly' | 'formal' {
    const lowerMessage = message.toLowerCase();

    // Formal indicators
    if (lowerMessage.includes('please') && lowerMessage.includes('kindly') ||
      lowerMessage.includes('would you') ||
      lowerMessage.includes('i would like to') ||
      lowerMessage.includes('formal') ||
      lowerMessage.includes('official')) {
      return 'formal';
    }

    // Casual indicators
    if (lowerMessage.includes('hey') ||
      lowerMessage.includes('sup') ||
      lowerMessage.includes('casual') ||
      lowerMessage.includes('quick') ||
      lowerMessage.includes('just') ||
      lowerMessage.includes('can you') && !lowerMessage.includes('please')) {
      return 'casual';
    }

    // Friendly indicators
    if (lowerMessage.includes('friendly') ||
      lowerMessage.includes('warm') ||
      lowerMessage.includes('thanks') ||
      lowerMessage.includes('appreciate')) {
      return 'friendly';
    }

    // Default to professional
    return 'professional';
  }

  /**
   * Get user information for personalization
   */
  private getUserInfo(userId?: string): any {
    try {
      // Import getCurrentUser dynamically to avoid circular dependencies
      const { getCurrentUser } = require('../../../lib/user');
      return getCurrentUser();
    } catch (error) {
      this.logger.debug('Failed to get user info, using defaults', { error });
      return {
        username: 'User',
        displayName: 'User',
        firstName: 'User',
        lastName: '',
        email: undefined
      };
    }
  }

  /**
   * Apply generated content to the enhanced command
   */
  private applyGeneratedContent(
    command: ACGEnhancedWorkspaceCommand,
    contentType: ContentType,
    generatedContent: GeneratedContent
  ): void {
    // Store the generated content for reference
    if (!command.generatedContent) {
      command.generatedContent = {};
    }

    // Apply to the command entities
    switch (contentType) {
      case ContentType.EMAIL_SUBJECT:
        command.entities.subject = generatedContent.content.text;
        command.generatedContent.subject = generatedContent;
        break;

      case ContentType.EMAIL_BODY:
        command.entities.body = generatedContent.content.text;
        command.generatedContent.body = generatedContent;
        break;

      case ContentType.EMAIL_REPLY:
        command.entities.body = generatedContent.content.text;
        command.generatedContent.reply = generatedContent;
        break;

      case ContentType.EMAIL_FORWARD:
        command.entities.body = generatedContent.content.text;
        command.generatedContent.reply = generatedContent;
        break;
    }

    this.logger.debug('Applied generated content to command', {
      contentType,
      contentLength: generatedContent.content.text?.length || 0,
      confidence: generatedContent.metadata.confidence
    });
  }

  /**
   * Get a human-readable summary of what content was generated
   */
  getGenerationSummary(command: ACGEnhancedWorkspaceCommand): string | null {
    if (!command.contentGenerated || !command.generatedContent) {
      return null;
    }

    const generated: string[] = [];

    if (command.generatedContent.subject) {
      generated.push('email subject');
    }
    if (command.generatedContent.body) {
      generated.push('email body');
    }
    if (command.generatedContent.reply) {
      generated.push('email reply');
    }

    if (generated.length === 0) {
      return null;
    }

    const generatedText = generated.length === 1
      ? generated[0]
      : generated.slice(0, -1).join(', ') + ' and ' + generated[generated.length - 1];

    return `I generated the ${generatedText} for you based on your request.`;
  }

  /**
   * Validate that generated content meets quality standards
   */
  async validateGeneratedContent(command: ACGEnhancedWorkspaceCommand): Promise<{
    isValid: boolean;
    issues: string[];
    suggestions: string[];
  }> {
    const issues: string[] = [];
    const suggestions: string[] = [];

    if (!command.generatedContent) {
      return { isValid: true, issues, suggestions };
    }

    // Check subject quality
    if (command.generatedContent.subject) {
      const subject = command.generatedContent.subject.content.text;
      if (!subject || subject.length < 5) {
        issues.push('Generated email subject is too short');
        suggestions.push('Consider providing more context for subject generation');
      }
      if (subject && subject.length > 100) {
        issues.push('Generated email subject is too long');
        suggestions.push('Email subjects should be concise');
      }
    }

    // Check body quality
    if (command.generatedContent.body) {
      const body = command.generatedContent.body.content.text;
      if (!body || body.length < 20) {
        issues.push('Generated email body is too short');
        suggestions.push('Consider providing more details for content generation');
      }
    }

    // Check confidence scores
    for (const [type, content] of Object.entries(command.generatedContent)) {
      if (content && content.metadata.confidence < 0.6) {
        issues.push(`Generated ${type} has low confidence score`);
        suggestions.push(`Consider reviewing the generated ${type} before sending`);
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
      suggestions
    };
  }

  /**
   * Get available workspace tools for an agent
   * Delegates to the underlying workspace tools system
   */
  async getAvailableTools(agentId: string): Promise<any[]> {
    try {
      // Import and create workspace tools to get available tools
      const { WorkspaceAgentTools } = await import('../../workspace/tools/WorkspaceAgentTools');
      const workspaceTools = new WorkspaceAgentTools();
      return await workspaceTools.getAvailableTools(agentId);
    } catch (error) {
      this.logger.error('Failed to get available workspace tools from ACG integration:', {
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }
} 