/**
 * Cross-Agent Task Handlers
 * 
 * Automatic handlers for common tool delegation requests between agents.
 * Following IMPLEMENTATION_GUIDELINES.md: ULID, strict typing, DI, pure functions, immutability
 */

import { ulid } from 'ulid';
import { StructuredId } from '../../../types/entity-identifier';
import {
  ToolDelegationRequest,
  ToolDelegationResponse,
  ToolDelegationStatus,
  ToolCapabilityCategory,
  createToolDelegationResponse,
  ToolDelegationError
} from '../delegation/ToolDelegationProtocol';

/**
 * Email task parameters
 */
export interface EmailTaskParameters {
  readonly to: string | readonly string[];
  readonly cc?: string | readonly string[];
  readonly bcc?: string | readonly string[];
  readonly subject: string;
  readonly body: string;
  readonly attachments?: readonly {
    filename: string;
    content: string;
    contentType: string;
  }[];
  readonly priority?: 'low' | 'normal' | 'high';
  readonly replyTo?: string;
}

/**
 * Social media task parameters
 */
export interface SocialMediaTaskParameters {
  readonly content: string;
  readonly platforms: readonly string[];
  readonly images?: readonly string[];
  readonly hashtags?: readonly string[];
  readonly mentions?: readonly string[];
  readonly scheduleTime?: Date;
  readonly visibility?: 'public' | 'private' | 'unlisted';
}

/**
 * Workspace task parameters
 */
export interface WorkspaceTaskParameters {
  readonly action: string;
  readonly parameters: Readonly<Record<string, unknown>>;
  readonly workspace: string;
  readonly connectionId?: string;
}

/**
 * Task execution result
 */
export interface TaskExecutionResult {
  readonly success: boolean;
  readonly result?: Readonly<Record<string, unknown>>;
  readonly error?: Readonly<{
    code: string;
    message: string;
    details?: Record<string, unknown>;
  }>;
  readonly executionTime: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Task handler interface
 */
export interface ITaskHandler {
  /**
   * Handle a tool delegation request
   */
  handle(request: ToolDelegationRequest): Promise<TaskExecutionResult>;

  /**
   * Check if the handler can process the request
   */
  canHandle(request: ToolDelegationRequest): boolean;

  /**
   * Get handler metadata
   */
  getMetadata(): Readonly<{
    name: string;
    category: ToolCapabilityCategory;
    supportedTools: readonly string[];
    estimatedExecutionTime: number;
  }>;
}

/**
 * Email task handler
 */
export class EmailTaskHandler implements ITaskHandler {
  constructor(
    private readonly emailService: {
      sendEmail(params: EmailTaskParameters, agentId: string): Promise<any>;
    }
  ) {}

  /**
   * Handle email delegation request
   */
  async handle(request: ToolDelegationRequest): Promise<TaskExecutionResult> {
    const startTime = Date.now();

    try {
      if (!this.canHandle(request)) {
        throw new ToolDelegationError(
          `Cannot handle tool: ${request.toolName}`,
          'UNSUPPORTED_TOOL',
          { toolName: request.toolName }
        );
      }

      const emailParams = this.validateEmailParameters(request.parameters);
      
      const result = await this.emailService.sendEmail(
        emailParams,
        request.requestingAgentId
      );

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        result: Object.freeze({
          emailId: result.id || ulid(),
          sentAt: new Date(),
          recipients: emailParams.to,
          subject: emailParams.subject
        }),
        executionTime,
        metadata: Object.freeze({
          toolName: request.toolName,
          category: ToolCapabilityCategory.EMAIL
        })
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorCode = error instanceof ToolDelegationError ? error.code : 'EMAIL_EXECUTION_ERROR';

      return {
        success: false,
        error: Object.freeze({
          code: errorCode,
          message: errorMessage,
          details: error instanceof ToolDelegationError ? error.context : undefined
        }),
        executionTime
      };
    }
  }

  /**
   * Check if can handle the request
   */
  canHandle(request: ToolDelegationRequest): boolean {
    return request.toolCategory === ToolCapabilityCategory.EMAIL && 
           ['sendEmail', 'send_email', 'email_send'].includes(request.toolName);
  }

  /**
   * Get handler metadata
   */
  getMetadata() {
    return Object.freeze({
      name: 'EmailTaskHandler',
      category: ToolCapabilityCategory.EMAIL,
      supportedTools: ['sendEmail', 'send_email', 'email_send'],
      estimatedExecutionTime: 2000
    });
  }

  /**
   * Validate email parameters
   */
  private validateEmailParameters(parameters: Readonly<Record<string, unknown>>): EmailTaskParameters {
    const { to, cc, bcc, subject, body, attachments, priority, replyTo } = parameters;

    if (!to || (!Array.isArray(to) && typeof to !== 'string')) {
      throw new ToolDelegationError(
        'Email "to" field is required and must be string or array',
        'INVALID_EMAIL_PARAMETERS',
        { parameters }
      );
    }

    if (!subject || typeof subject !== 'string') {
      throw new ToolDelegationError(
        'Email "subject" field is required and must be string',
        'INVALID_EMAIL_PARAMETERS',
        { parameters }
      );
    }

    if (!body || typeof body !== 'string') {
      throw new ToolDelegationError(
        'Email "body" field is required and must be string',
        'INVALID_EMAIL_PARAMETERS',
        { parameters }
      );
    }

    return {
      to: Array.isArray(to) ? Object.freeze([...to]) : to as string,
      cc: cc ? (Array.isArray(cc) ? Object.freeze([...cc]) : cc as string) : undefined,
      bcc: bcc ? (Array.isArray(bcc) ? Object.freeze([...bcc]) : bcc as string) : undefined,
      subject: subject as string,
      body: body as string,
      attachments: attachments ? Object.freeze([...(attachments as any[])]) : undefined,
      priority: (priority as 'low' | 'normal' | 'high') || 'normal',
      replyTo: replyTo as string | undefined
    };
  }
}

/**
 * Social Media task handler
 */
export class SocialMediaTaskHandler implements ITaskHandler {
  constructor(
    private readonly socialMediaService: {
      createPost(params: SocialMediaTaskParameters, agentId: string): Promise<any>;
    }
  ) {}

  /**
   * Handle social media delegation request
   */
  async handle(request: ToolDelegationRequest): Promise<TaskExecutionResult> {
    const startTime = Date.now();

    try {
      if (!this.canHandle(request)) {
        throw new ToolDelegationError(
          `Cannot handle tool: ${request.toolName}`,
          'UNSUPPORTED_TOOL',
          { toolName: request.toolName }
        );
      }

      const socialParams = this.validateSocialMediaParameters(request.parameters);
      
      const result = await this.socialMediaService.createPost(
        socialParams,
        request.requestingAgentId
      );

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        result: Object.freeze({
          postId: result.id || ulid(),
          postedAt: new Date(),
          content: socialParams.content,
          platforms: socialParams.platforms
        }),
        executionTime,
        metadata: Object.freeze({
          toolName: request.toolName,
          category: ToolCapabilityCategory.SOCIAL_MEDIA
        })
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorCode = error instanceof ToolDelegationError ? error.code : 'SOCIAL_MEDIA_EXECUTION_ERROR';

      return {
        success: false,
        error: Object.freeze({
          code: errorCode,
          message: errorMessage,
          details: error instanceof ToolDelegationError ? error.context : undefined
        }),
        executionTime
      };
    }
  }

  /**
   * Check if can handle the request
   */
  canHandle(request: ToolDelegationRequest): boolean {
    return request.toolCategory === ToolCapabilityCategory.SOCIAL_MEDIA &&
           ['createPost', 'create_post', 'postToSocial', 'post_to_social'].includes(request.toolName);
  }

  /**
   * Get handler metadata
   */
  getMetadata() {
    return Object.freeze({
      name: 'SocialMediaTaskHandler',
      category: ToolCapabilityCategory.SOCIAL_MEDIA,
      supportedTools: ['createPost', 'create_post', 'postToSocial', 'post_to_social'],
      estimatedExecutionTime: 3000
    });
  }

  /**
   * Validate social media parameters
   */
  private validateSocialMediaParameters(parameters: Readonly<Record<string, unknown>>): SocialMediaTaskParameters {
    const { content, platforms, images, hashtags, mentions, scheduleTime, visibility } = parameters;

    if (!content || typeof content !== 'string') {
      throw new ToolDelegationError(
        'Social media "content" field is required and must be string',
        'INVALID_SOCIAL_MEDIA_PARAMETERS',
        { parameters }
      );
    }

    if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
      throw new ToolDelegationError(
        'Social media "platforms" field is required and must be non-empty array',
        'INVALID_SOCIAL_MEDIA_PARAMETERS',
        { parameters }
      );
    }

    return {
      content: content as string,
      platforms: Object.freeze([...platforms]),
      images: images ? Object.freeze([...(images as string[])]) : undefined,
      hashtags: hashtags ? Object.freeze([...(hashtags as string[])]) : undefined,
      mentions: mentions ? Object.freeze([...(mentions as string[])]) : undefined,
      scheduleTime: scheduleTime ? new Date(scheduleTime as string) : undefined,
      visibility: (visibility as 'public' | 'private' | 'unlisted') || 'public'
    };
  }
}

/**
 * Task handler registry
 */
export class CrossAgentTaskHandlerRegistry {
  private readonly handlers: Map<string, ITaskHandler> = new Map();

  constructor(
    private readonly dependencies: {
      emailService?: {
        sendEmail(params: EmailTaskParameters, agentId: string): Promise<any>;
      };
      socialMediaService?: {
        createPost(params: SocialMediaTaskParameters, agentId: string): Promise<any>;
      };
    }
  ) {
    this.initializeHandlers();
  }

  /**
   * Register a task handler
   */
  registerHandler(handler: ITaskHandler): void {
    const metadata = handler.getMetadata();
    
    for (const toolName of metadata.supportedTools) {
      this.handlers.set(toolName, handler);
    }
  }

  /**
   * Get handler for a tool delegation request
   */
  getHandler(request: ToolDelegationRequest): ITaskHandler | null {
    const handler = this.handlers.get(request.toolName);
    return handler && handler.canHandle(request) ? handler : null;
  }

  /**
   * Process a tool delegation request
   */
  async processRequest(request: ToolDelegationRequest): Promise<ToolDelegationResponse> {
    const handler = this.getHandler(request);

    if (!handler) {
      return createToolDelegationResponse(
        request.id,
        'system', // responding agent ID
        ToolDelegationStatus.REJECTED,
        {
          error: {
            code: 'NO_HANDLER_FOUND',
            message: `No handler found for tool: ${request.toolName}`,
            details: { toolName: request.toolName, category: request.toolCategory }
          }
        }
      );
    }

    try {
      const result = await handler.handle(request);

      return createToolDelegationResponse(
        request.id,
        'system', // responding agent ID
        result.success ? ToolDelegationStatus.COMPLETED : ToolDelegationStatus.FAILED,
        {
          result: result.result,
          error: result.error,
          executionTime: result.executionTime,
          metadata: result.metadata
        }
      );

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorCode = error instanceof ToolDelegationError ? error.code : 'HANDLER_EXECUTION_ERROR';

      return createToolDelegationResponse(
        request.id,
        'system', // responding agent ID
        ToolDelegationStatus.FAILED,
        {
          error: {
            code: errorCode,
            message: errorMessage,
            details: error instanceof ToolDelegationError ? error.context : undefined
          }
        }
      );
    }
  }

  /**
   * Get all registered handlers
   */
  getRegisteredHandlers(): readonly ITaskHandler[] {
    const uniqueHandlers = new Set(this.handlers.values());
    return Object.freeze(Array.from(uniqueHandlers));
  }

  /**
   * Initialize default handlers
   */
  private initializeHandlers(): void {
    if (this.dependencies.emailService) {
      this.registerHandler(new EmailTaskHandler(this.dependencies.emailService));
    }

    if (this.dependencies.socialMediaService) {
      this.registerHandler(new SocialMediaTaskHandler(this.dependencies.socialMediaService));
    }
  }
}

/**
 * Pure function to validate task parameters
 */
export const validateTaskParameters = (
  toolCategory: ToolCapabilityCategory,
  parameters: Readonly<Record<string, unknown>>
): boolean => {
  try {
    switch (toolCategory) {
      case ToolCapabilityCategory.EMAIL:
        return !!(parameters.to && parameters.subject && parameters.body);
      
      case ToolCapabilityCategory.SOCIAL_MEDIA:
        return !!(parameters.content && parameters.platforms);
      
      case ToolCapabilityCategory.WORKSPACE:
        return !!(parameters.action && parameters.parameters);
      
      default:
        return true; // Allow other categories
    }
  } catch {
    return false;
  }
}; 